import sys
import os
import random
import logging
from PIL import Image, ImageDraw, ImageOps, ImageEnhance
import numpy as np
try:
    from scipy.fft import dct, idct  # modern SciPy
except ImportError:
    try:
        from scipy.fftpack import dct, idct  # fallback for older SciPy
    except ImportError:
        raise ImportError("scipy is required for DCT operations; please install scipy via pip")
import piexif
import json
import datetime

# スクリプトの場所を取得してパスを追加
script_dir = os.path.dirname(os.path.abspath(__file__))
if (script_dir not in sys.path):
    sys.path.append(script_dir)

# 絶対インポートに変更
from watermark_processor import apply_watermark
from metadata_processor import process_metadata
from image_resizer import resize_image
from logo_processor import apply_logo_if_needed

# noiseモジュールの関数を明示的に絶対パスでインポート
sys.path.insert(0, script_dir)  # noiseディレクトリを最優先に
from noise.gaussian import apply_gaussian_noise
from noise.dct import apply_dct_noise
from noise.shot import apply_shot_noise
from noise.himalayan_shot import apply_himalayan_shot_noise
from noise.speckle import apply_speckle_noise
from noise.mustard import apply_mustard_noise

def process_image(input_path, output_path, options=None):
    """
    画像処理のメイン関数
    options: 処理オプションを含む辞書
    """
    try:
        # 入力ファイルの拡張子を確認
        input_ext = os.path.splitext(input_path)[1].lower()
        if input_ext not in ['.png', '.jpg', '.jpeg', '.webp']:
            raise ValueError(f"Unsupported file format: {input_ext}. Only PNG, JPG, and WEBP are supported.")
        
        # 画像を開く
        with Image.open(input_path) as img:
            processed_img = img.copy()
            
            # 1. リサイズ処理
            if options and options.get('resize'):
                resize_option = options.get('resize')
                processed_img = resize_image(processed_img, resize_option)
            
            # 2. DCTノイズを適用
            if options and 'noise_level' in options and 'dct' in options.get('noise_types', []):
                noise_level = options.get('noise_level', 0.5)
                processed_img = apply_single_noise(
                    processed_img,
                    noise_type='dct',
                    noise_level=noise_level
                )
            
            # 3-6. ランダムノイズを適用
            random_noise_types = []
            if options and 'noise_level' in options:
                noise_types = options.get('noise_types', [])
                
                # ランダム化するノイズタイプを収集
                if 'gaussian' in noise_types:
                    random_noise_types.append('gaussian')
                if 'speckle' in noise_types:
                    random_noise_types.append('speckle')
                if 'shot' in noise_types:
                    random_noise_types.append('shot')
                if 'himalayan' in noise_types:
                    random_noise_types.append('himalayan')
                
                # ノイズタイプをシャッフル
                random.shuffle(random_noise_types)
                
                # シャッフルしたノイズを順に適用
                for noise_type in random_noise_types:
                    noise_level = options.get('noise_level', 0.5)
                    processed_img = apply_single_noise(
                        processed_img,
                        noise_type=noise_type,
                        noise_level=noise_level
                    )
            
            # 7. Mustardノイズを適用
            if options and 'noise_level' in options and 'mustard' in options.get('noise_types', []):
                noise_level = options.get('noise_level', 0.5)
                processed_img = apply_single_noise(
                    processed_img,
                    noise_type='mustard',
                    noise_level=noise_level
                )
            
            # 8. ウォーターマークを適用
            if options.get('apply_watermark'):
                # ウォーターマークのパラメータを取得（スネークケースに統一）
                watermark_path = options.get('watermark_path')
                watermark_opacity = options.get('watermark_opacity', 0.6)
                invert_watermark = options.get('invert_watermark', False)
                enable_outline = options.get('enable_outline', True)
                watermark_size = options.get('watermark_size', 0.5)
                outline_color = options.get('outline_color', None)  # アウトラインの色をオプションから取得
                
                logging.debug(f"Applying watermark: {watermark_path}")
                logging.debug(f"Watermark params - opacity: {watermark_opacity}, invert: {invert_watermark}, enable_outline: {enable_outline}, size_factor: {watermark_size}, outline_color: {outline_color}")
                
                # 有効なウォーターマークパスがある場合のみ適用
                if watermark_path and os.path.exists(watermark_path):
                    processed_img = apply_watermark(
                        processed_img, 
                        watermark_path, 
                        opacity=watermark_opacity,
                        invert=invert_watermark,
                        enable_outline=enable_outline,
                        size_factor=watermark_size,
                        outline_color=outline_color  # アウトラインの色を渡す
                    )
                else:
                    logging.error(f"Watermark path invalid or file not found: {watermark_path}")
            
            # 9. ロゴを配置
            processed_img = apply_logo_if_needed(processed_img, options)
            
            # 10. 最終仕上げのガウシアンノイズを適用
            final_noise_level = 0.2  # Lv.2相当の弱いノイズ
            processed_img = apply_single_noise(
                processed_img,
                noise_type='gaussian',
                noise_level=final_noise_level
            )
            
            # 11. メタデータ処理を実行
            if options and (options.get('remove_metadata', True) or 
                        options.get('add_fake_metadata', True) or 
                        options.get('add_no_ai_flag', True)):
                
                metadata_options = {
                    'remove_metadata': options.get('remove_metadata', True),
                    'add_fake_metadata': options.get('add_fake_metadata', True),
                    'fake_metadata_type': options.get('fake_metadata_type', 'random'),
                    'add_no_ai_flag': options.get('add_no_ai_flag', True),
                }
                
                process_metadata(output_path, output_path, metadata_options)
            
            # 出力形式の設定を処理
            output_format = options.get('output_format', 'png') if options else 'png'
            
            # 出力パスの拡張子を取得
            output_ext = os.path.splitext(output_path)[1].lower()
            
            # 設定された出力形式に基づいて出力ファイル名を調整
            if output_format == 'webp' and output_ext != '.webp':
                output_path = os.path.splitext(output_path)[0] + '.webp'
            elif output_format == 'png' and output_ext != '.png':
                output_path = os.path.splitext(output_path)[0] + '.png'
            
            # 保存（出力形式に応じたオプション設定）
            if output_format == 'webp':
                processed_img.save(output_path, format='WEBP', lossless=True, quality=100)
            else:  # pngがデフォルト
                processed_img.save(output_path, format='PNG')
        
        print("SUCCESS")
        return True
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def apply_noise(image, noise_level=0.5, noise_types=None):
    """
    画像にノイズを適用する関数
    
    Parameters:
    - image: ノイズを適用する画像（PIL.Image）
    - noise_level: ノイズの強度（0.0〜1.0）
    - noise_types: 適用するノイズの種類のリスト（例：['gaussian', 'dct', 'shot', 'speckle', 'himalayan', 'mustard']）
    
    Returns:
    - ノイズが適用された画像（PIL.Image）
    """
    if noise_types is None:
        noise_types = ['gaussian', 'dct']  # デフォルトのノイズタイプ
    
    # PIL画像をNumPy配列に変換
    img_array = np.array(image).astype(np.float32)
    
    # ガウシアンノイズ
    if 'gaussian' in noise_types:
        img_array = apply_gaussian_noise(img_array, noise_level)
    
    # DCTノイズ
    if 'dct' in noise_types:
        img_array = apply_dct_noise(img_array, noise_level)
    
    # ショットノイズ
    if 'shot' in noise_types:
        img_array = apply_shot_noise(img_array, noise_level)
    
    # ヒマラヤソルト＆ペッパーノイズ
    if 'himalayan' in noise_types:
        img_array = apply_himalayan_shot_noise(img_array, noise_level)
    
    # スペックルノイズ
    if 'speckle' in noise_types:
        img_array = apply_speckle_noise(img_array, noise_level)
    
    # マスタードノイズ
    if 'mustard' in noise_types:
        img_array = apply_mustard_noise(img_array, noise_level)
    
    # NumPy配列をPIL画像に戻す
    img_array = np.clip(img_array, 0, 255).astype(np.uint8)
    return Image.fromarray(img_array)

def apply_single_noise(image, noise_type, noise_level=0.5):
    """
    画像に単一のノイズを適用する関数
    
    Parameters:
    - image: ノイズを適用する画像（PIL.Image）
    - noise_type: 適用するノイズの種類（'gaussian', 'dct', 'shot', 'speckle', 'himalayan', 'mustard'）
    - noise_level: ノイズの強度（0.0〜1.0）
    
    Returns:
    - ノイズが適用された画像（PIL.Image）
    """
    img_array = np.array(image).astype(np.float32)
    
    if noise_type == 'gaussian':
        img_array = apply_gaussian_noise(img_array, noise_level)
    elif noise_type == 'dct':
        img_array = apply_dct_noise(img_array, noise_level)
    elif noise_type == 'shot':
        img_array = apply_shot_noise(img_array, noise_level)
    elif noise_type == 'himalayan':
        img_array = apply_himalayan_shot_noise(img_array, noise_level)
    elif noise_type == 'speckle':
        img_array = apply_speckle_noise(img_array, noise_level)
    elif noise_type == 'mustard':
        img_array = apply_mustard_noise(img_array, noise_level)
    
    img_array = np.clip(img_array, 0, 255).astype(np.uint8)
    return Image.fromarray(img_array)

# スタブ: 未実装のエフェクトは入力をそのまま返します
def apply_moire_pattern(img_array, noise_level):
    return img_array

def apply_selective_blur(img_array, blur_factor):
    return img_array

def apply_camera_noise(img_array, noise_level):
    return img_array

def apply_film_grain(img_array, grain_amount):
    return img_array

def apply_adaptive_sharpening(img_array, sharpen_factor):
    return img_array

def apply_jpeg_artifacts(img_array, quality_reduction):
    return img_array

def apply_all_effects(img_array, watermark_path=None, strength=1.0):
    """
    画像に全ての効果を適用する関数
    
    Parameters:
    - img_array: 処理する画像（NumPy配列）
    - watermark_path: ウォーターマークの画像パス（省略可能）
    - strength: 効果の強さ (0.0〜1.0)
    
    Returns:
    - 処理後の画像（NumPy配列）
    """
    # 元の画像を保存
    processed_img = img_array.copy()
    
    # 1. AI識別子破壊フェーズ
    # モアレパターンノイズを適用
    processed_img = apply_moire_pattern(processed_img, noise_level=0.3 * strength)
    
    # 選択的ガウシアンブラーを適用
    processed_img = apply_selective_blur(processed_img, blur_factor=strength)
    
    # 2. テクスチャ追加フェーズ
    # マスタードノイズを適用
    processed_img = apply_mustard_noise(processed_img, noise_level=0.5 * strength)
    
    # カメラノイズを適用
    processed_img = apply_camera_noise(processed_img, noise_level=0.4 * strength)
    
    # フィルムグレインノイズを適用
    processed_img = apply_film_grain(processed_img, grain_amount=0.35 * strength)
    
    # 3. リアル感向上フェーズ
    # ランダムシャープネスを適用
    processed_img = apply_adaptive_sharpening(processed_img, sharpen_factor=0.5 * strength)
    
    # 4. アーティファクト追加フェーズ
    # JPEGアーティファクトを適用
    processed_img = apply_jpeg_artifacts(processed_img, quality_reduction=int(15 * strength))
    
    # ウォーターマークを追加（指定されている場合）
    if watermark_path:
        try:
            processed_img = apply_watermark(processed_img, watermark_path)
        except Exception as e:
            print(f"Error applying watermark: {e}")
    
    # 5. 最終仕上げフェーズ
    # 最終ガウシアンノイズを適用（Lv.2）
    processed_img = apply_final_gaussian_noise(processed_img, noise_level=0.15 * strength)
    
    return processed_img

def apply_final_gaussian_noise(img_array, noise_level=0.15):
    """
    最終仕上げとしてガウシアンノイズを適用する関数
    
    Parameters:
    - img_array: 処理する画像（NumPy配列）
    - noise_level: ノイズの強さ (0.0〜1.0)
    
    Returns:
    - 処理後の画像（NumPy配列）
    """
    if noise_level <= 0:
        return img_array
    
    # 画像のコピーを作成
    result = img_array.copy()
    
    # ガウシアンノイズのパラメータ
    mean = 0
    sigma = noise_level * 15  # ノイズレベルに応じた標準偏差
    
    # 画像と同じ形状のガウシアンノイズを生成
    noise = np.random.normal(mean, sigma, img_array.shape).astype(np.float64)
    
    # 画像にノイズを追加し、0-255の範囲に収める
    result = np.clip(result + noise, 0, 255).astype(np.uint8)
    
    return result

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