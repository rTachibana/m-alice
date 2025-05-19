"use strict";

// IPC通信ブリッジ - レンダラープロセスとメインプロセス間の通信をwindow.api経由で抽象化

const handleDroppedFileData = async data => {
  return await window.api.handleDroppedFileData(data);
};

const selectImage = async () => {
  return await window.api.selectImage();
};

const processImage = async options => {
  return await window.api.processImage(options);
};

const getImageMetadata = async imagePath => {
  return await window.api.getImageMetadata(imagePath);
};

const showItemInFolder = filePath => {
  window.api.showItemInFolder(filePath);
};

const getWatermarks = async () => {
  return await window.api.getWatermarks();
};

const loadSettings = async () => {
  return await window.api.loadSettings();
};

const saveSettings = async settings => {
  return await window.api.saveSettings(settings);
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