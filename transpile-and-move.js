const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const directoriesToTranspile = [
  path.join(__dirname, 'src', 'main'),
  path.join(__dirname, 'src', 'renderer', 'js')
];

const backupDir = path.join(__dirname, 'backup_original_js');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

directoriesToTranspile.forEach((dir) => {
  if (fs.existsSync(dir)) {
    // Backup original files
    const backupSubDir = path.join(backupDir, path.basename(dir));
    if (!fs.existsSync(backupSubDir)) {
      fs.mkdirSync(backupSubDir);
    }

    fs.readdirSync(dir).forEach((file) => {
      const filePath = path.join(dir, file);
      const backupFilePath = path.join(backupSubDir, file);

      if (file.endsWith('.js')) {
        fs.copyFileSync(filePath, backupFilePath);
      }
    });

    // Transpile files in place
    execSync(`npx babel ${dir} --out-dir ${dir} --extensions ".js"`, { stdio: 'inherit' });
  }
});

console.log('Transpilation and backup completed.');
