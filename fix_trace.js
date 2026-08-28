const fs = require('fs');
let code = fs.readFileSync('src/proxy/stealth/trace.ts', 'utf8');
code = code.replace(/\\\./g, '.');
code = code.replace(/\\\//g, '/');
fs.writeFileSync('src/proxy/stealth/trace.ts', code);
