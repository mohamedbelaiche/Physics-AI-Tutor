const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.join(__dirname, 'data');
const MAX_TEXT_PER_FILE = 22000;
const MAX_TOTAL = 60000;

let PDFParse = null;
try {
  ({ PDFParse } = require('pdf-parse'));
} catch (err) {
  PDFParse = null;
}

const cache = {};
let contextPromise = null;

async function extractPdfText(filePath) {
  if (cache[filePath] !== undefined) return cache[filePath];
  cache[filePath] = '';
  if (!PDFParse) return '';
  try {
    const buf = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: buf });
    const res = await parser.getText();
    const text = (res && res.text) || '';
    const len = text.length;
    const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
    if (arabic > 50 && arabic / Math.max(len, 1) > 0.05) {
      cache[filePath] = text;
      return text;
    }
    return '';
  } catch (err) {
    return '';
  }
}

async function readUnits() {
  try {
    const raw = fs.readFileSync(path.join(DATA_ROOT, 'units.json'), 'utf8');
    const data = JSON.parse(raw);
    return data.units || [];
  } catch (err) {
    return [];
  }
}

async function buildContext() {
  const units = await readUnits();
  const parts = [];
  parts.push('الوحدات الدراسية المتوفرة في المشروع وملخصاتها:');

  for (const unit of units) {
    const files = Array.isArray(unit.files) ? unit.files : [];
    if (!files.length) {
      parts.push('الوحدة "' + unit.title + '" (' + (unit.description || 'بدون وصف') + '): لا يوجد ملفات.');
      continue;
    }
    parts.push('الوحدة "' + unit.title + '" (' + (unit.description || '') + '):');
    for (const file of files) {
      const absPath = path.join(DATA_ROOT, file.path);
      if (!fs.existsSync(absPath)) {
        parts.push(' - ' + (file.label || file.path) + ': الملف غير موجود.');
        continue;
      }
      const text = await extractPdfText(absPath);
      if (text) {
        parts.push('(ملخص: ' + (file.label || file.path) + ')');
        parts.push(text.slice(0, MAX_TEXT_PER_FILE));
      } else {
        parts.push(' - ' + (file.label || file.path) + ': يتوفر الملف لكن لا يمكن استخراج نص مقروء منه.');
      }
    }
  }

  let ctx = parts.join('\n\n');
  if (ctx.length > MAX_TOTAL) {
    ctx = ctx.slice(0, MAX_TOTAL) + '\n...(مقتطع لضيق المساحة)';
  }
  return ctx;
}

function getProjectContext() {
  if (!contextPromise) contextPromise = buildContext();
  return contextPromise;
}

module.exports = { getProjectContext };