import { chromium, webkit } from 'playwright';
import fs from 'node:fs/promises';

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
const outDir = 'qa-artifacts/jp-create';
await fs.mkdir(outDir, { recursive: true });

const targets = [
  { name: 'desktop-chromium', engine: chromium, context: { viewport: { width: 1440, height: 900 } } },
  { name: 'iphone-webkit', engine: webkit, context: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } },
];

const assertNoOverflow = async (page, label) => {
  const state = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (state.scrollWidth > state.clientWidth + 1) throw new Error(`${label}: horizontal overflow ${JSON.stringify(state)}`);
};

for (const target of targets) {
  const browser = await target.engine.launch({ headless: true });
  const context = await browser.newContext(target.context);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async value => { window.__jpCopiedPrompt = value; },
      },
    });
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('heading', { name: 'リードン 日本語 READON JP', exact: true }).waitFor({ state: 'visible', timeout: 20_000 });

    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, '');
    for (const required of [
      '好きからつくる、日本語長文。',
      '好きなテーマで自分だけの日本語教材を作ろう！',
      '日本語レベル',
      'N4｜基礎から多読へ',
      'N3｜自然な長文へ',
      'N2｜生の日本語へ',
      'AIStudioで日本語教材をつくる',
      'できた日本語教材を取り込む',
      '日本語教材の作成指示をコピー',
    ]) {
      if (!bodyText.includes(required.replace(/\s+/g, ''))) throw new Error(`${target.name}: missing Japanese-mode copy: ${required}`);
    }
    for (const forbidden of ['英語レベル', '好きからつくる、英語長文。', '自分だけの英語教材を作ろう！']) {
      if (bodyText.includes(forbidden.replace(/\s+/g, ''))) throw new Error(`${target.name}: English-mode copy remains visible: ${forbidden}`);
    }

    const level = page.getByTestId('create-level');
    const length = page.getByTestId('create-length');
    const depth = page.getByTestId('create-depth');
    const levelOptions = await level.locator('option').evaluateAll(options => options.map(option => [option.value, option.textContent?.trim()]));
    if (JSON.stringify(levelOptions) !== JSON.stringify([
      ['N4', 'N4｜基礎から多読へ'],
      ['N3', 'N3｜自然な長文へ'],
      ['N2', 'N2｜生の日本語へ'],
    ])) throw new Error(`${target.name}: JLPT level options are wrong: ${JSON.stringify(levelOptions)}`);
    if (await level.inputValue() !== 'N3') throw new Error(`${target.name}: default level must be N3.`);
    if (await length.inputValue() !== '1200') throw new Error(`${target.name}: default length must be 1200.`);
    if (await depth.inputValue() !== 'familiar') throw new Error(`${target.name}: default knowledge depth must be familiar.`);

    await page.getByTestId('create-topic').fill('日本のコンビニ文化');
    await page.getByTestId('create-keyword').fill('留学生が驚きやすい点も入れる');
    await level.selectOption('N2');
    await length.selectOption('1800');
    await depth.selectOption('advanced');
    await page.getByTestId('create-copy').click();
    const prompt = await page.evaluate(() => window.__jpCopiedPrompt || '');
    for (const required of [
      'MEMORA Japanese Reader用の日本語読解教材',
      '本文は必ず自然な日本語で書く。英語長文を作らない。',
      '"schemaVersion": "memora-jp-reader-v1"',
      '"mode": "jp-reader"',
      '"targetLevel": "N2"',
      'original.text と original.segments[].surface',
      '日本のコンビニ文化',
      '留学生が驚きやすい点も入れる',
      '本文全体で約1,600〜2,000字',
    ]) {
      if (!prompt.includes(required)) throw new Error(`${target.name}: copied Japanese prompt missing: ${required}`);
    }
    for (const forbidden of ['READON用の英語長文教材', '英検準1級', '英文1行→日本語訳1行→解説1行']) {
      if (prompt.includes(forbidden)) throw new Error(`${target.name}: legacy English prompt remains: ${forbidden}`);
    }

    const mascot = page.locator('img.create-home__hero-art');
    if (!(await mascot.evaluate(image => image.complete && image.naturalWidth > 0))) throw new Error(`${target.name}: hero dinosaur/world image did not load.`);
    if (!String(await mascot.getAttribute('src')).includes('/memora-world/create-v1.webp')) throw new Error(`${target.name}: hero art changed unexpectedly.`);
    await assertNoOverflow(page, `${target.name}/home`);
    await page.screenshot({ path: `${outDir}/${target.name}-home.png`, fullPage: true });

    await page.getByTestId('create-import').click();
    await page.getByTestId('jp-library').waitFor({ state: 'visible', timeout: 15_000 });
    const modal = page.getByTestId('jp-import-modal');
    await modal.waitFor({ state: 'visible', timeout: 10_000 });
    if (!(await page.getByRole('tab', { name: 'JSONを貼る' }).getAttribute('aria-selected'))?.includes('true')) {
      throw new Error(`${target.name}: direct import did not open on JSON paste tab.`);
    }
    if (!(await page.getByText('日本語Reader教材JSON', { exact: true }).isVisible())) throw new Error(`${target.name}: Japanese JSON import label is missing.`);
    await assertNoOverflow(page, `${target.name}/import`);
    await page.screenshot({ path: `${outDir}/${target.name}-import.png`, fullPage: false });

    if (consoleErrors.length) throw new Error(`${target.name}: console errors: ${consoleErrors.join(' | ')}`);
    if (pageErrors.length) throw new Error(`${target.name}: page errors: ${pageErrors.join(' | ')}`);
    console.log(`${target.name}: Japanese create flow QA passed`);
  } finally {
    await context.close();
    await browser.close();
  }
}
