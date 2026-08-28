import { AntigravityClient } from '../../core/client.js';
import { startProxyServer } from '../../proxy/server.js';
import { AccountRotator } from '../../accounts/rotator.js';
import { AccountsStore } from '../../accounts/store.js';
import { getDeviceFingerprint, getIdeVersion, getExtensionVersion } from '../../proxy/stealth/fingerprint.js';

export async function runServe(port: number) {
    console.log(`[Serve] Initializing ZeroGravity-style Proxy...`);
    console.log(`[Stealth] Fingerprint: ${getDeviceFingerprint()}`);
    console.log(`[Stealth] IDE Version: ${getIdeVersion()} | Ext: ${getExtensionVersion()}`);
    console.log(`[Stealth] Sensitive Words Obfuscation: Active`);

    const store = new AccountsStore();
    const rotator = new AccountRotator(store);

    const activeAccount = await rotator.getActiveAccount();
    if (!activeAccount) {
        console.error(`❌ No active accounts found. Run 'ag extract' first.`);
        process.exit(1);
    }

    console.log(`[Serve] Authenticating with account: ${activeAccount.email}`);

    // Launch standalone LS with extracted token and stealth metadata
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

    try {
        await client.getUserStatus();
        console.log(`✅ Successfully connected to Antigravity Language Server!`);
    } catch (e: any) {
        if (e.message && e.message.includes('429')) {
            await rotator.reportFailure(429);
        } else if (e.message && e.message.includes('403')) {
            await rotator.reportFailure(403);
        } else {
            console.warn(`[Serve] Warning on startup auth check: ${e.message}`);
        }
    }

    startProxyServer({ port, client });
}
