import numpy as np

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