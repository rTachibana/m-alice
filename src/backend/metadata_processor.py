import json
import datetime
import piexif
from PIL import Image

def process_metadata(image_path, output_path, metadata_options):
    """
    画像のメタデータを処理する関数

    Parameters:
    - image_path: 入力画像のパス
    - output_path: 出力画像のパス
    - metadata_options: メタデータ処理オプション
    """
    try:
        img = Image.open(image_path)
        format = img.format
        # メタデータ削除または保持
        if metadata_options.get('removeMetadata', True):
            exif_dict = {"0th":{}, "Exif":{}, "GPS":{}, "1st":{}, "thumbnail":None}
        else:
            try:
                exif_bytes = img.info.get('exif', b'')
                exif_dict = piexif.load(exif_bytes) if exif_bytes else {"0th":{}, "Exif":{}, "GPS":{}, "1st":{}, "thumbnail":None}
            except:
                exif_dict = {"0th":{}, "Exif":{}, "GPS":{}, "1st":{}, "thumbnail":None}
        # フェイクメタデータ
        if metadata_options.get('addFakeMetadata', True):
            fake_type = metadata_options.get('fakeMetadataType', 'random')
            if fake_type == 'random':
                fake_type = __import__('random').choice(['paint', 'old_camera', 'screenshot'])
            if fake_type == 'paint':
                exif_dict["0th"][piexif.ImageIFD.Software] = "Adobe Photoshop".encode('utf-8')
                exif_dict["0th"][piexif.ImageIFD.Make] = "Adobe Systems".encode('utf-8')
                exif_dict["Exif"][piexif.ExifIFD.UserComment] = "Created with Adobe Photoshop".encode('utf-8')
            elif fake_type == 'old_camera':
                exif_dict["0th"][piexif.ImageIFD.Make] = "NIKON".encode('utf-8')
                exif_dict["0th"][piexif.ImageIFD.Model] = "COOLPIX P900".encode('utf-8')
                exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = datetime.datetime(
                    __import__('random').randint(2010, 2023),
                    __import__('random').randint(1, 12),
                    __import__('random').randint(1, 28)
                ).strftime("%Y:%m:%d %H:%M:%S").encode('utf-8')
            elif fake_type == 'screenshot':
                exif_dict["0th"][piexif.ImageIFD.Software] = "Windows Snipping Tool".encode('utf-8')
                exif_dict["0th"][piexif.ImageIFD.Make] = "Microsoft Windows".encode('utf-8')
                exif_dict["Exif"][piexif.ExifIFD.UserComment] = "Screenshot".encode('utf-8')
        # AI学習禁止フラグ
        if metadata_options.get('addNoAIFlag', True):
            exif_dict = add_special_no_ai_markers(exif_dict)
        exif_bytes = piexif.dump(exif_dict)
        # 保存
        if format == 'JPEG':
            img.save(output_path, format='JPEG', exif=exif_bytes, quality=95)
        elif format in ('PNG', 'WEBP'):
            img.save(output_path, format=format, exif=exif_bytes, quality=95)
        else:
            img.convert('RGB').save(output_path, format='JPEG', exif=exif_bytes, quality=95)
        return True
    except Exception:
        return False

def add_special_no_ai_markers(exif_dict):
    """
    AIによる使用を禁止する特殊マーカーを追加
    """
    noai_json = json.dumps({
        "usage_restriction": "no_ai_training",
        "license": "no_ai",
        "creator_intent": "exclude_from_ai_datasets"
    })
    exif_dict["Exif"][piexif.ExifIFD.UserComment] = noai_json.encode('utf-8')
    copyright_text = "© No AI usage permitted. Not for AI training or generation."
    exif_dict["0th"][piexif.ImageIFD.Copyright] = copyright_text.encode('utf-8')
    exif_dict["0th"][piexif.ImageIFD.Software] = "NoAI-Protected".encode('utf-8')
    exif_dict["0th"][piexif.ImageIFD.DocumentName] = "Protected from AI training".encode('utf-8')
    exif_dict["0th"][piexif.ImageIFD.Artist] = "Protected by m-alice".encode('utf-8')
    return exif_dict
