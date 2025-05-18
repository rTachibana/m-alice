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

# ロギング設定
logging.basicConfig(level=logging.ERROR, format='%(asctime)s - %(message)s')

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

            # 2. 各ノイズの適用（DCT→ランダム→マスタード）
            if options and 'noiseLevel' in options and 'dct' in options.get('noiseTypes', []):
                noise_level = options.get('noiseLevel', 0.5)
                processed_img = apply_single_noise(
                    processed_img,
                    noise_type='dct',
                    noise_level=noise_level
                )
            random_noise_types = []
            if options and 'noiseLevel' in options:
                noise_types = options.get('noiseTypes', [])
                if 'gaussian' in noise_types:
                    random_noise_types.append('gaussian')
                if 'speckle' in noise_types:
                    random_noise_types.append('speckle')
                if 'shot' in noise_types:
                    random_noise_types.append('shot')
                if 'himalayan' in noise_types:
                    random_noise_types.append('himalayan')
                random.shuffle(random_noise_types)
                for noise_type in random_noise_types:
                    noise_level = options.get('noiseLevel', 0.5)
                    processed_img = apply_single_noise(
                        processed_img,
                        noise_type=noise_type,
                        noise_level=noise_level
                    )
            if options and 'noiseLevel' in options and 'mustard' in options.get('noiseTypes', []):
                noise_level = options.get('noiseLevel', 0.5)
                processed_img = apply_single_noise(
                    processed_img,
                    noise_type='mustard',
                    noise_level=noise_level
                )

            # 3. ウォーターマークの付与
            if options and options.get('applyWatermark'):
                watermarkPath = options.get('watermarkPath')
                watermarkOpacity = options.get('watermarkOpacity', 0.6)
                watermarkOpacityMin = options.get('watermarkOpacityMin', 0.05)
                invertWatermark = options.get('invertWatermark', False)
                enableOutline = options.get('enableOutline', True)
                watermarkSize = options.get('watermarkSize', 0.5)
                outlineColor = options.get('outlineColor', [255, 255, 255])
                watermarkOpacity = max(watermarkOpacityMin, watermarkOpacity)
                # ウォーターマークのパラメータを取得（キャメルケースに統一）
                watermarkPath = options.get('watermarkPath')
                watermarkOpacity = options.get('watermarkOpacity', 0.6)
                # フロントエンドのHTMLから取得した最小値を使用
                watermarkOpacityMin = options.get('watermarkOpacityMin', 0.05)
                invertWatermark = options.get('invertWatermark', False)
                enableOutline = options.get('enableOutline', True)
                watermarkSize = options.get('watermarkSize', 0.5)
                outlineColor = options.get('outlineColor', [255, 255, 255])  # デフォルト白色
                
                # HTMLから取得した最小値を適用
                watermarkOpacity = max(watermarkOpacityMin, watermarkOpacity)
                
                # 詳細なログ出力
                print(f"\n\n===== WATERMARK PROCESSING START =====")
                print(f"Options received from frontend: {options}")
                print(f"Watermark path: {watermarkPath}")
                print(f"All watermark params:")
                print(f"- path: {watermarkPath}")
                print(f"- opacity: {watermarkOpacity}")
                print(f"- invert: {invertWatermark}")
                print(f"- enableOutline: {enableOutline}")
                print(f"- size: {watermarkSize}")
                print(f"- outlineColor: {outlineColor}")
                
                # パラメータ型チェック
                print(f"Parameter types:")
                print(f"- path: {type(watermarkPath)}")
                print(f"- opacity: {type(watermarkOpacity)}")
                print(f"- invert: {type(invertWatermark)}")
                print(f"- enableOutline: {type(enableOutline)}")
                print(f"- size: {type(watermarkSize)}")
                print(f"- outlineColor: {type(outlineColor)}")
                
                # パスの正規化と絶対パス化
                if watermarkPath:                    # 相対パスを絶対パスに変換（必要な場合）
                    if not os.path.isabs(watermarkPath):
                        # 相対パスの場合、基準ディレクトリからの絶対パスに変換
                        base_dir = os.path.dirname(os.path.abspath(__file__))  # 現在のスクリプトの場所
                        watermarkPath = os.path.normpath(os.path.join(base_dir, '..', '..', watermarkPath))
                    else:
                        watermarkPath = os.path.normpath(watermarkPath)
                    
                    print(f"Normalized watermark path: {watermarkPath}")
                    print(f"File exists: {os.path.exists(watermarkPath) if watermarkPath else False}")
                    if os.path.exists(watermarkPath):
                        print(f"File is readable: {os.access(watermarkPath, os.R_OK)}")
                        print(f"File size: {os.path.getsize(watermarkPath)} bytes")
                    else:
                        # パス解決の試行（異なるベースディレクトリからの相対パスの可能性を試す）
                        possible_bases = [
                            os.path.join(base_dir, '..', '..', 'watermark'),
                            os.path.join(base_dir, '..', '..', 'src', 'watermark'),
                            os.path.join(base_dir, '..', '..', 'user_data', 'watermark')
                        ]
                        print(f"File not found, trying alternative paths")
                        
                        # 元のパスからファイル名部分を抽出
                        filename = os.path.basename(watermarkPath)
                        for base in possible_bases:
                            alt_path = os.path.join(base, filename)
                            if os.path.exists(alt_path):
                                print(f"Found alternative path: {alt_path}")
                                watermarkPath = alt_path
                                break
                        
                        print(f"After path resolution: {watermarkPath}")
                        print(f"File exists: {os.path.exists(watermarkPath)}")
                  # アウトラインの色の型チェック
                if outlineColor is None:
                    print("outlineColor is None, setting default")
                    outlineColor = [255, 255, 255]  # デフォルト白色
                elif not isinstance(outlineColor, list):
                    print(f"outlineColor is not a list, converting: {outlineColor}")
                    try:
                        # 文字列の場合は変換を試みる
                        if isinstance(outlineColor, str):
                            if ',' in outlineColor:
                                outlineColor = [int(c.strip()) for c in outlineColor.split(',')[:3]]
                            elif outlineColor.startswith('#'):
                                color = outlineColor.lstrip('#')
                                outlineColor = [int(color[i:i+2], 16) for i in (0, 2, 4)]
                        else:
                            # その他の型の場合は白色をデフォルトとする
                            outlineColor = [255, 255, 255]
                    except Exception as e:
                        print(f"Error converting outlineColor: {e}")
                        outlineColor = [255, 255, 255]  # エラー時のデフォルト
                  # 有効なウォーターマークパスがある場合のみ適用
                if watermarkPath and os.path.exists(watermarkPath):
                    print(f"Watermark file exists, proceeding to apply watermark")
                    try:
                        processed_img = apply_watermark(
                            processed_img,
                            watermarkPath,
                            opacity=watermarkOpacity,
                            invert=invertWatermark,
                            enableOutline=enableOutline,
                            sizeFactor=watermarkSize,
                            outlineColor=outlineColor
                        )
                        print(f"Watermark application completed")
                    except Exception as e:
                        print(f"ERROR: Exception during watermark application: {str(e)}")
                        import traceback
                        print(f"TRACE: {traceback.format_exc()}")
                else:
                    print(f"Watermark path invalid or file not found: {watermarkPath}")
                
                print(f"===== WATERMARK PROCESSING FINISHED =====\n")

            # 4. 仕上げノイズ処理（ガウシアン）
            final_noise_level = 0.2  # Lv.2相当の弱いノイズ
            processed_img = apply_single_noise(
                processed_img,
                noise_type='gaussian',
                noise_level=final_noise_level
            )

            # 5. ロゴの追加
            processed_img = apply_logo_if_needed(processed_img, options)

            # 6. メタデータ改竄処理（現在はオミット）
            # if options and (options.get('removeMetadata', True) or 
            #             options.get('addFakeMetadata', True) or 
            #             options.get('addNoAIFlag', True)):
            #     
            #     metadata_options = {
            #         'removeMetadata': options.get('removeMetadata', True),
            #         'addFakeMetadata': options.get('addFakeMetadata', True),
            #         'fakeMetadataType': options.get('fakeMetadataType', 'random'),
            #         'addNoAIFlag': options.get('addNoAIFlag', True),
            #     }
            #     
            #     process_metadata(output_path, output_path, metadata_options)

            # 出力形式の設定を処理
            output_format = options.get('outputFormat', 'png') if options else 'png'
            output_ext = os.path.splitext(output_path)[1].lower()
            if output_format == 'webp' and output_ext != '.webp':
                output_path = os.path.splitext(output_path)[0] + '.webp'
            elif output_format == 'png' and output_ext != '.png':
                output_path = os.path.splitext(output_path)[0] + '.png'
            if output_format == 'webp':
                processed_img.save(output_path, format='WEBP', lossless=True, quality=100)
            else:
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

def apply_all_effects(img_array, watermarkPath=None, strength=1.0):
    """
    画像に全ての効果を適用する関数
    
    Parameters:
    - img_array: 処理する画像（NumPy配列）
    - watermarkPath: ウォーターマークの画像パス（省略可能）
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
    if watermarkPath:
        try:
            processed_img = apply_watermark(processed_img, watermarkPath)
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