import { AntigravityClient } from '../../core/client.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomJitter = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export async function runWebviewWarmup(client: AntigravityClient): Promise<void> {
    console.log(`[Warmup] Running webview warmup sequence...`);

    const methods = [
        'getServerConfiguration',
        'getAuthStatus',
        'hasAuthToken',
        'getAvailableModels',
        'getStatus',
        'heartbeat',
        'getWorkspaceInfos',
        'getWorkingDirectories',
        'getAllCascadeTrajectories',
        'getMcpServerStates',
        'getWebDocsOptions',
        'getRepoInfos',
        'getAllSkills',
    ] as const;

    await Promise.allSettled(methods.map(async (method) => {
        try {
            const delay = randomJitter(20, 80);
            await sleep(delay);

            const reqFunc = (client.lsClient as any)[method];
            if (typeof reqFunc === 'function') {
                await Promise.race([
                    reqFunc.bind(client.lsClient)({}),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
                ]);
                console.log(`[Warmup] ${method} successful`);
            }
        } catch (e: any) {
            // Silently ignore warmup timeouts/unimplemented errors
        }
    }));

    console.log(`[Warmup] Webview warmup sequence complete`);
}
