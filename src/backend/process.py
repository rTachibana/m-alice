import sys
import os
import random
from PIL import Image, ImageDraw, ImageOps, ImageEnhance
import numpy as np
from scipy.fft import dct, idct
import piexif
import json
import datetime

def process_image(input_path, output_path, options=None):
    """
    画像処理のメイン関数
    options: 処理オプションを含む辞書
    """
    try:
        # 画像を開く
        with Image.open(input_path) as img:
            processed_img = img.copy()
            
            # 1. リサイズ処理（オプションがある場合）を最初に適用
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
            
            # 3. スペックルノイズを適用
            if options and 'noise_level' in options and 'speckle' in options.get('noise_types', []):
                noise_level = options.get('noise_level', 0.5)
                processed_img = apply_single_noise(
                    processed_img,
                    noise_type='speckle',
                    noise_level=noise_level
                )
            
            # 4. ウォーターマーク処理（有効な場合）
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
            
            # マリス・ロゴを指定された位置またはランダムに配置
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
            
            # 5. ガウシアンノイズを適用
            if options and 'noise_level' in options and 'gaussian' in options.get('noise_types', []):
                noise_level = options.get('noise_level', 0.5)
                processed_img = apply_single_noise(
                    processed_img,
                    noise_type='gaussian',
                    noise_level=noise_level
                )
            
            # 6. ショットノイズを最後に適用
            if options and 'noise_level' in options and 'shot' in options.get('noise_types', []):
                noise_level = options.get('noise_level', 0.5)
                processed_img = apply_single_noise(
                    processed_img,
                    noise_type='shot',
                    noise_level=noise_level
                )
            
            # 保存
            processed_img.save(output_path)
            
            # 7. メタデータ処理を実行
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
    - noise_types: 適用するノイズの種類のリスト（例：['gaussian', 'dct', 'shot', 'speckle']）
    
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
    
    # スペックルノイズ
    if 'speckle' in noise_types:
        img_array = apply_speckle_noise(img_array, noise_level)
    
    # NumPy配列をPIL画像に戻す
    img_array = np.clip(img_array, 0, 255).astype(np.uint8)
    return Image.fromarray(img_array)

def apply_single_noise(image, noise_type, noise_level=0.5):
    """
    画像に単一のノイズを適用する関数
    
    Parameters:
    - image: ノイズを適用する画像（PIL.Image）
    - noise_type: 適用するノイズの種類（'gaussian', 'dct', 'shot', 'speckle'）
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
    elif noise_type == 'speckle':
        img_array = apply_speckle_noise(img_array, noise_level)
    
    img_array = np.clip(img_array, 0, 255).astype(np.uint8)
    return Image.fromarray(img_array)

def apply_gaussian_noise(img_array, noise_level):
    """
    ガウシアンノイズを適用する関数
    
    Parameters:
    - img_array: ノイズを適用する画像（NumPy配列）
    - noise_level: ノイズレベル（0.0〜1.0）
    
    Returns:
    - ノイズが適用された画像（NumPy配列）
    """
    # ノイズレベルを2-11の範囲にマッピング
    std_dev = 2.0 + noise_level * 9.0  # 0.0→2.0, 1.0→11.0
    
    # ガウシアンノイズを生成
    noise = np.random.normal(0, std_dev, img_array.shape)
    
    # 画像にノイズを追加
    noisy_img = img_array + noise
    
    return noisy_img

def apply_dct_noise(img_array, noise_level):
    """
    DCT（離散コサイン変換）ノイズを適用する関数
    
    Parameters:
    - img_array: ノイズを適用する画像（NumPy配列）
    - noise_level: ノイズレベル（0.0〜1.0）
    
    Returns:
    - ノイズが適用された画像（NumPy配列）
    """
    # DCT係数の増幅量を±1～±5の範囲にマッピング
    amplify_factor = 1.0 + noise_level * 4.0  # 0.0→1.0, 1.0→5.0
    
    # 画像の各チャネルに対して処理
    h, w, c = img_array.shape
    for i in range(c):
        # 2D DCT変換
        dct_coeffs = dct(dct(img_array[:, :, i].T, norm='ortho').T, norm='ortho')
        
        # 高周波成分を強調するマスクを作成
        mask = np.ones_like(dct_coeffs)
        
        # 高周波領域を特定（画像サイズに応じて調整）
        freq_threshold = int((1.0 - noise_level * 0.5) * min(h, w) / 3)
        
        # 高周波領域を増幅または減衰
        if random.random() > 0.5:  # 50%の確率で増幅
            mask[freq_threshold:h-freq_threshold, freq_threshold:w-freq_threshold] = amplify_factor
        else:  # 50%の確率で減衰
            mask[freq_threshold:h-freq_threshold, freq_threshold:w-freq_threshold] = 1.0 / amplify_factor
        
        # DCT係数にマスクを適用
        dct_coeffs = dct_coeffs * mask
        
        # 逆DCT変換
        img_array[:, :, i] = idct(idct(dct_coeffs, norm='ortho').T, norm='ortho').T
    
    return img_array

def apply_shot_noise(img_array, noise_level):
    """
    ショットノイズ（塩コショウノイズ）を適用する関数
    
    Parameters:
    - img_array: ノイズを適用する画像（NumPy配列）
    - noise_level: ノイズレベル（0.0〜1.0）
    
    Returns:
    - ノイズが適用された画像（NumPy配列）
    """
    # ノイズの密度をさらに弱めて0.01%～0.15%の範囲にマッピング
    density = 0.0001 + noise_level * 0.0014  # 0.0→0.01%, 1.0→0.15%
    
    # 塩（白）と胡椒（黒）のマスクを生成
    salt_mask = np.random.random(img_array.shape[:2]) < density / 2
    pepper_mask = np.random.random(img_array.shape[:2]) < density / 2
    
    # 画像のコピーを作成
    noisy_img = img_array.copy()
    
    # 塩（白）とコショウ（黒）のノイズを適用
    for i in range(img_array.shape[2]):  # 各色チャネルに対して
        noisy_img[:, :, i][salt_mask] = 255
        noisy_img[:, :, i][pepper_mask] = 0
    
    return noisy_img

def apply_speckle_noise(img_array, noise_level):
    """
    スペックルノイズを適用する関数
    
    Parameters:
    - img_array: ノイズを適用する画像（NumPy配列）
    - noise_level: ノイズレベル（0.0〜1.0）
    
    Returns:
    - ノイズが適用された画像（NumPy配列）
    """
    # ノイズの強度を0.1%～1.5%の範囲にマッピング
    intensity = 0.001 + noise_level * 0.014  # 0.0→0.1%, 1.0→1.5%
    
    # ノイズを生成（平均1、分散に強度を反映）
    noise = np.random.normal(1, intensity, img_array.shape)
    
    # 乗法的ノイズ（画素値にノイズを乗算）
    noisy_img = img_array * noise
    
    return noisy_img

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
                print("Image too small to place logo")
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
                print(f"Selected position: {position_key}")
            elif position in positions:
                # 指定された位置を使用
                paste_position = positions[position]
                print(f"Using position: {position}")
            else:
                # 不明な位置の場合はランダム
                position_key = random.choice(list(positions.keys()))
                paste_position = positions[position_key]
                print(f"Unknown position, randomly selected: {position_key}")
            
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
        print(f"Logo application error: {e}")
        # エラーが発生した場合は元の画像を返す
        return base_image

def process_metadata(image_path, output_path, metadata_options):
    """
    画像のメタデータを処理する関数
    
    Parameters:
    - image_path: 入力画像のパス
    - output_path: 出力画像のパス
    - metadata_options: メタデータ処理オプション
    """
    try:
        # 画像を開く
        img = Image.open(image_path)
        format = img.format  # 元の画像フォーマットを保存
        
        # メタデータ削除オプションが有効な場合
        if metadata_options.get('remove_metadata', True):
            # すべてのメタデータを削除（空のデータで上書き）
            exif_dict = {"0th":{}, "Exif":{}, "GPS":{}, "1st":{}, "thumbnail":None}
        else:
            # 既存のメタデータを保持（存在する場合）
            try:
                exif_bytes = img.info.get('exif', b'')
                if exif_bytes:
                    exif_dict = piexif.load(exif_bytes)
                else:
                    exif_dict = {"0th":{}, "Exif":{}, "GPS":{}, "1st":{}, "thumbnail":None}
            except:
                # エラーが発生した場合は空のメタデータで初期化
                exif_dict = {"0th":{}, "Exif":{}, "GPS":{}, "1st":{}, "thumbnail":None}
        
        # フェイクメタデータ追加オプションが有効な場合
        if metadata_options.get('add_fake_metadata', True):
            fake_type = metadata_options.get('fake_metadata_type', 'random')
            
            # ランダム選択の場合
            if fake_type == 'random':
                fake_type = random.choice(['paint', 'old_camera', 'screenshot'])
                
            # 選択されたタイプに基づいてフェイクメタデータを生成
            if fake_type == 'paint':
                # ペイントソフトのメタデータ
                exif_dict["0th"][piexif.ImageIFD.Software] = "Adobe Photoshop".encode('utf-8')
                exif_dict["0th"][piexif.ImageIFD.Make] = "Adobe Systems".encode('utf-8')
                exif_dict["Exif"][piexif.ExifIFD.UserComment] = "Created with Adobe Photoshop".encode('utf-8')
                
            elif fake_type == 'old_camera':
                # 古いカメラのメタデータ
                exif_dict["0th"][piexif.ImageIFD.Make] = "NIKON".encode('utf-8')
                exif_dict["0th"][piexif.ImageIFD.Model] = "COOLPIX P900".encode('utf-8')
                exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = datetime.datetime(
                    random.randint(2010, 2023), 
                    random.randint(1, 12),
                    random.randint(1, 28)
                ).strftime("%Y:%m:%d %H:%M:%S").encode('utf-8')
                
            elif fake_type == 'screenshot':
                # スクリーンショットのメタデータ
                exif_dict["0th"][piexif.ImageIFD.Software] = "Windows Snipping Tool".encode('utf-8')
                exif_dict["0th"][piexif.ImageIFD.Make] = "Microsoft Windows".encode('utf-8')
                exif_dict["Exif"][piexif.ExifIFD.UserComment] = "Screenshot".encode('utf-8')
        
        # AI学習禁止フラグ追加オプションが有効な場合
        if metadata_options.get('add_no_ai_flag', True):
            # 複数の場所にAI学習禁止情報を埋め込む
            add_special_no_ai_markers(exif_dict)
        
        # 変更したEXIFデータをバイナリに変換
        exif_bytes = piexif.dump(exif_dict)
        
        # 出力画像の保存（メタデータ付き）
        # 注：PILの保存関数は一部のフォーマットでのみメタデータをサポート
        if format == 'JPEG':
            img.save(output_path, format='JPEG', exif=exif_bytes, quality=95)
        elif format == 'PNG':
            img.save(output_path, format='PNG', exif=exif_bytes)
        elif format == 'WEBP':
            img.save(output_path, format='WEBP', exif=exif_bytes, quality=95)
        else:
            # その他のフォーマットではJPEGに変換して保存
            img = img.convert('RGB')
            img.save(output_path, format='JPEG', exif=exif_bytes, quality=95)
        
        print(f"Metadata processing completed for {output_path}")
        return True
        
    except Exception as e:
        print(f"Metadata processing error: {e}")
        # エラーが発生した場合は元の画像をそのまま使用
        return False

def add_special_no_ai_markers(exif_dict):
    """AIによる使用を禁止する特殊マーカーを追加"""
    
    # 1. NoAI標準形式（提案形式）
    noai_json = json.dumps({
        "usage_restriction": "no_ai_training",
        "license": "no_ai",
        "creator_intent": "exclude_from_ai_datasets"
    })
    exif_dict["Exif"][piexif.ExifIFD.UserComment] = noai_json.encode('utf-8')
    
    # 2. 著作権情報とAI制限情報
    copyright_text = "© No AI usage permitted. Not for AI training or generation."
    exif_dict["0th"][piexif.ImageIFD.Copyright] = copyright_text.encode('utf-8')
    
    # 3. 複数のフィールドに分散して埋め込み（検出回避が困難に）
    exif_dict["0th"][piexif.ImageIFD.Software] = "NoAI-Protected".encode('utf-8')
    exif_dict["0th"][piexif.ImageIFD.DocumentName] = "Protected from AI training".encode('utf-8')
    
    # 4. アーティスト情報
    exif_dict["0th"][piexif.ImageIFD.Artist] = "Protected by m-alice".encode('utf-8')
    
    return exif_dict

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