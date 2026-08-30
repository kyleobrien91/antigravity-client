# Testing & Quality Assurance Audit

## Executive Summary

This testing and quality assurance audit of the Antigravity Client TypeScript codebase reveals significant foundational issues in the testing strategy. While a testing framework exists and a few automated end-to-end tests are implemented, the overall test suite is heavily fragmented, lacking comprehensive assertions, and suffering from major coverage gaps.

The most critical issue is that the master test runner is hardcoded to run only a fraction of the available test scripts. Additionally, the vast majority of "tests" in the repository are actually manual execution scripts that lack programmatic assertions, test runner integration, and proper isolation. These scripts rely on visual inspection of standard output rather than automated validation, making regressions highly likely to slip through CI/CD pipelines undetected.

## Coverage Gap Analysis

| Module/File | Tested? | What's Missing |
| --- | --- | --- |
| `src/proxy/stealth/heartbeat.ts` | No | Total lack of coverage for background stealth heartbeat loops. |
| `src/proxy/stealth/obfuscator.ts` | No | No tests for payload obfuscation logic. |
| `src/proxy/stealth/fingerprint.ts` | No | Missing TLS fingerprint/JA3 tests. |
| `src/proxy/stealth/trace.ts` | No | Missing JSON tracing test coverage. |
| `src/core/cascade/stream-handler.ts` | Partial | Stream error handling and abort logic lacking coverage. |
| `src/server/mcp/` | No | No tests covering the MCP server implementation or registry. |
| `src/accounts/rotator.ts` | No | Missing tests for account rotation and state management. |

## Findings

### 1. Master Test Runner Ignores Most Tests
**Severity:** 🔴 CRITICAL
**File:** `test/run_all_tests.ts` (Lines 5-10)
**Description:** The script responsible for running the test suite (`npm test`) hardcodes an array of exactly 4 files (`test_cascade_golden_path.ts`, `test_openai_responses.ts`, `test_acp_stdio.ts`, `test_save_document.ts`). It completely ignores the other 22 test files present in the `test/` directory. This creates a false sense of security where `npm test` passes, but the vast majority of the test suite is never executed.
**Recommended remediation:** Refactor `run_all_tests.ts` to dynamically glob all `test_*.ts` files in the directory or utilize the native `node:test` runner's directory discovery capabilities (e.g., `tsx --test test/`).

### 2. "Tests" are Manual Scripts Without Assertions
**Severity:** 🔴 CRITICAL
**File:** `test/test_chat_stream.ts`, `test/test_check_quota.ts`, `test/test_telemetry.ts`, `test/test_warmup.ts` (Multiple files)
**Description:** Many files named `test_*.ts` are not actual automated tests. They do not import `test` or `describe` from `node:test`, nor do they import `node:assert`. They simply execute an async `main()` function, dump output to `console.log`, and end with `console.log("🏁 Test completed cleanly.");`. They catch errors to prevent crashing but fail to assert any meaningful programmatic behavior.
**Recommended remediation:** Rewrite these exploratory scripts into proper automated tests using `node:test` and `node:assert`. Mock external dependencies where necessary to assert correct output programmatically.

### 3. Lack of Test Isolation and Filesystem Pollution
**Severity:** 🟠 HIGH
**File:** `test/test_ack_edit.ts` (Line 33)
**Description:** The test directly writes scratch files (`ack_edit_scratch.ts`) into `process.cwd()` instead of using a temporary directory (e.g., via `os.tmpdir()` and `fs.mkdtempSync()`). This pollutes the developer's working directory, can lead to concurrent test execution conflicts, and risks committing garbage files to the repository.
**Recommended remediation:** Ensure all tests that write to the filesystem use isolated, ephemeral temporary directories created in a `before()` or `beforeEach()` hook, and cleaned up in an `after()` or `afterEach()` hook.

### 4. Poor Error Assertion Discipline (Try/Catch Swallowing)
**Severity:** 🟠 HIGH
**File:** `test/test_telemetry.ts` (Lines 14-16, 23-26)
**Description:** Tests wrap calls in `try/catch` blocks and merely log the error string (e.g., `console.log("❌ GetMendelFlags failed: " + e.message)`), continuing execution instead of actually asserting that the error is expected or throwing an assertion failure. If an API contract breaks, the script still "passes" and exits with status 0.
**Recommended remediation:** Use `assert.rejects()` or `assert.throws()` for expected errors, and allow unexpected errors to crash the test so the runner can capture and report the failure.

### 5. Flaky Tests Depending on Unmocked Binaries
**Severity:** 🟡 MEDIUM
**File:** `test/test_cascade_golden_path.ts` (Lines 34-45)
**Description:** The golden path E2E test relies on the physical presence of the `language_server` binary on the host machine. If it is missing, the test gracefully skips. While skipping prevents CI failures, it means the E2E suite provides zero confidence unless the environment is perfectly provisioned. E2E tests should either explicitly fail if the environment is incorrectly provisioned, or run against an authenticated mock.
**Recommended remediation:** Standardize the CI environment to guarantee the binary is present for E2E suites, or separate these into a dedicated `@e2e` tag that explicitly fails when requirements are not met.

## Test Quality Assessment

* **`test/test_save_document.ts`**: Good use of `node:test`. Assertions are meaningful (checking file exists, content matches, error codes). Mocks the extension server appropriately for isolation.
* **`test/test_acp_stdio.ts`**: Uses `node:test` and `node:assert`. Successfully tests the JSON-RPC lifecycle. However, it spawns a full CLI process, which makes it slightly heavier, but appropriate for an integration test.
* **`test/test_openai_responses.ts`**: Contains deep assertions for SSE lifecycles, matching exact event streams. Uses a mock client effectively to decouple from real network requests. Quality is high.
* **`test/test_types_offline.ts`**: Thorough unit testing of pure mapping functions. Excellent coverage of boundary conditions and edge cases (e.g., unknown enum values).
* **`test/test_telemetry.ts`, `test/test_warmup.ts`, `test/test_battle_mode.ts`**: Extremely poor quality. No test runner, no assertions, completely reliant on manual human verification.

## Files Reviewed
* `test/run_all_tests.ts`
* `test/test_ack_edit.ts`
* `test/test_acp_stdio.ts`
* `test/test_battle_mode.ts`
* `test/test_cascade_config.ts`
* `test/test_cascade_events.ts`
* `test/test_cascade_golden_path.ts`
* `test/test_chat_stream.ts`
* `test/test_check_quota.ts`
* `test/test_connect_existing.ts`
* `test/test_force_anthropic.ts`
* `test/test_launch_standalone.ts`
* `test/test_list_cascades.ts`
* `test/test_mendel_flags.ts`
* `test/test_models_info.ts`
* `test/test_openai_responses.ts`
* `test/test_quota.ts`
* `test/test_reject_revert.ts`
* `test/test_sandbox_config.ts`
* `test/test_save_document.ts`
* `test/test_send_message.ts`
* `test/test_send_message_only.ts`
* `test/test_telemetry.ts`
* `test/test_types_offline.ts`
* `test/test_warmup.ts`
* `test/test_writefile_reject.ts`
* `src/proxy/stealth/*` (Coverage check)
* `src/server/mcp/*` (Coverage check)
