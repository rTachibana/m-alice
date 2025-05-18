"use strict";

const { contextBridge, ipcRenderer } = require('electron');

// メインプロセスとの通信用APIを定義
contextBridge.exposeInMainWorld('api', {
  // ファイル選択ダイアログを開く
  selectImage: () => ipcRenderer.invoke('select-image'),
  
  // 画像処理を実行
  processImage: (options) => ipcRenderer.invoke('process-image', options),
  
  // 画像のメタデータを取得
  getImageMetadata: (imagePath) => ipcRenderer.invoke('get-image-metadata', imagePath),
  
  // ファイルをエクスプローラーで表示
  showItemInFolder: (filePath) => ipcRenderer.send('show-item-in-folder', filePath),
  
  // ウォーターマーク一覧を取得
  getWatermarks: () => ipcRenderer.invoke('get-watermarks'),
  
  // 設定を読み込む
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  
  // 設定を保存する
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Python環境のセットアップ
  setupPython: (options) => ipcRenderer.invoke('setup-python', options),
  
  // アプリを再起動
  relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
  
  // イベントリスナーを登録
  on: (channel, callback) => {
    // 許可されたチャンネルのみ購読を許可
    const validChannels = ['python-setup-progress'];
    if (validChannels.includes(channel)) {
      // イベントリスナーのラッパーを作成し、引数からeventを除去
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      
      // 購読解除用の関数を返す
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  }
});