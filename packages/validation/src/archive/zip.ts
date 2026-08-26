import { crc32, inflateRawSync } from "node:zlib";

import { FINDING_CODES } from "../finding-codes";
import {
  MAX_ARCHIVE_FILE_COUNT,
  MAX_COMPRESSION_RATIO,
  MAX_EXTRACTED_ARCHIVE_BYTES,
  MAX_SINGLE_EXTRACTED_FILE_BYTES,
  MAX_UPLOAD_ARCHIVE_BYTES,
  MAX_ZIP_COMMENT_BYTES,
  UNIX_IFMT,
  UNIX_SYMLINK_MODE,
  ZIP_CENTRAL_SIGNATURE,
  ZIP_EOCD64_LOCATOR_SIGNATURE,
  ZIP_EOCD_SIGNATURE,
  ZIP_LOCAL_SIGNATURE,
} from "../limits";
import { ArchiveError, readU16, readU32, writeU16, writeU32 } from "./bytes";
import { assertSafeArchivePath } from "./paths";

export type ZipEntry = {
  path: string;
  isDirectory: boolean;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  localHeaderOffset: number;
  unixMode: number | null;
};

export type ZipInspection = {
  entries: ZipEntry[];
  totalUncompressedBytes: number;
};

function findEocdOffset(bytes: Uint8Array): number {
  const minEocd = 22;
  if (bytes.length < minEocd) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_UNSUPPORTED,
      "File is too small to be a ZIP archive.",
    );
  }
  const maxScan = Math.min(bytes.length - minEocd, MAX_ZIP_COMMENT_BYTES);
  for (let i = 0; i <= maxScan; i += 1) {
    const offset = bytes.length - minEocd - i;
    if (readU32(bytes, offset) === ZIP_EOCD_SIGNATURE) {
      const commentLength = readU16(bytes, offset + 20);
      if (offset + minEocd + commentLength === bytes.length) {
        return offset;
      }
    }
  }
  throw new ArchiveError(
    FINDING_CODES.ARCHIVE_UNSUPPORTED,
    "ZIP end-of-central-directory not found.",
  );
}

function unixModeFromExternal(versionMadeBy: number, externalAttrs: number): number | null {
  const host = versionMadeBy >> 8;
  if (host !== 3) {
    return null;
  }
  return (externalAttrs >>> 16) & 0xffff;
}

export function inspectZip(bytes: Uint8Array): ZipInspection {
  if (bytes.byteLength > MAX_UPLOAD_ARCHIVE_BYTES) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_BOMB_LIMIT,
      `Archive exceeds ${MAX_UPLOAD_ARCHIVE_BYTES} byte upload limit.`,
    );
  }
  if (bytes.byteLength >= 4 && readU32(bytes, 0) === ZIP_EOCD64_LOCATOR_SIGNATURE) {
    throw new ArchiveError(FINDING_CODES.ARCHIVE_UNSUPPORTED, "Zip64 archives are not accepted.");
  }

  const eocd = findEocdOffset(bytes);
  const diskNumber = readU16(bytes, eocd + 4);
  const cdDisk = readU16(bytes, eocd + 6);
  const entriesOnDisk = readU16(bytes, eocd + 8);
  const totalEntries = readU16(bytes, eocd + 10);
  const cdSize = readU32(bytes, eocd + 12);
  const cdOffset = readU32(bytes, eocd + 16);

  if (diskNumber !== 0 || cdDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_UNSUPPORTED,
      "Split ZIP archives are not accepted.",
    );
  }
  if (totalEntries > MAX_ARCHIVE_FILE_COUNT) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_FILE_COUNT,
      `Archive has ${totalEntries} entries; limit is ${MAX_ARCHIVE_FILE_COUNT}.`,
    );
  }
  if (cdOffset + cdSize > bytes.byteLength) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_UNSUPPORTED,
      "ZIP central directory is truncated.",
    );
  }
  if (cdOffset >= 4) {
    const beforeCd = readU32(bytes, cdOffset - 4);
    if (beforeCd === ZIP_EOCD64_LOCATOR_SIGNATURE || beforeCd === 0x06064b50) {
      throw new ArchiveError(FINDING_CODES.ARCHIVE_UNSUPPORTED, "Zip64 archives are not accepted.");
    }
  }

  const entries: ZipEntry[] = [];
  let cursor = cdOffset;
  let totalUncompressedBytes = 0;

  for (let i = 0; i < totalEntries; i += 1) {
    if (readU32(bytes, cursor) !== ZIP_CENTRAL_SIGNATURE) {
      throw new ArchiveError(FINDING_CODES.ARCHIVE_UNSUPPORTED, "Invalid ZIP central directory.");
    }
    const versionMadeBy = readU16(bytes, cursor + 4);
    const flags = readU16(bytes, cursor + 8);
    const compression = readU16(bytes, cursor + 10);
    const crc = readU32(bytes, cursor + 16);
    const compressedSize = readU32(bytes, cursor + 20);
    const uncompressedSize = readU32(bytes, cursor + 24);
    const nameLen = readU16(bytes, cursor + 28);
    const extraLen = readU16(bytes, cursor + 30);
    const commentLen = readU16(bytes, cursor + 32);
    const externalAttrs = readU32(bytes, cursor + 38);
    const localHeaderOffset = readU32(bytes, cursor + 42);
    const nameStart = cursor + 46;
    const nameBytes = bytes.subarray(nameStart, nameStart + nameLen);
    let decodedName: string;
    try {
      decodedName = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes);
    } catch {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_UNEXPECTED_TYPE,
        "Archive entry name is not valid UTF-8.",
      );
    }
    const path = assertSafeArchivePath(decodedName);
    const unixMode = unixModeFromExternal(versionMadeBy, externalAttrs);
    const isDirectory =
      path.endsWith("/") || (unixMode !== null && (unixMode & UNIX_IFMT) === 0o040000);

    if (flags & 0x1) {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_ENCRYPTED,
        `Encrypted ZIP entry rejected: ${path}`,
      );
    }
    if (flags & 0x8) {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_UNSUPPORTED,
        "ZIP data descriptors are not accepted.",
      );
    }
    if (compression !== 0 && compression !== 8) {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_UNSUPPORTED,
        `Unsupported ZIP compression method ${compression} for ${path}.`,
      );
    }
    if (unixMode !== null && (unixMode & UNIX_IFMT) === UNIX_SYMLINK_MODE) {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_SYMLINK_REJECTED,
        `Symbolic link ZIP entry rejected: ${path}`,
      );
    }
    if (!isDirectory && uncompressedSize > MAX_SINGLE_EXTRACTED_FILE_BYTES) {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_FILE_TOO_LARGE,
        `File ${path} exceeds ${MAX_SINGLE_EXTRACTED_FILE_BYTES} byte limit.`,
      );
    }
    if (!isDirectory && compressedSize > 0) {
      const ratio = uncompressedSize / compressedSize;
      if (ratio > MAX_COMPRESSION_RATIO && uncompressedSize > 1024 * 1024) {
        throw new ArchiveError(
          FINDING_CODES.ARCHIVE_BOMB_LIMIT,
          `Compression ratio for ${path} exceeds ${MAX_COMPRESSION_RATIO}:1.`,
        );
      }
    }

    totalUncompressedBytes += isDirectory ? 0 : uncompressedSize;
    if (totalUncompressedBytes > MAX_EXTRACTED_ARCHIVE_BYTES) {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_BOMB_LIMIT,
        `Extracted size would exceed ${MAX_EXTRACTED_ARCHIVE_BYTES} bytes.`,
      );
    }

    entries.push({
      path,
      isDirectory,
      compression,
      compressedSize,
      uncompressedSize,
      crc32: crc,
      localHeaderOffset,
      unixMode,
    });
    cursor = nameStart + nameLen + extraLen + commentLen;
  }

  return { entries, totalUncompressedBytes };
}

function readLocalPayload(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const offset = entry.localHeaderOffset;
  if (readU32(bytes, offset) !== ZIP_LOCAL_SIGNATURE) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_UNSUPPORTED,
      `Invalid local header for ${entry.path}.`,
    );
  }
  const nameLen = readU16(bytes, offset + 26);
  const extraLen = readU16(bytes, offset + 28);
  const dataStart = offset + 30 + nameLen + extraLen;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.byteLength) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_UNSUPPORTED,
      `Truncated payload for ${entry.path}.`,
    );
  }
  const compressed = bytes.subarray(dataStart, dataEnd);
  let uncompressed: Uint8Array;
  if (entry.compression === 0) {
    uncompressed = compressed;
  } else {
    uncompressed = inflateRawSync(compressed, { maxOutputLength: MAX_SINGLE_EXTRACTED_FILE_BYTES });
  }
  if (uncompressed.byteLength !== entry.uncompressedSize) {
    throw new ArchiveError(
      FINDING_CODES.ARCHIVE_BOMB_LIMIT,
      `Uncompressed size mismatch for ${entry.path}.`,
    );
  }
  if (uncompressed.byteLength > 0 && crc32(uncompressed) >>> 0 !== entry.crc32 >>> 0) {
    throw new ArchiveError(FINDING_CODES.ARCHIVE_UNSUPPORTED, `CRC mismatch for ${entry.path}.`);
  }
  return uncompressed;
}

/**
 * Reads one already-inspected entry. Used by the read-only file viewer so opening
 * a single file never inflates the whole package. Returns null when the archive
 * has no such file entry; the caller decides what "not found" means.
 */
export function readZipEntry(
  bytes: Uint8Array,
  inspection: ZipInspection,
  entryPath: string,
): Uint8Array | null {
  const entry = inspection.entries.find(
    (candidate) => !candidate.isDirectory && candidate.path === entryPath,
  );
  return entry ? readLocalPayload(bytes, entry) : null;
}

export function extractZipEntries(
  bytes: Uint8Array,
  inspection: ZipInspection,
): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let extracted = 0;
  for (const entry of inspection.entries) {
    if (entry.isDirectory) {
      continue;
    }
    const data = readLocalPayload(bytes, entry);
    extracted += data.byteLength;
    if (extracted > MAX_EXTRACTED_ARCHIVE_BYTES) {
      throw new ArchiveError(
        FINDING_CODES.ARCHIVE_BOMB_LIMIT,
        `Extracted size exceeds ${MAX_EXTRACTED_ARCHIVE_BYTES} bytes.`,
      );
    }
    files.set(entry.path, data);
  }
  return files;
}

export type StoredZipEntry = {
  path: string;
  data?: Uint8Array;
};

/** Deterministic STORE-method ZIP writer for fixtures and tests. Not used to execute content. */
export function createStoredZip(entries: readonly StoredZipEntry[]): Uint8Array {
  const localParts: number[] = [];
  const centralParts: number[] = [];
  let offset = 0;

  for (const entry of entries) {
    const path = assertSafeArchivePath(entry.path);
    const isDirectory = path.endsWith("/");
    const data = isDirectory ? new Uint8Array() : (entry.data ?? new Uint8Array());
    const nameBytes = new TextEncoder().encode(path);
    const checksum = data.byteLength === 0 ? 0 : crc32(data) >>> 0;

    const local: number[] = [];
    writeU32(local, ZIP_LOCAL_SIGNATURE);
    writeU16(local, 20);
    writeU16(local, 0x800);
    writeU16(local, 0);
    writeU16(local, 0);
    writeU16(local, 0);
    writeU32(local, checksum);
    writeU32(local, data.byteLength);
    writeU32(local, data.byteLength);
    writeU16(local, nameBytes.byteLength);
    writeU16(local, 0);
    localParts.push(...local, ...nameBytes, ...data);

    const central: number[] = [];
    writeU32(central, ZIP_CENTRAL_SIGNATURE);
    writeU16(central, 20);
    writeU16(central, 20);
    writeU16(central, 0x800);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, checksum);
    writeU32(central, data.byteLength);
    writeU32(central, data.byteLength);
    writeU16(central, nameBytes.byteLength);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, isDirectory ? 0x10 : 0);
    writeU32(central, offset);
    centralParts.push(...central, ...nameBytes);

    offset += local.length + nameBytes.byteLength + data.byteLength;
  }

  const eocd: number[] = [];
  writeU32(eocd, ZIP_EOCD_SIGNATURE);
  writeU16(eocd, 0);
  writeU16(eocd, 0);
  writeU16(eocd, entries.length);
  writeU16(eocd, entries.length);
  writeU32(eocd, centralParts.length);
  writeU32(eocd, localParts.length);
  writeU16(eocd, 0);

  return Uint8Array.from([...localParts, ...centralParts, ...eocd]);
}

/** Hostile-fixture helper: writes a ZIP with an unchecked path (tests zip-slip rejection). */
export function createZipWithRawPath(rawPath: string, data: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(rawPath);
  const checksum = data.byteLength === 0 ? 0 : crc32(data) >>> 0;
  const local: number[] = [];
  writeU32(local, ZIP_LOCAL_SIGNATURE);
  writeU16(local, 20);
  writeU16(local, 0);
  writeU16(local, 0);
  writeU16(local, 0);
  writeU16(local, 0);
  writeU32(local, checksum);
  writeU32(local, data.byteLength);
  writeU32(local, data.byteLength);
  writeU16(local, nameBytes.byteLength);
  writeU16(local, 0);

  const central: number[] = [];
  writeU32(central, ZIP_CENTRAL_SIGNATURE);
  writeU16(central, 20);
  writeU16(central, 20);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU32(central, checksum);
  writeU32(central, data.byteLength);
  writeU32(central, data.byteLength);
  writeU16(central, nameBytes.byteLength);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU32(central, 0);
  writeU32(central, 0);

  const eocd: number[] = [];
  writeU32(eocd, ZIP_EOCD_SIGNATURE);
  writeU16(eocd, 0);
  writeU16(eocd, 0);
  writeU16(eocd, 1);
  writeU16(eocd, 1);
  writeU32(eocd, central.length + nameBytes.byteLength);
  writeU32(eocd, local.length + nameBytes.byteLength + data.byteLength);
  writeU16(eocd, 0);

  return Uint8Array.from([...local, ...nameBytes, ...data, ...central, ...nameBytes, ...eocd]);
}

/** Hostile-fixture helper: lie about uncompressed size (archive-bomb tests). */
export function createZipWithClaimedSizes(
  rawPath: string,
  data: Uint8Array,
  uncompressedSize: number,
): Uint8Array {
  const nameBytes = new TextEncoder().encode(rawPath);
  const checksum = data.byteLength === 0 ? 0 : crc32(data) >>> 0;
  const local: number[] = [];
  writeU32(local, ZIP_LOCAL_SIGNATURE);
  writeU16(local, 20);
  writeU16(local, 0);
  writeU16(local, 0);
  writeU16(local, 0);
  writeU16(local, 0);
  writeU32(local, checksum);
  writeU32(local, data.byteLength);
  writeU32(local, uncompressedSize);
  writeU16(local, nameBytes.byteLength);
  writeU16(local, 0);

  const central: number[] = [];
  writeU32(central, ZIP_CENTRAL_SIGNATURE);
  writeU16(central, 20);
  writeU16(central, 20);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU32(central, checksum);
  writeU32(central, data.byteLength);
  writeU32(central, uncompressedSize);
  writeU16(central, nameBytes.byteLength);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU16(central, 0);
  writeU32(central, 0);
  writeU32(central, 0);

  const eocd: number[] = [];
  writeU32(eocd, ZIP_EOCD_SIGNATURE);
  writeU16(eocd, 0);
  writeU16(eocd, 0);
  writeU16(eocd, 1);
  writeU16(eocd, 1);
  writeU32(eocd, central.length + nameBytes.byteLength);
  writeU32(eocd, local.length + nameBytes.byteLength + data.byteLength);
  writeU16(eocd, 0);

  return Uint8Array.from([...local, ...nameBytes, ...data, ...central, ...nameBytes, ...eocd]);
}
