

import React, { useState, useCallback, useEffect, useRef } from 'react';
import UploadScreen from './components/UploadScreen';
import ReaderScreen from './components/ReaderScreen';
import DeckListScreen from './components/DeckListScreen';
import FlashcardScreen from './components/FlashcardScreen';
import { CardListScreen } from './components/CardListScreen';
import DeckEditScreen from './components/DeckEditScreen';
import GameScreen from './components/GameScreen';
import QuizScreen from './components/QuizScreen';
import BoardScreen from './components/BoardScreen';
import AmazonScreen from './components/AmazonScreen';
import { SnsScreen } from './components/SnsScreen'; // Import SnsScreen
import { PromptLibraryScreen, PromptPersonaSelection } from './components/PromptLibraryScreen';
import CreateHomeScreen from './components/CreateHomeScreen';
import { LegendScreen } from './components/LegendScreen';
import { TranscriptEntry, Word, StoredMaterial, StoredFolder, Card, QuizQuestion, InlineNote, SRSState, BoardThread, AmazonData, LegendData, SnsThreadData } from './types';
import type { StoredJpMaterial } from './jp-reader/types';
import { initDB, saveMaterial, getAllMaterials, getMaterialById, deleteMaterial, updateMaterial, addFolder, getAllFolders, updateFolder, deleteFolderAndReassign } from './lib/db';
import { parseImportCards, prepareReadingMaterialImport } from './lib/readingMaterialImport';

const JapaneseLibraryScreen = React.lazy(() => import('./jp-reader/JapaneseLibraryScreen'));
const JapaneseReaderScreen = React.lazy(() => import('./jp-reader/JapaneseReaderScreen'));

type View = 'create' | 'upload' | 'reader' | 'jpLibrary' | 'jpReader' | 'deckList' | 'flashcard' | 'cardList' | 'editDeck' | 'game' | 'promptLibrary' | 'quiz' | 'board' | 'amazon' | 'legend' | 'sns';

const memoraRoleByView: Record<View, 'create' | 'read' | 'memorize' | 'quiz' | 'play' | 'organize' | 'explore'> = {
  create: 'create',
  upload: 'read',
  reader: 'read',
  jpLibrary: 'read',
  jpReader: 'read',
  deckList: 'memorize',
  flashcard: 'memorize',
  cardList: 'organize',
  editDeck: 'organize',
  game: 'play',
  promptLibrary: 'explore',
  quiz: 'quiz',
  board: 'explore',
  amazon: 'explore',
  legend: 'explore',
  sns: 'explore',
};

export interface Theme {
  name: string;
  bg: string;
  panelBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentBg: string;
  accentBgHover: string;
  button: string;
  buttonStrong: string;
  highlightBg: string;
  border: string;
  containerBg: string;
  ring: string;
  ringOffset: string;
}

export type Themes = Record<string, Theme>;

const themes: Themes = {
  dark: {
    name: 'ダーク',
    bg: 'bg-slate-900',
    panelBg: 'bg-slate-900/90',
    textPrimary: 'text-white',
    textSecondary: 'text-slate-200',
    textMuted: 'text-slate-400',
    accent: 'accent-sky-500',
    accentBg: 'bg-sky-600',
    accentBgHover: 'hover:bg-sky-500',
    button: 'bg-slate-700 hover:bg-slate-600 text-white',
    buttonStrong: 'bg-slate-600 hover:bg-slate-500 text-white',
    highlightBg: 'bg-sky-900/30',
    border: 'border-slate-700',
    containerBg: 'bg-slate-800',
    ring: 'focus:ring-sky-500',
    ringOffset: 'focus:ring-offset-slate-900',
  },
  forest: {
    name: 'フォレスト',
    bg: 'bg-green-900',
    panelBg: 'bg-green-900/90',
    textPrimary: 'text-green-50',
    textSecondary: 'text-green-100',
    textMuted: 'text-green-300',
    accent: 'accent-emerald-500',
    accentBg: 'bg-emerald-600',
    accentBgHover: 'hover:bg-emerald-500',
    button: 'bg-green-800 hover:bg-green-700 text-green-50',
    buttonStrong: 'bg-green-700 hover:bg-green-600 text-white',
    highlightBg: 'bg-emerald-900/30',
    border: 'border-green-700',
    containerBg: 'bg-green-800',
    ring: 'focus:ring-emerald-500',
    ringOffset: 'focus:ring-offset-green-900',
  },
   ocean: {
    name: 'オーシャン',
    bg: 'bg-cyan-950',
    panelBg: 'bg-cyan-950/90',
    textPrimary: 'text-cyan-50',
    textSecondary: 'text-cyan-100',
    textMuted: 'text-cyan-300',
    accent: 'accent-cyan-500',
    accentBg: 'bg-cyan-600',
    accentBgHover: 'hover:bg-cyan-500',
    button: 'bg-cyan-900 hover:bg-cyan-800 text-cyan-50',
    buttonStrong: 'bg-cyan-800 hover:bg-cyan-700 text-white',
    highlightBg: 'bg-cyan-900/30',
    border: 'border-cyan-800',
    containerBg: 'bg-cyan-900',
    ring: 'focus:ring-cyan-500',
    ringOffset: 'focus:ring-offset-cyan-950',
  },
  light: {
    name: 'ライト',
    bg: 'bg-gray-50',
    panelBg: 'bg-white/90',
    textPrimary: 'text-gray-900',
    textSecondary: 'text-gray-700',
    textMuted: 'text-gray-500',
    accent: 'accent-blue-500',
    accentBg: 'bg-blue-600',
    accentBgHover: 'hover:bg-blue-500',
    button: 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-700',
    buttonStrong: 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300',
    highlightBg: 'bg-blue-50',
    border: 'border-gray-200',
    containerBg: 'bg-white border border-gray-200 shadow-sm',
    ring: 'focus:ring-blue-500',
    ringOffset: 'focus:ring-offset-white',
  },
};

const App: React.FC = () => {
  const [view, setView] = useState<View>('create');
  const [openPasteJsonMode, setOpenPasteJsonMode] = useState(false);
  const [pendingPromptPersonas, setPendingPromptPersonas] = useState<PromptPersonaSelection[] | null>(null);
  const [pendingReadonStrictValidation, setPendingReadonStrictValidation] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [readerCards, setReaderCards] = useState<Card[]>([]); // Cards specifically loaded for Reader
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [materialName, setMaterialName] = useState('');
  const [storedMaterials, setStoredMaterials] = useState<StoredMaterial[]>([]);
  const [storedFolders, setStoredFolders] = useState<StoredFolder[]>([]);
  const [currentMaterial, setCurrentMaterial] = useState<StoredMaterial | null>(null);
  const [currentJpMaterial, setCurrentJpMaterial] = useState<StoredJpMaterial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [themeName, setThemeName] = useState<string>('dark');
  const [personaProfile, setPersonaProfile] = useState<string | null>(null);
  const [backgroundInfo, setBackgroundInfo] = useState<string | null>(null);
  const [bgmFile, setBgmFile] = useState<File | undefined>(undefined);
  const [annotationFile, setAnnotationFile] = useState<File | undefined>(undefined);
  const [hasWordFile, setHasWordFile] = useState(false);
  const [hasQuizFile, setHasQuizFile] = useState(false);
  const [boardData, setBoardData] = useState<BoardThread | null>(null);
  const [amazonData, setAmazonData] = useState<AmazonData | null>(null);
  const [legendData, setLegendData] = useState<LegendData | null>(null);
  const [snsData, setSnsData] = useState<SnsThreadData | null>(null);

  // Computed SRS stats
  const [dueCardCount, setDueCardCount] = useState(0);

  const T = themes[themeName] || themes.dark;

  useEffect(() => {
    initDB().then(success => {
      if (success) {
        loadStoredData();
      } else {
        setError("データベースの初期化に失敗しました。");
      }
    });
  }, []);

  useEffect(() => {
    document.body.className = T.bg;
  }, [T]);

  const loadStoredData = async () => {
      try {
          const materials = await getAllMaterials();
          setStoredMaterials(materials);
          const folders = await getAllFolders();
          setStoredFolders(folders);
          
          // Calculate due cards across all materials
          let totalDue = 0;
          const now = Date.now();
          materials.forEach(m => {
              if (m.hasWordFile && m.cardStats) {
                  Object.values(m.cardStats).forEach(stat => {
                      if (stat.dueDate <= now) totalDue++;
                  });
              }
          });
          setDueCardCount(totalDue);

      } catch (e) {
          console.error("Failed to load stored data:", e);
      }
  };

  const stripStandaloneCodeFences = (str: string) => str
    .split('\n')
    .filter(line => !/^\s*```(?:markdown|text|json)?\s*$/i.test(line))
    .join('\n')
    .trim();

  const stripStructuralMarkdown = (line: string) => line
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/^`+|`+$/g, '')
    .trim();

  const applySelectedPersonaMetadata = (
      entries: TranscriptEntry[],
      selections: PromptPersonaSelection[] | null
  ): TranscriptEntry[] => {
      if (!selections || selections.length === 0 || entries.length === 0) return entries;

      const nextEntries = entries.map(entry => ({ ...entry }));
      const firstExplanation = nextEntries[0].explanation || '';
      const existingProfileMatch = firstExplanation.match(/__PERSONA_PROFILE__([\s\S]*?)__END_PERSONA__/);
      const existingProfile = existingProfileMatch ? existingProfileMatch[1] : '';

      const profileNames = existingProfile
          .split(/\r?\n/)
          .map(line => stripStructuralMarkdown(line).match(/^(?:\d+[.)]\s*)?(?:名前|name)\s*[:：]\s*(.+)$/i)?.[1]?.trim())
          .filter((name): name is string => !!name);

      const speakerNames: string[] = [];
      for (const entry of nextEntries) {
          const explanation = (entry.explanation || '')
              .replace(/__PERSONA_PROFILE__[\s\S]*?__END_PERSONA__/, '')
              .replace(/__BACKGROUND_INFO__[\s\S]*?__END_BACKGROUND__/, '');
          for (const rawLine of explanation.split(/\r?\n/)) {
              const line = stripStructuralMarkdown(rawLine);
              const match = line.match(/^\s*(?:\[解説\]\s*)?([^:：\n]{1,60})\s*[:：]/);
              if (!match) continue;
              const name = match[1].replace(/[（(][^）)]*[）)]\s*$/, '').trim();
              if (name && !speakerNames.includes(name)) speakerNames.push(name);
              if (speakerNames.length >= selections.length) break;
          }
          if (speakerNames.length >= selections.length) break;
      }

      const canonicalProfile = selections.map((selection, index) => {
          const name = speakerNames[index] || profileNames[index] || selection.name.trim() || `解説者${index + 1}`;
          return `名前: ${name}\n役割: ${selection.role}\n性格: ${selection.trait}`;
      }).join('\n\n');

      const withoutOldProfile = firstExplanation.replace(/__PERSONA_PROFILE__[\s\S]*?__END_PERSONA__/, '');
      nextEntries[0].explanation = `__PERSONA_PROFILE__【解説担当】\n${canonicalProfile}\n__END_PERSONA__${withoutOldProfile}`;
      return nextEntries;
  };

  const cleanJsonString = (str: string) => {
    let cleaned = str.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    // 余分なテキストがJSONの前にある場合への対策（例: "snsすれっどめーかー"）
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace && (firstBracket === -1 || firstBrace < firstBracket)) {
        if (!cleaned.startsWith('{')) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
    } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        if (!cleaned.startsWith('[')) {
            cleaned = cleaned.substring(firstBracket, lastBracket + 1);
        }
    }
    
    return cleaned;
  };

  const handleLoad = async (data: {
    name: string;
    mediaFile?: File;
    textFile?: File;
    wordFile?: File;
    wordContent?: string;
    plainTextContent?: string;
    thumbnail?: string;
  }): Promise<boolean> => {
    setError(null);
    const selectedPromptPersonas = data.plainTextContent ? pendingPromptPersonas : null;
    const clearPendingImportContext = () => {
        setPendingPromptPersonas(null);
        setPendingReadonStrictValidation(false);
    };
    try {
        // Check for Board/Amazon/Legend/SNS Data in plainTextContent first
        if (data.plainTextContent) {
             const cleaned = cleanJsonString(data.plainTextContent);
             try {
                 const possibleJson = JSON.parse(cleaned);
                 
                 // Case 1: Board Data
                 if (possibleJson.posts && Array.isArray(possibleJson.posts)) {
                     const blob = new Blob([JSON.stringify(possibleJson)], { type: 'application/json' });
                     const file = new File([blob], "board_data.json", { type: "application/json" });
                     
                     const id = await saveMaterial({
                         name: possibleJson.title || data.name || '無題のスレッド',
                         textFile: file,
                         mediaFile: data.mediaFile,
                         thumbnail: data.thumbnail
                     });
                     clearPendingImportContext();
                     await loadStoredData();
                     await handleLoadFromDB(id);
                     return true;
                 }

                 // Case 2: Amazon Data
                 if (possibleJson.mode === 'amazon' && possibleJson.product) {
                     const blob = new Blob([JSON.stringify(possibleJson)], { type: 'application/json' });
                     const file = new File([blob], "amazon_data.json", { type: "application/json" });
                     
                     const id = await saveMaterial({
                         name: possibleJson.product.title || data.name || 'Amazon Item',
                         textFile: file,
                         mediaFile: data.mediaFile,
                         thumbnail: data.thumbnail
                     });
                     clearPendingImportContext();
                     await loadStoredData();
                     await handleLoadFromDB(id);
                     return true;
                 }

                 // Case 3: Legend Data
                 if (possibleJson.mode === 'legend' && possibleJson.content) {
                     const blob = new Blob([JSON.stringify(possibleJson)], { type: 'application/json' });
                     const file = new File([blob], "legend_data.json", { type: "application/json" });
                     
                     const id = await saveMaterial({
                         name: possibleJson.title || data.name || '伝説の始まり',
                         textFile: file,
                         mediaFile: data.mediaFile,
                         thumbnail: data.thumbnail
                     });
                     clearPendingImportContext();
                     await loadStoredData();
                     await handleLoadFromDB(id);
                     return true;
                 }

                 // Case 4: SNS / X Data
                 if (possibleJson.mode === 'x_thread' && possibleJson.main_post) {
                     const blob = new Blob([JSON.stringify(possibleJson)], { type: 'application/json' });
                     const file = new File([blob], "sns_data.json", { type: "application/json" });
                     
                     // Default to main post content for title if not provided
                     const title = possibleJson.main_post.jp_content 
                        ? possibleJson.main_post.jp_content.substring(0, 20) + "..." 
                        : data.name || 'SNS Thread';

                     const id = await saveMaterial({
                         name: title,
                         textFile: file,
                         mediaFile: data.mediaFile,
                         thumbnail: data.thumbnail
                     });
                     clearPendingImportContext();
                     await loadStoredData();
                     await handleLoadFromDB(id);
                     return true;
                 }

             } catch (e) {
                 // Not JSON or specific data, proceed as normal text
             }
        }

        // Build every derived file before the first IndexedDB write. A parser error can
        // no longer leave an empty material behind.
        let materialName = data.name.trim();
        let preparedTextFile = data.textFile;
        let preparedWordFile = data.wordFile;

        if (data.plainTextContent) {
             const prepared = prepareReadingMaterialImport(data.plainTextContent);
             const textContent = applySelectedPersonaMetadata(prepared.transcript, selectedPromptPersonas);
             preparedTextFile = new File(
                 [JSON.stringify(textContent)],
                 'transcript.json',
                 { type: 'application/json' }
             );
             if (prepared.cards.length > 0) {
                 preparedWordFile = new File(
                     [JSON.stringify(prepared.cards)],
                     'words.json',
                     { type: 'application/json' }
                 );
             }
             if (!materialName) materialName = prepared.suggestedName;
             if (prepared.repairs.length > 0 || prepared.warnings.length > 0) {
                 console.info('[reading-import] completed with recoverable adjustments', {
                     repairs: prepared.repairs,
                     warnings: prepared.warnings,
                     sentenceCount: textContent.length,
                     cardCount: prepared.cards.length,
                 });
             }
        }

        if (data.wordContent && !data.plainTextContent) {
            const warnings: string[] = [];
            const repairs: string[] = [];
            const parsedCards = parseImportCards(data.wordContent, warnings, repairs);
            preparedWordFile = new File(
                [JSON.stringify(parsedCards)],
                'words.json',
                { type: 'application/json' }
            );
            if (warnings.length > 0 || repairs.length > 0) {
                console.info('[word-import] completed with recoverable adjustments', { warnings, repairs });
            }
        }

        if (!data.mediaFile && !preparedTextFile && !preparedWordFile) {
            throw new Error('取り込める本文・音声・単語カードがありません。表紙画像だけでは教材を作成できません。');
        }

        const duration = data.mediaFile ? await getDuration(data.mediaFile) : undefined;
        const id = await saveMaterial({
            name: materialName || data.mediaFile?.name.replace(/\.[^/.]+$/, '') || '教材',
            mediaFile: data.mediaFile,
            textFile: preparedTextFile,
            duration,
            wordFile: preparedWordFile,
            thumbnail: data.thumbnail
        });
        
        
        clearPendingImportContext();
        await loadStoredData();
        
        if (data.mediaFile || preparedTextFile || data.plainTextContent) {
             await handleLoadFromDB(id);
        }

        return true;

    } catch (err) {
      console.error(err);
      setError(err instanceof Error && err.message ? err.message : "データの読み込みに失敗しました。");
      return false;
    }
  };
  
  const handleLoadBoard = (data: BoardThread) => {
      setBoardData(data);
      setView('board');
  };

  const parsePlainTextToTranscript = (text: string): TranscriptEntry[] => {
      text = stripStandaloneCodeFences(text);
      if (text.startsWith('{') || text.startsWith('[')) {
          try {
              const json = JSON.parse(text);
              if (Array.isArray(json) && json.length > 0 && 'english' in json[0]) {
                  return json;
              }
          } catch (e) { }
      }
      
      const lines = text.split('\n').map(l => l.trim()).filter(l => l && !/^```(?:markdown|text|json)?$/i.test(l));
      const entries: TranscriptEntry[] = [];
      
      let metadataBuffer = '';
      let isReadingProfile = false;
      
      const contentLines: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
          const structuralLine = stripStructuralMarkdown(lines[i]);
          const isProfileHeader = /^【(?:解説担当|解説者プロフィール)[^】]*】/.test(structuralLine);
          const isProfileField = /^(?:\d+[.)]\s*)?(?:名前|役割|性格|職業|キャラ(?:クター)?)\s*[:：]/.test(structuralLine);

          if (isProfileHeader || (!isReadingProfile && contentLines.length === 0 && isProfileField)) {
              isReadingProfile = true;
              metadataBuffer += structuralLine + '\n';
              continue;
          }
          
          if (isReadingProfile) {
               if (structuralLine.includes('----------')) {
                   isReadingProfile = false;
                   continue;
               }

               const hasJapanese = /[ぁ-んァ-ン一-龯]/.test(structuralLine);
               const looksLikeEnglishSentence = /[A-Za-z]/.test(structuralLine)
                   && !hasJapanese
                   && !/^(?:Name|Role|Trait)\s*[:：]/i.test(structuralLine)
                   && !structuralLine.startsWith('【');

               if (looksLikeEnglishSentence) {
                   isReadingProfile = false;
                   contentLines.push(structuralLine);
               } else {
                   metadataBuffer += structuralLine + '\n';
               }
          } else {
              contentLines.push(structuralLine);
          }
      }
      
      for (let i = 0; i < contentLines.length; i++) {
          const line = stripStructuralMarkdown(contentLines[i]);
          if (line.startsWith('[解説]')) {
              if (entries.length > 0) {
                  const explanation = line.replace('[解説]', '').trim();
                  const currentEntry = entries[entries.length - 1];
                  currentEntry.explanation = currentEntry.explanation
                    ? currentEntry.explanation + '\n' + explanation
                    : explanation;
              }
              continue;
          }
          
          const hasJapanese = /[ぁ-んァ-ン一-龯]/.test(line);
          
          if (!hasJapanese) {
               entries.push({
                   start: entries.length * 10, 
                   end: entries.length * 10 + 5,
                   english: line,
                   words: line.split(' ').map((w, idx) => ({ word: w, start: 0, end: 0 })),
                   japanese: '',
                   explanation: '',
               });
          } else {
              if (entries.length > 0) {
                  const currentEntry = entries[entries.length - 1];
                  if (!currentEntry.japanese || currentEntry.japanese.match(/^\[(?:その日本語訳|英文の第[0-9一二三四五六七八九十]+文)\]$/)) {
                      currentEntry.japanese = line;
                  } else {
                      currentEntry.explanation = currentEntry.explanation 
                        ? currentEntry.explanation + '\n' + line 
                        : line;
                  }
              }
          }
      }
      
      if (metadataBuffer) {
          if (entries.length > 0) {
              const existing = entries[0].explanation || '';
              entries[0].explanation = `__PERSONA_PROFILE__${metadataBuffer}__END_PERSONA__${existing}`;
          }
      }
      
      return entries;
  };

  const getDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(URL.createObjectURL(file));
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
    });
  };

  const handleLoadFromDB = async (id: number) => {
      setError(null);
      try {
          const material = await getMaterialById(id);
          setCurrentMaterial(material);
          setMaterialName(material.name);
          setBgmFile(material.bgmFile);
          setAnnotationFile(material.annotationFile);
          setHasWordFile(!!material.wordFile);
          setHasQuizFile(!!material.quizFile);

          if (material.mediaFile) {
              setMediaUrl(URL.createObjectURL(material.mediaFile));
          } else {
              setMediaUrl(null);
          }

          // Load Word File for Reader (if exists)
          if (material.wordFile) {
              try {
                  const parsedWords = await parseCards(material.wordFile);
                  setReaderCards(parsedWords);
              } catch (e) {
                  console.warn("Failed to load reader cards", e);
                  setReaderCards([]);
              }
          } else {
              setReaderCards([]);
          }

          if (material.textFile) {
              const text = await material.textFile.text();
              try {
                  const parsed = JSON.parse(text);
                  
                  // Check if it is Board Data (Saved JSON)
                  if (parsed.posts && Array.isArray(parsed.posts)) {
                      setBoardData(parsed);
                      setView('board');
                      return;
                  }

                  // Check if it is Amazon Data
                  if (parsed.mode === 'amazon' && parsed.product) {
                      setAmazonData(parsed);
                      setView('amazon');
                      return;
                  }

                  // Check if it is Legend Data
                  if (parsed.mode === 'legend' && parsed.content) {
                      setLegendData(parsed);
                      setView('legend');
                      return;
                  }

                  // Check if it is SNS Data (X style)
                  if (parsed.mode === 'x_thread' && parsed.main_post) {
                      setSnsData(parsed);
                      setView('sns');
                      return;
                  }

                  // Normal Transcript Logic
                  let entries: TranscriptEntry[] = [];
                  let profile: string | null = null;
                  let bgInfo: string | null = null;
                  
                  if (Array.isArray(parsed)) {
                      entries = parsed.filter((entry: TranscriptEntry) => typeof entry?.english === 'string' && entry.english.trim());
                      if (entries.length === 0) {
                          throw new Error('本文が空の教材は開けません。元の貼り付けデータから再取り込みしてください。');
                      }
                      if (entries.length > 0 && entries[0].explanation) {
                          let expl = entries[0].explanation;
                          const personaMatch = expl.match(/__PERSONA_PROFILE__([\s\S]*?)__END_PERSONA__/);
                          if (personaMatch) {
                              profile = personaMatch[1];
                              expl = expl.replace(personaMatch[0], '');
                          }
                          const bgMatch = expl.match(/__BACKGROUND_INFO__([\s\S]*?)__END_BACKGROUND__/);
                          if (bgMatch) {
                              bgInfo = bgMatch[1];
                              expl = expl.replace(bgMatch[0], '');
                          }
                          entries[0].explanation = expl;
                      }
                  } else {
                      throw new Error('本文データの形式を認識できません。');
                  }
                  setTranscript(entries);
                  setPersonaProfile(profile);
                  setBackgroundInfo(bgInfo);
                  setView('reader');
              } catch (e) {
                  console.error("Failed to parse transcript JSON", e);
                  setTranscript([]);
                  setError(e instanceof Error ? e.message : "トランスクリプトデータの解析に失敗しました。");
              }
          } else {
              setTranscript([]);
              setPersonaProfile(null);
              setBackgroundInfo(null);
              setView('reader'); // Go to reader even if no text
          }
          
      } catch (e) {
          console.error(e);
          setError("データの読み込みに失敗しました。");
      }
  };
  
  const parseCards = async (file: File): Promise<Card[]> => {
      const text = stripStandaloneCodeFences(await file.text());
      let parsedCards: Card[] = [];

      // Prompt Library now emits a JSON array inside an otherwise plain-text material.
      // Parse valid card JSON by content first, regardless of the stored file extension/MIME type.
      if (text.trim().startsWith('[')) {
          try {
              const json = JSON.parse(text);
              if (Array.isArray(json)) {
                  return json.map((item: any, index: number) => ({
                      id: index,
                      front: item.front || item.word || '',
                      back: item.back || item.meaning || '',
                      pronunciation: item.pronunciation,
                      memo: item.memo
                  }));
              }
          } catch (e) {
              // Keep backward compatibility with slash-delimited word data below.
          }
      }
      
      if (file.name.endsWith('.json') || file.type === 'application/json') {
           try {
               const json = JSON.parse(text);
               if (Array.isArray(json)) {
                   parsedCards = json.map((item: any, index: number) => ({
                       id: index,
                       front: item.front || item.word || '',
                       back: item.back || item.meaning || '',
                       pronunciation: item.pronunciation,
                       memo: item.memo
                   }));
                   return parsedCards;
               }
           } catch(e) { console.error("JSON parse error", e); }
      }

      parsedCards = text.split('\n').filter(l => l.trim()).map((line, i) => {
          const spacedParts = line.split(/\s+\/\s+/).map(p => p.trim());
          const parts = spacedParts.length >= 2 ? spacedParts : line.split('/').map(p => p.trim());
          const firstPart = parts[0] || '';
          const richPromptFormat = parts.length >= 4 && /語源|雑学|【覚え方】/.test(parts[2] || '');

          if (richPromptFormat) {
              const withoutLeadingEmoji = firstPart.replace(/^[^A-Za-z0-9]+/, '').trim();
              const pronunciationMatch = withoutLeadingEmoji.match(/^(.+?)\s+([ァ-ヶー]*[［\[][ァ-ヶー]+[］\]][ァ-ヶー]*|[ァ-ヶー]+)\s*$/);
              if (pronunciationMatch) {
                  const etymology = parts[2] || '';
                  const example = parts.slice(3).join(' / ');
                  return {
                      id: i,
                      front: pronunciationMatch[1].trim(),
                      back: parts[1] || '',
                      pronunciation: pronunciationMatch[2].replace(/［/g, '[').replace(/］/g, ']'),
                      memo: `${etymology.startsWith('【語源・雑学】') ? '' : '【語源・雑学】\n'}${etymology}${example ? `\n\n【例文】\n${example}` : ''}`
                  };
              }
          }

          // Original four-column slash format remains unchanged.
          return {
              id: i,
              front: parts[0] || '',
              back: parts[1] || '',
              pronunciation: parts[2],
              memo: parts[3]
          };
      });
      return parsedCards;
  };

  const handleStudy = async (id: number) => {
      try {
          const material = await getMaterialById(id);
          setCurrentMaterial(material);
          
          if (material.wordFile) {
              const parsedCards = await parseCards(material.wordFile);
              
              // Merge SRS stats
              const cardsWithStats = parsedCards.map((card, index) => {
                  return {
                      ...card,
                      srsState: material.cardStats ? material.cardStats[index] : undefined,
                      sourceMaterialId: material.id // Track source for saving
                  };
              });

              // Sort by due date (Due first, then new)
              const now = Date.now();
              const sortedCards = cardsWithStats.sort((a, b) => {
                  const dateA = a.srsState ? a.srsState.dueDate : 0; // 0 means new (sort priority logic needed)
                  const dateB = b.srsState ? b.srsState.dueDate : 0;
                  
                  // Logic: Due cards (past or now) -> New cards (no state) -> Future cards
                  const isDueA = a.srsState && dateA <= now;
                  const isDueB = b.srsState && dateB <= now;
                  const isNewA = !a.srsState;
                  const isNewB = !b.srsState;

                  if (isDueA && !isDueB) return -1;
                  if (!isDueA && isDueB) return 1;
                  if (isDueA && isDueB) return dateA - dateB;
                  
                  if (isNewA && !isNewB) return -1;
                  if (!isNewA && isNewB) return 1;
                  
                  return 0;
              });

              setCards(sortedCards);
              setMaterialName(material.name);
              setView('flashcard');
          }
      } catch (e) {
          console.error(e);
          setError("単語データの読み込みに失敗しました。");
      }
  };
  
  const handleCardList = async (id: number) => {
      try {
          const material = await getMaterialById(id);
          setCurrentMaterial(material);
          if (material.wordFile) {
               const parsedCards = await parseCards(material.wordFile);
               setCards(parsedCards);
               setMaterialName(material.name);
               setView('cardList');
          }
      } catch (e) {
          console.error(e);
          setError("一覧データの読み込みに失敗しました。");
      }
  };

  const handleStartDailyReview = async () => {
      try {
          const allMaterials = await getAllMaterials();
          let allDueCards: Card[] = [];
          const now = Date.now();

          for (const material of allMaterials) {
              if (material.hasWordFile && material.cardStats) {
                   const fullMaterial = await getMaterialById(material.id);
                   if (fullMaterial.wordFile) {
                       const parsedCards = await parseCards(fullMaterial.wordFile);
                       
                       const dueCards = parsedCards.filter((card, index) => {
                           const stat = material.cardStats![index];
                           return stat && stat.dueDate <= now;
                       }).map((card, index) => ({
                           ...card,
                           srsState: material.cardStats![index],
                           sourceMaterialId: material.id
                       }));
                       
                       allDueCards = [...allDueCards, ...dueCards];
                   }
              }
          }

          if (allDueCards.length === 0) {
              alert("現在、復習が必要なカードはありません！");
              return;
          }

          // Shuffle review cards
          allDueCards.sort(() => Math.random() - 0.5);

          setCards(allDueCards);
          setMaterialName(`今日のクエスト (${allDueCards.length}枚)`);
          setCurrentMaterial(null); // Virtual deck
          setView('flashcard');

      } catch (e) {
          console.error("Review generation failed", e);
          setError("復習セッションの作成に失敗しました。");
      }
  };

  const handleSaveCardStats = async (card: Card, newState: SRSState) => {
      const targetMaterialId = card.sourceMaterialId;
      if (!targetMaterialId) return;

      try {
          const material = await getMaterialById(targetMaterialId);
          const currentStats = material.cardStats || {};
          const cardIndex = typeof card.id === 'number' ? card.id : parseInt(String(card.id));
          
          const updatedStats = {
              ...currentStats,
              [cardIndex]: newState
          };
          
          await updateMaterial(targetMaterialId, { cardStats: updatedStats });
          // Update local count for UI
          loadStoredData(); 
      } catch (e) {
          console.error("Failed to save card stats", e);
      }
  };

  const handleGame = async (id: number) => {
     try {
          const material = await getMaterialById(id);
          setCurrentMaterial(material);
          if (material.wordFile) {
               const parsedCards = await parseCards(material.wordFile);
               setCards(parsedCards);
               setMaterialName(material.name);
               setView('game');
          }
      } catch (e) {
          console.error(e);
          setError("ゲームデータの読み込みに失敗しました。");
      }
  };

  const handleStartQuiz = async (id: number) => {
       try {
          const material = await getMaterialById(id);
          setCurrentMaterial(material);
          if (material.quizFile) {
              const text = await material.quizFile.text();
              const questions = JSON.parse(text) as QuizQuestion[];
              setQuizQuestions(questions);
          } else {
              setQuizQuestions([]);
          }
          if (material.textFile) {
              const text = await material.textFile.text();
              try {
                  const parsed = JSON.parse(text);
                  
                  // Check Board Data again if accidentally routed here
                   if (parsed.posts && Array.isArray(parsed.posts)) {
                      setBoardData(parsed);
                      setView('board');
                      return;
                  }
                  // Check Amazon Data
                  if (parsed.mode === 'amazon' && parsed.product) {
                      setAmazonData(parsed);
                      setView('amazon');
                      return;
                  }
                  // Check Legend Data
                  if (parsed.mode === 'legend' && parsed.content) {
                      setLegendData(parsed);
                      setView('legend');
                      return;
                  }
                  // Check SNS Data
                  if (parsed.mode === 'x_thread' && parsed.main_post) {
                      setSnsData(parsed);
                      setView('sns');
                      return;
                  }

                  let entries: TranscriptEntry[] = [];
                  let profile: string | null = null;
                  if (Array.isArray(parsed)) {
                      entries = parsed;
                      if (entries.length > 0 && entries[0].explanation && entries[0].explanation.includes('__PERSONA_PROFILE__')) {
                          const parts = entries[0].explanation.split('__END_PERSONA__');
                          profile = parts[0].replace('__PERSONA_PROFILE__', '');
                      }
                  }
                  setTranscript(entries);
                  setPersonaProfile(profile);
              } catch (e) {}
          }
          setMaterialName(material.name);
          setView('quiz');
      } catch (e) {
          console.error(e);
          setError("クイズデータの読み込みに失敗しました。");
      }
  }

  const handleDeleteFromDB = async (id: number) => {
       const numericId = Number(id);
      if (isNaN(numericId)) return;
      setStoredMaterials(prev => prev.filter(m => m.id !== numericId));
      try {
          await deleteMaterial(numericId);
          if (currentMaterial?.id === numericId) setCurrentMaterial(null);
          loadStoredData(); // Refresh counts
      } catch (e) {
          console.error(e);
          setError("削除に失敗しました。");
          await loadStoredData();
      }
  };

  const handleUpdateMaterial = async (id: number, data: any) => {
       try {
          await updateMaterial(id, data);
          await loadStoredData();
          if (currentMaterial?.id === id) {
             const updated = await getMaterialById(id);
             setCurrentMaterial(updated);
             if (view === 'reader') {
                 if (data.bgmFile !== undefined) setBgmFile(updated.bgmFile);
                 if (data.wordFile !== undefined) setHasWordFile(!!updated.wordFile);
                 if (data.quizFile !== undefined) setHasQuizFile(!!updated.quizFile);
                 if (data.annotationFile !== undefined) setAnnotationFile(updated.annotationFile);
             }
          }
      } catch (e) {
          console.error(e);
          setError("更新に失敗しました。");
      }
  };

   const handleAddFolder = async (name: string) => {
      try { await addFolder(name); await loadStoredData(); } catch (e) { setError("失敗"); }
  };
  const handleUpdateFolder = async (id: number, name: string) => {
       try { await updateFolder(id, name); await loadStoredData(); } catch (e) { setError("失敗"); }
  };
  const handleDeleteFolder = async (id: number) => {
       try { await deleteFolderAndReassign(id); await loadStoredData(); } catch (e) { setError("失敗"); }
  };

  return (
    <div className={`memora-world memora-world--${memoraRoleByView[view]} min-h-screen ${T.bg} flex flex-col font-sans text-base transition-colors duration-300 relative`}>
      {view === 'create' && (
        <CreateHomeScreen
          onOpenJapaneseReader={() => setView('jpLibrary')}
          onOpenLibrary={() => {
            setPendingPromptPersonas(null);
            setPendingReadonStrictValidation(false);
            setView('upload');
          }}
          onOpenOtherModes={() => {
            setPendingReadonStrictValidation(false);
            setView('promptLibrary');
          }}
          onNavigateToPasteJSON={(personas) => {
            setPendingPromptPersonas(personas);
            setPendingReadonStrictValidation(true);
            setOpenPasteJsonMode(true);
            setView('upload');
          }}
        />
      )}
      {view === 'jpLibrary' && (
        <React.Suspense fallback={<div className="min-h-screen grid place-items-center text-white">日本語Readerを読み込んでいます…</div>}>
          <JapaneseLibraryScreen
            onBack={() => setView('create')}
            onOpenMaterial={(material) => {
              setCurrentJpMaterial(material);
              setView('jpReader');
            }}
          />
        </React.Suspense>
      )}
      {view === 'jpReader' && currentJpMaterial && (
        <React.Suspense fallback={<div className="min-h-screen grid place-items-center text-white">教材を開いています…</div>}>
          <JapaneseReaderScreen
            material={currentJpMaterial}
            onBack={() => setView('jpLibrary')}
          />
        </React.Suspense>
      )}
      {view === 'upload' && (
        <UploadScreen 
          onBack={() => setView('create')}
          onLoad={handleLoad} 
          error={error} 
          onClearError={() => setError(null)}
          storedMaterials={storedMaterials} 
          storedFolders={storedFolders}
          onLoadFromDB={handleLoadFromDB} 
          onDeleteFromDB={handleDeleteFromDB}
          onUpdateMaterial={handleUpdateMaterial}
          onAddFolder={handleAddFolder}
          onUpdateFolder={handleUpdateFolder}
          onDeleteFolder={handleDeleteFolder}
          onGoToDeckList={() => setView('deckList')}
          onStudy={handleStudy}
          onGame={handleGame}
          onStartQuiz={handleStartQuiz}
          onLoadBoard={handleLoadBoard}
          T={T}
          setTheme={setThemeName}
          themes={themes}
          dueCardCount={dueCardCount}
          onStartDailyReview={handleStartDailyReview}
          initialOpenPasteJson={openPasteJsonMode}
          onClearPasteJson={() => setOpenPasteJsonMode(false)}
        />
      )}
      {view === 'reader' && (
        <ReaderScreen 
          mediaUrl={mediaUrl} 
          transcript={transcript} 
          onBack={() => setView('upload')} 
          title={materialName}
          thumbnailUrl={currentMaterial?.thumbnail}
          duration={currentMaterial?.duration}
          bgmFile={bgmFile}
          annotationFile={annotationFile}
          materialId={currentMaterial!.id}
          hasWordFile={hasWordFile}
          registeredWords={readerCards} // Pass words here
          onStartStudy={handleStudy}
          T={T}
          personaProfile={personaProfile}
          backgroundInfo={backgroundInfo}
          hasQuizFile={hasQuizFile}
          onStartQuiz={handleStartQuiz}
          onUpdateMaterial={handleUpdateMaterial}
          globalMemo={currentMaterial?.globalMemo}
          inlineNotes={currentMaterial?.inlineNotes}
        />
      )}
      {view === 'board' && boardData && (
          <BoardScreen 
            data={boardData}
            onBack={() => setView('upload')}
            T={T}
            materialId={currentMaterial ? currentMaterial.id : 0}
            onUpdateMaterial={handleUpdateMaterial}
          />
      )}
      {view === 'amazon' && amazonData && (
          <AmazonScreen
            data={amazonData}
            onBack={() => setView('upload')}
            T={T}
            materialId={currentMaterial ? currentMaterial.id : 0}
            thumbnailUrl={currentMaterial?.thumbnail}
            onUpdateMaterial={handleUpdateMaterial}
          />
      )}
      {view === 'legend' && legendData && (
          <LegendScreen
            data={legendData}
            onBack={() => setView('upload')}
            T={T}
          />
      )}
      {view === 'sns' && snsData && (
          <SnsScreen
            data={snsData}
            onBack={() => setView('upload')}
            T={T}
            materialId={currentMaterial ? currentMaterial.id : 0}
            onUpdateMaterial={handleUpdateMaterial}
          />
      )}
      {view === 'deckList' && (
        <DeckListScreen 
          decks={storedMaterials.filter(m => m.hasWordFile)} 
          onStudy={handleStudy}
          onGame={handleGame}
          onRead={handleLoadFromDB}
          onViewList={handleCardList}
          onBack={() => setView('upload')}
          T={T}
        />
      )}
      {view === 'flashcard' && (
        <FlashcardScreen 
          cards={cards} 
          deckName={materialName} 
          onBack={() => setView('upload')} 
          onEditDeck={() => setView('editDeck')}
          T={T}
          setTheme={setThemeName}
          themes={themes}
          materialId={currentMaterial?.id || 0}
          duration={currentMaterial?.duration}
          onGoToReader={handleLoadFromDB}
          onGoToCardList={handleCardList}
          onSaveCardStats={handleSaveCardStats}
        />
      )}
      {view === 'cardList' && (
          <CardListScreen
            cards={cards}
            deckName={materialName}
            onBack={() => setView('flashcard')}
            T={T}
          />
      )}
      {view === 'editDeck' && (
        <DeckEditScreen 
            cards={cards}
            deckName={materialName}
            onBack={() => setView('flashcard')}
            T={T}
        />
      )}
      {view === 'game' && (
          <GameScreen 
            cards={cards}
            deckName={materialName}
            onBack={() => setView('deckList')}
            T={T}
          />
      )}
      {view === 'quiz' && (
          <QuizScreen
            questions={quizQuestions}
            deckName={materialName}
            onBack={() => setView('upload')}
            T={T}
            bookmarks={currentMaterial?.quizBookmarks || []}
            onUpdateBookmarks={(bookmarks) => handleUpdateMaterial(currentMaterial!.id, { quizBookmarks: bookmarks })}
            transcript={transcript}
            personaProfile={personaProfile}
            materialId={currentMaterial!.id}
            onUpdateMaterial={handleUpdateMaterial}
            onReload={() => handleStartQuiz(currentMaterial!.id)}
          />
      )}
      {view === 'promptLibrary' && (
          <PromptLibraryScreen 
            onBack={() => setView('create')}
            onNavigateToPasteJSON={(personas) => {
                setPendingPromptPersonas(personas);
                setPendingReadonStrictValidation(false);
                setOpenPasteJsonMode(true);
                setView('upload');
            }}
            T={T}
          />
      )}
    </div>
  );
};

export default App;
