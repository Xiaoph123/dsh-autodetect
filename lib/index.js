// src/host/file-service.ts
import { resolve, sep } from "node:path";

// src/codec/text.ts
import iconv2 from "iconv-lite";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

// src/codec/detect.ts
import iconv from "iconv-lite";
var BOMS = [
  [Buffer.from([255, 254, 0, 0]), "utf-32-le"],
  [Buffer.from([0, 0, 254, 255]), "utf-32-be"],
  [Buffer.from([255, 254]), "utf-16-le"],
  [Buffer.from([254, 255]), "utf-16-be"],
  [Buffer.from([239, 187, 191]), "utf-8"]
];
function iconvName(encoding) {
  return encoding.replaceAll("-", "") === "utf8" ? "utf8" : encoding.replaceAll("-", "");
}
function isReversible(data, encoding) {
  try {
    const text = iconv.decode(data, iconvName(encoding));
    return iconv.encode(text, iconvName(encoding)).equals(data);
  } catch {
    return false;
  }
}
function looksLikeBomlessUtf16(data, encoding) {
  if (data.length < 16 || data.length % 2 !== 0) return false;
  let evenNuls = 0;
  let oddNuls = 0;
  for (let index = 0; index < data.length; index += 1) {
    if (data[index] === 0) {
      if (index % 2 === 0) evenNuls += 1;
      else oddNuls += 1;
    }
  }
  const half = data.length / 2;
  const skewed = encoding === "utf-16-le" ? oddNuls * 10 >= half * 3 && evenNuls * 20 <= half : evenNuls * 10 >= half * 3 && oddNuls * 20 <= half;
  if (!skewed) return false;
  try {
    const text = iconv.decode(data, iconvName(encoding));
    return !text.includes("\uFFFD");
  } catch {
    return false;
  }
}
function detectEncoding(data) {
  for (const [marker, encoding] of BOMS) {
    if (data.subarray(0, marker.length).equals(marker)) return { encoding, bom: true, body: data.subarray(marker.length) };
  }
  if (data.length === 0) return { encoding: "utf-8", bom: false, body: data };
  if (isReversible(data, "utf-8")) return { encoding: "utf-8", bom: false, body: data };
  for (const encoding of ["utf-16-le", "utf-16-be"]) {
    if (looksLikeBomlessUtf16(data, encoding)) return { encoding, bom: false, body: data };
  }
  if (isReversible(data, "gbk")) return { encoding: "gbk", bom: false, body: data };
  if (isReversible(data, "gb18030")) return { encoding: "gb18030", bom: false, body: data };
  for (const encoding of ["cp1252", "shift-jis"]) {
    if (isReversible(data, encoding)) return { encoding, bom: false, body: data };
  }
  return { encoding: "utf-8", bom: false, body: data };
}
function isBinary(data, encoding) {
  if (!data.length) return false;
  if (encoding.startsWith("utf-16") || encoding.startsWith("utf-32")) return false;
  if (data.includes(0)) return true;
  let controls = 0;
  for (const byte of data) if (byte < 8 || byte >= 14 && byte < 32) controls += 1;
  return controls / data.length > 0.02;
}

// src/codec/text.ts
function newlineOf(text) {
  const match = text.match(/\r\n|\r|\n/);
  return match?.[0] === "\r\n" ? "crlf" : match?.[0] === "\r" ? "cr" : "lf";
}
function toEditorText(text) {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}
async function readFileMetadata(filePath) {
  const data = await readFile(filePath);
  const detected = detectEncoding(data);
  const binary = isBinary(data, detected.encoding);
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (binary) return { content: "", encoding: detected.encoding, bom: detected.bom, newline: "lf", size: data.length, sha256, binary: true, extension: extname(filePath).toLowerCase() };
  const text = iconv2.decode(detected.body, detected.encoding.replaceAll("-", ""));
  return { content: toEditorText(text), encoding: detected.encoding, bom: detected.bom, newline: newlineOf(text), size: data.length, sha256, binary: false, extension: extname(filePath).toLowerCase() };
}

// src/codec/encode.ts
import iconv3 from "iconv-lite";
import { createHash as createHash2 } from "node:crypto";
import { copyFile, mkdir, readFile as readFile2, rename, rm, open } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
var BOM = /* @__PURE__ */ new Map([
  ["utf-8", Buffer.from([239, 187, 191])],
  ["utf-16-le", Buffer.from([255, 254])],
  ["utf-16-be", Buffer.from([254, 255])],
  ["utf-32-le", Buffer.from([255, 254, 0, 0])],
  ["utf-32-be", Buffer.from([0, 0, 254, 255])]
]);
function encodeText(content, encoding, bom, newline) {
  const separator = newline === "crlf" ? "\r\n" : newline === "cr" ? "\r" : "\n";
  const normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replaceAll("\n", separator);
  const raw = iconv3.encode(normalized, encoding.replaceAll("-", ""));
  return bom && BOM.has(encoding) ? Buffer.concat([BOM.get(encoding), raw]) : raw;
}
async function atomicWrite(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  const temporary = join(dirname(filePath), `.${basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  const handle = await open(temporary, "w");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, filePath);
  } finally {
    await rm(temporary, { force: true });
  }
}
async function writeFile(filePath, options) {
  const current = await readFile2(filePath);
  const currentSha256 = createHash2("sha256").update(current).digest("hex");
  if (options.expectedSha256 && options.expectedSha256 !== currentSha256) throw new Error("file changed on disk; reload before saving");
  await copyFile(filePath, `${filePath}.autodetect.bak`);
  const data = encodeText(options.content, options.encoding, options.bom, options.newline);
  await atomicWrite(filePath, data);
  return { ok: true, size: data.length, sha256: createHash2("sha256").update(data).digest("hex") };
}

// src/shared/types.ts
var SUPPORTED_TEXT_EXTENSIONS = /* @__PURE__ */ new Set([".bat", ".cmd", ".ini", ".vbs", ".ps1"]);

// src/host/file-service.ts
function safePath(cwd, requested) {
  const baseCwd = resolve(cwd);
  const candidate = resolve(baseCwd, requested);
  const base = baseCwd.endsWith(sep) ? baseCwd : `${baseCwd}${sep}`;
  if (candidate !== baseCwd && !candidate.startsWith(base) && !candidate.toLowerCase().startsWith(base.toLowerCase())) throw new Error("path is outside the session workspace");
  return candidate;
}
function assertSupported(filePath) {
  const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) throw new Error(`unsupported file extension: ${extension || "<none>"}`);
}
async function readFile3(filePath) {
  assertSupported(filePath);
  return readFileMetadata(filePath);
}
async function writeFile2(filePath, options) {
  assertSupported(filePath);
  return writeFile(filePath, options);
}

// src/host/index.ts
var MAX_BODY = 12 * 1024 * 1024;
var name = "dsh-autodetect";
var inject = ["webServer", "sessions"];
function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}
async function requestBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error("request body is too large");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function sessionCwd(ctx, sessionId, suppliedCwd) {
  const cwd = ctx.sessions?.get?.(sessionId)?.header?.cwd || suppliedCwd;
  if (!cwd) throw new Error("session cwd is unavailable");
  return cwd;
}
async function handleRead(ctx, res, url) {
  const cwd = sessionCwd(ctx, url.searchParams.get("sessionId"), url.searchParams.get("cwd"));
  const filePath = safePath(cwd, url.searchParams.get("path") || "");
  json(res, 200, await readFile3(filePath));
}
async function handleWrite(ctx, req, res) {
  const payload = JSON.parse(await requestBody(req));
  const cwd = sessionCwd(ctx, payload.sessionId, payload.cwd);
  const filePath = safePath(cwd, payload.path || "");
  const result = await writeFile2(filePath, {
    content: payload.content || "",
    encoding: payload.encoding,
    bom: Boolean(payload.bom),
    newline: payload.newline,
    expectedSha256: payload.expectedSha256
  });
  json(res, 200, { ...result, backup: `${filePath}.autodetect.bak` });
}
function apply(ctx) {
  if (!ctx.webServer?.register) return;
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/autodetect/api",
    handler: async (req, res) => {
      try {
        const url = new URL(req.url || "/", "http://dsh.internal");
        if (req.method === "GET" && url.pathname === "/autodetect/api/read") return await handleRead(ctx, res, url);
        if (req.method === "POST" && url.pathname === "/autodetect/api/write") return await handleWrite(ctx, req, res);
        json(res, 405, { error: "method not allowed" });
      } catch (error) {
        const status = error?.message === "file changed on disk; reload before saving" ? 409 : 400;
        json(res, status, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  }), "dsh-autodetect: routes");
}
export {
  apply,
  inject,
  name
};
