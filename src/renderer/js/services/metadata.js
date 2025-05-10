const path = require('path');
const ipcBridge = require(path.join(__dirname, '../utils/ipcBridge'));

/**
 * 画像のメタデータを取得
 * @param {string} imagePath - メタデータを取得する画像のパス
 * @returns {Promise<{success: boolean, metadata: Object, message: string}>}
 */
const getImageMetadata = async (imagePath) => {
    try {
        if (!imagePath) {
            return {
                success: false,
                metadata: {},
                message: '画像パスが指定されていません'
            };
        }
        
        const result = await ipcBridge.getImageMetadata(imagePath);
        return result;
    } catch (error) {
        console.error('Error getting image metadata:', error);
        return {
            success: false,
            metadata: {},
            message: `メタデータの取得に失敗しました: ${error.message}`
        };
    }
};

/**
 * 設定からメタデータパラメータを構築
 * @param {Object} settings - ユーザー設定
 * @returns {Object} メタデータパラメータ
 */
const buildMetadataParams = (settings) => {
    if (!settings) {
        throw new Error('設定が指定されていません');
    }
    
    return {
        // メタデータ基本設定
        remove_metadata: settings.removeMetadata || false,
        
        // フェイクメタデータ設定
        add_fake_metadata: settings.addFakeMetadata || false,
        fake_metadata_type: settings.fakeMetadataType || 'generic',
        
        // AIフラグ設定
        add_no_ai_flag: settings.addNoAIFlag || false
    };
};

/**
 * メタデータの特定のタグを解析
 * @param {Object} metadata - 画像から抽出されたメタデータ
 * @param {string} tagName - 探すタグの名前
 * @returns {string|null} タグの値、見つからない場合はnull
 */
const extractMetadataTag = (metadata, tagName) => {
    if (!metadata || !tagName) {
        return null;
    }
    
    // 一般的なEXIFタグのマッピング
    const tagMappings = {
        'model': ['Model', 'Camera', 'CameraModel'],
        'software': ['Software', 'ProcessingSoftware', 'Generator'],
        'author': ['Artist', 'Author', 'Creator'],
        'created': ['DateCreated', 'CreateDate', 'DateTimeOriginal']
    };
    
    // タグの別名がある場合は、それらも検索
    const tagsToSearch = [tagName, ...(tagMappings[tagName.toLowerCase()] || [])];
    
    // 各セクションのタグを検索
    for (const section in metadata) {
        for (const tag in metadata[section]) {
            if (tagsToSearch.some(t => 
                tag.toLowerCase().includes(t.toLowerCase()) || 
                t.toLowerCase().includes(tag.toLowerCase()))) {
                return metadata[section][tag];
            }
        }
    }
    
    return null;
};

/**
 * メタデータからAI生成の可能性を判定
 * @param {Object} metadata - 画像から抽出されたメタデータ
 * @returns {{isAIGenerated: boolean, confidence: number, reason: string}} 判定結果
 */
const detectAIGeneration = (metadata) => {
    if (!metadata) {
        return {
            isAIGenerated: false,
            confidence: 0,
            reason: 'メタデータがありません'
        };
    }
    
    let confidence = 0;
    let reasons = [];
    
    // 特定のソフトウェア名の検出
    const software = extractMetadataTag(metadata, 'software');
    if (software) {
        const aiSoftwarePatterns = [
            'stable diffusion', 'midjourney', 'dall-e', 'comfyui', 
            'deepdream', 'neural', 'gan', 'generative', 'ai generated'
        ];
        
        for (const pattern of aiSoftwarePatterns) {
            if (software.toLowerCase().includes(pattern)) {
                confidence += 30;
                reasons.push(`AIソフトウェアの痕跡を検出: "${pattern}"`);
                break;
            }
        }
    }
    
    // AIプロンプトの痕跡
    for (const section in metadata) {
        for (const tag in metadata[section]) {
            const value = metadata[section][tag].toString().toLowerCase();
            if (
                tag.toLowerCase().includes('prompt') || 
                value.includes('prompt:') || 
                value.includes('negative prompt:') ||
                value.includes('steps:') && value.includes('sampler:') ||
                value.includes('cfg scale:')
            ) {
                confidence += 40;
                reasons.push(`AIプロンプト情報を検出: "${tag}"`);
                break;
            }
        }
    }
    
    // 判定結果のまとめ
    return {
        isAIGenerated: confidence >= 50,
        confidence: Math.min(confidence, 100),
        reason: reasons.length > 0 ? reasons.join(', ') : 'AIの痕跡は検出されませんでした'
    };
};

module.exports = {
    getImageMetadata,
    buildMetadataParams,
    extractMetadataTag,
    detectAIGeneration
};