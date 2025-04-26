const { app, BrowserWindow, dialog, ipcMain } = require('electron');
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
            const fileName = path.basename(inputFilePath);
            const tempInputPath = path.join(inputDir, 'temp_input' + path.extname(inputFilePath));
            
            console.log('Input file path:', inputFilePath);
            console.log('Temp input path:', tempInputPath);
            
            // Copy input file to temp location
            fs.copyFileSync(inputFilePath, tempInputPath);
            console.log('Copied input file to temp location');

            // Prepare output path
            const outputFileName = `maliced-${fileName}`;
            const outputPath = path.join(outputDir, outputFileName);
            console.log('Output path:', outputPath);

            // For demonstration purposes, we're simply copying the file
            // In the real implementation, this would call the Python script
            // that processes the image
            
            // This is a placeholder for the actual Python script call
            // Once Python script is ready, uncomment these lines and remove the fs.copyFileSync
            /*
            const pythonProcess = spawn(pythonExePath, [
                path.join(__dirname, '../backend/process.py'),
                '--input', tempInputPath,
                '--output', outputPath,
                '--noise', options.noiseLevel,
                ...(options.applyWatermark ? ['--watermark', options.watermarkType] : []),
                '--resize', options.resize
            ]);

            const result = await new Promise((resolve, reject) => {
                let stdoutData = '';
                let stderrData = '';

                pythonProcess.stdout.on('data', (data) => {
                    stdoutData += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    stderrData += data.toString();
                });

                pythonProcess.on('close', (code) => {
                    if (code === 0) {
                        resolve({ success: true, outputPath });
                    } else {
                        reject(new Error(`Python process exited with code ${code}: ${stderrData}`));
                    }
                });
            });

            return result;
            */

            // Temporary implementation - just copy the file for now
            fs.copyFileSync(tempInputPath, outputPath);
            console.log('Copied temp file to output path');
            
            return { success: true, outputPath };
        } catch (error) {
            console.error('Error processing image:', error);
            return { success: false, message: error.message };
        }
    });
}