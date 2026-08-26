/**
 * Raised by the TOML/YAML subset parsers. Carries the 1-based line when the
 * parser knows it, so findings can cite a real location instead of guessing.
 */
export class MetadataParseError extends Error {
  readonly line: number | null;

  constructor(message: string, line: number | null = null) {
    super(message);
    this.name = "MetadataParseError";
    this.line = line;
  }
}
