/**
 * ファイル操作ユーティリティ - ファイル選択と処理を抽象化
 */
const path = require('path');
const ipcBridge = require('./ipcBridge');

/**
 * 画像ファイルを選択する
 * @returns {Promise<{success: boolean, filePath: string, fileName: string, canceled: boolean, message: string}>}
 */
const selectImageFile = async () => {
    try {
        const result = await ipcBridge.selectImage();
        
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return {
                success: false,
                canceled: true,
                message: 'ファイル選択がキャンセルされました'
            };
        }
        
        const filePath = result.filePaths[0];
        const fileName = path.basename(filePath);
        
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
        // ファイルがイメージかどうか確認
        if (!file.type.startsWith('image/')) {
            return {
                success: false,
                message: '画像ファイルを選択してください'
            };
        }
        
        // ファイルをArrayBufferとして読み込む
        const arrayBuffer = await file.arrayBuffer();
        
        // メインプロセスに送信するためのデータを準備
        const fileData = {
            buffer: Buffer.from(arrayBuffer),
            type: file.type,
            name: fileName || file.name
        };
        
        // メインプロセスにファイルデータを送信して処理してもらう
        const result = await ipcBridge.handleDroppedFileData(fileData);
        
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
const showItemInFolder = (filePath) => {
    if (filePath) {
        ipcBridge.showItemInFolder(filePath);
    }
};

module.exports = {
    selectImageFile,
    handleImageFile,
    showItemInFolder
};