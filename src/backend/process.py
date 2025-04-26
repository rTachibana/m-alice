import sys
import os
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
            
            # ウォーターマークをベース画像に合わせてリサイズ
            watermark = watermark.resize(base_image.size, Image.LANCZOS)
            
            # 透明度の調整
            if 0.1 <= opacity <= 1:
                alpha = watermark.split()[3]  # Extract alpha channel
                alpha = alpha.point(lambda p: p * opacity)
                watermark.putalpha(alpha)
            
            # ベース画像がRGBA形式でない場合、変換
            if base_image.mode != 'RGBA':
                base_with_alpha = base_image.convert('RGBA')
            else:
                base_with_alpha = base_image.copy()
            
            # ウォーターマークを合成
            result = Image.alpha_composite(base_with_alpha, watermark)
            
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