/**
 * モーダルUIモジュール - 通知とメタデータ表示を管理
 */
const path = require('path');
const ipcBridge = require(path.join(__dirname, '../utils/ipcBridge'));
const fileHandler = require(path.join(__dirname, '../utils/fileHandler'));

// 処理済み画像パスの保持
let lastProcessedImagePath = null;

/**
 * モーダルを表示する
 * @param {string} title - モーダルのタイトル
 * @param {string} message - 表示するメッセージ
 * @param {boolean} showOpenButton - フォルダを開くボタンを表示するかどうか
 * @param {string} filePath - 対象ファイルのパス（フォルダを開く用）
 */
const showModal = (title, message, showOpenButton = false, filePath = null) => {
    const modal = document.getElementById('modal');
    if (!modal) {
        console.error('Modal element not found');
        return; // Exit the function if modal element is not found
    }
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalOpenBtn = document.getElementById('modalOpenBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    if (showOpenButton && filePath) {
        modalOpenBtn.style.display = 'inline-block';
        modalOpenBtn.onclick = () => {
            require('electron').shell.showItemInFolder(filePath);
            closeModal();
        };
    } else {
        modalOpenBtn.style.display = 'none';
    }

    modalCloseBtn.onclick = closeModal;
    modal.classList.add('show');

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeModal();
        }
    }, { once: true });
};

/**
 * ESCキーのイベントハンドラ
 * @param {KeyboardEvent} event - キーボードイベント
 */
const handleEscKey = (event) => {
    if (event.key === 'Escape') {
        closeModal();
    }
};

/**
 * モーダルを閉じる
 */
const closeModal = () => {
    const modal = document.getElementById('modal');
    modal.classList.remove('show');
};

/**
 * メタデータを表示する
 * @param {string} imagePath - メタデータを表示する画像のパス
 */
const displayMetadata = async (imagePath) => {
    try {
        // メタデータ表示用のモーダル要素
        const metadataModal = document.getElementById('metadataModal');
        const metadataCloseBtn = document.getElementById('metadataCloseBtn');
        const metadataContent = document.getElementById('metadataContent');
        
        // メタデータを取得
        const result = await ipcBridge.getImageMetadata(imagePath);
        
        if (result.success && result.metadata) {
            // メタデータをJSON形式で表示
            metadataContent.innerHTML = '';
            
            // メタデータが存在する場合
            if (Object.keys(result.metadata).length > 0) {
                // メタデータを整形して表示
                const formatter = new JSONFormatter(result.metadata, 2, {
                    hoverPreviewEnabled: true,
                    hoverPreviewArrayCount: 100,
                    hoverPreviewFieldCount: 5,
                    theme: 'dark',
                    animateOpen: true,
                    animateClose: true
                });
                
                metadataContent.appendChild(formatter.render());
            } else {
                // メタデータが存在しない場合
                metadataContent.textContent = 'メタデータは存在しません';
            }
            
            // モーダルを表示
            metadataModal.classList.add('show');
            
            // 閉じるボタンのイベントハンドラ
            metadataCloseBtn.onclick = () => {
                metadataModal.classList.remove('show');
            };
            
            // ESCキーでモーダルを閉じる
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    metadataModal.classList.remove('show');
                }
            }, { once: true });
        } else {
            throw new Error(result.message || 'メタデータの取得に失敗しました');
        }
    } catch (error) {
        console.error('Error displaying metadata:', error);
        showModal('エラー', `メタデータの表示に失敗しました: ${error.message}`);
    }
};

/**
 * 処理済み画像のパスを設定する
 * @param {string} path - 処理済み画像のパス
 */
const setProcessedImagePath = (path) => {
    lastProcessedImagePath = path;
};

const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalDetailsContainer = document.getElementById('modalDetailsContainer');
const showDetailsBtn = document.getElementById('showDetailsBtn');
const modalDetails = document.getElementById('modalDetails');

function toggleDetails() {
    showDetailsBtn.classList.toggle('active');
    modalDetails.style.display = modalDetails.style.display === 'block' ? 'none' : 'block';
}

module.exports = {
    showModal,
    displayMetadata,
    setProcessedImagePath,
    lastProcessedImagePath,
    closeModal,
    toggleDetails
};