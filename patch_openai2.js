const fs = require('fs');
const path = 'src/proxy/routes/openai-routes.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
    /                await reqPromise;\n                isCompleted = true;\n \n                trace\.addTurn\(\{ turn: 1, mitm_matched: true, response/g,
    '                await reqPromise;\n\n                trace.addTurn({ turn: 1, mitm_matched: true, response'
);

fs.writeFileSync(path, code);
