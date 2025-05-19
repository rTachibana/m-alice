"use strict";

const { contextBridge, ipcRenderer } = require('electron');

// メインプロセスとの通信用APIを定義
contextBridge.exposeInMainWorld('api', {
  // ファイル選択ダイアログを開く
  selectImage: () => ipcRenderer.invoke('select-image'),
  // 画像処理を実行
  processImage: options => ipcRenderer.invoke('process-image', options),
  // 画像のメタデータを取得
  getImageMetadata: imagePath => ipcRenderer.invoke('get-image-metadata', imagePath),
  // ファイルをエクスプローラーで表示
  showItemInFolder: filePath => ipcRenderer.invoke('show-item-in-folder', filePath),
  // 出力フォルダを開く
  openOutputFolder: filePath => ipcRenderer.invoke('open-output-folder', filePath),
  // ウォーターマーク一覧を取得
  getWatermarks: () => ipcRenderer.invoke('get-watermarks'),
  // 設定を読み込む
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  // 設定を保存する
  saveSettings: settings => ipcRenderer.invoke('save-settings', settings),
  // ドラッグ＆ドロップファイルの検証
  validateImagePath: filePath => ipcRenderer.invoke('validate-image-path', filePath),
  // ドラッグ＆ドロップファイルデータの処理
  handleDroppedFileData: fileInfo => ipcRenderer.invoke('handle-dropped-file-data', fileInfo),
  // Python環境のセットアップ
  setupPython: options => ipcRenderer.invoke('setup-python', options),
  // アプリを再起動
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  // ロゴ一覧を取得
  getLogos: () => ipcRenderer.invoke('get-logos'),
  // ファイルをバイナリで読み込む
  readFile: filePath => ipcRenderer.invoke('read-file', filePath),
  // イベントリスナーを登録
  on: (channel, callback) => {
    const validChannels = ['python-setup-progress'];
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    return null;
  }
});