from PIL import Image, ImageDraw
import numpy as np
from sklearn.cluster import KMeans

def get_main_color_under_mask(base_image, mask_image, border_width=2):
    """
    ウォーターマーク境界の色と元画像を比較し、近似色を抽出する
    """
    # 画像をRGBAに統一
    base = base_image.convert("RGBA")
    mask = mask_image.convert("L")  # アルファマスク

    # 境界抽出（エッジ検出などでも可）
    mask_array = np.array(mask)
    border = (mask_array > 0) & (mask_array < 255)  # 中間部分 ≒ エッジ領域

    # エッジの位置と元画像からピクセル抽出
    base_array = np.array(base)
    edge_pixels = base_array[border]

    if len(edge_pixels) == 0:
        return (128, 128, 128)  # フォールバック

    # k-meansで代表色を抽出（ここでは1色）
    kmeans = KMeans(n_clusters=1)
    kmeans.fit(edge_pixels[:, :3])
    return tuple(map(int, kmeans.cluster_centers_[0]))

def draw_outline(wm_image, outline_color, border_width=2):
    """
    ウォーターマーク画像に近似色アウトラインを描く
    """
    img = wm_image.convert("RGBA")
    alpha = img.split()[-1]

    # マスクを膨張して外周に線を引く
    mask = np.array(alpha)
    expanded_mask = np.pad(mask, pad_width=border_width, mode='constant')
    
    # ImageDrawで線を描画（仮に全体に描く例）
    draw = ImageDraw.Draw(img)
    for y in range(mask.shape[0]):
        for x in range(mask.shape[1]):
            if 0 < mask[y, x] < 255:
                draw.ellipse([(x-border_width, y-border_width), (x+border_width, y+border_width)],
                             outline=outline_color + (255,), width=1)
    
    return img
