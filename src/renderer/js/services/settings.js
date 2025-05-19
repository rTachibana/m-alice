"use strict";

/**
 * 設定サービス - 設定の読み書きを抽象化
 */

// アプリケーション設定のデフォルト値
const DEFAULT_SETTINGS = {
  // 一般設定
  userDataDir: 'user_data',
  inputDir: 'user_data/input',
  outputDir: 'user_data/output',
  settingsDir: 'user_data',
  savePath: '',
  overwriteOriginal: false,
  // 画像処理設定
  noiseLevel: 3,
  noiseTypes: ['gaussian', 'dct'],
  // メタデータ設定
  metadataMode: 'not_processing',
  // 'not_processing', 'remove', 'fake'
  fakeMetadataType: 'random',
  addNoAIFlag: false,
  // ウォーターマーク設定
  watermarkEnabled: false,
  watermarkPath: 'no_ai',
  invertWatermark: false,
  enableOutline: true,
  watermarkSize: 75,
  watermarkOpacity: 75,
  outlineColor: {
    r: 255,
    g: 255,
    b: 255
  },
  // その他
  logoPosition: 'bottom-right',
  resize: 'original',
  outputFormat: 'png',
  logoFile: 'logo.png' // デフォルトロゴファイル
};

// 現在のアプリケーション設定
let currentSettings = {
  ...DEFAULT_SETTINGS
};

/**
 * 設定を読み込む
 * @returns {Promise<{success: boolean, settings: Object, message: string}>}
 */
const loadSettings = async () => {
  try {
    const result = await window.ipcBridge.loadSettings();
    let loaded = result.success && result.settings ? result.settings : {};
    // 古い項目から新項目へマッピング
    if ('removeMetadata' in loaded || 'addFakeMetadata' in loaded) {
      if (loaded.removeMetadata) {
        loaded.metadataMode = 'remove';
      } else if (loaded.addFakeMetadata) {
        loaded.metadataMode = 'fake';
      } else {
        loaded.metadataMode = 'not_processing';
      }
    }
    if ('fakeMetadataType' in loaded) {
      loaded.fakeMetadataType = loaded.fakeMetadataType;
    } else {
      loaded.fakeMetadataType = 'random';
    }
    if ('addNoAIFlag' in loaded) {
      loaded.addNoAIFlag = loaded.addNoAIFlag;
    } else {
      loaded.addNoAIFlag = false;
    }
    // 不要な旧項目を削除
    delete loaded.removeMetadata;
    delete loaded.addFakeMetadata;
    // マージ
    currentSettings = {
      ...DEFAULT_SETTINGS,
      ...loaded
    };
    return {
      success: true,
      settings: currentSettings,
      message: '設定を読み込みました'
    };
  } catch (error) {
    console.error('Error loading settings:', error);
    currentSettings = {
      ...DEFAULT_SETTINGS
    };
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
const saveSettings = async newSettings => {
  try {
    if (!newSettings) {
      return {
        success: false,
        message: '保存する設定が指定されていません'
      };
    }
    // 保存前に不要な旧項目を除去
    const settingsToSave = {
      ...currentSettings,
      ...newSettings
    };
    delete settingsToSave.removeMetadata;
    delete settingsToSave.addFakeMetadata;
    // 必要な項目のみ保存
    const allowedKeys = Object.keys(DEFAULT_SETTINGS);
    const filtered = {};
    for (const k of allowedKeys) {
      if (settingsToSave[k] !== undefined) filtered[k] = settingsToSave[k];
    }
    const result = await window.ipcBridge.saveSettings(filtered);
    if (result.success) {
      currentSettings = filtered;
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
  return {
    ...currentSettings
  };
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

/**
 * フォーム要素群から設定を生成し保存する（UI層から呼び出し用）
 * @param {Object} formElements - 各種フォーム要素の参照
 * @returns {Promise<{success: boolean, message: string}>}
 */
const saveSettingsFromForm = async formElements => {
  try {
    const {
      logoRadioChecked,
      noiseTypesElements,
      metaRadioChecked,
      fakeTypeSel,
      noAIFlagChk,
      noiseSlider,
      watermarkToggle,
      watermarkSelect,
      invertWatermarkToggle,
      enableOutlineToggle,
      watermarkOpacity,
      watermarkSize,
      redSlider,
      greenSlider,
      blueSlider
    } = formElements;
    const logoPosition = logoRadioChecked ? logoRadioChecked.value : 'bottom-right';
    const noiseTypes = Array.from(noiseTypesElements).map(el => el.value);
    const metadataMode = metaRadioChecked ? metaRadioChecked.value : 'not_processing';
    const fakeMetadataType = fakeTypeSel ? fakeTypeSel.value : 'random';
    const addNoAIFlag = noAIFlagChk ? noAIFlagChk.checked : false;
    const logoFile = formElements.logoFile || 'logo.png';
    const settings = {
      logoPosition,
      noiseLevel: noiseSlider ? noiseSlider.value : 3,
      watermarkEnabled: watermarkToggle ? watermarkToggle.checked : false,
      watermarkPath: watermarkSelect ? watermarkSelect.value : 'no_ai',
      invertWatermark: invertWatermarkToggle ? invertWatermarkToggle.checked : false,
      enableOutline: enableOutlineToggle ? enableOutlineToggle.checked : true,
      watermarkSize: watermarkSize ? watermarkSize.value : 75,
      watermarkOpacity: watermarkOpacity ? watermarkOpacity.value : 75,
      resize: formElements.resizeRadioChecked ? formElements.resizeRadioChecked.value : 'original',
      noiseTypes: noiseTypes,
      outlineColor: {
        r: redSlider ? parseInt(redSlider.value) : 255,
        g: greenSlider ? parseInt(greenSlider.value) : 255,
        b: blueSlider ? parseInt(blueSlider.value) : 255
      },
      metadataMode: metadataMode,
      fakeMetadataType: fakeMetadataType,
      addNoAIFlag: addNoAIFlag,
      outputFormat: formElements.outputFormatRadioChecked ? formElements.outputFormatRadioChecked.value : 'png',
      // 保存先パスも追加
      outputDir: formElements.outputDir || '',
      inputDir: formElements.inputDir || '',
      settingsDir: formElements.settingsDir || '',
      logoFile: logoFile // ロゴファイルも追加
    };
    return await saveSettings(settings);
  } catch (error) {
    console.error('Error saving settings from form:', error);
    return {
      success: false,
      message: `設定の保存に失敗しました: ${error.message}`
    };
  }
};
module.exports = {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  getCurrentSettings,
  resetSettings,
  saveSettingsFromForm
};