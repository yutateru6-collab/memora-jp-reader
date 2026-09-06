import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
const fixture = await fs.readFile(new URL('./fixtures/jp-reader-valid.json', import.meta.url), 'utf8');

const targets = [
  { name: 'desktop', browserType: chromium, context: { viewport: { width: 1280, height: 900 } } },
  { name: 'iphone-webkit', browserType: webkit, context: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true } },
];

for (const target of targets) {
  const browser = await target.browserType.launch({ headless: true });
  const context = await browser.newContext(target.context);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', error => pageErrors.push(String(error)));

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('open-japanese-reader').click();
    await page.getByTestId('jp-library').waitFor({ state: 'visible', timeout: 15_000 });
    await page.getByTestId('jp-open-import').click();
    await page.getByTestId('jp-json-input').fill(fixture);
    await page.getByTestId('jp-import-submit').click();
    await page.getByText('日本語教材JSONを確認できました').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByTestId('jp-import-submit').click();
    await page.getByTestId('jp-reader-screen').waitFor({ state: 'visible', timeout: 15_000 });

    if (!(await page.getByTestId('jp-speech-rate').isVisible())) throw new Error(`${target.name}: speech rate control missing`);
    if (!(await page.getByTestId('jp-repeat-count').isVisible())) throw new Error(`${target.name}: repeat control missing`);
    await page.getByTestId('jp-speech-rate').selectOption('0.85');
    await page.getByTestId('jp-repeat-count').selectOption('3');

    await page.getByTestId('jp-mode-study').click();
    await page.locator('[data-segment-id="s1-o-5"]').click();
    const wordSheet = page.getByRole('dialog', { name: '勉強し' });
    await wordSheet.waitFor({ state: 'visible', timeout: 5_000 });
    await wordSheet.getByRole('button', { name: '単語カードに登録' }).click();
    await wordSheet.getByTestId('jp-toggle-known').click();
    await wordSheet.getByRole('button', { name: '語彙情報を閉じる' }).click();

    await page.getByTestId('jp-furigana-mode').selectOption('personalized');
    if (await page.locator('[data-segment-id="s1-o-5"] ruby').count()) throw new Error(`${target.name}: known word still shows ruby in personalized mode`);

    await page.locator('[data-sentence-id="s1"]').first().getByRole('button', { name: '文の翻訳・文法・ニュアンスを見る' }).click();
    const sentenceSheet = page.getByRole('dialog', { name: '文の解説' });
    await sentenceSheet.waitFor({ state: 'visible', timeout: 5_000 });
    await sentenceSheet.getByRole('button', { name: '文法ノートに保存' }).first().click();
    if (!/信頼度/.test(await sentenceSheet.innerText())) throw new Error(`${target.name}: confidence information missing`);
    await sentenceSheet.getByRole('button', { name: '文の解説を閉じる' }).click();

    await page.getByRole('button', { name: '← 教材一覧' }).click();
    await page.getByTestId('jp-learning-dashboard').waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="jp-learning-dashboard"]');
      const text = element?.textContent?.replace(/\s+/g, ' ') || '';
      return /1\s*登録語/.test(text) && /1\s*既知語/.test(text) && /1\s*文法/.test(text);
    }, null, { timeout: 10_000 });
    const dashboard = await page.getByTestId('jp-learning-dashboard').innerText();
    if (!/1\s*登録語/.test(dashboard.replace(/\n/g, ' '))) throw new Error(`${target.name}: registered word summary missing: ${dashboard}`);
    if (!/1\s*既知語/.test(dashboard.replace(/\n/g, ' '))) throw new Error(`${target.name}: known word summary missing: ${dashboard}`);
    if (!/1\s*文法/.test(dashboard.replace(/\n/g, ' '))) throw new Error(`${target.name}: grammar summary missing: ${dashboard}`);

    await page.getByTestId('jp-open-review').click();
    await page.getByTestId('jp-review-panel').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByTestId('jp-review-reveal').click();
    await page.getByRole('button', { name: /できた/ }).click();
    await page.getByText('今日の復習は完了です').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: '教材一覧へ' }).click();

    await page.getByTestId('jp-open-grammar').click();
    await page.getByTestId('jp-grammar-notebook').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText('名詞＋を＋動詞', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByRole('button', { name: '← 教材一覧' }).click();

    await page.getByTestId('jp-open-known').click();
    await page.getByTestId('jp-known-words').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText('勉強し', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });

    if (consoleErrors.length) throw new Error(`${target.name}: console errors: ${consoleErrors.join(' | ')}`);
    if (pageErrors.length) throw new Error(`${target.name}: page errors: ${pageErrors.join(' | ')}`);
    console.log(`${target.name}: Japanese learning loop QA passed`);
  } finally {
    await context.close();
    await browser.close();
  }
}
