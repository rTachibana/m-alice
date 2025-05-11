"use strict";

const {
  BrowserWindow
} = require('electron');
const path = require('path');
const config = require('./config');

// メインウィンドウの作成と管理
function createMainWindow() {
  // 前回のウィンドウサイズと位置を取得
  const windowState = config.store.get('windowState', {
    width: 1000,
    height: 800,
    x: undefined,
    y: undefined,
    isMaximized: false
  });

  // メインウィンドウを作成
  const mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    icon: path.join(config.appRoot, 'build', 'icons', config.isWindows ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false
    }
  });

  // 前回最大化状態だった場合は最大化
  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // ウィンドウサイズ保存のヘルパー関数
  const saveWindowState = () => {
    if (!mainWindow.isMaximized()) {
      const {
        width,
        height
      } = mainWindow.getBounds();
      const [x, y] = mainWindow.getPosition();
      config.store.set('windowState', {
        width,
        height,
        x,
        y,
        isMaximized: false
      });
      console.log('Window state saved:', {
        width,
        height,
        x,
        y
      });
    }
  };

  // 最大化状態の変更を監視
  mainWindow.on('maximize', () => {
    config.store.set('windowState', {
      ...windowState,
      isMaximized: true
    });
    console.log('Window maximized state saved');
  });
  mainWindow.on('unmaximize', () => {
    saveWindowState();
  });

  // リサイズと移動のイベントでウィンドウ状態を保存（デバウンス処理）
  let windowStateTimer = null;
  ['resize', 'move'].forEach(event => {
    mainWindow.on(event, () => {
      if (windowStateTimer) {
        clearTimeout(windowStateTimer);
      }
      windowStateTimer = setTimeout(saveWindowState, 500);
    });
  });

  // ウィンドウが閉じられる前に最後の状態を保存
  mainWindow.on('close', () => {
    const isMaximized = mainWindow.isMaximized();
    if (isMaximized) {
      config.store.set('windowState', {
        ...windowState,
        isMaximized: true
      });
    } else {
      saveWindowState();
    }
  });

  // HTMLファイルを読み込む
  mainWindow.loadFile('src/renderer/index.html');
  return mainWindow;
}

// ローディングウィンドウの作成
function createLoadingWindow() {
  const loadingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webSecurity: false
    }
  });
  loadingWindow.loadFile('src/renderer/loading.html');
  return loadingWindow;
}
module.exports = {
  createMainWindow,
  createLoadingWindow
};