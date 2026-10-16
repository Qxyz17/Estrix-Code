import rcedit from 'rcedit';
const exe = 'C:/Users/seewo/estrix-work/estrix2/node_modules/electron/dist/electron.exe';
const ico = 'C:/Users/seewo/estrix-work/estrix2/build/icon.ico';
await rcedit(exe, { icon: ico });
console.log('icon changed');
