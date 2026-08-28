# Error Handling & Resilience Audit

## Executive Summary
This audit focuses exclusively on Error Handling and Resilience within the Antigravity codebase. The review examined the TypeScript source files to identify vulnerable patterns, including bare `catch` blocks that silently swallow exceptions, inadequate error management for I/O operations and spawned processes, poorly handled timeouts, and instances of unhandled promise rejections.

The audit reveals several high and critical vulnerabilities. A significant number of bare `catch` blocks silently discard operational errors, alongside frequent usage of abrupt `process.exit()` calls which bypass graceful shutdown and resource cleanup mechanisms. Missing error listeners on child processes and unhandled file system operations present additional resilience risks. Notably, unhandled promise rejections resulting from improperly scoped timeouts in `Promise.race` setups pose a risk of crashing the entire Node.js runtime. Implementing proper error wrapping, logging, and transitioning to graceful termination sequences are key recommendations to enhance system robustness.

## Findings

### 1. Unhandled Promise Rejection in Promise.race (Node Crash Risk)
- **Severity:** 🔴 CRITICAL
- **File:** `src/proxy/stealth/warmup.ts`
- **Line:** 20, 54
- **Description:** `Promise.race` is used with a timeout. If `client.lsClient.setUserSettings(settingsReq)` rejects *after* the timeout promise rejects, the rejection will be unhandled because the race has already concluded and no catch handler is attached to the underlying promise. In Node.js >= 16, unhandled promise rejections terminate the process by default.
- **Recommended Remediation:** Ensure background promises are safely caught. Attach a dummy `.catch(() => {})` directly to the `setUserSettings` and `reqFunc.bind` calls within the `Promise.race` array.

### 2. Abrupt Process Exits Prevents Resource Cleanup
- **Severity:** 🟠 HIGH
- **File:** `src/server/mcp_server.ts`
- **Line:** 68 (and others, e.g., 73)
- **Description:** The application calls `process.exit(0)` directly in its shutdown handler. While `client.dispose()` and `client.launcher.stop()` are attempted, forcefully exiting bypasses any pending background operations or other graceful exit listeners, risking resource leaks.
- **Recommended Remediation:** Remove forceful `process.exit(0)` inside normal process termination paths and instead ensure active services are cleanly stopped, allowing the event loop to naturally drain.

### 3. Missing Child Process Error Handler on Language Server Spawn
- **Severity:** 🟠 HIGH
- **File:** `src/server/launcher.ts`
- **Line:** 212
- **Description:** The `spawn` method is used to create the Language Server child process (`this.lsProcess = spawn(...)`), but no `.on('error', ...)` listener is attached directly to the spawned process. If the binary fails to spawn (e.g., missing executable or permissions), an unhandled exception will crash the main Node process.
- **Recommended Remediation:** Attach an `.on('error', (err) => { ... })` handler immediately after spawning `this.lsProcess` to catch spawn failures.

### 4. Missing Child Process Error Handlers in Mock Server
- **Severity:** 🟠 HIGH
- **File:** `src/server/mock-extension-server.ts`
- **Lines:** 264, 426, 432
- **Description:** Child processes are spawned without attaching an `error` listener. If the spawn fails, it leads to unhandled exceptions.
- **Recommended Remediation:** Add `.on('error', ...)` to handle potential process launch failures gracefully.

### 5. Silent Error Swallowing in Accounts Store
- **Severity:** 🟠 HIGH
- **File:** `src/accounts/store.ts`
- **Line:** 57-60
- **Description:** The `read` method catches errors while reading the accounts config. Although it logs the error, it does not propagate it, silently returning a default configuration. If the error is due to a permissions issue or corrupted disk rather than a missing file, silently ignoring it may lead to data loss when the default config is later saved.
- **Recommended Remediation:** Distinguish between `ENOENT` (file not found) and other critical I/O errors. Only return the default config for `ENOENT` and rethrow or properly handle other exceptions.

### 6. Silent Error Swallowing in Reactive Apply
- **Severity:** 🟠 HIGH
- **File:** `src/reactive/apply.ts`
- **Line:** 99-101
- **Description:** An empty `catch` block silently ignores errors when trying to instantiate a specific message class, falling back to `{}`. This obscures potential protobuf mismatch or serialization bugs.
- **Recommended Remediation:** Log the error before falling back to `{}` or re-throw it if the failure indicates a fatal schema mismatch.

### 7. Silent Error Swallowing in Auth Reader
- **Severity:** 🟠 HIGH
- **File:** `src/server/auth-reader.ts`
- **Line:** 178
- **Description:** An empty `catch` block silently ignores errors if `fs.readFileSync` fails to read the Codeium auth database. There is no logging, making debugging failed authentication scenarios impossible.
- **Recommended Remediation:** Add logging inside the catch block to indicate why the file read failed.

### 8. Silent Error Swallowing in Cascade Registry Disposal
- **Severity:** ⚪ INFORMATIONAL
- **File:** `src/server/mcp/registry.ts`
- **Line:** 104
- **Description:** The code uses `try { entry.cascade.dispose(); } catch { /* ignore */ }`. While it may be acceptable to ignore disposal errors, a lack of logging makes debugging difficult if resources leak.
- **Recommended Remediation:** Add a debug log in the catch block to track disposal failures.

### 9. Unbounded Network Call in OAuth Flow
- **Severity:** 🟠 HIGH
- **File:** `src/accounts/oauth.ts`
- **Line:** 20
- **Description:** A `fetch()` call is made to Google's OAuth endpoint without an `AbortSignal`. If the endpoint hangs, this operation could block indefinitely.
- **Recommended Remediation:** Use an `AbortController` with `setTimeout` to provide a reasonable timeout (e.g., 10 seconds) for the fetch request.

### 10. Unhandled I/O Error Potential in Aliases Configuration
- **Severity:** 🟡 MEDIUM
- **File:** `src/proxy/aliases.ts`
- **Line:** 16
- **Description:** `fs.readFileSync(aliasFile, 'utf8')` is called inside a try/catch, but the catch only logs the parsing error and continues. This is mostly acceptable, but it assumes `fs.readFileSync` won't throw something unexpected that shouldn't just be ignored as a missing config.
- **Recommended Remediation:** Explicitly check for file-not-found errors versus actual filesystem or permissions errors.

### 11. Unhandled Promise on lsClient in Deep Features Example
- **Severity:** 🟠 HIGH
- **File:** `examples/test_deep_features.ts`
- **Line:** 92
- **Description:** A call to `client.lsClient` might be missing an `await` or `.catch()`. This will lead to an unhandled promise rejection if the language server request fails.
- **Recommended Remediation:** Await the promise and wrap in a `try/catch`, or chain a `.catch()` block.

## Resource Lifecycle Analysis

| Resource Type | Opened In | Cleaned Up In | Status | Notes |
|---|---|---|---|---|
| LS Child Process | `src/server/launcher.ts:212` | `src/server/launcher.ts:386` | ⚠️ Partial | Terminated with `SIGTERM`/`SIGKILL`, but process.exit elsewhere can bypass this. |
| Stdio Transport | `src/server/mcp_server.ts:50` | `N/A` | ⚠️ Missing | Transport not explicitly closed on shutdown. |
| Event Stream (SSE) | `src/core/cascade/stream-handler.ts:32`| `src/core/cascade/stream-handler.ts:82`| ✅ Handled | Listeners are properly detached and streams cancelled. |
| Heartbeat Loop | `src/proxy/stealth/heartbeat.ts` | `src/proxy/stealth/heartbeat.ts:63` | ✅ Handled | Cleanly stops timeouts when `stop()` is called. |

## Crash Scenario Analysis

1. **Language Server binary is missing or lacks execute permissions:** Process spawns in `src/server/launcher.ts` will fail, and because there is no `.on('error')` handler attached, an unhandled exception will crash the node process.
2. **Missing `aliases.json` file on disk with strict permissions:** Unhandled or broadly suppressed I/O errors might lead to unexpected undefined states if not carefully caught.
3. **Google API timeout during OAuth Refresh:** `fetch` in `src/accounts/oauth.ts` could hang indefinitely without a timeout, eventually exhausting socket connections or blocking the event loop.
4. **Unhandled Promise Rejection during RPC Timeout:** A long-running RPC wrapped in `Promise.race` in `src/proxy/stealth/warmup.ts` rejects after the timeout, triggering an `unhandledRejection` event and terminating the Node.js process.
5. **Child Process crash during mock extension server test:** Unhandled spawn errors in `mock-extension-server.ts` will bubble up as unhandled exceptions.

## Files Reviewed
- `./src/facade/index.ts`
- `./src/facade/services.ts`
- `./src/facade/inputs.ts`
- `./src/utils/autodetect.ts`
- `./src/index.ts`
- `./src/core/cascade/event-parser.ts`
- `./src/core/cascade/index.ts`
- `./src/core/cascade/stream-handler.ts`
- `./src/core/client.ts`
- `./src/cli/commands/acp.ts`
- `./src/cli/commands/serve.ts`
- `./src/cli/commands/extract.ts`
- `./src/cli/commands/quota.ts`
- `./src/cli/repl.ts`
- `./src/cli/ag.ts`
- `./src/server/mcp_server.ts`
- `./src/server/metadata.ts`
- `./src/server/index.ts`
- `./src/server/mcp/registry.ts`
- `./src/server/mcp/tools.ts`
- `./src/server/mcp/summarize.ts`
- `./src/server/mcp/diff.ts`
- `./src/server/launcher.ts`
- `./src/server/start-standalone.ts`
- `./src/server/mock-extension-server.ts`
- `./src/server/launcher_mcp.ts`
- `./src/server/web-poc/server.ts`
- `./src/server/auth-reader.ts`
- `./src/reactive/apply.ts`
- `./src/accounts/store.ts`
- `./src/accounts/types.ts`
- `./src/accounts/rotator.ts`
- `./src/accounts/oauth.ts`
- `./src/proxy/routes/openai-routes.ts`
- `./src/proxy/routes/anthropic-routes.ts`
- `./src/proxy/routes/gemini-routes.ts`
- `./src/proxy/quota/monitor.ts`
- `./src/proxy/server.ts`
- `./src/proxy/aliases.ts`
- `./src/proxy/stealth/fingerprint.ts`
- `./src/proxy/stealth/trace.ts`
- `./src/proxy/stealth/obfuscator.ts`
- `./src/proxy/stealth/warmup.ts`
- `./src/proxy/stealth/prompt-modes.ts`
- `./src/proxy/stealth/heartbeat.ts`
- `./src/types/index.ts`
- `./src/types/events.ts`
- All `./test` and `./examples` TypeScript files.
