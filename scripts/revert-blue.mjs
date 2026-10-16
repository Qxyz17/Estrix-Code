import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'C:/Users/seewo/estrix-work/estrix2';
function walk(d, o=[]) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'out' || e.name === 'dist') continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (/\.(css|html|ts|js)$/.test(e.name)) o.push(p);
  }
  return o;
}
const files = walk(path.join(ROOT, 'src'));
const repl = [
  // 把我之前改的 emerald 值换回原蓝
  ['#047857', '#4d6bfe'],
  ['#065f46', '#3b5bdb'],
  ['rgba(4,120,87', 'rgba(77,107,254'],
  ['rgba(4, 120, 87', 'rgba(77, 107, 254'],
  ['#10b981', '#6b83ff'],
  ['#059669', '#8b9dff'],
  ['#34d399', '#8b9dff'],
  ['rgba(16,185,129', 'rgba(107,131,255'],
  ['rgba(16, 185, 129', 'rgba(107, 131, 255'],
  ['#78716c', '#5d6280'],
];
let n=0;
for (const f of files) {
  let s = fs.readFileSync(f,'utf-8'); const o=s;
  for (const [a,b] of repl) s = s.split(a).join(b);
  if (s!==o) { fs.writeFileSync(f,s,'utf-8'); n++; }
}
console.log('reverted: '+n+' files');
