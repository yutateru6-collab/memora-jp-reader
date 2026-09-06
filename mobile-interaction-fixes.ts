const WORD_SELECTOR = '[data-word-card]';
const TAP_MOVE_TOLERANCE = 12;
const CREATE_SELECTOR = '.create-home';
const CREATE_CONTENT_SELECTOR = '.create-home__content';
const KEYBOARD_OPEN_DELTA = 120;
const VIEWPORT_RESTORED_TOLERANCE = 72;

interface ActiveWordTouch {
  element: HTMLElement;
  identifier: number;
  startX: number;
  startY: number;
}

let activeWordTouch: ActiveWordTouch | null = null;
let createFocusedField: HTMLInputElement | HTMLTextAreaElement | null = null;
let createStableViewportHeight = 0;
let createKeyboardWasOpen = false;
let createRecoveryTimer: number | null = null;
let createRecoveryFollowUpTimer: number | null = null;
let createRecoveryCount = 0;
let createRecoveryInProgress = false;

const closestWordElement = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(WORD_SELECTOR);
};

const findTrackedTouch = (touches: TouchList, identifier: number): Touch | null => {
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches.item(index);
    if (touch?.identifier === identifier) return touch;
  }
  return null;
};

const movedTooFar = (touch: Touch, active: ActiveWordTouch) => {
  return Math.hypot(touch.clientX - active.startX, touch.clientY - active.startY) > TAP_MOVE_TOLERANCE;
};

const installRegisteredWordTouchFix = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!('ontouchstart' in window) && navigator.maxTouchPoints <= 0) return;

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) {
      activeWordTouch = null;
      return;
    }

    const element = closestWordElement(event.target);
    const touch = event.touches.item(0);
    if (!element || !touch) {
      activeWordTouch = null;
      return;
    }

    activeWordTouch = {
      element,
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
    };
  }, { capture: true, passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!activeWordTouch) return;
    const touch = findTrackedTouch(event.touches, activeWordTouch.identifier);
    if (!touch || movedTooFar(touch, activeWordTouch)) activeWordTouch = null;
  }, { capture: true, passive: true });

  document.addEventListener('touchcancel', () => {
    activeWordTouch = null;
  }, { capture: true, passive: true });

  document.addEventListener('touchend', (event) => {
    const active = activeWordTouch;
    activeWordTouch = null;
    if (!active) return;

    const touch = findTrackedTouch(event.changedTouches, active.identifier);
    const endTarget = closestWordElement(event.target);
    if (!touch || endTarget !== active.element || movedTooFar(touch, active)) return;

    if (event.cancelable) event.preventDefault();
    window.getSelection()?.removeAllRanges();

    requestAnimationFrame(() => {
      if (active.element.isConnected) active.element.click();
    });
  }, { capture: true, passive: false });
};

const isIosWebKit = () => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const touchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /AppleWebKit/i.test(userAgent) && (/iPhone|iPad|iPod/i.test(userAgent) || touchMac);
};

const isCreateTextField = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement => {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return false;
  if (!target.closest(CREATE_SELECTOR)) return false;
  if (target instanceof HTMLTextAreaElement) return true;

  const nonTextTypes = new Set([
    'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio',
    'range', 'reset', 'submit',
  ]);
  return !nonTextTypes.has((target.type || 'text').toLowerCase());
};

const currentViewportHeight = () => Math.round(window.visualViewport?.height || window.innerHeight || 0);

const syncCreateDocumentMode = () => {
  const hasCreateHome = Boolean(document.querySelector(CREATE_SELECTOR));
  document.documentElement.classList.toggle('is-create-home', hasCreateHome);
  document.body.classList.toggle('is-create-home', hasCreateHome);

  if (hasCreateHome) {
    createStableViewportHeight = Math.max(
      createStableViewportHeight,
      currentViewportHeight(),
      Math.round(window.innerHeight || 0),
    );
  } else {
    createFocusedField = null;
    createStableViewportHeight = 0;
    createKeyboardWasOpen = false;
  }
};

const clampScrollY = (value: number) => {
  const viewportHeight = Math.max(window.innerHeight || 0, currentViewportHeight());
  const maximum = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
  return Math.max(0, Math.min(value, maximum));
};

const forceCreateRepaint = (reason: string, requestedScrollX: number, requestedScrollY: number) => {
  if (createRecoveryInProgress) return;

  const root = document.querySelector<HTMLElement>(CREATE_SELECTOR);
  const content = root?.querySelector<HTMLElement>(CREATE_CONTENT_SELECTOR);
  if (!root || !content) return;

  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLSelectElement && activeElement.closest(CREATE_SELECTOR)) {
    root.dataset.keyboardRecoveryDeferred = 'native-select-open';
    return;
  }
  if (isCreateTextField(activeElement) && !reason.startsWith('viewport-restored')) {
    root.dataset.keyboardRecoveryDeferred = 'text-field-active';
    return;
  }

  createRecoveryInProgress = true;
  createRecoveryCount += 1;
  root.dataset.keyboardRecoveryCount = String(createRecoveryCount);
  root.dataset.keyboardRecoveryReason = reason;
  root.dataset.keyboardRecoveryComplete = 'false';
  root.classList.add('create-home--keyboard-recovering');

  const previousDisplay = content.style.display;
  const previousVisibility = content.style.visibility;

  // Tearing this paint subtree down and rebuilding it is deliberate. On iOS
  // in-app browsers the DOM can remain correct while an old keyboard-sized
  // compositor tile hides everything below the focused field. A synchronous
  // display cycle invalidates that stale tile without replacing React nodes or
  // losing controlled form state.
  content.style.visibility = 'hidden';
  content.style.display = 'none';
  void root.offsetHeight;
  content.style.display = previousDisplay;
  void content.offsetHeight;
  content.style.visibility = previousVisibility;
  void root.getBoundingClientRect();
  void document.body.getBoundingClientRect();

  const restoreScroll = () => {
    const targetY = clampScrollY(requestedScrollY);
    window.scrollTo(requestedScrollX, targetY);

    requestAnimationFrame(() => {
      const currentY = window.scrollY;
      const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const nudge = currentY < maximum ? 1 : currentY > 0 ? -1 : 0;
      if (nudge !== 0) {
        window.scrollTo(requestedScrollX, currentY + nudge);
        window.scrollTo(requestedScrollX, currentY);
      }

      root.classList.remove('create-home--keyboard-recovering');
      root.dataset.keyboardRecoveryComplete = 'true';
      createRecoveryInProgress = false;
      createKeyboardWasOpen = false;
      createFocusedField = null;
      createStableViewportHeight = Math.max(currentViewportHeight(), Math.round(window.innerHeight || 0));
    });
  };

  requestAnimationFrame(() => requestAnimationFrame(restoreScroll));
};

const scheduleCreateRecovery = (reason: string, delay = 320) => {
  const root = document.querySelector<HTMLElement>(CREATE_SELECTOR);
  if (!root) return;

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  if (createRecoveryTimer !== null) window.clearTimeout(createRecoveryTimer);
  if (createRecoveryFollowUpTimer !== null) window.clearTimeout(createRecoveryFollowUpTimer);

  root.dataset.keyboardRecoveryScheduled = reason;
  createRecoveryTimer = window.setTimeout(() => {
    createRecoveryTimer = null;
    forceCreateRepaint(reason, scrollX, scrollY);
  }, delay);

  // Safari can finish its keyboard-dismiss animation after focusout has already
  // fired. A second invalidation catches that late compositor commit. It is a
  // no-op outside the Create screen and runs only after text entry on iOS.
  createRecoveryFollowUpTimer = window.setTimeout(() => {
    createRecoveryFollowUpTimer = null;
    if (!document.querySelector(CREATE_SELECTOR)) return;
    forceCreateRepaint(`${reason}-settled`, window.scrollX, window.scrollY);
  }, delay + 520);
};

const handleCreateViewportChange = () => {
  const root = document.querySelector<HTMLElement>(CREATE_SELECTOR);
  if (!root) return;

  const height = currentViewportHeight();
  if (createStableViewportHeight <= 0) {
    createStableViewportHeight = Math.max(height, Math.round(window.innerHeight || 0));
  }

  const shrinkage = createStableViewportHeight - height;
  if (shrinkage >= KEYBOARD_OPEN_DELTA) {
    createKeyboardWasOpen = true;
    root.dataset.keyboardState = 'open';
    return;
  }

  if (createKeyboardWasOpen && height >= createStableViewportHeight - VIEWPORT_RESTORED_TOLERANCE) {
    root.dataset.keyboardState = 'restored';
    scheduleCreateRecovery('viewport-restored', 180);
  }
};

const installCreateKeyboardRecovery = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!isIosWebKit()) return;

  syncCreateDocumentMode();
  const observer = new MutationObserver(syncCreateDocumentMode);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  document.addEventListener('focusin', (event) => {
    if (!isCreateTextField(event.target)) return;
    createFocusedField = event.target;
    createKeyboardWasOpen = false;
    createStableViewportHeight = Math.max(
      createStableViewportHeight,
      currentViewportHeight(),
      Math.round(window.innerHeight || 0),
    );

    const root = event.target.closest<HTMLElement>(CREATE_SELECTOR);
    if (root) {
      root.dataset.keyboardState = 'focused';
      root.dataset.keyboardRecoveryComplete = 'false';
    }
  }, { capture: true });

  document.addEventListener('focusout', (event) => {
    if (createRecoveryInProgress) return;

    if (isCreateTextField(event.target)) {
      createFocusedField = null;
      scheduleCreateRecovery('text-field-blur', 300);
      return;
    }

    if (
      event.target instanceof HTMLSelectElement
      && event.target.closest(CREATE_SELECTOR)
      && createKeyboardWasOpen
    ) {
      scheduleCreateRecovery('native-select-closed-after-keyboard', 180);
    }
  }, { capture: true });

  window.visualViewport?.addEventListener('resize', handleCreateViewportChange, { passive: true });
  window.addEventListener('resize', handleCreateViewportChange, { passive: true });

  window.addEventListener('orientationchange', () => {
    createStableViewportHeight = 0;
    window.setTimeout(() => {
      syncCreateDocumentMode();
      scheduleCreateRecovery('orientation-settled', 120);
    }, 520);
  }, { passive: true });

  window.addEventListener('pageshow', syncCreateDocumentMode);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncCreateDocumentMode();
  });
};

installRegisteredWordTouchFix();
installCreateKeyboardRecovery();
