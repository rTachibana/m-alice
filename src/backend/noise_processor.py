import numpy as np
from PIL import Image
from scipy.fft import dct, idct
import random

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

def apply_himalayan_shot_noise(img_array, noise_level):
    """
    ヒマラヤソルト＆ペッパーノイズを適用する関数
    通常のソルト＆ペッパーノイズにヒマラヤピンクソルトの色を追加
    
    Parameters:
    - img_array: ノイズを適用する画像（NumPy配列）
    - noise_level: ノイズレベル（0.0〜1.0）
    
    Returns:
    - ノイズが適用された画像（NumPy配列）
    """
    # ノイズの密度を0.01%～0.2%の範囲にマッピング（通常よりも少し高め）
    density = 0.0001 + noise_level * 0.0019  # 0.0→0.01%, 1.0→0.2%
    
    # 塩（白）、胡椒（黒）、ヒマラヤピンクソルト（ピンク）のマスクを生成
    salt_mask = np.random.random(img_array.shape[:2]) < density / 3
    pepper_mask = np.random.random(img_array.shape[:2]) < density / 3
    himalayan_mask = np.random.random(img_array.shape[:2]) < density / 3
    
    # 画像のコピーを作成
    noisy_img = img_array.copy()
    
    # 塩（白）とコショウ（黒）のノイズを適用
    for i in range(img_array.shape[2]):  # 各色チャネルに対して
        noisy_img[:, :, i][salt_mask] = 255
        noisy_img[:, :, i][pepper_mask] = 0
    
    # ヒマラヤピンクソルト（ピンク色）のノイズを適用
    # RGBピンク色の値（淡いピンク）
    noisy_img[:, :, 0][himalayan_mask] = 255  # R
    noisy_img[:, :, 1][himalayan_mask] = 180  # G
    noisy_img[:, :, 2][himalayan_mask] = 190  # B
    
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

def apply_mustard_noise(img_array, noise_level):
    """
    改良版マスタードノイズを適用する関数
    マスタード色と黒の複合ショットノイズ、サイズの異なる点、ランダムな長さと位置の直線を組み合わせ
    
    Parameters:
    - img_array: ノイズを適用する画像（NumPy配列）
    - noise_level: ノイズレベル（0.0〜1.0）
    
    Returns:
    - ノイズが適用された画像（NumPy配列）
    """
    # 画像のコピーを作成
    noisy_img = img_array.copy()
    
    # 画像のサイズを取得
    h, w, c = noisy_img.shape
    
    # 1. マスタード色のスポットノイズ (小さいサイズ)
    spot_density_small = 0.0001 + noise_level * 0.0012  # 増加: 0.0→0.01%, 1.0→0.13%
    
    # 小さいマスタード色のスポットマスク
    mustard_mask_small = np.random.random(img_array.shape[:2]) < spot_density_small
    
    # 黒点のマスク (コントラスト向上のため)
    black_mask = np.random.random(img_array.shape[:2]) < spot_density_small * 0.4  # 比率増加
    
    # マスタード色と黒点を適用
    noisy_img[:, :, 0][mustard_mask_small] = 250  # R - 黄色がかった色（明るく）
    noisy_img[:, :, 1][mustard_mask_small] = 220  # G（明るく）
    noisy_img[:, :, 2][mustard_mask_small] = 60   # B - 青みを抑えた色（少し明るく）
    
    # 黒点を適用 (AI学習の妨害に効果的)
    for i in range(img_array.shape[2]):
        noisy_img[:, :, i][black_mask] = 20  # ほぼ黒だが完全な黒ではない
    
    # 2. 大きめのマスタード色スポット (局所的な特徴を破壊するため)
    # 大きなスポットの数 (ノイズレベルに応じて20〜80に増加)
    num_large_spots = int(20 + noise_level * 60)
    
    for _ in range(num_large_spots):
        # ランダムな位置
        x = np.random.randint(0, w)
        y = np.random.randint(0, h)
        
        # スポットの半径 (2〜9ピクセル - 拡大)
        radius = np.random.randint(2, max(3, int(9 * noise_level) + 1))
        
        # ランダムなマスタード色のバリエーション (より多様なバリエーション)
        mustard_r = 250 + np.random.randint(-40, 41)  # 210-290の範囲(255でクリップ)
        mustard_g = 220 + np.random.randint(-35, 36)  # 185-255の範囲
        mustard_b = 60 + np.random.randint(-25, 26)   # 35-85の範囲
        
        # 色の範囲を0-255に制限
        mustard_r = min(255, max(0, mustard_r))
        mustard_g = min(255, max(0, mustard_g))
        mustard_b = min(255, max(0, mustard_b))
        
        # 楕円形のスポットを描画（よりランダムな形状）
        stretch_x = np.random.uniform(0.8, 1.2)  # X方向の伸縮
        stretch_y = np.random.uniform(0.8, 1.2)  # Y方向の伸縮
        
        for dy in range(-int(radius * stretch_y), int(radius * stretch_y) + 1):
            for dx in range(-int(radius * stretch_x), int(radius * stretch_x) + 1):
                # 楕円の方程式
                if (dx**2 / stretch_x**2 + dy**2 / stretch_y**2) <= radius**2:
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w:
                        # マスタード色をランダムに少し変化させる
                        r_var = np.random.randint(-15, 16)  # バリエーション増加
                        g_var = np.random.randint(-15, 16)  # バリエーション増加
                        
                        # エッジをぼかすためのアルファブレンド率
                        distance = np.sqrt((dx/stretch_x)**2 + (dy/stretch_y)**2)
                        alpha = 1.0 - (distance / radius)**1.7  # エッジをよりソフトに
                        
                        # 色をブレンド (自然なグラデーション効果)
                        noisy_img[ny, nx, 0] = (1 - alpha) * noisy_img[ny, nx, 0] + alpha * min(255, max(0, mustard_r + r_var))
                        noisy_img[ny, nx, 1] = (1 - alpha) * noisy_img[ny, nx, 1] + alpha * min(255, max(0, mustard_g + g_var))
                        noisy_img[ny, nx, 2] = (1 - alpha) * noisy_img[ny, nx, 2] + alpha * min(255, max(0, mustard_b))
    
    # 3. マスタード色の直線パターン (ランダムな長さと位置)
    # 線の本数 (ノイズレベルに応じて10〜30本に増加)
    num_lines = int(10 + noise_level * 20)
    
    # 複数の角度グループを作成（1〜3グループ）
    num_angle_groups = max(1, int(1 + noise_level * 2))
    angle_groups = []
    
    for _ in range(num_angle_groups):
        # 各グループの主な傾き角度を決定
        main_angle = np.random.uniform(-0.3, 0.3)  # より広い角度範囲
        angle_groups.append(main_angle)
    
    # 線を描画
    for i in range(num_lines):
        # 使用する角度グループをランダムに選択
        group_idx = np.random.randint(0, len(angle_groups))
        main_angle = angle_groups[group_idx]
        
        # 線の開始位置
        start_x = np.random.randint(0, w)
        start_y = np.random.randint(0, h)
        
        # 線の長さ (ノイズレベルに応じて調整、より長く)
        line_length = int(min(h, w) * (0.15 + noise_level * 0.5))  # 画像短辺の15%〜65%
        
        # 線の角度 (主な傾きにランダムなバリエーションを加える)
        angle = main_angle + np.random.uniform(0.3, 0.8)
        
        # マスタード色のバリエーション
        line_r = 250 + np.random.randint(-25, 26)
        line_g = 220 + np.random.randint(-25, 26)
        line_b = 60 + np.random.randint(-15, 16)
        
        # 色の範囲を0-255に制限
        line_r = min(255, max(0, line_r))
        line_g = min(255, max(0, line_g))
        line_b = min(255, max(0, line_b))
        
        # 半透明の線を描画
        alpha = 0.6 + noise_level * 0.3  # 透明度 (0.6〜0.9)
        
        # 線を描画
        for t in range(line_length):
            # 線上の点を計算（sin/cosを使用して任意の角度の線を描画）
            dx = int(t * np.cos(angle))
            dy = int(t * np.sin(angle))
            x = start_x + dx
            y = start_y + dy
            
            # 画像の境界内かチェック
            if 0 <= x < w and 0 <= y < h:
                # 線の太さ (1〜4ピクセル、ノイズレベルに応じて太くなる)
                thickness = max(1, int(1 + noise_level * 3))
                
                # 太さ分の点を描画
                for offset in range(-thickness//2, thickness//2 + 1):
                    # 線の垂直方向にオフセット
                    nx = int(x - offset * np.sin(angle))
                    ny = int(y + offset * np.cos(angle))
                    
                    if 0 <= nx < w and 0 <= ny < h:
                        # エッジをぼかすためのグラデーション
                        edge_alpha = alpha * (1.0 - abs(offset) / (thickness//2 + 1))
                        
                        # 色をブレンド
                        noisy_img[ny, nx, 0] = (1 - edge_alpha) * noisy_img[ny, nx, 0] + edge_alpha * line_r
                        noisy_img[ny, nx, 1] = (1 - edge_alpha) * noisy_img[ny, nx, 1] + edge_alpha * line_g
                        noisy_img[ny, nx, 2] = (1 - edge_alpha) * noisy_img[ny, nx, 2] + edge_alpha * line_b
    
    # 4. マスタードブロックノイズ (新機能: 画像に小さな矩形ブロックのノイズを追加)
    if noise_level > 0.3:  # 中〜高ノイズレベルでのみ適用
        # ブロックの数 (ノイズレベルに比例)
        num_blocks = int(5 + (noise_level - 0.3) * 25)  # 0.3→5, 1.0→22
        
        for _ in range(num_blocks):
            # ブロックのサイズ (4〜12ピクセル)
            block_width = np.random.randint(4, max(5, int(12 * noise_level) + 1))
            block_height = np.random.randint(4, max(5, int(12 * noise_level) + 1))
            
            # ブロックの位置
            block_x = np.random.randint(0, w - block_width + 1)
            block_y = np.random.randint(0, h - block_height + 1)
            
            # マスタード色のバリエーション
            block_r = 250 + np.random.randint(-30, 31)
            block_g = 220 + np.random.randint(-30, 31)
            block_b = 60 + np.random.randint(-20, 21)
            
            # 色の範囲を0-255に制限
            block_r = min(255, max(0, block_r))
            block_g = min(255, max(0, block_g))
            block_b = min(255, max(0, block_b))
            
            # ブロックの透明度 (0.4〜0.7)
            block_alpha = 0.4 + np.random.random() * 0.3
            
            # ブロック内にテクスチャを生成（完全に均一にならないように）
            texture = np.random.normal(1.0, 0.1, (block_height, block_width))
            
            # ブロックを描画
            for y in range(block_height):
                for x in range(block_width):
                    # 境界ぼかし効果（エッジに近いほど透明に）
                    edge_x = min(x, block_width - 1 - x) / (block_width * 0.25)
                    edge_y = min(y, block_height - 1 - y) / (block_height * 0.25)
                    edge_factor = min(1.0, min(edge_x, edge_y))
                    
                    # 位置にテクスチャを適用
                    local_alpha = block_alpha * edge_factor * texture[y, x]
                    local_alpha = max(0.0, min(1.0, local_alpha))  # 0-1の範囲に収める
                    
                    # ピクセル座標
                    px, py = block_x + x, block_y + y
                    
                    # 境界チェック
                    if 0 <= px < w and 0 <= py < h:
                        # 色をブレンド
                        noisy_img[py, px, 0] = (1 - local_alpha) * noisy_img[py, px, 0] + local_alpha * block_r
                        noisy_img[py, px, 1] = (1 - local_alpha) * noisy_img[py, px, 1] + local_alpha * block_g
                        noisy_img[py, px, 2] = (1 - local_alpha) * noisy_img[py, px, 2] + local_alpha * block_b
    
    # 5. 微細テクスチャ（新機能: より細かいノイズパターン）
    if noise_level > 0.2:  # 低〜高ノイズレベルで適用
        # マスタード色の微細テクスチャのマスク密度
        texture_density = 0.001 + noise_level * 0.009  # 0.2→0.003, 1.0→0.01
        
        # テクスチャマスク
        texture_mask = np.random.random(img_array.shape[:2]) < texture_density
        
        # ランダムなマスタード色バリエーションを生成
        texture_variations = []
        for _ in range(5):  # 5種類のバリエーション
            variation = {
                'r': min(255, max(0, 250 + np.random.randint(-40, 41))),
                'g': min(255, max(0, 220 + np.random.randint(-40, 41))),
                'b': min(255, max(0, 60 + np.random.randint(-20, 21)))
            }
            texture_variations.append(variation)
        
        # テクスチャの各ピクセルに対して処理
        for y in range(h):
            for x in range(w):
                if texture_mask[y, x]:
                    # ランダムな色バリエーションを選択
                    variation = texture_variations[np.random.randint(0, len(texture_variations))]
                    
                    # 半透明でブレンド (20〜40%)
                    alpha = 0.2 + np.random.random() * 0.2
                    
                    # 色をブレンド
                    noisy_img[y, x, 0] = (1 - alpha) * noisy_img[y, x, 0] + alpha * variation['r']
                    noisy_img[y, x, 1] = (1 - alpha) * noisy_img[y, x, 1] + alpha * variation['g']
                    noisy_img[y, x, 2] = (1 - alpha) * noisy_img[y, x, 2] + alpha * variation['b']
    
    return noisy_img