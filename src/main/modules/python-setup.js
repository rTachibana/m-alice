"use strict";

const fs = require('fs');
const https = require('https');
const path = require('path');
const {
  spawn
} = require('child_process');
const unzipper = require('unzipper');
const config = require('./config');

// Pythonのダウンロード用URL取得
const getPythonUrl = () => {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32') {
    if (arch === 'x64') {
      return 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip';
    } else if (arch === 'ia32') {
      return 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-win32.zip';
    } else if (arch === 'arm64') {
      return 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-arm64.zip';
    } else {
      throw new Error(`Unsupported architecture: ${arch}`);
    }
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
};

// Pythonの必要なライブラリをインストールする関数
const setupPythonLibraries = async (reportProgress) => {
  console.log('Setting up Python libraries...');

  // 最初の進捗報告
  if (reportProgress) reportProgress(10);

  // Python312._pthファイルを編集して、import siteを有効にする
  const pythonPthPath = path.join(config.pythonDir, 'python312._pth');
  if (fs.existsSync(pythonPthPath)) {
    let pthContent = fs.readFileSync(pythonPthPath, 'utf8');
    // #import site の行をimport siteに変更（コメントを解除）
    if (pthContent.includes('#import site')) {
      pthContent = pthContent.replace('#import site', 'import site');
      fs.writeFileSync(pythonPthPath, pthContent);
      console.log('Enabled import site in python312._pth');
    }
  }
  
  // 進捗報告
  if (reportProgress) reportProgress(20);
  // get-pipスクリプトをダウンロード
  const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
  const getPipPath = path.join(config.pythonDir, 'get-pip.py');
  console.log('Downloading pip installer...');
  await new Promise((resolve, reject) => {
    https.get(getPipUrl, response => {
      const file = fs.createWriteStream(getPipPath);
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', err => {
      fs.unlink(getPipPath, () => reject(err));
    });
  });

  // 進捗報告
  if (reportProgress) reportProgress(30);

  // pipをインストール
  console.log('Installing pip...');
  await new Promise((resolve, reject) => {
    const pipInstall = spawn(config.pythonExePath, [getPipPath, '--no-warn-script-location']);
    pipInstall.stdout.on('data', data => {
      console.log(`pip install stdout: ${data}`);
    });
    pipInstall.stderr.on('data', data => {
      console.error(`pip install stderr: ${data}`);
    });
    pipInstall.on('close', code => {
      if (code === 0) {
      console.log('pip installed successfully');
        resolve();
      } else {
        console.error(`pip installation failed with code ${code}`);
        resolve(); // エラーでも続行（以前のインストールが残っている可能性）
      }
    });
  });

  // 進捗報告
  if (reportProgress) reportProgress(40);

  // 必要なライブラリをインストール
  const libraries = ['pillow', 'numpy', 'scipy', 'piexif'];
  const pipPath = path.join(config.pythonDir, 'Scripts', 'pip.exe');
  
  // 各ライブラリごとの進捗値計算（40%から90%までの範囲）
  const progressStep = 50 / libraries.length;
  let currentProgress = 40;  for (const lib of libraries) {
    console.log(`Installing ${lib}...`);
    await new Promise((resolve, reject) => {
      // pipのパスが存在しない場合は、pythonの-mオプションを使用
      const pipCmd = fs.existsSync(pipPath) ? spawn(pipPath, ['install', lib, '--no-warn-script-location']) : spawn(config.pythonExePath, ['-m', 'pip', 'install', lib, '--no-warn-script-location']);
      pipCmd.stdout.on('data', data => {
        console.log(`${lib} install stdout: ${data}`);
      });
      pipCmd.stderr.on('data', data => {
        console.error(`${lib} install stderr: ${data}`);
      });
      pipCmd.on('close', code => {
        if (code === 0) {
          console.log(`${lib} installed successfully`);
          resolve();
        } else {
          console.error(`${lib} installation failed with code ${code}`);
          resolve(); // エラーでも続行
        }
      });
    });
    
    // ライブラリインストール後の進捗更新
    currentProgress += progressStep;
    if (reportProgress) reportProgress(Math.round(currentProgress));
  }
  
  // 最終進捗報告
  if (reportProgress) reportProgress(90);
  
  console.log('Python libraries setup complete');
};

// Pythonのセットアップメイン関数
const setupPython = async (options = {}, reportProgress) => {
  if (options.force) {
    // pythonディレクトリを削除
    if (fs.existsSync(config.pythonDir)) {
      fs.rmSync(config.pythonDir, { recursive: true, force: true });
      console.log('Pythonディレクトリを強制削除しました');
    }
  }
  if (fs.existsSync(config.pythonExePath) && !options.force) {
    console.log('Python is already set up.');
    // 初期進捗報告
    if (reportProgress) reportProgress(5);
    // Python環境はあるが、必要なライブラリが揃っているか確認し、不足していれば追加インストール
    await setupPythonLibraries(reportProgress);
    // 完了進捗報告
    if (reportProgress) reportProgress(100);
    return;
  }  const pythonZipUrl = getPythonUrl();
  const zipPath = path.join(config.pythonDir, 'python-embed.zip');
  // 1. pythonディレクトリがなければ作成
  if (!fs.existsSync(config.pythonDir)) {
    fs.mkdirSync(config.pythonDir, { recursive: true });
  }
  
  // 初期進捗報告
  if (reportProgress) reportProgress(5);
  
  // 2. zipダウンロード
  console.log(`Downloading Python embeddable package from ${pythonZipUrl}...`);
  const file = fs.createWriteStream(zipPath);
  
  await new Promise((resolve, reject) => {
    let receivedBytes = 0;
    let totalBytes = 0;
    
    const request = https.get(pythonZipUrl, response => {
      totalBytes = parseInt(response.headers['content-length'], 10);
      
      response.on('data', chunk => {
        receivedBytes += chunk.length;
        // ダウンロード進捗を5%から20%の範囲で報告
        if (reportProgress && totalBytes) {
          const percent = 5 + Math.round((receivedBytes / totalBytes) * 15);
          reportProgress(percent);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close(resolve);
      });
    });
    
    request.on('error', err => {
      fs.unlink(zipPath, () => reject(err));
    });
  });
  
  // 3. zip展開
  console.log('Extracting Python embeddable package...');
  if (reportProgress) reportProgress(20);
  
  await new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: config.pythonDir }))
      .on('close', () => {
        if (reportProgress) reportProgress(30);
        resolve();
      })
      .on('error', reject);
  });  // 4. zip削除
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  console.log('Python setup complete.');
  // Pythonライブラリをインストール
  await setupPythonLibraries(reportProgress);
  
  // 完了進捗報告
  if (reportProgress) reportProgress(100);
};
module.exports = {
  setupPython
};