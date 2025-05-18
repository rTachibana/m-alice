"use strict";

// Require electron components using contextBridge
const {
  ipcRenderer
} = require('electron');
const path = require('path');
const fs = require('fs');
const {
  showModal,
  closeModal,
  toggleDetails
} = require("./js/ui/modal");

// Global variables
let selectedImagePath = null;
let originalFileName = null; // オリジナルのファイル名を保持する変数を追加
let userSettings = null; // ユーザー設定を保持する変数

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  const beforeImage = document.getElementById('beforeImage');
  const afterImage = document.getElementById('afterImage');
  const defaultName = document.getElementById('defaultName');
  const outputName = document.getElementById('outputName');
  const processBtn = document.getElementById('processBtn');
  const watermarkToggle = document.getElementById('watermarkToggle');
  const watermarkSelect = document.getElementById('watermarkSelect');
  const invertWatermarkToggle = document.getElementById('invertWatermarkToggle');
  const enableOutlineToggle = document.getElementById('enableOutlineToggle');
  const noiseSlider = document.getElementById('noiseSlider');
  const watermarkOpacity = document.getElementById('watermarkOpacity');
  const opacityValue = document.getElementById('opacityValue');
  const noiseLevelText = document.getElementById('noiseLevelText');
  const watermarkSize = document.getElementById('watermarkSize');
  const sizeValue = document.getElementById('sizeValue');

  // アウトライン色選択関連の要素
  const outlineColorControls = document.getElementById('outlineColorControls');
  const colorPreview = document.getElementById('colorPreview');
  const redSlider = document.getElementById('redSlider');
  const greenSlider = document.getElementById('greenSlider');
  const blueSlider = document.getElementById('blueSlider');
  const redValue = document.getElementById('redValue');
  const greenValue = document.getElementById('greenValue');
  const blueValue = document.getElementById('blueValue');
  const autoColorBtn = document.getElementById('autoColorBtn');

  // モーダル関連の要素
  const modalOverlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalOkBtn = document.getElementById('modalOkBtn');
  const modalDetailsContainer = document.getElementById('modalDetailsContainer');
  const showDetailsBtn = document.getElementById('showDetailsBtn');
  const modalDetails = document.getElementById('modalDetails');

  // 直近の処理済み画像のパスを保持する変数
  let lastProcessedImagePath = null;

  // モーダルを閉じる関数
  function closeModal() {
    modalOverlay.classList.remove('show');
  }

  // 詳細表示ボタンのイベントリスナー
  showDetailsBtn.addEventListener('click', async () => {
    // ボタンの状態を切り替え
    showDetailsBtn.classList.toggle('active');

    // 詳細エリアが表示されていない場合はメタデータを読み込んで表示
    if (modalDetails.style.display !== 'block') {
      modalDetails.style.display = 'block';
      modalDetails.innerHTML = '<p>メタデータを読み込み中...</p>';
      try {
        // メタデータを取得
        if (lastProcessedImagePath) {
          const result = await ipcRenderer.invoke('get-image-metadata', lastProcessedImagePath);
          if (result.success) {
            // メタデータ表示用のHTMLを生成
            let metadataContent = '<div class="metadata-display">';
            if (!result.metadata || Object.keys(result.metadata).length === 0) {
              metadataContent += '<p>画像にメタデータが含まれていません</p>';
            } else {
              metadataContent += '<h4>画像メタデータ</h4>';
              metadataContent += '<table class="metadata-table">';

              // メタデータのカテゴリごとに表示
              for (const [category, items] of Object.entries(result.metadata)) {
                metadataContent += `<tr><th colspan="2" class="category-header">${category}</th></tr>`;

                // エラーの場合は特別処理
                if (category === 'Error') {
                  metadataContent += `<tr><td>メッセージ</td><td>${items}</td></tr>`;
                  continue;
                }

                // カテゴリ内の項目を表示（オブジェクトであることを確認）
                if (typeof items === 'object' && items !== null) {
                  for (const [key, value] of Object.entries(items)) {
                    metadataContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
                  }
                } else {
                  // オブジェクトでない場合は単純な値として表示
                  metadataContent += `<tr><td>${category}</td><td>${items}</td></tr>`;
                }
              }
              metadataContent += '</table>';
            }
            metadataContent += '</div>';
            modalDetails.innerHTML = metadataContent;
          } else {
            throw new Error(result.message || 'メタデータの取得に失敗しました');
          }
        } else {
          throw new Error('処理済み画像が見つかりません');
        }
      } catch (error) {
        console.error('Error loading metadata:', error);
        modalDetails.innerHTML = `<p class="error">メタデータの読み込みに失敗しました: ${error.message}</p>`;
      }
    } else {
      // 既に表示されている場合は非表示にする
      modalDetails.style.display = 'none';
    }
  });

  // モーダルのクローズボタンとOKボタンにイベントリスナーを追加
  modalCloseBtn.addEventListener('click', closeModal);
  modalOkBtn.addEventListener('click', closeModal);

  // Enable/disable watermark selection based on toggle
  watermarkToggle.addEventListener('change', () => {
    const isEnabled = watermarkToggle.checked;
    watermarkSelect.disabled = !isEnabled;
    invertWatermarkToggle.disabled = !isEnabled;
    enableOutlineToggle.disabled = !isEnabled;
    // .watermark-select, .watermark-invert-toggle, .watermark-outline-toggle, .watermark-controls-groupを一括でグレーアウト/活性化
    document.querySelectorAll('.watermark-select, .watermark-invert-toggle, .watermark-outline-toggle, .watermark-controls-group').forEach(el => {
      el.style.opacity = isEnabled ? '1' : '0.5';
      el.style.pointerEvents = isEnabled ? 'auto' : 'none';
    });
    // input自体のdisabledも維持
    watermarkSize.disabled = !isEnabled;
    watermarkOpacity.disabled = !isEnabled;
  });

  // Update opacity value display
  watermarkOpacity.addEventListener('input', () => {
    opacityValue.textContent = `${watermarkOpacity.value}%`;
  });

  // Update watermark size value display
  watermarkSize.addEventListener('input', () => {
    sizeValue.textContent = `${watermarkSize.value}%`;
  });

  // ノイズレベルの表示を更新する関数
  function updateNoiseLevelText(value) {
    const level = parseInt(value);
    let levelText = '';
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
  }

  // 初期表示を設定
  updateNoiseLevelText(noiseSlider.value);

  // スライダー値変更時の処理
  noiseSlider.addEventListener('input', () => {
    updateNoiseLevelText(noiseSlider.value);
  });

  // マスタードノイズプリセットのチェックボックス要素を追加
  const mustardPreset = document.getElementById('mustardPreset');

  // マスタードノイズプリセットのチェックボックスのイベントリスナーを追加
  if (mustardPreset) {
    mustardPreset.addEventListener('change', () => {
      if (mustardPreset.checked) {
        // プリセットが選択された場合の処理
        // ノイズタイプのチェックボックスを更新（ガウシアン、DCT、マスタード）
        document.querySelectorAll('input[name="noiseTypes"]').forEach(checkbox => {
          // マスタードノイズプリセットで使用するノイズタイプ
          const presetNoiseTypes = ['gaussian', 'dct', 'mustard'];
          checkbox.checked = presetNoiseTypes.includes(checkbox.value);
        });

        // ノイズレベルを適切な値に設定（中程度のレベル）
        noiseSlider.value = 3;
        updateNoiseLevelText(noiseSlider.value);
        console.log('Mustard noise preset applied');
      }
    });
  }

  // Process button click handler
  processBtn.addEventListener('click', async () => {
    if (!selectedImagePath) {
      return;
    }
    try {
      // Show processing indication
      processBtn.disabled = true;
      processBtn.textContent = "Processing...";

      // マスタードノイズプリセットが選択されているかチェック
      const isMustardPresetActive = mustardPreset && mustardPreset.checked;

      // Collect processing options
      const options = {
        imagePath: selectedImagePath,
        originalFileName: originalFileName,
        // オリジナルのファイル名を追加
        noiseLevel: noiseSlider.value,
        noiseTypes: userSettings ? userSettings.noiseTypes : ["gaussian", "dct"],
        // ノイズタイプを追加
        applyWatermark: watermarkToggle.checked,
        watermarkPath: watermarkToggle.checked ? watermarkSelect.value : null,
        invertWatermark: watermarkToggle.checked && invertWatermarkToggle.checked,
        enableOutline: watermarkToggle.checked && enableOutlineToggle.checked,
        // アウトライン設定を追加
        watermarkSize: watermarkToggle.checked ? watermarkSize.value / 100 : 0.5,
        // ウォーターマークサイズを0.3-0.95の範囲で設定
        resize: document.querySelector('input[name="resize"]:checked').value,
        // 最小値を0.3に制限
        watermarkOpacity: Math.max(0.3, watermarkOpacity.value / 100),
        logoPosition: userSettings ? userSettings.logoPosition : "random",
        // ロゴ位置の設定を追加
        // アウトラインカラーを追加
        outlineColor: watermarkToggle.checked ? [parseInt(redSlider.value), parseInt(greenSlider.value), parseInt(blueSlider.value)] : null,
        // メタデータオプションを追加
        // removeMetadata: userSettings ? userSettings.removeMetadata : true,
        // addFakeMetadata: userSettings ? userSettings.addFakeMetadata : true,
        // fakeMetadataType: userSettings ? userSettings.fakeMetadataType : "random",
        // addNoAIFlag: userSettings ? userSettings.addNoAIFlag : true,
        // マスタードプリセットフラグを追加
        mustardPreset: isMustardPresetActive
      };

      // マスタードプリセットが選択されている場合、ノイズタイプを上書き
      if (isMustardPresetActive) {
        options.noiseTypes = ['gaussian', 'dct', 'mustard'];
      }

      // Send to main process for processing
      const result = await ipcRenderer.invoke('process-image', options);
      if (result.success) {
        // Display processed image
        afterImage.innerHTML = '';
        const img = document.createElement('img');
        img.src = result.outputPath + '?t=' + new Date().getTime(); // Cache-busting
        afterImage.appendChild(img);

        // 処理済み画像のパスを保存
        lastProcessedImagePath = result.outputPath;

        // メタデータ表示ボタンを有効化
        // document.getElementById('viewMetadataBtn').disabled = false;
        showModal('処理完了', '画像処理が完了しました', true);
      } else {
        throw new Error(result.message || '処理に失敗しました');
      }
    } catch (error) {
      console.error('Error processing image:', error);
      showModal('Error', '処理に失敗しました: ' + error.message);
    } finally {
      processBtn.disabled = false;
      processBtn.textContent = "Infuse Malice";
    }
  });

  // Improved drag and drop file selection
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
        showModal('Error', '画像ファイルを選択してください');
        return;
      }
      try {
        // FileReaderを使用してファイルを読み込む
        const reader = new FileReader();
        reader.onload = async event => {
          try {
            // ファイルの内容を取得
            const fileBuffer = event.target.result;

            // ファイル名を取得
            const fileName = file.name;

            // ファイルデータをメインプロセスに送信
            const result = await ipcRenderer.invoke('handle-dropped-file-data', {
              fileName: fileName,
              fileData: Array.from(new Uint8Array(fileBuffer))
            });
            if (result.success) {
              handleSelectedImage(result.filePath, fileName); // オリジナルのファイル名を渡す
            } else {
              throw new Error(result.message || 'ファイルの処理に失敗しました');
            }
          } catch (error) {
            console.error('Error processing file data:', error);
            showModal('Error', `ファイルの処理に失敗しました: ${error.message}`);
          }
        };
        reader.onerror = () => {
          console.error('Error reading file');
          showModal('Error', 'ファイルの読み込みに失敗しました');
        };

        // ファイルをバイナリデータとして読み込む
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error('Error handling dropped file:', error);
        showModal('Error', `ファイルの処理に失敗しました: ${error.message}`);
      }
    }
  });

  // beforeImageエリアのクリックで画像選択ダイアログを開く
  beforeImage.addEventListener('click', async e => {
    // クリック可能範囲を全体に拡大（画像が表示されている場合も含む）

    // ここから画像選択処理（selectImageBtnのクリックハンドラと同じ処理）
    try {
      // Ask main process to open file dialog
      const result = await ipcRenderer.invoke('select-image');
      if (result.canceled || !result.filePaths.length) {
        return;
      }
      const filePath = result.filePaths[0];

      // 選択したファイルをバッファとして読み込み、D&Dと同じ処理を行う
      try {
        // ファイルを読み込む
        const fileData = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);

        // ファイルデータをメインプロセスに送信
        const processResult = await ipcRenderer.invoke('handle-dropped-file-data', {
          fileName: fileName,
          fileData: Array.from(new Uint8Array(fileData))
        });
        if (processResult.success) {
          handleSelectedImage(processResult.filePath, fileName); // オリジナルのファイル名を渡す
        } else {
          throw new Error(processResult.message || 'ファイルの処理に失敗しました');
        }
      } catch (error) {
        console.error('Error processing selected file:', error);
        showModal('Error', `ファイルの処理に失敗しました: ${error.message}`);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      showModal('Error', '画像の選択に失敗しました。もう一度お試しください。');
    }
  });

  // Helper function to handle selected image (used by both drag-drop and button selection)
  function handleSelectedImage(imagePath, origFileName = null) {
    if (!imagePath) return;
    try {
      selectedImagePath = imagePath;
      // オリジナルのファイル名を保存（グローバル変数に格納）
      originalFileName = origFileName || path.basename(imagePath);

      // Display selected image (キャッシュ回避のためのタイムスタンプを追加)
      beforeImage.innerHTML = '';
      const img = document.createElement('img');
      img.src = `${selectedImagePath}?t=${new Date().getTime()}`; // キャッシュ回避
      beforeImage.appendChild(img);

      // 出力形式の取得（userSettingsから、または未読み込みの場合はデフォルトpng）
      const outputFormat = userSettings ? userSettings.outputFormat || 'png' : 'png';

      // 元のファイル名から拡張子を除去
      const filenameWithoutExt = path.parse(originalFileName).name;

      // Update file name display with original file name and correct output format
      defaultName.textContent = originalFileName;
      outputName.textContent = `maliced-${filenameWithoutExt}.${outputFormat}`;

      // Enable process button
      processBtn.disabled = false;
      console.log('Image selected:', selectedImagePath, 'Original file name:', originalFileName, 'Output format:', outputFormat);
    } catch (error) {
      console.error('Error handling selected image:', error);
      showModal('Error', '画像の読み込みに失敗しました。別の画像を試してください。');
    }
  }

  // Add event listener to open output folder when output image is clicked
  afterImage.addEventListener('click', e => {
    if (selectedImagePath && originalFileName) {
      // 出力形式の取得（userSettingsから、または未読み込みの場合はデフォルトpng）
      const outputFormat = userSettings ? userSettings.outputFormat || 'png' : 'png';

      // 元のファイル名から拡張子を除去
      const filenameWithoutExt = path.parse(originalFileName).name;

      // 正しい出力ファイルパスを生成
      const outputFilePath = path.join(path.dirname(selectedImagePath).replace('input', 'output'), `maliced-${filenameWithoutExt}.${outputFormat}`);
      console.log('Clicking output image for file:', outputFilePath);

      // 新しいハンドラを使用してフォルダを開く
      ipcRenderer.invoke('open-output-folder', outputFilePath);
    }
  });

  // 設定モーダル関連の要素
  const settingsModalOverlay = document.getElementById('settingsModalOverlay');
  const settingsModalCloseBtn = document.getElementById('settingsModalCloseBtn');
  const settingsSaveBtn = document.getElementById('settingsSaveBtn');
  const settingsCancelBtn = document.getElementById('settingsCancelBtn');

  // 設定ボタンのイベントリスナー（サイドメニューの設定ボタン）
  const settingsButtons = document.querySelectorAll('.menu-btn');
  settingsButtons[1].addEventListener('click', () => {
    openSettingsModal();
  });

  // 設定モーダルを開く
  async function openSettingsModal() {
    // 現在の設定を読み込む
    if (!userSettings) {
      await loadSettings();
    }

    // 設定モーダルのフォーム要素に現在の設定値を設定
    document.querySelector(`input[name="logoPosition"][value="${userSettings.logoPosition}"]`).checked = true;

    // モーダルを表示
    settingsModalOverlay.classList.add('show');
  }

  // 設定モーダルを閉じる
  function closeSettingsModal() {
    settingsModalOverlay.classList.remove('show');
  }

  // 設定を保存する
  async function saveSettings() {
    try {
      // フォームから設定値を取得
      const logoPosition = document.querySelector('input[name="logoPosition"]:checked').value;

      // ノイズタイプの選択肢を取得（複数選択可能）
      const noiseTypesElements = document.querySelectorAll('input[name="noiseTypes"]:checked');
      const noiseTypes = Array.from(noiseTypesElements).map(el => el.value);

      // メタデータ設定を取得
      // const removeMetadata = document.getElementById('removeMetadata').checked;
      // const addFakeMetadata = document.getElementById('addFakeMetadata').checked;
      // const fakeMetadataType = document.getElementById('fakeMetadataType').value;
      // const addNoAIFlag = document.getElementById('addNoAIFlag').checked;

      // 出力形式の設定を取得
      const outputFormat = document.querySelector('input[name="outputFormat"]:checked').value;

      // 他の設定値も保持（UIの現在の状態から）
      const settings = {
        logoPosition,
        noiseLevel: noiseSlider.value,
        watermarkEnabled: watermarkToggle.checked,
        watermarkPath: watermarkSelect.value,
        invertWatermark: invertWatermarkToggle.checked,
        enableOutline: enableOutlineToggle.checked,
        watermarkSize: watermarkSize.value,
        watermarkOpacity: watermarkOpacity.value,
        resize: document.querySelector('input[name="resize"]:checked').value,
        noiseTypes: noiseTypes,
        // アウトラインの色設定を追加
        outlineColor: {
          r: parseInt(redSlider.value),
          g: parseInt(greenSlider.value),
          b: parseInt(blueSlider.value)
        },
        // メタデータ設定を追加
        // removeMetadata: removeMetadata,
        // addFakeMetadata: addFakeMetadata,
        // fakeMetadataType: fakeMetadataType,
        // addNoAIFlag: addNoAIFlag,
        // 出力形式設定を追加
        outputFormat: outputFormat
      };

      // 設定を保存
      const result = await ipcRenderer.invoke('save-settings', settings);
      if (result.success) {
        // 保存成功後に設定をユーザー設定変数に反映
        userSettings = settings;

        // 画像が選択されている場合は、出力ファイル名表示も更新
        if (selectedImagePath && originalFileName) {
          const filenameWithoutExt = path.parse(originalFileName).name;
          outputName.textContent = `maliced-${filenameWithoutExt}.${outputFormat}`;
        }
        showModal('設定', '設定を保存しました');
        closeSettingsModal();
      } else {
        throw new Error(result.message || '設定の保存に失敗しました');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      showModal('Error', `設定の保存に失敗しました: ${error.message}`);
    }
  }

  // 設定を読み込む
  async function loadSettings() {
    try {
      const result = await ipcRenderer.invoke('load-settings');
      if (result.success) {
        userSettings = result.settings;

        // UIに設定を反映
        noiseSlider.value = userSettings.noiseLevel;
        // ノイズレベルのテキスト表示を更新
        updateNoiseLevelText(noiseSlider.value);
        watermarkToggle.checked = userSettings.watermarkEnabled;
        watermarkSelect.disabled = !userSettings.watermarkEnabled;
        invertWatermarkToggle.checked = userSettings.invertWatermark;
        invertWatermarkToggle.disabled = !userSettings.watermarkEnabled;

        // 新しい設定値をUIに反映
        if ('enableOutline' in userSettings) {
          enableOutlineToggle.checked = userSettings.enableOutline;
        }
        enableOutlineToggle.disabled = !userSettings.watermarkEnabled;
        if ('watermarkSize' in userSettings) {
          watermarkSize.value = userSettings.watermarkSize;
          sizeValue.textContent = `${userSettings.watermarkSize}%`;
        }
        watermarkSize.disabled = !userSettings.watermarkEnabled;
        watermarkOpacity.value = userSettings.watermarkOpacity;
        opacityValue.textContent = `${userSettings.watermarkOpacity}%`;
        watermarkOpacity.disabled = !userSettings.watermarkEnabled;
        document.querySelector(`input[name="resize"][value="${userSettings.resize}"]`).checked = true;

        // メタデータ設定の反映
        // if ('removeMetadata' in userSettings) {
        //   document.getElementById('removeMetadata').checked = userSettings.removeMetadata;
        // }
        // if ('addFakeMetadata' in userSettings) {
        //   document.getElementById('addFakeMetadata').checked = userSettings.addFakeMetadata;
        // }
        // if ('fakeMetadataType' in userSettings) {
        //   document.getElementById('fakeMetadataType').value = userSettings.fakeMetadataType;
        // }
        // if ('addNoAIFlag' in userSettings) {
        //   document.getElementById('addNoAIFlag').checked = userSettings.addNoAIFlag;
        // }

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
        } else {
          // デフォルト値（ガウシアンノイズとDCTノイズ）をチェック
          const defaultNoiseTypes = ['gaussian', 'dct'];
          defaultNoiseTypes.forEach(type => {
            const checkbox = document.querySelector(`input[name="noiseTypes"][value="${type}"]`);
            if (checkbox) {
              checkbox.checked = true;
            }
          });

          // デフォルト値を設定オブジェクトに追加
          userSettings.noiseTypes = defaultNoiseTypes;
        }

        // アウトラインの色設定を反映（設定が存在する場合）
        if (userSettings.outlineColor) {
          redSlider.value = userSettings.outlineColor.r || 255;
          greenSlider.value = userSettings.outlineColor.g || 255;
          blueSlider.value = userSettings.outlineColor.b || 255;
          // 色プレビューを更新
          colorPreview.style.backgroundColor = `rgb(${redSlider.value}, ${greenSlider.value}, ${blueSlider.value})`;
          redValue.textContent = redSlider.value;
          greenValue.textContent = greenSlider.value;
          blueValue.textContent = blueSlider.value;
        }

        // ウォーターマークが無効な場合はアウトライン色コントロールも無効化
        if (!userSettings.watermarkEnabled) {
          outlineColorControls.style.opacity = '0.5';
          outlineColorControls.style.pointerEvents = 'none';
        }
        console.log('Settings loaded:', userSettings);
      } else {
        console.warn('Failed to load settings, using defaults');
        userSettings = result.settings; // エラー時もデフォルト設定は返される

        // ノイズレベルのテキスト表示を更新
        updateNoiseLevelText(noiseSlider.value);

        // デフォルトのノイズタイプを設定
        if (!userSettings.noiseTypes) {
          userSettings.noiseTypes = ['gaussian', 'dct'];
        }

        // ノイズタイプのデフォルト値をUI要素に反映
        const defaultNoiseTypes = ['gaussian', 'dct'];
        defaultNoiseTypes.forEach(type => {
          const checkbox = document.querySelector(`input[name="noiseTypes"][value="${type}"]`);
          if (checkbox) {
            checkbox.checked = true;
          }
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // デフォルト設定を使用
      userSettings = {
        logoPosition: 'random',
        noiseLevel: 3,
        // 8段階スライダーに合わせて初期値を修正
        watermarkEnabled: false,
        watermarkPath: 'no_ai',
        invertWatermark: false,
        watermarkOpacity: 60,
        resize: 'default',
        noiseTypes: ['gaussian', 'dct'],
        // メタデータのデフォルト設定
        // removeMetadata: true,
        // addFakeMetadata: true,
        // fakeMetadataType: 'random',
        // addNoAIFlag: true
      };

      // スライダー値とテキスト表示を更新
      noiseSlider.value = userSettings.noiseLevel;
      updateNoiseLevelText(userSettings.noiseLevel);

      // ノイズタイプのデフォルト値をUI要素に反映
      const defaultNoiseTypes = ['gaussian', 'dct'];
      defaultNoiseTypes.forEach(type => {
        const checkbox = document.querySelector(`input[name="noiseTypes"][value="${type}"]`);
        if (checkbox) {
          checkbox.checked = true;
        }
      });
    }

    // loadWatermarkOptions().then(() => {
    //   console.log('Settings and watermark options loaded');
    // }).catch(err => {
    //   console.error('Error loading watermark options:', err);
    // });
  }

  // ウォーターマークの選択肢を読み込む
  async function loadWatermarkOptions() {
    try {
      watermarkSelect.innerHTML = '';
      // get-watermarks経由で一覧取得
      const result = await ipcRenderer.invoke('get-watermarks');
      if (result.success && result.watermarks && result.watermarks.length > 0) {
        result.watermarks.forEach(watermark => {
          const option = document.createElement('option');
          option.value = watermark.value; // ファイル名（拡張子なし）
          option.textContent = watermark.displayName;
          watermarkSelect.appendChild(option);
        });
      } else {
        // デフォルト値
        const fallbackOption = document.createElement('option');
        fallbackOption.value = 'no_ai';
        fallbackOption.textContent = 'No AI';
        watermarkSelect.appendChild(fallbackOption);
      }
    } catch (error) {
      console.error('Error loading watermark options:', error);
    }
  }

  // Function to load logos from both default and user_data directories
  async function loadLogoOptions() {
    try {
      const logoSelect = document.getElementById('logoSelect');
      if (!logoSelect) {
        console.warn('Logo select element not found');
        return;
      }
      logoSelect.innerHTML = '';
      const logoDirs = [path.join(__dirname, '../logo'), path.join(__dirname, '../../../user_data/logo')];
      const logoFiles = logoDirs.flatMap(dir => {
        if (fs.existsSync(dir)) {
          return fs.readdirSync(dir).map(file => path.join(dir, file));
        }
        return [];
      });
      logoFiles.forEach(filePath => {
        const fileName = path.basename(filePath, path.extname(filePath)).replace(/_/g, ' ');
        const option = document.createElement('option');
        option.value = filePath;
        option.textContent = fileName;
        logoSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error loading logo options:', error);
    }
  }

  // 設定モーダルのボタンにイベントリスナーを追加
  settingsModalCloseBtn.addEventListener('click', closeSettingsModal);
  settingsCancelBtn.addEventListener('click', closeSettingsModal);
  settingsSaveBtn.addEventListener('click', saveSettings);

  // 起動時に1回だけ呼ぶ
  loadSettings().then(() => {
    loadWatermarkOptions().then(() => {
      // 設定ファイルのwatermarkPath（拡張子なしファイル名）を初期選択
      if (userSettings && userSettings.watermarkPath) {
        const exists = Array.from(watermarkSelect.options).some(opt => opt.value === userSettings.watermarkPath);
        if (exists) {
          watermarkSelect.value = userSettings.watermarkPath;
        }
      }
      console.log('Settings and watermark options loaded');
    }).catch(err => {
      console.error('Error loading watermark options:', err);
    });
    loadLogoOptions();
  }).catch(err => {
    console.error('Error loading settings:', err);
  });

  // メタデータ表示ボタンの要素を取得
  const viewMetadataBtn = document.getElementById('viewMetadataBtn');

  // メタデータ表示ボタンのクリックイベント
  // viewMetadataBtn.addEventListener('click', async () => {
  //   if (lastProcessedImagePath) {
  //     try {
  //       // メタデータを取得して表示
  //       await displayMetadata(lastProcessedImagePath);
  //     } catch (error) {
  //       console.error('Error displaying metadata:', error);
  //       showModal('Error', 'メタデータの表示に失敗しました: ' + error.message);
  //     }
  //   }
  // });

  // メタデータを表示する関数
  // async function displayMetadata(imagePath) {
  //   try {
  //     // メタデータを読み込み中であることを表示
  //     showModal('メタデータを読み込み中...', 'しばらくお待ちください...');
  //
  //     // メタデータを取得
  //     const result = await ipcRenderer.invoke('get-image-metadata', imagePath);
  //     if (result.success) {
  //       // メタデータ表示用のHTMLを生成
  //       let metadataContent = '<div class="metadata-display">';
  //       if (!result.metadata || Object.keys(result.metadata).length === 0) {
  //         metadataContent += '<p>画像にメタデータが含まれていません</p>';
  //       } else {
  //         metadataContent += '<h4>画像メタデータ</h4>';
  //         metadataContent += '<table class="metadata-table">';
  //
  //         // メタデータのカテゴリごとに表示
  //         for (const [category, items] of Object.entries(result.metadata)) {
  //           metadataContent += `<tr><th colspan="2" class="category-header">${category}</th></tr>`;
  //
  //           // エラーの場合は特別処理
  //           if (category === 'Error') {
  //             metadataContent += `<tr><td>メッセージ</td><td>${items}</td></tr>`;
  //             continue;
  //           }
  //
  //           // カテゴリ内の項目を表示（オブジェクトであることを確認）
  //           if (typeof items === 'object' && items !== null) {
  //             for (const [key, value] of Object.entries(items)) {
  //               metadataContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
  //             }
  //           } else {
  //             // オブジェクトでない場合は単純な値として表示
  //             metadataContent += `<tr><td>${category}</td><td>${items}</td></tr>`;
  //           }
  //         }
  //         metadataContent += '</table>';
  //       }
  //       metadataContent += '</div>';
  //
  //       // モーダルを更新して表示
  //       modalTitle.textContent = 'メタデータ情報';
  //       modalMessage.innerHTML = metadataContent;
  //       modalOverlay.classList.add('show');
  //     } else {
  //       throw new Error(result.message || 'メタデータの取得に失敗しました');
  //     }
  //   } catch (error) {
  //     console.error('Error displaying metadata:', error);
  //     showModal('Error', `メタデータの表示に失敗しました: ${error.message}`);
  //   }
  // }

  const colorCodeInput = document.getElementById('colorCodeInput');

  // アウトライン色選択のイベントハンドラを拡張
  function updateColorPreview(updateCodeInput = true, updateNumberInputs = true) {
    const r = parseInt(redSlider.value);
    const g = parseInt(greenSlider.value);
    const b = parseInt(blueSlider.value);
    colorPreview.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    if (updateNumberInputs) {
      redValue.value = r;
      greenValue.value = g;
      blueValue.value = b;
    }
    if (updateCodeInput) {
      colorCodeInput.value = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0');
    }
  }

  // スライダー → 数値input連動
  redSlider.addEventListener('input', () => {
    updateColorPreview(true, true);
  });
  greenSlider.addEventListener('input', () => {
    updateColorPreview(true, true);
  });
  blueSlider.addEventListener('input', () => {
    updateColorPreview(true, true);
  });

  // 数値input → スライダー連動
  redValue.addEventListener('input', () => {
    let v = Math.max(0, Math.min(255, parseInt(redValue.value) || 0));
    redSlider.value = v;
    updateColorPreview(true, false);
  });
  greenValue.addEventListener('input', () => {
    let v = Math.max(0, Math.min(255, parseInt(greenValue.value) || 0));
    greenSlider.value = v;
    updateColorPreview(true, false);
  });
  blueValue.addEventListener('input', () => {
    let v = Math.max(0, Math.min(255, parseInt(blueValue.value) || 0));
    blueSlider.value = v;
    updateColorPreview(true, false);
  });

  // カラーコードinput → スライダー・数値input連動
  colorCodeInput.addEventListener('input', () => {
    let code = colorCodeInput.value.replace(/[^0-9a-fA-F]/g, '').padStart(6, '0').slice(0, 6);
    if (code.length === 6) {
      const r = parseInt(code.slice(0, 2), 16);
      const g = parseInt(code.slice(2, 4), 16);
      const b = parseInt(code.slice(4, 6), 16);
      redSlider.value = r;
      greenSlider.value = g;
      blueSlider.value = b;
      updateColorPreview(false, true);
    }
  });

  // 初期カラープレビューの更新
  updateColorPreview();

  // 設定モーダルのアコーディオン処理
  document.querySelectorAll('.settings-section').forEach(section => {
    const h4 = section.querySelector('h4');
    if (h4) {
      h4.addEventListener('click', () => {
        section.classList.toggle('open');
      });
    }
  });
});

// Add metadata display functionality
// async function displayImageMetadata(imagePath) {
//   try {
//     // Call main process to extract metadata
//     const result = await ipcRenderer.invoke('get-image-metadata', imagePath);
//     if (result.success) {
//       // Prepare metadata display content
//       let metadataContent = '<div class="metadata-display">';
//       if (Object.keys(result.metadata).length === 0) {
//         metadataContent += '<p>画像にメタデータが含まれていません</p>';
//       } else {
//         metadataContent += '<h4>画像メタデータ</h4>';
//         metadataContent += '<table class="metadata-table">';
//
//         // Display each metadata category
//         for (const [category, items] of Object.entries(result.metadata)) {
//           metadataContent += `<tr><th colspan="2" class="category-header">${category}</th></tr>`;
//
//           // Display items in this category
//           for (const [key, value] of Object.entries(items)) {
//             metadataContent += `<tr><td>${key}</td><td>${value}</td></tr>`;
//           }
//         }
//         metadataContent += '</table>';
//       }
//       metadataContent += '</div>';
//
//       // Show metadata in modal
//       modalTitle.textContent = 'メタデータ情報';
//       modalMessage.innerHTML = metadataContent;
//       modalOverlay.classList.add('show');
//     } else {
//       throw new Error(result.message || 'メタデータの取得に失敗しました');
//     }
//   } catch (error) {
//     console.error('Error displaying metadata:', error);
//     showModal('Error', `メタデータの表示に失敗しました: ${error.message}`);
//   }
// }