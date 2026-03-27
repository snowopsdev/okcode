# Codebase Audit

## Scope and Method

This audit is based on direct repository inspection, not on README claims alone.

The sampling pass covered:

- repository and package structure across `apps/*`, `packages/*`, and top-level workspace config,
- representative backend orchestration, provider, persistence, and transport files,
- representative frontend session, chat, and store files,
- shared schema and helper modules,
- test density and test placement across server, web, desktop, and shared code.

The repository snapshot sampled here included approximately `406` source files across the main app and shared areas, plus approximately `109` test files across server, web, desktop, and shared packages.

This is not an exhaustive line-by-line review of the entire repository. It is a targeted architectural and maintainability audit intended to identify the strongest current properties, the main concentration risks, and the refactor targets that would most improve the codebase without destabilizing it.

## Executive Summary

The backend architecture is substantially stronger than a typical early-stage repository. The server side already has a real architectural center: event-oriented orchestration, explicit service boundaries, and visible attention to startup, ordering, recovery, and persistence behavior instead of just feature delivery.

Package boundaries and schema discipline are also real strengths, not just naming conventions. The split between `apps/server`, `apps/web`, `packages/contracts`, and `packages/shared` is meaningful, and the code generally reinforces that split through typed boundaries and explicit runtime helpers rather than ad hoc cross-package coupling.

The main current risk is frontend orchestration concentration into a few oversized components and state modules. Backend reliability confidence is higher than frontend change-velocity confidence. This codebase is already beyond prototype chaos, but the main near-term structural intervention should be reducing UI orchestration concentration before more product surface accumulates on top of it.

## What Is Strong

- The server orchestration path has a coherent event-driven shape. [`apps/server/src/orchestration/Layers/OrchestrationEngine.ts`](../apps/server/src/orchestration/Layers/OrchestrationEngine.ts) serializes command handling, persists receipts, projects read models, and reconciles state after failure instead of assuming happy-path completion.
- The transport boundary reflects deliberate defensive design. [`apps/server/src/wsServer.ts`](../apps/server/src/wsServer.ts) combines schema-decoded requests, path normalization, local-client checks, and explicit request routing rather than passing raw transport payloads into feature logic.
- Typed schema boundaries are treated as a first-class architectural tool. [`packages/shared/src/schemaJson.ts`](../packages/shared/src/schemaJson.ts) and the contracts package keep decoding and schema formatting explicit, which reduces boundary ambiguity and supports predictable failure handling.
- The architecture documentation and the codebase largely agree with each other. [`.docs/architecture.md`](./architecture.md) describes queue-backed workers, ordered pushes, and read-model projection, and those patterns are visible in the current server implementation rather than existing only in docs.
- Package role separation is unusually solid for the current stage. `apps/server` owns orchestration and provider/runtime concerns, `apps/web` owns session UX, `packages/contracts` stays schema-oriented, and `packages/shared` exports focused runtime utilities instead of devolving into a general-purpose junk drawer.
- Test density is strong for a repository at this stage. The server in particular has broad coverage around orchestration, provider layers, persistence, PTY management, and transport behavior, which raises confidence that the backend design is intended to survive failure and concurrency pressure rather than only demo flows.

## Findings

### High

#### Frontend orchestration is overly concentrated in `ChatView`

Why it matters:
`ChatView` is carrying too much non-visual orchestration responsibility for the most complex user-facing surface in the product.

Evidence:
[`apps/web/src/components/ChatView.tsx`](../apps/web/src/components/ChatView.tsx) is about `4217` lines and mixes routing, query orchestration, draft management, composer logic, plan flow, attachment handling, terminal coordination, and rendering composition.

Practical consequence:
Safe change isolation becomes harder, onboarding gets slower, and session UX regressions become more likely because too many concerns converge in one file.

#### Timeline rendering and behavior are still too concentrated

Why it matters:
The timeline is both product-critical and performance-sensitive, so concentrated behavior here is a higher risk than a normal large presentational component.

Evidence:
[`apps/web/src/components/chat/MessagesTimeline.tsx`](../apps/web/src/components/chat/MessagesTimeline.tsx) is about `912` lines and combines virtualization policy, row derivation, rendering policy, interaction logic, and presentation branching.

Practical consequence:
Performance-sensitive UI behavior is harder to reason about and benchmark, and additional timeline features will accumulate incidental coupling unless the structure is decomposed.

### Medium

#### The backend transport layer is strong but `wsServer` remains large enough to become a bottleneck

Why it matters:
The current transport layer is still coherent, but it is large enough that continued growth will eventually slow work and increase the chance of cross-domain regressions.

Evidence:
[`apps/server/src/wsServer.ts`](../apps/server/src/wsServer.ts) is about `1062` lines and owns protocol decoding, request routing, attachment behavior, security-ish local checks, static serving, and some path validation helpers.

Practical consequence:
This is currently acceptable because the responsibilities are still adjacent, but it is an obvious future extraction point into route modules or per-domain handlers.

#### Store compatibility and projection logic risks accreting in the renderer store

Why it matters:
If the renderer store keeps absorbing compatibility and projection concerns, it can become a second orchestration layer that is harder to verify than the server-side read model.

Evidence:
[`apps/web/src/store.ts`](../apps/web/src/store.ts) already carries persistence migration cleanup, model and provider inference, project ordering, and read-model mapping.

Practical consequence:
Without tighter boundaries, the store can slowly become responsible for policy and projection logic that should remain either server-derived or isolated in focused client helpers.

### Low

#### Contracts package is disciplined, but index-level re-export growth should be watched

Why it matters:
Broad re-export surfaces are easy to grow casually and hard to shrink later.

Evidence:
[`packages/contracts/src/index.ts`](../packages/contracts/src/index.ts) currently re-exports multiple contract domains from one index entrypoint.

Practical consequence:
This is not a current problem, but unchecked surface growth can blur domain ownership over time and make it easier for package boundaries to soften unintentionally.

## Top Refactor Targets

### 1. Split `ChatView` into domain hooks and smaller feature shells

Objective:
Reduce non-visual orchestration concentration in the main chat surface without changing behavior.

Boundaries:
Pull orchestration into domain hooks or service-like helpers grouped by concern, such as composer send flow, plan follow-up flow, attachment flow, terminal-context flow, and pull-request flow. Keep the UI shell responsible mainly for composition and local presentation state.

What not to do:
Do not rewrite the chat surface or change the interaction model during extraction. Do not replace one large component with one large “manager” hook that recreates the same concentration under a different name.

Likely destination modules:
`apps/web/src/components/chat/hooks/*`, `apps/web/src/components/chat/*logic.ts`, or a small set of session-focused view-model modules next to the current chat components.

Expected payoff:
Safer incremental changes in the highest-churn UI area, lower regression risk, and faster onboarding for engineers touching session UX.

### 2. Split `MessagesTimeline` into row model derivation, virtualization policy, and row renderers

Objective:
Separate timeline data shaping, virtualization heuristics, and rendering branches so performance-sensitive behavior can be tested and tuned independently.

Boundaries:
Extract row-building into a pure module, keep virtualization heuristics isolated and testable, and move row-type rendering into smaller renderer components while preserving the current scrolling and streaming behavior.

What not to do:
Do not remove existing performance-sensitive behavior just to simplify the file. The goal is decomposition, not feature reduction.

Likely destination modules:
`apps/web/src/components/chat/timelineRows.ts`, `apps/web/src/components/chat/timelineVirtualization.ts`, and focused row renderer components under `apps/web/src/components/chat/timeline/*`.

Expected payoff:
More predictable performance work, clearer review boundaries, and lower coupling when adding new timeline entry types or display states.

### 3. Introduce server route and domain handler extraction from `wsServer`

Objective:
Preserve the current strong schema-decoded boundary while reducing `wsServer` to lifecycle, boundary enforcement, and delegation.

Boundaries:
Extract request handling by adjacent domain, such as `project`, `thread`, `attachments`, `git`, `terminal`, and `server/meta`, while keeping top-level transport validation and startup/shutdown ownership in `wsServer`.

What not to do:
Do not replace explicit schema decoding with dynamic dispatch magic. Do not fragment route handling so aggressively that transport invariants become hard to follow.

Likely destination modules:
`apps/server/src/wsServer/routes/*` or `apps/server/src/wsServer/handlers/*`, with small per-domain handler units.

Expected payoff:
Lower transport-layer review cost, cleaner domain ownership, and reduced chance that unrelated request logic collides in one transport file.

### 4. Tighten renderer store responsibilities around hydration and projection only

Objective:
Keep the renderer store focused on hydration and client-side state projection rather than allowing it to accumulate compatibility logic and business rules.

Boundaries:
Move persistence migration cleanup, compatibility normalization, and model/provider derivation helpers into adjacent pure modules where possible. Keep the store as the place that applies already-defined mapping logic, not the place that invents it.

What not to do:
Do not over-abstract basic store updates into unnecessary indirection. The target is responsibility tightening, not framework churn.

Likely destination modules:
`apps/web/src/storePersistence.ts`, `apps/web/src/storeProjection.ts`, `apps/web/src/modelResolution.ts`, or similarly scoped pure helper files.

Expected payoff:
Lower risk of duplicating orchestration rules in the renderer and a clearer boundary between server truth, compatibility handling, and client projection.

### 5. Add lightweight architecture guardrails to prevent component and module re-concentration

Objective:
Stop the current concentration pattern from reappearing after refactors land.

Boundaries:
Use pragmatic guardrails such as soft file size thresholds, an expectation of extracting non-visual hooks before crossing thresholds, and maintaining tests for extracted behavior.

What not to do:
Do not add heavy process, broad governance documents, or rigid mechanical limits that block reasonable exceptions.

Likely destination modules:
Small additions to internal docs, contribution guidance, and targeted review heuristics rather than new tooling-heavy enforcement.

Expected payoff:
Sustained maintainability gains after the first extraction pass instead of gradual re-consolidation into the same hotspots.

## Reliability Risks

- Centralized UI orchestration increases the risk of session UX regressions in subtle states such as approvals, plan follow-ups, draft restoration, and terminal-context handling. Current mitigation: the chat surface already pushes some logic into dedicated `*.logic.ts` files and related helpers. Why that may not be enough: the main orchestration still converges in [`apps/web/src/components/ChatView.tsx`](../apps/web/src/components/ChatView.tsx), so interaction bugs can still emerge from cross-concern coupling.
- Timeline complexity creates a risk of performance cliffs in long-running or large-message threads. Current mitigation: the timeline already uses virtualization and height estimation in [`apps/web/src/components/chat/MessagesTimeline.tsx`](../apps/web/src/components/chat/MessagesTimeline.tsx). Why that may not be enough: virtualization policy, row derivation, and rendering behavior are still tightly coupled, which makes performance tuning and regression detection harder.
- Continued growth in `wsServer` increases the chance of transport regressions affecting unrelated request paths. Current mitigation: the file maintains schema decoding and a disciplined transport boundary in [`apps/server/src/wsServer.ts`](../apps/server/src/wsServer.ts). Why that may not be enough: once more unrelated request logic accumulates there, adjacent ownership alone stops being a strong enough organizing principle.
- Expansion of renderer-store logic risks duplicating orchestration rules already modeled on the server. Current mitigation: the server already has a read-model and projection architecture centered around [`apps/server/src/orchestration/Layers/OrchestrationEngine.ts`](../apps/server/src/orchestration/Layers/OrchestrationEngine.ts). Why that may not be enough: if client-side compatibility and derivation logic keeps growing in [`apps/web/src/store.ts`](../apps/web/src/store.ts), the UI can start encoding policy that is harder to reconcile with server truth.

## What To Preserve

- Preserve the schema-first contract boundary between packages, especially the explicit decoding approach visible in [`packages/shared/src/schemaJson.ts`](../packages/shared/src/schemaJson.ts) and the contracts package.
- Preserve the event store, read model, and projection approach on the server rather than collapsing back into direct mutable session state flows. [`apps/server/src/orchestration/Layers/OrchestrationEngine.ts`](../apps/server/src/orchestration/Layers/OrchestrationEngine.ts) is part of the codebase’s architectural center.
- Preserve queue-backed async workers and receipt signaling. The system is already designed around ordered background work and explicit completion signals, and that is a reliability asset, not overhead.
- Preserve the no-barrel policy for shared runtime utilities. `@okcode/shared` subpath exports are a good constraint because they keep ownership and import surfaces explicit.
- Preserve the strong server-side tests around orchestration, provider, persistence, and transport behavior. The backend currently earns trust partly because it has real coverage in those areas.
- Preserve explicit package roles. `apps/server`, `apps/web`, `packages/contracts`, and `packages/shared` have distinct responsibilities today, and refactors should sharpen those boundaries rather than blur them.
- Preserve the current focus on operational predictability under load and failure that is described in [`.docs/architecture.md`](./architecture.md) and reinforced in the code.

## Suggested Sequencing

### Phase 1: Frontend extraction without behavior change

Goal:
Reduce `ChatView` concentration while preserving current behavior and interaction semantics.

Bounded work items:

- Extract non-visual orchestration from `ChatView` into focused hooks or pure helper modules.
- Group extractions by concern rather than by arbitrary size slicing.
- Preserve or expand tests around extracted logic before moving additional concerns.

Acceptance condition:
No intended behavior changes, tests are preserved or expanded, and [`apps/web/src/components/ChatView.tsx`](../apps/web/src/components/ChatView.tsx) is materially smaller because orchestration responsibilities have moved out of the shell.

### Phase 2: Timeline decomposition and performance verification

Goal:
Make timeline behavior easier to reason about and safer to tune for long-thread performance.

Bounded work items:

- Extract row-building into a pure module.
- Extract virtualization heuristics into a focused module with direct tests.
- Split rendering branches into smaller row renderer units.
- Recheck long-thread behavior and streaming behavior after decomposition.

Acceptance condition:
Virtualization policy is covered by focused tests, long-thread behavior has been rechecked, and `MessagesTimeline` is reduced to composition plus a small amount of local coordination.

### Phase 3: WebSocket handler modularization

Goal:
Reduce `wsServer` to lifecycle management, boundary validation, and delegation.

Bounded work items:

- Extract adjacent request handlers by domain such as `project`, `thread`, `attachments`, `git`, `terminal`, and `server/meta`.
- Keep top-level schema decoding and transport invariants centralized.
- Preserve current request semantics and push behavior while moving handler bodies out.

Acceptance condition:
[`apps/server/src/wsServer.ts`](../apps/server/src/wsServer.ts) primarily owns lifecycle, boundary checks, and delegation, while per-domain handler logic has moved into smaller route modules.

### Phase 4: Guardrails and cleanup

Goal:
Prevent re-concentration after the first extraction wave and document the intended architecture direction.

Bounded work items:

- Add lightweight internal guidance around soft file size thresholds and non-visual extraction expectations.
- Document the intended module boundaries for chat orchestration, timeline behavior, and transport handlers.
- Remove leftover compatibility shims or dead indirection introduced during earlier phases.

Acceptance condition:
Architecture notes are updated, guardrails are documented, and the extracted structure is understandable without needing to rediscover the same refactor intent later.

## Appendix: Sampled Areas

- [`apps/server/src/orchestration/Layers/OrchestrationEngine.ts`](../apps/server/src/orchestration/Layers/OrchestrationEngine.ts)
- [`apps/server/src/provider/Layers/ProviderService.ts`](../apps/server/src/provider/Layers/ProviderService.ts)
- [`apps/server/src/wsServer.ts`](../apps/server/src/wsServer.ts)
- [`apps/web/src/components/ChatView.tsx`](../apps/web/src/components/ChatView.tsx)
- [`apps/web/src/components/chat/MessagesTimeline.tsx`](../apps/web/src/components/chat/MessagesTimeline.tsx)
- [`apps/web/src/store.ts`](../apps/web/src/store.ts)
- [`packages/shared/src/schemaJson.ts`](../packages/shared/src/schemaJson.ts)
- [`packages/contracts/src/index.ts`](../packages/contracts/src/index.ts)
- [`.docs/architecture.md`](./architecture.md)
