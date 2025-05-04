const { app, dialog } = require('electron');

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

        // Python環境のセットアップ
        await pythonSetup.setupPython();
        
        // 入出力ディレクトリの確認・作成
        config.ensureDirectoriesExist();

        // ローディングウィンドウを閉じる
        if (loadingWindow) {
            loadingWindow.close();
        }

        // メインウィンドウを作成
        const mainWindow = windowManager.createMainWindow();

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