import { AntigravityClient } from '../../core/client.js';
import { SetUserSettingsRequest } from '../../gen/exa/language_server_pb/language_server_pb.js';
import { UserSettings, DetectAndUseProxy } from '../../gen/exa/codeium_common_pb/codeium_common_pb.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomJitter = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export async function runWebviewWarmup(client: AntigravityClient): Promise<void> {
    console.log(`[Warmup] Running webview warmup sequence...`);

    // 1. SetUserSettings (CRITICAL for setting detect_and_use_proxy)
    try {
        const settingsReq = new SetUserSettingsRequest({
            userSettings: new UserSettings({
                detectAndUseProxy: DetectAndUseProxy.ENABLED
            })
        });

        await Promise.race([
            client.lsClient.setUserSettings(settingsReq),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        console.log(`[Warmup] SetUserSettings (detect_and_use_proxy=ENABLED) successful`);
    } catch (e: any) {
        console.warn(`[Warmup] SetUserSettings failed or timed out: ${e.message}`);
    }

    const methods = [
        'getStatus',
        'heartbeat',
        'getUserStatus',
        'getCascadeModelConfigs',
        'getCascadeModelConfigData',
        'getWorkspaceInfos',
        'getWorkingDirectories',
        'getAllCascadeTrajectories',
        'getMcpServerStates',
        'getWebDocsOptions',
        'getRepoInfos',
        'getAllSkills',
        'initializeCascadePanelState'
    ] as const;

    for (const method of methods) {
        try {
            // Wait for 50-200ms
            const delay = randomJitter(50, 200);
            await sleep(delay);

            // Using any to dynamically call the methods on lsClient
            const reqFunc = (client.lsClient as any)[method];
            if (typeof reqFunc === 'function') {
                await Promise.race([
                    reqFunc.bind(client.lsClient)({}),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                ]);
                console.debug(`[Warmup] ${method} successful`);
            } else {
                console.warn(`[Warmup] Method ${method} not found on lsClient`);
            }
        } catch (e: any) {
            console.warn(`[Warmup] ${method} failed or timed out: ${e.message}`);
        }
    }

    console.log(`[Warmup] Webview warmup sequence complete`);
}
