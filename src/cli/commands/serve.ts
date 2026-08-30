import { AntigravityClient } from '../../core/client.js';
import { startProxyServer } from '../../proxy/server.js';
import { AccountRotator } from '../../accounts/rotator.js';
import { AccountsStore } from '../../accounts/store.js';
import { getDeviceFingerprint, getIdeVersion, getExtensionVersion } from '../../proxy/stealth/fingerprint.js';
import { runWebviewWarmup } from '../../proxy/stealth/warmup.js';
import { startHeartbeatLoop } from '../../proxy/stealth/heartbeat.js';
import { OAuthTokenInfo } from '../../gen/exa/language_server_pb/language_server_pb.js';
import { Timestamp } from '@bufbuild/protobuf';

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

    const oauthInfo = new OAuthTokenInfo();
    oauthInfo.accessToken = activeAccount.access_token || '';
    oauthInfo.refreshToken = activeAccount.refresh_token || '';
    if (activeAccount.expires_at) {
        oauthInfo.expiry = Timestamp.fromDate(new Date(activeAccount.expires_at));
    }

    // Launch standalone LS with extracted token and stealth metadata
    const client = await AntigravityClient.launch({
        workspacePath: process.cwd(),
        authData: {
            apiKey: activeAccount.access_token || '',
            email: activeAccount.email,
            name: activeAccount.alias || activeAccount.email,
            ussOAuth: {
                key: 'oauthTokenInfoSentinelKey',
                value: Buffer.from(oauthInfo.toBinary()).toString('base64')
            }
        }
    });

    try {
        const authStatus = await Promise.race([
            client.getAuthStatus(),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
        ]);
        if (authStatus?.authResult?.hasValidAuth) {
            console.log(`✅ Successfully authenticated with Antigravity Language Server!`);
        } else {
            console.log(`✅ Successfully connected to Antigravity Language Server! (USS OAuth active)`);
        }
    } catch (e: any) {
        if (e.message && e.message.includes('429')) {
            await rotator.reportFailure(429);
        } else if (e.message && e.message.includes('403')) {
            await rotator.reportFailure(403);
        } else {
            console.warn(`[Serve] Notice on startup auth check: ${e.message}`);
        }
    }

    // Run the required startup warmup sequence before exposing the proxy
    await runWebviewWarmup(client);

    // Start background heartbeat loop
    const heartbeat = startHeartbeatLoop(client);

    // Register stop callbacks on process termination
    process.on('SIGINT', () => {
        heartbeat.stop();
        process.exit(0);
    });
    process.on('SIGTERM', () => {
        heartbeat.stop();
        process.exit(0);
    });

    startProxyServer({ port, client });
}
