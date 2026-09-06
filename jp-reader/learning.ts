import type { JpGrammarNote, JpKnownLexeme, JpSegment } from './types';

export const getJpLexemeKey = (segment: JpSegment) => {
  const stable = segment.lexemeId?.trim() || segment.lemma?.trim() || segment.surface.trim();
  const reading = segment.reading?.trim();
  return `lexeme:${stable}${reading ? `:${reading}` : ''}`;
};

export const makeKnownLexeme = (segment: JpSegment, sourceMaterialId?: number): JpKnownLexeme => ({
  key: getJpLexemeKey(segment),
  surface: segment.surface,
  lemma: segment.lemma,
  reading: segment.reading,
  addedAt: new Date().toISOString(),
  sourceMaterialId,
});

export const buildGrammarStorageKey = (materialId: number, sentenceId: string, grammarId: string) =>
  `${materialId}:${sentenceId}:${grammarId}`;

export const makeGrammarNote = (input: Omit<JpGrammarNote, 'storageKey' | 'createdAt'>): JpGrammarNote => ({
  ...input,
  storageKey: buildGrammarStorageKey(input.materialId, input.sentenceId, input.grammarId),
  createdAt: new Date().toISOString(),
});
