import sys
import os
from PIL import Image, ImageDraw

def process_image(input_path, output_path):
    try:
        # 画像を開く
        with Image.open(input_path) as img:
            # 仮の処理：そのまま保存
            img.save(output_path)
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR: {e}")

def apply_watermark(base_image_path, watermark_path, output_path, enable_watermark):
    try:
        print(f"Debug: base_image_path={base_image_path}, watermark_path={watermark_path}, output_path={output_path}, enable_watermark={enable_watermark}")

        # ウォーターマークが無効の場合はスキップ
        if not enable_watermark:
            with Image.open(base_image_path) as base_image:
                base_image.save(output_path)
            print("SUCCESS")
            return

        watermark_path = os.path.abspath(watermark_path)

        print("Debug: Applying watermark")

        # ベース画像とウォーターマーク画像を開く
        with Image.open(base_image_path) as base_image, Image.open(watermark_path) as watermark:
            # ウォーターマークをリサイズ（contain）
            watermark = watermark.resize((base_image.width, base_image.height), Image.LANCZOS)
            # ウォーターマークを中央に配置
            base_image.paste(watermark, (0, 0), watermark)
            # 保存
            base_image.save(output_path)
        print("SUCCESS")
    except FileNotFoundError as fnf_error:
        raise FileNotFoundError(f"File not found: {fnf_error}")
    except Exception as e:
        raise Exception(f"An error occurred: {e}")

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("ERROR: Invalid arguments")
        sys.exit(1)

    input_path = os.path.abspath(sys.argv[1])
    watermark_path = os.path.abspath(sys.argv[2])
    output_path = os.path.abspath(sys.argv[3])
    enable_watermark = sys.argv[4].lower() == 'true'

    apply_watermark(input_path, watermark_path, output_path, enable_watermark)