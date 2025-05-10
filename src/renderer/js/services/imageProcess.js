/**
 * 画像処理サービス - 画像処理パラメータの構築と処理実行を管理
 */
const path = require('path');
const ipcBridge = require(path.join(__dirname, '../utils/ipcBridge'));
const settingsService = require('./settings');

/**
 * JavaScriptのキャメルケース形式からPythonのスネークケース形式に変換
 * @param {Object} options - キャメルケース形式のオプション
 * @returns {Object} スネークケース形式のオプション
 */
const convertToPythonOptions = (options) => {
    const snakeCaseOptions = {};
    
    // キーをキャメルケースからスネークケースに変換
    for (const [key, value] of Object.entries(options)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        snakeCaseOptions[snakeKey] = value;
    }
    
    return snakeCaseOptions;
};

/**
 * UIの設定からPython処理用のオプションを構築
 * @param {string} imagePath - 処理する画像のパス
 * @param {string} originalFileName - 元のファイル名
 * @returns {Object} 処理オプション
 */
const buildProcessOptions = (imagePath, originalFileName) => {
    // 現在の設定を取得
    const userSettings = settingsService.getCurrentSettings();
    
    // UIの状態から処理オプションを構築
    return {
        imagePath: imagePath,
        originalFileName: originalFileName,
        noiseLevel: userSettings.noiseLevel,
        noiseTypes: userSettings.noiseTypes,
        applyWatermark: userSettings.watermarkEnabled,
        watermarkType: userSettings.watermarkEnabled ? userSettings.watermarkType : null,
        invertWatermark: userSettings.watermarkEnabled && userSettings.invertWatermark,
        resize: userSettings.resize,
        watermarkOpacity: Math.max(0.1, userSettings.watermarkOpacity / 100), // 最小値を0.1に制限
        logoPosition: userSettings.logoPosition,
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
        const result = await ipcBridge.processImage(pythonOptions);
        
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
        const outputFilePath = path.join(
            path.dirname(inputPath).replace('input', 'output'),
            `maliced-${fileName}`
        );
        ipcBridge.showItemInFolder(outputFilePath);
    }
};

module.exports = {
    processImage,
    showOutputInFolder
};