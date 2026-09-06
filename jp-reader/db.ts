import type {
  JapaneseReaderMaterialV1,
  JpReaderProgress,
  JpTextVariant,
  JpVocabularyCardSeed,
  StoredJpMaterial,
  StoredJpVocabularyCard,
} from './types';

const DB_NAME = 'MemoraJapaneseReaderDB';
const DB_VERSION = 1;
const MATERIAL_STORE = 'materials';
const PROGRESS_STORE = 'progress';
const CARD_STORE = 'cards';
const JAPANESE_SCRIPT_RE = /[ぁ-んァ-ヶ一-龯々〆ヵヶ]/u;

let databasePromise: Promise<IDBDatabase> | null = null;

const requestToPromise = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const transactionToPromise = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction was aborted'));
});

const openDatabase = () => {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MATERIAL_STORE)) {
        const store = db.createObjectStore(MATERIAL_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        db.createObjectStore(PROGRESS_STORE, { keyPath: 'materialId' });
      }
      if (!db.objectStoreNames.contains(CARD_STORE)) {
        const store = db.createObjectStore(CARD_STORE, { keyPath: 'storageKey' });
        store.createIndex('materialId', 'materialId', { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('日本語教材用データベースを開けませんでした。'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('別のタブでデータベースが使用されています。ほかのタブを閉じて再度お試しください。'));
    };
  });
  return databasePromise;
};

export const formatJpStorageError = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return new Error('保存容量が不足しています。既存データは変更していません。不要なデータを整理して再度お試しください。');
  }
  return error instanceof Error ? error : new Error('保存に失敗しました。既存データは変更していません。');
};

export const initJpReaderDB = async () => {
  await openDatabase();
  return true;
};

export const getAllJpMaterials = async (): Promise<StoredJpMaterial[]> => {
  const db = await openDatabase();
  const transaction = db.transaction(MATERIAL_STORE, 'readonly');
  const completion = transactionToPromise(transaction);
  const records = await requestToPromise(transaction.objectStore(MATERIAL_STORE).getAll()) as StoredJpMaterial[];
  await completion;
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

export const getJpMaterial = async (id: number): Promise<StoredJpMaterial> => {
  const db = await openDatabase();
  const transaction = db.transaction(MATERIAL_STORE, 'readonly');
  const completion = transactionToPromise(transaction);
  const record = await requestToPromise(transaction.objectStore(MATERIAL_STORE).get(id)) as StoredJpMaterial | undefined;
  await completion;
  if (!record) throw new Error('日本語教材が見つかりませんでした。');
  return record;
};

export const findJpMaterialsByTitle = async (title: string): Promise<StoredJpMaterial[]> => {
  const db = await openDatabase();
  const transaction = db.transaction(MATERIAL_STORE, 'readonly');
  const completion = transactionToPromise(transaction);
  const records = await requestToPromise(transaction.objectStore(MATERIAL_STORE).index('title').getAll(title)) as StoredJpMaterial[];
  await completion;
  return records;
};

const assertJapaneseReaderContent = (content: JapaneseReaderMaterialV1) => {
  const sentenceTexts = content.sentences.map(sentence => sentence.original.text.trim()).filter(Boolean);
  if (sentenceTexts.length === 0) throw new Error('日本語本文がありません。保存は行っていません。');

  const japaneseSentenceCount = sentenceTexts.filter(text => JAPANESE_SCRIPT_RE.test(text)).length;
  if (japaneseSentenceCount / sentenceTexts.length < 0.8) {
    throw new Error('日本語Reader用の本文として認識できませんでした。英語長文ではなく、日本語の本文を含む教材JSONを作成してください。保存は行っていません。');
  }

  const invalidAdapted = content.sentences.find(sentence => sentence.adapted?.text?.trim() && !JAPANESE_SCRIPT_RE.test(sentence.adapted.text));
  if (invalidAdapted) {
    throw new Error(`「${invalidAdapted.id}」のやさしい日本語版が日本語として認識できませんでした。保存は行っていません。`);
  }
};

export const saveJpMaterial = async (
  content: JapaneseReaderMaterialV1,
  options: { replaceId?: number; duplicateTitle?: boolean } = {},
): Promise<StoredJpMaterial> => {
  assertJapaneseReaderContent(content);
  const db = await openDatabase();
  const now = new Date().toISOString();
  const transaction = db.transaction(
    options.replaceId !== undefined ? [MATERIAL_STORE, PROGRESS_STORE, CARD_STORE] : MATERIAL_STORE,
    'readwrite',
  );
  const completion = transactionToPromise(transaction);
  const store = transaction.objectStore(MATERIAL_STORE);

  try {
    let createdAt = now;
    if (options.replaceId !== undefined) {
      const existing = await requestToPromise(store.get(options.replaceId)) as StoredJpMaterial | undefined;
      if (!existing) throw new Error('上書き対象の教材が見つかりませんでした。');
      createdAt = existing.createdAt;
    }
    const title = options.duplicateTitle ? `${content.title}（コピー）` : content.title;
    const savedContent = title === content.title ? content : { ...content, title };
    const recordWithoutId = {
      schemaVersion: savedContent.schemaVersion,
      title,
      targetLevel: savedContent.targetLevel,
      content: savedContent,
      createdAt,
      updatedAt: now,
    };
    const record = options.replaceId !== undefined
      ? { ...recordWithoutId, id: options.replaceId }
      : recordWithoutId;
    const id = await requestToPromise(store.put(record)) as number;
    if (options.replaceId !== undefined) {
      transaction.objectStore(PROGRESS_STORE).delete(id);
      const cardStore = transaction.objectStore(CARD_STORE);
      const cardKeys = await requestToPromise(cardStore.index('materialId').getAllKeys(id));
      cardKeys.forEach(key => cardStore.delete(key));
    }
    await completion;
    return { ...recordWithoutId, id };
  } catch (error) {
    try { transaction.abort(); } catch { /* The transaction may already be closed. */ }
    try { await completion; } catch { /* Consume the expected abort rejection. */ }
    throw formatJpStorageError(error);
  }
};

export const deleteJpMaterial = async (id: number) => {
  const db = await openDatabase();
  const transaction = db.transaction([MATERIAL_STORE, PROGRESS_STORE, CARD_STORE], 'readwrite');
  const completion = transactionToPromise(transaction);
  const materialStore = transaction.objectStore(MATERIAL_STORE);
  const progressStore = transaction.objectStore(PROGRESS_STORE);
  const cardStore = transaction.objectStore(CARD_STORE);
  materialStore.delete(id);
  progressStore.delete(id);
  const cardKeys = await requestToPromise(cardStore.index('materialId').getAllKeys(id));
  cardKeys.forEach(key => cardStore.delete(key));
  await completion;
};

export const getJpProgress = async (materialId: number): Promise<JpReaderProgress | null> => {
  const db = await openDatabase();
  const transaction = db.transaction(PROGRESS_STORE, 'readonly');
  const completion = transactionToPromise(transaction);
  const record = await requestToPromise(transaction.objectStore(PROGRESS_STORE).get(materialId)) as JpReaderProgress | undefined;
  await completion;
  return record || null;
};

export const saveJpProgress = async (progress: JpReaderProgress) => {
  const db = await openDatabase();
  const transaction = db.transaction(PROGRESS_STORE, 'readwrite');
  const completion = transactionToPromise(transaction);
  transaction.objectStore(PROGRESS_STORE).put({ ...progress, updatedAt: new Date().toISOString() });
  try {
    await completion;
  } catch (error) {
    throw formatJpStorageError(error);
  }
};

export const buildJpCardStorageKey = (
  materialId: number,
  sentenceId: string,
  segmentId: string,
  variant: JpTextVariant,
) => `${materialId}:${variant}:${sentenceId}:${segmentId}`;

export const getJpCardsForMaterial = async (materialId: number): Promise<StoredJpVocabularyCard[]> => {
  const db = await openDatabase();
  const transaction = db.transaction(CARD_STORE, 'readonly');
  const completion = transactionToPromise(transaction);
  const cards = await requestToPromise(transaction.objectStore(CARD_STORE).index('materialId').getAll(materialId)) as StoredJpVocabularyCard[];
  await completion;
  return cards;
};

export const registerJpVocabularyCard = async (
  materialId: number,
  seed: JpVocabularyCardSeed,
  variant: JpTextVariant,
) => {
  const db = await openDatabase();
  const transaction = db.transaction(CARD_STORE, 'readwrite');
  const completion = transactionToPromise(transaction);
  const storageKey = buildJpCardStorageKey(materialId, seed.sentenceId, seed.segmentId, variant);
  const card: StoredJpVocabularyCard = {
    ...seed,
    storageKey,
    materialId,
    variant,
    createdAt: new Date().toISOString(),
  };
  transaction.objectStore(CARD_STORE).put(card);
  try {
    await completion;
  } catch (error) {
    throw formatJpStorageError(error);
  }
  return card;
};

export const unregisterJpVocabularyCard = async (storageKey: string) => {
  const db = await openDatabase();
  const transaction = db.transaction(CARD_STORE, 'readwrite');
  const completion = transactionToPromise(transaction);
  transaction.objectStore(CARD_STORE).delete(storageKey);
  try {
    await completion;
  } catch (error) {
    throw formatJpStorageError(error);
  }
};