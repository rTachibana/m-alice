const { ipcRenderer } = require('electron');

async function setupPython(options = {}) {
  return await ipcRenderer.invoke('setup-python', options);
}

module.exports = { setupPython }; 