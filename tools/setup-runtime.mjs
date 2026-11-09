/**
 * Automatically stages npm dependencies and (if absent) obtains Cubism Core
 * from Live2D's OWN officially hosted distribution endpoint. Core is a
 * proprietary runtime and must not be committed or bundled in our ZIP.
 * This is a best-effort install: if the download cannot complete, the browser
 * later attempts to load the same official URL directly.
 *
 * Usage: npm install  (postinstall hook)
 *        npm run setup:core  (retry when the Core file is absent)
 */
import { mkdir, stat, copyFile, unlink, readFile, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendor = path.join(root, 'assets', 'vendor');
const CORE_URL = 'https://cubism.live2d.com/sdk-web/core/06/live2dcubismcore.min.js';
const coreTarget = path.join(vendor, 'live2dcubismcore.min.js');
const coreStamp = path.join(vendor, 'core-version.txt');

async function validCore(file) {
  try {
    const s = await stat(file);
    if (s.size < 30000) return false;
    const b = (await readFile(file)).subarray(0, 4096).toString('utf8');
    if (/^\s*(?:<!DOCTYPE|<html|<body)/i.test(b)) return false;
    // Runtime initialization may be declared after the first comment.
    return true;
  } catch { return false; }
}

async function fetchCore() {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 20000);
  const tmp = coreTarget + '.partial';
  try {
    console.log('[Core] Live2D 공식 배포 주소에서 자동 설치를 시도합니다.');
    const response = await fetch(CORE_URL, { signal: abort.signal, redirect: 'follow' });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (/text\/html/i.test(contentType)) throw new Error('Core 대신 HTML 응답을 받았습니다.');
    await pipeline(Readable.fromWeb(response.body), createWriteStream(tmp));
    if (!await validCore(tmp)) throw new Error('받은 파일이 Cubism Core로 보이지 않습니다.');
    // A corrupt or outdated cached Core must never override the newer one.
    await copyFile(tmp, coreTarget);
    await unlink(tmp);
    await writeFile(coreStamp, '06\n', 'utf8');
    console.log('[Core] 자동 설치 완료: Cubism Core 6.0 (SDK 5.3 R5)');
    return true;
  } catch (error) {
    try { await unlink(tmp); } catch { /* no temp file */ }
    console.warn('[Core] 자동 설치 실패:', error.message);
    console.warn('[Core] 게임에서는 Live2D 공식 호스팅 주소로 자동 대체하여 시도합니다.');
    return false;
  } finally { clearTimeout(timeout); }
}

await mkdir(vendor, { recursive: true });
let markedVersion = '';
try { markedVersion = (await readFile(coreStamp, 'utf8')).trim(); } catch {}
if (markedVersion==='06' && await validCore(coreTarget)) {
  console.log('[Core] 검증된 Core 6 설치본을 재사용합니다.');
} else {
  // Invalidate any older Core 5.x file from previous project versions.
  try { await unlink(coreTarget); } catch {}
  try { await unlink(coreStamp); } catch {}
  await fetchCore();
}
