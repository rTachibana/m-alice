"use strict";

const {
  app,
  dialog
} = require('electron');
const path = require('path');
const fs = require('fs');

// モジュールをインポート
const config = require('./modules/config');
const pythonSetup = require('./modules/python-setup');
const windowManager = require('./modules/window-manager');
const ipcHandlers = require('./modules/ipc-handlers');

// 起動時の処理
app.on('ready', async () => {
  let loadingWindow;
  try {
    // システム情報のログ出力
    config.logSystemInfo();

    // ローディングウィンドウを表示
    loadingWindow = windowManager.createLoadingWindow();

    // Python環境のセットアップ（初回起動時のみ: python.exeの有無で判定）
    if (!fs.existsSync(config.pythonExePath)) {
      await pythonSetup.setupPython();
    }

    // 入出力ディレクトリの確認と作成
    config.ensureDirectoriesExist();

    // ローディングウィンドウを閉じる
    if (loadingWindow) {
      loadingWindow.close();
    }

    // メインウィンドウを作成
    const mainWindow = windowManager.createMainWindow({
      webPreferences: {
        contextIsolation: true,
        // Enable context isolation for security
        nodeIntegration: false,
        // Disable node integration
        enableRemoteModule: false,
        // Disable remote module
        preload: path.join(__dirname, 'preload.js') // Use preload script for secure communication
      }
    });

    // IPC通信ハンドラーのセットアップ
    ipcHandlers.setupIPCHandlers();

    // ウィンドウが閉じられたらアプリを終了
    mainWindow.on('closed', () => {
      app.quit();
    });
  } catch (err) {
    console.error('Error during application startup:', err);
    if (loadingWindow) {
      loadingWindow.close();
    }
    dialog.showErrorBox('Error', `アプリケーションの起動に失敗しました: ${err.message}`);
    app.quit();
  }
});

// 全てのウィンドウが閉じられたときの処理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});