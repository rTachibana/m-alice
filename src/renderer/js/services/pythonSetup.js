"use strict";

async function setupPython(options = {}) {
  return await window.api.setupPython(options);
}
window.pythonSetupService = {
  setupPython: async function(options = {}) {
    return await window.api.setupPython(options);
  }
};