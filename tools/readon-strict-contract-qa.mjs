import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
const screenshotDir = 'qa-artifacts/screenshots';
const fixtureUrl = new URL('./fixtures/chiikawa-user-material.txt', import.meta.url);
const exactMaterial = await fs.readFile(fixtureUrl, 'utf8');
const firstSentenceFragment = "While Nagano's Chiikawa is widely celebrated";
const lastSentenceFragment = 'Rather than offering sentimental comfort';

await fs.mkdir(screenshotDir, { recursive: true });

const splitExactMaterial = exactMaterial.split(/\n----------\n/);
if (splitExactMaterial.length !== 3) {
  throw new Error(`Chiikawa fixture must have two separators; got ${splitExactMaterial.length - 1}.`);
}
const tolerantCards = JSON.parse(splitExactMaterial[1]);
tolerantCards.pop();
const tolerantMaterial = `\`\`\`markdown
${splitExactMaterial[0]}
——————————
${JSON.stringify(tolerantCards, null, 2).replace(/\n\]$/, ',\n]')}
----------
${splitExactMaterial[2]}
\`\`\``;

const invalidMaterial = `【解説担当】
名前：みお
役割：ギャル
性格：世話好き

日本語だけで英文がありません。
----------
[]
----------
背景知識だけです。`;

const targets = [
  { name: 'chromium-desktop', context: { viewport: { width: 1440, height: 900 } } },
  {
    name: 'chromium-iphone-16',
    context: {
      viewport: { width: 393, height: 852 },
      screen: { width: 393, height: 852 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    },
  },
];

const pasteMaterial = async (page, textarea, content) => {
  await textarea.focus();
  await textarea.evaluate((element, pastedText) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', pastedText);
    element.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData,
    }));
  }, content);
  await page.getByTestId('material-paste-preview').waitFor({ state: 'visible', timeout: 10_000 });
};

const openImporter = async page => {
  await page.getByTestId('create-import').click();
  const dialog = page.getByRole('dialog', { name: '新しい教材を追加' });
  await dialog.waitFor({ state: 'visible', timeout: 15_000 });
  return dialog;
};

const readStoredMaterials = async page => page.evaluate(async () => {
  const readStoredText = async value => {
    if (!value) return null;
    if (typeof value.text === 'function') return value.text();
    if (typeof value.text === 'string') return value.text;
    throw new TypeError('Stored text payload is neither a File nor a serialized text file.');
  };
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('AudioSyncReaderDB', 2);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const materials = await new Promise((resolve, reject) => {
    const transaction = database.transaction('materials', 'readonly');
    const request = transaction.objectStore('materials').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return Promise.all(materials.map(async material => ({
    name: material.name,
    transcript: material.textFile ? JSON.parse(await readStoredText(material.textFile)) : null,
    cards: material.wordFile ? JSON.parse(await readStoredText(material.wordFile)) : null,
  })));
});

const assertStoredMaterial = (stored, expectedCards, label) => {
  if (!stored || stored.name === '無題' || stored.name === '教材') {
    throw new Error(`${label}: a useful name was not derived: ${JSON.stringify(stored?.name)}`);
  }
  if (!Array.isArray(stored.transcript) || stored.transcript.length !== 12) {
    throw new Error(`${label}: expected 12 persisted sentences: ${JSON.stringify(stored.transcript?.length)}`);
  }
  if (!stored.transcript[0]?.english?.includes(firstSentenceFragment)
      || !stored.transcript.at(-1)?.english?.includes(lastSentenceFragment)) {
    throw new Error(`${label}: first/last sentence was not persisted.`);
  }
  if (!stored.transcript[0]?.explanation?.includes('__BACKGROUND_INFO__')) {
    throw new Error(`${label}: background metadata was not persisted.`);
  }
  if (!Array.isArray(stored.cards) || stored.cards.length !== expectedCards) {
    throw new Error(`${label}: expected ${expectedCards} persisted cards: ${JSON.stringify(stored.cards?.length)}`);
  }
};

const assertReaderSentences = async (page, label) => {
  await page.waitForFunction(() => document.querySelectorAll('.memora-reader-sentence').length === 12, null, { timeout: 20_000 });
  const texts = await page.locator('.memora-reader-sentence').allTextContents();
  const compact = value => value.replace(/\s+/g, '');
  if (!compact(texts[0] || '').includes(compact(firstSentenceFragment))
      || !compact(texts.at(-1) || '').includes(compact(lastSentenceFragment))) {
    throw new Error(`${label}: reader did not render the persisted first and last sentences.`);
  }
};

for (const target of targets) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(target.context);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('heading', { name: 'リードン READON', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
    const dialog = await openImporter(page);
    const textarea = page.getByPlaceholder('AI Studioで作った教材データをここに貼り付けてください');

    const fieldOrder = await dialog.evaluate(node => {
      const data = node.querySelector('#add-material-data')?.getBoundingClientRect();
      const name = node.querySelector('#add-material-name')?.getBoundingClientRect();
      return { dataTop: data?.top ?? null, nameTop: name?.top ?? null };
    });
    if (fieldOrder.dataTop === null || fieldOrder.nameTop === null || fieldOrder.dataTop >= fieldOrder.nameTop) {
      throw new Error(`${target.name}: paste field is not before the optional title: ${JSON.stringify(fieldOrder)}`);
    }

    if (target.name.includes('iphone')) {
      await textarea.focus();
      await page.setViewportSize({ width: 393, height: 520 });
      await page.waitForFunction(() => document.querySelector('.memora-modal')?.classList.contains('memora-modal--keyboard-open'), null, { timeout: 5_000 });
      const keyboardLayout = await page.evaluate(() => {
        const dialogNode = document.querySelector('.memora-modal');
        const body = document.querySelector('.memora-modal__body');
        const footer = document.querySelector('.memora-modal__footer');
        const data = document.querySelector('#add-material-data');
        const bodyRect = body?.getBoundingClientRect();
        const dataRect = data?.getBoundingClientRect();
        return {
          dialogHeight: dialogNode?.getBoundingClientRect().height || 0,
          viewportHeight: window.visualViewport?.height || window.innerHeight,
          footerDisplay: footer ? getComputedStyle(footer).display : '',
          bodyHeight: bodyRect?.height || 0,
          dataInsideBody: Boolean(bodyRect && dataRect && dataRect.top >= bodyRect.top && dataRect.top < bodyRect.bottom),
        };
      });
      if (keyboardLayout.footerDisplay !== 'none' || !keyboardLayout.dataInsideBody || keyboardLayout.bodyHeight < 250) {
        throw new Error(`${target.name}: keyboard layout still covers the paste surface: ${JSON.stringify(keyboardLayout)}`);
      }
      if (keyboardLayout.dialogHeight > keyboardLayout.viewportHeight + 0.5) {
        throw new Error(`${target.name}: dialog exceeds keyboard-sized viewport: ${JSON.stringify(keyboardLayout)}`);
      }
      await page.screenshot({ path: `${screenshotDir}/iphone-16-import-keyboard-field-clear.png`, scale: 'device' });
      await textarea.evaluate(element => element.blur());
      await page.setViewportSize({ width: 393, height: 852 });
    }

    await pasteMaterial(page, textarea, exactMaterial);
    const exactPreview = page.getByTestId('material-paste-preview');
    await exactPreview.getByText('12文・30枚', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    const submit = page.getByRole('button', { name: '教材として取り込む' });
    if (await submit.isDisabled()) throw new Error(`${target.name}: exact user material was incorrectly disabled.`);
    await page.screenshot({ path: `${screenshotDir}/${target.name}-chiikawa-import-ready.png`, scale: 'css' });

    await submit.click();
    await dialog.waitFor({ state: 'hidden', timeout: 20_000 });
    await assertReaderSentences(page, `${target.name}/exact-render`);
    await page.screenshot({ path: `${screenshotDir}/${target.name}-chiikawa-reader.png`, scale: 'css' });

    let stored = await readStoredMaterials(page);
    if (stored.length !== 1) throw new Error(`${target.name}: exact import created ${stored.length} records instead of one.`);
    assertStoredMaterial(stored[0], 30, `${target.name}/exact`);

    // Reload and open the saved record again. This proves persistence, not merely a transient render.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: '教材一覧' }).click();
    await page.getByRole('heading', { name: '教材ライブラリ', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByRole('button', { name: '読む' }).first().click();
    await assertReaderSentences(page, `${target.name}/reload-render`);

    // A structurally invalid paste must not enable submit or create an orphan/blank record.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openImporter(page);
    const invalidInput = page.getByPlaceholder('AI Studioで作った教材データをここに貼り付けてください');
    await pasteMaterial(page, invalidInput, invalidMaterial);
    await page.getByText('英文を1文も認識できませんでした。', { exact: false }).waitFor({ state: 'visible', timeout: 10_000 });
    if (!(await page.getByRole('button', { name: '教材として取り込む' }).isDisabled())) {
      throw new Error(`${target.name}: invalid material left the submit button enabled.`);
    }
    stored = await readStoredMaterials(page);
    if (stored.length !== 1) throw new Error(`${target.name}: invalid material created an orphan record.`);

    // Harmless differences are repaired: code fences, a Unicode separator, a trailing comma,
    // and 29 instead of 30 cards must still produce a usable material.
    await page.getByRole('button', { name: '貼り直す' }).click();
    const tolerantInput = page.getByPlaceholder('AI Studioで作った教材データをここに貼り付けてください');
    await pasteMaterial(page, tolerantInput, tolerantMaterial);
    const tolerantPreview = page.getByTestId('material-paste-preview');
    await tolerantPreview.getByText('12文・29枚', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    await tolerantPreview.getByText('自動で補正して取り込みます', { exact: false }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: '教材として取り込む' }).click();
    await page.getByRole('dialog', { name: '新しい教材を追加' }).waitFor({ state: 'hidden', timeout: 20_000 });
    await assertReaderSentences(page, `${target.name}/tolerant-render`);
    stored = await readStoredMaterials(page);
    if (stored.length !== 2) throw new Error(`${target.name}: tolerant import did not create exactly one additional record.`);
    assertStoredMaterial(stored.at(-1), 29, `${target.name}/tolerant`);

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    if (dimensions.scrollWidth > dimensions.clientWidth) {
      throw new Error(`${target.name}: horizontal overflow: ${JSON.stringify(dimensions)}`);
    }
    if (consoleErrors.length) throw new Error(`${target.name}: console errors: ${consoleErrors.join(' | ')}`);
    if (pageErrors.length) throw new Error(`${target.name}: page errors: ${pageErrors.join(' | ')}`);

    console.log(`${target.name}: exact, atomic, reload, and tolerant READON import QA passed`);
  } finally {
    await context.close();
    await browser.close();
  }
}
