/** Explicit build preparation; no user document is read or sent. */
import { mkdir, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { gzipSync, gunzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const folder = join(root, 'public/models/redact');
const revision = 'v0.4.2';
const files = [
  ['redact.tflite', '2b6237e3a08ee12966929af477fb3723018bacdb74a22f78992b8c0f6b5d545d'],
  ['redact_tokenizer.bin', '81bc354dc99285e05b8f70edca9df3afbd83dfa4b0cea18d0448ab17ce58aae2'],
  ['labels.json', '228835734235f85ec4bf31391a296aa6e8a36684e1171e841ac94f7b3f9b430a'],
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
await mkdir(folder, { recursive: true });
const manifestFiles = [];
for (const [name, expected] of files) {
  const target = join(folder, name);
  let bytes;
  try { bytes = await readFile(target); } catch { /* initial preparation */ }
  if (!bytes || hash(bytes) !== expected) {
    console.log(`Modelbestand ophalen: ${name}`);
    const response = await fetch(`https://huggingface.co/desert-ant-labs/redact/resolve/${revision}/${name}`);
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== expected) throw new Error(`${name}: SHA-256 klopt niet; bestand niet opgeslagen.`);
    await writeFile(target, bytes);
  }
  manifestFiles.push({ name, bytes: bytes.length, sha256: expected });
}
const litertRoot = resolve(dirname(require.resolve('@litertjs/core')), '..');
const litertPackage = JSON.parse(await readFile(join(litertRoot, 'package.json'), 'utf8'));
const runtimeDestination = join(root, 'public/vendor/litert');
await mkdir(runtimeDestination, { recursive: true });
await cp(join(litertRoot, 'wasm'), runtimeDestination, { recursive: true });
const runtimeFiles = [];
for (const name of await readdir(runtimeDestination)) {
  const bytes = await readFile(join(runtimeDestination, name));
  runtimeFiles.push({ name, bytes: bytes.length, sha256: hash(bytes) });
}
// Only transport encoding changes: decompressing restores the SDK's exact WASM
// bytes. No SDK code, inference, licence handling or telemetry is modified.
const redactRoot = dirname(require.resolve('@desert-ant-labs/redact'));
const coreBytes = await readFile(join(redactRoot, 'dist/RedactWeb.wasm'));
const compressedCore = gzipSync(coreBytes, { level: 9 });
if (!gunzipSync(compressedCore).equals(coreBytes)) throw new Error('WASM gzip roundtrip failed');
await writeFile(join(root, 'public/vendor/redact-core.wasm-gzip.bin'), compressedCore);
const coreTransport = {
  file: 'vendor/redact-core.wasm-gzip.bin', encoding: 'gzip', bytes: compressedCore.length,
  sha256: hash(compressedCore), decodedBytes: coreBytes.length, decodedSha256: hash(coreBytes),
};
if (compressedCore.length > 25 * 1024 * 1024) throw new Error('Compressed WASM exceeds 25 MiB static asset limit');
const notices = [
  ['LICENSE-Desert-Ant-Labs.txt', 'https://license.desertant.com/1.0.txt'],
  ['THIRD_PARTY_NOTICES.md', `https://huggingface.co/desert-ant-labs/redact/resolve/${revision}/THIRD_PARTY_NOTICES.md`],
];
for (const [name, url] of notices) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  await writeFile(join(folder, name), await response.text());
}
await writeFile(join(folder, 'manifest.json'), JSON.stringify({
  model: 'redact', revision, sdkVersion: '4.2.3', files: manifestFiles,
  runtime: { name: '@litertjs/core', version: litertPackage.version, files: runtimeFiles },
  coreTransport,
  attribution: 'On-device AI by Desert Ant Labs', attributionUrl: 'https://desertant.com',
  licenceUrl: 'https://license.desertant.com/1.0',
  networkNotice: 'Modelinference is lokaal. De SDK gebruikt internet voor licentietelling; volgens de licentie zonder invoer, uitvoer of documentinhoud.',
}, null, 2) + '\n');
console.log(`Redact ${revision} en LiteRT ${litertPackage.version} lokaal voorbereid.`);
