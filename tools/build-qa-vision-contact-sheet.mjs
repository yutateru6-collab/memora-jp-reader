import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const screenshotsDir = process.env.SCREENSHOT_DIR || 'qa-artifacts/screenshots';
const visionDir = process.env.VISION_DIR || 'qa-artifacts/vision';
const BASE64_WRAP = 76;
const BASE64_CHECKSUM_LINES = 20;

const sources = [
  { label: 'Desktop · Library', file: 'desktop-1440x900-library-ai-preview.jpg' },
  { label: 'Desktop · Reader', file: 'desktop-1440x900-reader-ai-preview.jpg' },
  { label: 'iPhone 16 · Library', file: 'iphone-16-library-ai-preview.jpg' },
  { label: 'iPhone 16 · Reader', file: 'iphone-16-reader-ai-preview.jpg' },
];

await fs.mkdir(visionDir, { recursive: true });

const available = [];
for (const source of sources) {
  const path = `${screenshotsDir}/${source.file}`;
  try {
    const bytes = await fs.readFile(path);
    available.push({
      ...source,
      path,
      dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`,
    });
  } catch {
    // Partial QA failures may not produce every preview. Keep whatever exists.
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  status: available.length > 0 ? 'available' : 'unavailable',
  sourceCount: available.length,
  sources: available.map(({ label, file }) => ({ label, file })),
  overview: null,
  detailBase64: [],
};

const writeWrappedBase64 = async (inputPath, outputPath) => {
  const bytes = await fs.readFile(inputPath);
  const encoded = bytes.toString('base64');
  const lines = encoded.match(new RegExp(`.{1,${BASE64_WRAP}}`, 'g')) || [];
  await fs.writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8');

  const base64Chunks = [];
  for (let index = 0; index < lines.length; index += BASE64_CHECKSUM_LINES) {
    const chunkLines = lines.slice(index, index + BASE64_CHECKSUM_LINES);
    const compact = chunkLines.join('');
    base64Chunks.push({
      startLine: index + 1,
      endLine: index + chunkLines.length,
      charLength: compact.length,
      sha256: crypto.createHash('sha256').update(compact, 'utf8').digest('hex'),
    });
  }

  return {
    file: outputPath.replace(/^qa-artifacts\//, ''),
    byteLength: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    base64LineLength: BASE64_WRAP,
    base64LineCount: lines.length,
    base64ChecksumLines: BASE64_CHECKSUM_LINES,
    base64Chunks,
  };
};

if (available.length > 0) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 540 }, deviceScaleFactor: 1 });
    const panels = available.map(({ label, dataUrl }) => `
      <section class="panel">
        <div class="label">${label}</div>
        <div class="frame"><img src="${dataUrl}" alt="${label}"></div>
      </section>
    `).join('');

    await page.setContent(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; }
            html, body { width: 100%; height: 100%; margin: 0; }
            body { background: #111827; color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 12px; }
            main { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px; height: 100%; }
            .panel { min-width: 0; min-height: 0; border: 1px solid #374151; border-radius: 10px; overflow: hidden; background: #0b1220; display: flex; flex-direction: column; }
            .label { height: 28px; flex: 0 0 28px; display: flex; align-items: center; padding: 0 10px; font-size: 13px; font-weight: 700; background: #1f2937; border-bottom: 1px solid #374151; }
            .frame { min-height: 0; flex: 1; display: flex; align-items: center; justify-content: center; padding: 6px; overflow: hidden; }
            img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; }
          </style>
        </head>
        <body><main>${panels}</main></body>
      </html>`, { waitUntil: 'load' });

    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));

    const overviewPath = `${visionDir}/qa-overview.jpg`;
    await page.screenshot({
      path: overviewPath,
      type: 'jpeg',
      quality: 42,
      fullPage: false,
      scale: 'css',
    });

    const overviewBase64 = await writeWrappedBase64(overviewPath, `${visionDir}/qa-overview.jpg.b64`);
    manifest.overview = {
      image: 'vision/qa-overview.jpg',
      base64: overviewBase64.file,
      byteLength: overviewBase64.byteLength,
      sha256: overviewBase64.sha256,
      viewport: { width: 720, height: 540 },
      base64LineLength: overviewBase64.base64LineLength,
      base64LineCount: overviewBase64.base64LineCount,
      base64ChecksumLines: overviewBase64.base64ChecksumLines,
      base64Chunks: overviewBase64.base64Chunks,
    };
  } finally {
    await browser.close();
  }
}

for (const file of [
  'desktop-1440x900-reader-first-sentence.jpg',
  'iphone-16-reader-first-sentence.jpg',
]) {
  const inputPath = `${screenshotsDir}/${file}`;
  try {
    const detail = await writeWrappedBase64(inputPath, `${visionDir}/${file}.b64`);
    manifest.detailBase64.push({ source: file, ...detail });
  } catch {
    // Detail crop may be absent if Reader was never reached.
  }
}

await fs.writeFile(`${visionDir}/manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Prepared QA vision handoff: ${available.length} preview(s), ${manifest.detailBase64.length} detail crop(s)`);
