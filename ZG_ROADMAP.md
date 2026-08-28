# Zero-Gravity (ZG) Roadmap

This document outlines the high-level roadmap for integrating the stealth, Man-In-The-Middle (MITM), and OpenAI-compatible proxy features into the Antigravity Client, inspired by the architecture of the [zero-gravity](https://github.com/zhe-gu/zero-gravity) project.

## Vision

To evolve the current direct-client architecture into a robust, stealthy proxy that MITM-intercepts a real Language Server (LS) binary. This allows for injecting custom tools, images, and prompts while streaming responses back through an OpenAI-compatible API, all while remaining completely indistinguishable from real Antigravity IDE traffic to Google's backend.

## Phase 1: Stealth Foundation & MITM Architecture

The first phase focuses on establishing the intercept layer and ensuring all outbound traffic matches the exact cryptographic and timing fingerprints of a legitimate browser/Electron environment.

* **MITM Proxy Interception:**
  * Implement an intercept layer to capture HTTPS traffic between the standalone Language Server and Google's backend APIs (`generativelanguage.googleapis.com`, etc.).
  * Use UID-scoped routing (e.g., `iptables` redirect on Linux, or equivalent packet filtering on macOS/Windows) to ensure only the LS traffic is routed through the MITM proxy.
* **TLS Fingerprinting (BoringSSL):**
  * Replace standard TLS termination with a BoringSSL-backed implementation.
  * Replicate exact Chrome JA3/JA4 TLS fingerprints and HTTP/2 (H2) connection signatures so the backend cannot distinguish the proxy from the real Electron webview.
* **Network Jitter & Timing Obfuscation:**
  * Introduce randomized jitter on all network intervals, request delays, and stream processing to prevent timing-based heuristic detection.

## Phase 2: Antigravity Protocol Emulation & Injection

Once the stealth layer is in place, the next phase involves actively modifying the traffic on the fly and emulating IDE behavior.

* **Protocol Emulation (Warmups & Heartbeats):**
  * Automatically inject background warmup and heartbeat RPC calls to keep the session alive and mimic normal user interaction patterns within the IDE.
* **Dynamic Payload Injection:**
  * Intercept the "dummy prompt" sent by the local client to the LS.
  * Swap the dummy prompt with the actual user request in the outbound encrypted payload.
  * Inject tools, generation parameters, and image attachments directly into the outgoing request stream before it is re-encrypted with the Chrome TLS fingerprint.
* **Stream Parsing & Translation:**
  * Parse the incoming Server-Sent Events (SSE) from Google's backend on the fly.
  * Extract text chunks, thinking tokens, tool calls, and usage metrics from the raw Antigravity response format.

## Phase 3: OpenAI-Compatible API Interface

The final phase surfaces the power of the MITM proxy through standard, universally compatible interfaces, allowing drop-in replacement for existing AI tools.

* **OpenAI Proxy Endpoints:**
  * Implement standard OpenAI REST API endpoints, primarily `/v1/chat/completions`.
  * Support mapping of OpenAI's `messages` array, system prompts, and `tools` to Antigravity's internal state representations.
* **Model Routing & Mapping:**
  * Expose available Antigravity models (e.g., `gemini-3-pro`, `opus-4.6`) as OpenAI model strings.
* **Headless Daemon & Session Management:**
  * Build a background daemon (manager) to handle OAuth token refreshing, session tracking, and lifecycle management of the LS binary automatically.
  * Expose configuration interfaces for easy setup across Linux, macOS, and Windows.
