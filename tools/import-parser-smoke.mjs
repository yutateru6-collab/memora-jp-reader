import fs from 'node:fs';
import { prepareReadingMaterialImport } from '/tmp/memora-reading-import.mjs';

const raw = fs.readFileSync('tools/fixtures/chiikawa-user-material.txt', 'utf8');
const exact = prepareReadingMaterialImport(raw);
const parts = raw.split(/\n----------\n/);
const cards = JSON.parse(parts[1]);
cards.pop();
const tolerant = `\`\`\`markdown
${parts[0]}
——————————
${JSON.stringify(cards, null, 2).replace(/\n\]$/, ',\n]')}
----------
${parts[2]}
\`\`\``;
const repaired = prepareReadingMaterialImport(tolerant);
let rejected = '';
try {
  prepareReadingMaterialImport('【解説担当】\n名前：みお\n日本語だけ\n----------\n[]\n----------\n背景');
} catch (error) {
  rejected = error instanceof Error ? error.message : String(error);
}

console.log(JSON.stringify({
  exact: {
    sentences: exact.transcript.length,
    cards: exact.cards.length,
    name: exact.suggestedName,
    first: exact.transcript[0]?.english,
    last: exact.transcript.at(-1)?.english,
    background: exact.background.length,
    warnings: exact.warnings,
    repairs: exact.repairs,
  },
  tolerant: {
    sentences: repaired.transcript.length,
    cards: repaired.cards.length,
    warnings: repaired.warnings,
    repairs: repaired.repairs,
  },
  rejected,
}, null, 2));
