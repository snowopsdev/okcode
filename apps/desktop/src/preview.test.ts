import { describe, expect, it } from "vitest";

import {
  createClosedPreviewState,
  createPreviewErrorState,
  sanitizeDesktopPreviewBounds,
  validateDesktopPreviewUrl,
} from "./preview";

describe("validateDesktopPreviewUrl", () => {
  it("accepts localhost URLs with explicit ports", () => {
    expect(validateDesktopPreviewUrl("http://localhost:3000")).toEqual({
      ok: true,
      url: "http://localhost:3000/",
    });
    expect(validateDesktopPreviewUrl("http://127.0.0.1:4173/app")).toEqual({
      ok: true,
      url: "http://127.0.0.1:4173/app",
    });
  });

  it("rejects missing, malformed, or remote URLs", () => {
    expect(validateDesktopPreviewUrl("")).toEqual({
      ok: false,
      error: {
        code: "invalid-url",
        message: "Preview URL must be a non-empty string.",
      },
    });
    expect(validateDesktopPreviewUrl("notaurl")).toEqual({
      ok: false,
      error: {
        code: "invalid-url",
        message: "Preview URL is not a valid URL.",
      },
    });
    expect(validateDesktopPreviewUrl("https://localhost:3000")).toEqual({
      ok: false,
      error: {
        code: "non-local-url",
        message: "Preview only supports local http URLs.",
      },
    });
    expect(validateDesktopPreviewUrl("http://example.com:3000")).toEqual({
      ok: false,
      error: {
        code: "non-local-url",
        message: "Preview only supports localhost, 127.0.0.1, or ::1.",
      },
    });
    expect(validateDesktopPreviewUrl("http://localhost")).toEqual({
      ok: false,
      error: {
        code: "invalid-url",
        message: "Preview URL must include an explicit port.",
      },
    });
  });
});

describe("sanitizeDesktopPreviewBounds", () => {
  it("rounds values and disables visibility for empty regions", () => {
    expect(
      sanitizeDesktopPreviewBounds({
        x: 10.4,
        y: 20.6,
        width: 480.2,
        height: 320.8,
        visible: true,
      }),
    ).toEqual({
      x: 10,
      y: 21,
      width: 480,
      height: 321,
      visible: true,
    });

    expect(
      sanitizeDesktopPreviewBounds({
        x: Number.NaN,
        y: Number.NaN,
        width: -10,
        height: 0,
        visible: true,
      }),
    ).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false,
    });
  });
});

describe("preview state helpers", () => {
  it("creates closed and error states with predictable defaults", () => {
    expect(createClosedPreviewState()).toEqual({
      status: "closed",
      url: null,
      title: null,
      visible: false,
      error: null,
    });

    expect(
      createPreviewErrorState("load-failed", "Dev server did not respond.", {
        url: "http://localhost:3000/",
      }),
    ).toEqual({
      status: "error",
      url: "http://localhost:3000/",
      title: null,
      visible: false,
      error: {
        code: "load-failed",
        message: "Dev server did not respond.",
      },
    });
  });
});
