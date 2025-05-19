/* global window */

(function() {
  'use strict';

const modalUI = window.api.modal;
const settingsService = window.api.settingsService;
const ipcBridge = window.ipcBridge;

/**
 * 設定UIモジュール - 設定画面の表示と操作を管理
 */

// DOM要素の参照
let settingsModalOverlay;
let settingsModalCloseBtn;
let settingsSaveBtn;
let settingsCancelBtn;
let watermarkSelect;
let logoSelect;

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
  logoSelect = document.getElementById('logoSelect');

  // イベントリスナーを設定
  if (settingsModalCloseBtn) settingsModalCloseBtn.addEventListener('click', closeSettingsModal);
  if (settingsSaveBtn) settingsSaveBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // モーダル外クリックと競合しないように
    saveSettings();
  });
  // Cancelボタンは存在しない場合があるのでnullチェック
  if (settingsCancelBtn) settingsCancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSettingsModal();
  });

  // モーダル外クリックで閉じる（SaveボタンやXボタンのクリックとは競合しない）
  if (settingsModalOverlay) {
    settingsModalOverlay.addEventListener('mousedown', (e) => {
      if (e.target === settingsModalOverlay) {
        closeSettingsModal();
      }
    });
  }

  // サイドメニューの設定ボタンにイベントリスナーを追加
  const settingsButtons = document.querySelectorAll('.menu-btn');
  if (settingsButtons.length > 1) {
    settingsButtons[1].addEventListener('click', (e) => {
      e.stopPropagation();
      openSettingsModal();
    });
  }

  // 初期設定を読み込む
  loadSettings().then(() => {
    console.log('Settings loaded');
  }).catch(err => {
    console.error('Error loading settings:', err);
  });

  // メタデータラジオボタンのイベント
  document.querySelectorAll('input[name="metadataMode"]').forEach(radio => {
    radio.addEventListener('change', updateMetadataUI);
  });
  updateMetadataUI();
  loadLogoOptions();
};

/**
 * 設定モーダルを開く
 */
const openSettingsModal = async () => {
  // 現在の設定を読み込む
  const userSettings = settingsService.getCurrentSettings();

  // ウォーターマーク選択肢を最新化し、現在の値を選択
  await loadWatermarkOptions();
  if (userSettings && userSettings.watermarkPath) {
    const exists = Array.from(watermarkSelect.options).some(opt => opt.value === userSettings.watermarkPath);
    if (exists) {
      watermarkSelect.value = userSettings.watermarkPath;
    }
  }

  // ロゴ選択肢を最新化し、現在の値を選択
  await loadLogoOptions();
  if (logoSelect && userSettings.logoFile) {
    logoSelect.value = userSettings.logoFile;
  }

  // 設定モーダルのフォーム要素に現在の設定値を設定
  const logoRadio = document.querySelector(`input[name="logoPosition"][value="${userSettings.logoPosition}"]`);
  if (logoRadio) logoRadio.checked = true;

  // ノイズタイプの設定を反映
  if (userSettings.noiseTypes && userSettings.noiseTypes.length > 0) {
    document.querySelectorAll('input[name="noiseTypes"]').forEach(checkbox => {
      checkbox.checked = false;
    });
    userSettings.noiseTypes.forEach(type => {
      const checkbox = document.querySelector(`input[name="noiseTypes"][value="${type}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }

  // メタデータ設定の反映
  if ('metadataMode' in userSettings) {
    const metaRadio = document.querySelector(`input[name="metadataMode"][value="${userSettings.metadataMode}"]`);
    if (metaRadio) metaRadio.checked = true;
  } else {
    const metaNone = document.getElementById('metadataModeNone');
    if (metaNone) metaNone.checked = true;
  }
  updateMetadataUI();
  const fakeTypeSel = document.getElementById('fakeMetadataType');
  if ('fakeMetadataType' in userSettings && fakeTypeSel) {
    fakeTypeSel.value = userSettings.fakeMetadataType;
  }
  const noAIFlagChk = document.getElementById('addNoAIFlag');
  if ('addNoAIFlag' in userSettings && noAIFlagChk) {
    noAIFlagChk.checked = userSettings.addNoAIFlag;
  }

  // 保存先パスの入力欄に現在の設定値を反映
  const outputDirInput = document.getElementById('outputDirInput');
  if (outputDirInput) outputDirInput.value = userSettings.outputDir || 'user_data/output';

  // モーダルを表示
  if (settingsModalOverlay) settingsModalOverlay.classList.add('show');
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
    // 保存時もoutputDirのみ取得
    const outputDirInput = document.getElementById('outputDirInput');
    const outputDir = outputDirInput ? outputDirInput.value : 'user_data/output';

    // フォームから設定値を取得し、まとめて渡す
    const formElements = {
      logoRadioChecked: document.querySelector('input[name="logoPosition"]:checked'),
      noiseTypesElements: document.querySelectorAll('input[name="noiseTypes"]:checked'),
      metaRadioChecked: document.querySelector('input[name="metadataMode"]:checked'),
      fakeTypeSel: document.getElementById('fakeMetadataType'),
      noAIFlagChk: document.getElementById('addNoAIFlag'),
      noiseSlider: document.getElementById('noiseSlider'),
      watermarkToggle: document.getElementById('watermarkToggle'),
      watermarkSelect: watermarkSelect,
      invertWatermarkToggle: document.getElementById('invertWatermarkToggle'),
      enableOutlineToggle: document.getElementById('enableOutlineToggle'),
      watermarkOpacity: document.getElementById('watermarkOpacity'),
      watermarkSize: document.getElementById('watermarkSize'),
      redSlider: document.getElementById('redSlider'),
      greenSlider: document.getElementById('greenSlider'),
      blueSlider: document.getElementById('blueSlider'),
      resizeRadioChecked: document.querySelector('input[name="resize"]:checked'),
      outputFormatRadioChecked: document.querySelector('input[name="outputFormat"]:checked'),
      // 設定保存時にoutputDirのみを保存
      outputDir,
      logoFile: logoSelect ? logoSelect.value : ''
    };
    const result = await settingsService.saveSettingsFromForm(formElements);
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
    if (noiseSlider) noiseSlider.value = userSettings.noiseLevel;
    updateNoiseLevelText(noiseSlider ? noiseSlider.value : 3);

    // ウォーターマーク設定
    const watermarkToggle = document.getElementById('watermarkToggle');
    if (watermarkToggle) watermarkToggle.checked = userSettings.watermarkEnabled;
    if (watermarkSelect) watermarkSelect.disabled = !userSettings.watermarkEnabled;
    const invertWatermarkToggle = document.getElementById('invertWatermarkToggle');
    if (invertWatermarkToggle) invertWatermarkToggle.checked = userSettings.invertWatermark;
    if (invertWatermarkToggle) invertWatermarkToggle.disabled = !userSettings.watermarkEnabled;

    // アウトライン設定があれば反映
    const enableOutlineToggle = document.getElementById('enableOutlineToggle');
    if (enableOutlineToggle) {
      enableOutlineToggle.checked = userSettings.enableOutline !== undefined ? userSettings.enableOutline : true;
      enableOutlineToggle.disabled = !userSettings.watermarkEnabled;
    }

    // アウトライン色の設定があれば反映
    if (userSettings.outlineColor) {
      const redSlider = document.getElementById('redSlider');
      const greenSlider = document.getElementById('greenSlider');
      const blueSlider = document.getElementById('blueSlider');
      if (redSlider) redSlider.value = userSettings.outlineColor.r || 255;
      if (greenSlider) greenSlider.value = userSettings.outlineColor.g || 255;
      if (blueSlider) blueSlider.value = userSettings.outlineColor.b || 255;
      // カラープレビューの更新
      const colorPreview = document.getElementById('colorPreview');
      if (colorPreview) {
        const r = userSettings.outlineColor.r || 255;
        const g = userSettings.outlineColor.g || 255;
        const b = userSettings.outlineColor.b || 255;
        colorPreview.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
      }
    }
    const watermarkOpacity = document.getElementById('watermarkOpacity');
    const opacityValue = document.getElementById('opacityValue');
    if (watermarkOpacity) watermarkOpacity.value = userSettings.watermarkOpacity;
    if (opacityValue) opacityValue.textContent = `${userSettings.watermarkOpacity}%`;

    // ウォーターマークサイズの設定があれば反映
    const watermarkSize = document.getElementById('watermarkSize');
    const sizeValue = document.getElementById('sizeValue');
    if (watermarkSize && userSettings.watermarkSize) {
      watermarkSize.value = userSettings.watermarkSize;
      if (sizeValue) sizeValue.textContent = `${userSettings.watermarkSize}%`;
      watermarkSize.disabled = !userSettings.watermarkEnabled;
    }

    // リサイズ設定
    const resizeRadio = document.querySelector(`input[name="resize"][value="${userSettings.resize}"]`);
    if (resizeRadio) resizeRadio.checked = true;
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
const updateNoiseLevelText = value => {
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

// メタデータUI制御の追加
function updateMetadataUI() {
  const mode = document.querySelector('input[name="metadataMode"]:checked').value;
  const fakeOptions = document.getElementById('fakeMetadataOptions');
  if (mode === 'fake') {
    fakeOptions.style.display = '';
    document.getElementById('fakeMetadataType').disabled = false;
    document.getElementById('addNoAIFlag').disabled = false;
  } else {
    fakeOptions.style.display = 'none';
    document.getElementById('fakeMetadataType').disabled = true;
    document.getElementById('addNoAIFlag').disabled = true;
  }
}

// ロゴファイル選択肢を読み込む
async function loadLogoOptions() {
  if (!logoSelect) {
    console.error('Logo select element not found');
    return;
  }
  logoSelect.innerHTML = '';
  // mainプロセスからロゴ一覧を取得
  let logos = [];
  try {
    const result = await window.api.getLogos();
    if (result.success && Array.isArray(result.logos)) {
      logos = result.logos;
    }
  } catch (e) {
    console.error('Failed to load logo list:', e);
  }
  if (logos.length === 0) {
    // デフォルト値
    logos = [{ value: 'logo', displayName: 'logo' }];
  }
  for (const logo of logos) {
    const option = document.createElement('option');
    option.value = logo.value;
    option.textContent = logo.displayName;
    logoSelect.appendChild(option);
  }
}

if (typeof window !== 'undefined') window.settingsView = { initialize, updateNoiseLevelText, openSettingsModal };

})();