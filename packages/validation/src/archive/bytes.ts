import { FINDING_CODES, type FindingCodeName } from "../finding-codes";

export class ArchiveError extends Error {
  readonly code: FindingCodeName;

  constructor(code: FindingCodeName, message: string) {
    super(message);
    this.name = "ArchiveError";
    this.code = code;
  }
}

function requireByte(buf: Uint8Array, offset: number): number {
  const value = buf[offset];
  if (value === undefined) {
    throw new ArchiveError(FINDING_CODES.ARCHIVE_UNSUPPORTED, "Truncated ZIP archive.");
  }
  return value;
}

export function readU16(buf: Uint8Array, offset: number): number {
  return requireByte(buf, offset) | (requireByte(buf, offset + 1) << 8);
}

export function readU32(buf: Uint8Array, offset: number): number {
  return (
    requireByte(buf, offset) +
    requireByte(buf, offset + 1) * 256 +
    requireByte(buf, offset + 2) * 65536 +
    requireByte(buf, offset + 3) * 16777216
  );
}

export function writeU16(target: number[], value: number): void {
  target.push(value & 0xff, (value >> 8) & 0xff);
}

export function writeU32(target: number[], value: number): void {
  target.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}
