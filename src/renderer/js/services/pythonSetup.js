"use strict";

// require('electron')を削除
async function setupPython(options = {}) {
  return await window.api.setupPython(options);
}
module.exports = {
  setupPython
};