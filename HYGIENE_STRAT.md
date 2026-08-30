# Unified Hygiene & Stabilization Strategy (HYGIENE_STRAT.md)

This document synthesizes the tactical cleanup tasks from `CLEANUP_STRAT.md` and the strategic architectural remediations from `CODEBASE_STRAT.md` into a unified execution plan. 

The work is organized into **Phases**, broken down into **Parallelizable Tracks**. This structure allows multiple developers or teams to work concurrently without causing merge conflicts or stepping on each other's toes.

---

## Phase 1: Foundation & Tooling (Immediate Action)
*Goal: Stop the bleeding, remove cruft, and set up automated quality gates.*

This phase can be split between two developers: one handling Git/CI tooling, and the other handling TypeScript/Build configurations.

### Track A: Repository Tooling & Governance
- **Dead Code Removal:** Delete `.bak` files, tracked `.DS_Store` files, and accidentally compiled `.js` files from the source tree. Update `.gitignore`.
- **Quality Gates:** Install and configure `husky` and `lint-staged`.
- **CI/CD Setup:** Create a GitHub Actions pipeline (or equivalent) to automate `npm test`, `npm run lint`, and `npm run build`.
- **Environment Standardization:** Add `.nvmrc` and enforce the Node.js version via the `engines` field in `package.json`. Upgrade to ESLint 9 (flat config).

### Track B: Build System & Config Alignment
- **Module System Resolution:** Fix the CommonJS vs. NodeNext mismatch across `package.json` and `tsconfig.json`.
- **Path Aliases:** Configure TypeScript path aliases (e.g., `@/*` to `src/*`) in `tsconfig.json` to prepare for upcoming module refactoring.
- **CLI Consolidation:** Unify the fragmented CLI entry points (`tsx src/repl.ts` vs `tsx src/cli/ag.ts`) in `package.json`.
- **Strict Compilation:** Ensure the `tsconfig.build.json` strictly compiles without loose typings.

---

## Phase 2: Core Stabilization & Refactoring
*Goal: Harden the runtime, improve observability, and modularize the architecture.*

Once Phase 1 establishes a safe, strongly-linted environment, the team can split into three independent tracks focused on different domains of the codebase.

### Track C: Runtime Hardening & Observability (High Priority)
- **Subprocess Lifecycles:** Intercept `SIGINT`, `SIGTERM`, and `process.on('exit')` in CLI entry points to gracefully terminate the Language Server and Chrome shims. Prevent orphaned processes.
- **Structured Logging:** Audit `src/server/launcher.ts` and `preload-shim.js` to remove silent `catch (e) {}` blocks. Replace scattered `console.log` statements with a structured logger (e.g., `pino` or `winston`).

### Track D: Type Safety Upgrades
- **Facade Generators:** Modify `scripts/generate_facade.ts` to output strongly typed `new (PB as typeof TargetMessage)(...)` structures instead of collapsing to `any`.
- **Cascade Event Typings:** Refactor the core `Cascade` class to utilize `EventEmitter<CascadeEventMap>` instead of loosely bound dynamic arrays.

### Track E: Architectural Streamlining
- **Proxy Refactor:** Extract common SSE streaming, request validation, and lifecycle management from `openai-routes.ts`, `anthropic-routes.ts`, and `gemini-routes.ts` into a unified `proxy/core/` module.
- **CLI REPL Decoupling:** Split `src/cli/repl.ts` by moving UI presentation and terminal coloring logic into a dedicated `cli/ui/` directory, leaving only event loop logic in the main file.

---

## Phase 3: Testing Infrastructure Overhaul
*Goal: Ensure long-term stability with modular, automated testing.*

With the build system aligned and modules decoupled, the entire team can parallelize the test rewrite process. Tests can be divided by domain (Proxy, Core, Server).

### Track F: Test Migration & Native Tooling
- **Directory Restructuring:** Move flat smoke tests from `test/` into isolated, hierarchical directories (`test/core/`, `test/proxy/`, `test/cli/`).
- **Framework Adoption:** Progressively rewrite tests using the native `node:test` framework. Replace manual visual verifications with assertions.
- **Mocking Utilities:** Build a `test/helpers/` module for mocking the Extension Server and safely skipping tests when the local Language Server binary is unavailable.
- **Test Runner Integration:** Replace `test/run_all_tests.ts` with a glob-based native test runner configured to run effortlessly in the newly established CI pipeline.
