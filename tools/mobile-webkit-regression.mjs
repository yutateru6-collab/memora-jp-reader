import { webkit } from 'playwright';
import fs from 'node:fs/promises';
import { buildValidQaMaterial } from './qa-material-fixture.mjs';

const baseUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
const reportPath = 'qa-artifacts/report.json';
const screenshotDir = 'qa-artifacts/screenshots';

await fs.mkdir(screenshotDir, { recursive: true });

const result = {
  engine: 'webkit',
  target: 'iphone-16-webkit',
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
  status: 'failure',
  actions: [],
  consoleErrors: [],
  pageErrors: [],
  states: {},
  screenshots: {},
  failure: null,
};

const errorText = error => error instanceof Error ? `${error.name}: ${error.message}` : String(error);

const layoutSnapshot = async page => page.evaluate(() => {
  const rect = selector => {
    const node = document.querySelector(selector);
    if (!(node instanceof HTMLElement)) return null;
    const value = node.getBoundingClientRect();
    return {
      top: value.top + window.scrollY,
      bottom: value.bottom + window.scrollY,
      height: value.height,
      width: value.width,
    };
  };

  const topic = rect('.create-home__topic-card');
  const choices = rect('.create-home__choice-grid');
  const persona = rect('.create-home__persona-card');
  const actions = rect('.create-home__actions');
  const footer = rect('.create-home__footer');
  const createRoot = rect('.create-home');
  const shell = rect('.memora-world--create');
  const glass = document.querySelector('.create-home__glass-card');
  const createNode = document.querySelector('.create-home');
  const shellNode = document.querySelector('.memora-world--create');
  const glassStyle = glass instanceof HTMLElement ? getComputedStyle(glass) : null;
  const createStyle = createNode instanceof HTMLElement ? getComputedStyle(createNode) : null;
  const shellStyle = shellNode instanceof HTMLElement ? getComputedStyle(shellNode) : null;
  const htmlStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const shellBeforeStyle = shellNode instanceof HTMLElement ? getComputedStyle(shellNode, '::before') : null;

  return {
    topic,
    choices,
    persona,
    actions,
    footer,
    createRoot,
    shell,
    gaps: {
      topicToChoices: topic && choices ? choices.top - topic.bottom : null,
      choicesToPersona: choices && persona ? persona.top - choices.bottom : null,
      personaToActions: persona && actions ? actions.top - persona.bottom : null,
      actionsToFooter: actions && footer ? footer.top - actions.bottom : null,
    },
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      htmlCreateClass: document.documentElement.classList.contains('is-create-home'),
      bodyCreateClass: document.body.classList.contains('is-create-home'),
      htmlOverflowX: htmlStyle.overflowX,
      htmlOverflowY: htmlStyle.overflowY,
      bodyOverflowX: bodyStyle.overflowX,
      bodyOverflowY: bodyStyle.overflowY,
      bodyOverscrollY: bodyStyle.overscrollBehaviorY,
      bodyBackgroundColor: bodyStyle.backgroundColor,
      scrollingElement: document.scrollingElement?.tagName || '',
    },
    scrollStructure: {
      create: {
        overflowX: createStyle?.overflowX || '',
        overflowY: createStyle?.overflowY || '',
        minHeight: createStyle?.minHeight || '',
        isolation: createStyle?.isolation || '',
      },
      shell: {
        overflowX: shellStyle?.overflowX || '',
        overflowY: shellStyle?.overflowY || '',
        minHeight: shellStyle?.minHeight || '',
        isolation: shellStyle?.isolation || '',
        beforeDisplay: shellBeforeStyle?.display || '',
        beforeContent: shellBeforeStyle?.content || '',
      },
    },
    recovery: {
      count: Number(createNode?.dataset.keyboardRecoveryCount || 0),
      scheduled: createNode?.dataset.keyboardRecoveryScheduled || '',
      reason: createNode?.dataset.keyboardRecoveryReason || '',
      complete: createNode?.dataset.keyboardRecoveryComplete || '',
      keyboardState: createNode?.dataset.keyboardState || '',
    },
    glassBackdropFilter: glassStyle?.backdropFilter || '',
    glassWebkitBackdropFilter: glassStyle?.webkitBackdropFilter || '',
  };
});

const assertCreateLayout = (snapshot, label) => {
  const ordered = [snapshot.topic, snapshot.choices, snapshot.persona, snapshot.actions, snapshot.footer];
  if (ordered.some(value => !value)) throw new Error(`${label}: create sections are missing: ${JSON.stringify(snapshot)}`);
  if (!snapshot.createRoot || !snapshot.shell) throw new Error(`${label}: create roots are missing: ${JSON.stringify(snapshot)}`);
  if (snapshot.document.horizontalOverflow) throw new Error(`${label}: horizontal overflow: ${JSON.stringify(snapshot.document)}`);

  for (const [name, gap] of Object.entries(snapshot.gaps)) {
    if (gap === null || gap < -1 || gap > 48) {
      throw new Error(`${label}: invalid vertical gap ${name}=${gap}: ${JSON.stringify(snapshot)}`);
    }
  }

  const heightLimits = [280, 160, 360, 320, 180];
  ordered.forEach((rectValue, index) => {
    if (rectValue.height <= 0 || rectValue.height > heightLimits[index]) {
      throw new Error(`${label}: implausible section height at index ${index}: ${JSON.stringify(snapshot)}`);
    }
  });

  // The footer intentionally uses an 18px negative bottom margin, so its paint
  // box may extend slightly beyond the create root. Anything materially larger
  // points to the blank-space regression seen after iOS keyboard dismissal.
  if (snapshot.footer.bottom > snapshot.createRoot.bottom + 24) {
    throw new Error(`${label}: footer escaped create root: ${JSON.stringify(snapshot)}`);
  }
  if (snapshot.createRoot.bottom > snapshot.shell.bottom + 2) {
    throw new Error(`${label}: create root escaped app shell: ${JSON.stringify(snapshot)}`);
  }

  for (const [name, structure] of Object.entries(snapshot.scrollStructure)) {
    if (structure.overflowX !== 'visible' || structure.overflowY !== 'visible') {
      throw new Error(`${label}: ${name} must not be a nested scroll container: ${JSON.stringify(snapshot.scrollStructure)}`);
    }
    if (structure.isolation !== 'auto') {
      throw new Error(`${label}: ${name} must not create an isolated compositor group: ${JSON.stringify(snapshot.scrollStructure)}`);
    }
  }

  if (!snapshot.document.htmlCreateClass || !snapshot.document.bodyCreateClass) {
    throw new Error(`${label}: create document mode class is missing: ${JSON.stringify(snapshot.document)}`);
  }
  if (snapshot.document.bodyOverscrollY !== 'auto') {
    throw new Error(`${label}: create root overscroll must be restored to auto: ${JSON.stringify(snapshot.document)}`);
  }
  if (!['clip', 'hidden'].includes(snapshot.document.htmlOverflowX)) {
    throw new Error(`${label}: document root must own horizontal clipping: ${JSON.stringify(snapshot.document)}`);
  }
  if (!['auto', 'scroll'].includes(snapshot.document.htmlOverflowY)) {
    throw new Error(`${label}: document root must own vertical scrolling: ${JSON.stringify(snapshot.document)}`);
  }
  if (snapshot.document.bodyOverflowX !== 'visible' || snapshot.document.bodyOverflowY !== 'visible') {
    throw new Error(`${label}: body must not become a nested scroll container: ${JSON.stringify(snapshot.document)}`);
  }
  if (snapshot.document.scrollingElement !== 'HTML') {
    throw new Error(`${label}: scrolling element must remain the document root: ${JSON.stringify(snapshot.document)}`);
  }

  if (snapshot.scrollStructure.shell.beforeDisplay !== 'none' && snapshot.scrollStructure.shell.beforeContent !== 'none') {
    throw new Error(`${label}: create shell fixed flower layer must be disabled: ${JSON.stringify(snapshot.scrollStructure.shell)}`);
  }

  if (snapshot.glassBackdropFilter !== 'none' || snapshot.glassWebkitBackdropFilter !== 'none') {
    throw new Error(`${label}: mobile glass blur must be disabled for WebKit stability: ${JSON.stringify(snapshot)}`);
  }
};

const importerSnapshot = async page => page.evaluate(() => {
  const dialog = document.querySelector('[role="dialog"][aria-labelledby="add-material-title"]');
  const body = document.querySelector('.memora-modal__body');
  const textarea = document.querySelector('.memora-import-textarea');
  const preview = document.querySelector('[data-testid="material-paste-preview"]');
  const submit = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('教材として取り込む'));
  const coverLabel = [...document.querySelectorAll('.memora-field-label')].find(label => label.textContent?.includes('5. 表紙画像'));
  if (!(dialog instanceof HTMLElement) || !(body instanceof HTMLElement) || !(submit instanceof HTMLElement)) return null;
  const dialogRect = dialog.getBoundingClientRect();
  const bodyRect = body.getBoundingClientRect();
  const submitRect = submit.getBoundingClientRect();
  const coverRect = coverLabel?.getBoundingClientRect();
  const previewRect = preview?.getBoundingClientRect();
  const textareaStyle = textarea ? getComputedStyle(textarea) : null;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  return {
    viewportHeight,
    dialog: { top: dialogRect.top, bottom: dialogRect.bottom, left: dialogRect.left, right: dialogRect.right, width: dialogRect.width, height: dialogRect.height },
    body: {
      top: bodyRect.top,
      bottom: bodyRect.bottom,
      clientHeight: body.clientHeight,
      scrollHeight: body.scrollHeight,
      scrollTop: body.scrollTop,
      overflowY: getComputedStyle(body).overflowY,
      touchAction: getComputedStyle(body).touchAction,
    },
    textarea: textarea && textareaStyle ? {
      top: textarea.getBoundingClientRect().top,
      bottom: textarea.getBoundingClientRect().bottom,
      clientHeight: textarea.clientHeight,
      scrollHeight: textarea.scrollHeight,
      overflowY: textareaStyle.overflowY,
      fontSize: Number.parseFloat(textareaStyle.fontSize),
    } : null,
    preview: previewRect ? {
      top: previewRect.top,
      bottom: previewRect.bottom,
      height: previewRect.height,
      characterCount: Number(preview?.getAttribute('data-character-count') || 0),
    } : null,
    submit: {
      top: submitRect.top,
      bottom: submitRect.bottom,
      visible: getComputedStyle(submit).display !== 'none' && submitRect.width > 0 && submitRect.height > 0,
      fullyVisible: submitRect.top >= -0.5 && submitRect.bottom <= viewportHeight + 0.5,
    },
    keyboardMode: dialog.classList.contains('memora-modal--keyboard-open'),
    cover: coverRect ? {
      top: coverRect.top,
      bottom: coverRect.bottom,
      insideBody: coverRect.top >= bodyRect.top - 0.5 && coverRect.bottom <= bodyRect.bottom + 0.5,
    } : null,
  };
});

let browser;
let context;
let page;

try {
  browser = await webkit.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    screen: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  page = await context.newPage();
  page.on('console', message => {
    if (message.type() === 'error') result.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => result.pageErrors.push(String(error)));

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('heading', { name: 'リードン READON', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-create-home'), null, { timeout: 10_000 });
  // A heading can become visible before Vite's stylesheet request has finished
  // in headless WebKit. Do not mistake that transient unstyled document for a
  // real horizontal-overflow regression.
  await page.waitForFunction(() => {
    const style = getComputedStyle(document.documentElement);
    return ['clip', 'hidden'].includes(style.overflowX)
      && ['auto', 'scroll'].includes(style.overflowY);
  }, null, { timeout: 10_000 });
  result.actions.push('open-create-home-webkit');

  const before = await layoutSnapshot(page);
  assertCreateLayout(before, 'before-input');
  const recoveryCountBeforeInput = before.recovery.count;

  const topic = page.getByTestId('create-topic');
  await topic.tap();
  await topic.fill('小池栄子 根本はるみ');
  await page.waitForTimeout(250);
  const focused = await layoutSnapshot(page);
  assertCreateLayout(focused, 'topic-focused');
  result.actions.push('tap-and-fill-topic');

  await page.setViewportSize({ width: 393, height: 520 });
  await page.waitForTimeout(250);
  const keyboardSized = await layoutSnapshot(page);
  assertCreateLayout(keyboardSized, 'keyboard-sized-viewport');
  result.actions.push('shrink-viewport-like-ios-keyboard');

  await topic.evaluate(element => element.blur());
  await page.waitForTimeout(100);
  await page.setViewportSize({ width: 393, height: 852 });

  await page.waitForFunction(
    expected => Number(document.querySelector('.create-home')?.getAttribute('data-keyboard-recovery-count') || 0) > expected,
    recoveryCountBeforeInput,
    { timeout: 8_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('.create-home')?.getAttribute('data-keyboard-recovery-complete') === 'true',
    null,
    { timeout: 8_000 },
  );
  await page.waitForTimeout(900);

  const restored = await layoutSnapshot(page);
  assertCreateLayout(restored, 'restored-after-keyboard');
  if (restored.recovery.count <= recoveryCountBeforeInput) {
    throw new Error(`restored-after-keyboard: repaint recovery did not run: ${JSON.stringify(restored.recovery)}`);
  }
  if (restored.recovery.complete !== 'true') {
    throw new Error(`restored-after-keyboard: repaint recovery did not complete: ${JSON.stringify(restored.recovery)}`);
  }
  result.actions.push('restore-viewport-and-verify-repaint-recovery');

  const restoredDocumentDelta = Math.abs(restored.document.scrollHeight - before.document.scrollHeight);
  if (restoredDocumentDelta > 80) {
    throw new Error(`restored-after-keyboard: document height drifted by ${restoredDocumentDelta}px: ${JSON.stringify({ before: before.document, restored: restored.document })}`);
  }

  result.states.create = { before, focused, keyboardSized, restored };
  const actions = page.locator('.create-home__actions');
  await actions.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);
  result.screenshots.create = `${screenshotDir}/iphone-16-webkit-create-lower-form-after-keyboard-cycle.png`;
  await page.screenshot({ path: result.screenshots.create, fullPage: false, scale: 'device' });

  await page.getByRole('button', { name: '教材一覧' }).click();
  await page.getByRole('heading', { name: '教材ライブラリ', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: '教材を追加' }).click();
  const importerDialog = page.getByRole('dialog', { name: '新しい教材を追加' });
  await importerDialog.waitFor({ state: 'visible', timeout: 10_000 });
  result.actions.push('open-importer-webkit');

  const importerTextarea = page.locator('.memora-import-textarea');
  const materialTitle = 'WebKit importer regression';
  const longMaterial = buildValidQaMaterial({ paragraphCount: 8 });
  await page.getByLabel('教材名').fill(materialTitle);
  await importerTextarea.focus();
  await page.setViewportSize({ width: 393, height: 520 });
  await page.waitForTimeout(180);
  const importerKeyboardFocused = await importerSnapshot(page);
  if (!importerKeyboardFocused?.keyboardMode
      || importerKeyboardFocused.submit.visible
      || !importerKeyboardFocused.textarea
      || importerKeyboardFocused.body.clientHeight < 250
      || importerKeyboardFocused.textarea.top < importerKeyboardFocused.body.top
      || importerKeyboardFocused.textarea.top >= importerKeyboardFocused.body.bottom) {
    throw new Error(`importer-keyboard-focused: paste field is still covered: ${JSON.stringify(importerKeyboardFocused)}`);
  }
  result.actions.push('focus-importer-with-keyboard-and-retire-footer-webkit');
  result.screenshots.importerKeyboard = `${screenshotDir}/iphone-16-webkit-importer-keyboard-field-clear.png`;
  await page.screenshot({ path: result.screenshots.importerKeyboard, fullPage: false, scale: 'device' });

  await importerTextarea.evaluate((element, pastedText) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', pastedText);
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
  }, longMaterial);
  await page.getByTestId('material-paste-preview').waitFor({ state: 'visible', timeout: 10_000 });
  await page.waitForTimeout(240);
  const importerKeyboardSized = await importerSnapshot(page);
  if (!importerKeyboardSized || importerKeyboardSized.dialog.height > importerKeyboardSized.viewportHeight + 0.5) {
    throw new Error(`importer-keyboard-sized: dialog ignored the visual viewport: ${JSON.stringify(importerKeyboardSized)}`);
  }
  if (!importerKeyboardSized?.submit.visible || !importerKeyboardSized.submit.fullyVisible) {
    throw new Error(`importer-keyboard-sized: submit is clipped: ${JSON.stringify(importerKeyboardSized)}`);
  }
  if (!importerKeyboardSized.preview || importerKeyboardSized.preview.characterCount !== longMaterial.length || importerKeyboardSized.textarea) {
    throw new Error(`importer-keyboard-sized: paste did not become a compact confirmation: ${JSON.stringify(importerKeyboardSized)}`);
  }
  result.screenshots.importerPasted = `${screenshotDir}/iphone-16-webkit-importer-after-paste.png`;
  await page.screenshot({ path: result.screenshots.importerPasted, fullPage: false, scale: 'device' });

  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForTimeout(260);
  const importerBeforeScroll = await importerSnapshot(page);
  if (!importerBeforeScroll) throw new Error('importer-restored: layout snapshot is unavailable.');
  if (!importerBeforeScroll.preview || importerBeforeScroll.textarea) {
    throw new Error(`importer-restored: pasted data is not in the compact confirmation: ${JSON.stringify(importerBeforeScroll)}`);
  }
  if (importerBeforeScroll.body.scrollHeight <= importerBeforeScroll.body.clientHeight || importerBeforeScroll.body.overflowY !== 'auto') {
    throw new Error(`importer-restored: modal body is not the scroll owner: ${JSON.stringify(importerBeforeScroll)}`);
  }
  if (!importerBeforeScroll.submit.fullyVisible) {
    throw new Error(`importer-restored: submit is outside the visual viewport: ${JSON.stringify(importerBeforeScroll)}`);
  }

  const importerBody = page.locator('.memora-modal__body');
  // Playwright does not expose a swipe gesture for mobile WebKit, and
  // mouse.wheel is intentionally unsupported in an isMobile context.
  // Moving the native scroll container verifies WebKit accepted the scroll
  // range; Chromium separately covers the real wheel/pan gesture path.
  await importerBody.evaluate(element => {
    element.scrollTop = Math.min(element.scrollHeight - element.clientHeight, Math.max(240, element.clientHeight));
  });
  await page.waitForTimeout(240);
  const importerAfterGesture = await importerSnapshot(page);
  if (!importerAfterGesture || importerAfterGesture.body.scrollTop <= importerBeforeScroll.body.scrollTop) {
    throw new Error(`importer-gesture: modal body did not scroll: ${JSON.stringify({ importerBeforeScroll, importerAfterGesture })}`);
  }

  await importerBody.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.waitForTimeout(120);
  const importerAtBottom = await importerSnapshot(page);
  if (!importerAtBottom?.cover?.insideBody || !importerAtBottom.submit.fullyVisible) {
    throw new Error(`importer-bottom: bottom controls are unreachable: ${JSON.stringify(importerAtBottom)}`);
  }

  result.states.importer = { importerKeyboardFocused, importerKeyboardSized, importerBeforeScroll, importerAfterGesture, importerAtBottom };
  result.actions.push('scroll-importer-to-bottom-webkit');
  result.screenshots.importer = `${screenshotDir}/iphone-16-webkit-importer-bottom-reachable.png`;
  await page.screenshot({ path: result.screenshots.importer, fullPage: false, scale: 'device' });
  await page.getByRole('button', { name: '教材として取り込む' }).click();
  await page.waitForTimeout(1_000);
  if (await importerDialog.isVisible()) {
    const importAlert = page.getByRole('alert');
    const alert = await importAlert.isVisible() ? await importAlert.innerText() : 'no visible alert';
    throw new Error(`importer-submit: WebKit persistence failed: ${alert}`);
  }
  await page.getByRole('heading', { name: materialTitle, exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => document.querySelectorAll('.memora-reader-sentence').length === 8, null, { timeout: 20_000 });
  const importedReader = await page.evaluate(() => {
    const screen = document.querySelector('.memora-reader-screen');
    const shell = document.querySelector('.memora-world--read');
    const main = document.querySelector('.memora-reader-main');
    const scroll = document.querySelector('.memora-reader-scroll');
    const first = document.querySelector('.memora-reader-sentence');
    const screenRect = screen?.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    const scrollRect = scroll?.getBoundingClientRect();
    const firstRect = first?.getBoundingClientRect();
    return {
      viewportHeight: window.innerHeight,
      viewportVariable: getComputedStyle(document.documentElement).getPropertyValue('--memora-reader-viewport-height').trim(),
      sentenceCount: document.querySelectorAll('.memora-reader-sentence').length,
      firstText: first?.textContent?.replace(/\s+/g, '') || '',
      screen: screenRect ? { top: screenRect.top, bottom: screenRect.bottom, height: screenRect.height } : null,
      shell: shellRect ? { top: shellRect.top, bottom: shellRect.bottom, height: shellRect.height } : null,
      main: mainRect ? { top: mainRect.top, bottom: mainRect.bottom, height: mainRect.height } : null,
      scroll: scrollRect ? {
        top: scrollRect.top,
        bottom: scrollRect.bottom,
        height: scrollRect.height,
        clientHeight: scroll.clientHeight,
        scrollHeight: scroll.scrollHeight,
      } : null,
      first: firstRect ? { top: firstRect.top, bottom: firstRect.bottom, height: firstRect.height } : null,
    };
  });
  if (importedReader.sentenceCount !== 8
      || !importedReader.firstText.includes('Studentsanalyzeramenculture')
      || !importedReader.scroll
      || importedReader.scroll.height < 200
      || importedReader.scroll.bottom > importedReader.viewportHeight + 1
      || importedReader.scroll.scrollHeight <= importedReader.scroll.clientHeight
      || !importedReader.first
      || importedReader.first.height <= 0) {
    throw new Error(`import-reader: valid content is blank or unreachable: ${JSON.stringify(importedReader)}`);
  }
  await page.locator('.memora-reader-scroll').evaluate(element => {
    element.scrollTop = Math.min(240, element.scrollHeight - element.clientHeight);
  });
  await page.waitForTimeout(120);
  const readerScrollTop = await page.locator('.memora-reader-scroll').evaluate(element => element.scrollTop);
  if (readerScrollTop <= 0) {
    throw new Error(`import-reader: valid content cannot scroll: ${JSON.stringify({ importedReader, readerScrollTop })}`);
  }
  await page.locator('.memora-reader-scroll').evaluate(element => { element.scrollTop = 0; });
  result.states.importedReader = importedReader;
  result.actions.push('import-material-and-open-reader-webkit');
  result.screenshots.importSuccess = `${screenshotDir}/iphone-16-webkit-import-success.png`;
  await page.screenshot({ path: result.screenshots.importSuccess, fullPage: false, scale: 'device' });

  // Recreate the document and reopen the saved record. A successful transient
  // render is insufficient: WebKit must be able to read the serialized files
  // back from IndexedDB after a real reload.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '教材一覧' }).click();
  await page.getByRole('heading', { name: '教材ライブラリ', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByRole('button', { name: '読む' }).first().click();
  await page.getByRole('heading', { name: materialTitle, exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => document.querySelectorAll('.memora-reader-sentence').length === 8, null, { timeout: 20_000 });
  const reloadedReader = await page.evaluate(() => ({
    sentenceCount: document.querySelectorAll('.memora-reader-sentence').length,
    firstText: document.querySelector('.memora-reader-sentence')?.textContent?.replace(/\s+/g, '') || '',
  }));
  if (reloadedReader.sentenceCount !== 8 || !reloadedReader.firstText.includes('Studentsanalyzeramenculture')) {
    throw new Error(`import-reload: persisted content is blank: ${JSON.stringify(reloadedReader)}`);
  }
  result.states.reloadedReader = reloadedReader;
  result.actions.push('reload-and-reopen-imported-material-webkit');
  result.screenshots.importReloaded = `${screenshotDir}/iphone-16-webkit-import-reloaded.png`;
  await page.screenshot({ path: result.screenshots.importReloaded, fullPage: false, scale: 'device' });

  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'memora-reader-sentence';
    probe.dataset.testid = 'webkit-reader-probe';
    probe.style.cssText = 'position:fixed;left:16px;top:120px;z-index:99999;padding:16px;background:#0f1f45;border-radius:12px;';

    const inlinePlay = document.createElement('button');
    inlinePlay.type = 'button';
    inlinePlay.dataset.testid = 'webkit-inline-play-probe';
    inlinePlay.textContent = '▶';

    const word = document.createElement('span');
    word.dataset.wordCard = 'originate';
    word.dataset.testid = 'webkit-word-probe';
    word.textContent = 'originate';
    word.style.cssText = 'display:inline-block;padding:12px;font-size:24px;background:#8a6f16;color:white;';
    word.addEventListener('click', () => {
      word.dataset.tapActivated = 'true';
      word.textContent = 'originate ✓';
    });

    probe.append(inlinePlay, word);
    document.body.appendChild(probe);
  });

  const inlineSentencePlay = page.locator('[data-testid="webkit-inline-play-probe"]');
  if (await inlineSentencePlay.isVisible()) {
    throw new Error('Per-sentence play triangle CSS is not hiding the inline button.');
  }
  result.actions.push('verify-inline-play-hidden-webkit');

  const word = page.locator('[data-testid="webkit-word-probe"]');
  await word.waitFor({ state: 'visible', timeout: 10_000 });
  const wordStyle = await word.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      userSelect: style.userSelect,
      webkitUserSelect: style.webkitUserSelect,
      touchAction: style.touchAction,
    };
  });
  const effectiveUserSelect = wordStyle.webkitUserSelect || wordStyle.userSelect;
  if (effectiveUserSelect !== 'none' || wordStyle.touchAction !== 'manipulation') {
    throw new Error(`Registered word touch style is not effective on WebKit: ${JSON.stringify(wordStyle)}`);
  }

  await word.tap();
  await page.waitForFunction(() => document.querySelector('[data-testid="webkit-word-probe"]')?.getAttribute('data-tap-activated') === 'true', null, { timeout: 10_000 });
  result.actions.push('verify-touch-tap-bridge-webkit');
  result.states.readerTouchProbe = { wordStyle, effectiveUserSelect, activated: true };
  result.screenshots.readerTouchProbe = `${screenshotDir}/iphone-16-webkit-word-tap-probe.png`;
  await page.screenshot({ path: result.screenshots.readerTouchProbe, fullPage: false, scale: 'device' });

  if (result.consoleErrors.length) throw new Error(`Console errors: ${result.consoleErrors.join(' | ')}`);
  if (result.pageErrors.length) throw new Error(`Page errors: ${result.pageErrors.join(' | ')}`);

  result.status = 'success';
} catch (error) {
  result.failure = errorText(error);
  if (page) {
    try {
      result.screenshots.failure = `${screenshotDir}/iphone-16-webkit-regression-failure.png`;
      await page.screenshot({ path: result.screenshots.failure, fullPage: false, scale: 'device' });
    } catch {}
  }
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
}

let report = {};
try {
  report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
} catch {}

report.mobileWebKit = result;
if (result.status !== 'success') report.status = 'failure';
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

console.log(`MOBILE_WEBKIT_REPORT=${JSON.stringify(result)}`);
if (result.status !== 'success') process.exitCode = 1;
