#!/usr/env/bin node
import { runExtract } from './commands/extract.js';
import { runServe } from './commands/serve.js';

const command = process.argv[2];

async function main() {
    switch (command) {
        case 'extract':
            await runExtract();
            break;
        case 'serve':
            const portIndex = process.argv.indexOf('--port');
            const port = portIndex > -1 ? parseInt(process.argv[portIndex + 1], 10) : 8741;
            await runServe(port);
            break;
        case 'fingerprint':
            const { getDeviceFingerprint, getIdeVersion } = await import('../proxy/stealth/fingerprint.js');
            console.log(`Device Fingerprint: ${getDeviceFingerprint()}`);
            console.log(`IDE Version: ${getIdeVersion()}`);
            break;
        default:
            console.log(`
ZeroGravity-style Proxy CLI for Antigravity

Usage:
  ag extract                Extract OAuth token from Antigravity IDE
  ag serve [--port 8741]    Start the multi-protocol proxy server
  ag fingerprint            Show stealth device fingerprint and IDE info
            `);
            break;
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
