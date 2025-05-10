const { ipcMain, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('./config');

// IPCハンドラーの設定
function setupIPCHandlers() {
    // 画像選択ダイアログを開くハンドラー
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
            const tempInputPath = path.join(config.inputDir, 'temp_input' + path.extname(fileInfo.fileName));
            
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

    // 画像処理ハンドラー
    ipcMain.handle('process-image', async (event, options) => {
        try {
            console.log('Processing image with options:', options);
            
            // Copy the input file to input directory
            const inputFilePath = options.imagePath;
            
            // オリジナルのファイル名を使用（指定がない場合はパスからファイル名を取得）
            const originalFileName = options.originalFileName || path.basename(inputFilePath);
            const tempInputPath = path.join(config.inputDir, 'temp_input' + path.extname(inputFilePath));
            
            console.log('Input file path:', inputFilePath);
            console.log('Original file name:', originalFileName);
            console.log('Temp input path:', tempInputPath);
            
            // Copy input file to temp location
            fs.copyFileSync(inputFilePath, tempInputPath);
            console.log('Copied input file to temp location');

            // 出力形式の設定（デフォルトはpng）
            const outputFormat = options.outputFormat || 'png';
            
            // 出力ファイル名の生成（元のファイル名の拡張子を除去し、設定された形式の拡張子を追加）
            const filenameWithoutExt = path.parse(originalFileName).name;
            const outputFileName = `maliced-${filenameWithoutExt}.${outputFormat}`;
            const outputPath = path.join(config.outputDir, outputFileName);
            console.log('Output path:', outputPath);

            // ウォーターマークパス
            let watermarkPath = null;
            if (options.applyWatermark && options.watermarkType) {
                watermarkPath = resolveWatermarkPath(options.watermarkType);
                console.log('Using watermark:', watermarkPath);
            }

            // Python処理オプション
            const processingOptions = {
                apply_watermark: options.applyWatermark,
                watermark_path: watermarkPath,
                watermark_opacity: options.watermarkOpacity,
                invert_watermark: options.invertWatermark || false,
                enable_outline: options.enableOutline,
                watermark_size: options.watermarkSize,
                resize: options.resize,
                noise_level: parseInt(options.noiseLevel) / 7, // 0-7の値を0-1の範囲に変換
                noise_types: options.noiseTypes || ['gaussian', 'dct'], // ノイズタイプを追加
                // ロゴ位置の設定を追加
                logo_position: options.logoPosition || 'random',
                // メタデータオプションの追加 (キャメルケースをスネークケースに変換)
                remove_metadata: options.removeMetadata,
                add_fake_metadata: options.addFakeMetadata,
                fake_metadata_type: options.fakeMetadataType,
                add_no_ai_flag: options.addNoAIFlag,
                // 出力形式設定を追加
                output_format: options.outputFormat || 'png'
            };

            // JSONとしてシリアライズ
            const optionsJson = JSON.stringify(processingOptions);

            // Python スクリプトを実行
            const pythonProcess = spawn(config.pythonExePath, [
                path.join(config.appRoot, 'src', 'backend', 'process.py'),
                tempInputPath,
                outputPath,
                optionsJson
            ]);

            const result = await new Promise((resolve, reject) => {
                let stdoutData = '';
                let stderrData = '';

                pythonProcess.stdout.on('data', (data) => {
                    // Log Python stdout in a cleaner format
                    const cleanData = data.toString().replace(/\r?\n/g, ' ').trim();
                    console.log(`Python stdout: ${cleanData}`);
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

    // フォルダを開くハンドラー
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
    
    // 出力フォルダを開き、ファイルを選択するハンドラー
    ipcMain.handle('open-output-folder', async (event, filePath) => {
        try {
            console.log('Opening output folder for file:', filePath);
            
            // フォルダパスを取得
            const folderPath = path.dirname(filePath);
            
            // まずフォルダを開く
            await shell.openPath(folderPath);
            
            // 少し待ってからファイルを選択表示
            setTimeout(() => {
                shell.showItemInFolder(filePath);
            }, 500);
            
            return { success: true };
        } catch (error) {
            console.error('Error opening output folder:', error);
            return { success: false, message: error.message };
        }
    });
    
    // 設定関連のハンドラー
    ipcMain.handle('save-settings', async (event, settings) => {
        try {
            const settingsPath = path.join(config.appRoot, 'user_data', 'user-settings.json');
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
            const settingsPath = path.join(config.appRoot, 'user_data', 'user-settings.json');
            
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
            const watermarkDir = path.join(config.appRoot, 'src', 'watermark');
            
            // ディレクトリが存在するか確認
            if (!fs.existsSync(watermarkDir)) {
                console.error('Watermark directory does not exist:', watermarkDir);
                return {
                  success: false,
                  message: "watermark ディレクトリが見つかりません",
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

    // メタデータを取得するハンドラ
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
            
            // config.jsで定義されているPython実行ファイルのパスを使用
            const pythonPath = config.pythonExePath;
            
            // バックエンドスクリプトのパス
            const scriptPath = path.join(config.appRoot, 'src', 'backend', 'get_metadata.py');
            
            // Pythonスクリプトの実行
            const result = await new Promise((resolve, reject) => {
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

const resolveWatermarkPath = (watermarkType) => {
    // 絶対パスの場合はそのまま使用
    const isAbsolutePath = path.isAbsolute(watermarkType);
    if (isAbsolutePath && fs.existsSync(watermarkType)) {
        return watermarkType;
    }

    // 使用する可能性のある拡張子
    const possibleExtensions = ['.png', '.svg'];
    
    // 既に拡張子がある場合はそのまま使用
    const hasExtension = possibleExtensions.some(ext => watermarkType.toLowerCase().endsWith(ext));
    
    // 拡張子がない場合の検索用パターン
    const baseWatermarkType = hasExtension ? watermarkType : watermarkType;
    
    // 検索パス
    let foundPath = null;

    // 拡張子がすでにある場合
    if (hasExtension) {
        const userPath = path.join(config.appRoot, 'user_data', 'watermark', baseWatermarkType);
        const defaultPath = path.join(config.appRoot, 'src', 'watermark', baseWatermarkType);
        
        if (fs.existsSync(userPath)) {
            console.log(`Found watermark at user path: ${userPath}`);
            return userPath;
        } else if (fs.existsSync(defaultPath)) {
            console.log(`Found watermark at default path: ${defaultPath}`);
            return defaultPath;
        }
    } 
    // 拡張子がない場合は.pngと.svgを順に試す
    else {
        for (const ext of possibleExtensions) {
            const userPath = path.join(config.appRoot, 'user_data', 'watermark', baseWatermarkType + ext);
            const defaultPath = path.join(config.appRoot, 'src', 'watermark', baseWatermarkType + ext);
            
            if (fs.existsSync(userPath)) {
                console.log(`Found watermark at user path: ${userPath}`);
                return userPath;
            } else if (fs.existsSync(defaultPath)) {
                console.log(`Found watermark at default path: ${defaultPath}`);
                return defaultPath;
            }
        }
    }
    
    // 見つからなかった場合はエラー
    console.error(`Watermark not found: ${watermarkType} (tried with extensions: ${possibleExtensions.join(', ')})`);
    throw new Error(`Watermark not found: ${watermarkType}`);
};

module.exports = {
    setupIPCHandlers
};