import numpy as np

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
    density = 0.0001 + noise_level * 0.0019  # 0.0→0.01%, 1.0→0.2%
    salt_mask = np.random.random(img_array.shape[:2]) < density / 3
    pepper_mask = np.random.random(img_array.shape[:2]) < density / 3
    himalayan_mask = np.random.random(img_array.shape[:2]) < density / 3
    noisy_img = img_array.copy()
    for i in range(img_array.shape[2]):
        noisy_img[:, :, i][salt_mask] = 255
        noisy_img[:, :, i][pepper_mask] = 0
    noisy_img[:, :, 0][himalayan_mask] = 255
    noisy_img[:, :, 1][himalayan_mask] = 180
    noisy_img[:, :, 2][himalayan_mask] = 190
    return noisy_img