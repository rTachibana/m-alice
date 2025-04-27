// Require electron components using contextBridge
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

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
    const noiseSlider = document.getElementById('noiseSlider');
    const watermarkOpacity = document.getElementById('watermarkOpacity');
    const opacityValue = document.getElementById('opacityValue');
    
    // モーダル関連の要素
    const modalOverlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalOkBtn = document.getElementById('modalOkBtn');

    // モーダル表示関数
    function showModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalOverlay.classList.add('show');
    }
    
    // モーダルを閉じる関数
    function closeModal() {
        modalOverlay.classList.remove('show');
    }
    
    // モーダルのクローズボタンとOKボタンにイベントリスナーを追加
    modalCloseBtn.addEventListener('click', closeModal);
    modalOkBtn.addEventListener('click', closeModal);

    // Enable/disable watermark selection based on toggle
    watermarkToggle.addEventListener('change', () => {
        watermarkSelect.disabled = !watermarkToggle.checked;
        invertWatermarkToggle.disabled = !watermarkToggle.checked;
    });

    // Update opacity value display
    watermarkOpacity.addEventListener('input', () => {
        opacityValue.textContent = `${watermarkOpacity.value}%`;
    });

    // Process button click handler
    processBtn.addEventListener('click', async () => {
        if (!selectedImagePath) {
            return;
        }

        try {
            // Show processing indication
            processBtn.disabled = true;
            processBtn.textContent = '処理中...';
            
            // Collect processing options
            const options = {
                imagePath: selectedImagePath,
                originalFileName: originalFileName, // オリジナルのファイル名を追加
                noiseLevel: noiseSlider.value,
                applyWatermark: watermarkToggle.checked,
                watermarkType: watermarkToggle.checked ? watermarkSelect.value : null,
                invertWatermark: watermarkToggle.checked && invertWatermarkToggle.checked,
                resize: document.querySelector('input[name="resize"]:checked').value,
                watermarkOpacity: Math.max(0.1, watermarkOpacity.value / 100), // 最小値を0.1に制限
                logoPosition: userSettings ? userSettings.logoPosition : 'random' // ロゴ位置の設定を追加
            };
            
            // Send to main process for processing
            const result = await ipcRenderer.invoke('process-image', options);
            
            if (result.success) {
                // Display processed image
                afterImage.innerHTML = '';
                const img = document.createElement('img');
                img.src = result.outputPath + '?t=' + new Date().getTime(); // Cache-busting
                afterImage.appendChild(img);
                
                showModal('処理完了', '画像処理が完了しました');
            } else {
                throw new Error(result.message || '処理に失敗しました');
            }
        } catch (error) {
            console.error('Error processing image:', error);
            showModal('エラー', `処理に失敗しました: ${error.message}`);
        } finally {
            processBtn.disabled = false;
            processBtn.textContent = "Infuse Malice";
        }
    });

    // Improved drag and drop file selection
    beforeImage.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        beforeImage.classList.add('drag-over');
    });
    
    beforeImage.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        beforeImage.classList.remove('drag-over');
    });
    
    beforeImage.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        beforeImage.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            
            // ファイルがイメージかどうか確認
            if (!file.type.startsWith('image/')) {
                showModal('エラー', '画像ファイルを選択してください');
                return;
            }
            
            try {
                // FileReaderを使用してファイルを読み込む
                const reader = new FileReader();
                
                reader.onload = async (event) => {
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
                        showModal('エラー', `ファイルの処理に失敗しました: ${error.message}`);
                    }
                };
                
                reader.onerror = () => {
                    console.error('Error reading file');
                    showModal('エラー', 'ファイルの読み込みに失敗しました');
                };
                
                // ファイルをバイナリデータとして読み込む
                reader.readAsArrayBuffer(file);
            } catch (error) {
                console.error('Error handling dropped file:', error);
                showModal('エラー', `ファイルの処理に失敗しました: ${error.message}`);
            }
        }
    });
    
    // beforeImageエリアのクリックで画像選択ダイアログを開く
    beforeImage.addEventListener('click', async (e) => {
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
                showModal('エラー', `ファイルの処理に失敗しました: ${error.message}`);
            }
        } catch (error) {
            console.error('Error selecting image:', error);
            showModal('エラー', '画像の選択に失敗しました。もう一度お試しください。');
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
            
            // Update file name display with original file name
            defaultName.textContent = originalFileName;
            outputName.textContent = `maliced-${originalFileName}`;
            
            // Enable process button
            processBtn.disabled = false;
            
            console.log('Image selected:', selectedImagePath, 'Original file name:', originalFileName);
        } catch (error) {
            console.error('Error handling selected image:', error);
            showModal('エラー', '画像の読み込みに失敗しました。別の画像を試してください。');
        }
    }

    // Add event listener to open output folder when output image is clicked
    afterImage.addEventListener('click', () => {
        if (selectedImagePath && originalFileName) {
            const outputFilePath = path.join(
                path.dirname(selectedImagePath).replace('input', 'output'),
                `maliced-${originalFileName}`
            );
            console.log('Opening output folder for file:', outputFilePath);
            ipcRenderer.invoke('show-item-in-folder', outputFilePath);
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
            
            // 他の設定値も保持（UIの現在の状態から）
            const settings = {
                logoPosition,
                noiseLevel: noiseSlider.value,
                watermarkEnabled: watermarkToggle.checked,
                watermarkType: watermarkSelect.value,
                invertWatermark: invertWatermarkToggle.checked,
                watermarkOpacity: watermarkOpacity.value,
                resize: document.querySelector('input[name="resize"]:checked').value
            };
            
            // 設定を保存
            const result = await ipcRenderer.invoke('save-settings', settings);
            
            if (result.success) {
                userSettings = settings;
                showModal('設定', '設定を保存しました');
                closeSettingsModal();
            } else {
                throw new Error(result.message || '設定の保存に失敗しました');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showModal('エラー', `設定の保存に失敗しました: ${error.message}`);
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
                watermarkToggle.checked = userSettings.watermarkEnabled;
                watermarkSelect.disabled = !userSettings.watermarkEnabled;
                invertWatermarkToggle.checked = userSettings.invertWatermark;
                invertWatermarkToggle.disabled = !userSettings.watermarkEnabled;
                watermarkOpacity.value = userSettings.watermarkOpacity;
                opacityValue.textContent = `${userSettings.watermarkOpacity}%`;
                document.querySelector(`input[name="resize"][value="${userSettings.resize}"]`).checked = true;
                
                console.log('Settings loaded:', userSettings);
            } else {
                console.warn('Failed to load settings, using defaults');
                userSettings = result.settings; // エラー時もデフォルト設定は返される
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            // デフォルト設定を使用
            userSettings = {
                logoPosition: 'random',
                noiseLevel: 50,
                watermarkEnabled: false,
                watermarkType: 'no_ai',
                invertWatermark: false,
                watermarkOpacity: 60,
                resize: 'default'
            };
        }
    }
    
    // ウォーターマークの選択肢を読み込む
    async function loadWatermarkOptions() {
        try {
            // セレクトボックスをクリア
            watermarkSelect.innerHTML = '';
            
            // ウォーターマーク一覧を取得
            const result = await ipcRenderer.invoke('get-watermarks');
            
            if (result.success && result.watermarks && result.watermarks.length > 0) {
                // 選択肢を追加
                result.watermarks.forEach(watermark => {
                    const option = document.createElement('option');
                    option.value = watermark.value;
                    option.textContent = watermark.displayName;
                    watermarkSelect.appendChild(option);
                });
                
                // 設定に保存されていた値があれば選択
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
    }
    
    // 設定モーダルのボタンにイベントリスナーを追加
    settingsModalCloseBtn.addEventListener('click', closeSettingsModal);
    settingsCancelBtn.addEventListener('click', closeSettingsModal);
    settingsSaveBtn.addEventListener('click', saveSettings);
    
    // 起動時に設定とウォーターマークの選択肢を読み込む
    loadSettings().then(() => {
        loadWatermarkOptions().then(() => {
            console.log('Settings and watermark options loaded');
        }).catch(err => {
            console.error('Error loading watermark options:', err);
        });
    }).catch(err => {
        console.error('Error loading settings:', err);
    });
});