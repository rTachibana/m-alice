"use strict";

/**
 * IPC通信ブリッジ - レンダラープロセスとメインプロセス間の通信を抽象化
 */
const {
  ipcRenderer
} = require('electron');

/**
 * ドロップされたファイルデータを処理
 * @param {Object} data - ファイルデータ
 * @returns {Promise<{success: boolean, filePath: string, message: string}>}
 */
const handleDroppedFileData = async data => {
  return await ipcRenderer.invoke('handle-dropped-file', data);
};

/**
 * ファイル選択ダイアログを開く
 * @returns {Promise<{canceled: boolean, filePaths: string[]}>}
 */
const selectImage = async () => {
  return await ipcRenderer.invoke('select-image');
};

/**
 * 画像処理を実行
 * @param {Object} options - 処理オプション
 * @returns {Promise<{success: boolean, outputPath: string, message: string}>}
 */
const processImage = async options => {
  return await ipcRenderer.invoke('process-image', options);
};

/**
 * 画像のメタデータを取得
 * @param {string} imagePath - 画像のパス
 * @returns {Promise<{success: boolean, metadata: Object, message: string}>}
 */
const getImageMetadata = async imagePath => {
  return await ipcRenderer.invoke('get-metadata', imagePath);
};

/**
 * ファイルをエクスプローラーで表示
 * @param {string} filePath - 表示するファイルのパス
 */
const showItemInFolder = filePath => {
  ipcRenderer.send('show-item-in-folder', filePath);
};

/**
 * ウォーターマーク一覧を取得
 * @returns {Promise<{success: boolean, watermarks: Array, message: string}>}
 */
const getWatermarks = async () => {
  return await ipcRenderer.invoke('get-watermarks');
};

/**
 * 設定を読み込む
 * @returns {Promise<{success: boolean, settings: Object, message: string}>}
 */
const loadSettings = async () => {
  return await ipcRenderer.invoke('load-settings');
};

/**
 * 設定を保存する
 * @param {Object} settings - 保存する設定
 * @returns {Promise<{success: boolean, message: string}>}
 */
const saveSettings = async settings => {
  return await ipcRenderer.invoke('save-settings', settings);
};
module.exports = {
  handleDroppedFileData,
  selectImage,
  processImage,
  getImageMetadata,
  showItemInFolder,
  getWatermarks,
  loadSettings,
  saveSettings
};