import {
  JP_READER_SCHEMA_VERSION,
  type JapaneseReaderMaterialV1,
  type JpAdaptedSentence,
  type JpGrammarPoint,
  type JpQuizQuestion,
  type JpRightsStatus,
  type JpSegment,
  type JpSentence,
  type JpSentenceText,
  type JpSourceMetadata,
  type JpTargetLevel,
  type JpTranslation,
  type JpVocabularyCardSeed,
} from './types';

export interface JpImportResult {
  material: JapaneseReaderMaterialV1;
  repairs: string[];
  warnings: string[];
  normalizedSource: string;
}

export class JpImportError extends Error {
  constructor(message: string, public readonly details: string[] = []) {
    super(message);
    this.name = 'JpImportError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const readStringArray = (value: unknown) => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
  : [];

const validateOptionalWebUrl = (value: unknown, path: string, errors: string[]) => {
  const rawUrl = readString(value);
  if (!rawUrl) return undefined;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported protocol');
    return parsed.toString();
  } catch {
    errors.push(`${path}は http:// または https:// で始まる正しいURLにしてください。`);
    return undefined;
  }
};

const stripWrappingCodeFence = (value: string, repairs: string[]) => {
  const lines = value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim().split('\n');
  if (lines.length >= 2 && /^\s*```(?:json)?\s*$/i.test(lines[0]) && /^\s*```\s*$/.test(lines[lines.length - 1])) {
    repairs.push('Markdownのコードフェンスを除去しました。');
    return lines.slice(1, -1).join('\n').trim();
  }
  return lines.join('\n').trim();
};

const previousSignificant = (value: string, index: number) => {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (!/\s/.test(value[cursor])) return value[cursor];
  }
  return '';
};

const nextSignificant = (value: string, index: number) => {
  for (let cursor = index + 1; cursor < value.length; cursor += 1) {
    if (!/\s/.test(value[cursor])) return value[cursor];
  }
  return '';
};

const repairStructuralQuotes = (value: string, repairs: string[]) => {
  let result = '';
  let inAsciiString = false;
  let inSmartString = false;
  let escaped = false;
  let changed = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inAsciiString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inAsciiString = false;
      continue;
    }

    if (inSmartString) {
      if ((character === '”' || character === '＂') && /[:,}\]]|^$/.test(nextSignificant(value, index))) {
        result += '"';
        inSmartString = false;
        changed = true;
      } else {
        result += character;
      }
      continue;
    }

    if (character === '"') {
      result += character;
      inAsciiString = true;
      continue;
    }
    if ((character === '“' || character === '＂') && /[\[{,:]|^$/.test(previousSignificant(value, index))) {
      result += '"';
      inSmartString = true;
      changed = true;
      continue;
    }
    result += character;
  }

  if (changed) repairs.push('JSONの区切りに使われた全角・スマート引用符を半角引用符へ修正しました。');
  return result;
};

const repairTrailingCommas = (value: string, repairs: string[]) => {
  let result = '';
  let inString = false;
  let escaped = false;
  let changed = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      result += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }
    if (character === ',' && /[}\]]/.test(nextSignificant(value, index))) {
      changed = true;
      continue;
    }
    result += character;
  }
  if (changed) repairs.push('オブジェクトまたは配列末尾の余分なカンマを除去しました。');
  return result;
};

const parseErrorLocation = (source: string, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const positionMatch = message.match(/position\s+(\d+)/i) || message.match(/column\s+(\d+)/i);
  if (!positionMatch) return message;
  const position = Number(positionMatch[1]);
  if (!Number.isFinite(position)) return message;
  const prefix = source.slice(0, position);
  const line = prefix.split('\n').length;
  const column = position - prefix.lastIndexOf('\n');
  return `${line}行${column}列付近: ${message}`;
};

const parseJsonWithSafeRepairs = (rawValue: string, repairs: string[]) => {
  let source = stripWrappingCodeFence(rawValue, repairs)
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .trim();
  if (!source) throw new JpImportError('教材データが空です。保存は行っていません。');

  try {
    return { parsed: JSON.parse(source) as unknown, source };
  } catch {
    source = repairStructuralQuotes(source, repairs);
    source = repairTrailingCommas(source, repairs);
    try {
      return { parsed: JSON.parse(source) as unknown, source };
    } catch (error) {
      throw new JpImportError('JSONを解析できませんでした。保存は行っていません。', [parseErrorLocation(source, error)]);
    }
  }
};

const validateLevel = (value: unknown, path: string, errors: string[]): JpTargetLevel => {
  if (value === 'N4' || value === 'N3' || value === 'N2') return value;
  errors.push(`${path}は N4・N3・N2 のいずれかにしてください。`);
  return 'N3';
};

const validateConfidence = (value: unknown, path: string, errors: string[]) => {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1) return value;
  errors.push(`${path}は0〜1の数値、またはnullにしてください。`);
  return null;
};

const validateSegment = (value: unknown, path: string, errors: string[]): JpSegment => {
  if (!isRecord(value)) {
    errors.push(`${path}はオブジェクトにしてください。`);
    return { id: `${path}-invalid`, surface: '' };
  }
  const id = readString(value.id);
  const surface = typeof value.surface === 'string' ? value.surface : '';
  if (!id) errors.push(`${path}.idがありません。`);
  if (typeof value.surface !== 'string') errors.push(`${path}.surfaceは文字列にしてください。`);
  else if (surface.length === 0) errors.push(`${path}.surfaceを空文字にはできません。`);
  const jlpt = readString(value.jlptEstimate);
  if (jlpt && !['N5', 'N4', 'N3', 'N2', 'N1', 'unknown'].includes(jlpt)) {
    errors.push(`${path}.jlptEstimateはN5〜N1またはunknownにしてください。`);
  }
  return {
    id: id || `${path}-missing-id`,
    lexemeId: readString(value.lexemeId) || undefined,
    surface,
    reading: readString(value.reading) || undefined,
    lemma: readString(value.lemma) || undefined,
    partOfSpeech: readString(value.partOfSpeech) || undefined,
    conjugation: readString(value.conjugation) || undefined,
    contextualGloss: readString(value.contextualGloss) || undefined,
    jlptEstimate: (jlpt as JpSegment['jlptEstimate']) || undefined,
    register: readString(value.register) || undefined,
    example: readString(value.example) || undefined,
  };
};

const validateSentenceText = (value: unknown, path: string, errors: string[]): JpSentenceText => {
  if (!isRecord(value)) {
    errors.push(`${path}がありません。`);
    return { text: '', segments: [] };
  }
  const text = typeof value.text === 'string' ? value.text : '';
  if (typeof value.text !== 'string') errors.push(`${path}.textは文字列にしてください。`);
  else if (!text.trim()) errors.push(`${path}.textが空です。`);
  if (!Array.isArray(value.segments)) errors.push(`${path}.segmentsは配列にしてください。`);
  const segments = Array.isArray(value.segments)
    ? value.segments.map((segment, index) => validateSegment(segment, `${path}.segments[${index}]`, errors))
    : [];
  const joined = segments.map(segment => segment.surface).join('');
  if (text !== joined) {
    const mismatchAt = Array.from(text).findIndex((character, index) => character !== Array.from(joined)[index]);
    errors.push(`${path}.textとsegmentsの連結結果が一致しません${mismatchAt >= 0 ? `（${mismatchAt + 1}文字目付近）` : ''}。`);
  }
  return { text, segments };
};

const validateTranslation = (value: unknown, path: string, errors: string[]): JpTranslation | null => {
  if (value === null) return null;
  if (!isRecord(value)) {
    errors.push(`${path}はオブジェクトまたはnullにしてください。`);
    return null;
  }
  const language = readString(value.language);
  const text = readString(value.text);
  if (!language) errors.push(`${path}.languageがありません。`);
  if (!text) errors.push(`${path}.textがありません。`);
  return { language, text };
};

const validateGrammar = (value: unknown, path: string, errors: string[]): JpGrammarPoint[] => {
  if (!Array.isArray(value)) {
    errors.push(`${path}は配列にしてください。`);
    return [];
  }
  return value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${itemPath}はオブジェクトにしてください。`);
      return { id: `${itemPath}-invalid`, pattern: '', explanation: '' };
    }
    const id = readString(item.id);
    const pattern = readString(item.pattern);
    const explanation = readString(item.explanation);
    if (!id) errors.push(`${itemPath}.idがありません。`);
    if (!pattern) errors.push(`${itemPath}.patternがありません。`);
    if (!explanation) errors.push(`${itemPath}.explanationがありません。`);
    return {
      id: id || `${itemPath}-missing-id`,
      pattern,
      meaning: readString(item.meaning) || undefined,
      explanation,
      segmentIds: readStringArray(item.segmentIds),
      register: readString(item.register) || undefined,
      example: readString(item.example) || undefined,
    };
  });
};

const validateSentence = (value: unknown, index: number, errors: string[]): JpSentence => {
  const path = `sentences[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${path}はオブジェクトにしてください。`);
    return {
      id: `${path}-invalid`, original: { text: '', segments: [] }, adapted: null, translation: null,
      grammar: [], omittedElements: [], nuanceNotes: [], cultureNote: null, adaptationReasons: [], confidence: null, warnings: [],
    };
  }
  const id = readString(value.id);
  if (!id) errors.push(`${path}.idがありません。`);
  const original = validateSentenceText(value.original, `${path}.original`, errors);
  let adapted: JpAdaptedSentence | null = null;
  if (value.adapted !== null && value.adapted !== undefined) {
    const adaptedText = validateSentenceText(value.adapted, `${path}.adapted`, errors);
    const isAiGenerated = isRecord(value.adapted) && typeof value.adapted.isAiGenerated === 'boolean'
      ? value.adapted.isAiGenerated
      : false;
    if (!isRecord(value.adapted) || typeof value.adapted.isAiGenerated !== 'boolean') {
      errors.push(`${path}.adapted.isAiGeneratedは真偽値にしてください。`);
    }
    adapted = { ...adaptedText, isAiGenerated };
  }
  if (!Array.isArray(value.grammar)) errors.push(`${path}.grammarがありません。`);
  if (!Array.isArray(value.omittedElements)) errors.push(`${path}.omittedElementsがありません。`);
  if (!Array.isArray(value.nuanceNotes)) errors.push(`${path}.nuanceNotesがありません。`);
  if (!Array.isArray(value.adaptationReasons)) errors.push(`${path}.adaptationReasonsがありません。`);
  if (!Array.isArray(value.warnings)) errors.push(`${path}.warningsがありません。`);
  if (!('translation' in value)) errors.push(`${path}.translationがありません。`);
  if (!('cultureNote' in value)) errors.push(`${path}.cultureNoteがありません。`);
  if (!('confidence' in value)) errors.push(`${path}.confidenceがありません。`);
  return {
    id: id || `${path}-missing-id`,
    original,
    adapted,
    translation: validateTranslation(value.translation, `${path}.translation`, errors),
    grammar: validateGrammar(value.grammar, `${path}.grammar`, errors),
    omittedElements: readStringArray(value.omittedElements),
    nuanceNotes: readStringArray(value.nuanceNotes),
    cultureNote: value.cultureNote === null ? null : readString(value.cultureNote) || null,
    adaptationReasons: readStringArray(value.adaptationReasons),
    confidence: validateConfidence(value.confidence, `${path}.confidence`, errors),
    warnings: readStringArray(value.warnings),
  };
};

const validateSource = (value: unknown, errors: string[]): JpSourceMetadata => {
  if (!isRecord(value)) {
    errors.push('sourceがありません。');
    return { type: 'json-import', rightsStatus: 'unknown', importedAt: new Date().toISOString() };
  }
  const rightsStatus = readString(value.rightsStatus);
  const allowedRights: JpRightsStatus[] = ['owned', 'licensed', 'public-domain', 'permission-granted', 'unknown'];
  if (!allowedRights.includes(rightsStatus as JpRightsStatus)) {
    errors.push('source.rightsStatusが正しくありません。');
  }
  const type = readString(value.type);
  if (!['user-paste', 'json-import', 'ai-generated', 'other'].includes(type)) {
    errors.push('source.typeが正しくありません。');
  }
  return {
    type: (type as JpSourceMetadata['type']) || 'json-import',
    title: readString(value.title) || undefined,
    author: readString(value.author) || undefined,
    publisher: readString(value.publisher) || undefined,
    url: validateOptionalWebUrl(value.url, 'source.url', errors),
    rightsStatus: allowedRights.includes(rightsStatus as JpRightsStatus) ? rightsStatus as JpRightsStatus : 'unknown',
    license: readString(value.license) || undefined,
    importedAt: readString(value.importedAt) || new Date().toISOString(),
  };
};

const validateVocabularyCards = (value: unknown, errors: string[]): JpVocabularyCardSeed[] => {
  if (!Array.isArray(value)) {
    errors.push('vocabularyCardsは配列にしてください。');
    return [];
  }
  return value.map((item, index) => {
    const path = `vocabularyCards[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${path}はオブジェクトにしてください。`);
      return { id: `${path}-invalid`, sentenceId: '', segmentId: '', surface: '', meaning: '' };
    }
    const card: JpVocabularyCardSeed = {
      id: readString(item.id),
      sentenceId: readString(item.sentenceId),
      segmentId: readString(item.segmentId),
      variant: item.variant === 'adapted' ? 'adapted' : 'original',
      lexemeId: readString(item.lexemeId) || undefined,
      surface: readString(item.surface),
      reading: readString(item.reading) || undefined,
      lemma: readString(item.lemma) || undefined,
      meaning: readString(item.meaning),
      example: readString(item.example) || undefined,
    };
    if (item.variant !== undefined && item.variant !== 'original' && item.variant !== 'adapted') {
      errors.push(`${path}.variantはoriginalまたはadaptedにしてください。`);
    }
    (['id', 'sentenceId', 'segmentId', 'surface', 'meaning'] as const).forEach(key => {
      if (!card[key]) errors.push(`${path}.${key}がありません。`);
    });
    return card;
  });
};

const validateReferences = (material: JapaneseReaderMaterialV1, errors: string[]) => {
  const sentenceIds = new Set<string>();
  material.sentences.forEach((sentence, sentenceIndex) => {
    if (sentenceIds.has(sentence.id)) errors.push(`sentences[${sentenceIndex}].id「${sentence.id}」が重複しています。`);
    sentenceIds.add(sentence.id);

    const allSegmentIds = new Set<string>();
    (['original', 'adapted'] as const).forEach(variant => {
      const text = sentence[variant];
      if (!text) return;
      const segmentIds = new Set<string>();
      text.segments.forEach((segment, segmentIndex) => {
        if (segmentIds.has(segment.id)) {
          errors.push(`sentences[${sentenceIndex}].${variant}.segments[${segmentIndex}].id「${segment.id}」が重複しています。`);
        }
        segmentIds.add(segment.id);
        allSegmentIds.add(segment.id);
      });
    });
    const grammarIds = new Set<string>();
    sentence.grammar.forEach((point, grammarIndex) => {
      if (grammarIds.has(point.id)) {
        errors.push(`sentences[${sentenceIndex}].grammar[${grammarIndex}].id「${point.id}」が重複しています。`);
      }
      grammarIds.add(point.id);
      point.segmentIds?.forEach(segmentId => {
        if (!allSegmentIds.has(segmentId)) {
          errors.push(`sentences[${sentenceIndex}].grammar[${grammarIndex}].segmentIdsの「${segmentId}」に対応する語がありません。`);
        }
      });
    });
  });

  const vocabularyCardIds = new Set<string>();
  material.vocabularyCards.forEach((card, cardIndex) => {
    if (vocabularyCardIds.has(card.id)) errors.push(`vocabularyCards[${cardIndex}].id「${card.id}」が重複しています。`);
    vocabularyCardIds.add(card.id);
    const sentence = material.sentences.find(item => item.id === card.sentenceId);
    if (!sentence) {
      errors.push(`vocabularyCards[${cardIndex}].sentenceId「${card.sentenceId}」に対応する文がありません。`);
      return;
    }
    const variant = card.variant || 'original';
    const text = sentence[variant];
    if (!text) {
      errors.push(`vocabularyCards[${cardIndex}]は存在しない${variant === 'adapted' ? '易しい日本語' : '原文'}を参照しています。`);
      return;
    }
    const segment = text.segments.find(item => item.id === card.segmentId);
    if (!segment) {
      errors.push(`vocabularyCards[${cardIndex}].segmentId「${card.segmentId}」に対応する語がありません。`);
      return;
    }
    if (segment.surface !== card.surface) {
      errors.push(`vocabularyCards[${cardIndex}].surfaceと参照先segmentsの表記が一致しません。`);
    }
  });

  const quizIds = new Set<string>();
  material.quiz.forEach((question, questionIndex) => {
    if (quizIds.has(question.id)) errors.push(`quiz[${questionIndex}].id「${question.id}」が重複しています。`);
    quizIds.add(question.id);
  });
};

const validateQuiz = (value: unknown, errors: string[]): JpQuizQuestion[] => {
  if (!Array.isArray(value)) {
    errors.push('quizは配列にしてください。');
    return [];
  }
  return value.map((item, index) => {
    const path = `quiz[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${path}はオブジェクトにしてください。`);
      return { id: `${path}-invalid`, question: '', choices: [], correctAnswerIndex: 0 };
    }
    const choices = readStringArray(item.choices);
    const correctAnswerIndex = Number(item.correctAnswerIndex);
    const question: JpQuizQuestion = {
      id: readString(item.id),
      question: readString(item.question),
      choices,
      correctAnswerIndex,
      explanation: readString(item.explanation) || undefined,
    };
    if (!question.id) errors.push(`${path}.idがありません。`);
    if (!question.question) errors.push(`${path}.questionがありません。`);
    if (choices.length < 2) errors.push(`${path}.choicesは2件以上必要です。`);
    if (!Number.isInteger(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex >= choices.length) {
      errors.push(`${path}.correctAnswerIndexが選択肢の範囲外です。`);
    }
    return question;
  });
};

const normalizeAndValidate = (value: unknown, repairs: string[]): JapaneseReaderMaterialV1 => {
  if (!isRecord(value)) throw new JpImportError('教材JSONの最上位はオブジェクトにしてください。');
  const errors: string[] = [];
  if (value.schemaVersion !== JP_READER_SCHEMA_VERSION) {
    errors.push(`schemaVersionは「${JP_READER_SCHEMA_VERSION}」にしてください。`);
  }
  if (value.mode !== 'jp-reader') errors.push('modeは「jp-reader」にしてください。');
  const title = readString(value.title);
  if (!title) errors.push('titleがありません。');
  if (!Array.isArray(value.sentences)) errors.push('sentencesは配列にしてください。');
  const sentences = Array.isArray(value.sentences)
    ? value.sentences.map((sentence, index) => validateSentence(sentence, index, errors))
    : [];
  if (sentences.length === 0) errors.push('sentencesには1文以上必要です。');
  if (!Array.isArray(value.warnings)) errors.push('warningsは配列にしてください。');
  if (!('confidence' in value)) errors.push('confidenceがありません。');
  if (!('visibility' in value)) errors.push('visibilityがありません。');
  if (!('publicShareAllowed' in value)) errors.push('publicShareAllowedがありません。');
  if (!('analysisStatus' in value)) errors.push('analysisStatusがありません。');
  const analysisStatus = value.analysisStatus;
  if (!['complete', 'partial', 'unannotated'].includes(String(analysisStatus))) {
    errors.push('analysisStatusはcomplete・partial・unannotatedのいずれかにしてください。');
  }
  if (errors.length > 0) {
    throw new JpImportError('日本語教材JSONの内容を確認してください。保存は行っていません。', errors);
  }

  const warnings = readStringArray(value.warnings);
  const source = validateSource(value.source, errors);
  if (source.rightsStatus === 'unknown' && value.publicShareAllowed !== false) {
    repairs.push('権利状態が不明なため、公開共有を無効にしました。');
  } else if (value.publicShareAllowed !== false) {
    repairs.push('初期版では本文共有を行わないため、公開共有を無効にしました。');
  }
  if (value.visibility !== 'private') repairs.push('取り込んだ教材を非公開に設定しました。');

  const material: JapaneseReaderMaterialV1 = {
    schemaVersion: JP_READER_SCHEMA_VERSION,
    mode: 'jp-reader',
    title,
    targetLevel: validateLevel(value.targetLevel, 'targetLevel', errors),
    source,
    visibility: 'private',
    publicShareAllowed: false,
    analysisStatus: analysisStatus as JapaneseReaderMaterialV1['analysisStatus'],
    sentences,
    vocabularyCards: validateVocabularyCards(value.vocabularyCards, errors),
    quiz: validateQuiz(value.quiz, errors),
    confidence: validateConfidence(value.confidence, 'confidence', errors),
    warnings,
  };
  validateReferences(material, errors);
  if (errors.length > 0) {
    throw new JpImportError('日本語教材JSONの内容を確認してください。保存は行っていません。', errors);
  }
  return material;
};

export const prepareJapaneseReaderImport = (rawValue: string): JpImportResult => {
  const repairs: string[] = [];
  const { parsed, source } = parseJsonWithSafeRepairs(rawValue, repairs);
  const material = normalizeAndValidate(parsed, repairs);
  const warnings = [...material.warnings];
  material.sentences.forEach((sentence, index) => {
    if (!sentence.adapted) warnings.push(`${index + 1}文目には易しい日本語版がありません。`);
    if (!sentence.translation) warnings.push(`${index + 1}文目には翻訳がありません。`);
    sentence.warnings.forEach(warning => warnings.push(`${index + 1}文目: ${warning}`));
  });
  return { material, repairs, warnings, normalizedSource: source };
};

const splitIntoSentences = (text: string) => {
  let parts: string[];
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'sentence' });
    parts = Array.from(segmenter.segment(text), part => part.segment).filter(Boolean);
  } else {
    parts = text.match(/[^。！？\n]+[。！？]?|\n+/g) || [text];
  }
  return parts.reduce<string[]>((sentences, part) => {
    const isStandaloneSymbol = !/[\p{L}\p{N}]/u.test(part);
    if (isStandaloneSymbol && sentences.length > 0) sentences[sentences.length - 1] += part;
    else sentences.push(part);
    return sentences;
  }, []);
};

const splitIntoSegments = (text: string, sentenceIndex: number): JpSegment[] => {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    return Array.from(segmenter.segment(text), (part, index) => ({
      id: `s${sentenceIndex + 1}-seg${index + 1}`,
      surface: part.segment,
    }));
  }
  return Array.from(text).map((surface, index) => ({ id: `s${sentenceIndex + 1}-seg${index + 1}`, surface }));
};

export const createMaterialFromPlainJapanese = (input: {
  text: string;
  title?: string;
  targetLevel: JpTargetLevel;
  sourceUrl?: string;
  rightsStatus?: JpRightsStatus;
}): JapaneseReaderMaterialV1 => {
  const text = input.text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!text) throw new JpImportError('日本語本文が空です。保存は行っていません。');
  const sentenceTexts = splitIntoSentences(text);
  const sentences: JpSentence[] = sentenceTexts.map((sentenceText, index) => ({
    id: `s${index + 1}`,
    original: { text: sentenceText, segments: splitIntoSegments(sentenceText, index) },
    adapted: null,
    translation: null,
    grammar: [],
    omittedElements: [],
    nuanceNotes: [],
    cultureNote: null,
    adaptationReasons: [],
    confidence: null,
    warnings: ['詳細な言語解析はまだありません。'],
  }));
  const firstSentence = sentenceTexts.find(sentence => sentence.trim()) || '日本語教材';
  const title = input.title?.trim() || `${Array.from(firstSentence.trim()).slice(0, 24).join('')}${Array.from(firstSentence.trim()).length > 24 ? '…' : ''}`;
  const urlErrors: string[] = [];
  const sourceUrl = validateOptionalWebUrl(input.sourceUrl, '元のURL', urlErrors);
  if (urlErrors.length > 0) throw new JpImportError('元のURLを確認してください。保存は行っていません。', urlErrors);
  return {
    schemaVersion: JP_READER_SCHEMA_VERSION,
    mode: 'jp-reader',
    title,
    targetLevel: input.targetLevel,
    source: {
      type: 'user-paste',
      url: sourceUrl,
      rightsStatus: input.rightsStatus || 'unknown',
      importedAt: new Date().toISOString(),
    },
    visibility: 'private',
    publicShareAllowed: false,
    analysisStatus: 'unannotated',
    sentences,
    vocabularyCards: [],
    quiz: [],
    confidence: null,
    warnings: ['本文だけを取り込みました。読み方・辞書形・文法・翻訳などは外部AIで作成した教材JSONを取り込むと利用できます。'],
  };
};

export const formatJpImportError = (error: unknown) => {
  if (error instanceof JpImportError) {
    const shown = error.details.slice(0, 8);
    const remaining = error.details.length - shown.length;
    return `${error.message}${shown.length ? `\n${shown.map((detail, index) => `${index + 1}. ${detail}`).join('\n')}` : ''}${remaining > 0 ? `\nほか${remaining}件の問題があります。` : ''}`;
  }
  return error instanceof Error ? error.message : '教材データを確認できませんでした。';
};
