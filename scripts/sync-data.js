const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'api', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

fs.copyFileSync(
  path.join(PUBLIC_DIR, 'units.json'),
  path.join(DATA_DIR, 'units.json')
);

const srcData = path.join(PUBLIC_DIR, 'البيانات');
const destData = path.join(DATA_DIR, 'البيانات');
fs.rmSync(destData, { recursive: true, force: true });
fs.cpSync(srcData, destData, { recursive: true });

console.log('تمت مزامنة البيانات إلى api/data');