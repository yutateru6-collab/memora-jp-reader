import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
const fixturePath = new URL('./fixtures/jp-reader-valid.json', import.meta.url);
const fixture = await fs.readFile(fixturePath, 'utf8');

const targets = [
  { name: 'pc-chrome', engine: chromium, context: { viewport: { width: 1440, height: 900 } } },
  { name: 'android-chrome', engine: chromium, context: { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } },
  { name: 'iphone-webkit', engine: webkit, context: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true } },
  { name: 'ipad-landscape-webkit', engine: webkit, context: { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true } },
];

const getJpMaterialCount = page => page.evaluate(async () => {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('MemoraJapaneseReaderDB');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('materials', 'readonly');
    const request = transaction.objectStore('materials').count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
});

const assertNoOverflow = async (page, label) => {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (dimensions.scrollWidth > dimensions.clientWidth + 1) {
    throw new Error(`${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
  }
};

const openJapaneseImport = async page => {
  await page.getByTestId('open-japanese-reader').click();
  await page.getByTestId('jp-library').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByTestId('jp-open-import').click();
  const dialog = page.getByTestId('jp-import-modal');
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  return dialog;
};

for (const target of targets) {
  const browser = await target.engine.launch({ headless: true });
  const context = await browser.newContext(target.context);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('create-home').waitFor({ state: 'visible', timeout: 20_000 });
    if (!(await page.getByTestId('create-topic').isVisible())) throw new Error(`${target.name}: Japanese create flow is missing.`);

    const dialog = await openJapaneseImport(page);
    const modalLayout = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="jp-import-modal"]')?.getBoundingClientRect();
      const footer = document.querySelector('[data-testid="jp-import-footer"]')?.getBoundingClientRect();
      const body = document.querySelector('[data-testid="jp-import-body"]');
      const backdrop = document.querySelector('.jp-modal-backdrop');
      return {
        viewportHeight: window.innerHeight,
        modalTop: modal?.top ?? -1,
        modalBottom: modal?.bottom ?? -1,
        footerBottom: footer?.bottom ?? -1,
        bodyOverflowY: body ? getComputedStyle(body).overflowY : '',
        backdropZ: backdrop ? Number(getComputedStyle(backdrop).zIndex) : 0,
        documentOverflow: getComputedStyle(document.body).overflow,
      };
    });
    if (modalLayout.modalTop < -1 || modalLayout.modalBottom > modalLayout.viewportHeight + 1) {
      throw new Error(`${target.name}: import modal is outside the viewport: ${JSON.stringify(modalLayout)}`);
    }
    if (modalLayout.footerBottom > modalLayout.viewportHeight + 1 || modalLayout.bodyOverflowY !== 'auto') {
      throw new Error(`${target.name}: import footer/body cannot be reached: ${JSON.stringify(modalLayout)}`);
    }
    if (modalLayout.documentOverflow !== 'hidden' || modalLayout.backdropZ < 100) {
      throw new Error(`${target.name}: modal background/z-index protection failed: ${JSON.stringify(modalLayout)}`);
    }

    if (target.name === 'pc-chrome') {
      await page.getByTestId('jp-json-input').fill('{\n  "schemaVersion": "memora-jp-reader-v1",\n  broken\n}');
      await page.getByTestId('jp-import-submit').click();
      await dialog.getByRole('alert').waitFor({ state: 'visible', timeout: 5_000 });
      if (!/行.*列付近/.test(await dialog.getByRole('alert').innerText())) {
        throw new Error('pc-chrome: malformed JSON did not report a line and column.');
      }
      if (await getJpMaterialCount(page) !== 0) throw new Error('pc-chrome: invalid JSON was persisted.');
    }

    await page.getByTestId('jp-json-input').fill(fixture);
    await page.getByTestId('jp-import-submit').evaluate(element => { element.click(); element.click(); });
    await dialog.getByText('教材JSONを確認できました').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByTestId('jp-import-submit').evaluate(element => { element.click(); element.click(); });
    await page.getByTestId('jp-reader-screen').waitFor({ state: 'visible', timeout: 15_000 });
    if (await getJpMaterialCount(page) !== 1) throw new Error(`${target.name}: double submission created multiple records.`);
    if (await page.locator('.jp-sentence').count() !== 2) throw new Error(`${target.name}: two sentences were not rendered.`);

    await page.getByTestId('jp-furigana-mode').selectOption('all');
    if (await page.locator('.jp-reader-document ruby').count() === 0) throw new Error(`${target.name}: ruby was not rendered.`);
    await page.getByTestId('jp-furigana-mode').selectOption('none');
    if (await page.locator('.jp-reader-document ruby').count() !== 0) throw new Error(`${target.name}: ruby remained in no-furigana mode.`);

    await page.getByTestId('jp-text-variant').selectOption('adapted');
    if (await page.getByText('AIによる易しい日本語版', { exact: true }).count() !== 1) {
      throw new Error(`${target.name}: original/adapted distinction is unclear.`);
    }
    if (!/四月一日に東京へ行く。😊/.test(await page.locator('[data-sentence-id="s2"]').first().innerText())) {
      throw new Error(`${target.name}: sentence without an adapted version did not fall back to the original.`);
    }

    await page.getByTestId('jp-text-variant').selectOption('original');
    await page.getByTestId('jp-mode-study').click();
    await page.locator('[data-segment-id="s1-o-5"]').click();
    const wordSheet = page.getByRole('dialog', { name: '勉強し' });
    await wordSheet.waitFor({ state: 'visible', timeout: 5_000 });
    if (!/勉強する/.test(await wordSheet.innerText()) || !/連用形/.test(await wordSheet.innerText())) {
      throw new Error(`${target.name}: lemma/conjugation details are missing.`);
    }
    await wordSheet.getByRole('button', { name: '単語カードに登録' }).click();
    await wordSheet.getByRole('button', { name: '語彙情報を閉じる' }).click();

    await page.locator('[data-sentence-id="s1"]').first().getByRole('button', { name: '文の翻訳・文法・ニュアンスを見る' }).click();
    const sentenceSheet = page.getByRole('dialog', { name: '文の解説' });
    await sentenceSheet.waitFor({ state: 'visible', timeout: 5_000 });
    if (!/翻訳/.test(await sentenceSheet.innerText()) || !/ニュアンス/.test(await sentenceSheet.innerText())) {
      throw new Error(`${target.name}: sentence details are missing.`);
    }
    await sentenceSheet.getByRole('button', { name: '文の解説を閉じる' }).click();

    await page.getByTestId('jp-mode-reread').click();
    if (!(await page.locator('[data-segment-id="s1-o-5"]').getAttribute('class'))?.includes('is-registered')) {
      throw new Error(`${target.name}: registered vocabulary is not highlighted on reread.`);
    }
    await context.setOffline(true);
    await page.getByTestId('jp-mode-read').click();
    await page.getByTestId('jp-mode-reread').click();
    await context.setOffline(false);

    await assertNoOverflow(page, target.name);
    if (consoleErrors.length) throw new Error(`${target.name}: console errors: ${consoleErrors.join(' | ')}`);
    if (pageErrors.length) throw new Error(`${target.name}: page errors: ${pageErrors.join(' | ')}`);
    console.log(`${target.name}: Japanese Reader responsive QA passed`);
  } finally {
    await context.close();
    await browser.close();
  }
}

const fileBrowser = await chromium.launch({ headless: true });
const fileContext = await fileBrowser.newContext({ viewport: { width: 1280, height: 800 } });
const filePage = await fileContext.newPage();
try {
  await filePage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const dialog = await openJapaneseImport(filePage);
  await dialog.getByRole('tab', { name: 'JSONファイル' }).click();
  await filePage.getByTestId('jp-json-file').setInputFiles(fixturePath.pathname);
  await filePage.getByTestId('jp-import-submit').click();
  await dialog.getByText('教材JSONを確認できました').waitFor({ state: 'visible', timeout: 10_000 });
  await filePage.getByTestId('jp-import-submit').click();
  await filePage.getByTestId('jp-reader-screen').waitFor({ state: 'visible', timeout: 15_000 });
  if (await getJpMaterialCount(filePage) !== 1) throw new Error('JSON file import did not persist exactly one material.');
  console.log('json-file-import: Japanese Reader file QA passed');
} finally {
  await fileContext.close();
  await fileBrowser.close();
}
