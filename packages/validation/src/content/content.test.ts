import { describe, expect, it } from "vitest";

import { manifestForTaskRoot, manifestFromInspection } from "./manifest";
import {
  buildTextFilePreview,
  classifyBySize,
  FULL_RENDER_MAX_BYTES,
  MAX_RENDERED_LINE_CHARACTERS,
  PREVIEW_MAX_BYTES,
  PREVIEW_MAX_LINES,
  sanitizeDisplayText,
  splitDisplayLines,
} from "./text";
import { createStoredZip, inspectZip } from "../archive/zip";
import { assignTaskSlugs, taskSlugFromExternalKey } from "../tasks/slug";

const encoder = new TextEncoder();

describe("sanitizeDisplayText", () => {
  it("leaves ordinary text untouched", () => {
    const source = "FROM ubuntu:22.04\tWORKDIR /app";
    expect(sanitizeDisplayText(source)).toBe(source);
  });

  it("neutralizes ANSI colour and cursor sequences", () => {
    expect(sanitizeDisplayText("\u001B[31mred\u001B[0m")).toBe("\uFFFDred\uFFFD");
    expect(sanitizeDisplayText("a\u001B[2Kb")).toBe("a\uFFFDb");
  });

  it("neutralizes OSC sequences terminated by BEL or ST", () => {
    expect(sanitizeDisplayText("\u001B]0;title\u0007ok")).toBe("\uFFFDok");
    expect(sanitizeDisplayText("\u001B]8;;https://example.com\u001B\\link")).toBe("\uFFFDlink");
  });

  it("neutralizes stray control characters and bidirectional overrides", () => {
    expect(sanitizeDisplayText("a\u0000b\u0008c")).toBe("a\uFFFDb\uFFFDc");
    expect(sanitizeDisplayText("safe\u202Eevil")).toBe("safe\uFFFDevil");
    expect(sanitizeDisplayText("keep\ttabs")).toBe("keep\ttabs");
  });

  it("does not interpret markup: angle brackets survive as text", () => {
    const source = '<script>alert("x")</script>';
    expect(sanitizeDisplayText(source)).toBe(source);
  });
});

describe("splitDisplayLines", () => {
  it("normalizes CRLF and lone CR so line numbers match an editor", () => {
    expect(splitDisplayLines("a\r\nb\rc\nd")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("classifyBySize", () => {
  it("applies the documented thresholds", () => {
    expect(classifyBySize(0)).toBe("full");
    expect(classifyBySize(FULL_RENDER_MAX_BYTES)).toBe("full");
    expect(classifyBySize(FULL_RENDER_MAX_BYTES + 1)).toBe("preview");
    expect(classifyBySize(PREVIEW_MAX_BYTES)).toBe("preview");
    expect(classifyBySize(PREVIEW_MAX_BYTES + 1)).toBe("metadata");
  });
});

describe("buildTextFilePreview", () => {
  it("renders a small file in full", () => {
    const preview = buildTextFilePreview(encoder.encode("one\ntwo\nthree"));

    expect(preview.mode).toBe("full");
    expect(preview.lines).toEqual(["one", "two", "three"]);
    expect(preview.totalLines).toBe(3);
    expect(preview.truncated).toBe(false);
  });

  it("truncates a large-but-readable file and says so", () => {
    // 100 bytes per line, enough lines to land between the full-render ceiling and
    // the preview ceiling and to exceed the preview line budget.
    const line = `${"x".repeat(99)}\n`;
    const lineCount = Math.max(
      PREVIEW_MAX_LINES + 1,
      Math.ceil((FULL_RENDER_MAX_BYTES + 1) / line.length),
    );
    const preview = buildTextFilePreview(encoder.encode(line.repeat(lineCount)));

    expect(preview.mode).toBe("preview");
    expect(preview.byteSize).toBeGreaterThan(FULL_RENDER_MAX_BYTES);
    expect(preview.lines.length).toBe(PREVIEW_MAX_LINES);
    expect(preview.truncated).toBe(true);
    expect(preview.totalLines).toBeGreaterThan(PREVIEW_MAX_LINES);
  });

  it("never decodes a file past the preview ceiling", () => {
    const preview = buildTextFilePreview(new Uint8Array(PREVIEW_MAX_BYTES + 1));

    expect(preview.mode).toBe("metadata");
    expect(preview.lines).toEqual([]);
    expect(preview.totalLines).toBeNull();
    expect(preview.truncated).toBe(true);
  });

  it("reports non-UTF-8 content as binary instead of rendering mojibake", () => {
    const preview = buildTextFilePreview(new Uint8Array([0x00, 0xff, 0xfe, 0x41]));

    expect(preview.mode).toBe("binary");
    expect(preview.lines).toEqual([]);
  });

  it("clips a single enormous line", () => {
    const preview = buildTextFilePreview(
      encoder.encode("y".repeat(MAX_RENDERED_LINE_CHARACTERS + 50)),
    );

    expect(preview.hasClippedLines).toBe(true);
    expect(preview.lines[0]?.length).toBe(MAX_RENDERED_LINE_CHARACTERS + 1);
  });

  it("sanitizes escape sequences before they reach a line", () => {
    const preview = buildTextFilePreview(encoder.encode("plain\n\u001B[31mred"));

    expect(preview.lines).toEqual(["plain", "\uFFFDred"]);
  });
});

describe("manifestFromInspection", () => {
  const zip = createStoredZip([
    { path: "environment/" },
    { path: "environment/Dockerfile", data: encoder.encode("FROM scratch\n") },
    { path: "tasks/alpha/task.toml", data: encoder.encode("name = 'a'\n") },
    { path: "tasks/beta/task.toml", data: encoder.encode("name = 'b'\n") },
    { path: "instruction.md", data: encoder.encode("do the thing\n") },
  ]);

  it("lists files only, sorted, with real byte sizes", () => {
    const manifest = manifestFromInspection(inspectZip(zip));

    expect(manifest.map((entry) => entry.path)).toEqual([
      "environment/Dockerfile",
      "instruction.md",
      "tasks/alpha/task.toml",
      "tasks/beta/task.toml",
    ]);
    expect(manifest[0]?.byteSize).toBe(13);
  });

  it("scopes a task to its own root plus shared files", () => {
    const manifest = manifestFromInspection(inspectZip(zip));

    expect(
      manifestForTaskRoot(manifest, "tasks/alpha", ["tasks/alpha", "tasks/beta"]).map(
        (entry) => entry.path,
      ),
    ).toEqual(["tasks/alpha/task.toml"]);

    expect(manifestForTaskRoot(manifest, "", ["tasks/alpha"]).map((entry) => entry.path)).toEqual([
      "environment/Dockerfile",
      "instruction.md",
      "tasks/beta/task.toml",
    ]);
  });
});

describe("task slugs", () => {
  it("produces readable, URL-safe identifiers", () => {
    expect(taskSlugFromExternalKey("Fix_The Build")).toBe("fix-the-build");
    expect(taskSlugFromExternalKey("hello.world")).toBe("hello-world");
    expect(taskSlugFromExternalKey("---")).toBe("task");
    expect(taskSlugFromExternalKey("a".repeat(200))).toHaveLength(64);
  });

  it("keeps slugs unique within one package, deterministically", () => {
    expect(assignTaskSlugs(["fix build", "fix_build", "fix-build", "other"])).toEqual([
      "fix-build",
      "fix-build-2",
      "fix-build-3",
      "other",
    ]);
  });
});
