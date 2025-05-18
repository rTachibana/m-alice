from PIL import Image
from math import sqrt

def resize_image(image, resize_option):
    """
    画像をリサイズする関数

    Parameters:
    - image: リサイズする画像（PIL.Image）
    - resize_option: リサイズオプション（'small', 'medium', 'default'）

    Returns:
    - リサイズされた画像（PIL.Image）
    """
    # 現在の画像サイズとピクセル数
    width, height = image.size
    total_pixels = width * height
    current_megapixels = total_pixels / 1000000  # メガピクセル単位

    # リサイズ対象のピクセル数マップ
    target_pixels = {
        'small': 250000,  # 約500x500相当（総ピクセル数25万px以下）
        'medium': 589824,  # 約768x768相当
        'default': 2000000,  # 2メガピクセル (デフォルト)
    }

    # サポート外オプションの場合はデフォルトを使用
    if resize_option not in target_pixels:
        resize_option = 'default'
    
    # 既に目標サイズ以下の場合はリサイズしない
    if total_pixels <= target_pixels[resize_option]:
        print(f"Image size is already small enough, so skip resizing: {width}x{height} ({current_megapixels:.2f}MP)")
        return image

    # リサイズ比率を計算
    ratio = (target_pixels[resize_option] / total_pixels) ** 0.5
    new_width = int(width * ratio)
    new_height = int(height * ratio)

    print(f"Resize: {width}x{height} ({current_megapixels:.2f}MP) → {new_width}x{new_height} ({target_pixels[resize_option]/1000000:.2f}MP)")
    
    # リサイズして返す
    return image.resize((new_width, new_height), Image.LANCZOS)
