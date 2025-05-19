"use strict";

/**
 * モーダルUIモジュール - 通知とメタデータ表示を管理
 */
const path = require('path');
const {
  ipcRenderer
} = require('electron');
const ipcBridge = require(path.join(__dirname, '../utils/ipcBridge'));
const fileHandler = require(path.join(__dirname, '../utils/fileHandler'));
const metadata = require(path.join(__dirname, '../services/metadata'));
const {
  showMetadataToggle
} = require('./metadataToggle');

// 処理済み画像パスの保持
let lastProcessedImagePath = null;

/**
 * モーダルを表示する
 * @param {string} title - モーダルのタイトル
 * @param {string} message - 表示するメッセージ
 * @param {boolean} showOpenButton - フォルダを開くボタンを表示するかどうか
 * @param {string} filePath - 対象ファイルのパス（フォルダを開く用）
 * @param {string} imagePath - メタデータを表示する画像のパス
 * @param {boolean} showOkBtn - OKボタンを表示するかどうか
 */
const showModal = (title, message, showOpenButton = false, filePath = null, imagePath = null, showOkBtn = true) => {
  if (!modalOverlay) {
    console.error('Modal element not found');
    return;
  }
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  // フッター
  const footer = modalOverlay.querySelector('.modal-footer');
  footer.innerHTML = '';
  // OKボタン（showOkBtnがtrueのときのみ）
  if (showOkBtn) {
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.className = 'modal-btn modal-ok-btn';
    okBtn.onclick = closeModal;
    footer.appendChild(okBtn);
  }
  // メタデータトグル（imagePathがあれば）
  if (imagePath) {
    const [metaLabel, metaBox] = showMetadataToggle(imagePath);
    footer.appendChild(metaLabel);
    footer.appendChild(metaBox);
  }
  modalCloseBtn.onclick = closeModal;
  modalOverlay.classList.add('show');
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
    }
  }, {
    once: true
  });
};

/**
 * ESCキーのイベントハンドラ
 * @param {KeyboardEvent} event - キーボードイベント
 */
const handleEscKey = event => {
  if (event.key === 'Escape') {
    closeModal();
  }
};

/**
 * モーダルを閉じる
 */
const closeModal = () => {
  if (modalOverlay) modalOverlay.classList.remove('show');
};

/**
 * メタデータを表示する
 * @param {string} imagePath - メタデータを表示する画像のパス
 */
const displayMetadata = async imagePath => {
  try {
    // メタデータ表示用のモーダル要素
    const metadataModal = document.getElementById('metadataModal');
    const metadataCloseBtn = document.getElementById('metadataCloseBtn');
    const metadataContent = document.getElementById('metadataContent');

    // メタデータを取得
    const result = await ipcBridge.getImageMetadata(imagePath);
    if (result.success && result.text) {
      // 整形済みテキストを<pre>で表示
      metadataContent.innerHTML = '';
      const pre = document.createElement('pre');
      pre.textContent = result.text;
      metadataContent.appendChild(pre);
    } else {
      metadataContent.textContent = result.message || 'メタデータは存在しません';
    }

    // モーダルを表示
    metadataModal.classList.add('show');

    // 閉じるボタンのイベントハンドラ
    metadataCloseBtn.onclick = () => {
      metadataModal.classList.remove('show');
    };

    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        metadataModal.classList.remove('show');
      }
    }, {
      once: true
    });
  } catch (error) {
    console.error('Error displaying metadata:', error);
    showModal('エラー', `メタデータの表示に失敗しました: ${error.message}`);
  }
};

/**
 * 画像のメタデータを表示する
 * @param {string} imagePath - メタデータを表示する画像のパス
 */
const displayImageMetadata = async imagePath => {
  try {
    // メインプロセスにメタデータの抽出を依頼
    const result = await ipcRenderer.invoke('get-image-metadata', imagePath);
    if (result.success) {
      // メタデータモーダルの要素
      const modalDetails = document.getElementById('modalDetails');
      modalDetails.innerHTML = '';

      // メタデータが存在する場合
      if (Object.keys(result.metadata).length > 0) {
        // メタデータからAI生成の可能性を判定
        const aiDetectionResult = metadata.detectAIGeneration(result.metadata);

        // AI検出結果を表示
        const aiDetectionElement = document.createElement('div');
        aiDetectionElement.className = 'ai-detection';
        aiDetectionElement.innerHTML = `
          <h3>AI生成検出結果</h3>
          <p>判定: ${aiDetectionResult.isAIGenerated ? '❌ AIによる生成の可能性あり' : '✅ AIの痕跡なし'}</p>
          <p>信頼度: ${aiDetectionResult.confidence}%</p>
          <p>理由: ${aiDetectionResult.reason}</p>
        `;
        modalDetails.appendChild(aiDetectionElement);

        // メタデータを整形して表示
        const metadataTitle = document.createElement('h3');
        metadataTitle.textContent = 'メタデータ詳細';
        modalDetails.appendChild(metadataTitle);
        const formatter = new JSONFormatter(result.metadata, 2, {
          hoverPreviewEnabled: true,
          hoverPreviewArrayCount: 100,
          hoverPreviewFieldCount: 5,
          theme: 'dark',
          animateOpen: true,
          animateClose: true
        });
        modalDetails.appendChild(formatter.render());
      } else {
        // メタデータが存在しない場合
        modalDetails.textContent = 'メタデータは存在しません';
      }

      // モーダル詳細を表示
      modalDetails.style.display = 'block';
    } else {
      throw new Error(result.message || 'メタデータの取得に失敗しました');
    }
  } catch (error) {
    console.error('Error displaying metadata:', error);
    showModal('Error', `メタデータの表示に失敗しました: ${error.message}`);
  }
};

/**
 * 処理済み画像のパスを設定する
 * @param {string} path - 処理済み画像のパス
 */
const setProcessedImagePath = path => {
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

/**
 * 詳細表示ボタンのイベントリスナーを設定
 * @param {HTMLElement} button - 詳細表示ボタン要素
 * @param {HTMLElement} detailsElement - 詳細を表示する要素
 * @param {string} imagePath - メタデータを表示する画像のパス
 */
const setupDetailsButton = (button, detailsElement, imagePath) => {
  if (!button || !detailsElement) return;
  button.addEventListener('click', async () => {
    // ボタンの状態を切り替え
    button.classList.toggle('active');

    // 詳細エリアの表示状態を切り替え
    if (detailsElement.style.display !== 'block') {
      detailsElement.style.display = 'block';
      detailsElement.innerHTML = '<p>メタデータを読み込み中...</p>';
      try {
        // メタデータを表示
        await displayImageMetadata(imagePath);
      } catch (error) {
        console.error('Error displaying metadata:', error);
        detailsElement.innerHTML = `<p class="error">メタデータの読み込みに失敗しました: ${error.message}</p>`;
      }
    } else {
      // 既に表示されている場合は非表示にする
      detailsElement.style.display = 'none';
    }
  });
};

/**
 * Yes/No付きのカスタムモーダルを表示
 * @param {string} title
 * @param {string} message
 * @param {function} onYes
 * @param {function} onNo
 */
function showConfirmModal(title, message, onYes, onNo) {
  modalOverlay.classList.add('show');
  modalTitle.textContent = title;
  modalMessage.innerHTML = message;
  // フッターのボタンを差し替え
  const footer = modalOverlay.querySelector('.modal-footer');
  footer.innerHTML = '';
  const yesBtn = document.createElement('button');
  yesBtn.textContent = 'はい';
  yesBtn.className = 'modal-btn modal-ok-btn';
  yesBtn.onclick = () => {
    closeModal();
    setTimeout(() => {
      if (onYes) onYes();
    }, 100);
  };
  const noBtn = document.createElement('button');
  noBtn.textContent = 'いいえ';
  noBtn.className = 'modal-btn';
  noBtn.onclick = () => {
    closeModal();
    setTimeout(() => {
      if (onNo) onNo();
    }, 100);
  };
  footer.appendChild(yesBtn);
  footer.appendChild(noBtn);
}

/**
 * 進捗バー付きモーダルを表示
 * @param {string} title
 * @param {string} message
 * @param {number} percent 0-100
 */
function showProgressModal(title, message, percent) {
  modalOverlay.classList.add('show');
  modalTitle.textContent = title;
  modalMessage.innerHTML = `${message}<br><progress value="${percent}" max="100"></progress> <span id="progressPercent">${percent}%</span>`;
  // フッターは閉じるボタンだけ
  const footer = modalOverlay.querySelector('.modal-footer');
  footer.innerHTML = '';
}

/**
 * 進捗バーの値を更新
 * @param {number} percent
 */
function updateProgressModal(percent) {
  const progress = modalOverlay.querySelector('progress');
  const percentText = modalOverlay.querySelector('#progressPercent');
  if (progress) progress.value = percent;
  if (percentText) percentText.textContent = `${percent}%`;
}

// モーダル外クリックで閉じる
if (modalOverlay) {
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}
module.exports = {
  showModal,
  displayMetadata,
  setProcessedImagePath,
  lastProcessedImagePath,
  closeModal,
  toggleDetails,
  displayImageMetadata,
  setupDetailsButton,
  showConfirmModal,
  showProgressModal,
  updateProgressModal
};