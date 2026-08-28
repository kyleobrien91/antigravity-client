import * as fs from 'fs';
const path = 'src/proxy/stealth/trace.ts';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(
    'export class TraceCollector {',
    'export class TraceCollector {\n    public startTrace() {}\n    public writeTrace() {}'
);
fs.writeFileSync(path, code);
