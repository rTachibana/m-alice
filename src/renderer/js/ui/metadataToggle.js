"use strict";

function showMetadataToggle(imagePath) {
  const label = document.createElement('div');
  label.className = 'metadata-toggle-label';
  label.textContent = 'メタデータ表示';
  const box = document.createElement('div');
  box.className = 'metadata-toggle-box';
  box.style.display = 'none';
  let loaded = false;
  label.onclick = async () => {
    if (box.style.display === 'none') {
      box.style.display = 'block';
      if (!loaded) {
        box.textContent = '読み込み中...';
        const {
          ipcRenderer
        } = require('electron');
        try {
          const result = await ipcRenderer.invoke('get-image-metadata', imagePath);
          if (result && result.text) {
            box.innerHTML = `<pre>${result.text}</pre>`;
          } else {
            box.textContent = 'メタデータは存在しません';
          }
        } catch (e) {
          box.textContent = 'メタデータ取得エラー';
        }
        loaded = true;
      }
    } else {
      box.style.display = 'none';
    }
  };
  return [label, box];
}
module.exports = {
  showMetadataToggle
};