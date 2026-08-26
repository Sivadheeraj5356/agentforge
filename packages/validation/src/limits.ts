/**
 * Named ingest limits. Hostile archives are rejected against these ceilings.
 * Tune here — do not scatter magic numbers through the pipeline.
 */
export const MAX_UPLOAD_ARCHIVE_BYTES = 32 * 1024 * 1024;
export const MAX_EXTRACTED_ARCHIVE_BYTES = 128 * 1024 * 1024;
export const MAX_ARCHIVE_FILE_COUNT = 2048;
export const MAX_SINGLE_EXTRACTED_FILE_BYTES = 16 * 1024 * 1024;
export const MAX_COMPRESSION_RATIO = 100;
export const MAX_ARCHIVE_PATH_LENGTH = 240;
export const MAX_WORKSPACE_PATH_LENGTH = 1024;
export const MAX_TEXT_FILE_BYTES = 256 * 1024;
/** Ceiling on persisted findings per run. Keeps a hostile package from flooding the report. */
export const MAX_FINDINGS_PER_RUN = 500;
export const MAX_ZIP_COMMENT_BYTES = 4096;
export const ZIP_LOCAL_SIGNATURE = 0x04034b50;
export const ZIP_CENTRAL_SIGNATURE = 0x02014b50;
export const ZIP_EOCD_SIGNATURE = 0x06054b50;
export const ZIP_EOCD64_LOCATOR_SIGNATURE = 0x07064b50;
export const UNIX_SYMLINK_MODE = 0o120000;
export const UNIX_IFMT = 0o170000;
