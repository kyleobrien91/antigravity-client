import { run } from 'node:test';
import { tap } from 'node:test/reporters';
import * as path from 'path';

async function main() {
    const testFiles = [
        'unit/test_accounts_store.ts',
        'unit/test_route_translation.ts',
        'unit/test_obfuscator.ts',
        'test_cascade_golden_path.ts',
        'test_openai_responses.ts',
        'test_acp_stdio.ts',
        'test_save_document.ts'
    ].map(file => path.resolve(__dirname, file));

    // Create the test runner stream
    const runner = run({
        files: testFiles,
        concurrency: 1, // Run sequentially for safety and isolation
        timeout: 120000 // Global timeout
    });

    runner.on('test:fail', (data) => {
        console.error(`\n❌ TEST FAILED: ${data.name}`);
        console.error(data.details?.error?.message || data.details?.error);
        if (data.details?.error?.stack) {
            console.error(data.details.error.stack);
        }
    });

    runner.on('test:pass', (data) => {
        // Output passes for suite/tests
        if (data.nesting > 0) {
             console.log(`✅ Passed: ${data.name}`);
        }
    });

    // Track overall success
    let success = true;

    // Use the composed stream for processing and outputting TAP format
    const stream = runner.compose(tap);
    stream.pipe(process.stdout);

    // We can listen to runner events directly instead of iterating the stream
    runner.on('test:fail', () => {
        success = false;
    });

    // Wait for the stream to finish before exiting
    await new Promise((resolve) => stream.on('end', resolve));

    if (!success) {
        console.error("\n💥 Some tests failed.");
        process.exit(1);
    } else {
        console.log("\n🎉 All tests passed cleanly.");
        process.exit(0);
    }
}

main().catch((err) => {
    console.error("Fatal error during test run:", err);
    process.exit(1);
});
