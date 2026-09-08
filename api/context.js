const fs = require('fs');
const path = require('path');

const DATA_ROOT = path.join(__dirname, 'data');
const MAX_TEXT_PER_FILE = 22000;
const MAX_TOTAL = 60000;

let contextPromise = null;

function listMarkdownFiles(dir, out) {
  out = out || [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listMarkdownFiles(full, out);
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function readUnits() {
  try {
    const raw = fs.readFileSync(path.join(DATA_ROOT, 'units.json'), 'utf8');
    const data = JSON.parse(raw);
    return data.units || [];
  } catch (err) {
    return [];
  }
}

async function buildContext() {
  const units = readUnits();
  const files = listMarkdownFiles(DATA_ROOT);
  const parts = [];

  parts.push('الوحدات الدراسية المتوفرة في المشروع وملخصاتها:');

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (err) {
      continue;
    }

    const rel = path.relative(DATA_ROOT, file);
    const folder = path.basename(path.dirname(file));
    const unit = units.find(function (u) {
      return folder === unitFolder(u) || folder === u.title;
    }) || units.find(function (u) {
      return (u.files || []).some(function (f) {
        return rel.indexOf(String(f.path || '')) !== -1;
      });
    });

    parts.push('## الوحدة: ' + (unit ? unit.title : rel));
    const body = content.trim();
    if (body) {
      parts.push(body.slice(0, MAX_TEXT_PER_FILE));
    } else {
      parts.push('(ملف فارغ)');
    }
  }

  let ctx = parts.join('\n\n');
  if (ctx.length > MAX_TOTAL) {
    ctx = ctx.slice(0, MAX_TOTAL) + '\n...(مقتطع لضيق المساحة)';
  }
  return ctx;
}

function unitFolder(unit) {
  const p = String(unit.folder || '');
  if (p) return p;
  const files = Array.isArray(unit.files) ? unit.files : [];
  for (const f of files) {
    const parts = String((f && f.path) || '').split(/[\\/]/);
    if (parts.length > 1) return parts[parts.length - 2];
  }
  return unit.title || '';
}

function getProjectContext() {
  if (!contextPromise) contextPromise = buildContext();
  return contextPromise;
}

module.exports = { getProjectContext };
