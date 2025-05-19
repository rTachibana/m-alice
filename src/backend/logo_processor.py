import os
import random
from PIL import Image

def apply_logo_if_needed(image, options=None):
    """
    必要に応じてロゴを画像に配置する関数
    """
    app_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
    # options から logoPath を取得し、存在すればそれを使う
    logo_path = None
    if options and 'logoPath' in options and options['logoPath']:
        candidate = options['logoPath']
        if os.path.isabs(candidate):
            if os.path.exists(candidate):
                logo_path = candidate
        else:
            abs_candidate = os.path.join(app_root, candidate)
            if os.path.exists(abs_candidate):
                logo_path = abs_candidate
    if not logo_path:
        logo_path = os.path.join(app_root, 'src', 'logo', 'logo.png')
    if os.path.exists(logo_path):
        logo_position = options.get('logoPosition') if options and 'logoPosition' in options else 'random'
        return apply_marice_logo(image, logo_path, position=logo_position)
    return image


def apply_marice_logo(base_image, logo_path, margin=24, position='random'):
    """
    ベース画像にロゴを指定位置またはランダムに配置する関数
    """
    try:
        with Image.open(logo_path) as logo:
            if logo.mode != 'RGBA':
                logo = logo.convert('RGBA')
            base_width, base_height = base_image.size
            short_edge = min(base_width, base_height)
            logo_max_size = int(short_edge * 0.2)
            logo_width, logo_height = logo.size
            aspect_ratio = logo_width / logo_height
            if logo_width > logo_height:
                new_width = logo_max_size
                new_height = int(logo_max_size / aspect_ratio)
            else:
                new_height = logo_max_size
                new_width = int(logo_max_size * aspect_ratio)
            logo = logo.resize((new_width, new_height), Image.LANCZOS)
            if base_width < new_width + margin * 2 or base_height < new_height + margin * 2:
                print("Image too small to place logo")
                return base_image
            positions = {
                'top-left': (margin, margin),
                'top-right': (base_width - new_width - margin, margin),
                'bottom-left': (margin, base_height - new_height - margin),
                'bottom-right': (base_width - new_width - margin, base_height - new_height - margin)
            }
            if position == 'random':
                position_key = random.choice(list(positions.keys()))
                paste_position = positions[position_key]
            elif position in positions:
                paste_position = positions[position]
            else:
                position_key = random.choice(list(positions.keys()))
                paste_position = positions[position_key]
            if base_image.mode != 'RGBA':
                base_with_alpha = base_image.convert('RGBA')
            else:
                base_with_alpha = base_image.copy()
            composite = Image.new('RGBA', base_image.size, (0, 0, 0, 0))
            composite.paste(logo, paste_position, logo)
            result = Image.alpha_composite(base_with_alpha, composite)
            if base_image.mode != 'RGBA':
                result = result.convert(base_image.mode)
            return result
    except Exception as e:
        print(f"Logo application error: {e}")
        return base_image