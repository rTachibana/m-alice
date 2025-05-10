import os
import random
from PIL import Image, ImageDraw, ImageOps, ImageFilter
import numpy as np
try:
    from sklearn.cluster import KMeans
    KMEANS_AVAILABLE = True
except ImportError:
    KMEANS_AVAILABLE = False
import logging
from scipy.ndimage import binary_dilation, binary_erosion

# Configure logging for debugging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(asctime)s - %(message)s')

def get_dominant_colors(image, n_colors=3):
    """
    画像から主要な色を抽出する

    Parameters:
    - image: 画像（PIL.Image）
    - n_colors: 抽出する色の数

    Returns:
    - 色のリスト（RGBタプル）
    """
    if not KMEANS_AVAILABLE:
        # sklearn.KMeansが利用できない場合のフォールバック
        return [(255, 0, 0), (0, 0, 0), (255, 255, 255)]
    
    # リサイズして処理を高速化
    img_array = np.array(image.resize((100, 100), Image.LANCZOS))
    # 画像を1次元のピクセル配列に変換
    pixels = img_array.reshape(-1, 3)
    
    # KMeansでクラスタリング
    kmeans = KMeans(n_clusters=n_colors)
    kmeans.fit(pixels)
    
    # クラスターの中心を色として返す
    return [tuple(map(int, center)) for center in kmeans.cluster_centers_]

def get_colors_around_mask(base_image, mask_image, n_colors=3, border_width=5):
    """
    ウォーターマーク周辺の色を抽出する

    Parameters:
    - base_image: 元画像（PIL.Image）
    - mask_image: ウォーターマークのマスク（PIL.Image）
    - n_colors: 抽出する色の数
    - border_width: 周辺領域の幅

    Returns:
    - 色のリスト（RGBタプル）
    """
    if not KMEANS_AVAILABLE:
        # sklearnが利用できない場合は単純に全体の色を使用
        return get_dominant_colors(base_image, n_colors)
    
    # RGBAモードに変換
    base = base_image.convert("RGBA")
    mask = mask_image.convert("RGBA")
    
    # マスクのアルファチャンネルを取得
    alpha = np.array(mask.split()[-1])
    
    # マスクの周辺領域を特定
    dilated = binary_dilation(alpha > 0, iterations=border_width)
    original = alpha > 0
    boundary = dilated & ~original
    
    # 元画像の配列を取得
    base_array = np.array(base)
    
    # 境界に該当するピクセルを抽出
    color_samples = []
    for y in range(alpha.shape[0]):
        for x in range(alpha.shape[1]):
            if y < base_array.shape[0] and x < base_array.shape[1] and boundary[y, x]:
                color_samples.append(base_array[y, x][:3])
    
    if not color_samples:
        return get_dominant_colors(base_image, n_colors)
    
    # KMeansでクラスタリング
    color_samples = np.array(color_samples)
    kmeans = KMeans(n_clusters=n_colors)
    kmeans.fit(color_samples)
    
    # クラスターの中心を色として返す
    return [tuple(map(int, center)) for center in kmeans.cluster_centers_]

def get_watermark_colors(watermark, n_colors=2):
    """
    ウォーターマーク自体から主要な色を抽出する
    
    Parameters:
    - watermark: ウォーターマーク画像（PIL.Image）
    - n_colors: 抽出する色の数
    
    Returns:
    - 色のリスト（RGBタプル）
    """
    if not KMEANS_AVAILABLE:
        return [(255, 255, 255), (0, 0, 0)]
    
    # アルファチャンネルを取得
    alpha = watermark.split()[-1]
    alpha_array = np.array(alpha)
    
    # ウォーターマークのピクセルを取得（アルファ値が0より大きいピクセルのみ）
    watermark_array = np.array(watermark.convert('RGB'))
    pixels = []
    
    for y in range(alpha_array.shape[0]):
        for x in range(alpha_array.shape[1]):
            if alpha_array[y, x] > 50:  # ある程度不透明なピクセルのみを対象に
                pixels.append(watermark_array[y, x])
    
    if not pixels:
        return [(255, 255, 255), (0, 0, 0)]
    
    # KMeansでクラスタリング
    pixels = np.array(pixels)
    kmeans = KMeans(n_clusters=n_colors)
    kmeans.fit(pixels)
    
    # クラスターの中心を色として返す
    return [tuple(map(int, center)) for center in kmeans.cluster_centers_]

def blend_colors(color1, color2, ratio):
    """
    2つの色をブレンドする
    
    Parameters:
    - color1: 1つ目の色（RGBタプル）
    - color2: 2つ目の色（RGBタプル）
    - ratio: ブレンド比率（0.0〜1.0）、1.0が完全にcolor1
    
    Returns:
    - ブレンドされた色（RGBタプル）
    """
    r = int(color1[0] * ratio + color2[0] * (1 - ratio))
    g = int(color1[1] * ratio + color2[1] * (1 - ratio))
    b = int(color1[2] * ratio + color2[2] * (1 - ratio))
    return (r, g, b)

def add_outline_with_colors(watermark, colors, border_width=5, opacity=0.8, overlap_factor=0.2):
    """
    ウォーターマークに複数の色でアウトラインを追加する（改良版）
    
    Parameters:
    - watermark: ウォーターマーク画像（PIL.Image）
    - colors: アウトライン色のリスト（RGBタプル）
    - border_width: アウトラインの幅
    - opacity: アウトラインの不透明度
    - overlap_factor: ウォーターマークとアウトラインの重なり係数（0.0-1.0）
                      値が大きいほど重なりが大きい
    
    Returns:
    - アウトラインが追加されたウォーターマーク画像（PIL.Image）
    """
    # アルファチャンネルを取得
    alpha = watermark.split()[-1]
    alpha_array = np.array(alpha)
    
    # アウトライン画像を作成
    outline_image = Image.new("RGBA", watermark.size, (0, 0, 0, 0))
    
    # 各色ごとに異なる幅のアウトラインを作成
    color_count = len(colors)
    width_per_color = max(1, border_width // color_count)
    
    # ウォーターマークのマスク縮小量（重なり用）
    shrink_amount = int(border_width * overlap_factor)
    
    # ウォーターマークのマスクを少し縮小して重なりを作る
    if shrink_amount > 0:
        # マスクを縮小するための演算（エロージョン）
        watermark_mask = alpha_array > 0
        eroded_mask = binary_erosion(watermark_mask, iterations=shrink_amount)
        # 元のマスクから縮小したマスクを引いて、重なり部分を特定
        overlap_mask = watermark_mask & ~eroded_mask
    else:
        overlap_mask = np.zeros_like(alpha_array, dtype=bool)
    
    for i, color in enumerate(colors):
        # この色のアウトライン範囲を計算
        start_width = i * width_per_color
        end_width = (i + 1) * width_per_color if i < color_count - 1 else border_width
        
        for w in range(start_width, end_width):
            # マスクを指定の幅だけ拡張
            dilated_mask = binary_dilation(alpha_array > 0, iterations=w+1)
            # 拡張したマスクから元のアルファチャンネルを引いて外側の輪郭のみを取得
            if w == 0:
                outline_mask = dilated_mask & ~(alpha_array > 0)
            else:
                prev_dilated = binary_dilation(alpha_array > 0, iterations=w)
                outline_mask = dilated_mask & ~prev_dilated
            
            # 重なり部分を考慮
            outline_mask = outline_mask | (overlap_mask & (w < shrink_amount))
            
            # この輪郭に色を適用（外側ほど少し透明度を上げる）
            # 透明度が外側に向かって少しずつ上がるように調整
            fade_factor = 1.0 - w / border_width * 0.3
            outline_color = color + (int(255 * opacity * fade_factor),)
            draw = ImageDraw.Draw(outline_image)
            
            for y in range(outline_mask.shape[0]):
                for x in range(outline_mask.shape[1]):
                    if outline_mask[y, x]:
                        draw.point((x, y), fill=outline_color)
    
    # 輪郭をぼかす処理を追加
    outline_image = outline_image.filter(ImageFilter.GaussianBlur(radius=0.5))
    
    # アウトラインをウォーターマークの下に配置する順序で合成
    result = Image.new("RGBA", watermark.size, (0, 0, 0, 0))
    result.paste(outline_image, (0, 0), outline_image.split()[-1])
    result.paste(watermark, (0, 0), watermark.split()[-1])
    
    return result

def add_simple_outline(watermark, outline_color, border_width=5, opacity=0.8, overlap_factor=0.2):
    """
    ウォーターマークにシンプルな単色アウトラインを追加する
    
    Parameters:
    - watermark: ウォーターマーク画像（PIL.Image）
    - outline_color: アウトライン色（RGBタプル）
    - border_width: アウトラインの幅
    - opacity: アウトラインの不透明度
    - overlap_factor: ウォーターマークとアウトラインの重なり係数
    
    Returns:
    - アウトラインが追加されたウォーターマーク画像（PIL.Image）
    """
    # アルファチャンネルを取得
    alpha = watermark.split()[-1]
    alpha_array = np.array(alpha)
    
    # アウトライン画像を作成
    outline_image = Image.new("RGBA", watermark.size, (0, 0, 0, 0))
    
    # ウォーターマークのマスク縮小量（重なり用）
    shrink_amount = int(border_width * overlap_factor)
    
    # ウォーターマークのマスクを少し縮小して重なりを作る
    if shrink_amount > 0:
        watermark_mask = alpha_array > 0
        eroded_mask = binary_erosion(watermark_mask, iterations=shrink_amount)
        overlap_mask = watermark_mask & ~eroded_mask
    else:
        overlap_mask = np.zeros_like(alpha_array, dtype=bool)
    
    # 拡張マスクを作成（アウトラインの形状）
    dilated_mask = binary_dilation(alpha_array > 0, iterations=border_width)
    outline_mask = dilated_mask & ~(alpha_array > 0)
    
    # 重なり部分を考慮
    outline_mask = outline_mask | overlap_mask
    
    # アウトラインを描画
    draw = ImageDraw.Draw(outline_image)
    outline_rgba = outline_color + (int(255 * opacity),)
    
    for y in range(outline_mask.shape[0]):
        for x in range(outline_mask.shape[1]):
            if outline_mask[y, x]:
                draw.point((x, y), fill=outline_rgba)
    
    # 輪郭をぼかす処理を追加（軽めのぼかし）
    outline_image = outline_image.filter(ImageFilter.GaussianBlur(radius=0.7))
    
    # アウトラインをウォーターマークの下に配置する順序で合成
    result = Image.new("RGBA", watermark.size, (0, 0, 0, 0))
    result.paste(outline_image, (0, 0), outline_image.split()[-1])
    result.paste(watermark, (0, 0), watermark.split()[-1])
    
    return result

def apply_watermark(base_image, watermark_path, opacity=0.6, invert=False, enable_outline=True, size_factor=0.5, outline_color=None):
    """
    ベース画像にウォーターマークを適用する関数
    
    Parameters:
    - base_image: ベースとなる画像（PIL.Image）
    - watermark_path: ウォーターマーク画像のパス
    - opacity: ウォーターマークの不透明度（0.0〜1.0）
    - invert: ウォーターマークを白黒反転するかどうか
    - enable_outline: アウトラインを有効にするかどうか
    - size_factor: ウォーターマークサイズの係数（0.1〜1.0）、元画像の短辺に対する割合
    - outline_color: アウトラインの色（RGBタプル）、Noneの場合は自動検出
    
    Returns:
    - 処理された画像（PIL.Image）
    """
    logging.debug(f"Starting apply_watermark with opacity: {opacity}, invert: {invert}, enable_outline: {enable_outline}, size_factor: {size_factor}")

    try:
        with Image.open(watermark_path) as watermark:
            if watermark.mode != 'RGBA':
                watermark = watermark.convert('RGBA')

            if invert:
                r, g, b, a = watermark.split()
                rgb_image = Image.merge('RGB', (r, g, b))
                inverted_rgb = ImageOps.invert(rgb_image)
                r, g, b = inverted_rgb.split()
                watermark = Image.merge('RGBA', (r, g, b, a))

            # ウォーターマークの透明度を適用
            if 0.0 <= opacity <= 1.0:
                alpha = watermark.split()[-1]
                alpha = alpha.point(lambda p: int(p * opacity))
                watermark.putalpha(alpha)

            base_width, base_height = base_image.size
            short_edge = min(base_width, base_height)
            
            # ウォーターマークのアスペクト比を維持してリサイズ
            wm_width, wm_height = watermark.size
            aspect_ratio = wm_width / wm_height

            # sizeFactorは0.1から1.0の範囲で制限
            size_factor = max(0.1, min(1.0, size_factor))
            
            if base_width / base_height > aspect_ratio:
                new_wm_height = int(short_edge * size_factor)
                new_wm_width = int(new_wm_height * aspect_ratio)
            else:
                new_wm_width = int(short_edge * size_factor)
                new_wm_height = int(new_wm_width / aspect_ratio)

            watermark = watermark.resize((new_wm_width, new_wm_height), Image.LANCZOS)
            logging.debug(f"Resized watermark to: {new_wm_width}x{new_wm_height}")

            # アウトラインの追加
            if enable_outline:
                # 画像サイズに応じた固定のアウトライン幅を設定
                if short_edge <= 512:
                    border_width = 5  # Small - 5px
                elif short_edge <= 1024:
                    border_width = 10  # Medium - 10px
                else:
                    border_width = 15  # Default (1024x1024以上) - 15px
                
                logging.debug(f"Using fixed border width: {border_width}px")
                
                # 指定された色があればそれを使用、なければ周囲から抽出
                if outline_color:
                    logging.debug(f"Using specified outline color: {outline_color}")
                    # シンプルな単色アウトラインを適用
                    watermark = add_simple_outline(
                        watermark, 
                        outline_color, 
                        border_width=border_width, 
                        opacity=opacity,
                        overlap_factor=0.2
                    )
                else:
                    # 周囲の色を抽出
                    colors = get_colors_around_mask(base_image, watermark, n_colors=1, border_width=border_width)
                    logging.debug(f"Using extracted outline color: {colors[0]}")
                    # シンプルな単色アウトラインを適用
                    watermark = add_simple_outline(
                        watermark, 
                        colors[0], 
                        border_width=border_width, 
                        opacity=opacity,
                        overlap_factor=0.2
                    )
                
                logging.debug("Added outline to watermark.")

            # 全体的なぼかし処理を追加して自然に見せる（軽度）
            watermark = watermark.filter(ImageFilter.GaussianBlur(radius=0.5))
            logging.debug("Applied slight blur to watermark edges")

            # ウォーターマークを中央に配置
            paste_x = (base_width - new_wm_width) // 2
            paste_y = (base_height - new_wm_height) // 2

            # ウォーターマーク画像をベース画像に合成
            composite_with_watermark = Image.new('RGBA', (base_width, base_height), (0, 0, 0, 0))
            composite_with_watermark.paste(watermark, (paste_x, paste_y), watermark.split()[-1])

            # 元画像をRGBAモードに変換して保持
            base_image_rgba = base_image.convert('RGBA')

            # ウォーターマーク画像をベース画像に合成
            final_composite = Image.alpha_composite(base_image_rgba, composite_with_watermark)

            logging.debug("Final composite with watermark completed.")

            return final_composite

    except Exception as e:
        logging.error(f"Watermark application error: {str(e)}")
        return base_image
