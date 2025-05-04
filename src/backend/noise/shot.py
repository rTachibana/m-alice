import numpy as np

def apply_shot_noise(img_array, noise_level):
    """
    ショットノイズ（塩胡椒ノイズ）を適用する関数

    Parameters:
    - img_array: ノイズを適用する画像（NumPy配列）
    - noise_level: ノイズレベル（0.0〜1.0）

    Returns:
    - ノイズが適用された画像（NumPy配列）
    """
    density = 0.0001 + noise_level * 0.0014  # 0.0→0.01%, 1.0→0.15%
    salt_mask = np.random.random(img_array.shape[:2]) < density / 2
    pepper_mask = np.random.random(img_array.shape[:2]) < density / 2
    noisy_img = img_array.copy()
    # 塩と胡椒のノイズを適用
    for i in range(img_array.shape[2]):
        noisy_img[:, :, i][salt_mask] = 255
        noisy_img[:, :, i][pepper_mask] = 0
    return noisy_img