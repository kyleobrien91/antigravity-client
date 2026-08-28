# Performance & Resource Management Audit

## Executive Summary
This audit evaluated the Antigravity Client codebase with a strict focus on performance, resource lifecycle, and memory management. The codebase exhibits a robust stealth and proxy architecture but suffers from severe lifecycle management flaws that directly impact long-running stability.

Most critically, the proxy server design pattern combined with the core client's lifecycle management results in a catastrophic memory leak. Every incoming request to the proxy spawns a new persistent `Cascade` instance that is permanently stored in memory along with its associated HTTP closures, preventing garbage collection. Under sustained load, this will rapidly exhaust the Node.js V8 heap. Additional findings include unbounded memory structures within parsing logic, synchronous loading of potentially large HTTP bodies, and missing request size limits.

## Findings

### 1. Unbounded Memory Leak of Cascade Instances & HTTP Closures
- **Severity:** 🔴 CRITICAL
- **Location:** `src/core/client.ts` (Lines 340-349, 392-402) & `src/proxy/routes/*`
- **Description:**
  The `AntigravityClient` tracks all created cascades in an `activeCascades` `Set`. When the proxy server handles a request (e.g., in `/v1/chat/completions`), it calls `client.startCascade()`, which instantiates a `Cascade`, adds it to `activeCascades`, and initiates background listening. Crucially, there is no mechanism to remove or delete the cascade from this set once the request completes or the cascade is no longer needed (only `client.dispose()` clears the set, which stops the entire client).
  Furthermore, the proxy route handlers attach anonymous event listeners (`cascade.on('text', ...)`), which capture the HTTP request (`req`), response (`res`), and `TraceCollector` inside their closures. Because the `Cascade` is retained forever in `activeCascades`, these closures and massive HTTP objects are never garbage collected, resulting in a severe memory leak proportional to the number of requests processed.
- **Recommended remediation:**
  Implement a `client.removeCascade(cascadeId)` method that removes the instance from the `activeCascades` set. The proxy route handlers must call `cascade.dispose()` and `client.removeCascade()` in a `finally` block once the HTTP request completes or terminates.

### 2. Synchronous Buffering of Unbounded Request Bodies
- **Severity:** 🟠 HIGH
- **Location:** `src/proxy/server.ts` (Lines 30-33)
- **Description:**
  The proxy server reads incoming HTTP request payloads by iterating over the request stream and concatenating chunks into a single memory string: `let body = ''; for await (const chunk of req) { body += chunk; }`. There is no check enforcing a maximum payload size. An attacker or malfunctioning client sending an excessively large JSON body will force V8 to allocate a massive contiguous string, blocking the event loop and potentially causing an Out-Of-Memory (OOM) crash before the JSON can even be parsed.
- **Recommended remediation:**
  Introduce a maximum payload size limit (e.g., 10MB). Throw a `413 Payload Too Large` error and destroy the connection if the accumulated byte length exceeds this limit. Use a `Buffer` array to collect chunks and calculate the total size before converting to a UTF-8 string.

### 3. Unbounded Map Growth in Event Parser
- **Severity:** 🟡 MEDIUM
- **Location:** `src/core/cascade/event-parser.ts` (Lines ~35-40)
- **Description:**
  The `CascadeEventParser` maintains internal state maps, specifically `emittedInteractions` and `_stepStatusMap`, using `stepIndex` as keys. These maps grow indefinitely over the lifetime of a `Cascade`. While less critical for short-lived cascades, this becomes problematic for long-running cascades resumed across multiple MCP tool calls or IDE sessions. The unbounded accumulation of step metadata will slowly consume memory.
- **Recommended remediation:**
  Implement a bounded cache (e.g., an LRU cache) or periodically prune older step indices from `emittedInteractions` and `_stepStatusMap` when the trajectory exceeds a certain length.

### 4. Dangling HTTP Stream Abortion Listeners
- **Severity:** 🟡 MEDIUM
- **Location:** `src/proxy/routes/openai-routes.ts` (Lines 148-149)
- **Description:**
  In the `/v1/responses` endpoint, listeners are attached to `req.on('close', cancelCascade)` and `req.on('aborted', cancelCascade)`. If the request completes successfully without being aborted or closed prematurely, these listeners are left attached to the `req` object. While the `req` object itself will eventually be garbage collected, it is best practice to proactively remove listeners (via `req.off(...)`) once the response is fully completed to reduce memory pressure during active connections and avoid MaxListeners warnings under concurrent load.
- **Recommended remediation:**
  Remove the `close` and `aborted` listeners in the cleanup phase when the response is successfully finished and closed.

### 5. Redundant JSON Serialization in Anthropic/OpenAI Routes
- **Severity:** 🔵 LOW
- **Location:** `src/proxy/routes/anthropic-routes.ts` (Line ~43) & `src/proxy/routes/openai-routes.ts`
- **Description:**
  In the Anthropic and OpenAI route handlers, the proxy receives parsed JSON. When constructing the prompt, if a message content object isn't a string, it is forcefully stringified again (`typeof lastMessage === 'string' ? lastMessage : JSON.stringify(lastMessage)`). Shortly after, `Cascade.sendMessage` re-wraps this into a Protobuf object, which ultimately undergoes another serialization pass. This causes unnecessary CPU overhead.
- **Recommended remediation:**
  Allow `Cascade.sendMessage` to accept structured objects or direct Protobuf message types for complex content to bypass intermediate stringification steps.

## Resource Lifecycle Map

- **Child Processes:** Spawns `language_server` binary via `spawn` in `Launcher`. Cleaned up via `stop()` utilizing `SIGTERM` and a fallback to `SIGKILL` or `taskkill` on Windows. Handled safely.
- **gRPC Connections:** Established via ConnectRPC (`AntigravityClient.lsClient`). Multiplexed and managed effectively over HTTP/2, tied to the lifecycle of the client.
- **AbortControllers:** Created in `CascadeStreamHandler.listen()`. Safely aborted when `dispose()` is called, terminating the async iterator loop cleanly.
- **Set/Map Collections:** `AntigravityClient.activeCascades` is an **uncleaned collection** causing persistent object retention. `CascadeEventParser` Maps (`emittedInteractions`, `_stepStatusMap`) are similarly uncleaned.
- **Event Listeners:**
  - Internal cascading promises (e.g., `waitForTurnComplete`) register via `.on()` and safely clean up using `.off()` in `finally` blocks.
  - Proxy route handlers register `.on('text')` and **never** remove them.

## Memory Pressure Analysis

The application exhibits a critical memory retention pattern that will cause out-of-memory crashes under sustained API load.

1. **Proxy Request Lifecycle Pipeline:**
   `HTTP Request -> startCascade() -> new Cascade() -> activeCascades.add() -> .on('text') closure -> HTTP Response ends`
2. **The Retention Chain:**
   Because `client.startCascade()` registers the instance in the global `activeCascades` Set, the V8 Garbage Collector cannot sweep the `Cascade` object. Because the `Cascade` object holds references to anonymous event listener functions registered in the route handlers, the closures attached to these listeners are also retained. These closures capture massive objects, including the full `IncomingMessage` (request), `ServerResponse` (response), and `TraceCollector`.
3. **Sustained Load Impact:**
   A proxy server processing 100 requests per minute will permanently leak 100 HTTP requests, responses, traces, and ConnectRPC streams per minute. This will rapidly exhaust heap memory, stall the event loop due to heavy GC pressure, and ultimately crash the Node process.

## Files Reviewed
- `src/core/client.ts`
- `src/core/cascade/index.ts`
- `src/core/cascade/stream-handler.ts`
- `src/core/cascade/event-parser.ts`
- `src/proxy/server.ts`
- `src/proxy/routes/openai-routes.ts`
- `src/proxy/routes/anthropic-routes.ts`
- `src/proxy/routes/gemini-routes.ts`
- `src/proxy/quota/monitor.ts`
- `src/proxy/stealth/trace.ts`
- `src/server/launcher.ts`
- `src/server/mcp_server.ts`
- `src/server/mcp/registry.ts`
- `src/server/mcp/tools.ts`
- `src/server/mock-extension-server.ts`
- `src/accounts/rotator.ts`