"use strict";

/**
 * 画像表示UIモジュール - 画像の表示と操作を管理
 */

// 依存モジュールはwindow経由で参照
const fileHandler = window.fileHandler;
const imageProcessService = window.imageProcessService;
const modalUI = window.modalUI;

// pathユーティリティはwindow.api経由
const pathApi = window.api;

// DOM要素と状態の参照
let beforeImage;
let afterImage;
let defaultName;
let outputName;
let processBtn;
let viewMetadataBtn;
let selectedImagePath = null;
let originalFileName = null;

/**
 * モジュールを初期化する
 */
const initialize = () => {
  // DOM要素の参照を取得
  beforeImage = document.getElementById('beforeImage');
  afterImage = document.getElementById('afterImage');
  defaultName = document.getElementById('defaultName');
  outputName = document.getElementById('outputName');
  processBtn = document.getElementById('processBtn');
  viewMetadataBtn = document.getElementById('viewMetadataBtn');

  // 処理ボタンにイベントリスナーを設定
  processBtn.addEventListener('click', handleImageProcessing);
  viewMetadataBtn.addEventListener('click', handleViewMetadata);

  // ドラッグ＆ドロップイベントの設定
  setupDragAndDrop();

  // beforeImageエリアのクリックで画像選択を設定
  beforeImage.addEventListener('click', handleImageClick);
};

/**
 * ドラッグ＆ドロップの設定
 */
const setupDragAndDrop = () => {
  beforeImage.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    beforeImage.classList.add('drag-over');
  });
  beforeImage.addEventListener('dragleave', e => {
    e.preventDefault();
    e.stopPropagation();
    beforeImage.classList.remove('drag-over');
  });
  beforeImage.addEventListener('drop', async e => {
    e.preventDefault();
    e.stopPropagation();
    beforeImage.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // ファイルがイメージかどうか確認
      if (!file.type.startsWith('image/')) {
        modalUI.showModal('エラー', '画像ファイルを選択してください');
        return;
      }
      try {
        // ファイルを処理（FileReaderでの読み込みはfileHandlerモジュールで実施）
        const result = await fileHandler.handleImageFile(file, file.name);
        if (result.success) {
          handleSelectedImage(result.filePath, file.name);
        } else {
          throw new Error(result.message || 'ファイルの処理に失敗しました');
        }
      } catch (error) {
        console.error('Error handling dropped file:', error);
        modalUI.showModal('エラー', `ファイルの処理に失敗しました: ${error.message}`);
      }
    }
  });
};

/**
 * 画像エリアクリック時のハンドラ
 */
const handleImageClick = async () => {
  try {
    const result = await fileHandler.selectImageFile();
    if (result.success) {
      handleSelectedImage(result.filePath, result.fileName);
    } else if (!result.canceled) {
      throw new Error(result.message || 'ファイルの選択に失敗しました');
    }
  } catch (error) {
    console.error('Error selecting image:', error);
    modalUI.showModal('エラー', `画像の選択に失敗しました: ${error.message}`);
  }
};

/**
 * 処理ボタンクリック時のハンドラ
 */
const handleImageProcessing = async () => {
  if (!selectedImagePath) {
    modalUI.showModal('エラー', '処理する画像が選択されていません');
    return;
  }
  try {
    // 処理中の表示
    processBtn.disabled = true;
    processBtn.textContent = '処理中...';

    // 画像処理を実行
    const result = await imageProcessService.processImage(selectedImagePath, originalFileName);
    if (result.success) {
      // 処理済み画像を表示
      afterImage.innerHTML = '';
      const img = document.createElement('img');
      img.src = result.outputPath + '?t=' + new Date().getTime(); // キャッシュ回避
      afterImage.appendChild(img);

      // 処理済み画像のパスを保存（モーダルUI用）
      modalUI.setProcessedImagePath(result.outputPath);

      // メタデータ表示ボタンを有効化
      viewMetadataBtn.disabled = false;

      // 処理完了モーダルを表示
      modalUI.showModal('処理完了', '画像処理が完了しました', true, result.outputPath);
    } else {
      throw new Error(result.message || '処理に失敗しました');
    }
  } catch (error) {
    console.error('Error processing image:', error);
    modalUI.showModal('エラー', `処理に失敗しました: ${error.message}`);
  } finally {
    processBtn.disabled = false;
    processBtn.textContent = "Infuse Malice";
  }
};

/**
 * メタデータ表示ボタンクリック時のハンドラ
 */
const handleViewMetadata = () => {
  // モーダルUIのメタデータ表示機能を使用
  const lastProcessedImagePath = modalUI.lastProcessedImagePath;
  if (lastProcessedImagePath) {
    modalUI.displayMetadata(lastProcessedImagePath);
  } else {
    modalUI.showModal('エラー', '処理済み画像が見つかりません');
  }
};

/**
 * 選択された画像を処理する
 * @param {string} imagePath - 画像のパス
 * @param {string} origFileName - 元のファイル名
 */
const handleSelectedImage = (imagePath, origFileName = null) => {
  if (!imagePath) return;
  try {
    selectedImagePath = imagePath;
    // オリジナルのファイル名を保存
    originalFileName = origFileName || pathApi.basename(imagePath);

    // 画像を表示
    displayImage(beforeImage, imagePath);

    // ファイル名を表示
    if (defaultName) {
      defaultName.textContent = originalFileName;
    }
    if (outputName) {
      outputName.textContent = `maliced-${originalFileName}`;
    }

    // 処理ボタンを有効化
    processBtn.disabled = false;
  } catch (error) {
    console.error('Error handling selected image:', error);
    modalUI.showModal('エラー', `画像の表示に失敗しました: ${error.message}`);
  }
};

/**
 * 画像を表示する
 * @param {HTMLElement} container - 画像を表示するコンテナ要素
 * @param {string} imagePath - 画像のパス
 */
const displayImage = (container, imagePath) => {
  container.innerHTML = '';
  const img = document.createElement('img');
  img.src = `${imagePath}?t=${new Date().getTime()}`; // キャッシュ回避
  container.appendChild(img);
};

/**
 * 選択されている画像パスを取得する
 * @returns {string|null} 選択されている画像のパス、または null
 */
const getSelectedImagePath = () => {
  return selectedImagePath;
};

/**
 * 元のファイル名を取得する
 * @returns {string|null} 元のファイル名、または null
 */
const getOriginalFileName = () => {
  return originalFileName;
};

if (typeof window !== 'undefined') {
  window.imageView = {
    initialize,
    handleSelectedImage,
    getSelectedImagePath,
    getOriginalFileName
  };
}