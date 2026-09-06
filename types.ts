

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptEntry {
  start: number;
  end: number;
  english: string;
  japanese?: string;
  explanation?: string;
  words: Word[];
}

export interface StoredFolder {
  id: number;
  name: string;
  createdAt: Date;
}

export interface QuizQuestion {
  question: string;
  choices: string[];
  correctAnswerIndex: number;
  explanation?: string;
  explanationCorrect?: string;
  explanationIncorrect?: string;
}

export interface InlineNote {
  id: string;
  text: string;
  color?: string; // e.g. 'yellow', 'red', 'blue'
  createdAt: Date;
  
  // For English (Word-based)
  startGlobalIndex?: number;
  endGlobalIndex?: number;

  // For Japanese / Explanation (Character-based)
  target?: 'english' | 'japanese' | 'explanation';
  sentenceIndex?: number;
  characterRange?: {
    start: number;
    end: number;
  };
}

// SRS (Spaced Repetition System) State
export interface SRSState {
  interval: number;      // Interval in days
  repetition: number;    // Number of consecutive correct answers
  efactor: number;       // Easiness factor (start at 2.5)
  dueDate: number;       // Due date timestamp
}

export interface StoredMaterial {
  id: number;
  name: string;
  createdAt: Date;
  thumbnail?: string;
  duration?: number;
  folderId?: number;
  hasBgm?: boolean;
  hasWordFile?: boolean;
  hasTextFile?: boolean;
  hasQuizFile?: boolean;
  hasAnnotationFile?: boolean;
  quizBookmarks?: number[];
  globalMemo?: string;
  inlineNotes?: InlineNote[];
  // Map of card index -> SRS State
  cardStats?: Record<number, SRSState>;
}

export interface StoredMaterialWithFiles {
  id: number;
  name: string;
  mediaFile: File;
  textFile: File;
  createdAt: Date;
  thumbnail?: string;
  duration?: number;
  folderId?: number;
  bgmFile?: File;
  wordFile?: File;
  quizFile?: File;
  annotationFile?: File;
  quizBookmarks?: number[];
  globalMemo?: string;
  inlineNotes?: InlineNote[];
  cardStats?: Record<number, SRSState>;
}

export interface Card {
  id: string | number;
  front: string;
  back: string;
  pronunciation?: string;
  memo?: string;
  // Optional runtime SRS state
  srsState?: SRSState;
  // Optional reference to source material (used for aggregated review sessions)
  sourceMaterialId?: number;
}

// Bulletin Board Types
export interface BoardKeyword {
  word: string;
  meaning: string;
}

export interface BoardPost {
  id: number;
  name: string;
  date: string;
  uid: string;
  jp: string;
  en: string;
  anchor?: number | null;
  // New fields for enhanced learning
  en_bad?: string;      // Literal/Bad translation for comparison
  nuance_tip?: string;  // Legacy: Explanation of nuance (Why?)
  explanation?: string; // New: Detailed explanation including syntax, grammar, vocab, etc.
  keywords?: BoardKeyword[]; // Keywords for tooltip and saving
}

export interface BoardThread {
  title: string;
  blog_title?: string; // Dynamic blog title (e.g., "Full-bokko News")
  theme_color?: string; // Hex code for header/accent
  background_color?: string; // Hex code for background
  posts: BoardPost[];
  related_threads?: { title: string; title_en?: string; url: string; }[]; // New: Fake related threads with English title
}

// Amazon Mode Types
export interface AmazonReview {
  id: number;
  author: string;
  rating: number;
  title: string;
  date: string;
  en: string;
  jp: string;
  explanation: string;
  verified_purchase?: boolean;
  keywords?: BoardKeyword[]; // Added for popup dictionary
}

export interface AmazonProduct {
  title: string;
  title_jp?: string; // Japanese Title
  price: string;
  rating: number;
  rating_count: number;
  features: string[];
  features_jp?: string[]; // Japanese Features
  description: string;
  description_jp?: string; // Japanese Description
}

export interface AmazonRelatedItem {
    name: string;
    meaning: string;
}

export interface AmazonData {
  mode: 'amazon';
  theme_color?: string;
  product: AmazonProduct;
  reviews: AmazonReview[];
  frequently_bought_together?: AmazonRelatedItem[];
}

// Legend Mode Types (Beginner Reader)
export interface LegendItem {
  jp_mixed: string; // Level 1: ルー語
  en_mixed: string; // Level 2: ちゃんぽん
  en_full: string;  // Level 3: 英語
  character_comment?: string; // Legacy support
  comment_1?: string; // Lv1 Comment
  comment_2?: string; // Lv2 Comment
  comment_3?: string; // Lv3 Comment
  character_name: string;
}

export interface LegendData {
  mode: 'legend';
  title: string;
  content: LegendItem[];
}

// SNS / X Style Types
export interface SnsAuthorInfo {
  bio: string;
  bio_en?: string; // Added: English translation of bio
  location?: string;
  website?: string;
  born?: string;
  joined?: string;
  following: string;
  followers: string;
}

export interface SnsPost {
  id?: number;
  author_name: string;
  handle: string;
  is_verified: boolean;
  avatar_emoji: string;
  timestamp: string;
  jp_content: string;
  en_content: string;
  explanation: string;
  author_info?: SnsAuthorInfo; // Added for main post profile
  stats?: {
    replies: string;
    reposts: string;
    likes: string;
    views: string;
  };
  keywords?: BoardKeyword[];
}

export interface SnsThreadData {
  mode: 'x_thread';
  theme_color?: string;
  main_post: SnsPost;
  replies: SnsPost[];
}