import { AntigravityClient } from '../src/core/client.js';
import { runWebviewWarmup } from '../src/proxy/stealth/warmup.js';
import { AccountRotator } from '../src/accounts/rotator.js';
import { AccountsStore } from '../src/accounts/store.js';

async function main() {
    console.log("Setting up client for warmup test...");
    const store = new AccountsStore();
    const rotator = new AccountRotator(store);

    const activeAccount = await rotator.getActiveAccount();
    if (!activeAccount) {
        console.error("No active accounts found.");
        process.exit(1);
    }

    const client = await AntigravityClient.launch({
        workspacePath: process.cwd(),
        authData: {
            apiKey: activeAccount.access_token || '',
            email: activeAccount.email,
            name: activeAccount.alias || activeAccount.email,
            ussOAuth: {
                key: 'oauthTokenInfoSentinelKey',
                value: Buffer.from(JSON.stringify({
                    accessToken: activeAccount.access_token,
                    refreshToken: activeAccount.refresh_token,
                    expiry: { seconds: Math.floor((activeAccount.expires_at || 0) / 1000) }
                })).toString('base64')
            }
        }
    });

    console.log("Client launched. Running warmup sequence...");
    await runWebviewWarmup(client);
    console.log("Warmup sequence completed.");
    process.exit(0);
}

main().catch(console.error);
