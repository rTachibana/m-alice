/**
 * 設定UIモジュール - 設定画面の表示と操作を管理
 */
const modalUI = require('./modal');
const settingsService = require('../services/settings');
const ipcBridge = require('../utils/ipcBridge');

// DOM要素の参照
let settingsModalOverlay;
let settingsModalCloseBtn;
let settingsSaveBtn;
let settingsCancelBtn;
let watermarkSelect;

/**
 * モジュールを初期化する
 */
const initialize = () => {
    // 設定モーダル関連の要素を取得
    settingsModalOverlay = document.getElementById('settingsModalOverlay');
    settingsModalCloseBtn = document.getElementById('settingsModalCloseBtn');
    settingsSaveBtn = document.getElementById('settingsSaveBtn');
    settingsCancelBtn = document.getElementById('settingsCancelBtn');
    watermarkSelect = document.getElementById('watermarkSelect');
    
    // イベントリスナーを設定
    settingsModalCloseBtn.addEventListener('click', closeSettingsModal);
    settingsCancelBtn.addEventListener('click', closeSettingsModal);
    settingsSaveBtn.addEventListener('click', saveSettings);
    
    // サイドメニューの設定ボタンにイベントリスナーを追加
    const settingsButtons = document.querySelectorAll('.menu-btn');
    if (settingsButtons.length > 1) {
        settingsButtons[1].addEventListener('click', openSettingsModal);
    }
    
    // 初期設定を読み込む
    loadSettings().then(() => {
        loadWatermarkOptions().then(() => {
            console.log('Settings and watermark options loaded');
        }).catch(err => {
            console.error('Error loading watermark options:', err);
        });
    }).catch(err => {
        console.error('Error loading settings:', err);
    });
};

/**
 * 設定モーダルを開く
 */
const openSettingsModal = async () => {
    // 現在の設定を読み込む
    const userSettings = settingsService.getCurrentSettings();
    
    // 設定モーダルのフォーム要素に現在の設定値を設定
    document.querySelector(`input[name="logoPosition"][value="${userSettings.logoPosition}"]`).checked = true;
    
    // ノイズタイプの設定を反映
    if (userSettings.noiseTypes && userSettings.noiseTypes.length > 0) {
        // すべてのチェックボックスをいったん解除
        document.querySelectorAll('input[name="noiseTypes"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // 設定に保存されているノイズタイプをチェック
        userSettings.noiseTypes.forEach(type => {
            const checkbox = document.querySelector(`input[name="noiseTypes"][value="${type}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }
    
    // メタデータ設定の反映
    if ('removeMetadata' in userSettings) {
        document.getElementById('removeMetadata').checked = userSettings.removeMetadata;
    }
    if ('addFakeMetadata' in userSettings) {
        document.getElementById('addFakeMetadata').checked = userSettings.addFakeMetadata;
    }
    if ('fakeMetadataType' in userSettings) {
        document.getElementById('fakeMetadataType').value = userSettings.fakeMetadataType;
    }
    if ('addNoAIFlag' in userSettings) {
        document.getElementById('addNoAIFlag').checked = userSettings.addNoAIFlag;
    }
    
    // モーダルを表示
    settingsModalOverlay.classList.add('show');
};

/**
 * 設定モーダルを閉じる
 */
const closeSettingsModal = () => {
    settingsModalOverlay.classList.remove('show');
};

/**
 * 設定を保存する
 */
const saveSettings = async () => {
    try {
        // フォームから設定値を取得
        const logoPosition = document.querySelector('input[name="logoPosition"]:checked').value;
        
        // ノイズタイプの選択肢を取得（複数選択可能）
        const noiseTypesElements = document.querySelectorAll('input[name="noiseTypes"]:checked');
        const noiseTypes = Array.from(noiseTypesElements).map(el => el.value);
        
        // メタデータ設定を取得
        const removeMetadata = document.getElementById('removeMetadata').checked;
        const addFakeMetadata = document.getElementById('addFakeMetadata').checked;
        const fakeMetadataType = document.getElementById('fakeMetadataType').value;
        const addNoAIFlag = document.getElementById('addNoAIFlag').checked;
        
        // 他の設定値も保持（UIの現在の状態から）
        const noiseSlider = document.getElementById('noiseSlider');
        const watermarkToggle = document.getElementById('watermarkToggle');
        const invertWatermarkToggle = document.getElementById('invertWatermarkToggle');
        const watermarkOpacity = document.getElementById('watermarkOpacity');
        
        const settings = {
            logoPosition,
            noiseLevel: noiseSlider.value,
            watermarkEnabled: watermarkToggle.checked,
            watermarkType: watermarkSelect.value,
            invertWatermark: invertWatermarkToggle.checked,
            watermarkOpacity: watermarkOpacity.value,
            resize: document.querySelector('input[name="resize"]:checked').value,
            noiseTypes: noiseTypes,
            // メタデータ設定を追加
            removeMetadata: removeMetadata,
            addFakeMetadata: addFakeMetadata,
            fakeMetadataType: fakeMetadataType,
            addNoAIFlag: addNoAIFlag
        };
        
        // 設定を保存
        const result = await settingsService.saveSettings(settings);
        
        if (result.success) {
            modalUI.showModal('設定', '設定を保存しました');
            closeSettingsModal();
        } else {
            throw new Error(result.message || '設定の保存に失敗しました');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        modalUI.showModal('エラー', `設定の保存に失敗しました: ${error.message}`);
    }
};

/**
 * 設定を読み込む
 */
const loadSettings = async () => {
    try {
        // 設定サービスから設定を読み込む
        const userSettings = await settingsService.loadSettings();
        
        // UIに設定を反映
        const noiseSlider = document.getElementById('noiseSlider');
        const watermarkToggle = document.getElementById('watermarkToggle');
        const invertWatermarkToggle = document.getElementById('invertWatermarkToggle');
        const watermarkOpacity = document.getElementById('watermarkOpacity');
        const opacityValue = document.getElementById('opacityValue');
        
        // ノイズレベルのスライダーを設定
        noiseSlider.value = userSettings.noiseLevel;
        // ノイズレベルのテキスト表示を更新
        updateNoiseLevelText(noiseSlider.value);
        
        // ウォーターマーク設定
        watermarkToggle.checked = userSettings.watermarkEnabled;
        watermarkSelect.disabled = !userSettings.watermarkEnabled;
        invertWatermarkToggle.checked = userSettings.invertWatermark;
        invertWatermarkToggle.disabled = !userSettings.watermarkEnabled;
        watermarkOpacity.value = userSettings.watermarkOpacity;
        opacityValue.textContent = `${userSettings.watermarkOpacity}%`;
        
        // リサイズ設定
        document.querySelector(`input[name="resize"][value="${userSettings.resize}"]`).checked = true;
        
        return userSettings;
    } catch (error) {
        console.error('Error loading settings:', error);
        return settingsService.DEFAULT_SETTINGS;
    }
};

/**
 * ノイズレベルの表示テキストを更新する
 * @param {string|number} value - ノイズレベル値
 */
const updateNoiseLevelText = (value) => {
    const level = parseInt(value);
    let levelText = '';
    const noiseLevelText = document.getElementById('noiseLevelText');
    
    switch (level) {
        case 0:
            levelText = "Lower (Lv.1)";
            break;
        case 1:
            levelText = 'Low (Lv.2)';
            break;
        case 2:
            levelText = 'Mild (Lv.3)';
            break;
        case 3:
            levelText = 'Moderate (Lv.4)';
            break;
        case 4:
            levelText = 'Strong (Lv.5)';
            break;
        case 5:
            levelText = "Very Strong (Lv.6)";
            break;
        case 6:
            levelText = 'Maximum (Lv.7)';
            break;
        case 7:
            levelText = "Chaos (Lv.8)";
            break;
        default:
            levelText = "Moderate (Lv.4)";
    }
    
    noiseLevelText.textContent = levelText;
};

/**
 * ウォーターマークの選択肢を読み込む
 */
const loadWatermarkOptions = async () => {
    try {
        // セレクトボックスをクリア
        watermarkSelect.innerHTML = '';
        
        // ウォーターマーク一覧を取得
        const result = await ipcBridge.getWatermarks();
        
        if (result.success && result.watermarks && result.watermarks.length > 0) {
            // 選択肢を追加
            result.watermarks.forEach(watermark => {
                const option = document.createElement('option');
                option.value = watermark.value;
                option.textContent = watermark.displayName;
                watermarkSelect.appendChild(option);
            });
            
            // 設定に保存されていた値があれば選択
            const userSettings = settingsService.getCurrentSettings();
            if (userSettings && userSettings.watermarkType) {
                // 値が存在するか確認
                const exists = Array.from(watermarkSelect.options).some(opt => opt.value === userSettings.watermarkType);
                if (exists) {
                    watermarkSelect.value = userSettings.watermarkType;
                }
            }
            
            console.log('Watermark options loaded');
        } else {
            console.warn('No watermarks found or error occurred');
            // デフォルトの選択肢を追加
            const defaultOptions = [
                { value: 'no_ai', displayName: 'No AI' },
                { value: 'all_rights_reserved', displayName: 'All Rights Reserved' }
            ];
            
            defaultOptions.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option.value;
                opt.textContent = option.displayName;
                watermarkSelect.appendChild(opt);
            });
        }
    } catch (error) {
        console.error('Error loading watermark options:', error);
        // エラー時はデフォルトの選択肢を追加
        const fallbackOption = document.createElement('option');
        fallbackOption.value = 'no_ai';
        fallbackOption.textContent = 'No AI';
        watermarkSelect.appendChild(fallbackOption);
    }
};

module.exports = {
    initialize,
    updateNoiseLevelText,
    openSettingsModal
};