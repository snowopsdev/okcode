import type { ProjectId, ThreadId } from "@okcode/contracts";
import { create } from "zustand";

export type PreviewDock = "left" | "right" | "top" | "bottom";

interface PersistedPreviewUiState {
  openByThreadId: Record<string, boolean>;
  dockByThreadId: Record<string, PreviewDock>;
  sizeByThreadId: Record<string, number>;
  urlByProjectId: Record<string, string>;
}

interface PreviewStateStore extends PersistedPreviewUiState {
  setThreadOpen: (threadId: ThreadId, open: boolean) => void;
  toggleThreadOpen: (threadId: ThreadId) => void;
  setThreadDock: (threadId: ThreadId, dock: PreviewDock) => void;
  toggleThreadLayout: (threadId: ThreadId) => void;
  setThreadSize: (threadId: ThreadId, size: number) => void;
  setProjectUrl: (projectId: ProjectId, url: string) => void;
}

const PREVIEW_STATE_STORAGE_KEY = "okcode:desktop-preview:v2";

function normalizePreviewSize(size: unknown): number | null {
  if (typeof size !== "number" || !Number.isFinite(size)) {
    return null;
  }
  return Math.max(180, Math.round(size));
}

function readPersistedPreviewUiState(): PersistedPreviewUiState {
  if (typeof window === "undefined") {
    return { openByThreadId: {}, dockByThreadId: {}, sizeByThreadId: {}, urlByProjectId: {} };
  }

  try {
    const raw = window.localStorage.getItem(PREVIEW_STATE_STORAGE_KEY);
    if (!raw) {
      return { openByThreadId: {}, dockByThreadId: {}, sizeByThreadId: {}, urlByProjectId: {} };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedPreviewUiState>;
    return {
      openByThreadId:
        parsed.openByThreadId && typeof parsed.openByThreadId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.openByThreadId).filter(
                (entry): entry is [string, boolean] =>
                  typeof entry[0] === "string" && entry[1] === true,
              ),
            )
          : {},
      dockByThreadId:
        parsed.dockByThreadId && typeof parsed.dockByThreadId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.dockByThreadId).filter(
                (entry): entry is [string, PreviewDock] =>
                  typeof entry[0] === "string" &&
                  (entry[1] === "left" ||
                    entry[1] === "right" ||
                    entry[1] === "top" ||
                    entry[1] === "bottom"),
              ),
            )
          : {},
      sizeByThreadId:
        parsed.sizeByThreadId && typeof parsed.sizeByThreadId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.sizeByThreadId).flatMap(([threadId, size]) => {
                const normalizedSize = normalizePreviewSize(size);
                return typeof threadId === "string" && normalizedSize !== null
                  ? [[threadId, normalizedSize] as const]
                  : [];
              }),
            )
          : {},
      urlByProjectId:
        parsed.urlByProjectId && typeof parsed.urlByProjectId === "object"
          ? Object.fromEntries(
              Object.entries(parsed.urlByProjectId).filter(
                (entry): entry is [string, string] =>
                  typeof entry[0] === "string" &&
                  typeof entry[1] === "string" &&
                  entry[1].trim().length > 0,
              ),
            )
          : {},
    };
  } catch {
    return { openByThreadId: {}, dockByThreadId: {}, sizeByThreadId: {}, urlByProjectId: {} };
  }
}

function persistPreviewUiState(state: PersistedPreviewUiState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      PREVIEW_STATE_STORAGE_KEY,
      JSON.stringify({
        openByThreadId: state.openByThreadId,
        dockByThreadId: state.dockByThreadId,
        sizeByThreadId: state.sizeByThreadId,
        urlByProjectId: state.urlByProjectId,
      } satisfies PersistedPreviewUiState),
    );
  } catch {
    // Ignore storage errors to avoid breaking the desktop chat UI.
  }
}

const initialState = readPersistedPreviewUiState();

export const usePreviewStateStore = create<PreviewStateStore>((set, get) => ({
  ...initialState,

  setThreadOpen: (threadId, open) => {
    set((state) => {
      const nextOpenByThreadId = {
        ...state.openByThreadId,
        [threadId]: open,
      };
      persistPreviewUiState({
        openByThreadId: nextOpenByThreadId,
        dockByThreadId: state.dockByThreadId,
        sizeByThreadId: state.sizeByThreadId,
        urlByProjectId: state.urlByProjectId,
      });
      return { openByThreadId: nextOpenByThreadId };
    });
  },

  toggleThreadOpen: (threadId) => {
    const current = get().openByThreadId[threadId] === true;
    get().setThreadOpen(threadId, !current);
  },

  setThreadDock: (threadId, dock) => {
    set((state) => {
      const nextDockByThreadId = {
        ...state.dockByThreadId,
        [threadId]: dock,
      };
      persistPreviewUiState({
        openByThreadId: state.openByThreadId,
        dockByThreadId: nextDockByThreadId,
        sizeByThreadId: state.sizeByThreadId,
        urlByProjectId: state.urlByProjectId,
      });
      return { dockByThreadId: nextDockByThreadId };
    });
  },

  toggleThreadLayout: (threadId) => {
    const current = get().dockByThreadId[threadId] ?? "right";
    get().setThreadDock(
      threadId,
      current === "left"
        ? "top"
        : current === "right"
          ? "bottom"
          : current === "top"
            ? "left"
            : "right",
    );
  },

  setThreadSize: (threadId, size) => {
    const normalizedSize = normalizePreviewSize(size);
    if (normalizedSize === null) {
      return;
    }
    set((state) => {
      const nextSizeByThreadId = {
        ...state.sizeByThreadId,
        [threadId]: normalizedSize,
      };
      persistPreviewUiState({
        openByThreadId: state.openByThreadId,
        dockByThreadId: state.dockByThreadId,
        sizeByThreadId: nextSizeByThreadId,
        urlByProjectId: state.urlByProjectId,
      });
      return { sizeByThreadId: nextSizeByThreadId };
    });
  },

  setProjectUrl: (projectId, url) => {
    const normalizedUrl = url.trim();
    set((state) => {
      const nextUrlByProjectId = { ...state.urlByProjectId };
      if (normalizedUrl.length > 0) {
        nextUrlByProjectId[projectId] = normalizedUrl;
      } else {
        delete nextUrlByProjectId[projectId];
      }
      persistPreviewUiState({
        openByThreadId: state.openByThreadId,
        dockByThreadId: state.dockByThreadId,
        sizeByThreadId: state.sizeByThreadId,
        urlByProjectId: nextUrlByProjectId,
      });
      return { urlByProjectId: nextUrlByProjectId };
    });
  },
}));
