/**
 * Test that sends a message and streams its response (text and thinking
 * process) to the screen in real time.
 */
import { AntigravityClient, Cascade } from "../src/index.js";
import type { TextDeltaEvent, ThinkingDeltaEvent } from "../src/index.js";

async function main() {
    console.log("🔌 Connecting to Antigravity Language Server...");
    try {
        const client = await AntigravityClient.connect();
        
        console.log("🚀 Starting new cascade...");
        const cascade = await client.startCascade();
        console.log(`✨ Cascade ID: ${cascade.cascadeId}`);

        // Register streaming event listeners
        cascade.on(Cascade.Events.Text, (ev: TextDeltaEvent) => {
            process.stdout.write(ev.delta);
        });

        cascade.on(Cascade.Events.Thinking, (ev: ThinkingDeltaEvent) => {
            process.stdout.write(`\x1b[90m${ev.delta}\x1b[0m`);
        });

        const msg = "Please introduce yourself. Please include your model name and keep it around 3 lines. Please use <Thinking>...</Thinking> before answering.";
        console.log(`📨 Sending message: "${msg}"`);
        console.log("--------------------------------------------------");
        
        // Wait for the response
        await cascade.run(msg, { timeoutMs: 60000 });
        
        console.log("\n--------------------------------------------------");
        console.log("✅ Stream completed.");
        console.log("🏁 Test completed cleanly.");
        
        client.dispose();
    } catch (e: unknown) {
        console.error("\n❌ Test failed:", (e as Error).message);
    }
}

main();
