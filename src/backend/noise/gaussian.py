import numpy as np

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