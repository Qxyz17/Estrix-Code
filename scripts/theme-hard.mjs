import fs from 'node:fs';
const base='C:/Users/seewo/estrix-work/estrix2';
const files=['src/overlay/panel.ts','src/overlay/panels/mcp-manager.ts','src/ui/shell/scripts/pages/windows.ts'];
const repl=[['#8b93ff','#10b981'],['#6d76ff','#059669'],['#4d6bfe','#047857'],['#3b5bdb','#065f46'],['#5d6280','#78716c']];
let n=0;
for(const f of files){const p=base+'/'+f;if(!fs.existsSync(p)){console.log('miss '+f);continue;}let s=fs.readFileSync(p,'utf-8');const o=s;for(const[a,b]of repl)s=s.split(a).join(b);if(s!==o){fs.writeFileSync(p,s,'utf-8');n++;console.log('upd '+f);}}
console.log('done '+n);
