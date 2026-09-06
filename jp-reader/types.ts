import type { SRSState } from '../types';

export const JP_READER_SCHEMA_VERSION = 'memora-jp-reader-v1' as const;

export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export type JpTargetLevel = 'N4' | 'N3' | 'N2';
export type JpVisibility = 'private';
export type JpRightsStatus = 'owned' | 'licensed' | 'public-domain' | 'permission-granted' | 'unknown';
export type JpTextVariant = 'original' | 'adapted';
export type JpReaderMode = 'read' | 'study' | 'reread';
export type FuriganaMode = 'all' | 'outside-level' | 'personalized' | 'none';

export interface JpSourceMetadata {
  type: 'user-paste' | 'json-import' | 'ai-generated' | 'other';
  title?: string;
  author?: string;
  publisher?: string;
  url?: string;
  rightsStatus: JpRightsStatus;
  license?: string;
  importedAt: string;
}

export interface JpSegment {
  id: string;
  lexemeId?: string;
  surface: string;
  reading?: string;
  lemma?: string;
  partOfSpeech?: string;
  conjugation?: string;
  contextualGloss?: string;
  jlptEstimate?: JlptLevel | 'unknown';
  register?: string;
  example?: string;
}

export interface JpSentenceText {
  text: string;
  segments: JpSegment[];
}

export interface JpAdaptedSentence extends JpSentenceText {
  isAiGenerated: boolean;
}

export interface JpTranslation {
  language: string;
  text: string;
}

export interface JpGrammarPoint {
  id: string;
  pattern: string;
  meaning?: string;
  explanation: string;
  segmentIds?: string[];
  register?: string;
  example?: string;
}

export interface JpSentence {
  id: string;
  original: JpSentenceText;
  adapted: JpAdaptedSentence | null;
  translation: JpTranslation | null;
  grammar: JpGrammarPoint[];
  omittedElements: string[];
  nuanceNotes: string[];
  cultureNote: string | null;
  adaptationReasons: string[];
  confidence: number | null;
  warnings: string[];
}

export interface JpVocabularyCardSeed {
  id: string;
  sentenceId: string;
  segmentId: string;
  variant?: JpTextVariant;
  lexemeId?: string;
  surface: string;
  reading?: string;
  lemma?: string;
  meaning: string;
  example?: string;
}

export interface JpQuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correctAnswerIndex: number;
  explanation?: string;
}

export interface JapaneseReaderMaterialV1 {
  schemaVersion: typeof JP_READER_SCHEMA_VERSION;
  mode: 'jp-reader';
  title: string;
  targetLevel: JpTargetLevel;
  source: JpSourceMetadata;
  visibility: JpVisibility;
  publicShareAllowed: false;
  analysisStatus: 'complete' | 'partial' | 'unannotated';
  sentences: JpSentence[];
  vocabularyCards: JpVocabularyCardSeed[];
  quiz: JpQuizQuestion[];
  confidence: number | null;
  warnings: string[];
}

export interface StoredJpMaterial {
  id: number;
  schemaVersion: typeof JP_READER_SCHEMA_VERSION;
  title: string;
  targetLevel: JpTargetLevel;
  content: JapaneseReaderMaterialV1;
  createdAt: string;
  updatedAt: string;
}

export interface JpReaderProgress {
  materialId: number;
  readerMode: JpReaderMode;
  textVariant: JpTextVariant;
  furiganaMode: FuriganaMode;
  learnerLevel: JpTargetLevel;
  lastSentenceId?: string;
  readingSeconds: number;
  updatedAt: string;
}

export interface StoredJpVocabularyCard extends JpVocabularyCardSeed {
  storageKey: string;
  materialId: number;
  variant: JpTextVariant;
  createdAt: string;
  srsState?: SRSState;
}

export interface JpKnownLexeme {
  key: string;
  surface: string;
  lemma?: string;
  reading?: string;
  addedAt: string;
  sourceMaterialId?: number;
}

export interface JpGrammarNote {
  storageKey: string;
  materialId: number;
  materialTitle: string;
  sentenceId: string;
  grammarId: string;
  pattern: string;
  meaning?: string;
  explanation: string;
  example?: string;
  createdAt: string;
}
