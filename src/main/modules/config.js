"use strict";

const os = require('os');
const path = require('path');
const {
  app
} = require('electron');
const Store = require('electron-store').default || require('electron-store');

// ストアのインスタンス化
const store = new Store();

// OSの判定
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// アプリケーションのルートパスを取得（OS非依存かつ実行場所に依存しない）
const appRoot = app.getAppPath();
const pythonDir = path.join(appRoot, 'python');
const pythonExePath = path.join(pythonDir, isWindows ? 'python.exe' : 'python3');
// 出力ディレクトリのデフォルトは user_data/output
const outputDir = path.join(appRoot, 'user_data', 'output');

// ディレクトリの存在確認と作成
const ensureDirectoriesExist = () => {
  const fs = require('fs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, {
      recursive: true
    });
    console.log(`Created output directory: ${outputDir}`);
  }
};

// デバッグログを出力する関数
const logSystemInfo = () => {
  console.log('OS:', process.platform);
  console.log('App Root:', appRoot);
  console.log('Python Dir:', pythonDir);
  console.log('Output Dir:', outputDir);
};

// ユーザー設定から保存先パスを取得する関数
const getUserDirs = () => {
  try {
    const fs = require('fs');
    const userSettingsPath = path.join(appRoot, 'user_data', 'user-settings.json');
    if (fs.existsSync(userSettingsPath)) {
      const settings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
      return {
        outputDir: settings.outputDir ? path.resolve(appRoot, settings.outputDir) : outputDir
      };
    }
  } catch (e) {
    console.error('ユーザー設定から保存先パス取得失敗:', e);
  }
  return {
    outputDir
  };
};

module.exports = {
  store,
  isWindows,
  isMac,
  isLinux,
  appRoot,
  pythonDir,
  pythonExePath,
  outputDir,
  ensureDirectoriesExist,
  logSystemInfo,
  getUserDirs
};