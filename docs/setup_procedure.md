# 必要なライブラリとセットアップ手順

このドキュメントでは、`m-Alice` ツールの動作に必要なライブラリとそのセットアップ手順について説明します。

## 必要なライブラリ
以下のPythonライブラリが必要です：

- **Pillow**: 画像処理ライブラリ
- **NumPy**: 数値計算ライブラリ
- **piexif**: メタデータ操作
- **SciPy**: DCTノイズ処理に使用

## セットアップ手順

### 1. Python環境の準備
`m-Alice` では、埋め込み版のPython (v3.12) を使用しています。以下の手順でセットアップを行います。

#### 方法 1: 自動セットアップ
1. アプリケーションを起動します。
2. 初回起動時、または「Install Python」ボタンをクリックすると、Python環境が自動的にセットアップされます。

#### 方法 2: 手動セットアップ
1. [Python公式サイト](https://www.python.org/downloads/release/python-31210/) から埋め込み版Pythonをダウンロードします。
2. ダウンロードしたZIPファイルを解凍し、`python/` ディレクトリに配置します。

### 2. 必要なライブラリのインストール
以下のコマンドを使用して、必要なライブラリをインストールします。

```bash
m-alice\python\python.exe -m pip install Pillow NumPy scikit-learn piexif scipy
```

### 3. 確認
インストールが正しく行われたか確認するには、以下のコマンドを実行してください：

```bash
m-alice\python\python.exe -m pip show Pillow NumPy scikit-learn piexif scipy
```

すべてのライブラリが表示されればセットアップ完了です。

---

## 注意事項
- ライブラリのバージョンは、Python 3.12 に対応しているものを使用してください。
- 必要に応じて、`requirements-dev.txt` に依存関係を追加してください。
