// CI 专用：electron-builder 26.13 的 dynamicImport 对 CJS 包无扩展名子路径解析失败，
// 把 @electron/osx-sign/dist/cjs/util-identities 补成 .js。仅改 node_modules，不影响源码。
const fs = require('fs');
const files = [
  'node_modules/electron-builder/node_modules/app-builder-lib/out/mac/MacTargetHelper.js',
  'node_modules/electron-builder/node_modules/app-builder-lib/out/codeSign/macCodeSign.js',
];
let n = 0;
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  s = s.replace(/"@electron\/osx-sign\/dist\/cjs\/util-identities"/g, '"@electron/osx-sign/dist/cjs/util-identities.js"');
  if (s !== before) { fs.writeFileSync(f, s); n++; }
}
console.log('[patch-osx-sign] patched files=' + n);
