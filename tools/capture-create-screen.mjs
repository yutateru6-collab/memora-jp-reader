import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
const outDir = 'qa-create-artifacts/screenshots';
const reportPath = 'qa-create-artifacts/report.json';

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir('qa-create-artifacts', { recursive: true });

const targets = [
  {
    name: 'desktop-1440x900',
    context: {
      viewport: { width: 1440, height: 900 },
      screen: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    },
  },
  {
    name: 'iphone-16',
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

const results = [];
const errorText = error => error instanceof Error ? `${error.name}: ${error.message}` : String(error);

async function visibleText(page, text) {
  return page.getByText(text, { exact: true }).isVisible().catch(() => false);
}

async function documentState(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    clientHeight: document.documentElement.clientHeight,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
}

const browser = await chromium.launch({ headless: true });

for (const target of targets) {
  const result = {
    target: target.name,
    viewport: target.context.viewport,
    deviceScaleFactor: target.context.deviceScaleFactor,
    status: 'failure',
    consoleErrors: [],
    pageErrors: [],
    actions: [],
    checks: {},
    screenshots: {},
    failure: null,
  };

  const context = await browser.newContext(target.context);
  const page = await context.newPage();
  page.on('console', msg => { if (msg.type() === 'error') result.consoleErrors.push(msg.text()); });
  page.on('pageerror', err => result.pageErrors.push(String(err)));

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByRole('heading', { name: 'Library', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
    result.actions.push('open-library');

    const createButton = page.getByRole('button', { name: /長文をつくる/ }).first();
    await createButton.waitFor({ state: 'visible', timeout: 10_000 });
    await createButton.click();
    result.actions.push('open-prompt-library');

    await page.getByRole('heading', { name: '教材をつくる', exact: true }).first().waitFor({ state: 'visible', timeout: 10_000 });

    const longReading = page.getByRole('button').filter({ hasText: '好きな内容の長文' }).first();
    await longReading.waitFor({ state: 'visible', timeout: 10_000 });
    await longReading.click();
    result.actions.push('open-long-reading');

    await page.getByPlaceholder('日本のラーメン文化').fill('星と恐竜の学習法');
    const keyword = page.getByPlaceholder(/例文に含めたい個人的な情報/).first();
    if (await keyword.count()) await keyword.fill('星空、恐竜、英語学習');
    result.actions.push('fill-theme-and-keyword');

    const roleLabel = page.locator('label').filter({ hasText: '役割' }).last();
    const roleSelect = roleLabel.locator('..').locator('select');
    if (await roleSelect.count()) await roleSelect.selectOption({ label: '高校教師' }).catch(() => {});

    const traitLabel = page.locator('label').filter({ hasText: '特徴' }).last();
    const traitSelect = traitLabel.locator('..').locator('select');
    if (await traitSelect.count()) await traitSelect.selectOption({ label: '完全なるポジティブ' }).catch(() => {});
    result.actions.push('change-persona');

    await page.waitForTimeout(400);

    const customCard = page.locator('main').filter({ has: page.locator('img[src*="06_紫_ノートを書くステゴサウルス.png"]') }).locator('.space-y-4.my-4').first();
    result.checks = {
      depthHidden: !(await customCard.getByText('深さ', { exact: true }).isVisible().catch(() => false)),
      paragraphHidden: !(await customCard.getByText('段落', { exact: true }).isVisible().catch(() => false)),
      nameHidden: !(await customCard.getByText('名前', { exact: true }).isVisible().catch(() => false)),
      explanationRatioHidden: !(await customCard.getByText(/解説の割合/).isVisible().catch(() => false)),
      roleVisible: await visibleText(page, '役割'),
      traitVisible: await visibleText(page, '特徴'),
      heroDinoLoaded: await page.locator('img[src*="06_紫_ノートを書くステゴサウルス.png"]').first().evaluate(img => img.complete && img.naturalWidth > 0),
      starThemeLoaded: await page.evaluate(() => [...document.styleSheets].some(sheet => (sheet.href || '').includes('star-dino.css'))),
    };

    const state = await documentState(page);
    result.document = state;
    result.url = page.url();
    result.pageTitle = await page.title();

    const prefix = `${outDir}/${target.name}-create`;
    await page.screenshot({ path: `${prefix}-viewport.png`, fullPage: false, scale: 'device' });
    await page.screenshot({ path: `${prefix}-full.png`, fullPage: true, scale: 'device' });
    await page.screenshot({ path: `${prefix}-ai-preview.jpg`, fullPage: false, type: 'jpeg', quality: 58, scale: 'css' });
    result.screenshots = {
      viewport: `${prefix}-viewport.png`,
      full: `${prefix}-full.png`,
      aiPreview: `${prefix}-ai-preview.jpg`,
    };

    const allChecksPassed = Object.values(result.checks).every(Boolean);
    if (!allChecksPassed) throw new Error(`Creation-screen visibility checks failed: ${JSON.stringify(result.checks)}`);
    if (state.horizontalOverflow) throw new Error('Creation screen has horizontal document overflow.');
    if (result.consoleErrors.length) throw new Error(`Console errors: ${result.consoleErrors.join(' | ')}`);
    if (result.pageErrors.length) throw new Error(`Page errors: ${result.pageErrors.join(' | ')}`);

    result.status = 'success';
  } catch (error) {
    result.failure = errorText(error);
    try {
      const prefix = `${outDir}/${target.name}-failure`;
      await page.screenshot({ path: `${prefix}.png`, fullPage: false, scale: 'device' });
      await page.screenshot({ path: `${prefix}.jpg`, fullPage: false, type: 'jpeg', quality: 58, scale: 'css' });
      result.screenshots.failure = `${prefix}.png`;
    } catch {}
  } finally {
    results.push(result);
    await context.close();
  }
}

await browser.close();

const status = results.every(result => result.status === 'success') ? 'success' : 'failure';
const report = {
  generatedAt: new Date().toISOString(),
  repository: process.env.QA_REPOSITORY || null,
  commitSha: process.env.QA_COMMIT_SHA || null,
  workflowRunId: process.env.QA_RUN_ID || null,
  baseUrl,
  status,
  results,
};

await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(`Saved ${reportPath} with status=${status}`);
console.log(`QA_CREATE_REPORT=${JSON.stringify(report)}`);
if (status !== 'success') process.exitCode = 1;
