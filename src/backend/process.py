import sys
import os
import random
from PIL import Image, ImageDraw, ImageOps, ImageEnhance

def process_image(input_path, output_path, options=None):
    """
    画像処理のメイン関数
    options: 処理オプションを含む辞書
    """
    try:
        # 画像を開く
        with Image.open(input_path) as img:
            processed_img = img.copy()
            
            # ウォーターマーク処理（有効な場合）
            if options and options.get('apply_watermark'):
                watermark_path = options.get('watermark_path')
                opacity = options.get('opacity', 0.6)  # デフォルト透過率60%
                invert = options.get('invert', False)  # 白黒反転オプション
                
                processed_img = apply_watermark(
                    processed_img, 
                    watermark_path, 
                    opacity=opacity,
                    invert=invert
                )
            
            # リサイズ処理（オプションがある場合）
            if options and options.get('resize'):
                resize_option = options.get('resize')
                processed_img = resize_image(processed_img, resize_option)
            
            # マリス・ロゴを指定された位置またはランダムに配置（常に実行）
            app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
            logo_path = os.path.join(app_root, 'src', 'logo', 'logo.png')
            
            if os.path.exists(logo_path):
                # オプションからロゴ位置を取得（デフォルトはランダム）
                logo_position = 'random'
                if options and 'logo_position' in options:
                    logo_position = options.get('logo_position')
                
                processed_img = apply_marice_logo(
                    processed_img, 
                    logo_path, 
                    position=logo_position
                )
            
            # 保存
            processed_img.save(output_path)
            
        print("SUCCESS")
        return True
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def apply_watermark(base_image, watermark_path, opacity=0.6, invert=False):
    """
    ベース画像にウォーターマークを適用する関数
    
    Parameters:
    - base_image: ベースとなる画像（PIL.Image）
    - watermark_path: ウォーターマーク画像のパス
    - opacity: ウォーターマークの不透明度（0.0〜1.0）
    - invert: ウォーターマークを白黒反転するかどうか
    
    Returns:
    - 処理された画像（PIL.Image）
    """
    try:
        # ウォーターマーク画像を開く
        with Image.open(watermark_path) as watermark:
            # RGBA形式でコピー
            if watermark.mode != 'RGBA':
                watermark = watermark.convert('RGBA')
            
            # 必要に応じてウォーターマークを白黒反転
            if invert:
                # アルファチャンネルを保存
                r, g, b, a = watermark.split()
                rgb_image = Image.merge('RGB', (r, g, b))
                
                # RGBチャンネルを反転
                inverted_rgb = ImageOps.invert(rgb_image)
                
                # アルファチャンネルを再結合
                r, g, b = inverted_rgb.split()
                watermark = Image.merge('RGBA', (r, g, b, a))
            
            # ベース画像とウォーターマークのサイズを取得
            base_width, base_height = base_image.size
            watermark_width, watermark_height = watermark.width, watermark.height
            
            # ベース画像の短辺を特定
            short_edge = min(base_width, base_height)
            
            # ウォーターマークの短辺に対する比率を計算
            wm_short_edge = min(watermark_width, watermark_height)
            scale_ratio = short_edge / wm_short_edge
            
            # ウォーターマークの新しいサイズを計算（アスペクト比を維持）
            new_wm_width = int(watermark_width * scale_ratio)
            new_wm_height = int(watermark_height * scale_ratio)
            
            # ウォーターマークをリサイズ（アスペクト比を維持）
            resized_watermark = watermark.resize((new_wm_width, new_wm_height), Image.LANCZOS)
            
            # 透明度の調整
            if 0.1 <= opacity <= 1:
                alpha = resized_watermark.split()[3]  # Extract alpha channel
                alpha = alpha.point(lambda p: p * opacity)
                resized_watermark.putalpha(alpha)
            
            # ベース画像がRGBA形式でない場合、変換
            if base_image.mode != 'RGBA':
                base_with_alpha = base_image.convert('RGBA')
            else:
                base_with_alpha = base_image.copy()
            
            # 合成画像を準備（ベースと同じサイズ）
            composite = Image.new('RGBA', base_image.size, (0, 0, 0, 0))
            
            # ウォーターマークを中央に配置するためのオフセットを計算
            paste_x = (base_width - new_wm_width) // 2
            paste_y = (base_height - new_wm_height) // 2
            
            # ウォーターマークを合成画像に貼り付け
            composite.paste(resized_watermark, (paste_x, paste_y), resized_watermark)
            
            # ベース画像とウォーターマークを合成
            result = Image.alpha_composite(base_with_alpha, composite)
            
            # 元の形式に戻す（必要な場合）
            if base_image.mode != 'RGBA':
                result = result.convert(base_image.mode)
                
            return result
            
    except Exception as e:
        print(f"ウォーターマーク適用エラー: {e}")
        # エラーが発生した場合は元の画像を返す
        return base_image

def resize_image(image, resize_option):
    """
    画像をリサイズする関数
    
    Parameters:
    - image: リサイズする画像（PIL.Image）
    - resize_option: リサイズオプション（'small', 'medium', 'default'）
    
    Returns:
    - リサイズされた画像（PIL.Image）
    """
    if resize_option == 'default' or not resize_option:
        return image  # リサイズなし
    
    # 現在の画像サイズ
    width, height = image.size
    
    # 総ピクセル数の計算
    total_pixels = width * height
    
    # リサイズ目標
    target_pixels = {
        'small': 250000,  # 約500x500相当（総ピクセル数25万px以下）
        'medium': 589824,  # 約768x768相当（総ピクセル数約58万px以下）
    }
    
    if resize_option not in target_pixels:
        return image  # サポートされていないオプション
    
    # 現在のピクセル数が目標より小さい場合はリサイズ不要
    if total_pixels <= target_pixels[resize_option]:
        return image
    
    # リサイズ比率の計算
    ratio = (target_pixels[resize_option] / total_pixels) ** 0.5
    
    # 新しいサイズを計算（アスペクト比を維持）
    new_width = int(width * ratio)
    new_height = int(height * ratio)
    
    # リサイズして返す
    return image.resize((new_width, new_height), Image.LANCZOS)

def apply_marice_logo(base_image, logo_path, margin=24, position='random'):
    """
    ベース画像にマリス・ロゴを指定位置または四隅のどこかにランダムに配置する関数
    
    Parameters:
    - base_image: ベースとなる画像（PIL.Image）
    - logo_path: マリス・ロゴ画像のパス
    - margin: 画像の端からの距離（ピクセル）
    - position: ロゴの位置（'random', 'top-left', 'top-right', 'bottom-left', 'bottom-right'）
    
    Returns:
    - 処理された画像（PIL.Image）
    """
    try:
        # ロゴ画像を開く
        with Image.open(logo_path) as logo:
            # RGBA形式でコピー
            if logo.mode != 'RGBA':
                logo = logo.convert('RGBA')
            
            # ベース画像のサイズを取得
            base_width, base_height = base_image.size
            
            # 短辺を特定
            short_edge = min(base_width, base_height)
            
            # 画像の短辺の20%をロゴの最大サイズとする
            logo_max_size = int(short_edge * 0.2)
            
            # ロゴのアスペクト比を維持しつつ、指定サイズにリサイズ
            logo_width, logo_height = logo.size
            aspect_ratio = logo_width / logo_height
            
            if logo_width > logo_height:
                new_width = logo_max_size
                new_height = int(logo_max_size / aspect_ratio)
            else:
                new_height = logo_max_size
                new_width = int(logo_max_size * aspect_ratio)
            
            logo = logo.resize((new_width, new_height), Image.LANCZOS)
            
            # 画像が小さすぎる場合はロゴを配置しない
            if base_width < new_width + margin * 2 or base_height < new_height + margin * 2:
                print("画像が小さすぎるため、ロゴを配置しません")
                return base_image
            
            # ロゴを配置する四隅の座標を計算（マージンを考慮）
            positions = {
                'top-left': (margin, margin),  # 左上
                'top-right': (base_width - new_width - margin, margin),  # 右上
                'bottom-left': (margin, base_height - new_height - margin),  # 左下
                'bottom-right': (base_width - new_width - margin, base_height - new_height - margin)  # 右下
            }
            
            # 位置の選択
            if position == 'random':
                # ランダムに位置を選択
                position_key = random.choice(list(positions.keys()))
                paste_position = positions[position_key]
                print(f"ランダムに選択された位置: {position_key}")
            elif position in positions:
                # 指定された位置を使用
                paste_position = positions[position]
                print(f"指定された位置: {position}")
            else:
                # 不明な位置の場合はランダム
                position_key = random.choice(list(positions.keys()))
                paste_position = positions[position_key]
                print(f"不明な位置指定、ランダムに選択: {position_key}")
            
            # ベース画像がRGBA形式でない場合、変換
            if base_image.mode != 'RGBA':
                base_with_alpha = base_image.convert('RGBA')
            else:
                base_with_alpha = base_image.copy()
            
            # 合成画像を準備（ベースと同じサイズ）
            composite = Image.new('RGBA', base_image.size, (0, 0, 0, 0))
            
            # ロゴを合成画像に貼り付け
            composite.paste(logo, paste_position, logo)
            
            # ベース画像とロゴを合成
            result = Image.alpha_composite(base_with_alpha, composite)
            
            # 元の形式に戻す（必要な場合）
            if base_image.mode != 'RGBA':
                result = result.convert(base_image.mode)
                
            return result
            
    except Exception as e:
        print(f"マリス・ロゴ適用エラー: {e}")
        # エラーが発生した場合は元の画像を返す
        return base_image

if __name__ == "__main__":
    # コマンドライン引数の解析
    if len(sys.argv) < 3:
        print("ERROR: Not enough arguments")
        print("Usage: python process.py <input_path> <output_path> [options_json]")
        sys.exit(1)

    input_path = os.path.abspath(sys.argv[1])
    output_path = os.path.abspath(sys.argv[2])
    
    # オプションのJSONがある場合
    options = None
    if len(sys.argv) > 3:
        import json
        try:
            options = json.loads(sys.argv[3])
        except json.JSONDecodeError:
            print("ERROR: Invalid JSON options")
            sys.exit(1)
    
    success = process_image(input_path, output_path, options)
    if not success:
        sys.exit(1)