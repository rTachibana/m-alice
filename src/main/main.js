"use strict";

const {
  app,
  dialog,
  ipcMain
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
    
    // ユーザー設定ファイルのパス
    const userSettingsPath = path.join(config.appRoot, 'user_data', 'user-settings.json');
    
    // ユーザー設定を読み込み
    let userSettings = {};
    if (fs.existsSync(userSettingsPath)) {
      try {
        userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      } catch (error) {
        console.error('Error parsing user settings:', error);
        userSettings = {};
      }
    }
    
    // 初回起動判定（Pythonセットアップ未完了またはPython.exeが存在しない場合）
    const isFirstLaunch = !userSettings.hasCompletedSetup || !fs.existsSync(config.pythonExePath);
    
    // 初回起動時はPythonセットアップを行う
    if (isFirstLaunch) {
      // ローディングウィンドウを表示
      loadingWindow = windowManager.createLoadingWindow();
      
      try {
        // Python環境のセットアップ
        await pythonSetup.setupPython();
        
        // セットアップ完了フラグを設定
        userSettings.hasCompletedSetup = true;
        
        // ユーザー設定ディレクトリがなければ作成
        const userDataDir = path.join(config.appRoot, 'user_data');
        if (!fs.existsSync(userDataDir)) {
          fs.mkdirSync(userDataDir, { recursive: true });
        }
        
        // 設定を保存
        fs.writeFileSync(userSettingsPath, JSON.stringify(userSettings, null, 2), 'utf8');      } catch (error) {
        console.error('Python setup error:', error);
        dialog.showErrorBox('Python Setup Error', 
          `Python環境のセットアップに失敗しました。インターネット接続を確認し、アプリケーション内の[Python設定]ボタンから再試行してください。\n\nエラー: ${error.message}`);
      }
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
    });    // IPC通信ハンドラーのセットアップ
    ipcHandlers.setupIPCHandlers();
    
    // Python設定用のIPCハンドラーを追加
    ipcMain.handle('setup-python', async (event, options = {}) => {
      try {
        // 進捗を通知する関数
        const reportProgress = (percent) => {
          event.sender.send('python-setup-progress', percent);
        };
        
        // Pythonセットアップを実行（進捗通知関数を追加）
        await pythonSetup.setupPython(options, reportProgress);
        return { success: true };
      } catch (error) {
        console.error('Python setup error:', error);
        return { 
          success: false, 
          error: error.message 
        };
      }
    });
    
    // アプリ再起動用のIPCハンドラーを追加
    ipcMain.handle('relaunch-app', () => {
      app.relaunch();
      app.exit();
    });

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