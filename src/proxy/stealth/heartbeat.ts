import { AntigravityClient } from '../../core/client.js';

export function startHeartbeatLoop(client: AntigravityClient): { stop: () => void } {
    let timeoutId: NodeJS.Timeout | null = null;
    let isStopped = false;

    const loop = async () => {
        if (isStopped) return;

        // Calculate randomized Gaussian jitter between 29500 and 30500 ms
        let u1 = 0, u2 = 0;
        while (u1 === 0) u1 = Math.random();
        while (u2 === 0) u2 = Math.random();

        // Box-Muller transform for standard normal distribution
        const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

        // Mean = 30000, StdDev = 500 / 3 (so 99.7% of values fall within ±500)
        let result = z * (500 / 3) + 30000;

        // Clamp to strictly [29500, 30500]
        if (result < 29500) result = 29500;
        if (result > 30500) result = 30500;

        const jitter = Math.floor(result);

        timeoutId = setTimeout(async () => {
            if (isStopped) return;

            try {
                // Heartbeat call using the lsClient. It must be wrapped in Promise.race
                // just in case it hangs, although the core heartbeat method is expected to be fast.
                // We'll use a standard try/catch to suppress transient network errors without crashing.
                await client.lsClient.heartbeat({});
                console.debug(`[Heartbeat] Heartbeat successful`);
            } catch (e: any) {
                // Suppress transient network errors.
                // If it's a critical error indicating LS is dead, we might terminate the loop.
                const errMsg = e?.message || '';
                console.warn(`[Heartbeat] Heartbeat failed: ${errMsg}`);

                // If connection is refused, it likely means the LS process is verifiably dead.
                if (errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed')) {
                    console.error(`[Heartbeat] LS process appears dead, terminating heartbeat loop.`);
                    isStopped = true;
                    return;
                }
            }

            // Continue the loop recursively
            if (!isStopped) {
                loop();
            }
        }, jitter);
    };

    // Start the loop
    loop();

    return {
        stop: () => {
            isStopped = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        }
    };
}
