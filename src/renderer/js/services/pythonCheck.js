const { ipcRenderer } = require('electron');
const { showModal, showProgressModal, updateProgressModal } = require('../ui/modal');
const pythonSetupService = require('./pythonSetup');

async function openPythonCheckModal(pythonSetupBtn) {
  const modalTitle = 'Pythonセットアップ';
  const modalMsg = 'Python環境の状態をチェック、または強制的に再インストールできます。 ※ インターネット接続が必要です';
  showModal(modalTitle, modalMsg);
  const footer = document.querySelector('.modal-footer');
  footer.innerHTML = '';
  // チェックボタン
  const checkBtn = document.createElement('button');
  checkBtn.textContent = 'チェック';
  checkBtn.className = 'modal-btn modal-ok-btn';
  checkBtn.onclick = async () => {
    showProgressModal('Pythonセットアップ', 'Python環境とライブラリを確認・セットアップしています...', 0);
    if (pythonSetupBtn) pythonSetupBtn.disabled = true;
    ipcRenderer.on('python-setup-progress', (event, percent) => {
      updateProgressModal(percent);
    });
    try {
      await pythonSetupService.setupPython();
      updateProgressModal(100);
      const footer2 = document.querySelector('.modal-footer');
      footer2.innerHTML = '';
      const restartBtn = document.createElement('button');
      restartBtn.textContent = '再起動';
      restartBtn.className = 'modal-btn modal-ok-btn';
      restartBtn.onclick = async () => {
        await ipcRenderer.invoke('relaunch-app');
      };
      footer2.appendChild(restartBtn);
      const doneMsg = document.createElement('div');
      doneMsg.innerHTML = '<br>セットアップが完了しました。再起動してください。';
      document.getElementById('modalMessage').appendChild(doneMsg);
    } catch (error) {
      showModal('エラー', 'Pythonセットアップ中にエラーが発生しました: ' + error.message);
    } finally {
      if (pythonSetupBtn) pythonSetupBtn.disabled = false;
      if (pythonSetupBtn) pythonSetupBtn.textContent = '';
      if (pythonSetupBtn) {
        const img = pythonSetupBtn.querySelector('img');
        if (img) pythonSetupBtn.appendChild(img);
      }
    }
  };
  footer.appendChild(checkBtn);
  // 再インストールボタン
  const reinstallBtn = document.createElement('button');
  reinstallBtn.textContent = '再インストール';
  reinstallBtn.className = 'modal-btn';
  reinstallBtn.onclick = async () => {
    showProgressModal('Python再インストール', 'Python環境を再インストールしています...', 0);
    if (pythonSetupBtn) pythonSetupBtn.disabled = true;
    ipcRenderer.on('python-setup-progress', (event, percent) => {
      updateProgressModal(percent);
    });
    try {
      await pythonSetupService.setupPython({ force: true });
      updateProgressModal(100);
      const footer2 = document.querySelector('.modal-footer');
      footer2.innerHTML = '';
      const restartBtn = document.createElement('button');
      restartBtn.textContent = '再起動';
      restartBtn.className = 'modal-btn modal-ok-btn';
      restartBtn.onclick = async () => {
        await ipcRenderer.invoke('relaunch-app');
      };
      footer2.appendChild(restartBtn);
      const doneMsg = document.createElement('div');
      doneMsg.innerHTML = '<br>再インストールが完了しました。再起動してください。';
      document.getElementById('modalMessage').appendChild(doneMsg);
    } catch (error) {
      showModal('エラー', 'Python再インストール中にエラーが発生しました: ' + error.message);
    } finally {
      if (pythonSetupBtn) pythonSetupBtn.disabled = false;
      if (pythonSetupBtn) pythonSetupBtn.textContent = '';
      if (pythonSetupBtn) {
        const img = pythonSetupBtn.querySelector('img');
        if (img) pythonSetupBtn.appendChild(img);
      }
    }
  };
  footer.appendChild(reinstallBtn);
}

module.exports = { openPythonCheckModal }; 