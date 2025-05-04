const fs = require('fs');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');
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
const setupPythonLibraries = async () => {
    console.log('Setting up Python libraries...');
    
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
    
    // get-pipスクリプトをダウンロード
    const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
    const getPipPath = path.join(config.pythonDir, 'get-pip.py');
    
    console.log('Downloading pip installer...');
    await new Promise((resolve, reject) => {
        https.get(getPipUrl, (response) => {
            const file = fs.createWriteStream(getPipPath);
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(getPipPath, () => reject(err));
        });
    });
    
    // pipをインストール
    console.log('Installing pip...');
    await new Promise((resolve, reject) => {
        const pipInstall = spawn(config.pythonExePath, [getPipPath, '--no-warn-script-location']);
        
        pipInstall.stdout.on('data', (data) => {
            console.log(`pip install stdout: ${data}`);
        });
        
        pipInstall.stderr.on('data', (data) => {
            console.error(`pip install stderr: ${data}`);
        });
        
        pipInstall.on('close', (code) => {
            if (code === 0) {
                console.log('pip installed successfully');
                resolve();
            } else {
                console.error(`pip installation failed with code ${code}`);
                resolve(); // エラーでも続行（以前のインストールが残っている可能性）
            }
        });
    });
    
    // 必要なライブラリをインストール
    const libraries = ['pillow', 'numpy', 'scipy'];
    const pipPath = path.join(config.pythonDir, 'Scripts', 'pip.exe');
    
    for (const lib of libraries) {
        console.log(`Installing ${lib}...`);
        await new Promise((resolve, reject) => {
            // pipのパスが存在しない場合は、pythonの-mオプションを使用
            const pipCmd = fs.existsSync(pipPath) ? 
                spawn(pipPath, ['install', lib, '--no-warn-script-location']) : 
                spawn(config.pythonExePath, ['-m', 'pip', 'install', lib, '--no-warn-script-location']);
            
            pipCmd.stdout.on('data', (data) => {
                console.log(`${lib} install stdout: ${data}`);
            });
            
            pipCmd.stderr.on('data', (data) => {
                console.error(`${lib} install stderr: ${data}`);
            });
            
            pipCmd.on('close', (code) => {
                if (code === 0) {
                    console.log(`${lib} installed successfully`);
                    resolve();
                } else {
                    console.error(`${lib} installation failed with code ${code}`);
                    resolve(); // エラーでも続行
                }
            });
        });
    }
    
    console.log('Python libraries setup complete');
};

// Pythonのセットアップメイン関数
const setupPython = async () => {
    if (fs.existsSync(config.pythonExePath)) {
        console.log('Python is already set up.');
        
        // Python環境はあるが、必要なライブラリが揃っているか確認し、不足していれば追加インストール
        await setupPythonLibraries();
        return;
    }

    const pythonZipUrl = getPythonUrl();
    const zipPath = path.join(config.pythonDir, 'python-embed.zip');

    console.log(`Downloading Python embeddable package from ${pythonZipUrl}...`);
    const file = fs.createWriteStream(zipPath);
    await new Promise((resolve, reject) => {
        https.get(pythonZipUrl, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(zipPath, () => reject(err));
        });
    });

    console.log('Extracting Python embeddable package...');
    await new Promise((resolve, reject) => {
        fs.createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: config.pythonDir }))
            .on('close', resolve)
            .on('error', reject);
    });

    fs.unlinkSync(zipPath);
    console.log('Python setup complete.');

    // Pythonライブラリをインストール
    await setupPythonLibraries();
};

module.exports = {
    setupPython
};