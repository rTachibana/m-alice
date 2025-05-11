import os
import random
from PIL import Image, ImageDraw, ImageOps, ImageFilter
import numpy as np
from scipy.ndimage import binary_dilation, binary_erosion
import logging
import traceback
import sys

# Configure logging for debugging - fix duplicate timestamp and set level to INFO for better visibility
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# デバッグログを強制的に標準出力に出す
def debug_log(message):
    print(f"DEBUG_WM: {message}")
    sys.stdout.flush()  # 即座に出力を反映
    logging.info(message)

def add_simple_outline(watermark, outlineColor, borderWidth=5, opacity=0.8, overlapFactor=0.2):
    """
    ウォーターマークにシンプルな単色アウトラインを追加する
    
    Parameters:
    - watermark: ウォーターマーク画像（PIL.Image）
    - outlineColor: アウトライン色（RGBタプル）
    - borderWidth: アウトラインの幅
    - opacity: アウトラインの不透明度
    - overlapFactor: ウォーターマークとアウトラインの重なり係数
    
    Returns:
    - アウトラインが追加されたウォーターマーク画像（PIL.Image）
    """
    debug_log(f"----- OUTLINE PROCESSING START -----")
    debug_log(f"add_simple_outline called with outlineColor: {outlineColor}, borderWidth: {borderWidth}")
    try:
        # アルファチャンネルを取得
        if watermark.mode != 'RGBA':
            watermark = watermark.convert('RGBA')
            debug_log(f"Converted watermark to RGBA mode in add_simple_outline")
        
        alpha = watermark.split()[-1]
        alpha_array = np.array(alpha)
        debug_log(f"Got alpha channel with shape {alpha_array.shape}")
          # アウトライン画像を作成
        outline_image = Image.new("RGBA", watermark.size, (0, 0, 0, 0))
        
        # ウォーターマークのマスク縮小量（重なり用）
        shrink_amount = int(borderWidth * overlapFactor)
        debug_log(f"Using shrink amount: {shrink_amount}")
        
        # ウォーターマークのマスクを少し縮小して重なりを作る
        if shrink_amount > 0:
            watermark_mask = binary_erosion(alpha_array > 0, iterations=shrink_amount)
            debug_log(f"Eroded watermark mask")
        else:
            watermark_mask = alpha_array > 0
            debug_log(f"Using original watermark mask")
        
        # 拡張マスクを作成（アウトラインの形状）
        dilated_mask = binary_dilation(alpha_array > 0, iterations=borderWidth)
        outline_mask = dilated_mask & ~(watermark_mask)
        debug_log(f"Created outline mask with shape {outline_mask.shape}, non-zero pixels: {np.sum(outline_mask)}")
        
        # アウトラインをRGBA画像に変換
        outline_data = np.zeros((watermark.size[1], watermark.size[0], 4), dtype=np.uint8)
        
        # 色とアルファ値を設定
        r, g, b = outlineColor
        debug_log(f"Setting outline color to RGB: {r}, {g}, {b}")
        outline_data[outline_mask] = [r, g, b, 255]
        
        # NumPy配列からPIL画像に変換
        outline_pil = Image.fromarray(outline_data, 'RGBA')
        
        # アウトラインの不透明度を設定
        if opacity < 1.0:
            debug_log(f"Setting outline opacity to {opacity}")
            outline_alpha = outline_pil.split()[-1]
            outline_alpha = outline_alpha.point(lambda p: int(p * opacity))
            outline_pil.putalpha(outline_alpha)
            
        # 元のウォーターマークとアウトラインを合成
        result = Image.alpha_composite(outline_pil, watermark)
        debug_log(f"Combined outline with watermark")
        debug_log(f"----- OUTLINE PROCESSING FINISHED -----")
    
        return result
    
    except Exception as e:
        debug_log(f"ERROR: Error adding outline: {str(e)}")
        debug_log(f"TRACE: {traceback.format_exc()}")
        return watermark  # エラー時は元のウォーターマークを返す

def apply_watermark(baseImage, watermarkPath, opacity=0.6, invert=False, enableOutline=True, sizeFactor=0.5, outlineColor=None):
    """
    画像にウォーターマークを適用する関数
    
    Parameters:
    - baseImage: ベース画像（PIL.Image）
    - watermarkPath: ウォーターマーク画像のパス
    - opacity: ウォーターマークの不透明度（0.0〜1.0）
    - invert: ウォーターマークを反転するかどうか
    - enableOutline: アウトラインを有効にするかどうか
    - sizeFactor: ウォーターマークのサイズ係数（0.0〜1.0）
    - outlineColor: アウトラインの色（RGBリスト）
    
    Returns:
    - ウォーターマークが適用された画像（PIL.Image）
    """
    debug_log(f"===== WATERMARK PROCESSING START =====")
    debug_log(f"apply_watermark called with following parameters:")
    debug_log(f"- watermarkPath: {watermarkPath}")
    debug_log(f"- opacity: {opacity}")
    debug_log(f"- invert: {invert}")
    debug_log(f"- enableOutline: {enableOutline}")
    debug_log(f"- sizeFactor: {sizeFactor}")
    debug_log(f"- outlineColor: {outlineColor} (type: {type(outlineColor)})")
    debug_log(f"- baseImage: {baseImage.size if baseImage else 'None'}")
    
    # watermarkPathのバリデーション
    if watermarkPath is None or not isinstance(watermarkPath, str) or len(watermarkPath.strip()) == 0:
        debug_log(f"ERROR: Invalid watermark path: {watermarkPath}")
        return baseImage

    # パスの正規化
    watermarkPath = os.path.normpath(watermarkPath)
    debug_log(f"Normalized path: {watermarkPath}")
    
    # ファイルの存在確認
    if not os.path.exists(watermarkPath):
        debug_log(f"ERROR: Watermark file not found: {watermarkPath}")
        return baseImage
        
    # ファイルの読み取り権限確認
    if not os.access(watermarkPath, os.R_OK):
        debug_log(f"ERROR: Watermark file is not readable: {watermarkPath}")
        return baseImage      # ファイルサイズ確認
    try:
        file_size = os.path.getsize(watermarkPath)
        if file_size == 0:
            debug_log(f"ERROR: Watermark file is empty (0 bytes): {watermarkPath}")
            return baseImage
        debug_log(f"File size: {file_size} bytes")
    except Exception as e:
        debug_log(f"ERROR: Failed to get file size: {str(e)}")
        return baseImage
    
    try:
        debug_log(f"Opening watermark file: {watermarkPath}")
        
        try:
            watermark = Image.open(watermarkPath)
            debug_log(f"Watermark loaded with size: {watermark.size}, mode: {watermark.mode}")
        except Exception as img_error:
            debug_log(f"ERROR: Failed to open watermark image: {str(img_error)}")
            debug_log(f"TRACE: {traceback.format_exc()}")
            return baseImage
            
        if watermark.mode != 'RGBA':
            watermark = watermark.convert('RGBA')
            debug_log(f"Converted watermark to RGBA mode")

        if invert:
            debug_log(f"Inverting watermark colors")
            r, g, b, a = watermark.split()
            rgb_image = Image.merge('RGB', (r, g, b))
            inverted_rgb = ImageOps.invert(rgb_image)
            r, g, b = inverted_rgb.split()
            watermark = Image.merge('RGBA', (r, g, b, a))
            debug_log(f"Watermark colors inverted")        # ウォーターマークの透明度を適用
        if 0.0 <= opacity <= 1.0:
            debug_log(f"Applying opacity {opacity} to watermark")
            # フロントエンドから送られた不透明度はそのまま使用する
            # ユーザーが指定した値を絶対に正しいものとして尊重する
            alpha = watermark.split()[-1]
            alpha = alpha.point(lambda p: int(p * opacity))
            watermark.putalpha(alpha)
            debug_log(f"Opacity applied to watermark exactly as specified: {opacity}")

        base_width, base_height = baseImage.size
        short_edge = min(base_width, base_height)
        
        # ウォーターマークのアスペクト比を維持してリサイズ
        wm_width, wm_height = watermark.size
        aspect_ratio = wm_width / wm_height        # sizeFactorは0.1から1.0の範囲で制限
        sizeFactor = max(0.1, min(1.0, sizeFactor))
        debug_log(f"Using size factor: {sizeFactor}, base image size: {base_width}x{base_height}, short edge: {short_edge}")
        
        if base_width / base_height > aspect_ratio:
            new_wm_height = int(short_edge * sizeFactor)
            new_wm_width = int(new_wm_height * aspect_ratio)
        else:
            new_wm_width = int(short_edge * sizeFactor)
            new_wm_height = int(new_wm_width / aspect_ratio)

        watermark = watermark.resize((new_wm_width, new_wm_height), Image.LANCZOS)
        debug_log(f"Resized watermark to: {new_wm_width}x{new_wm_height}")
        
        # アウトラインの追加
        if enableOutline and outlineColor is not None:
            try:
                debug_log(f"Processing outline with color: {outlineColor}, type: {type(outlineColor)}")
                
                # outlineColorの型チェックと変換
                if isinstance(outlineColor, list) and len(outlineColor) >= 3:
                    # リストからタプルに変換
                    outline_color_tuple = tuple(int(c) for c in outlineColor[:3])
                elif isinstance(outlineColor, str):
                    # 文字列からタプルに変換（カンマ区切りやRGB文字列など）
                    try:
                        # カンマ区切り文字列を処理
                        if ',' in outlineColor:
                            outline_color_tuple = tuple(int(c.strip()) for c in outlineColor.split(',')[:3])
                        # 16進数表記を処理
                        elif outlineColor.startswith('#'):
                            color = outlineColor.lstrip('#')
                            outline_color_tuple = tuple(int(color[i:i+2], 16) for i in (0, 2, 4))
                        else:
                            # デフォルト値を設定
                            debug_log(f"ERROR: Invalid color format: {outlineColor}, using default (255,255,255)")
                            outline_color_tuple = (255, 255, 255)
                    except Exception as color_error:
                        debug_log(f"ERROR: Failed to parse color string: {str(color_error)}")
                        outline_color_tuple = (255, 255, 255)
                else:
                    # デフォルト値を設定
                    debug_log(f"ERROR: Invalid outline color format, using default: {outlineColor}")
                    outline_color_tuple = (255, 255, 255)
                    debug_log(f"Converted outline color to tuple: {outline_color_tuple}")
                
                # 画像サイズに合わせたborder_widthを設定
                if short_edge <= 512:
                    border_width = 5   # 小さい画像
                elif short_edge <= 1024:
                    border_width = 10  # 中くらいの画像
                else:
                    border_width = 15  # 大きい画像
                    
                debug_log(f"Using border width: {border_width}px for image with short edge {short_edge}px")
                # アウトラインにもフロントエンドで指定された透明度をそのまま適用
                # ユーザーが指定した値を絶対に正しいものとして尊重する
                watermark = add_simple_outline(
                    watermark,
                    outline_color_tuple,
                    borderWidth=border_width,
                    opacity=opacity,
                    overlapFactor=0.2
                )
                
                debug_log(f"Added outline to watermark with color {outline_color_tuple}")
            except Exception as outline_error:
                debug_log(f"ERROR: Error applying outline: {str(outline_error)}")
                debug_log(f"TRACE: {traceback.format_exc()}")
        else:
            debug_log(f"Skipping outline: enableOutline={enableOutline}, outlineColor={outlineColor}")

        # 全体的なぼかし処理を追加して自然に見せる（軽度）
        watermark = watermark.filter(ImageFilter.GaussianBlur(radius=0.5))
        debug_log(f"Applied slight blur to watermark edges")
        # ウォーターマークを中央に配置
        paste_x = (base_width - new_wm_width) // 2
        paste_y = (base_height - new_wm_height) // 2
        
        # ウォーターマーク画像をベース画像に合成
        debug_log(f"Pasting watermark at position: ({paste_x}, {paste_y})")
        composite_with_watermark = Image.new('RGBA', (base_width, base_height), (0, 0, 0, 0))
        composite_with_watermark.paste(watermark, (paste_x, paste_y), watermark.split()[-1])

        # 元画像をRGBAモードに変換して保持
        base_image_rgba = baseImage.convert('RGBA')
        debug_log(f"Base image converted to RGBA mode")

        # ウォーターマーク画像をベース画像に合成
        final_composite = Image.alpha_composite(base_image_rgba, composite_with_watermark)
        debug_log(f"Final composite with watermark completed")
        debug_log(f"===== WATERMARK PROCESSING FINISHED =====")

        return final_composite

    except Exception as e:
        debug_log(f"ERROR: Watermark application error: {str(e)}")
        debug_log(f"TRACE: {traceback.format_exc()}")
        return baseImage