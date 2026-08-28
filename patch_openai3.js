const fs = require('fs');
const path = 'src/proxy/routes/openai-routes.ts';
let code = fs.readFileSync(path, 'utf8');

const lines = code.split('\n');
if (lines[82].includes('isCompleted = true')) {
    lines.splice(82, 1);
}
code = lines.join('\n');
fs.writeFileSync(path, code);
