// Require electron components using contextBridge
const { ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

// Global variables
let selectedImagePath = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    const beforeImage = document.getElementById('beforeImage');
    const afterImage = document.getElementById('afterImage');
    const defaultName = document.getElementById('defaultName');
    const outputName = document.getElementById('outputName');
    const selectImageBtn = document.getElementById('selectImageBtn');
    const processBtn = document.getElementById('processBtn');
    const watermarkToggle = document.getElementById('watermarkToggle');
    const watermarkSelect = document.getElementById('watermarkSelect');
    const noiseSlider = document.getElementById('noiseSlider');
    
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

    // File selection button click handler - updated to use same buffer method as drag & drop
    selectImageBtn.addEventListener('click', async () => {
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
                    handleSelectedImage(processResult.filePath);
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

    // Enable/disable watermark selection based on toggle
    watermarkToggle.addEventListener('change', () => {
        watermarkSelect.disabled = !watermarkToggle.checked;
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
                noiseLevel: noiseSlider.value,
                applyWatermark: watermarkToggle.checked,
                watermarkType: watermarkToggle.checked ? watermarkSelect.value : null,
                resize: document.querySelector('input[name="resize"]:checked').value
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
            processBtn.textContent = '処理開始';
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
                            handleSelectedImage(result.filePath);
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
    
    // Helper function to handle selected image (used by both drag-drop and button selection)
    function handleSelectedImage(imagePath, originalFileName = null) {
        if (!imagePath) return;
        
        try {
            selectedImagePath = imagePath;
            // オリジナルのファイル名を優先して使用する
            const fileName = originalFileName || path.basename(selectedImagePath);
            
            // Display selected image (キャッシュ回避のためのタイムスタンプを追加)
            beforeImage.innerHTML = '';
            const img = document.createElement('img');
            img.src = `${selectedImagePath}?t=${new Date().getTime()}`; // キャッシュ回避
            beforeImage.appendChild(img);
            
            // Update file name display with original file name
            defaultName.textContent = fileName;
            outputName.textContent = `maliced-${fileName}`;
            
            // Enable process button
            processBtn.disabled = false;
            
            console.log('Image selected:', selectedImagePath, 'Original file name:', fileName);
        } catch (error) {
            console.error('Error handling selected image:', error);
            showModal('エラー', '画像の読み込みに失敗しました。別の画像を試してください。');
        }
    }
});