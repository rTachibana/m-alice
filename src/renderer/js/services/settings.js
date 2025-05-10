const path = require('path');
const ipcBridge = require(path.join(__dirname, '../utils/ipcBridge'));

/**
 * 設定サービス - 設定の読み書きを抽象化
 */

// アプリケーション設定のデフォルト値
const DEFAULT_SETTINGS = {
    // 一般設定
    savePath: '',
    overwriteOriginal: false,
    
    // 画像処理設定
    noiseStrength: 0.2,
    blurStrength: 0.5,
    jpegQuality: 80,
    
    // メタデータ設定
    removeMetadata: true,
    addFakeMetadata: false,
    fakeMetadataType: 'generic',
    addNoAIFlag: false,
    
    // ウォーターマーク設定
    addWatermark: false,
    watermarkType: 'none',
    watermarkOpacity: 0.5,
    watermarkPosition: 'bottomRight'
};

// 現在のアプリケーション設定
let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * 設定を読み込む
 * @returns {Promise<{success: boolean, settings: Object, message: string}>}
 */
const loadSettings = async () => {
    try {
        const result = await ipcBridge.loadSettings();
        
        if (result.success && result.settings) {
            // 既存の設定と新しい設定をマージ
            currentSettings = { ...DEFAULT_SETTINGS, ...result.settings };
            return {
                success: true,
                settings: currentSettings,
                message: '設定を読み込みました'
            };
        } else {
            throw new Error(result.message || '設定の読み込みに失敗しました');
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        // エラー時はデフォルト設定を使用
        currentSettings = { ...DEFAULT_SETTINGS };
        return {
            success: false,
            settings: currentSettings,
            message: `設定の読み込みに失敗しました: ${error.message}`
        };
    }
};

/**
 * 設定を保存する
 * @param {Object} newSettings - 保存する設定
 * @returns {Promise<{success: boolean, message: string}>}
 */
const saveSettings = async (newSettings) => {
    try {
        if (!newSettings) {
            return {
                success: false,
                message: '保存する設定が指定されていません'
            };
        }
        
        // 現在の設定と新しい設定をマージ
        const settingsToSave = { ...currentSettings, ...newSettings };
        
        // 設定をバックエンドに保存
        const result = await ipcBridge.saveSettings(settingsToSave);
        
        if (result.success) {
            // 保存に成功したら、現在の設定を更新
            currentSettings = settingsToSave;
            return {
                success: true,
                message: '設定を保存しました'
            };
        } else {
            throw new Error(result.message || '設定の保存に失敗しました');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        return {
            success: false,
            message: `設定の保存に失敗しました: ${error.message}`
        };
    }
};

/**
 * 現在の設定を取得する
 * @returns {Object} 現在の設定
 */
const getCurrentSettings = () => {
    return { ...currentSettings };
};

/**
 * 設定をデフォルト値にリセットする
 * @returns {Promise<{success: boolean, message: string}>}
 */
const resetSettings = async () => {
    try {
        // デフォルト設定を保存
        const result = await saveSettings(DEFAULT_SETTINGS);
        
        if (result.success) {
            return {
                success: true,
                message: '設定をデフォルト値にリセットしました'
            };
        } else {
            throw new Error(result.message || '設定のリセットに失敗しました');
        }
    } catch (error) {
        console.error('Error resetting settings:', error);
        return {
            success: false,
            message: `設定のリセットに失敗しました: ${error.message}`
        };
    }
};

module.exports = {
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    getCurrentSettings,
    resetSettings
};