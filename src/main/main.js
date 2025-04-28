const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');
const https = require('https');
const unzipper = require('unzipper');
const { spawn } = require('child_process');

// OSの判定
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

// アプリケーションのルートパスを取得（OS非依存）
const appRoot = path.resolve(__dirname, '../..');
const pythonDir = path.join(appRoot, 'python');
const pythonExePath = path.join(pythonDir, isWindows ? 'python.exe' : 'python3');
const inputDir = path.join(appRoot, 'src', 'input');
const outputDir = path.join(appRoot, 'src', 'output');

// コンソールにデバッグ情報を出力
console.log('OS:', process.platform);
console.log('App Root:', appRoot);
console.log('Python Dir:', pythonDir);
console.log('Input Dir:', inputDir);
console.log('Output Dir:', outputDir);

// Ensure input and output directories exist
const ensureDirectoriesExist = () => {
    if (!fs.existsSync(inputDir)) {
        fs.mkdirSync(inputDir, { recursive: true });
        console.log(`Created input directory: ${inputDir}`);
    }
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`Created output directory: ${outputDir}`);
    }
};

const getPythonUrl = () => {
    const platform = os.platform();
    const arch = os.arch();

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

const setupPython = async () => {
    if (fs.existsSync(pythonExePath)) {
        console.log('Python is already set up.');
        
        // Python環境はあるが、必要なライブラリが揃っているか確認し、不足していれば追加インストール
        await setupPythonLibraries();
        return;
    }

    const pythonZipUrl = getPythonUrl();
    const zipPath = path.join(pythonDir, 'python-embed.zip');

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
            .pipe(unzipper.Extract({ path: pythonDir }))
            .on('close', resolve)
            .on('error', reject);
    });

    fs.unlinkSync(zipPath);
    console.log('Python setup complete.');

    // Pythonライブラリをインストール
    await setupPythonLibraries();
};

// Pythonの必要なライブラリをインストールする関数
const setupPythonLibraries = async () => {
    console.log('Setting up Python libraries...');
    
    // Python312._pthファイルを編集して、import siteを有効にする
    const pythonPthPath = path.join(pythonDir, 'python312._pth');
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
    const getPipPath = path.join(pythonDir, 'get-pip.py');
    
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
        const pipInstall = spawn(pythonExePath, [getPipPath, '--no-warn-script-location']);
        
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
    const pipPath = path.join(pythonDir, 'Scripts', 'pip.exe');
    
    for (const lib of libraries) {
        console.log(`Installing ${lib}...`);
        await new Promise((resolve, reject) => {
            // pipのパスが存在しない場合は、pythonの-mオプションを使用
            const pipCmd = fs.existsSync(pipPath) ? 
                spawn(pipPath, ['install', lib, '--no-warn-script-location']) : 
                spawn(pythonExePath, ['-m', 'pip', 'install', lib, '--no-warn-script-location']);
            
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

app.on('ready', async () => {
    let loadingWindow;

    try {
        loadingWindow = new BrowserWindow({
            width: 400,
            height: 300,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                // ファイルシステムへのアクセスを許可
                webSecurity: false
            }
        });

        loadingWindow.loadFile('src/renderer/loading.html');

        await setupPython();
        ensureDirectoriesExist();

        if (loadingWindow) {
            loadingWindow.close();
        }

        const mainWindow = new BrowserWindow({
            width: 1000,
            height: 800,
            icon: path.join(appRoot, 'build', 'icons', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                // ファイルシステムへのアクセスを許可
                webSecurity: false
            }
        });

        mainWindow.loadFile('src/renderer/index.html');

        // デベロッパーツールを開く（開発時のみ）
        // mainWindow.webContents.openDevTools();

        mainWindow.on('closed', () => {
            app.quit();
        });

        // Setup IPC handlers
        setupIPCHandlers();
    } catch (err) {
        console.error('Error during Python setup:', err);
        if (loadingWindow) {
            loadingWindow.close();
        }
        dialog.showErrorBox('Error', `Failed to set up Python: ${err.message}`);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC handlers setup
function setupIPCHandlers() {
    // Handle image selection
    ipcMain.handle('select-image', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [
                { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
            ]
        });
        console.log('Selected file:', result.filePaths);
        return result;
    });
    
    // ドラッグ＆ドロップされたファイルを安全に処理するハンドラー
    ipcMain.handle('validate-image-path', async (event, filePath) => {
        try {
            console.log('Validating image path:', filePath);
            
            // ファイルが存在するか確認
            if (!fs.existsSync(filePath)) {
                console.error('File does not exist:', filePath);
                return { success: false, message: 'ファイルが存在しません' };
            }
            
            // ファイルが読み取り可能か確認
            try {
                fs.accessSync(filePath, fs.constants.R_OK);
            } catch (err) {
                console.error('File is not readable:', err);
                return { success: false, message: 'ファイルを読み取れません' };
            }
            
            // 画像ファイルであるか簡易チェック（拡張子で判断）
            const ext = path.extname(filePath).toLowerCase();
            const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
            
            if (!validExtensions.includes(ext)) {
                console.error('Invalid file extension:', ext);
                return { success: false, message: '対応していないファイル形式です' };
            }
            
            console.log('File validation successful:', filePath);
            return { success: true, filePath: filePath };
        } catch (error) {
            console.error('Error validating image path:', error);
            return { success: false, message: error.message };
        }
    });

    // ドラッグ＆ドロップされたファイルのデータを処理するハンドラー
    ipcMain.handle('handle-dropped-file-data', async (event, fileInfo) => {
        try {
            console.log('Received dropped file data:', fileInfo.fileName);
            
            // 一時ファイルの保存先を設定（拡張子をオリジナルから取得）
            const tempInputPath = path.join(inputDir, 'temp_input' + path.extname(fileInfo.fileName));
            
            // Uint8Array形式のデータをBufferに変換
            const buffer = Buffer.from(fileInfo.fileData);
            
            // ファイルを書き込み
            fs.writeFileSync(tempInputPath, buffer);
            console.log('Saved dropped file to:', tempInputPath);
            
            // オリジナルのファイル名も返す
            return { 
                success: true, 
                filePath: tempInputPath,
                originalFileName: fileInfo.fileName 
            };
        } catch (error) {
            console.error('Error handling dropped file data:', error);
            return { success: false, message: error.message };
        }
    });

    // Handle image processing
    ipcMain.handle('process-image', async (event, options) => {
        try {
            console.log('Processing image with options:', options);
            
            // Copy the input file to input directory
            const inputFilePath = options.imagePath;
            
            // オリジナルのファイル名を使用（指定がない場合はパスからファイル名を取得）
            const originalFileName = options.originalFileName || path.basename(inputFilePath);
            const tempInputPath = path.join(inputDir, 'temp_input' + path.extname(inputFilePath));
            
            console.log('Input file path:', inputFilePath);
            console.log('Original file name:', originalFileName);
            console.log('Temp input path:', tempInputPath);
            
            // Copy input file to temp location
            fs.copyFileSync(inputFilePath, tempInputPath);
            console.log('Copied input file to temp location');

            // Prepare output path with original file name
            const outputFileName = `maliced-${originalFileName}`;
            const outputPath = path.join(outputDir, outputFileName);
            console.log('Output path:', outputPath);

            // ウォーターマークパス
            let watermarkPath = null;
            if (options.applyWatermark && options.watermarkType) {
                watermarkPath = path.join(appRoot, 'src', 'watermark', `${options.watermarkType}.png`);
                console.log('Using watermark:', watermarkPath);
            }

            // Python処理オプション
            const processingOptions = {
                apply_watermark: options.applyWatermark,
                watermark_path: watermarkPath,
                opacity: options.watermarkOpacity,
                invert: options.invertWatermark || false,
                resize: options.resize,
                noise_level: parseInt(options.noiseLevel) / 7, // 0-7の値を0-1の範囲に変換
                noise_types: options.noiseTypes || ['gaussian', 'dct'], // ノイズタイプを追加
                // ロゴ位置の設定を追加
                logo_position: options.logoPosition || 'random',
                // メタデータオプションの追加 (キャメルケースをスネークケースに変換)
                remove_metadata: options.removeMetadata,
                add_fake_metadata: options.addFakeMetadata,
                fake_metadata_type: options.fakeMetadataType,
                add_no_ai_flag: options.addNoAIFlag
            };

            // JSONとしてシリアライズ
            const optionsJson = JSON.stringify(processingOptions);

            // Python スクリプトを実行
            const pythonProcess = spawn(pythonExePath, [
                path.join(appRoot, 'src', 'backend', 'process.py'),
                tempInputPath,
                outputPath,
                optionsJson
            ]);

            const result = await new Promise((resolve, reject) => {
                let stdoutData = '';
                let stderrData = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                    console.log(`Python stdout: ${data}`);
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderrData += data.toString();
                    console.error(`Python stderr: ${data}`);
                });

                pythonProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve({ success: true, outputPath, message: stdoutData });
                    } else {
                        reject(new Error(`Python process exited with code ${code}: ${stderrData}`));
                    }
                });
            });

            return { success: true, outputPath };
            
        } catch (error) {
            console.error('Error processing image:', error);
            return { success: false, message: error.message };
        }
    });

    // Handle opening folder
    ipcMain.handle('open-folder', async (event, folderPath) => {
        try {
            console.log('Opening folder:', folderPath);
            shell.openPath(folderPath);
        } catch (error) {
            console.error('Error opening folder:', error);
        }
    });

    ipcMain.handle('show-item-in-folder', (event, filePath) => {
        console.log('Opening folder for file:', filePath);
        shell.showItemInFolder(filePath);
    });
    
    // 設定関連のハンドラー
    ipcMain.handle('save-settings', async (event, settings) => {
        try {
            const settingsPath = path.join(appRoot, 'user-settings.json');
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
            console.log('Settings saved to:', settingsPath);
            return { success: true };
        } catch (error) {
            console.error('Error saving settings:', error);
            return { success: false, message: error.message };
        }
    });
    
    ipcMain.handle('load-settings', async () => {
        try {
            const settingsPath = path.join(appRoot, 'user-settings.json');
            
            if (!fs.existsSync(settingsPath)) {
                // デフォルト設定を返す
                const defaultSettings = {
                    logoPosition: 'random',
                    noiseLevel: 50,
                    watermarkEnabled: false,
                    watermarkType: 'no_ai',
                    invertWatermark: false,
                    watermarkOpacity: 60,
                    resize: 'default'
                };
                
                // デフォルト設定を保存しておく
                fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf8');
                console.log('Created default settings file:', settingsPath);
                
                return { success: true, settings: defaultSettings };
            }
            
            const settingsData = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(settingsData);
            console.log('Settings loaded from:', settingsPath);
            return { success: true, settings };
        } catch (error) {
            console.error('Error loading settings:', error);
            return { 
                success: false, 
                message: error.message,
                // エラーが発生した場合もデフォルト設定を返す
                settings: {
                    logoPosition: 'random',
                    noiseLevel: 50,
                    watermarkEnabled: false,
                    watermarkType: 'no_ai',
                    invertWatermark: false,
                    watermarkOpacity: 60,
                    resize: 'default'
                }
            };
        }
    });

    // ウォーターマーク画像の一覧を取得するハンドラー
    ipcMain.handle('get-watermarks', async () => {
        try {
            const watermarkDir = path.join(appRoot, 'src', 'watermark');
            
            // ディレクトリが存在するか確認
            if (!fs.existsSync(watermarkDir)) {
                console.error('Watermark directory does not exist:', watermarkDir);
                return {
                  success: false,
                  message: "watermark クディレクトリが見つかりません",
                };
            }
            
            // ディレクトリ内のファイル一覧を取得
            const files = fs.readdirSync(watermarkDir);
            
            // PNGとSVGファイルのみをフィルタリング
            const watermarkFiles = files.filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ext === '.png' || ext === '.svg';
            });
            
            // ファイル名（拡張子なし）とパスのマッピングを作成
            const watermarks = watermarkFiles.map(file => {
                const fileNameWithoutExt = path.basename(file, path.extname(file));
                // ファイル名の "_" をスペースに変換（UI表示用）
                const displayName = fileNameWithoutExt.replace(/_/g, ' ');
                
                return {
                    value: fileNameWithoutExt, // 内部的に使用する値
                    displayName: displayName,  // UI表示用の名前
                    path: path.join(watermarkDir, file) // ファイルのフルパス
                };
            });
            
            console.log('Found watermarks:', watermarks);
            return { success: true, watermarks };
        } catch (error) {
            console.error('Error getting watermarks:', error);
            return { success: false, message: error.message };
        }
    });

    // メタデータを取得するハンドラを登録
    ipcMain.handle('get-image-metadata', async (event, imagePath) => {
        try {
            console.log('Getting metadata for:', imagePath);
            
            // ファイルが存在するか確認
            if (!fs.existsSync(imagePath)) {
                return {
                    success: false,
                    message: 'ファイルが見つかりません'
                };
            }
            
            // 環境変数にPython実行ファイルのパスを設定
            const pythonPath = path.join(__dirname, '../../python/python.exe');
            
            // バックエンドスクリプトのパス
            const scriptPath = path.join(__dirname, '../backend/get_metadata.py');
            
            // Pythonスクリプトの実行
            const result = await new Promise((resolve, reject) => {
                // PythonプロセスでJSONを受け取るためのバッファ
                let stdoutData = '';
                let stderrData = '';
                
                // Pythonプロセスを実行
                const pythonProcess = spawn(pythonPath, [
                    scriptPath,
                    imagePath
                ]);
                
                // 標準出力からデータを受け取る
                pythonProcess.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                });
                
                // 標準エラー出力からデータを受け取る
                pythonProcess.stderr.on('data', (data) => {
                    stderrData += data.toString();
                    console.error('Python stderr:', data.toString());
                });
                
                // プロセスが終了したときの処理
                pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                        console.error(`Python process exited with code ${code}: ${stderrData}`);
                        reject(new Error(`Python process exited with code ${code}: ${stderrData}`));
                        return;
                    }
                    
                    try {
                        // Python処理の結果をJSONとしてパース
                        const parsedData = JSON.parse(stdoutData);
                        resolve(parsedData);
                    } catch (error) {
                        console.error('Failed to parse Python output:', error);
                        console.error('Raw output:', stdoutData);
                        reject(new Error('メタデータの解析に失敗しました'));
                    }
                });
                
                // エラーイベントのハンドリング
                pythonProcess.on('error', (error) => {
                    console.error('Failed to start Python process:', error);
                    reject(new Error('Pythonプロセスの実行に失敗しました'));
                });
            });
            
            return {
                success: true,
                metadata: result
            };
            
        } catch (error) {
            console.error('Error getting metadata:', error);
            return {
                success: false,
                message: error.message || 'メタデータの取得に失敗しました'
            };
        }
    });
}