import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
const fixture = await fs.readFile(new URL('./fixtures/jp-reader-valid.json', import.meta.url), 'utf8');
const outDir = 'qa-artifacts/learner-gap';
await fs.mkdir(outDir, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  home: {},
  import: {},
  plainTextReader: {},
  analyzedReader: {},
  libraryAfterStudy: {},
  errors: [],
};

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(`pageerror: ${error}`));
page.on('console', message => { if (message.type() === 'error') report.errors.push(`console: ${message.text()}`); });

const texts = async locator => locator.evaluateAll(nodes => nodes.map(node => (node.textContent || '').trim()).filter(Boolean));
const bodyText = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByTestId('create-home').waitFor({ state: 'visible', timeout: 20_000 });
  report.home = {
    title: await page.locator('h1').first().innerText(),
    levelOptions: await texts(page.getByTestId('create-level').locator('option')),
    hasExternalAiRoundTrip: await page.getByTestId('create-open-ai-studio').isVisible(),
    hasImportAfterAiButton: await page.getByTestId('create-import').isVisible(),
    hasUiLanguageSelector: (await page.locator('label').filter({ hasText: /表示言語|UI言語|interface language|language/i }).count()) > 0,
  };
  await page.screenshot({ path: `${outDir}/01-home.png`, fullPage: true });

  await page.getByTestId('create-import').click();
  const modal = page.getByTestId('jp-import-modal');
  await modal.waitFor({ state: 'visible', timeout: 15_000 });
  const tabNames = await texts(modal.getByRole('tab'));
  report.import = {
    tabs: tabNames,
    hasUrlImportTab: tabNames.some(name => /URL|リンク|web/i.test(name)),
    hasPlainTextTab: tabNames.some(name => name.includes('日本語本文')),
  };

  await modal.getByRole('tab', { name: '日本語本文' }).click();
  await page.getByTestId('jp-plain-input').fill('昨日、友達と新しい喫茶店に行った。店員さんが丁寧におすすめを教えてくれたので、季節のケーキを注文した。とてもおいしかった。');
  const titleInput = modal.locator('label').filter({ hasText: '教材名' }).locator('input');
  if (await titleInput.count()) await titleInput.fill('普通の日本語本文テスト');
  await page.getByTestId('jp-import-submit').click();
  await page.getByTestId('jp-reader-screen').waitFor({ state: 'visible', timeout: 15_000 });
  const plainBody = await bodyText();
  await page.getByTestId('jp-mode-study').click();
  const firstPlainSegment = page.locator('.jp-sentence .jp-segment').filter({ hasText: /\S/ }).first();
  await firstPlainSegment.click();
  const wordDialog = page.getByRole('dialog').first();
  await wordDialog.waitFor({ state: 'visible', timeout: 5_000 });
  const plainWordText = await wordDialog.innerText();
  await wordDialog.getByRole('button', { name: '語彙情報を閉じる' }).click();
  await page.locator('.jp-sentence__hint').first().click();
  const sentenceDialog = page.getByRole('dialog', { name: '文の解説' });
  await sentenceDialog.waitFor({ state: 'visible', timeout: 5_000 });
  const plainSentenceText = await sentenceDialog.innerText();
  await sentenceDialog.getByRole('button', { name: '文の解説を閉じる' }).click();
  report.plainTextReader = {
    showsNoDetailedAnalysisWarning: /詳細解析なし|語彙・文法情報がない/.test(plainBody),
    rubyCount: await page.locator('.jp-reader-document ruby').count(),
    wordInfoMissingCount: (plainWordText.match(/情報なし|詳細解析がありません/g) || []).length,
    sentenceTranslationMissing: plainSentenceText.includes('翻訳情報がありません'),
    sentenceGrammarMissing: plainSentenceText.includes('文法情報がありません'),
    hasQuiz: !plainBody.includes('この教材にはクイズがありません'),
  };
  await page.screenshot({ path: `${outDir}/02-plain-text-study.png`, fullPage: true });

  await page.getByRole('button', { name: '← 教材一覧' }).click();
  await page.getByTestId('jp-library').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('jp-open-import').click();
  await page.getByTestId('jp-json-input').fill(fixture);
  await page.getByTestId('jp-import-submit').click();
  await modal.getByText('教材JSONを確認できました').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByTestId('jp-import-submit').click();
  await page.getByTestId('jp-reader-screen').waitFor({ state: 'visible', timeout: 15_000 });

  const furiganaOptions = await texts(page.getByTestId('jp-furigana-mode').locator('option'));
  const levelSelect = page.locator('.jp-reader-controls label').filter({ hasText: '自分のレベル' }).locator('select');
  const learnerLevels = await texts(levelSelect.locator('option'));
  await page.getByTestId('jp-mode-study').click();
  await page.locator('[data-segment-id="s1-o-5"]').click();
  const analyzedWordDialog = page.getByRole('dialog', { name: /勉強し/ });
  const analyzedWordText = await analyzedWordDialog.innerText();
  const hasEditWordAction = (await analyzedWordDialog.getByRole('button', { name: /編集|修正|訂正/ }).count()) > 0;
  await analyzedWordDialog.getByRole('button', { name: '単語カードに登録' }).click();
  await analyzedWordDialog.getByRole('button', { name: '語彙情報を閉じる' }).click();

  await page.locator('.jp-sentence__hint').first().click();
  const analyzedSentenceDialog = page.getByRole('dialog', { name: '文の解説' });
  const hasEditSentenceAction = (await analyzedSentenceDialog.getByRole('button', { name: /編集|修正|訂正/ }).count()) > 0;
  const analyzedSentenceText = await analyzedSentenceDialog.innerText();
  await analyzedSentenceDialog.getByRole('button', { name: '文の解説を閉じる' }).click();

  const readerText = await bodyText();
  const readerLabels = await texts(page.locator('.jp-reader-controls label'));
  report.analyzedReader = {
    furiganaOptions,
    learnerLevels,
    furiganaIsLevelBasedNotKnownKanjiBased: furiganaOptions.includes('レベル外だけ') && !furiganaOptions.some(value => /既知|覚えた|学習済み/.test(value)),
    hasAudioSpeedControl: readerLabels.some(label => /速度|スピード/.test(label)),
    hasVoiceSelector: readerLabels.some(label => /音声|声/.test(label)),
    hasInlineEditForWordAnalysis: hasEditWordAction,
    hasInlineEditForSentenceAnalysis: hasEditSentenceAction,
    showsConfidenceOrWarningsInStudyUi: /confidence|信頼度|警告|warning/i.test(`${analyzedWordText} ${analyzedSentenceText}`),
    hasTranslationLanguageSelector: readerLabels.some(label => /翻訳言語|解説言語/.test(label)),
    registeredWordCountTextPresent: /1語登録/.test(readerText),
  };
  await page.screenshot({ path: `${outDir}/03-analyzed-study.png`, fullPage: true });

  await page.getByRole('button', { name: '← 教材一覧' }).click();
  await page.getByTestId('jp-library').waitFor({ state: 'visible', timeout: 10_000 });
  const libraryText = await bodyText();
  const libraryButtons = await texts(page.getByRole('button'));
  report.libraryAfterStudy = {
    buttonTexts: libraryButtons,
    hasJapaneseVocabularyReviewEntry: libraryButtons.some(text => /単語.*復習|復習.*単語|SRS|フラッシュカード|単語デッキ/.test(text)),
    hasKnownWordManagement: /既知語|知っている単語|学習済み語彙/.test(libraryText),
    hasAccountOrSyncEntry: /ログイン|アカウント|同期|sync|cloud/i.test(libraryText),
    hasGrammarNotebook: /文法ノート|文法一覧|保存した文法/.test(libraryText),
  };
  await page.screenshot({ path: `${outDir}/04-library-after-study.png`, fullPage: true });
} catch (error) {
  report.errors.push(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  try { await page.screenshot({ path: `${outDir}/failure.png`, fullPage: true }); } catch {}
} finally {
  await fs.writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2));
  console.log(`JP_LEARNER_GAP_AUDIT=${JSON.stringify(report)}`);
  await context.close();
  await browser.close();
}

if (report.errors.length) process.exitCode = 1;
