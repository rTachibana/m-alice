import os
import random
from PIL import Image, ImageDraw, ImageOps
import numpy as np
from sklearn.cluster import KMeans

def get_main_colors_under_mask(base_image, mask_image, n_colors=3):
    """
    ウォーターマーク境界の色と元画像を比較し、近似色を複数抽出する

    Parameters:
    - base_image: 元画像（PIL.Image）
    - mask_image: ウォーターマークのアルファマスク（PIL.Image）
    - n_colors: 抽出する近似色の数

    Returns:
    - 近似色のリスト（RGBタプル）
    """
    base = base_image.convert("RGBA")
    mask = mask_image.convert("L")  # アルファマスク

    mask_array = np.array(mask)
    border = (mask_array > 0) & (mask_array < 255)  # 中間部分 ≒ エッジ領域

    base_array = np.array(base)
    edge_pixels = base_array[border]

    if len(edge_pixels) == 0:
        return [(128, 128, 128)] * n_colors  # フォールバック

    kmeans = KMeans(n_clusters=n_colors)
    kmeans.fit(edge_pixels[:, :3])
    return [tuple(map(int, center)) for center in kmeans.cluster_centers_]

def apply_gradient_outline(wm_image, outline_colors, border_width=5):
    """
    ウォーターマーク画像に近似色のグラデーションアウトラインを描く

    Parameters:
    - wm_image: ウォーターマーク画像（PIL.Image）
    - outline_colors: グラデーションに使用する色のリスト（RGBタプル）
    - border_width: 縁取りの幅

    Returns:
    - 縁取りが追加されたウォーターマーク画像（PIL.Image）
    """
    img = wm_image.convert("RGBA")
    alpha = img.split()[-1]

    mask = np.array(alpha)
    gradient_mask = np.zeros_like(mask, dtype=np.uint8)

    for i, color in enumerate(outline_colors):
        layer = np.pad(mask, pad_width=border_width * (i + 1), mode='constant')
        gradient_mask = np.maximum(gradient_mask, layer)

    gradient_image = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(gradient_image)

    for y in range(mask.shape[0]):
        for x in range(mask.shape[1]):
            if gradient_mask[y, x] > 0:
                color_index = int((gradient_mask[y, x] / 255) * (len(outline_colors) - 1))
                draw.point((x, y), fill=outline_colors[color_index] + (255,))

    return Image.alpha_composite(img, gradient_image)

def apply_watermark(base_image, watermark_path, opacity=0.6, invert=False, border_width=5):
    """
    ベース画像にウォーターマークを適用し、縁取りを追加する関数

    Parameters:
    - base_image: ベースとなる画像（PIL.Image）
    - watermark_path: ウォーターマーク画像のパス
    - opacity: ウォーターマークの不透明度（0.0〜1.0）
    - invert: ウォーターマークを白黒反転するかどうか
    - border_width: 縁取りの幅

    Returns:
    - 処理された画像（PIL.Image）
    """
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

            base_width, base_height = base_image.size
            watermark_width, watermark_height = watermark.size
            short_edge = min(base_width, base_height)
            wm_short_edge = min(watermark_width, watermark_height)
            scale_ratio = short_edge / wm_short_edge
            new_wm_width = int(watermark_width * scale_ratio)
            new_wm_height = int(watermark_height * scale_ratio)
            resized_watermark = watermark.resize((new_wm_width, new_wm_height), Image.LANCZOS)

            if 0.1 <= opacity <= 1:
                alpha = resized_watermark.split()[3]
                alpha = alpha.point(lambda p: p * opacity)
                resized_watermark.putalpha(alpha)

            outline_colors = get_main_colors_under_mask(base_image, resized_watermark, n_colors=3)
            outlined_watermark = apply_gradient_outline(resized_watermark, outline_colors, border_width)

            if base_image.mode != 'RGBA':
                base_with_alpha = base_image.convert('RGBA')
            else:
                base_with_alpha = base_image.copy()

            composite = Image.new('RGBA', base_image.size, (0, 0, 0, 0))
            paste_x = (base_width - new_wm_width) // 2
            paste_y = (base_height - new_wm_height) // 2
            composite.paste(outlined_watermark, (paste_x, paste_y), outlined_watermark)

            result = Image.alpha_composite(base_with_alpha, composite)
            if base_image.mode != 'RGBA':
                result = result.convert(base_image.mode)
            return result
    except Exception as e:
        print(f"ウォーターマーク適用エラー: {e}")
        return base_image
