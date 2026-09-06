import { Card, TranscriptEntry } from '../types';

const JAPANESE_RE = /[ぁ-んァ-ン一-龯]/;
const ENGLISH_RE = /[A-Za-z]/;
const CANONICAL_SEPARATOR = '----------';
const EXPLANATION_PREFIX_RE = /^[\[［【]\s*解説\s*[\]］】]\s*/;

type ImportCard = Omit<Card, 'id' | 'srsState' | 'sourceMaterialId'>;

export interface PreparedReadingMaterial {
  transcript: TranscriptEntry[];
  cards: ImportCard[];
  background: string;
  normalizedSource: string;
  suggestedName: string;
  warnings: string[];
  repairs: string[];
}

const stripStructuralMarkdown = (line: string) => line
  .trim()
  .replace(/^#{1,6}\s*/, '')
  .replace(/^[-*+]\s+/, '')
  .replace(/\*\*/g, '')
  .replace(/__/g, '')
  .replace(/^`+|`+$/g, '')
  .trim();

const isSeparatorLine = (line: string) => /^\s*[-‐‑‒–—−ー]{8,}\s*$/.test(line);

export const normalizeReadingMaterialSource = (rawValue: string) => {
  const repairs: string[] = [];
  let value = rawValue
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\r\n?/g, '\n');

  const originalLines = value.split('\n');
  const withoutFences = originalLines.filter((line) => !/^\s*```(?:markdown|text|json)?\s*$/i.test(line));
  if (withoutFences.length !== originalLines.length) {
    repairs.push('Markdownのコードフェンスを自動で除去しました。');
  }

  let normalizedSeparator = false;
  value = withoutFences.map((line) => {
    if (!isSeparatorLine(line)) return line.replace(/[ \t]+$/g, '');
    if (line.trim() !== CANONICAL_SEPARATOR) normalizedSeparator = true;
    return CANONICAL_SEPARATOR;
  }).join('\n').trim();

  if (normalizedSeparator) {
    repairs.push('区切り線の記号・長さを「----------」へ自動修正しました。');
  }

  return { value, repairs };
};

const splitMaterialSections = (source: string, warnings: string[]) => {
  const lines = source.split('\n');
  const separators = lines
    .map((line, index) => line.trim() === CANONICAL_SEPARATOR ? index : -1)
    .filter((index) => index >= 0);

  if (separators.length === 0) {
    warnings.push('区切り線がないため、貼り付け全体を本文として取り込みました。');
    return { transcriptText: source, wordText: '', backgroundText: '' };
  }

  const first = separators[0];
  const second = separators[1];
  if (second === undefined) {
    warnings.push('区切り線が1本だけでした。背景知識なしで取り込みました。');
    return {
      transcriptText: lines.slice(0, first).join('\n'),
      wordText: lines.slice(first + 1).join('\n'),
      backgroundText: '',
    };
  }

  if (separators.length > 2) {
    warnings.push('区切り線が3本以上ありました。3本目以降は背景知識の一部として保持しました。');
  }

  return {
    transcriptText: lines.slice(0, first).join('\n'),
    wordText: lines.slice(first + 1, second).join('\n'),
    backgroundText: lines.slice(second + 1).join('\n').trim(),
  };
};

const normalizeTranscriptEntry = (entry: Partial<TranscriptEntry>, index: number): TranscriptEntry | null => {
  const english = typeof entry.english === 'string' ? entry.english.trim() : '';
  if (!english || !ENGLISH_RE.test(english)) return null;
  return {
    start: Number.isFinite(entry.start) ? Number(entry.start) : index * 10,
    end: Number.isFinite(entry.end) ? Number(entry.end) : index * 10 + 5,
    english,
    japanese: typeof entry.japanese === 'string' ? entry.japanese.trim() : '',
    explanation: typeof entry.explanation === 'string' ? entry.explanation.trim() : '',
    words: Array.isArray(entry.words) && entry.words.length > 0
      ? entry.words
      : english.split(/\s+/).filter(Boolean).map((word) => ({ word, start: 0, end: 0 })),
  };
};

export const parseReadingTranscript = (rawText: string, warnings: string[] = []): TranscriptEntry[] => {
  const text = rawText.trim();
  if (!text) return [];

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        const entries = parsed
          .map((entry, index) => normalizeTranscriptEntry(entry, index))
          .filter((entry): entry is TranscriptEntry => entry !== null);
        if (entries.length > 0) return entries;
      }
    } catch {
      // Continue with the forgiving line parser.
    }
  }

  const lines = text.split('\n').map(stripStructuralMarkdown).filter(Boolean);
  const contentLines: string[] = [];
  const profileLines: string[] = [];
  let readingProfile = false;
  let contentStarted = false;

  for (const line of lines) {
    const isProfileHeader = /^【(?:解説担当|解説者プロフィール)[^】]*】/.test(line);
    const isProfileField = /^(?:\d+[.)]\s*)?(?:名前|役割|性格|職業|キャラ(?:クター)?|Name|Role|Trait)\s*[:：]/i.test(line);
    const looksLikeEnglish = ENGLISH_RE.test(line)
      && !JAPANESE_RE.test(line)
      && !EXPLANATION_PREFIX_RE.test(line)
      && !isProfileField;

    if (!contentStarted && (isProfileHeader || isProfileField)) {
      readingProfile = true;
      profileLines.push(line);
      continue;
    }
    if (readingProfile && !looksLikeEnglish) {
      profileLines.push(line);
      continue;
    }
    if (looksLikeEnglish) contentStarted = true;
    readingProfile = false;
    contentLines.push(line);
  }

  const entries: TranscriptEntry[] = [];
  for (const line of contentLines) {
    if (EXPLANATION_PREFIX_RE.test(line)) {
      if (entries.length === 0) {
        warnings.push('先頭の解説行は対応する英文がないため読み飛ばしました。');
        continue;
      }
      const explanation = line.replace(EXPLANATION_PREFIX_RE, '').trim();
      const current = entries[entries.length - 1];
      current.explanation = current.explanation ? `${current.explanation}\n${explanation}` : explanation;
      continue;
    }

    const hasJapanese = JAPANESE_RE.test(line);
    if (!hasJapanese && ENGLISH_RE.test(line)) {
      const entry = normalizeTranscriptEntry({ english: line }, entries.length);
      if (entry) entries.push(entry);
      continue;
    }

    if (hasJapanese && entries.length > 0) {
      const current = entries[entries.length - 1];
      if (!current.japanese || /^[(［\[]?(?:その日本語訳|英文の第[0-9一二三四五六七八九十]+文)[)］\]]?$/.test(current.japanese)) {
        current.japanese = line;
      } else {
        current.explanation = current.explanation ? `${current.explanation}\n${line}` : line;
      }
    }
  }

  if (profileLines.length > 0 && entries.length > 0) {
    const existing = entries[0].explanation || '';
    entries[0].explanation = `__PERSONA_PROFILE__${profileLines.join('\n')}\n__END_PERSONA__${existing}`;
  }

  return entries;
};

const repairJsonText = (rawValue: string, repairs: string[]) => {
  let value = rawValue.trim();
  const quoteRepaired = value.replace(/[“”]/g, '"');
  if (quoteRepaired !== value) {
    value = quoteRepaired;
    repairs.push('単語JSONのスマート引用符を半角引用符へ自動修正しました。');
  }

  const commaRepaired = value.replace(/,\s*([}\]])/g, '$1');
  if (commaRepaired !== value) {
    value = commaRepaired;
    repairs.push('単語JSONの末尾の余分なカンマを自動修正しました。');
  }
  return value;
};

export const parseImportCards = (
  rawValue: string,
  warnings: string[] = [],
  repairs: string[] = [],
): ImportCard[] => {
  if (!rawValue.trim()) return [];
  const repairedText = repairJsonText(rawValue, repairs);
  let parsed: unknown;
  try {
    parsed = JSON.parse(repairedText);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`単語カードJSONを解析できませんでした（${detail}）。本文はまだ保存していません。貼り付け内容を直して再度お試しください。`);
  }

  const source = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { cards?: unknown }).cards)
      ? (parsed as { cards: unknown[] }).cards
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { words?: unknown }).words)
        ? (parsed as { words: unknown[] }).words
        : null;

  if (!source) {
    throw new Error('単語カード部分はJSON配列、または cards / words 配列を持つJSONにしてください。本文はまだ保存していません。');
  }

  const cards: ImportCard[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  source.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      skipped += 1;
      return;
    }
    const record = item as Record<string, unknown>;
    const frontValue = record.front ?? record.word;
    const backValue = record.back ?? record.meaning;
    const front = typeof frontValue === 'string' ? frontValue.trim() : '';
    const back = typeof backValue === 'string' ? backValue.trim() : '';
    if (!front || !back) {
      skipped += 1;
      return;
    }
    const key = front.toLocaleLowerCase('en-US');
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    cards.push({
      front,
      back,
      pronunciation: typeof record.pronunciation === 'string' ? record.pronunciation.trim() : undefined,
      memo: typeof record.memo === 'string' ? record.memo.trim() : undefined,
    });
  });

  if (skipped > 0) warnings.push(`front/backが不足した単語カード ${skipped} 件を読み飛ばしました。`);
  if (duplicates > 0) warnings.push(`重複した単語カード ${duplicates} 件を1件にまとめました。`);
  if (source.length > 0 && cards.length === 0) {
    throw new Error('有効な単語カードが1件もありません。front と back を確認してください。本文はまだ保存していません。');
  }
  if (cards.length !== 30) {
    warnings.push(`単語カードは ${cards.length} 件です。30件でなくても取り込めます。`);
  }
  return cards;
};

const deriveName = (english: string) => {
  const compact = english.replace(/\s+/g, ' ').trim();
  if (compact.length <= 56) return compact;
  const sliced = compact.slice(0, 56);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${(lastSpace >= 34 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
};

export const prepareReadingMaterialImport = (rawValue: string): PreparedReadingMaterial => {
  const warnings: string[] = [];
  const normalized = normalizeReadingMaterialSource(rawValue);
  if (!normalized.value) {
    throw new Error('教材データが空です。本文は保存していません。');
  }

  const sections = splitMaterialSections(normalized.value, warnings);
  const transcript = parseReadingTranscript(sections.transcriptText, warnings)
    .filter((entry) => entry.english.trim().length > 0);
  if (transcript.length === 0) {
    throw new Error('英文を1文も認識できませんでした。本文は保存していません。貼り付け先と英文の内容を確認してください。');
  }

  const missingJapanese = transcript.filter((entry) => !entry.japanese?.trim()).length;
  const missingExplanation = transcript.filter((entry) => !entry.explanation?.replace(/__PERSONA_PROFILE__[\s\S]*?__END_PERSONA__/, '').trim()).length;
  if (missingJapanese > 0) warnings.push(`日本語訳がない英文が ${missingJapanese} 文あります。`);
  if (missingExplanation > 0) warnings.push(`解説がない英文が ${missingExplanation} 文あります。`);

  const cards = parseImportCards(sections.wordText, warnings, normalized.repairs);
  if (sections.backgroundText) {
    const existing = transcript[0].explanation || '';
    transcript[0].explanation = `${existing}__BACKGROUND_INFO__${sections.backgroundText}__END_BACKGROUND__`;
  } else {
    warnings.push('背景知識はありません。本文はそのまま取り込みました。');
  }

  return {
    transcript,
    cards,
    background: sections.backgroundText,
    normalizedSource: normalized.value,
    suggestedName: deriveName(transcript[0].english),
    warnings,
    repairs: normalized.repairs,
  };
};
