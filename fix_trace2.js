const fs = require('fs');
let code = fs.readFileSync('src/proxy/stealth/trace.ts', 'utf8');
code = code.replace(/Bearer\.\+\[A-Za-z0-9\.\._~\+\.\]\+=/gi, 'Bearer\\\\s+[A-Za-z0-9\\\\-\\\\_~\\\\+/]+=');
code = code.replace(/ya29\.\[A-Za-z0-9\.\._~\+\.\]\+/gi, 'ya29\\\\.[A-Za-z0-9\\\\-\\\\_~\\\\+/]+');
fs.writeFileSync('src/proxy/stealth/trace.ts', code);
