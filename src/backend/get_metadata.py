#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import os
import json
import piexif
from PIL import Image

def get_metadata(image_path):
    """
    画像のメタデータを抽出する関数
    
    Parameters:
    - image_path: 画像ファイルのパス
    
    Returns:
    - メタデータを含む辞書オブジェクト
    """
    try:
        # 画像ファイルが存在するか確認
        if not os.path.exists(image_path):
            return {"error": "ファイルが存在しません"}
        
        # 画像ファイルを開く
        img = Image.open(image_path)
        format_info = {
            "Format": img.format,
            "Mode": img.mode,
            "Size": f"{img.width} x {img.height} px"
        }
        
        # EXIF情報を取得
        exif_data = {}
        gps_data = {}  # gps_data変数をtry/exceptブロック外で初期化
        
        if 'exif' in img.info:
            try:
                exif_dict = piexif.load(img.info['exif'])
                
                # 0thのタグ（主な画像情報）
                if exif_dict["0th"]:
                    for tag_id, value in exif_dict["0th"].items():
                        tag_name = piexif.TAGS["0th"].get(tag_id, {}).get("name", f"Unknown-{tag_id}")
                        if isinstance(value, bytes):
                            try:
                                value = value.decode('utf-8', errors='replace')
                            except:
                                value = f"Binary data ({len(value)} bytes)"
                        exif_data[tag_name] = str(value)  # すべての値を文字列に変換
                
                # Exifのタグ（撮影情報など）
                if exif_dict["Exif"]:
                    for tag_id, value in exif_dict["Exif"].items():
                        tag_name = piexif.TAGS["Exif"].get(tag_id, {}).get("name", f"Unknown-{tag_id}")
                        if isinstance(value, bytes):
                            try:
                                value = value.decode('utf-8', errors='replace')
                            except:
                                value = f"Binary data ({len(value)} bytes)"
                        exif_data[tag_name] = str(value)  # すべての値を文字列に変換
                
                # GPSのタグ
                if exif_dict["GPS"]:
                    for tag_id, value in exif_dict["GPS"].items():
                        tag_name = piexif.TAGS["GPS"].get(tag_id, {}).get("name", f"Unknown-{tag_id}")
                        if isinstance(value, bytes):
                            try:
                                value = value.decode('utf-8', errors='replace')
                            except:
                                value = f"Binary data ({len(value)} bytes)"
                        gps_data[tag_name] = str(value)  # すべての値を文字列に変換
            except Exception as e:
                exif_data["Error"] = f"EXIF解析エラー: {str(e)}"
        
        # 結果をまとめる
        result = {
            "基本情報": format_info
        }
        
        if exif_data:
            result["EXIF情報"] = exif_data
        
        if gps_data:  # gps_dataが空でなければ追加
            result["GPS情報"] = gps_data
        
        # AI禁止マーカーがあるか確認
        ai_markers = find_ai_prohibition_markers(exif_data)
        if ai_markers:
            result["AI学習禁止マーカー"] = ai_markers
        
        return result
        
    except Exception as e:
        return {"エラー": f"メタデータ抽出エラー: {str(e)}"}

def find_ai_prohibition_markers(exif_data):
    """AIトレーニング禁止マーカーを検出する"""
    markers = {}
    
    # 特定のキーワードを探す
    ai_keywords = ["no ai", "no-ai", "noai", "ai prohibited", "not for ai",
                   "no ai training", "ai learning prohibited", "protected from ai"]
    
    # Copyright, Artist, UserComment, Softwareなどの一般的なフィールドを確認
    fields_to_check = [
        "Copyright", "Artist", "UserComment", "Software", 
        "DocumentName", "ImageDescription"
    ]
    
    for field in fields_to_check:
        if field in exif_data:
            value = str(exif_data[field]).lower()
            for keyword in ai_keywords:
                if keyword in value:
                    markers[field] = exif_data[field]
                    break
    
    # JSONフォーマットでAI禁止情報がないか確認 (UserCommentによくある)
    if "UserComment" in exif_data:
        try:
            comment = str(exif_data["UserComment"])
            if "{" in comment and "}" in comment:
                # JSONとして解析できるように© -> (c) に置換
                comment = comment.replace("©", "(c)")
                json_data = json.loads(comment)
                if any(key in json_data for key in ["usage_restriction", "license", "creator_intent"]):
                    # JSON形式の値をそのまま保持するように変更
                    for key, value in json_data.items():
                        markers[f"{key}"] = value
            
                    # 元のJSON文字列も保持（表示用）
                    markers["JSON形式"] = comment
        except Exception as e:
            markers["Error"] = f"JSON解析エラー: {str(e)}"
    
    return markers

if __name__ == "__main__":
    # コマンドライン引数の解析
    if len(sys.argv) < 2:
        print(json.dumps({"error": "引数が不足しています"}))
        sys.exit(1)

    image_path = sys.argv[1]
    metadata = get_metadata(image_path)
    
    # 結果をJSON形式で出力（CP932コードページでの問題を回避するため、ASCIIエスケープを使用）
    print(json.dumps(metadata, ensure_ascii=True, indent=2))