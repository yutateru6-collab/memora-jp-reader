import assert from 'node:assert/strict';
import fs from 'node:fs';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { prepareJapaneseReaderImport } from '/tmp/memora-jp-import.mjs';
import {
  deleteJpMaterial,
  findJpMaterialsByTitle,
  formatJpStorageError,
  getAllJpMaterials,
  getJpCardsForMaterial,
  getJpMaterial,
  getJpProgress,
  initJpReaderDB,
  registerJpVocabularyCard,
  saveJpMaterial,
  saveJpProgress,
} from '/tmp/memora-jp-db.mjs';

globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

const request = indexedDB.open('AudioSyncReaderDB', 2);
await new Promise((resolve, reject) => {
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains('materials')) {
      request.result.createObjectStore('materials', { keyPath: 'id', autoIncrement: true });
    }
  };
  request.onsuccess = resolve;
  request.onerror = () => reject(request.error);
});
const englishDb = request.result;
await new Promise((resolve, reject) => {
  const transaction = englishDb.transaction('materials', 'readwrite');
  transaction.objectStore('materials').put({ id: 1, name: '英語教材（保護確認）' });
  transaction.oncomplete = resolve;
  transaction.onerror = () => reject(transaction.error);
});

await initJpReaderDB();
const source = fs.readFileSync('tools/fixtures/jp-reader-valid.json', 'utf8');
const material = prepareJapaneseReaderImport(source).material;
const saved = await saveJpMaterial(material);
assert.equal(saved.id, 1);
assert.equal((await getAllJpMaterials()).length, 1);
assert.equal((await getJpMaterial(saved.id)).content.sentences.length, 2);
assert.equal((await findJpMaterialsByTitle(material.title)).length, 1);

await saveJpProgress({
  materialId: saved.id,
  readerMode: 'study',
  textVariant: 'original',
  furiganaMode: 'outside-level',
  learnerLevel: 'N3',
  lastSentenceId: 's2',
  readingSeconds: 125,
  updatedAt: new Date().toISOString(),
});
assert.equal((await getJpProgress(saved.id))?.readingSeconds, 125);

const seed = material.vocabularyCards[0];
await registerJpVocabularyCard(saved.id, seed, 'original');
assert.equal((await getJpCardsForMaterial(saved.id)).length, 1);

const replacement = { ...material, title: '上書き後の教材名' };
await saveJpMaterial(replacement, { replaceId: saved.id });
assert.equal((await getAllJpMaterials()).length, 1);
assert.equal((await getJpMaterial(saved.id)).title, '上書き後の教材名');
assert.equal(await getJpProgress(saved.id), null);
assert.deepEqual(await getJpCardsForMaterial(saved.id), []);

const copied = await saveJpMaterial(material, { duplicateTitle: true });
assert.equal(copied.title, '一日の読み方（コピー）');
assert.equal((await getAllJpMaterials()).length, 2);

const quotaMessage = formatJpStorageError(new DOMException('quota', 'QuotaExceededError')).message;
assert.match(quotaMessage, /保存容量が不足/);
assert.match(quotaMessage, /既存データは変更していません/);

await saveJpProgress({
  materialId: saved.id,
  readerMode: 'read',
  textVariant: 'original',
  furiganaMode: 'none',
  learnerLevel: 'N2',
  readingSeconds: 5,
  updatedAt: new Date().toISOString(),
});
await registerJpVocabularyCard(saved.id, seed, 'original');
await deleteJpMaterial(saved.id);
assert.equal(await getJpProgress(saved.id), null);
assert.deepEqual(await getJpCardsForMaterial(saved.id), []);
assert.equal((await getAllJpMaterials()).length, 1);

const englishRecords = await new Promise((resolve, reject) => {
  const transaction = englishDb.transaction('materials', 'readonly');
  const getAllRequest = transaction.objectStore('materials').getAll();
  getAllRequest.onsuccess = () => resolve(getAllRequest.result);
  getAllRequest.onerror = () => reject(getAllRequest.error);
});
assert.deepEqual(englishRecords, [{ id: 1, name: '英語教材（保護確認）' }]);

console.log(JSON.stringify({
  status: 'passed',
  cases: [
    'separate English database', 'save', 'reload', 'title lookup', 'progress', 'exact segment card',
    'replace and clear stale learning data', 'save as copy', 'quota message', 'cascade delete', 'English record preserved',
  ],
}, null, 2));
