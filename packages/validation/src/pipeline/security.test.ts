import { describe, expect, it } from "vitest";

import {
  createStoredZip,
  createZipWithClaimedSizes,
  createZipWithRawPath,
  inspectZip,
} from "../archive/zip";
import { FINDING_CODES } from "../finding-codes";
import { fixturePackage } from "../fixtures";
import {
  MAX_ARCHIVE_FILE_COUNT,
  MAX_ARCHIVE_PATH_LENGTH,
  MAX_SINGLE_EXTRACTED_FILE_BYTES,
} from "../limits";
import { runValidationPipeline } from "./run";

const encoder = new TextEncoder();
const PAYLOAD = encoder.encode("payload");

async function pipelineCodes(archiveBytes: Uint8Array): Promise<readonly string[]> {
  const report = await runValidationPipeline({ archiveBytes });
  return report.findings.map((finding) => finding.code);
}

describe("hostile archive rejection", () => {
  it("rejects parent traversal entries", async () => {
    const bytes = createZipWithRawPath("../evil.txt", PAYLOAD);
    expect(() => inspectZip(bytes)).toThrow(/safe relative path|absolute/i);
    expect(await pipelineCodes(bytes)).toEqual([FINDING_CODES.ARCHIVE_PATH_TRAVERSAL]);
  });

  it("rejects nested traversal that normalizes outside the workspace", async () => {
    expect(await pipelineCodes(createZipWithRawPath("tests/../../evil.txt", PAYLOAD))).toEqual([
      FINDING_CODES.ARCHIVE_PATH_TRAVERSAL,
    ]);
  });

  it("rejects absolute paths and drive letters", async () => {
    expect(await pipelineCodes(createZipWithRawPath("/etc/passwd", PAYLOAD))).toEqual([
      FINDING_CODES.ARCHIVE_ABSOLUTE_PATH,
    ]);
    expect(await pipelineCodes(createZipWithRawPath("C:/Windows/win.ini", PAYLOAD))).toEqual([
      FINDING_CODES.ARCHIVE_ABSOLUTE_PATH,
    ]);
  });

  it("rejects backslash separators used to smuggle traversal", async () => {
    expect(await pipelineCodes(createZipWithRawPath("..\\evil.txt", PAYLOAD))).toEqual([
      FINDING_CODES.ARCHIVE_UNEXPECTED_TYPE,
    ]);
  });

  it("rejects overlong entry paths", async () => {
    const longPath = `${"a".repeat(MAX_ARCHIVE_PATH_LENGTH + 1)}.txt`;
    expect(await pipelineCodes(createZipWithRawPath(longPath, PAYLOAD))).toEqual([
      FINDING_CODES.ARCHIVE_PATH_TRAVERSAL,
    ]);
  });

  it("rejects a file whose declared size exceeds the single-file ceiling", async () => {
    const bytes = createZipWithClaimedSizes(
      "blob.bin",
      new Uint8Array([1]),
      MAX_SINGLE_EXTRACTED_FILE_BYTES + 1,
    );
    expect(await pipelineCodes(bytes)).toEqual([FINDING_CODES.ARCHIVE_FILE_TOO_LARGE]);
  });

  it("rejects archives with too many entries", async () => {
    const entries = Array.from({ length: MAX_ARCHIVE_FILE_COUNT + 1 }, (_, index) => ({
      path: `file-${index}.txt`,
      data: PAYLOAD,
    }));
    expect(await pipelineCodes(createStoredZip(entries))).toEqual([
      FINDING_CODES.ARCHIVE_FILE_COUNT,
    ]);
  });

  it("rejects malformed archives that are not ZIPs at all", async () => {
    expect(await pipelineCodes(encoder.encode("this is not a zip file"))).toEqual([
      FINDING_CODES.ARCHIVE_UNSUPPORTED,
    ]);
  });

  it("rejects a truncated central directory", async () => {
    const complete = createStoredZip([{ path: "instruction.md", data: PAYLOAD }]);
    const truncated = complete.subarray(0, complete.byteLength - 8);
    expect(await pipelineCodes(truncated)).toEqual([FINDING_CODES.ARCHIVE_UNSUPPORTED]);
  });

  it("marks traversal, absolute paths, and symlinks as critical rather than merely invalid", async () => {
    const report = await runValidationPipeline({
      archiveBytes: createZipWithRawPath("../evil.txt", PAYLOAD),
    });
    expect(report.findings[0]?.severity).toBe("critical");
    expect(report.findings[0]?.category).toBe("archive");
    expect(report.outcome).toBe("fail");
    expect(report.validators).toEqual([]);
  });

  it("never leaves a partially validated package looking valid", async () => {
    const report = await runValidationPipeline({
      archiveBytes: createZipWithRawPath("/etc/passwd", PAYLOAD),
    });
    expect(report.tasks).toEqual([]);
    expect(report.benchmark).toBeNull();
    expect(report.outcome).toBe("fail");
  });
});

describe("package content is inspected, never executed", () => {
  it("reports a hostile Dockerfile without building or running anything", async () => {
    const report = await runValidationPipeline({
      archiveBytes: createStoredZip(
        fixturePackage("security-invalid").files.map((file) => ({
          path: file.path,
          data: encoder.encode(file.content),
        })),
      ),
    });

    expect(report.findings.map((finding) => finding.code)).toContain(
      FINDING_CODES.TASK_SECURITY_DOCKER_SOCKET,
    );
    expect(report.outcome).toBe("fail");
  });
});
