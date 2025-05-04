/**
 * 画像処理パラメータサービス - UI設定からPython処理パラメータを構築
 */
const metadataService = require('./metadata');

/**
 * UI設定からPython処理パラメータを構築
 * @param {Object} settings - ユーザー設定
 * @param {string} inputPath - 入力画像のパス
 * @param {string} outputPath - 出力先のパス
 * @returns {Object} Python処理パラメータ
 */
const buildProcessingParams = (settings, inputPath, outputPath) => {
    if (!settings || !inputPath) {
        throw new Error('設定または入力パスが指定されていません');
    }
    
    // 基本パラメータ
    const params = {
        input_path: inputPath,
        output_path: outputPath || settings.savePath || '',
        overwrite_original: settings.overwriteOriginal || false,
        
        // 画像処理パラメータ
        noise_strength: settings.noiseStrength || 0,
        blur_strength: settings.blurStrength || 0,
        jpeg_quality: settings.jpegQuality || 90,
        
        // ウォーターマークパラメータ
        add_watermark: settings.addWatermark || false,
        watermark_type: settings.watermarkType || 'none',
        watermark_opacity: settings.watermarkOpacity || 0.5,
        watermark_position: settings.watermarkPosition || 'bottomRight'
    };
    
    // メタデータパラメータを追加
    const metadataParams = metadataService.buildMetadataParams(settings);
    
    // すべてのパラメータを統合
    return {
        ...params,
        ...metadataParams
    };
};

/**
 * 処理結果を解析
 * @param {Object} result - Pythonからの処理結果
 * @returns {Object} 解析された処理結果
 */
const parseProcessingResult = (result) => {
    if (!result) {
        return {
            success: false,
            message: '処理結果が空です',
            outputPath: null,
            statistics: {}
        };
    }
    
    return {
        success: result.success || false,
        message: result.message || '処理結果のメッセージがありません',
        outputPath: result.output_path || null,
        statistics: {
            processingTime: result.processing_time || 0,
            originalSize: result.original_size || 0,
            processedSize: result.processed_size || 0,
            pixelsModified: result.pixels_modified || 0,
            percentageChanged: result.percentage_changed || 0
        }
    };
};

module.exports = {
    buildProcessingParams,
    parseProcessingResult
};