#!/usr/bin/env node
/**
 * Lightweight secret scanner — fails CI when obvious credentials are committed.
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PATTERNS = [
  'sk_live_[a-zA-Z0-9]+',
  'sk_test_[a-zA-Z0-9]{20,}',
  'mongodb\\+srv://[^\\s"\']+',
  'BEGIN (RSA |EC )?PRIVATE KEY',
  'AKIA[0-9A-Z]{16}',
];

const IGNORE = [
  'node_modules',
  'dist',
  '.env.example',
  'secret-scan.js',
  'SECURITY_REPORT.md',
];

let output = '';
try {
  output = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
} catch {
  console.log('Secret scan: not a git worktree — skipping');
  process.exit(0);
}

const files = output
  .split('\n')
  .map((f) => f.trim())
  .filter((f) => f && !IGNORE.some((i) => f.includes(i)));

const hits = [];

for (const file of files) {
  const full = path.join(ROOT, file);
  let content;
  try {
    content = require('fs').readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  if (file.endsWith('.png') || file.endsWith('.jpg')) continue;

  for (const pattern of PATTERNS) {
    const re = new RegExp(pattern, 'g');
    if (re.test(content)) {
      hits.push(`${file} (matched /${pattern}/)`);
    }
  }
}

if (hits.length) {
  console.error('Secret scan failed — possible credentials in repository:\n');
  hits.forEach((h) => console.error(`  - ${h}`));
  process.exit(1);
}

console.log('Secret scan passed');
