# Preview Panel

## Summary

- [ ] Build an in-app web UI preview for the desktop app only.
- [ ] Use a dedicated renderer-hosted preview panel backed by an Electron-managed embedded webview surface.
- [ ] Do not route preview traffic through the OK Code server.
- [ ] Do not expose arbitrary browsing.
- [ ] Treat the preview as an explicit local-dev feature for project URLs like `http://localhost:3000`.
- [ ] Enforce strict allowlisting, clear failure states, and zero impact on the existing web or browser mode.

## Architecture Choice

- [ ] Use a desktop-only preview panel in the React UI.
- [ ] Let Electron own the actual embedded browsing surface.
- [ ] Keep React responsible for preview state, toolbar controls, visibility, and status text.
- [ ] Expose preview commands and preview status events through `DesktopBridge`.
- [ ] Keep one preview session per app window, owned by the Electron main process.
- [ ] Restrict the preview to explicit, validated local-dev URLs.

Do not use:

- [ ] Do not use a plain `iframe` in the main renderer.
- [ ] Do not proxy preview traffic through the OK Code server.
- [ ] Do not turn this into general-purpose browsing.

## Public Interface Changes

- [ ] Add `preview.open(input: { url: string; title?: string | null }): Promise<PreviewOpenResult>` to `DesktopBridge`.
- [ ] Add `preview.close(): Promise<void>` to `DesktopBridge`.
- [ ] Add `preview.reload(): Promise<void>` to `DesktopBridge`.
- [ ] Add `preview.navigate(input: { url: string }): Promise<PreviewNavigateResult>` to `DesktopBridge`.
- [ ] Add `preview.getState(): Promise<DesktopPreviewState>` to `DesktopBridge`.
- [ ] Add `preview.onState(listener): () => void` to `DesktopBridge`.
- [ ] Add desktop-only preview types:
  - [ ] `DesktopPreviewState`
  - [ ] `DesktopPreviewStatus = "closed" | "loading" | "ready" | "error"`
  - [ ] `DesktopPreviewErrorCode = "invalid-url" | "non-local-url" | "navigation-blocked" | "load-failed" | "process-gone"`
- [ ] Do not add preview RPCs to `NativeApi`.
- [ ] Do not add preview RPCs to `WS_METHODS`.

## URL Policy

- [ ] Allow only `http://localhost:<port>`.
- [ ] Allow only `http://127.0.0.1:<port>`.
- [ ] Allow only `http://[::1]:<port>`.
- [ ] Reject `https`, custom hosts, LAN IPs, and remote domains.
- [ ] Reject empty URLs and malformed URLs.
- [ ] Keep navigation inside the same local-origin policy set.
- [ ] If the page tries to open a new window, only open externally if the target also passes local-dev validation; otherwise block.

## UI Design

- [ ] Add a new right-side preview panel in the chat route.
- [ ] Keep it desktop-only.
- [ ] Keep it collapsed by default.
- [ ] Make it resizable.
- [ ] Make it openable from the chat header and compact controls.
- [ ] Remember last open or closed state per thread.
- [ ] Keep the preview URL project-scoped, not thread-scoped.

Panel contents:

- [ ] Toolbar with URL field, reload, open externally, and close.
- [ ] Status row with `Loading`, `Ready`, `Blocked`, or failure reason.
- [ ] Empty state with instructions to start a local dev server and enter a localhost URL.
- [ ] Embedded preview surface below the toolbar.

Recommended placement:

- [ ] Route-level shell under `apps/web/src/routes/_chat.tsx`.
- [ ] Preview panel component under `apps/web/src/components/PreviewPanel.tsx`.
- [ ] Small preview state store under `apps/web/src/previewStateStore.ts`.

## Data Flow

- [ ] User opens preview panel.
- [ ] User enters a `localhost` URL or picks a remembered recent URL.
- [ ] React validates the basic shape immediately.
- [ ] Renderer calls `desktopBridge.preview.open`.
- [ ] Main process validates the URL again, creates or reuses the preview surface, and starts the load.
- [ ] Main process emits preview state updates for loading, ready, title, current URL, and errors.
- [ ] React updates the toolbar and status from those events.
- [ ] Close hides and tears down the embedded surface cleanly.
- [ ] Keep one preview session per desktop window, not per thread tab.

## Desktop Main Process Design

- [ ] Add IPC channels for preview open, close, reload, navigate, get-state, and state-updates in `apps/desktop/src/main.ts`.
- [ ] Maintain a preview controller keyed by `BrowserWindow`.
- [ ] Create and destroy the child browsing surface on demand.
- [ ] Clamp bounds to a container region communicated by the renderer.
- [ ] Emit state updates on `did-start-loading`, `did-stop-loading`, `page-title-updated`, `did-fail-load`, and process-gone-style events.
- [ ] Deny arbitrary popups and off-policy navigations.
- [ ] Prefer a `WebContentsView` or equivalent child web contents surface supported by the Electron version in use.
- [ ] Keep the critical requirement of main-process ownership plus explicit bounds control.

## Security and Reliability Rules

- [ ] Keep this feature desktop-only.
- [ ] Make it a no-op in browser mode.
- [ ] Double-validate URLs in renderer and main.
- [ ] Never grant Node integration to preview content.
- [ ] Keep context isolation and sandboxing on.
- [ ] Do not share the OK Code preload bridge with preview content.
- [ ] Tear down the preview surface on window close and on explicit close.
- [ ] Show actionable errors instead of silent blank pages.

## Testing

- [ ] Add contracts and preload typing coverage for bridge methods and preview state types.
- [ ] Add desktop unit tests for URL validation, navigation blocking, state transitions, and teardown behavior.
- [ ] Add web component tests for panel open and close, desktop-only rendering, status mapping, and invalid URL handling.

Critical scenarios:

- [ ] Valid `localhost` preview loads.
- [ ] Invalid or non-local URL is rejected.
- [ ] Reload works.
- [ ] Dev server goes down after load.
- [ ] Preview process crashes or is killed.
- [ ] User closes preview while loading.
- [ ] Browser mode hides all preview UI.
- [ ] External link from preview is blocked or opened per policy.

## Rollout

### Phase 1

- [ ] Add bridge types.
- [ ] Add desktop controller.
- [ ] Add hidden preview panel shell.
- [ ] Add manual URL entry.

### Phase 2

- [ ] Add resize and persistence polish.
- [ ] Add recent URLs.
- [ ] Improve status UX.
- [ ] Add external-open action.

### Phase 3

- [ ] Optionally add a project-level suggested preview URL setting in `packages/contracts/src/server.ts` and settings UI, only if needed later.

## Acceptance Criteria

- [ ] Desktop app can render a local web UI preview inside OK Code.
- [ ] Browser mode behavior is unchanged.
- [ ] Only explicit local-dev URLs are allowed.
- [ ] Preview failures are visible and recoverable.
- [ ] Existing server and WebSocket architecture remains untouched.
- [ ] No preview traffic is proxied through `apps/server`.
