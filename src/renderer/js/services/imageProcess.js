"use strict";

/**
 * 画像処理サービス - 画像処理パラメータの構築と処理実行を管理
 */

/**
 * JavaScriptのキャメルケース形式からPythonのスネークケース形式に変換
 * @param {Object} options - キャメルケース形式のオプション
 * @returns {Object} スネークケース形式のオプション
 */
const convertToPythonOptions = options => {
  // キャメルケースからスネークケースへの変換を削除
  // バックエンドがキャメルケースで受け取るよう変更されているため
  return {
    ...options
  };
};

/**
 * UIの設定からPython処理用のオプションを構築
 * @param {string} imagePath - 処理する画像のパス
 * @param {string} originalFileName - 元のファイル名
 * @returns {Object} 処理オプション
 */
const buildProcessOptions = (imagePath, originalFileName) => {
  // 現在の設定を取得
  const userSettings = window.settingsService.getCurrentSettings();

  // UIの状態から処理オプションを構築
  return {
    imagePath: imagePath,
    originalFileName: originalFileName,
    noiseLevel: userSettings.noiseLevel,
    noiseTypes: userSettings.noiseTypes,
    applyWatermark: userSettings.watermarkEnabled,
    watermarkPath: userSettings.watermarkEnabled ? userSettings.watermarkPath : null,
    invertWatermark: userSettings.watermarkEnabled && userSettings.invertWatermark,
    resize: userSettings.resize,
    // HTMLから取得した最小不透明度（min属性）をバックエンドに渡す
    watermarkOpacityMin: (document.getElementById('watermarkOpacity')?.min || 5) / 100,
    // ユーザーが指定した値（0-100%）をそのまま0.0-1.0の範囲に変換
    watermarkOpacity: userSettings.watermarkOpacity / 100,
    logoPosition: userSettings.logoPosition,
    logoFile: userSettings.logoFile, // 追加
    removeMetadata: userSettings.removeMetadata,
    addFakeMetadata: userSettings.addFakeMetadata,
    fakeMetadataType: userSettings.fakeMetadataType,
    addNoAIFlag: userSettings.addNoAIFlag
  };
};

/**
 * 画像を処理する
 * @param {string} imagePath - 処理する画像のパス
 * @param {string} originalFileName - 元のファイル名
 * @returns {Promise<{success: boolean, outputPath: string, message: string}>}
 */
const processImage = async (imagePath, originalFileName) => {
  try {
    // 処理オプションを構築
    const options = buildProcessOptions(imagePath, originalFileName);

    // Python互換のオプションに変換
    const pythonOptions = convertToPythonOptions(options);

    // IPCを通じて画像処理を実行
    const result = await window.ipcBridge.processImage(pythonOptions);
    return result;
  } catch (error) {
    console.error('Error processing image:', error);
    return {
      success: false,
      message: `処理に失敗しました: ${error.message}`
    };
  }
};

/**
 * 出力フォルダの画像を表示する
 * @param {string} inputPath - 入力画像のパス
 * @param {string} fileName - ファイル名
 */
const showOutputInFolder = (inputPath, fileName) => {
  if (inputPath && fileName) {
    const outputFilePath = path.join(path.dirname(inputPath).replace('input', 'output'), `maliced-${fileName}`);
    window.ipcBridge.showItemInFolder(outputFilePath);
  }
};

if (typeof window !== 'undefined') {
  window.imageProcessService = {
    processImage,
    showOutputInFolder
  };
}