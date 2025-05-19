"use strict";

/**
 * 画像ファイルを選択する
 * @returns {Promise<{success: boolean, filePath: string, fileName: string, canceled: boolean, message: string}>}
 */
const selectImageFile = async () => {
  try {
    const result = await window.ipcBridge.selectImage();
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return {
        success: false,
        canceled: true,
        message: 'ファイル選択がキャンセルされました'
      };
    }
    const filePath = result.filePaths[0];
    // ファイル名取得は標準APIで
    const fileName = filePath.split(/[\\/]/).pop();
    return {
      success: true,
      filePath,
      fileName,
      canceled: false
    };
  } catch (error) {
    console.error('Error selecting image file:', error);
    return {
      success: false,
      canceled: false,
      message: `ファイル選択エラー: ${error.message}`
    };
  }
};

/**
 * ドロップされた画像ファイルを処理する
 * @param {File} file - ドロップされたファイルオブジェクト
 * @param {string} fileName - ファイル名
 * @returns {Promise<{success: boolean, filePath: string, message: string}>}
 */
const handleImageFile = async (file, fileName) => {
  try {
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        message: '画像ファイルを選択してください'
      };
    }
    const arrayBuffer = await file.arrayBuffer();
    // メインプロセスに送信するためのデータを準備
    const fileData = {
      buffer: arrayBuffer,
      type: file.type,
      name: fileName || file.name
    };
    // メインプロセスにファイルデータを送信して処理してもらう
    const result = await window.ipcBridge.handleDroppedFileData(fileData);
    return result;
  } catch (error) {
    console.error('Error handling image file:', error);
    return {
      success: false,
      message: `ファイル処理エラー: ${error.message}`
    };
  }
};

/**
 * エクスプローラーでファイルを表示する
 * @param {string} filePath - 表示するファイルのパス
 */
const showItemInFolder = filePath => {
  if (filePath) {
    window.ipcBridge.showItemInFolder(filePath);
  }
};

window.fileHandler = {
  selectImageFile,
  handleImageFile,
  showItemInFolder
};