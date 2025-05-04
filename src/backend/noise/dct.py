import numpy as np
import random
from scipy.fft import dct, idct

def apply_dct_noise(img_array, noise_level):
    """
    DCT（離散コサイン変換）ノイズを適用する関数

    Parameters:
    - img_array: ノイズを適用する画像（NumPy配列）
    - noise_level: ノイズレベル（0.0〜1.0）

    Returns:
    - ノイズが適用された画像（NumPy配列）
    """
    amplify_factor = 1.0 + noise_level * 4.0  # 0.0→1.0, 1.0→5.0
    h, w, c = img_array.shape
    for i in range(c):
        # 2D DCT変換
        dct_coeffs = dct(dct(img_array[:, :, i].T, norm='ortho').T, norm='ortho')
        # 高周波成分を強調するマスク
        mask = np.ones_like(dct_coeffs)
        freq_threshold = int((1.0 - noise_level * 0.5) * min(h, w) / 3)
        if random.random() > 0.5:
            mask[freq_threshold:h-freq_threshold, freq_threshold:w-freq_threshold] = amplify_factor
        else:
            mask[freq_threshold:h-freq_threshold, freq_threshold:w-freq_threshold] = 1.0 / amplify_factor
        # マスク適用と逆DCT変換
        dct_coeffs = dct_coeffs * mask
        img_array[:, :, i] = idct(idct(dct_coeffs, norm='ortho').T, norm='ortho').T
    return img_array