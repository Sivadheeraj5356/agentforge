import { createHash, createHmac } from "node:crypto";

export type R2SignerConfig = {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly accountId: string;
  readonly bucket: string;
  readonly region: string;
};

function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function amzDate(now: Date): { date: string; datetime: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { date: iso.slice(0, 8), datetime: `${iso.slice(0, 15)}Z` };
}

function credentialScope(date: string, region: string): string {
  return `${date}/${region}/s3/aws4_request`;
}

function signingKey(secret: string, date: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function encodeObjectKey(key: string): string {
  return key
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}

export function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function r2ObjectUrl(config: R2SignerConfig, objectKey: string): string {
  return `${r2Endpoint(config.accountId)}/${config.bucket}/${encodeObjectKey(objectKey)}`;
}

export function signR2Headers(input: {
  readonly config: R2SignerConfig;
  readonly method: "GET" | "PUT";
  readonly objectKey: string;
  readonly payload: Uint8Array | "";
  readonly now?: Date;
  readonly extraHeaders?: Readonly<Record<string, string>>;
}): { readonly url: string; readonly headers: Record<string, string> } {
  const now = input.now ?? new Date();
  const { date, datetime } = amzDate(now);
  const url = r2ObjectUrl(input.config, input.objectKey);
  const host = `${input.config.accountId}.r2.cloudflarestorage.com`;
  const payloadHash = input.payload === "" ? sha256Hex("") : sha256Hex(input.payload);
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": datetime,
  };
  if (input.extraHeaders) {
    for (const [name, value] of Object.entries(input.extraHeaders)) {
      headers[name.toLowerCase()] = value;
    }
  }
  const signedHeaderNames = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name]!.trim()}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalRequest = [
    input.method,
    `/${input.config.bucket}/${encodeObjectKey(input.objectKey)}`,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    credentialScope(date, input.config.region),
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = hmac(
    signingKey(input.config.secretAccessKey, date, input.config.region),
    stringToSign,
  ).toString("hex");
  return {
    url,
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${credentialScope(date, input.config.region)}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": datetime,
      ...(input.extraHeaders ?? {}),
    },
  };
}

export function presignR2Get(input: {
  readonly config: R2SignerConfig;
  readonly objectKey: string;
  readonly expiresInSeconds: number;
  readonly now?: Date;
}): string {
  const expires = Math.min(Math.max(Math.floor(input.expiresInSeconds), 1), 604800);
  const now = input.now ?? new Date();
  const { date, datetime } = amzDate(now);
  const host = `${input.config.accountId}.r2.cloudflarestorage.com`;
  const credential = `${input.config.accessKeyId}/${credentialScope(date, input.config.region)}`;
  const signedHeaders = "host";
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": datetime,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const canonicalQuery = [...query.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const canonicalRequest = [
    "GET",
    `/${input.config.bucket}/${encodeObjectKey(input.objectKey)}`,
    canonicalQuery,
    `host:${host}\n`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    datetime,
    credentialScope(date, input.config.region),
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = hmac(
    signingKey(input.config.secretAccessKey, date, input.config.region),
    stringToSign,
  ).toString("hex");
  query.set("X-Amz-Signature", signature);
  return `${r2ObjectUrl(input.config, input.objectKey)}?${query.toString()}`;
}
