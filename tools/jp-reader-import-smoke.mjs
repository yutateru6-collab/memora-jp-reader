import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createMaterialFromPlainJapanese,
  formatJpImportError,
  prepareJapaneseReaderImport,
} from '/tmp/memora-jp-import.mjs';

const fixtureText = fs.readFileSync('tools/fixtures/jp-reader-valid.json', 'utf8');
const fixture = JSON.parse(fixtureText);

const valid = prepareJapaneseReaderImport(fixtureText);
assert.equal(valid.material.schemaVersion, 'memora-jp-reader-v1');
assert.equal(valid.material.sentences.length, 2);
assert.equal(valid.material.visibility, 'private');
assert.equal(valid.material.publicShareAllowed, false);
assert.equal(valid.material.sentences[0].original.segments.map(segment => segment.surface).join(''), valid.material.sentences[0].original.text);
assert.equal(valid.material.sentences[1].original.segments.map(segment => segment.surface).join(''), valid.material.sentences[1].original.text);
assert.deepEqual(
  valid.material.vocabularyCards.map(card => [card.surface, card.reading, card.lexemeId]),
  [
    ['一日', 'いちにち', 'ichinichi-day'],
    ['一日', 'ついたち', 'tsuitachi-date'],
  ],
);
assert.equal(valid.material.sentences[1].adapted, null);
assert.match(valid.material.sentences[1].original.text, /😊/u);

const fenced = prepareJapaneseReaderImport(`\`\`\`json\n${fixtureText}\n\`\`\``);
assert.match(fenced.repairs.join('\n'), /コードフェンス/);

const trailing = prepareJapaneseReaderImport(fixtureText.replace(/\n}\s*$/, ',\n}'));
assert.match(trailing.repairs.join('\n'), /末尾/);

const smartQuoted = fixtureText.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, '“$1”');
const repairedQuotes = prepareJapaneseReaderImport(smartQuoted);
assert.equal(repairedQuotes.material.title, fixture.title);
assert.match(repairedQuotes.repairs.join('\n'), /引用符/);

const publicInput = structuredClone(fixture);
publicInput.visibility = 'public';
publicInput.publicShareAllowed = true;
const privatized = prepareJapaneseReaderImport(JSON.stringify(publicInput));
assert.equal(privatized.material.visibility, 'private');
assert.equal(privatized.material.publicShareAllowed, false);
assert.ok(privatized.repairs.length >= 2);

const expectImportFailure = (input, expected) => {
  let shown = '';
  try {
    prepareJapaneseReaderImport(typeof input === 'string' ? input : JSON.stringify(input));
  } catch (error) {
    shown = formatJpImportError(error);
  }
  assert.match(shown, expected);
};

const missingTitle = structuredClone(fixture);
delete missingTitle.title;
expectImportFailure(missingTitle, /titleがありません/);

const mismatch = structuredClone(fixture);
mismatch.sentences[0].original.text = '一致しない本文。';
expectImportFailure(mismatch, /segmentsの連結結果が一致しません/);

const emptyOriginal = structuredClone(fixture);
emptyOriginal.sentences[0].original = { text: '', segments: [] };
expectImportFailure(emptyOriginal, /original\.textが空です/);

const missingSegmentReference = structuredClone(fixture);
missingSegmentReference.vocabularyCards[0].segmentId = 'not-found';
expectImportFailure(missingSegmentReference, /対応する語がありません/);

const missingGrammarReference = structuredClone(fixture);
missingGrammarReference.sentences[0].grammar[0].segmentIds = ['not-found'];
expectImportFailure(missingGrammarReference, /grammar\[0\].*対応する語がありません/);

const unsafeUrl = structuredClone(fixture);
unsafeUrl.source.url = 'javascript:alert(1)';
expectImportFailure(unsafeUrl, /http:\/\/ または https:\/\//);

expectImportFailure('', /空です/);
expectImportFailure('{\n  "schemaVersion": "memora-jp-reader-v1",\n  broken\n}', /行.*列付近/);

assert.throws(
  () => createMaterialFromPlainJapanese({ text: '', targetLevel: 'N3' }),
  /日本語本文が空です/,
);

const oneSentence = createMaterialFromPlainJapanese({ text: '今日は晴れです。😊', targetLevel: 'N4' });
assert.equal(oneSentence.sentences.length, 1);
assert.equal(oneSentence.analysisStatus, 'unannotated');
assert.equal(oneSentence.sentences[0].original.segments.map(segment => segment.surface).join(''), '今日は晴れです。😊');

const longText = Array.from({ length: 2500 }, (_, index) => `第${index + 1}文です。`).join('');
const longMaterial = createMaterialFromPlainJapanese({ text: longText, title: '非常に長い文章', targetLevel: 'N2' });
assert.equal(longMaterial.sentences.length, 2500);
assert.equal(longMaterial.sentences.map(sentence => sentence.original.text).join(''), longText);

assert.throws(
  () => createMaterialFromPlainJapanese({ text: '安全です。', targetLevel: 'N3', sourceUrl: 'data:text/html,test' }),
  /元のURLを確認してください/,
);

console.log(JSON.stringify({
  status: 'passed',
  cases: [
    'valid JSON', 'code fence', 'trailing comma', 'smart quotes', 'private enforcement',
    'required field', 'segment mismatch', 'empty JSON sentence', 'broken card/grammar reference', 'unsafe URL', 'invalid JSON location',
    'empty text', 'single sentence', 'long text', 'emoji', 'same surface with different readings', 'adapted missing',
  ],
  sentences: valid.material.sentences.length,
  longSentenceCount: longMaterial.sentences.length,
}, null, 2));
