# Zero-Gravity (ZG) Roadmap & Implementation Blueprint

This document tracks the architectural blueprint, current implementation matrix, and detailed task breakdowns for bringing **`antigravity-client`** into full parity with the stealth, multi-protocol, and tool-execution capabilities of [`zero-gravity`](https://github.com/zhe-gu/zero-gravity) and official Antigravity Language Server (`ls_core`) protocols.

---

## 1. Architectural Vision

To provide a production-grade, headless client, runtime environment, and protocol gateway that uses Google's authentic Language Server Go binary as its core engine. Outbound gRPC/TLS traffic to Google Cloud originates directly from Google's compiled binary (guaranteeing 100% authentic BoringSSL JA3/JA4 TLS fingerprints and HTTP/2 framing), while a faithful local Mock Extension Server and multi-protocol proxy interface external AI tools (**OpenCode**, **OpenClaw**, **Hermes Agent**, **Msty**, **Claude Code**, **Cursor**, **Aider**, **Cline**) seamlessly.

```text
Real Antigravity ls_core (Official Go binary)
        ↓  [Connect-RPC / HTTP/2 TLS + Named Pipe Liveness]
faithful local runtime substrate (antigravity-client)
  ├── Mock Extension Server (USS state sync, ExecuteCommand, SaveDocument)
  ├── Authentic Connect-RPC / Protobuf facade (@bufbuild/protobuf)
  └── Stealth Subsystem (Outbound TLS shield, zero-width obfuscator, fingerprint & jitter)
        ↓
native Cascade (Authoritative Agent/Tool Loop)
        ↓
thin protocol gateway (Inside antigravity-client)
        ↓
Outward Projections:
  ├── OpenAI Responses API (POST /v1/responses - Primary OpenCode Target)
  ├── OpenAI Chat Completions (POST /v1/chat/completions)
  ├── Agent Client Protocol (ACP v2 JSON-RPC over stdio)
  ├── Anthropic Messages API (POST /v1/messages)
  ├── Google Gemini API (POST /v1beta/models/*)
  └── Interactive CLI & Diagnostics (ag extract / ag serve / ag fingerprint)
```

---

## 2. Implementation Status Matrix

| Capability | Status | Implementation Details |
| :--- | :---: | :--- |
| **Headless LS Process Launcher** | `COMPLETED` | `src/server/launcher.ts` — spawns binary with pipe liveness & CSRF tokens |
| **Named Pipe Liveness Protocol** | `COMPLETED` | Cross-platform named pipe (`\\.\pipe\server_<hex>` / Unix sockets) |
| **Typed Protobuf Message Classes** | `COMPLETED` | `src/gen/` — 25+ packages compiled via `@bufbuild/protobuf` & `@connectrpc` |
| **Connect-RPC HTTP/2 TLS Client** | `COMPLETED` | `src/core/client.ts` — TLS handshake with bundled `cert.pem` & CSRF header |
| **Multi-Platform SQLite Token Discovery**| `COMPLETED` | `src/server/auth-reader.ts` — read-only SQLite URI extraction from `state.vscdb` |
| **Unified State Sync (USS) OAuth** | `COMPLETED` | `src/server/mock-extension-server.ts` — active `SubscribeToUnifiedStateSyncTopic` |
| **Native Cascade Session Engine** | `COMPLETED` | `src/core/cascade/` — `CascadeStreamHandler` & `CascadeEventParser` |
| **Zero Outbound Node TLS (Binary Shield)**| `COMPLETED` | 100% of outbound Google Cloud traffic routed through LS Go binary |
| **Zero-Width Sensitive Word Shield**| `COMPLETED` | `src/proxy/stealth/obfuscator.ts` — `\u200B` injection for client names |
| **Device Fingerprint & Versioning** | `COMPLETED` | `src/proxy/stealth/fingerprint.ts` — IDE version & device ID synchronization |
| **System Prompt Transformation Modes** | `COMPLETED` | `src/proxy/stealth/prompt-modes.ts` — `native`, `stealth`, and `minimal` modes |
| **Multi-Account Storage & Rotation** | `COMPLETED` | `src/accounts/` — `oauth.ts`, `rotator.ts`, `store.ts` for automated rotation |
| **OpenAI Chat Completions (`/v1/chat/completions`)** | `COMPLETED` | `src/proxy/routes/openai-routes.ts` — streaming & non-streaming responses |
| **Dynamic Models Catalog (`/v1/models`)** | `COMPLETED` | `src/proxy/routes/openai-routes.ts` & `src/proxy/aliases.ts` |
| **Anthropic Messages API (`/v1/messages`)** | `COMPLETED` | `src/proxy/routes/anthropic-routes.ts` — Claude Code / Cursor compatibility |
| **Google Gemini API (`/v1beta/models/*`)** | `COMPLETED` | `src/proxy/routes/gemini-routes.ts` — native Gemini payload mapping |
| **CLI Suite (`ag extract`, `ag serve`, `ag fingerprint`)** | `COMPLETED` | `src/cli/ag.ts`, `src/cli/commands/` |
| **Docker Standalone Runtime** | `COMPLETED` | `docker/Dockerfile`, `docker/docker-compose.template.yml` |
| **Submodule Tracking** | `COMPLETED` | `zero-gravity` submodule linked under `./zero-gravity` |
| **Webview Startup Warmup Sequence** | `PENDING` | `src/proxy/stealth/warmup.ts` — 13-RPC initialization sequence (50-200ms jitter) |
| **Background Heartbeat Loop with Jitter** | `PENDING` | `src/proxy/stealth/heartbeat.ts` — 30s $\pm 500\text{ms}$ periodic keep-alive |
| **In-Memory Quota & Credit Monitor** | `PENDING` | `src/proxy/quota/monitor.ts` — 60s cache polling; expose `GET /v1/quota` |
| **Structured JSON Call Tracing** | `PENDING` | `src/proxy/stealth/trace.ts` — file-based per-call traces in `~/.config/antigravity/` |
| **OpenAI Responses API (`POST /v1/responses`)** | `PENDING` | 6-stage SSE lifecycle for OpenCode compatibility |
| **Real `SaveDocument` Disk Persistence** | `PENDING` | `src/server/mock-extension-server.ts` — decode request & persist to disk |
| **Agent Client Protocol (ACP v2 Stdio Server)** | `PENDING` | `src/cli/commands/acp.ts` — JSON-RPC 2.0 stdio server |
| **Comprehensive Master Test Suite** | `PENDING` | `test/test_cascade_golden_path.ts` & `test/run_all_tests.ts` |

---

## 3. Detailed Remaining Task Breakdowns & AI Prompts

---

### Task 1: Webview Startup Warmup Sequence (`src/proxy/stealth/warmup.ts`)

#### Technical Breakdown:
When the official Antigravity IDE loads, the Electron webview fires a burst of 13 initialization RPCs to prepare the Language Server. If an external client immediately sends prompt requests on a cold LS without this warmup sequence, Google's backend detects an abnormal bot lifecycle.
* **Target File**: `src/proxy/stealth/warmup.ts`
* **RPC Sequence**:
  1. `SetUserSettings` (with `userSettings.detectAndUseProxy = 1`)
  2. `GetStatus`
  3. `Heartbeat`
  4. `GetUserStatus`
  5. `GetCascadeModelConfigs`
  6. `GetCascadeModelConfigData`
  7. `GetWorkspaceInfos`
  8. `GetWorkingDirectories`
  9. `GetAllCascadeTrajectories`
  10. `GetMcpServerStates`
  11. `GetWebDocsOptions`
  12. `GetRepoInfos`
  13. `GetAllSkills`
  14. `InitializeCascadePanelState`
* **Timing & Error Handling**:
  * Execute calls sequentially with **50ms–200ms randomized Gaussian jitter** between calls.
  * Wrap each call in a **5-second timeout** (e.g., using `Promise.race`).
  * Apply **best-effort error suppression**—if an RPC is experimental or missing in older LS binaries, catch the error, log it as debug, and continue. The warmup sequence must not abort early.
* **Integration**: Call `await runWebviewWarmup(client)` in `src/cli/commands/serve.ts` before binding the HTTP proxy port.

#### AI Prompt for Task 1:
```text
You are working on the `antigravity-client` codebase in TypeScript.
Implement the Webview Startup Warmup Sequence in `src/proxy/stealth/warmup.ts` to replicate the exact startup lifecycle of the official Antigravity Electron webview.

Requirements:
1. Before writing code, analyze `./zero-gravity/src/warmup.rs` (the Rust submodule) to study the exact RPC payloads and timing logic used in the reference implementation.
2. Create `src/proxy/stealth/warmup.ts` exporting an `async function runWebviewWarmup(client: AntigravityClient): Promise<void>`.
3. The function must invoke the following RPCs in sequence on the Language Server via `client`:
   - SetUserSettings: { userSettings: { detectAndUseProxy: 1 } }
   - GetStatus, Heartbeat, GetUserStatus, GetCascadeModelConfigs, GetCascadeModelConfigData, GetWorkspaceInfos, GetWorkingDirectories, GetAllCascadeTrajectories, GetMcpServerStates, GetWebDocsOptions, GetRepoInfos, GetAllSkills, InitializeCascadePanelState.
4. Wrap each individual RPC call in a 5-second timeout (`Promise.race`). If a timeout or network error occurs, catch and log it silently without throwing; the sequence must continue to the next RPC.
5. Introduce a randomized delay of 50ms to 200ms between calls to mirror natural Chromium IPC dispatch. Use a sleep helper.
6. In `src/cli/commands/serve.ts`, await `runWebviewWarmup(client)` during server initialization prior to listening for inbound proxy traffic.
7. Write a quick verification script demonstrating the sequence runs cleanly without crashing.
```

---

### Task 2: Background Heartbeat Cadence with Natural Jitter (`src/proxy/stealth/heartbeat.ts`)

#### Technical Breakdown:
In the official IDE, Chromium maintains a continuous `setInterval(Heartbeat, 30000)`. Because browser event loops experience natural timing drift, intervals are never exactly 30,000ms. ZeroGravity introduces $\pm 500\text{ms}$ jitter to prevent heuristic bot detection.
* **Target File**: `src/proxy/stealth/heartbeat.ts`
* **Implementation Details**:
  * Implement `startHeartbeatLoop(client: AntigravityClient): { stop: () => void }`.
  * Recursive timer using `setTimeout` with `30000 + (Math.random() * 1000 - 500)` ms interval.
  * Send `client.callUnary("Heartbeat", {})`.
  * Return a disposable handle to allow graceful shutdown without leaving orphan event loop timers.
* **Edge Cases & Error Handling**:
  * **Socket Closures**: Catch any gRPC/Connect unhandled rejections during the heartbeat. If the underlying LS process dies, stop the loop automatically. Do not let transient network errors crash the Node process.
* **Integration**: Start the heartbeat in `src/cli/commands/serve.ts` and ensure it is cleaned up on `SIGINT` / `SIGTERM`.

#### AI Prompt for Task 2:
```text
You are working on `antigravity-client` in TypeScript.
Implement the background heartbeat keep-alive loop with natural timing jitter in `src/proxy/stealth/heartbeat.ts`.

Requirements:
1. Analyze `./zero-gravity/src/warmup.rs` (or relevant Rust files in the submodule) to study the exact jitter math and interval used by the reference implementation.
2. Create `src/proxy/stealth/heartbeat.ts` exporting `function startHeartbeatLoop(client: AntigravityClient): { stop: () => void }`.
3. The loop must send `Heartbeat` RPCs to the Language Server recursively using `setTimeout` every 30 seconds with ±500ms randomized Gaussian jitter (29,500ms to 30,500ms).
4. Ensure the heartbeat call is non-blocking. Crucially, wrap the RPC call in a try/catch. Suppress transient network errors, but if the LS process is verifiably dead, terminate the loop. Do not allow unhandled promise rejections to crash the proxy.
5. Provide a `stop()` method to cleanly cancel the active `setTimeout` timer.
6. Hook `startHeartbeatLoop` into `src/cli/commands/serve.ts` upon successful server startup, and register the `stop()` callback in the process termination handlers (`SIGINT`, `SIGTERM`).
```

---

### Task 3: In-Memory Quota & Credit Monitor (`src/proxy/quota/monitor.ts` & `GET /v1/quota`)

#### Technical Breakdown:
Users and downstream clients (OpenCode, Cursor, Cline) need real-time visibility into remaining prompt credits, flow credits, and per-model quota limits (remaining fraction and reset timestamp) without triggering rate-limit errors mid-stream.
* **Target File**: `src/proxy/quota/monitor.ts`
* **Mechanism**:
  * Periodically (every 60s) query `client.getUserStatus()` and `client.getCascadeModelConfigData()`.
  * This reads the LS's local in-memory cache and generates zero external Google Cloud network requests.
  * Parse and maintain a `QuotaSnapshot`:
    - `plan`: `plan_name`, `tier_id`, `tier_name`.
    - `credits`: `prompt_credits`, `flow_credits`, `flex_credits`.
    - `models`: Array of `{ model_id, remaining_fraction, reset_time }`.
* **Resilience**: If polling fails (e.g., transient LS unavailability), retain and serve the last known good snapshot.
* **Endpoints**:
  * In `src/proxy/server.ts`, route `GET /v1/quota` and `GET /v1/credits` to return the current cached `QuotaSnapshot` in JSON format.
  * Add an `ag quota` CLI command in `src/cli/ag.ts` for instant terminal inspection.

#### AI Prompt for Task 3:
```text
You are working on `antigravity-client` in TypeScript.
Implement the in-memory Quota & Credit Monitor in `src/proxy/quota/monitor.ts` and expose it via HTTP endpoints and CLI.

Requirements:
1. Analyze `./zero-gravity/src/quota.rs` in the submodule to replicate the exact parsing logic and `QuotaSnapshot` JSON schema from the reference implementation.
2. Create `src/proxy/quota/monitor.ts` exporting a `QuotaMonitor` class.
3. The monitor must poll the local LS every 60 seconds via `client.getUserStatus()` and `client.getCascadeModelConfigData()`.
4. Extract and cache: Plan details (tier/name), Credit balances (prompt/flow/flex), and Per-model quotas (model ID, remaining fraction, reset timestamp).
5. If a polling request fails, silently catch the error and retain the last known good snapshot. Do not crash.
6. In `src/proxy/server.ts`, add routes for `GET /v1/quota` and `GET /v1/credits` that return the latest `QuotaSnapshot` as JSON.
7. In `src/cli/ag.ts`, add an `ag quota` command that reads this data and prints formatted quota and credit balances in the terminal.
8. Write a unit/integration test verifying that `GET /v1/quota` returns valid structured JSON.
```

---

### Task 4: Structured JSON Call Tracing (`src/proxy/stealth/trace.ts`)

#### Technical Breakdown:
Provide per-call structured JSON trace files for auditing, token metrics, and debugging without leaking auth credentials.
* **Target File**: `src/proxy/stealth/trace.ts`
* **Log Location**: `~/.config/antigravity/traces/YYYY-MM-DD/{HH-MM-SS}_{cascade_short_id}.json` (cross-platform).
* **Trace Schema**:
  ```typescript
  export interface CallTrace {
      timestamp: string;
      endpoint: string; // e.g. /v1/chat/completions, /v1/responses
      cascadeId: string;
      model: string;
      promptMode: string; // native, stealth, minimal
      messagesCount: number;
      durationMs: number;
      finishReason: string;
      tokens?: { prompt: number; completion: number; total: number };
      error?: string;
  }
  ```
* **Security & I/O Bounds**: 
  * Strictly sanitize all payloads to ensure no OAuth bearer tokens, IP addresses, or raw credentials are saved.
  * Execute file I/O asynchronously (`fs.promises.writeFile`) to prevent blocking the Node event loop during high-throughput proxy streaming. Ensure target directories are created (`fs.promises.mkdir(..., { recursive: true })`).

#### AI Prompt for Task 4:
```text
You are working on `antigravity-client` in TypeScript.
Implement the structured per-call debug trace system in `src/proxy/stealth/trace.ts`.

Requirements:
1. Analyze `./zero-gravity/src/trace.rs` and `./zero-gravity/src/snapshot.rs` in the submodule to match the exact trace JSON schema and file-writing behavior.
2. Create `src/proxy/stealth/trace.ts` exporting a `TraceCollector` class.
3. When an API request is received on any route (`/v1/chat/completions`, `/v1/responses`, `/v1/messages`), create an active trace record in memory.
4. Upon stream completion or error, write a structured JSON file asynchronously to `~/.config/antigravity/traces/YYYY-MM-DD/{HH-MM-SS}_{cascadeId_short}.json`. Use `fs.promises.mkdir` with `{ recursive: true }` to ensure directories exist.
5. Capture: ISO timestamp, endpoint path, cascade ID, model identifier, prompt mode, duration in ms, finish reason, and token metrics.
6. Strictly sanitize the payload. Ensure no OAuth tokens, Authorization headers, or PII leak into the JSON file.
7. Ensure the disk writing is non-blocking (async/await) and fails gracefully (log to console, don't crash the proxy) if I/O permissions are missing.
8. Make tracing toggleable via `process.env.ANTIGRAVITY_TRACING` (default: enabled).
```

---

### Task 5: First-Class OpenAI Responses API (`POST /v1/responses`)

#### Technical Breakdown:
OpenCode (`@opencode-ai/ai/providers/openai-compatible/responses`) relies on the OpenAI Responses API streaming format rather than standard Chat Completions.
* **Target File**: `src/proxy/routes/openai-routes.ts`
* **SSE Event Sequence**:
  1. `response.created` (with `response` object containing `id`, `status: "in_progress"`, `model`).
  2. `response.output_item.added` (item type: `message`, `role: "assistant"`).
  3. `response.content_part.added` (part type: `output_text`).
  4. `response.output_text.delta` (streamed chunk delta from `cascade.on('text')`).
  5. `response.content_part.done` & `response.output_item.done`.
  6. `response.completed` (with final usage statistics).
* **Error Semantics**: If Cascade fails or stream errors occur, emit `response.failed` or `response.incomplete` (never fake `response.completed`).
* **Session Continuity**: Map `previous_response_id` and client session IDs to native Cascade session DAGs.
* **Stream Cleanup**: If the HTTP client aborts the connection early (e.g. IDE closed mid-stream), listen for `req.on('close')` or `req.on('aborted')` and immediately cancel the underlying Cascade session to prevent runaway token usage.

#### AI Prompt for Task 5:
```text
You are working on `antigravity-client` in TypeScript.
Implement first-class support for the OpenAI Responses API (`POST /v1/responses`) in `src/proxy/routes/openai-routes.ts` for full OpenCode compatibility.

Requirements:
1. In `src/proxy/routes/openai-routes.ts`, add a handler for `path === '/v1/responses'`.
2. Support both streaming (`stream: true`) and non-streaming responses. For streaming, set headers `Content-Type: text/event-stream` and `Cache-Control: no-cache`.
3. For streaming, faithfully emit the 6-stage SSE lifecycle:
   - response.created
   - response.output_item.added
   - response.content_part.added
   - response.output_text.delta (streaming text chunks from Cascade)
   - response.content_part.done
   - response.output_item.done
   - response.completed
4. Map `previous_response_id` in incoming request payloads to existing native Cascade sessions to support multi-turn continuations.
5. If an error occurs in the Cascade stream, emit `response.failed` with the error message.
6. Crucial Cleanup: Attach a listener to `req.on('close', ...)` and `req.on('aborted', ...)`. If the client disconnects before completion, invoke `cascade.cancel()` immediately to stop upstream generation.
7. Write an automated test making a streaming `POST /v1/responses` request and asserting all 6 SSE event types are emitted in order.
```

---

### Task 6: Real `SaveDocument` Disk Persistence in Mock Extension Server

#### Technical Breakdown:
When native Cascade performs code editing steps, it issues a `SaveDocument` Connect-RPC request to the Extension Server. If the Mock Extension Server treats this as a no-op or returns an empty stub without saving to disk, code modifications are lost.
* **Target File**: `src/server/mock-extension-server.ts`
* **Implementation Details**:
  * Use the typed `@bufbuild/protobuf` `SaveDocumentRequest` from `src/gen/exa/extension_server_pb/extension_server_pb.js`.
  * Decode `req.filePointer` / `req.content` / `req.path`.
  * Safely handle the path resolution. Write the modified content to disk using `fs.writeFileSync`. Ensure parent directories are recursively created (`fs.mkdirSync(path.dirname(filePath), { recursive: true })`).
  * Handle locked files gracefully by returning an error response rather than crashing.
  * Return a typed `SaveDocumentResponse` with `success: true`.

#### AI Prompt for Task 6:
```text
You are working on `antigravity-client` in TypeScript.
Implement genuine document persistence in `src/server/mock-extension-server.ts` for the `SaveDocument` RPC.

Requirements:
1. Locate `saveDocument` handler in `src/server/mock-extension-server.ts`.
2. Decode the incoming `SaveDocumentRequest` using the generated Protobuf message classes to extract the file path and new file content.
3. Resolve the absolute target file path. Before writing, ensure the parent directories exist using `fs.mkdirSync(path.dirname(targetPath), { recursive: true })`.
4. Write the updated document text to disk using `fs.writeFileSync(targetPath, content)`.
5. Return a valid `SaveDocumentResponse` indicating success.
6. Implement error handling: If file writing fails (e.g., EACCES, EPERM, or locked file on Windows), catch the error, log it, and return a valid Connect-RPC error or a failed `SaveDocumentResponse` rather than crashing the extension server.
7. Create an automated test in `test/test_save_document.ts` that triggers `SaveDocument` via the proxy and asserts that the local file on disk was correctly updated.
```

---

### Task 7: Agent Client Protocol (ACP v2 JSON-RPC over stdio)

#### Technical Breakdown:
Provide an official Agent Client Protocol (ACP v2) JSON-RPC 2.0 stdio server so local IDEs and tools can spawn `ag acp` as an external agent subprocess.
* **Target Files**: `src/cli/commands/acp.ts` & `src/cli/ag.ts`
* **Protocol Transport**: JSON-RPC 2.0 delimited by `Content-Length: ...\r\n\r\n` (LSP-style framing). Do not use naive newline-delimited JSON as large payloads will break. Rely on a package like `vscode-jsonrpc` or a robust custom parser for the framing layer over `process.stdin` / `process.stdout`.
* **Supported RPC Methods**:
  * `initialize`: Returns server capabilities, protocol version, and agent metadata.
  * `auth/login`: Verifies local Antigravity OAuth session.
  * `session/new`: Creates a new native Cascade session with workspace configuration.
  * `session/prompt`: Sends user message and streams updates (`content_delta`, `thinking_delta`, `tool_call`).
  * `session/cancel`: Disposes the active Cascade stream.

#### AI Prompt for Task 7:
```text
You are working on `antigravity-client` in TypeScript.
Implement the Agent Client Protocol (ACP v2) JSON-RPC 2.0 stdio server in `src/cli/commands/acp.ts` and wire it to the `ag acp` CLI command.

Requirements:
1. Create `src/cli/commands/acp.ts` implementing a JSON-RPC 2.0 server.
2. The transport must use LSP-style `Content-Length: ...\r\n\r\n` framing over `process.stdin` and `process.stdout`. Use a robust parser (e.g., `vscode-jsonrpc` or an equivalent custom framing stream) to handle chunked payloads correctly.
3. Implement handlers for the following methods:
   - `initialize`: Return ACP v2 capabilities, protocol version, and agent info.
   - `auth/login`: Return authentication status from `readAuthData()`.
   - `session/new`: Create a new native Cascade session via `AntigravityClient`.
   - `session/prompt`: Forward prompt to `cascade.sendMessage()` and stream notification events (`session/update`, text deltas, thinking deltas).
   - `session/cancel`: Cancel the running Cascade step.
4. In `src/cli/ag.ts`, register the `ag acp` command to start the stdio server. Ensure console logs inside the ACP server are redirected to `process.stderr` so they don't corrupt the JSON-RPC `stdout` stream.
5. Create an automated test in `test/test_acp_stdio.ts` that spawns the CLI with `acp`, sends properly framed `initialize` and `session/prompt` JSON-RPC payloads, and asserts valid protocol responses.
```

---

### Task 8: Comprehensive Golden-Path & Master Test Suite

#### Technical Breakdown:
Rebuild and consolidate the master test runner to execute automated end-to-end assertions against a real live Language Server.
* **Target Files**: `test/test_cascade_golden_path.ts`, `test/run_all_tests.ts`
* **Test Runner**: Standardize on Node's native `node:test` (or the project's existing framework) with `tsx`.
* **Golden-Path Assertions**:
  1. Inspect repository workspace and read files.
  2. Execute a shell command through Extension Server `ExecuteCommand` (e.g. `npm --version`).
  3. Modify a file through native Cascade `SaveDocument` and assert disk changes.
  4. Stream native thinking and text events.
  5. Multi-turn continuation in the same native session.
* **Master Suite Orchestration**:
  - Run all 5 verification suites sequentially: Handshake $\to$ Warmup $\to$ Golden Path $\to$ OpenAI Responses $\to$ ACP Stdio.
  - Test suites must have explicit teardowns (e.g., closing `AntigravityClient`, terminating LS child process, shutting down Mock Extension Server) to avoid hanging processes.

#### AI Prompt for Task 8:
```text
You are working on `antigravity-client` in TypeScript.
Implement the complete Golden-Path scenario test in `test/test_cascade_golden_path.ts` and the master test runner in `test/run_all_tests.ts`.

Requirements:
1. In `test/test_cascade_golden_path.ts`, implement an end-to-end integration test (using `node:test` or the existing test framework) that boots the headless LS, runs the warmup sequence, and performs a multi-turn coding task:
   - Turn 1: Ask Cascade to inspect a sample file and run a command via `ExecuteCommand`.
   - Turn 2: Ask Cascade to edit the sample file via `SaveDocument`.
   - Assert that: (a) `ExecuteCommand` captured stdout and exit code 0, (b) the file on disk was modified with exact content, (c) Turn 2 continued the same native session ID.
2. In `test/run_all_tests.ts`, create a master test runner orchestrating:
   - `test_ls_handshake.ts`
   - `test_cascade_golden_path.ts`
   - `test_openai_responses.ts`
   - `test_acp_stdio.ts`
3. Wire `npm test` in `package.json` to execute `tsx test/run_all_tests.ts`.
4. Ensure rigorous teardown logic (`after`, `afterEach`) to kill spawned LS processes, stop the Mock Extension Server, and close HTTP ports, ensuring the test script exits cleanly without hanging.
```
