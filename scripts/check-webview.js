const { readdirSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const scriptsDir = join(__dirname, '..', 'webview', 'scripts');
const files = readdirSync(scriptsDir)
  .filter((file) => file.endsWith('.js'))
  .sort();

let failed = false;

for (const file of files) {
  const filePath = join(scriptsDir, file);
  const result = spawnSync(process.execPath, ['--check', filePath], {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Checked ${files.length} webview scripts.`);
