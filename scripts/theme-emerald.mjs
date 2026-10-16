import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'C:/Users/seewo/estrix-work/estrix2';
const files = ['src/ui/shell/styles/base.css','src/overlay/template/overlay.css'];
const repl = [
  ['--ck-primary: #4d6bfe', '--ck-primary: #047857'],
  ['--ck-primary-strong: #3b5bdb', '--ck-primary-strong: #065f46'],
  ['--ck-primary-soft: rgba(77, 107, 254, 0.08)', '--ck-primary-soft: rgba(4, 120, 87, 0.08)'],
  ['--ck-primary: #8b93ff', '--ck-primary: #10b981'],
  ['--ck-primary-strong: #6d76ff', '--ck-primary-strong: #059669'],
  ['--ck-primary-soft: rgba(107, 131, 255, 0.16)', '--ck-primary-soft: rgba(16, 185, 129, 0.16)'],
  ['--ck-primary: #6b83ff', '--ck-primary: #10b981'],
  ['--ck-primary-strong: #8b9dff', '--ck-primary-strong: #34d399'],
  ['#4d6bfe', '#047857'], ['#6b83ff', '#10b981'], ['#8b93ff', '#10b981'],
  ['rgba(139,147,255', 'rgba(16,185,129'], ['rgba(139, 147, 255', 'rgba(16, 185, 129'],
  ['rgba(77,107,254', 'rgba(4,120,87'], ['rgba(77, 107, 254', 'rgba(4, 120, 87'],
  ['rgba(107, 131, 255', 'rgba(16, 185, 129'],
];
let n=0;
for (const f of files) { const p=path.join(ROOT,f); if(!fs.existsSync(p)){console.log('missing '+f);continue;} let s=fs.readFileSync(p,'utf-8'); const o=s; for(const [a,b] of repl) s=s.split(a).join(b); if(s!==o){fs.writeFileSync(p,s,'utf-8');n++;console.log('updated '+f);} }
console.log('done '+n);
