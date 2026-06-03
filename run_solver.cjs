const { execSync } = require('child_process');
const fs = require('fs');
const https = require('https');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('--- Checking python3 ---');
  try {
    const pyVersion = execSync('python3 --version', { encoding: 'utf8' });
    console.log(`Python: ${pyVersion.trim()}`);
  } catch (e) {
    console.error('Failed to locate python3:', e.message);
    return;
  }

  console.log('\n--- Bootstrapping pip ---');
  try {
    const pipUrl = 'https://bootstrap.pypa.io/get-pip.py';
    const pipDest = './get-pip.py';
    console.log(`Downloading get-pip.py from ${pipUrl}...`);
    await downloadFile(pipUrl, pipDest);
    console.log('Running get-pip.py...');
    execSync('python3 ./get-pip.py --break-system-packages', { stdio: 'inherit' });
    fs.unlinkSync(pipDest);
    console.log('Pip bootstrapped successfully!');
  } catch (e) {
    console.error('Failed to bootstrap pip:', e.message);
  }

  console.log('\n--- Installing ortools ---');
  try {
    console.log('Installing ortools...');
    execSync('python3 -m pip install ortools --break-system-packages', { stdio: 'inherit' });
  } catch (e) {
    console.error('Failed to install ortools via pip module:', e.message);
  }

  console.log('\n--- Running msta_solver.py ---');
  try {
    const result = execSync('python3 ./msta_solver.py', { encoding: 'utf8' });
    console.log(result);
  } catch (e) {
    console.error('Failed to execute msta_solver.py:', e.message || e);
  }
}

main();
