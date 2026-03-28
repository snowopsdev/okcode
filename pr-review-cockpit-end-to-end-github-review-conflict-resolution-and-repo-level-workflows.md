# PR Review Cockpit: End-to-End GitHub Review, Conflict Resolution, and Repo-Level Workflows

## Summary

Build a desktop-first PR review cockpit in OK Code that makes GitHub PR review fully operable in-app: review comments, threaded conversations, resolve/unresolve, mentions with GitHub profile hover previews, guarded merge-conflict resolution, and repo-versioned workflows/rules stored under `.okcode/`. GitHub remains the source of truth for remote review state; OK Code keeps a local server-side projection for fast rendering, reconnect safety, optimistic updates, and workflow gating.

## Design Direction

- Visual thesis: a calm, dense review workspace with minimal chrome, diff-first composition, one accent color for state, and motion used only to sharpen orientation.
- Content plan: left rail for repo/PR scope, center diff workspace, right inspector for conversations/workflows/conflicts, bottom action rail for review submit/merge readiness.
- Interaction thesis: animated pane transitions on PR selection, inline hunk comment composers that expand in place, hover profile cards for `@mentions`, and a slide-over conflict resolver with preview-before-apply.

## Scope

- In scope: GitHub-only v1, full remote sync for PR review actions, repo-level markdown/frontmatter rules, hybrid human-guided workflow execution, mixed enforcement, desktop-first cockpit with responsive fallback.
- Out of scope for v1: GitLab/Bitbucket, silent conflict auto-apply, in-app repo-rule authoring, non-GitHub review systems, automatic merge execution.

## Repo-Level Files

- `.okcode/review-rules.md`: repo review policy and merge/conflict rules.
- `.okcode/workflows/pr-review.md`: default PR review workflow.
- `.okcode/workflows/*.md`: additional named workflows.
- `.okcode/skill-sets/*.md`: reusable skill bundles that workflows can reference.
- All files use YAML frontmatter plus markdown body. Frontmatter is authoritative; markdown body is operator-facing guidance rendered in the UI.
- Missing files fall back to built-in defaults. UI shows “Using default repo workflow” rather than failing.

## Frontmatter Schemas

- `review-rules.md`: `version`, `title`, `mergePolicy`, `conflictPolicy`, `requiredChecks`, `requiredApprovals`, `blockingRules`, `advisoryRules`, `defaultWorkflow`, `mentionGroups`.
- workflow file: `id`, `title`, `description`, `appliesTo`, `blocking`, `steps`.
- workflow step: `id`, `title`, `kind`, `blocking`, `action`, `skillSet`, `requiresConfirmation`, `successMessage`, `failureMessage`.
- skill-set file: `id`, `title`, `description`, `skills`, `allowedTools`, `runPolicy`.
- `kind` values: `checklist`, `remoteCheck`, `reviewAction`, `skillSet`, `conflictAnalysis`, `manualApproval`, `openExternal`.

## Contracts and Transport

- Add `packages/contracts/src/prReview.ts` with schemas for:
  - `PrReviewConfig`, `PrWorkflowDefinition`, `PrWorkflowStep`, `PrSkillSetDefinition`
  - `PrReviewParticipant`, `GitHubUserPreview`, `PrReviewComment`, `PrReviewThread`, `PrReviewThreadState`
  - `PrReviewFile`, `PrReviewPatchResult`, `PrReviewDashboardResult`
  - `PrConflictAnalysis`, `PrConflictCandidateResolution`, `PrConflictApplyResult`
  - `PrReviewDraft`, `PrSubmitReviewInput`, `PrSubmitReviewResult`
- Extend `packages/contracts/src/ws.ts` with `prReview.*` methods:
  - `prReview.getConfig`, `prReview.getDashboard`, `prReview.getPatch`
  - `prReview.addThread`, `prReview.replyToThread`
  - `prReview.resolveThread`, `prReview.unresolveThread`
  - `prReview.searchUsers`, `prReview.getUserPreview`
  - `prReview.analyzeConflicts`, `prReview.applyConflictResolution`
  - `prReview.runWorkflowStep`, `prReview.submitReview`
- Add push channels:
  - `prReview.syncUpdated` for dashboard/thread/projection refresh
  - `prReview.repoConfigUpdated` for `.okcode` live reload

## Server Architecture

- Extend `apps/server/src/git/Services/GitHubCli.ts` and its layer to support `gh api graphql`/`gh pr diff` for:
  - dashboard summary, files, review threads/comments, participants, reviewers
  - add review comment, reply, resolve/unresolve, submit review, user search/profile preview
- Add `apps/server/src/prReview/Services/RepoReviewConfig.ts`:
  - loads `.okcode` files from `workspaceRoot`
  - validates frontmatter against contracts
  - caches per repo and watches `.okcode/` using the same fs-watch pattern as keybindings
- Add `apps/server/src/prReview/Services/PrReviewProjection.ts`:
  - stores last known GitHub review state per repo/PR
  - supports optimistic updates and reconnect reconciliation
- Add `apps/server/src/prReview/Services/WorkflowEngine.ts`:
  - resolves effective workflow from repo rules + workflow files + skill sets
  - computes step status from GitHub/OK Code state
  - enforces blocking rules only for configured safety-critical actions
- Add `apps/server/src/prReview/Services/MergeConflictResolver.ts`:
  - classifies conflicts by file/hunk
  - auto-generates only deterministic candidate resolutions
  - requires explicit confirmation before apply
  - falls back to “propose only” for ambiguous conflicts
- Reuse existing project file APIs for opening repo rules/workflow files in the editor; do not add a second config storage location.

## Web Architecture

- Keep route at `apps/web/src/routes/_chat.pr-review.tsx` but split into feature components:
  - `PrReviewShell`, `PrListRail`, `PrWorkspace`, `PrConversationInspector`, `PrWorkflowPanel`, `PrConflictDrawer`
- Reuse existing diff rendering infrastructure from `DiffPanel.tsx` and shared diff utilities instead of creating a second patch renderer.
- Primary layout:
  - left rail: repo selector, state filter, PR list, workflow status summary
  - center: diff/file review with inline conversation anchors
  - right inspector: thread list, composer, participants, workflow graph, conflict summary
  - bottom sticky action rail: submit review (`Comment`, `Approve`, `Request changes`), unresolved count, merge-readiness summary
- Responsive fallback:
  - desktop/Electron keeps three panes
  - smaller widths collapse right inspector into tabs/drawer
  - mobile is read-only plus lightweight comment/reply drawer in v1

## Core UX Flows

- Selecting a PR loads one aggregated dashboard request first, then patch/thread details in parallel.
- Commenting supports top-level and reply threads; inline composer is anchored to file/hunk and preserves unsent drafts locally by `projectId + prNumber + file + line`.
- Mentions autocomplete prioritizes current participants/reviewers, then repo user search. Hover card shows avatar, name, login, bio, company, location, and GitHub profile link.
- Resolve/unresolve is optimistic in UI, then reconciled with GitHub.
- Conflict drawer shows “safe to apply” vs “needs review”, side-by-side rationale, and resulting patch preview before apply.
- Workflow graph shows step states: `todo`, `running`, `blocked`, `done`, `failed`, `skipped`. Skill-set steps run only after explicit confirmation when marked `requiresConfirmation`.

## Enforcement Rules

- Hard-enforced: unresolved blocking conflict policy, required remote checks, required approvals, workflow steps explicitly marked `blocking`, missing authenticated GitHub session for remote review mutations.
- Advisory-only: checklist heuristics, suggested reviewers, prose review guidance, optional skill-set steps.
- If GitHub auth/CLI is unavailable, page degrades to read-only with explicit callouts and disables all remote mutations.

## Testing

- Contracts: schema decode/encode tests for all new frontmatter and RPC types.
- Server unit tests: GitHub CLI parsing, repo-rule loading, watcher reload, workflow resolution, conflict classification, optimistic mutation reconciliation.
- Server integration tests: ws routing, dashboard aggregation, comment/reply/resolve flows, repo-config change push events.
- Web tests: repo scope persistence, three-pane layout behavior, inline comment compose/reply, mention search, hover preview, thread resolution, workflow blocking banners, conflict preview/apply confirmation, degraded read-only mode.
- Validation gate before completion: `bun fmt`, `bun lint`, `bun typecheck`, `bun run test`.

## Rollout

- Phase 1: contracts, repo config loader, dashboard aggregation, three-pane shell, read-only conversations/workflow rendering.
- Phase 2: add/reply/resolve/unresolve, mention search/hover previews, submit review actions.
- Phase 3: conflict analysis drawer, guarded apply flow, executable workflow steps and skill-set execution hooks.
- Phase 4: polish motion, optimistic sync hardening, keyboard shortcuts, accessibility sweep, analytics.

## Assumptions and Defaults

- GitHub is the only review backend in v1.
- Repo rules live only in the repo and are source-controlled under `.okcode/`.
- In-app editing of workflow/rule files is not part of v1; OK Code provides “Open rule/workflow file” actions with live reload after external edits.
- Conflict resolution never silently mutates repo state; preview + confirm is mandatory.
- When repo-level files are absent or invalid, the UI renders a default non-blocking workflow plus a clear validation error surface.
