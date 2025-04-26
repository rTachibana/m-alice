const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const logFilePath = path.join(__dirname, '../logs/test_results.log');
const pythonPath = path.join(__dirname, '../python/python.exe'); // ポータブル版Pythonのパス

// Run tests and capture results
const runTests = () => {
    return new Promise((resolve, reject) => {
        const command = `${pythonPath} -m pytest tests/test_process.py && npx jest tests/renderer.test.js`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                resolve(`ERROR:\n${stderr}`);
            } else {
                resolve(stdout);
            }
        });
    });
};

// Update test results log
const updateLog = async () => {
    try {
        const results = await runTests();
        fs.writeFileSync(logFilePath, results);
        console.log('Test results updated in log file.');
    } catch (err) {
        console.error('Failed to update test results:', err);
    }
};

updateLog();