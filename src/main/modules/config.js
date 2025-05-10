const os = require('os');
const path = require('path');
const { app } = require('electron');
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
const pythonExePath = path.join(
  pythonDir,
  isWindows ? 'python.exe' : 'python3'
);
const inputDir = path.join(appRoot, 'src', 'input');
const outputDir = path.join(appRoot, 'src', 'output');

// ディレクトリの存在確認と作成
const ensureDirectoriesExist = () => {
    const fs = require('fs');
    if (!fs.existsSync(inputDir)) {
        fs.mkdirSync(inputDir, { recursive: true });
        console.log(`Created input directory: ${inputDir}`);
    }
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
    }
};

// デバッグログを出力する関数
const logSystemInfo = () => {
    console.log('OS:', process.platform);
    console.log('App Root:', appRoot);
    console.log('Python Dir:', pythonDir);
    console.log('Input Dir:', inputDir);
    console.log('Output Dir:', outputDir);
};

module.exports = {
    store,
    isWindows,
    isMac,
    isLinux,
    appRoot,
    pythonDir,
    pythonExePath,
    inputDir,
    outputDir,
    ensureDirectoriesExist,
    logSystemInfo,
};
