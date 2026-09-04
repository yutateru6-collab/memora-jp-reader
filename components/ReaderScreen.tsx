
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { TranscriptEntry, QuizQuestion, Card, InlineNote } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import TranslateIcon from './icons/TranslateIcon';
import { Theme } from '../App';
import RewindIcon from './icons/RewindIcon';
import ForwardIcon from './icons/ForwardIcon';
import MusicIcon from './icons/MusicIcon';
import CommentaryIcon from './icons/CommentaryIcon';
import InfoIcon from './icons/InfoIcon';
import QuizIcon from './icons/QuizIcon';
import LightBulbIcon from './icons/LightBulbIcon';
import TrashIcon from './icons/TrashIcon';
import StopwatchIcon from './icons/StopwatchIcon';
import PdfIcon from './icons/PdfIcon';
import NoteIcon from './icons/NoteIcon';
import FlashIcon from './icons/FlashIcon'; // Import new icon
import QuizCreationModal from './QuizCreationModal';
import PdfExportModal from './PdfExportModal';
import { grammarTerms, GrammarTerm } from '../lib/grammarTerms';
import { RsvpScreen } from './RsvpScreen'; // Import RSVP Screen

interface ReaderScreenProps {
  mediaUrl: string | null;
  transcript: TranscriptEntry[];
  onBack: () => void;
  title: string;
  thumbnailUrl?: string;
  duration?: number;
  bgmFile?: File;
  annotationFile?: File;
  materialId: number;
  hasWordFile: boolean;
  registeredWords?: Card[]; 
  onStartStudy: (id: number) => void;
  T: Theme;
  personaProfile: string | null;
  backgroundInfo: string | null;
  hasQuizFile?: boolean;
  onStartQuiz: (id: number) => void;
  onUpdateMaterial: (id: number, data: { quizFile?: File | null, annotationFile?: File | null, globalMemo?: string, inlineNotes?: InlineNote[] }) => Promise<void>;
  globalMemo?: string;
  inlineNotes?: InlineNote[];
}

const VolumeIcon: React.FC<{className?: string, muted?: boolean}> = ({className, muted}) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className || "w-5 h-5"}>
        {muted ? (
             <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
        ) : (
             <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        )}
    </svg>
);

const EyeIcon: React.FC<{className?: string; off?: boolean}> = ({className, off}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        {off ? (
             <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        ) : (
             <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        )}
        {!off && <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
    </svg>
);

const SkipPrevIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"} fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
    </svg>
);

const SkipNextIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-6 h-6"} fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
    </svg>
);

const ColumnsIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-5 h-5"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="12" y1="3" x2="12" y2="21" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const fontOptions = [
    { label: 'ゴシック', value: "'Noto Sans JP', sans-serif" },
    { label: '明朝', value: "'Noto Serif JP', serif" },
    { label: 'ロック', value: "'RocknRoll One', sans-serif" },
    { label: 'システム', value: "sans-serif" },
    { label: '英語用', value: "'Inter', sans-serif" },
];

// Selection Data type for the popover menu
interface SelectionData {
    top: number;
    left: number;
    type: 'english' | 'japanese' | 'explanation';
    // For English
    startGlobalIndex?: number;
    endGlobalIndex?: number;
    // For Japanese/Explanation
    sentenceIndex?: number;
    characterRange?: { start: number; end: number };
}

interface PersonaAvatarProfile {
    name: string;
    role: string;
    avatar?: string;
}

interface ExplanationSpeaker {
    name: string;
    role?: string;
    avatar?: string;
}

const PERSONA_AVATAR_BY_ROLE: Record<string, string> = {
    'ギャル': '/personas/01_ギャル.png',
    '大学生': '/personas/02_大学生.png',
    '高校教師': '/personas/03_高校教師.png',
    '司書': '/personas/04_司書.png',
    '主婦': '/personas/05_主婦.png',
    '経営者': '/personas/06_経営者.png',
    'おじいちゃん': '/personas/07_おじいちゃん.png',
    'ゲーム実況者': '/personas/08_ゲーム実況者.png',
    'ミステリー小説の探偵': '/personas/09_ミステリー小説の探偵.png',
    '異世界から来た騎士': '/personas/10_異世界から来た騎士.png',
};

const PERSONA_ROLE_KEYS = Object.keys(PERSONA_AVATAR_BY_ROLE);

const stripPersonaFormatting = (value: string) => value
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/__/g, '')
    .replace(/`/g, '')
    .trim();

const cleanPersonaDisplayName = (value: string) => stripPersonaFormatting(value)
    .replace(/^\[解説\]\s*/, '')
    .replace(/^(?:命名した|名前)\s*[:：]?\s*/, '')
    .replace(/[（(][^）)]*[）)]\s*$/, '')
    .replace(/^[（(【\[]+/, '')
    .replace(/[）)】\]]+$/, '')
    .trim();

const normalizePersonaName = (value: string) => cleanPersonaDisplayName(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/(?:さん|先生|先輩|くん|君|ちゃん|氏|様)$/u, '')
    .replace(/[\s・･._-]/g, '')
    .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .toLowerCase();

const resolvePersonaRole = (value: string): string | undefined => {
    const cleaned = stripPersonaFormatting(value)
        .replace(/^(?:役割|職業|キャラ(?:クター)?|role)\s*[:：]\s*/i, '')
        .trim();
    return PERSONA_ROLE_KEYS.find(role => cleaned === role || cleaned.includes(role));
};

const parsePersonaAvatarProfiles = (profile: string | null): PersonaAvatarProfile[] => {
    if (!profile) return [];

    const parsed: PersonaAvatarProfile[] = [];
    let current: { name?: string; role?: string } = {};

    const flush = () => {
        if (current.name) {
            const role = current.role || '';
            parsed.push({
                name: cleanPersonaDisplayName(current.name),
                role,
                avatar: role ? PERSONA_AVATAR_BY_ROLE[role] : undefined,
            });
        }
        current = {};
    };

    profile.split(/\r?\n/).forEach(rawLine => {
        const line = stripPersonaFormatting(rawLine);
        if (!line || /^【(?:解説担当|解説者プロフィール)/.test(line)) return;

        const nameMatch = line.match(/^(?:\d+[.)]\s*)?(?:名前|name)\s*[:：]\s*(.+)$/i);
        if (nameMatch) {
            flush();
            current.name = cleanPersonaDisplayName(nameMatch[1]);
            return;
        }

        const roleMatch = line.match(/^(?:役割|職業|キャラ(?:クター)?|role)\s*[:：]\s*(.+)$/i);
        if (roleMatch) {
            current.role = resolvePersonaRole(roleMatch[1]) || stripPersonaFormatting(roleMatch[1]);
            return;
        }

        const combinedMatch = line.match(/^(.{1,40}?)[（(]([^）)]+)[）)](?:\s*[:：].*)?$/);
        if (combinedMatch) {
            const role = resolvePersonaRole(combinedMatch[2]);
            if (role) {
                flush();
                parsed.push({
                    name: cleanPersonaDisplayName(combinedMatch[1]),
                    role,
                    avatar: PERSONA_AVATAR_BY_ROLE[role],
                });
                return;
            }
        }

        if (current.name && !current.role) {
            const role = resolvePersonaRole(line);
            if (role) current.role = role;
        }
    });

    flush();
    return parsed.filter(persona => persona.name);
};

const ReaderScreen: React.FC<ReaderScreenProps> = ({ mediaUrl, transcript, onBack, title, thumbnailUrl, duration: totalDuration, bgmFile, annotationFile, materialId, hasWordFile, registeredWords = [], onStartStudy, T, personaProfile, backgroundInfo, hasQuizFile, onStartQuiz, onUpdateMaterial, globalMemo: initialGlobalMemo, inlineNotes: initialInlineNotes }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const bgmAudioRef = useRef<HTMLAudioElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const readerScreenRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const visualViewport = window.visualViewport;
    const readerScreen = readerScreenRef.current;
    const readerShell = readerScreen?.parentElement;
    let stableHeight = Math.max(
      window.innerHeight,
      root.clientHeight,
      visualViewport?.height || 0,
    );

    const applyStableViewportHeight = () => {
      const measuredHeight = Math.max(
        window.innerHeight,
        root.clientHeight,
        visualViewport?.height || 0,
      );
      // iOS WebKit can keep the small keyboard viewport for CSS viewport units
      // after the import modal closes. Never shrink the Reader during that
      // lifecycle; use the largest real viewport measurement instead.
      stableHeight = Math.max(stableHeight, measuredHeight);
      const stablePixels = `${Math.round(stableHeight)}px`;
      root.style.setProperty('--memora-reader-viewport-height', stablePixels);
      // Use inline important sizing as well. WebKit can retain the keyboard-era
      // result of a viewport-unit declaration even after the custom property is
      // updated, while a measured pixel value invalidates that stale layout.
      for (const property of ['height', 'min-height', 'max-height']) {
        readerScreen?.style.setProperty(property, stablePixels, 'important');
        if (readerShell?.classList.contains('memora-world--read')) {
          readerShell.style.setProperty(property, stablePixels, 'important');
        }
      }
    };

    applyStableViewportHeight();
    window.addEventListener('resize', applyStableViewportHeight);
    visualViewport?.addEventListener('resize', applyStableViewportHeight);

    return () => {
      window.removeEventListener('resize', applyStableViewportHeight);
      visualViewport?.removeEventListener('resize', applyStableViewportHeight);
      root.style.removeProperty('--memora-reader-viewport-height');
      for (const property of ['height', 'min-height', 'max-height']) {
        readerScreen?.style.removeProperty(property);
        if (readerShell?.classList.contains('memora-world--read')) {
          readerShell.style.removeProperty(property);
        }
      }
    };
  }, []);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showEnglish, setShowEnglish] = useState(true);
  const [showJapanese, setShowJapanese] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSideBySide, setIsSideBySide] = useState(false);
  const [useTTS, setUseTTS] = useState(!mediaUrl);
  const [abLoop, setAbLoop] = useState<{ a: number | null, b: number | null }>({ a: null, b: null });
  const [fontSize, setFontSize] = useState(120);

  // TTS Refs for callbacks
  const isPlayingRef = useRef(isPlaying);
  const useTTSRef = useRef(useTTS);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  useEffect(() => {
    useTTSRef.current = useTTS;
  }, [useTTS]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakSentence = useCallback((index: number) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (index < 0 || index >= transcript.length) {
      setIsPlaying(false);
      return;
    }

    const entry = transcript[index];
    setCurrentTime(entry.start);

    const sentenceEl = document.getElementById(`sentence-${index}`);
    if (sentenceEl && scrollContainerRef.current) {
      sentenceEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const textToSpeak = cleanText(entry.english);
    if (!textToSpeak) {
      if (index + 1 < transcript.length) {
        speakSentence(index + 1);
      } else {
        setIsPlaying(false);
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US';
    utterance.rate = playbackRate;

    utterance.onend = () => {
      if (isPlayingRef.current && useTTSRef.current) {
        if (index + 1 < transcript.length) {
          speakSentence(index + 1);
        } else {
          setIsPlaying(false);
        }
      }
    };

    utterance.onerror = (e: any) => {
      if (e.error !== 'interrupted') {
        console.error("TTS play error", e);
        setIsPlaying(false);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [transcript, playbackRate]);
  const [fontFamily, setFontFamily] = useState(fontOptions[0].value);
  const [isImmersive, setIsImmersive] = useState(false);
  const [bgmUrl, setBgmUrl] = useState<string | null>(null);
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.2);
  const [mainVolume, setMainVolume] = useState(1);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  
  // RSVP Mode State
  const [isRsvpModeOpen, setIsRsvpModeOpen] = useState(false);

  // Memo Feature State
  const [globalMemo, setGlobalMemo] = useState(initialGlobalMemo || '');
  const [isGlobalMemoOpen, setIsGlobalMemoOpen] = useState(false);
  const [inlineNotes, setInlineNotes] = useState<InlineNote[]>(initialInlineNotes || []);
  const [showInlineNotes, setShowInlineNotes] = useState(true);
  const [selectionMenu, setSelectionMenu] = useState<SelectionData | null>(null);
  const [activeNote, setActiveNote] = useState<InlineNote | null>(null);
  const [isNoteInputOpen, setIsNoteInputOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // Registered Word Pop State
  const [activeWordPopup, setActiveWordPopup] = useState<{ card: Card, position: { top: number, left: number, width: number } } | null>(null);

  // Grammar Term Pop State
  const [activeGrammarTerm, setActiveGrammarTerm] = useState<{ term: GrammarTerm, position: { top: number, left: number, width: number } } | null>(null);
  
  // Speed Reading State
  const [isSpeedMode, setIsSpeedMode] = useState(false);
  const [isSpeedSettingsOpen, setIsSpeedSettingsOpen] = useState(false);
  const [wpmLevel, setWpmLevel] = useState(150);
  const [speedTimerState, setSpeedTimerState] = useState<'idle' | 'running' | 'finished'>('idle');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [targetDuration, setTargetDuration] = useState(0);
  const speedTimerRef = useRef<number | null>(null);

  // Pacer State (Speed Reading Guide)
  const [isPacerEnabled, setIsPacerEnabled] = useState(true);
  const [currentPacerIndex, setCurrentPacerIndex] = useState(-1);
  const [chunkSize, setChunkSize] = useState(1);

  // Visibility State
  const [isControlsVisible, setIsControlsVisible] = useState(() =>
      typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches
  );
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Old materials may contain a speaker name but no role metadata. Keep a
  // per-material, per-device override so the user can assign the correct
  // official avatar once and have it restored on later visits.
  const personaRoleStorageKey = `memora-persona-role-overrides:${materialId}`;
  const [personaRoleOverrides, setPersonaRoleOverrides] = useState<Record<string, string>>(() => {
      if (typeof window === 'undefined') return {};
      try {
          const raw = window.localStorage.getItem(`memora-persona-role-overrides:${materialId}`);
          const parsed = raw ? JSON.parse(raw) : {};
          return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
          return {};
      }
  });
  const [personaRolePicker, setPersonaRolePicker] = useState<{ name: string } | null>(null);

  useEffect(() => {
      if (typeof window === 'undefined') return;
      try {
          const raw = window.localStorage.getItem(personaRoleStorageKey);
          const parsed = raw ? JSON.parse(raw) : {};
          setPersonaRoleOverrides(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
      } catch {
          setPersonaRoleOverrides({});
      }
      setPersonaRolePicker(null);
  }, [personaRoleStorageKey]);

  const savePersonaRoleOverride = (speakerName: string, role: string) => {
      const normalizedName = normalizePersonaName(speakerName);
      if (!normalizedName || !PERSONA_AVATAR_BY_ROLE[role]) return;

      setPersonaRoleOverrides(previous => {
          const next = { ...previous, [normalizedName]: role };
          if (typeof window !== 'undefined') {
              try {
                  window.localStorage.setItem(personaRoleStorageKey, JSON.stringify(next));
              } catch {
                  // The avatar still updates for the current session even if storage is unavailable.
              }
          }
          return next;
      });
      setPersonaRolePicker(null);
  };

  const personaProfiles = useMemo(
      () => parsePersonaAvatarProfiles(personaProfile),
      [personaProfile]
  );

  const personaAvatarByName = useMemo(() => {
      const avatars = new Map<string, PersonaAvatarProfile>();
      personaProfiles.forEach(persona => {
          const key = normalizePersonaName(persona.name);
          if (key) avatars.set(key, persona);
      });
      return avatars;
  }, [personaProfiles]);

  const getPersonaForExplanationLine = (line: string): ExplanationSpeaker | undefined => {
      const speakerMatch = line.match(/^\s*(?:\[解説\]\s*)?([^:：\n]{1,60})\s*[:：]/);
      if (!speakerMatch) return undefined;

      const descriptor = stripPersonaFormatting(speakerMatch[1]);
      const roleFromLine = resolvePersonaRole(descriptor);
      const speakerName = cleanPersonaDisplayName(descriptor.replace(/[（(][^）)]*[）)]/g, ''));
      const normalizedSpeaker = normalizePersonaName(speakerName);
      if (!normalizedSpeaker) return undefined;
      const overrideRole = personaRoleOverrides[normalizedSpeaker];

      let persona = personaAvatarByName.get(normalizedSpeaker);
      if (!persona) {
          persona = personaProfiles.find(candidate => {
              const normalizedCandidate = normalizePersonaName(candidate.name);
              return normalizedCandidate.length >= 2
                  && normalizedSpeaker.length >= 2
                  && (normalizedCandidate.includes(normalizedSpeaker) || normalizedSpeaker.includes(normalizedCandidate));
          });
      }
      if (!persona && roleFromLine) {
          persona = personaProfiles.find(candidate => resolvePersonaRole(candidate.role) === roleFromLine);
      }
      if (!persona && personaProfiles.length === 1) {
          persona = personaProfiles[0];
      }

      const blockedLabels = new Set(['例', '例文', '意味', '文法', 'ポイント', '注意', '補足', '主語', '動詞', '目的語', 's', 'v', 'o', 'c']);
      if (!persona && !roleFromLine && !overrideRole && blockedLabels.has(normalizedSpeaker)) return undefined;

      const profileRole = persona ? resolvePersonaRole(persona.role) || persona.role : undefined;
      const role = overrideRole || profileRole || roleFromLine;
      return {
          name: speakerName || persona?.name || descriptor,
          role,
          avatar: (role ? PERSONA_AVATAR_BY_ROLE[role] : undefined) || persona?.avatar,
      };
  };

  
  const sortedGrammarTerms = useMemo(() => {
      return [...grammarTerms].sort((a, b) => b.term.length - a.term.length);
  }, []);

  // Precompile grammar terms RegExp to avoid recreating it multiple times during render
  const grammarTermsRegExp = useMemo(() => {
      const escapeRegExp = (string: string) => {
          return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      };
      if (sortedGrammarTerms.length === 0) return null;
      return new RegExp(`(${sortedGrammarTerms.map(t => escapeRegExp(t.term)).join('|')})`, 'g');
  }, [sortedGrammarTerms]);

  // Precompute registeredWords lookup optimization
  const precomputedRegisteredWords = useMemo(() => {
      return (registeredWords || []).map(c => {
          const contentWithoutNotes = c.front.toLowerCase()
              .replace(/\[.*?\]/g, '')
              .replace(/\(.*?\)/g, '')
              .replace(/【.*?】/g, '')
              .replace(/[^\w\s']/g, ''); 
          const cardWords: string[] = contentWithoutNotes.match(/[a-z0-9']+/g) || [];
          return { card: c, cardWords };
      });
  }, [registeredWords]);

  // Fast direct lookup logic targeting registered cards
  const findRegisteredCard = useCallback((cleanTranscriptWord: string) => {
      // Vocabulary cards are learning content, not user-created inline notes.
      // Keep them tappable even when the user temporarily hides inline notes.
      if (cleanTranscriptWord.length <= 1 || precomputedRegisteredWords.length === 0) return undefined;
      
      for (let i = 0; i < precomputedRegisteredWords.length; i++) {
          const { card, cardWords } = precomputedRegisteredWords[i];
          if (cardWords.includes(cleanTranscriptWord)) return card;
          if (cleanTranscriptWord.length >= 5) {
              const transcriptPrefix = cleanTranscriptWord.substring(0, 5);
              const hasPrefixMatch = cardWords.some(cw => cw.length >= 5 && cw.substring(0, 5) === transcriptPrefix);
              if (hasPrefixMatch) return card;
          }
          if (cleanTranscriptWord.endsWith('s') && cardWords.includes(cleanTranscriptWord.slice(0, -1))) return card;
          if (cleanTranscriptWord.endsWith('es') && cardWords.includes(cleanTranscriptWord.slice(0, -2))) return card;
          if (cleanTranscriptWord.endsWith('ed') && cardWords.includes(cleanTranscriptWord.slice(0, -2))) return card;
          if (cleanTranscriptWord.endsWith('d') && cardWords.includes(cleanTranscriptWord.slice(0, -1))) return card;
          if (cleanTranscriptWord.endsWith('ing') && cardWords.includes(cleanTranscriptWord.slice(0, -3))) return card;
      }
      return undefined;
  }, [precomputedRegisteredWords]);

  const cleanText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\[(?:その日本語訳|英文の第[0-9一二三四五六七八九十]+文)\]/g, '')
      .replace(/[\[\]]/g, '')
      .trim();
  };

  const formatPronunciation = (value?: string) => {
      if (!value) return '';
      const normalized = value.replace(/［/g, '[').replace(/］/g, ']');
      return normalized.includes('[') || normalized.includes(']') ? normalized : `[${normalized}]`;
  };

  const normalizeForMatch = (str: string) => str.toLowerCase().replace(/[^a-z0-9']/g, '');

  const { sentenceStartIndices, totalWordCount } = useMemo(() => {
      let count = 0;
      const indices = transcript.map(entry => {
          const currentStart = count;
          const words = cleanText(entry.english).trim().split(/\s+/).filter(w => w.length > 0);
          count += words.length;
          return currentStart;
      });
      return { sentenceStartIndices: indices, totalWordCount: count };
  }, [transcript]);

  const msSkipBackward = useCallback(() => {
      if (audioRef.current) {
          audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 3, 0);
      }
  }, []);

  const msSkipForward = useCallback(() => {
      if (audioRef.current) {
          audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 3, audioRef.current.duration);
      }
  }, []);

  const msPrevTrack = useCallback(() => {
      if (!audioRef.current || !transcript || transcript.length === 0) return;
      const t = audioRef.current.currentTime;
      const curIdx = transcript.findIndex(entry => t >= entry.start && t < entry.end);
      let targetTime = 0;
      
      if (curIdx !== -1) {
          if (t - transcript[curIdx].start > 1.5) {
              targetTime = transcript[curIdx].start;
          } else {
              if (curIdx > 0) targetTime = transcript[curIdx - 1].start;
              else targetTime = 0;
          }
      } else {
          for (let i = transcript.length - 1; i >= 0; i--) {
             if (transcript[i].start < t - 1.0) {
                 targetTime = transcript[i].start;
                 break;
             }
         }
      }
      audioRef.current.currentTime = targetTime;
  }, [transcript]);

  const msNextTrack = useCallback(() => {
      if (!audioRef.current || !transcript || transcript.length === 0) return;
      const t = audioRef.current.currentTime;
      const curIdx = transcript.findIndex(entry => t >= entry.start && t < entry.end);
      let targetTime = audioRef.current.duration;

      if (curIdx !== -1) {
        if (curIdx < transcript.length - 1) {
            targetTime = transcript[curIdx + 1].start;
        }
      } else {
         const next = transcript.find(entry => entry.start > t);
         if (next) targetTime = next.start;
      }
      audioRef.current.currentTime = targetTime;
  }, [transcript]);

  const safePlay = async (audioEl: HTMLAudioElement) => {
    try {
        await audioEl.play();
    } catch (e: any) {
        if (e.name === 'AbortError' || e.message?.includes('interrupted')) {
        } else {
            console.error("Playback failed", e);
        }
    }
  };

  useEffect(() => {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title || 'Audio Learning',
            artist: 'Audio-Sync Reader',
            album: 'My Collection',
            artwork: thumbnailUrl ? [
                { src: thumbnailUrl, sizes: '96x96', type: 'image/png' },
                { src: thumbnailUrl, sizes: '128x128', type: 'image/png' },
                { src: thumbnailUrl, sizes: '192x192', type: 'image/png' },
                { src: thumbnailUrl, sizes: '512x512', type: 'image/png' },
            ] : undefined
        });

        navigator.mediaSession.setActionHandler('play', () => {
            if (audioRef.current) {
                safePlay(audioRef.current);
                setIsPlaying(true);
            }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            if (audioRef.current) {
                audioRef.current.pause();
                setIsPlaying(false);
            }
        });
        navigator.mediaSession.setActionHandler('seekbackward', msSkipBackward);
        navigator.mediaSession.setActionHandler('seekforward', msSkipForward);
        navigator.mediaSession.setActionHandler('previoustrack', msPrevTrack);
        navigator.mediaSession.setActionHandler('nexttrack', msNextTrack);
    }
    
    return () => {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('seekbackward', null);
            navigator.mediaSession.setActionHandler('seekforward', null);
            navigator.mediaSession.setActionHandler('previoustrack', null);
            navigator.mediaSession.setActionHandler('nexttrack', null);
        }
    };
  }, [title, thumbnailUrl, msSkipBackward, msSkipForward, msPrevTrack, msNextTrack]);

  useEffect(() => {
      const timer = setTimeout(() => {
          if (globalMemo !== initialGlobalMemo || inlineNotes !== initialInlineNotes) {
              onUpdateMaterial(materialId, { globalMemo, inlineNotes });
          }
      }, 1000);
      return () => clearTimeout(timer);
  }, [globalMemo, inlineNotes, materialId, onUpdateMaterial, initialGlobalMemo, initialInlineNotes]);

  const handleTextSelection = useCallback(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
          return;
      }

      let anchorNode = selection.anchorNode;
      let focusNode = selection.focusNode;

      if (anchorNode?.nodeType === Node.TEXT_NODE) anchorNode = anchorNode.parentNode;
      if (focusNode?.nodeType === Node.TEXT_NODE) focusNode = focusNode.parentNode;

      if (!anchorNode || !focusNode) return;
      
      const anchorEl = (anchorNode as HTMLElement);
      const focusEl = (focusNode as HTMLElement);

      const anchorWord = anchorEl.closest('[id^="pacer-word-"]');
      const focusWord = focusEl.closest('[id^="pacer-word-"]');

      if (anchorWord && focusWord) {
          const startId = parseInt(anchorWord.id.replace('pacer-word-', ''), 10);
          const endId = parseInt(focusWord.id.replace('pacer-word-', ''), 10);
          
          const start = Math.min(startId, endId);
          const end = Math.max(startId, endId);
          
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          setSelectionMenu({
              top: rect.top + window.scrollY - 40,
              left: rect.left + (rect.width / 2) - 60,
              type: 'english',
              startGlobalIndex: start,
              endGlobalIndex: end
          });
          return;
      }

      const jpContainer = anchorEl.closest('[id^="sentence-jp-"]');
      if (jpContainer && jpContainer.contains(focusEl)) {
           const idParts = jpContainer.id.split('-');
           const sentenceIndex = parseInt(idParts[2], 10);
           const range = selection.getRangeAt(0);
           const preCaretRange = range.cloneRange();
           preCaretRange.selectNodeContents(jpContainer);
           preCaretRange.setEnd(range.startContainer, range.startOffset);
           const startOffset = preCaretRange.toString().length;
           const endOffset = startOffset + range.toString().length;
           const rect = range.getBoundingClientRect();
           setSelectionMenu({
               top: rect.top + window.scrollY - 40,
               left: rect.left + (rect.width / 2) - 60,
               type: 'japanese',
               sentenceIndex,
               characterRange: { start: startOffset, end: endOffset }
           });
           return;
      }

      const expContainer = anchorEl.closest('[id^="sentence-exp-"]');
      if (expContainer && expContainer.contains(focusEl)) {
           const idParts = expContainer.id.split('-');
           const sentenceIndex = parseInt(idParts[2], 10);
           const range = selection.getRangeAt(0);

           const getAbsoluteExplanationOffset = (node: Node, nodeOffset: number) => {
               const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as HTMLElement;
               const lineContainer = element?.closest('[data-exp-base]') as HTMLElement | null;
               if (!lineContainer) return null;

               const baseOffset = Number(lineContainer.dataset.expBase || '0');
               const localRange = document.createRange();
               localRange.selectNodeContents(lineContainer);
               localRange.setEnd(node, nodeOffset);
               return baseOffset + localRange.toString().length;
           };

           let startOffset = getAbsoluteExplanationOffset(range.startContainer, range.startOffset);
           let endOffset = getAbsoluteExplanationOffset(range.endContainer, range.endOffset);

           // Fallback for old/unstructured explanation DOM.
           if (startOffset === null || endOffset === null) {
               const preCaretRange = range.cloneRange();
               preCaretRange.selectNodeContents(expContainer);
               preCaretRange.setEnd(range.startContainer, range.startOffset);
               startOffset = preCaretRange.toString().length;
               endOffset = startOffset + range.toString().length;
           }

           const rect = range.getBoundingClientRect();
           setSelectionMenu({
               top: rect.top + window.scrollY - 40,
               left: rect.left + (rect.width / 2) - 60,
               type: 'explanation',
               sentenceIndex,
               characterRange: {
                   start: Math.min(startOffset, endOffset),
                   end: Math.max(startOffset, endOffset)
               }
           });
           return;
      }
      setSelectionMenu(null);
  }, []);

  const handleClearSelection = () => {
      const selection = window.getSelection();
      if (selection) selection.removeAllRanges();
      setSelectionMenu(null);
      setIsNoteInputOpen(false);
  };

  const handleAddNoteClick = () => {
      if (selectionMenu) {
          setNewNoteText('');
          setIsNoteInputOpen(true);
      }
  };

  const handleSaveNote = () => {
      if (selectionMenu && newNoteText.trim()) {
          const newNote: InlineNote = {
              id: Date.now().toString(),
              text: newNoteText,
              createdAt: new Date(),
              color: 'yellow',
              target: selectionMenu.type,
          };
          if (selectionMenu.type === 'english') {
              newNote.startGlobalIndex = selectionMenu.startGlobalIndex;
              newNote.endGlobalIndex = selectionMenu.endGlobalIndex;
          } else {
              newNote.sentenceIndex = selectionMenu.sentenceIndex;
              newNote.characterRange = selectionMenu.characterRange;
          }
          setInlineNotes(prev => [...prev, newNote]);
          setIsNoteInputOpen(false);
          setSelectionMenu(null);
          handleClearSelection();
      }
  };

  const handleDeleteNote = (noteId: string) => {
      setInlineNotes(prev => prev.filter(n => n.id !== noteId));
      setActiveNote(null);
  };

  const getEnglishNoteForWord = (globalIndex: number) => {
      return inlineNotes.find(note => 
          (!note.target || note.target === 'english') && 
          note.startGlobalIndex !== undefined && 
          note.endGlobalIndex !== undefined && 
          globalIndex >= note.startGlobalIndex && 
          globalIndex <= note.endGlobalIndex
      );
  };
  
  const handleSingleWordClick = (e: React.MouseEvent<HTMLSpanElement>, globalIndex: number, registeredCard?: Card) => {
      e.stopPropagation();
      e.preventDefault();
      if (registeredCard) {
          const rect = e.currentTarget.getBoundingClientRect();
          setActiveWordPopup({
              card: registeredCard,
              position: { top: rect.top, left: rect.left, width: rect.width }
          });
          setSelectionMenu(null);
          if (window.getSelection) {
              window.getSelection()?.removeAllRanges();
          }
          return;
      }
      const existingNote = getEnglishNoteForWord(globalIndex);
      if (existingNote && showInlineNotes) {
          setActiveNote(existingNote);
          setSelectionMenu(null);
          return;
      }
  };

  const handleGrammarTermClick = (e: React.MouseEvent<HTMLSpanElement>, term: GrammarTerm) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveGrammarTerm({
          term,
          position: { top: rect.top, left: rect.left, width: rect.width }
      });
      setActiveWordPopup(null);
  };

  const renderGrammarTerms = (text: string) => {
      if (!grammarTermsRegExp) return text;
      const parts = text.split(grammarTermsRegExp);
      return parts.map((part, i) => {
          const term = sortedGrammarTerms.find(t => t.term === part);
          if (term) {
              return (
                  <span 
                      key={i} 
                      role="button"
                      tabIndex={0}
                      className="border-b border-dotted border-gray-400 cursor-help hover:text-sky-400 hover:border-sky-400 transition-colors"
                      onClick={(e) => handleGrammarTermClick(e, term)}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleGrammarTermClick(e as unknown as React.MouseEvent<HTMLSpanElement>, term);
                          }
                      }}
                  >
                      {part}
                  </span>
              );
          }
          return part;
      });
  };
  
  const renderTextWithNotes = (
      text: string,
      sentenceIndex: number,
      type: 'japanese' | 'explanation',
      baseOffset = 0
  ) => {
      const segmentStart = baseOffset;
      const segmentEnd = baseOffset + text.length;
      const notes = inlineNotes.filter(n => {
          if (n.target !== type || n.sentenceIndex !== sentenceIndex || !n.characterRange) return false;
          if (type !== 'explanation') return true;
          return n.characterRange.end > segmentStart && n.characterRange.start < segmentEnd;
      });

      if (notes.length === 0 || !showInlineNotes) {
          return renderGrammarTerms(text);
      }

      const sortedNotes = [...notes].sort((a, b) =>
          Math.max(0, (a.characterRange?.start || 0) - baseOffset) -
          Math.max(0, (b.characterRange?.start || 0) - baseOffset)
      );
      const segments: React.ReactNode[] = [];
      let currentIndex = 0;

      sortedNotes.forEach((note) => {
          const absoluteStart = note.characterRange!.start;
          const absoluteEnd = note.characterRange!.end;
          const start = type === 'explanation' ? Math.max(0, absoluteStart - baseOffset) : absoluteStart;
          const end = type === 'explanation' ? Math.min(text.length, absoluteEnd - baseOffset) : absoluteEnd;
          const effectiveStart = Math.max(currentIndex, start);

          if (end <= effectiveStart) return;
          if (effectiveStart > currentIndex) {
              segments.push(renderGrammarTerms(text.substring(currentIndex, effectiveStart)));
          }
          segments.push(
              <span
                  key={`${note.id}-${baseOffset}`}
                  onClick={(e) => { e.stopPropagation(); setActiveNote(note); }}
                  className="border-b-2 border-dotted border-yellow-400 bg-yellow-400/20 cursor-pointer"
              >
                  {text.substring(effectiveStart, end)}
              </span>
          );
          currentIndex = end;
      });

      if (currentIndex < text.length) {
          segments.push(renderGrammarTerms(text.substring(currentIndex)));
      }
      return segments;
  };

  const renderExplanationWithPersonas = (text: string, sentenceIndex: number) => {
      const lines = text.split('\n');
      let baseOffset = 0;

      return (
          <div className="space-y-1.5">
              {lines.map((line, lineIndex) => {
                  const lineBaseOffset = baseOffset;
                  baseOffset += line.length + (lineIndex < lines.length - 1 ? 1 : 0);
                  const speaker = getPersonaForExplanationLine(line);
                  const lineContent = (
                      <div
                          data-exp-base={lineBaseOffset}
                          className="min-w-0 flex-1 leading-relaxed"
                      >
                          {line
                              ? renderTextWithNotes(line, sentenceIndex, 'explanation', lineBaseOffset)
                              : <span aria-hidden="true">&nbsp;</span>
                          }
                      </div>
                  );

                  if (!speaker) {
                      return <div key={`exp-line-${lineIndex}`}>{lineContent}</div>;
                  }

                  const initial = Array.from(speaker.name.trim())[0] || '？';
                  const inlineRole = PERSONA_ROLE_KEYS.find(role => line.includes(role));
                  const resolvedRole = speaker.role || inlineRole;
                  const resolvedAvatar = speaker.avatar || (resolvedRole ? PERSONA_AVATAR_BY_ROLE[resolvedRole] : undefined);
                  const avatarTitle = resolvedRole ? `${speaker.name}・${resolvedRole}` : speaker.name;

                  return (
                      <div key={`exp-line-${lineIndex}`} className="flex items-start gap-2.5">
                          <button
                              type="button"
                              onClick={(event) => {
                                  event.stopPropagation();
                                  setPersonaRolePicker({ name: speaker.name });
                              }}
                              className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex-shrink-0 border border-white/15 shadow-md bg-gradient-to-br from-sky-500/70 to-violet-500/70 flex items-center justify-center active:scale-95 transition-transform"
                              title={resolvedAvatar ? `${avatarTitle}（タップでキャラ変更）` : `${speaker.name}のキャラを選ぶ`}
                              aria-label={resolvedAvatar ? `${speaker.name}のキャラを変更` : `${speaker.name}のキャラを選ぶ`}
                          >
                              <span className="text-sm font-black text-white" aria-hidden="true">{initial}</span>
                              {resolvedAvatar && (
                                  <img
                                      src={resolvedAvatar}
                                      data-persona-avatar={resolvedAvatar}
                                      alt=""
                                      aria-hidden="true"
                                      loading="lazy"
                                      decoding="async"
                                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                                      className="absolute inset-0 w-full h-full rounded-full object-cover"
                                  />
                              )}
                              {!resolvedAvatar && (
                                  <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-sky-500 text-white border border-white/70 text-[11px] font-black leading-[14px] shadow" aria-hidden="true">+</span>
                              )}
                          </button>
                          {lineContent}
                      </div>
                  );
              })}
          </div>
      );
  };

  const hasMedia = mediaUrl !== null;
  const hasTranscript = transcript && transcript.length > 0;
  const hasExplanation = transcript.some(t => t.explanation);

  const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const absSeconds = Math.abs(seconds);
    const m = Math.floor(absSeconds / 60);
    const s = Math.floor(absSeconds % 60);
    return `${seconds < 0 ? '+' : ''}${m}:${s.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (useTTS) {
      if (isPlaying) {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        setIsPlaying(false);
      } else {
        setIsPlaying(true);
        const curIdx = transcript.findIndex(t => currentTime >= t.start && currentTime < t.end);
        const startIdx = curIdx !== -1 ? curIdx : 0;
        speakSentence(startIdx);
      }
    } else {
      const audio = audioRef.current;
      if (audio) {
        if (isPlaying) {
          audio.pause();
          setIsPlaying(false);
        } else {
          safePlay(audio);
          setIsPlaying(true);
        }
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (useTTS) {
      if (isPlaying) {
        const curIdx = transcript.findIndex(t => time >= t.start && time < t.end);
        if (curIdx !== -1) {
          speakSentence(curIdx);
        }
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const skipForward = () => {
    if (useTTS) {
      const curIdx = transcript.findIndex(t => currentTime >= t.start && currentTime < t.end);
      if (curIdx !== -1 && curIdx + 1 < transcript.length) {
        const nextTime = transcript[curIdx + 1].start;
        setCurrentTime(nextTime);
        if (isPlaying) {
          speakSentence(curIdx + 1);
        }
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 3, duration);
    }
  };

  const skipBackward = () => {
    if (useTTS) {
      const curIdx = transcript.findIndex(t => currentTime >= t.start && currentTime < t.end);
      if (curIdx !== -1 && curIdx > 0) {
        const prevTime = transcript[curIdx - 1].start;
        setCurrentTime(prevTime);
        if (isPlaying) {
          speakSentence(curIdx - 1);
        }
      }
    } else if (audioRef.current) {
      audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 3, 0);
    }
  };

  const handlePrevSentence = () => {
    if (!transcript || transcript.length === 0) return;
    const curIdx = transcript.findIndex(t => currentTime >= t.start && currentTime < t.end);
    let targetIdx = 0;
    if (curIdx !== -1) {
         if (currentTime - transcript[curIdx].start > 1.5) {
             targetIdx = curIdx;
         } else {
             if (curIdx > 0) targetIdx = curIdx - 1;
             else targetIdx = 0;
         }
    } else {
         for (let i = transcript.length - 1; i >= 0; i--) {
             if (transcript[i].start < currentTime - 1.0) {
                 targetIdx = i;
                 break;
             }
         }
    }
    const targetTime = transcript[targetIdx].start;
    setCurrentTime(targetTime);
    if (useTTS) {
        if (isPlaying) {
            speakSentence(targetIdx);
        }
    } else if (audioRef.current) {
        audioRef.current.currentTime = targetTime;
    }
  };

  const handleNextSentence = () => {
    if (!transcript || transcript.length === 0) return;
    const curIdx = transcript.findIndex(t => currentTime >= t.start && currentTime < t.end);
    let targetIdx = transcript.length - 1;
    if (curIdx !== -1) {
        if (curIdx < transcript.length - 1) {
            targetIdx = curIdx + 1;
        }
    } else {
         const next = transcript.find(t => t.start > currentTime);
         if (next) targetIdx = transcript.indexOf(next);
    }
    const targetTime = transcript[targetIdx].start;
    setCurrentTime(targetTime);
    if (useTTS) {
        if (isPlaying) {
            speakSentence(targetIdx);
        }
    } else if (audioRef.current) {
        audioRef.current.currentTime = targetTime;
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = mainVolume;
    }
  }, [mainVolume]);

  useEffect(() => {
    const bgmAudio = bgmAudioRef.current;
    if (bgmAudio) {
        bgmAudio.volume = bgmVolume;
    }
  }, [bgmVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleLoadedMetadata = () => setDuration(audio.duration);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.playbackRate = playbackRate;
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [playbackRate]);
  
  useEffect(() => {
    if (bgmFile) {
        const url = URL.createObjectURL(bgmFile);
        setBgmUrl(url);
    }
  }, [bgmFile]);

  useEffect(() => {
    return () => {
        if (bgmUrl) {
            URL.revokeObjectURL(bgmUrl);
        }
    }
  }, [bgmUrl]);
  
  useEffect(() => {
    const bgmAudio = bgmAudioRef.current;
    if (!bgmAudio) return;
    if (isBgmPlaying) {
        safePlay(bgmAudio);
    } else {
        bgmAudio.pause();
    }
  }, [isBgmPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const animate = () => {
      const newTime = audio.currentTime;
      setCurrentTime(newTime);
      if (abLoop.a !== null && abLoop.b !== null && audio.currentTime >= abLoop.b) {
        audio.currentTime = abLoop.a;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, abLoop.a, abLoop.b]);
  
  useEffect(() => {
      if (speedTimerState === 'running') {
          speedTimerRef.current = window.setInterval(() => {
              setTimeRemaining(prev => prev - 1);
          }, 1000);
      } else {
          if (speedTimerRef.current) {
              clearInterval(speedTimerRef.current);
              speedTimerRef.current = null;
          }
      }
      return () => {
          if (speedTimerRef.current) clearInterval(speedTimerRef.current);
      }
  }, [speedTimerState]);

  useEffect(() => {
      let pacerInterval: number | null = null;
      if (speedTimerState === 'running' && isPacerEnabled) {
          const msPerWord = (60 / wpmLevel) * 1000;
          const intervalMs = msPerWord * chunkSize;
          pacerInterval = window.setInterval(() => {
              setCurrentPacerIndex(prev => {
                  const next = prev + chunkSize;
                  const el = document.getElementById(`pacer-word-${next}`);
                  if (el && scrollContainerRef.current) {
                      const rect = el.getBoundingClientRect();
                      const containerRect = scrollContainerRef.current.getBoundingClientRect();
                      const triggerZone = containerRect.height * 0.7; 
                      const relativeTop = rect.top - containerRect.top;
                      if (relativeTop > triggerZone || relativeTop < 0) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                  }
                  if (next >= totalWordCount) {
                      handleSpeedStop();
                      return prev;
                  }
                  return next;
              });
          }, intervalMs);
      }
      return () => {
          if (pacerInterval) clearInterval(pacerInterval);
      };
  }, [speedTimerState, isPacerEnabled, wpmLevel, totalWordCount, chunkSize]);

  const handleSpeedStart = () => {
      const calculatedSeconds = Math.ceil((totalWordCount / wpmLevel) * 60);
      setTargetDuration(calculatedSeconds);
      setTimeRemaining(calculatedSeconds);
      setSpeedTimerState('running');
      setIsSpeedSettingsOpen(false);
      setCurrentPacerIndex(0);
      setShowJapanese(false);
      setShowExplanation(false);
      if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };
  const handleSpeedStop = () => {
      setSpeedTimerState('finished');
  };
  const handleSpeedReset = () => {
      setSpeedTimerState('idle');
      setCurrentPacerIndex(-1);
      setIsSpeedSettingsOpen(true);
  };
  const handleCloseSpeedMode = () => {
      setSpeedTimerState('idle');
      setCurrentPacerIndex(-1);
      setIsSpeedMode(false);
      setIsSpeedSettingsOpen(false);
  };

  return (
    <div ref={readerScreenRef} className={`memora-reader-screen ${isHeaderVisible ? 'memora-reader-screen--header-visible' : ''} flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden ${T.bg} ${T.textPrimary}`}>
      {/* RSVP Screen Overlay */}
      {isRsvpModeOpen && (
          <RsvpScreen 
            transcript={transcript} 
            onClose={() => setIsRsvpModeOpen(false)} 
          />
      )}

      {/* Audio Element */}
      {mediaUrl && (
        <audio
          ref={audioRef}
          src={mediaUrl}
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
      )}
       {bgmUrl && (
          <audio
            ref={bgmAudioRef}
            src={bgmUrl}
            loop
          />
        )}

      {/* Header */}
      {isHeaderVisible ? (
      <div className={`memora-reader-header flex-shrink-0 h-14 flex items-center justify-between px-4 border-b ${T.border} ${T.panelBg} z-20 transition-all duration-100 relative shadow-sm`}>
        {isSpeedMode && speedTimerState !== 'idle' ? (
            // Speed Reading Timer Header
            <div className="flex-grow flex items-center justify-between animate-fade-in">
                <button onClick={handleCloseSpeedMode} className={`p-2 rounded-full ${T.button} hover:bg-white/10 mr-2`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                </button>
                <div className="flex-grow flex flex-col items-center mx-4">
                    <div className={`text-2xl font-mono font-bold leading-none ${timeRemaining < 0 ? 'text-red-500 animate-pulse' : timeRemaining < targetDuration * 0.2 ? 'text-yellow-400' : T.textPrimary}`}>
                        {formatTime(timeRemaining)}
                    </div>
                    <div className="w-full max-w-xs h-1.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
                         <div 
                            className={`h-full transition-all duration-1000 ease-linear ${timeRemaining < 0 ? 'bg-red-500 w-full' : timeRemaining < targetDuration * 0.2 ? 'bg-yellow-400' : 'bg-green-500'}`}
                            style={{ width: timeRemaining < 0 ? '100%' : `${(timeRemaining / targetDuration) * 100}%` }}
                         />
                    </div>
                </div>
                {speedTimerState === 'running' ? (
                    <button onClick={handleSpeedStop} className="px-4 py-1 bg-red-500 text-white rounded-full font-bold shadow-lg hover:brightness-110 text-sm">
                        STOP
                    </button>
                ) : (
                    <button onClick={handleSpeedReset} className={`px-4 py-1 ${T.buttonStrong} rounded-full font-bold text-sm`}>
                        設定へ
                    </button>
                )}
            </div>
        ) : (
            // Normal Header
            <>
                <div className="flex items-center gap-2 overflow-hidden min-w-0 flex-1">
                    <button onClick={onBack} className={`p-2 rounded-full ${T.button} hover:bg-white/10 transition-colors flex-shrink-0`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                    </button>
                    <h1 className="font-bold text-lg truncate min-w-0 flex-1">{title}</h1>
                    <div className="sm:hidden flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={() => {
                                const nextShow = !showJapanese;
                                setShowJapanese(nextShow);
                                if (!nextShow) setIsSideBySide(false);
                            }}
                            aria-pressed={showJapanese}
                            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-bold border ${showJapanese ? 'text-sky-300 border-sky-400/40 bg-sky-400/10' : `${T.textMuted} ${T.border} bg-white/5`}`}
                            title="日本語訳を表示"
                        >
                            <TranslateIcon className="w-4 h-4" />
                            <span>訳</span>
                        </button>
                        {hasExplanation && (
                            <button
                                onClick={() => setShowExplanation(prev => !prev)}
                                aria-pressed={showExplanation}
                                className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-bold border ${showExplanation ? 'text-yellow-300 border-yellow-400/40 bg-yellow-400/10' : `${T.textMuted} ${T.border} bg-white/5`}`}
                                title="解説を表示"
                            >
                                <LightBulbIcon className="w-4 h-4" />
                                <span>解説</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsMoreMenuOpen(true)}
                            className={`p-1.5 rounded-full border ${T.border} ${T.textMuted} bg-white/5`}
                            title="その他の機能"
                            aria-label="その他の機能を開く"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <circle cx="5" cy="12" r="1.8" />
                                <circle cx="12" cy="12" r="1.8" />
                                <circle cx="19" cy="12" r="1.8" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div className="hidden sm:flex items-center gap-2 overflow-x-auto scrollbar-hide flex-shrink-0">
                    <button
                        onClick={() => setShowInlineNotes(!showInlineNotes)}
                        className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 ${showInlineNotes ? 'text-yellow-400' : 'text-gray-500'}`}
                        title="単語の黄色表示とメモの表示/非表示"
                        aria-label="単語の黄色表示とメモを切り替える"
                    >
                        <EyeIcon off={!showInlineNotes} />
                    </button>

                    <button
                        onClick={() => setIsGlobalMemoOpen(true)}
                        className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 text-white relative`}
                        title="全体メモ"
                    >
                        <NoteIcon />
                        {globalMemo.trim() && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>}
                    </button>

                    <button
                        onClick={() => {
                            const nextSide = !isSideBySide;
                            setIsSideBySide(nextSide);
                            if (nextSide) {
                                setShowJapanese(true);
                                setShowEnglish(true);
                            }
                        }}
                        className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 ${isSideBySide ? 'text-sky-400 bg-sky-400/10' : 'text-gray-500'}`}
                        title="左右対訳表示モード"
                    >
                        <ColumnsIcon className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => {
                            const nextShow = !showJapanese;
                            setShowJapanese(nextShow);
                            if (!nextShow) {
                                setIsSideBySide(false);
                            }
                        }}
                        className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 ${showJapanese ? 'text-sky-400 bg-sky-400/10' : 'text-gray-500'}`}
                        title="日本語訳の表示/非表示"
                    >
                        <TranslateIcon className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => {
                            if (isPlaying) {
                                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                                setIsPlaying(false);
                            } else {
                                if (!useTTS) {
                                    setUseTTS(true);
                                }
                                setIsPlaying(true);
                                const curIdx = transcript.findIndex(t => currentTime >= t.start && currentTime < t.end);
                                const startIdx = curIdx !== -1 ? curIdx : 0;
                                speakSentence(startIdx);
                            }
                        }}
                        className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 ${isPlaying ? 'text-rose-500 bg-rose-500/10 animate-pulse' : 'text-gray-500'}`}
                        title={isPlaying ? "自動読み上げ(TTS)を一時停止" : "自動読み上げ(TTS)を再生"}
                    >
                        {isPlaying ? (
                            <PauseIcon className="w-5 h-5" />
                        ) : (
                            <VolumeIcon className="w-5 h-5" />
                        )}
                    </button>

                    <button
                        onClick={() => setIsPdfModalOpen(true)}
                        className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-rose-500/20 text-rose-400`}
                        title="教材PDF印刷・B5対訳出力"
                    >
                        <PdfIcon />
                    </button>

                    {/* WPM Timer (Normal Mode) */}
                    <button
                        onClick={() => {
                            setIsSpeedMode(true);
                            setIsSpeedSettingsOpen(true);
                        }}
                        className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 text-green-400`}
                        title="WPM測定 (スピードリーディング)"
                    >
                        <StopwatchIcon />
                    </button>

                    {/* Spartan Reader Mode (RSVP) Toggle */}
                    <button
                        onClick={() => setIsRsvpModeOpen(true)}
                        className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 text-[#00f0ff] animate-pulse`}
                        title="速読トレーニング (Spartan Reader)"
                    >
                        <FlashIcon />
                    </button>

                    {personaProfile && (
                        <button
                            onClick={() => setIsProfileModalOpen(true)}
                            className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 text-purple-400`}
                            title="解説者プロフィール"
                        >
                        <CommentaryIcon />
                        </button>
                    )}
                    {backgroundInfo && (
                        <button
                            onClick={() => setIsBackgroundModalOpen(true)}
                            className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 text-amber-400`}
                            title="背景知識・雑学"
                        >
                        <InfoIcon />
                        </button>
                    )}
                    {hasQuizFile && (
                        <button
                            onClick={() => onStartQuiz(materialId)}
                            className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 text-indigo-400`}
                            title="クイズ"
                        >
                        <QuizIcon />
                        </button>
                    )}
                    {!hasQuizFile && (
                        <button 
                            onClick={() => setIsQuizModalOpen(true)}
                            className={`p-2 rounded-full flex-shrink-0 ${T.button} hover:bg-white/10 text-gray-400`}
                            title="クイズを作成"
                        >
                            <QuizIcon className="opacity-50" />
                        </button>
                    )}
                </div>
            </>
        )}
        {!isSpeedMode && (
            <button 
                onClick={() => setIsHeaderVisible(false)}
                className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-16 h-5 rounded-b-lg ${T.panelBg} border-b border-x ${T.border} flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-sm z-0 group opacity-50 hover:opacity-100`}
                title="ヘッダーを隠す"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${T.textMuted} group-hover:${T.textPrimary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                </svg>
            </button>
        )}
      </div>
      ) : (
        <button 
            onClick={() => setIsHeaderVisible(true)}
            className={`fixed top-4 right-4 p-3 rounded-full ${T.accentBg} text-white shadow-xl z-30 hover:scale-110 active:scale-95 transition-all animate-fade-in bg-opacity-90 backdrop-blur-sm`}
            title="ヘッダーを表示"
        >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
      )}
      
      {/* Main Content Area */}
      <div className="memora-reader-main flex-grow relative overflow-hidden bg-transparent" ref={contentWrapperRef}>
          
          {/* Backdrop for closing popups (Selection Menu / Note Input) */}
          {(selectionMenu || isNoteInputOpen) && (
              <div 
                className="absolute inset-0 z-40 bg-transparent" 
                onClick={(e) => {
                    handleClearSelection();
                }}
              />
          )}

          {/* Text Scroll Container */}
          <div 
            ref={scrollContainerRef}
            className={`memora-reader-scroll absolute inset-0 overflow-y-auto p-4 transition-all duration-500 ${isImmersive ? 'px-8 sm:px-16' : ''}`}
            style={{ 
                fontSize: `${fontSize}%`, 
                fontFamily: fontFamily,
                paddingBottom: isControlsVisible ? '12rem' : '5rem',
                paddingTop: isHeaderVisible ? '1rem' : '2rem' 
            }}
            onMouseUp={handleTextSelection}
          >
              {transcript.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center h-full opacity-50`}>
                      <p>テキストデータがありません</p>
                  </div>
              ) : (
                  <div className="memora-reader-document max-w-4xl mx-auto space-y-6">
                      <aside className="memora-reader-guide" aria-label="読解担当キャラクター">
                          <div>
                              <span>READ</span>
                              <strong>教材を読む</strong>
                              <small>黄色の単語をタップすると、意味とメモを確認できます。</small>
                          </div>
                          <img src="/memora-world/read-v1.webp" alt="" aria-hidden="true" draggable={false} />
                      </aside>
                      {transcript.map((entry, index) => {
                          const isActive = currentTime >= entry.start && currentTime < entry.end;
                          const sentenceStartIndex = sentenceStartIndices[index];
                          const words = cleanText(entry.english).trim().split(/\s+/).filter(w => w.length > 0);

                          return (
                              <div 
                                key={index} 
                                id={`sentence-${index}`}
                                className={`memora-reader-sentence relative p-4 rounded-xl transition-all duration-100 ${isActive && isPlaying ? `${T.highlightBg} scale-[1.01] shadow-lg ring-1 ${T.accent}` : 'hover:bg-white/5'} group`}
                              >
                                   {(hasMedia || useTTS) && (
                                       <button 
                                          onClick={() => { 
                                              if (useTTS) {
                                                   setIsPlaying(true);
                                                   speakSentence(index);
                                               } else if (audioRef.current) {
                                                  audioRef.current.currentTime = entry.start; 
                                                  safePlay(audioRef.current);
                                                  setIsPlaying(true);
                                              }
                                          }}
                                          className="absolute -left-2 top-4 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-sky-400"
                                       >
                                          <PlayIcon />
                                       </button>
                                   )}

                                   <div className={isSideBySide ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-2"}>
                                       {/* English Column */}
                                       <div className={isSideBySide ? "pr-3 md:border-r md:border-white/10" : ""}>
                                           {showEnglish && (
                                       <div className={`font-medium leading-relaxed mb-2 ${isActive ? 'text-white' : T.textPrimary}`}>
                                           {words.map((word, wIdx) => {
                                               const globalWordIndex = sentenceStartIndex + wIdx;
                                               const isPacerActive = speedTimerState === 'running' && 
                                                                     isPacerEnabled && 
                                                                     globalWordIndex >= currentPacerIndex && 
                                                                     globalWordIndex < currentPacerIndex + chunkSize;
                                               
                                               const cleanTranscriptWord = normalizeForMatch(word);
                                               
                                               const registeredCard = findRegisteredCard(cleanTranscriptWord);
                                               const note = showInlineNotes ? getEnglishNoteForWord(globalWordIndex) : null;
                                               return (
                                                   <span 
                                                      key={wIdx} 
                                                      id={`pacer-word-${globalWordIndex}`}
                                                      data-word-card={registeredCard ? registeredCard.front : undefined}
                                                      role={registeredCard || note ? 'button' : undefined}
                                                      tabIndex={registeredCard || note ? 0 : undefined}
                                                      onClick={(e) => handleSingleWordClick(e, globalWordIndex, registeredCard)}
                                                      onKeyDown={(e) => {
                                                          if ((registeredCard || note) && (e.key === 'Enter' || e.key === ' ')) {
                                                              e.preventDefault();
                                                              handleSingleWordClick(e as unknown as React.MouseEvent<HTMLSpanElement>, globalWordIndex, registeredCard);
                                                          }
                                                      }}
                                                      className={`inline-block pr-1.5 transition-all duration-100 rounded-sm cursor-text select-text relative
                                                        ${isPacerActive ? `border-b-2 ${T.textPrimary}` : ''}
                                                        ${note ? 'border-b-2 border-dotted border-yellow-400 bg-yellow-400/20 cursor-pointer' : ''}
                                                        ${registeredCard && showInlineNotes ? 'border-b-2 border-yellow-300 bg-yellow-300/25 text-yellow-100 font-bold cursor-pointer' : ''}
                                                        ${registeredCard && !showInlineNotes ? 'cursor-pointer' : ''}
                                                      `}
                                                      style={{
                                                          ...(isPacerActive ? { borderColor: 'var(--accent-color, #38bdf8)', color: 'var(--accent-color, #38bdf8)' } : {}),
                                                          touchAction: registeredCard || note ? 'manipulation' : 'auto',
                                                          WebkitTapHighlightColor: 'transparent',
                                                      }}
                                                   >
                                                       {word}
                                                   </span>
                                               );
                                           })}
                                       </div>
                                   )}
                                   
                                       </div>

                                       {/* Japanese Column */}
                                       <div>
                                           {showJapanese && entry.japanese && cleanText(entry.japanese) && (
                                       <p 
                                            id={`sentence-jp-${index}`}
                                            className={`leading-relaxed ${T.textPrimary} ${isSideBySide ? '' : `border-l-2 ${T.accent} pl-3 mb-2`}`}
                                        >
                                           {renderTextWithNotes(cleanText(entry.japanese), index, 'japanese')}
                                       </p>
                                   )}

                                       </div>
                                   </div>

                                   {showExplanation && entry.explanation && (
                                       <div 
                                            id={`sentence-exp-${index}`}
                                            className={`memora-reader-explanation mt-3 p-3 rounded-lg bg-black/20 border border-white/5 ${T.textSecondary} whitespace-pre-wrap`}
                                            style={{ fontSize: '0.7em' }}
                                        >
                                           <div className="flex items-center gap-2 mb-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                                               <LightBulbIcon className="w-5 h-5" />
                                           </div>
                                           {renderExplanationWithPersonas(
                                               entry.explanation
                                                .replace(/__PERSONA_PROFILE__[\s\S]*?__END_PERSONA__/, '')
                                                .replace(/__BACKGROUND_INFO__[\s\S]*?__END_BACKGROUND__/, '')
                                                .replace(/(?:命名した|名前)[:：]\s*/g, '')
                                                .replace(/命名した/g, '')
                                                .replace(/\[(?:その日本語訳|英文の第[0-9一二三四五六七八九十]+文)\]/g, '')
                                                .trim(),
                                               index
                                           )}
                                       </div>
                                   )}
                              </div>
                          );
                      })}
                      <section className="memora-reader-complete" aria-label="読了後の学習案内">
                          <img src="/memora-world/read-v2.webp" alt="" aria-hidden="true" draggable={false} />
                          <div>
                              <span>READ COMPLETE</span>
                              <h2>読み終わりました！</h2>
                              <p>次は、単語の復習か確認クイズへ進めます。</p>
                              <div>
                                  {hasWordFile && <button type="button" onClick={() => onStartStudy(materialId)}>単語を復習</button>}
                                  <button type="button" onClick={() => hasQuizFile ? onStartQuiz(materialId) : setIsQuizModalOpen(true)}>クイズへ</button>
                              </div>
                          </div>
                      </section>
                  </div>
              )}
          </div>
          
          {selectionMenu && !isNoteInputOpen && (
              <div 
                className="absolute z-50 animate-fade-in flex gap-2"
                style={{ top: selectionMenu.top, left: selectionMenu.left }}
              >
                  <button 
                    onClick={handleAddNoteClick}
                    className={`${T.containerBg} text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl border ${T.border} flex items-center gap-2 hover:bg-white/20`}
                  >
                      <NoteIcon className="w-4 h-4" />
                      メモを追加
                  </button>
              </div>
          )}
          
          {isNoteInputOpen && selectionMenu && (
               <div 
                className="absolute z-50 animate-fade-in"
                style={{ top: selectionMenu.top, left: selectionMenu.left - 100 }}
              >
                  <div className={`${T.containerBg} p-3 rounded-lg shadow-xl border ${T.border} w-64`}>
                      <textarea 
                        autoFocus
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        placeholder="メモを入力..."
                        rows={3}
                        className={`w-full p-2 text-sm ${T.button} ${T.textSecondary} rounded-md resize-none mb-2 focus:outline-none`}
                      />
                      <div className="flex justify-end gap-2">
                          <button onClick={handleClearSelection} className={`px-2 py-1 text-xs ${T.button} rounded`}>キャンセル</button>
                          <button onClick={handleSaveNote} className={`px-2 py-1 text-xs ${T.accentBg} text-white rounded font-bold`}>保存</button>
                      </div>
                  </div>
              </div>
          )}
          
          {activeNote && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setActiveNote(null)}>
                  <div className={`${T.containerBg} p-4 rounded-lg shadow-xl max-w-sm w-full border ${T.border} animate-fade-in`} onClick={(e) => e.stopPropagation()}>
                      <h4 className={`font-bold ${T.textPrimary} mb-2 border-b ${T.border} pb-2 flex justify-between items-center`}>
                          <span>メモ</span>
                          <button onClick={() => handleDeleteNote(activeNote.id)} className="text-red-400 hover:text-red-300">
                              <TrashIcon className="w-4 h-4" />
                          </button>
                      </h4>
                      <p className={`${T.textSecondary} whitespace-pre-wrap mb-4 text-sm`}>{activeNote.text}</p>
                      <div className="flex justify-end">
                          <button onClick={() => setActiveNote(null)} className={`px-3 py-1 text-sm ${T.button} rounded`}>閉じる</button>
                      </div>
                  </div>
              </div>
          )}

      </div>

      {!isSpeedMode && (
        <>
            {isControlsVisible ? (
                <div
                    className={`fixed inset-x-0 bottom-0 sm:relative sm:inset-x-auto sm:bottom-auto flex-shrink-0 flex flex-col gap-1 px-3 py-2 ${T.panelBg} border-t ${T.border} transition-all duration-100 z-30 sm:z-20 pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.3)]`}
                    style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
                >
                    <button 
                        onClick={() => setIsControlsVisible(false)}
                        className={`absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-5 rounded-t-lg ${T.panelBg} border-t border-x ${T.border} flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-sm z-0 group`}
                        title="プレイヤーを隠す"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${T.textMuted} group-hover:${T.textPrimary}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {(hasMedia || useTTS) && (
                        <div className="flex items-center gap-3 select-none w-full">
                            <span className="text-[10px] font-mono opacity-70 w-10 text-right tabular-nums flex-shrink-0">
                                {formatTime(currentTime)}
                            </span>
                            <input 
                                type="range" 
                                min={0} 
                                max={duration || 100} 
                                value={currentTime}
                                onChange={handleSeek}
                                className={`flex-grow h-1 rounded-full appearance-none cursor-pointer bg-gray-700 accent-sky-500`}
                                style={{ backgroundImage: `linear-gradient(to right, var(--tw-gradient-from) 0%, var(--tw-gradient-to) ${(currentTime / (duration || 1)) * 100}%, rgb(55 65 81) ${(currentTime / (duration || 1)) * 100}%, rgb(55 65 81) 100%)` }}
                            />
                             <span className="text-[10px] font-mono opacity-70 w-10 tabular-nums flex-shrink-0">
                                {formatTime(duration)}
                            </span>
                        </div>
                    )}

                     <div className="flex items-center justify-between pt-1">
                         <div className="flex items-center gap-2">
                            {(hasMedia || useTTS) && (
                                <>
                                 <div className="relative">
                                    <div className={`flex items-center justify-center px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${T.button} hover:bg-white/20`}>
                                        {playbackRate}x
                                    </div>
                                    <select
                                        value={playbackRate}
                                        onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    >
                                        <option value={0.8}>0.8x</option>
                                        <option value={0.9}>0.9x</option>
                                        <option value={1.0}>1.0x</option>
                                        <option value={1.2}>1.2x</option>
                                        <option value={1.5}>1.5x</option>
                                    </select>
                                 </div>
                                 {hasMedia && (
                                     <button 
                                         onClick={() => {
                                             if (isPlaying) {
                                                 if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                                                 if (!useTTS) {
                                                     setIsPlaying(false);
                                                 } else {
                                                     const audio = audioRef.current;
                                                     if (audio) {
                                                         audio.currentTime = currentTime;
                                                         safePlay(audio);
                                                     }
                                                 }
                                             }
                                             setUseTTS(prev => !prev);
                                         }}
                                         className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors border ${useTTS ? 'text-sky-400 bg-sky-400/10 border-sky-400/30' : 'text-gray-400 border-white/5 hover:bg-white/10'}`}
                                         title="端末の自動読み上げ機能(TTS)に切り替えます"
                                     >
                                         TTS
                                     </button>
                                 )}
                                <div className={`flex items-center rounded-md ${T.containerBg} border ${T.border} overflow-hidden h-6`}>
                                    <button onClick={() => setAbLoop(p => ({...p, a: p.a === null ? currentTime : null}))} className={`px-2 h-full text-[10px] font-bold hover:bg-white/5 transition-colors ${abLoop.a !== null ? 'text-sky-400 bg-sky-400/10' : T.textMuted}`}>
                                        A
                                    </button>
                                    <div className={`w-px h-3 bg-white/10`}></div>
                                    <button onClick={() => setAbLoop(p => ({...p, b: p.b === null ? currentTime : null}))} className={`px-2 h-full text-[10px] font-bold hover:bg-white/5 transition-colors ${abLoop.b !== null ? 'text-sky-400 bg-sky-400/10' : T.textMuted}`}>
                                        B
                                    </button>
                                </div>
                                </>
                            )}
                         </div>

                         <div className="flex items-center gap-1 sm:gap-3">
                            {(hasMedia || useTTS) && (
                                <>
                                    <button onClick={handlePrevSentence} className={`p-1.5 rounded-full ${T.button} hover:bg-white/10 transition-colors text-gray-400 scale-90`} title="前の文へ">
                                        <SkipPrevIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={skipBackward} className={`p-1.5 rounded-full ${T.button} hover:bg-white/10 transition-colors scale-90`} title="-3秒">
                                        <RewindIcon /> 
                                    </button>
                                    
                                    <button onClick={togglePlay} className={`p-2 rounded-full ${T.accentBg} text-white shadow-md hover:brightness-110 active:scale-95 transition-transform w-10 h-10 flex items-center justify-center`}>
                                        <div className="scale-90">{isPlaying ? <PauseIcon /> : <PlayIcon />}</div>
                                    </button>
                                    
                                    <button onClick={skipForward} className={`p-1.5 rounded-full ${T.button} hover:bg-white/10 transition-colors scale-90`} title="+3秒">
                                        <ForwardIcon />
                                    </button>
                                    <button onClick={handleNextSentence} className={`p-1.5 rounded-full ${T.button} hover:bg-white/10 transition-colors text-gray-400 scale-90`} title="次の文へ">
                                        <SkipNextIcon className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                         </div>

                         <div className="flex justify-end gap-2 items-center">
                             {/* Font Controls (Moved from Header) */}
                             <div className="hidden sm:flex items-center gap-1 mr-2 bg-black/20 p-1 rounded-lg flex-shrink-0">
                                 <select
                                    value={fontFamily}
                                    onChange={(e) => setFontFamily(e.target.value)}
                                    className={`h-6 text-[10px] rounded ${T.button} border-none focus:ring-0 cursor-pointer max-w-[70px] opacity-70 hover:opacity-100`}
                                >
                                    {fontOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <div className="flex items-center gap-1 px-1">
                                        <span className="text-[9px] font-bold opacity-50 tracking-wider">SIZE</span>
                                        <input
                                            type="range"
                                            min="80"
                                            max="200"
                                            step="10"
                                            value={fontSize}
                                            onChange={(e) => setFontSize(Number(e.target.value))}
                                            className={`w-12 h-1 rounded-lg appearance-none cursor-pointer bg-gray-700 accent-sky-500`}
                                        />
                                </div>
                             </div>

                             <button 
                                onClick={() => {
                                    const nextShow = !showJapanese;
                                    setShowJapanese(nextShow);
                                    if (!nextShow) {
                                        setIsSideBySide(false);
                                    }
                                }}
                                className={`p-1.5 rounded-full transition-colors ${showJapanese ? 'text-white bg-white/10' : `${T.textMuted} hover:text-white`}`}
                                title="日本語訳を表示"
                             >
                                 <TranslateIcon /> 
                             </button>
                             <button 
                                onClick={() => {
                                    const nextSide = !isSideBySide;
                                    setIsSideBySide(nextSide);
                                    if (nextSide) {
                                        setShowJapanese(true);
                                    }
                                }}
                                className={`p-1.5 rounded-full transition-colors ${isSideBySide ? 'text-white bg-white/10' : `${T.textMuted} hover:text-white`}`}
                                title="左右対訳表示"
                             >
                                 <ColumnsIcon /> 
                             </button>
                             <button 
                                onClick={() => setShowExplanation(!showExplanation)}
                                className={`p-1.5 rounded-full transition-colors ${showExplanation ? 'text-yellow-400 bg-yellow-400/10' : `${T.textMuted} hover:text-yellow-400`}`}
                                title="解説を表示"
                             >
                                 <LightBulbIcon className="w-5 h-5" />
                             </button>
                         </div>
                     </div>
                </div>
            ) : (
                 <button 
                    onClick={() => setIsControlsVisible(true)}
                    className={`fixed right-4 sm:right-6 px-3 py-2 sm:p-3 rounded-full ${T.accentBg} text-white shadow-xl z-30 hover:scale-110 active:scale-95 transition-all animate-fade-in bg-opacity-90 backdrop-blur-sm flex items-center gap-1.5`}
                    style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
                    title="プレイヤーを表示"
                >
                    <MusicIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="sm:hidden text-xs font-bold">再生</span>
                </button>
            )}
        </>
      )}

      {isMoreMenuOpen && (
          <div
              className="sm:hidden fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm"
              onClick={() => setIsMoreMenuOpen(false)}
          >
              <div
                  role="dialog"
                  aria-modal="true"
                  aria-label="その他の機能"
                  className={`relative w-full max-h-[78dvh] overflow-y-auto rounded-t-3xl border-t ${T.border} ${T.containerBg} shadow-2xl`}
                  style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                  onClick={(e) => e.stopPropagation()}
              >
                  <div className="px-4 pt-3 pb-2">
                      <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
                      <div className="flex items-center justify-between">
                          <div>
                              <h3 className={`font-bold text-base ${T.textPrimary}`}>その他の機能</h3>
                              <p className={`text-[11px] mt-0.5 ${T.textMuted}`}>読むときに常用しない機能をまとめています</p>
                          </div>
                          <button type="button" onClick={() => setIsMoreMenuOpen(false)} className={`w-9 h-9 rounded-full flex items-center justify-center ${T.button}`} aria-label="その他の機能を閉じる">
                              <span className="text-xl leading-none" aria-hidden="true">×</span>
                          </button>
                      </div>
                  </div>

                  <div className="px-4 pb-4 space-y-5">
                      <section>
                          <h4 className={`text-[11px] font-bold tracking-wider mb-2 ${T.textMuted}`}>表示・メモ</h4>
                          <div className="grid grid-cols-2 gap-2">
                              <button type="button" onClick={() => { setShowInlineNotes(prev => !prev); setIsMoreMenuOpen(false); }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button}`}>
                                  <EyeIcon off={!showInlineNotes} className={`w-5 h-5 ${showInlineNotes ? 'text-yellow-400' : ''}`} />
                                  <span className="min-w-0"><span className="block text-sm font-bold">単語・メモ</span><span className={`block text-[10px] mt-0.5 ${T.textMuted}`}>{showInlineNotes ? '黄色で表示' : '色を非表示'}</span></span>
                              </button>
                              <button type="button" onClick={() => { setIsMoreMenuOpen(false); setIsGlobalMemoOpen(true); }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button}`}>
                                  <NoteIcon className="w-5 h-5" />
                                  <span className="min-w-0"><span className="block text-sm font-bold">全体メモ</span><span className={`block text-[10px] mt-0.5 ${T.textMuted}`}>{globalMemo.trim() ? 'メモあり' : 'メモを開く'}</span></span>
                              </button>
                              <button type="button" onClick={() => { const nextSide = !isSideBySide; setIsSideBySide(nextSide); if (nextSide) { setShowJapanese(true); setShowEnglish(true); } setIsMoreMenuOpen(false); }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button} ${isSideBySide ? 'text-sky-400' : ''}`}>
                                  <ColumnsIcon className="w-5 h-5" />
                                  <span className="min-w-0"><span className="block text-sm font-bold">左右対訳</span><span className={`block text-[10px] mt-0.5 ${T.textMuted}`}>{isSideBySide ? 'ON' : 'OFF'}</span></span>
                              </button>
                          </div>
                      </section>

                      <section>
                          <h4 className={`text-[11px] font-bold tracking-wider mb-2 ${T.textMuted}`}>学習モード</h4>
                          <div className="grid grid-cols-2 gap-2">
                              <button type="button" onClick={() => { setIsMoreMenuOpen(false); setIsControlsVisible(true); if (isPlaying) { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setIsPlaying(false); } else { if (!useTTS) setUseTTS(true); setIsPlaying(true); const curIdx = transcript.findIndex(t => currentTime >= t.start && currentTime < t.end); const startIdx = curIdx !== -1 ? curIdx : 0; speakSentence(startIdx); } }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button} ${isPlaying && useTTS ? 'text-rose-400' : ''}`}>
                                  {isPlaying && useTTS ? <PauseIcon className="w-5 h-5" /> : <VolumeIcon className="w-5 h-5" />}
                                  <span className="min-w-0"><span className="block text-sm font-bold">自動読み上げ</span><span className={`block text-[10px] mt-0.5 ${T.textMuted}`}>{isPlaying && useTTS ? '再生中' : 'TTS'}</span></span>
                              </button>
                              <button type="button" onClick={() => { setIsMoreMenuOpen(false); setIsSpeedMode(true); setIsSpeedSettingsOpen(true); }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button} text-green-400`}>
                                  <StopwatchIcon className="w-5 h-5" />
                                  <span className="min-w-0"><span className="block text-sm font-bold">WPM測定</span><span className={`block text-[10px] mt-0.5 ${T.textMuted}`}>読む速さを測る</span></span>
                              </button>
                              <button type="button" onClick={() => { setIsMoreMenuOpen(false); setIsRsvpModeOpen(true); }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button} text-[#00f0ff]`}>
                                  <FlashIcon className="w-5 h-5" />
                                  <span className="min-w-0"><span className="block text-sm font-bold">速読トレーニング</span><span className={`block text-[10px] mt-0.5 ${T.textMuted}`}>Spartan Reader</span></span>
                              </button>
                          </div>
                      </section>

                      <section>
                          <h4 className={`text-[11px] font-bold tracking-wider mb-2 ${T.textMuted}`}>教材</h4>
                          <div className="grid grid-cols-2 gap-2">
                              {personaProfile && <button type="button" onClick={() => { setIsMoreMenuOpen(false); setIsProfileModalOpen(true); }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button} text-purple-400`}><CommentaryIcon /><span className="text-sm font-bold">解説者</span></button>}
                              {backgroundInfo && <button type="button" onClick={() => { setIsMoreMenuOpen(false); setIsBackgroundModalOpen(true); }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button} text-amber-400`}><InfoIcon /><span className="text-sm font-bold">背景知識</span></button>}
                              <button type="button" onClick={() => { setIsMoreMenuOpen(false); setIsPdfModalOpen(true); }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button} text-rose-400`}><PdfIcon /><span className="text-sm font-bold">PDF</span></button>
                              <button type="button" onClick={() => { setIsMoreMenuOpen(false); if (hasQuizFile) onStartQuiz(materialId); else setIsQuizModalOpen(true); }} className={`flex items-center gap-3 p-3 rounded-xl text-left ${T.button} text-indigo-400`}><QuizIcon className={!hasQuizFile ? 'opacity-60' : ''} /><span className="text-sm font-bold">{hasQuizFile ? 'クイズ' : 'クイズ作成'}</span></button>
                          </div>
                      </section>
                  </div>
              </div>
          </div>
      )}

      {personaRolePicker && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPersonaRolePicker(null)}>
              <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${personaRolePicker.name}のキャラを選ぶ`}
                  className={`${T.containerBg} w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border ${T.border} shadow-2xl p-5 sm:p-6 animate-fade-in`}
                  style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
                  onClick={(event) => event.stopPropagation()}
              >
                  <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                          <h3 className={`text-lg font-bold ${T.textPrimary}`}>{personaRolePicker.name} のキャラを選ぶ</h3>
                          <p className={`text-xs mt-1 leading-5 ${T.textMuted}`}>役割情報がない旧教材用です。一度選ぶと、この教材では次回から人物画像を表示します。</p>
                      </div>
                      <button type="button" onClick={() => setPersonaRolePicker(null)} className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${T.button}`} aria-label="閉じる">×</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      {PERSONA_ROLE_KEYS.map(role => (
                          <button
                              key={role}
                              type="button"
                              onClick={() => savePersonaRoleOverride(personaRolePicker.name, role)}
                              className={`min-h-12 px-3 py-2.5 rounded-xl border ${T.border} ${T.button} text-sm font-bold text-left transition-transform active:scale-[0.98]`}
                          >
                              {role}
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {isGlobalMemoOpen && (
           <div className="fixed inset-0 z-50 flex justify-end">
               <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsGlobalMemoOpen(false)} />
               <div className={`relative w-full max-w-md h-full ${T.containerBg} border-l ${T.border} shadow-2xl flex flex-col animate-slide-in-right`}>
                   <div className={`p-4 border-b ${T.border} flex items-center justify-between`}>
                       <div className="flex items-center gap-2">
                           <NoteIcon className="w-5 h-5 text-white" />
                           <h3 className={`font-bold ${T.textPrimary}`}>全体メモ</h3>
                       </div>
                       <button onClick={() => setIsGlobalMemoOpen(false)} className={`p-1 rounded-full ${T.button} hover:bg-white/20`}>
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                       </button>
                   </div>
                   <div className="flex-grow p-4">
                       <textarea 
                           value={globalMemo}
                           onChange={(e) => setGlobalMemo(e.target.value)}
                           placeholder="全体的な感想、目標、To-Doなどを自由に書いてください。"
                           className={`w-full h-full p-4 text-base ${T.button} ${T.textPrimary} rounded-lg resize-none border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                       />
                   </div>
               </div>
           </div>
      )}

      {isProfileModalOpen && personaProfile && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsProfileModalOpen(false)}>
              <div className={`${T.containerBg} p-6 rounded-xl shadow-2xl max-w-lg w-full border ${T.border} animate-fade-in`} onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3 mb-4 text-purple-400">
                      <CommentaryIcon />
                      <h3 className="text-xl font-bold">解説者プロフィール</h3>
                  </div>
                  <div className={`prose prose-invert max-w-none text-sm leading-relaxed ${T.textSecondary} whitespace-pre-wrap`}>
                      {personaProfile}
                  </div>
                  <button onClick={() => setIsProfileModalOpen(false)} className={`mt-6 w-full py-2 rounded-lg ${T.button} font-bold`}>閉じる</button>
              </div>
          </div>
      )}
      
      {isBackgroundModalOpen && backgroundInfo && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsBackgroundModalOpen(false)}>
              <div className={`${T.containerBg} p-6 rounded-xl shadow-2xl max-w-lg w-full border ${T.border} animate-fade-in`} onClick={e => e.stopPropagation()}>
                   <div className="flex items-center gap-3 mb-4 text-amber-400">
                      <InfoIcon />
                      <h3 className="text-xl font-bold">背景知識・雑学</h3>
                  </div>
                  <div className={`prose prose-invert max-w-none text-sm leading-relaxed ${T.textSecondary} whitespace-pre-wrap`}>
                      {backgroundInfo}
                  </div>
                  <button onClick={() => setIsBackgroundModalOpen(false)} className={`mt-6 w-full py-2 rounded-lg ${T.button} font-bold`}>閉じる</button>
              </div>
          </div>
      )}
      
      {isQuizModalOpen && (
          <QuizCreationModal 
            T={T} 
            transcript={transcript}
            personaProfile={personaProfile}
            onClose={() => setIsQuizModalOpen(false)}
            onSave={async (file) => {
                await onUpdateMaterial(materialId, { quizFile: file });
                setIsQuizModalOpen(false);
                onStartQuiz(materialId);
            }}
          />
      )}

      {isPdfModalOpen && (
        <PdfExportModal
            T={T}
            onClose={() => setIsPdfModalOpen(false)}
            materialId={materialId}
            title={title}
            transcript={transcript}
            hasWordFile={hasWordFile}
            hasQuizFile={!!hasQuizFile}
        />
      )}
      
      {/* Speed Reading Settings Modal */}
      {isSpeedSettingsOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleCloseSpeedMode}>
              <div className={`${T.containerBg} p-6 rounded-xl shadow-2xl max-w-md w-full border ${T.border} animate-fade-in`} onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-3 mb-6 text-green-400">
                      <StopwatchIcon className="w-8 h-8" />
                      <div>
                          <h3 className="text-xl font-bold">目標タイム設定</h3>
                          <p className="text-xs text-gray-400">Speed Reading Challenge</p>
                      </div>
                  </div>
                  <div className="space-y-6">
                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                          <div className="flex justify-between text-sm mb-1 text-gray-300">
                              <span>総単語数:</span>
                              <span className="font-bold">{totalWordCount} words</span>
                          </div>
                          <div className="flex justify-between items-center text-sm text-gray-300 mt-2 pt-2 border-t border-white/10">
                              <span>ガイドバー (Pacer Guide):</span>
                              <button 
                                  onClick={() => setIsPacerEnabled(!isPacerEnabled)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPacerEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                              >
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPacerEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                              </button>
                          </div>
                          {isPacerEnabled && (
                              <div className="mt-3 pt-2 border-t border-white/10">
                                   <div className="flex justify-between items-center text-sm text-gray-300 mb-2">
                                        <span>チャンクサイズ (単語数):</span>
                                        <span className="font-bold">{chunkSize} words</span>
                                   </div>
                                   <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(size => (
                                            <button 
                                                key={size}
                                                onClick={() => setChunkSize(size)}
                                                className={`flex-1 py-1.5 rounded text-xs font-bold transition-all ${chunkSize === size ? 'bg-sky-500 text-white shadow-md' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                   </div>
                              </div>
                          )}
                      </div>
                      <div>
                          <label className="block text-sm font-bold mb-3 text-gray-300">レベル選択 (WPM)</label>
                          <div className="grid gap-2">
                              <button 
                                onClick={() => setWpmLevel(120)} 
                                className={`p-3 rounded-lg border text-left transition-all ${wpmLevel === 120 ? `${T.accentBg} border-transparent text-white shadow-lg` : `${T.button} border-white/10 hover:border-white/30`}`}
                              >
                                  <div className="font-bold text-sm">Level 1: 基礎 (120 WPM)</div>
                                  <div className="text-xs opacity-80">とりあえず読み切る目標</div>
                              </button>
                              <button 
                                onClick={() => setWpmLevel(150)} 
                                className={`p-3 rounded-lg border text-left transition-all ${wpmLevel === 150 ? `${T.accentBg} border-transparent text-white shadow-lg` : `${T.button} border-white/10 hover:border-white/30`}`}
                              >
                                  <div className="flex justify-between items-center">
                                      <div className="font-bold text-sm">Level 2: 共通テスト (150 WPM)</div>
                                      <span className="bg-white/20 text-[10px] px-2 py-0.5 rounded-full">推奨</span>
                                  </div>
                                  <div className="text-xs opacity-80">時間内に解き終わる必須スピード</div>
                              </button>
                              <button 
                                onClick={() => setWpmLevel(180)} 
                                className={`p-3 rounded-lg border text-left transition-all ${wpmLevel === 180 ? `${T.accentBg} border-transparent text-white shadow-lg` : `${T.button} border-white/10 hover:border-white/30`}`}
                              >
                                  <div className="font-bold text-sm">Level 3: 上級 (180 WPM)</div>
                                  <div className="text-xs opacity-80">余裕を持って見直しまで</div>
                              </button>
                          </div>
                      </div>
                      <div className="text-center py-2">
                           <span className="text-gray-400 text-sm">目標タイム: </span>
                           <span className="text-2xl font-mono font-bold text-white ml-2">
                               {formatTime(Math.ceil((totalWordCount / wpmLevel) * 60))}
                           </span>
                      </div>
                      <button onClick={handleSpeedStart} className={`w-full py-3 rounded-lg ${T.accentBg} hover:brightness-110 text-white font-bold text-lg shadow-lg transform transition-all hover:scale-[1.02] active:scale-95`}>
                          START
                      </button>
                  </div>
              </div>
          </div>
      )}

      {speedTimerState === 'finished' && (
           <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleCloseSpeedMode}>
              <div className={`${T.containerBg} p-8 rounded-lg shadow-2xl max-w-md w-full border ${T.border} animate-fade-in text-center`} onClick={e => e.stopPropagation()}>
                  <h3 className="text-3xl font-bold mb-2 text-white">Finish!</h3>
                  <div className="my-6 relative">
                      <div className="text-gray-400 text-sm mb-1">Time</div>
                      <div className={`text-5xl font-mono font-bold ${timeRemaining < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {formatTime(targetDuration - timeRemaining)}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                          (Target: {formatTime(targetDuration)})
                      </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10 mb-6">
                      <div className="text-sm text-gray-300 mb-1">実績スピード</div>
                      <div className="text-2xl font-bold text-white">
                          {Math.round(totalWordCount / ((targetDuration - timeRemaining) / 60))} <span className="text-sm font-normal text-gray-400">WPM</span>
                      </div>
                  </div>
                  <div className="flex gap-3">
                      <button onClick={handleCloseSpeedMode} className={`flex-1 py-3 ${T.button} rounded-lg font-bold`}>
                          閉じる
                      </button>
                      <button onClick={handleSpeedReset} className={`flex-1 py-3 ${T.accentBg} text-white rounded-lg font-bold hover:brightness-110`}>
                          もう一度
                      </button>
                  </div>
              </div>
           </div>
      )}
      
      {activeWordPopup && (
        <>
          <div 
              className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent" 
              onClick={(e) => {
                  e.stopPropagation();
                  setActiveWordPopup(null);
              }}
          />
          <div 
              role="dialog"
              aria-modal="true"
              aria-label={`${activeWordPopup.card.front} の単語情報`}
              className="hidden sm:block fixed z-50 bg-slate-800 text-white text-sm p-3 rounded-lg shadow-2xl border border-slate-600 animate-fade-in"
              style={{ 
                  top: Math.round(activeWordPopup.position.top < 300 ? activeWordPopup.position.top + 30 : activeWordPopup.position.top - 10), 
                  left: Math.min(
                      Math.max(Math.round(activeWordPopup.position.left + (activeWordPopup.position.width / 2)), 176),
                      (typeof window !== 'undefined' ? window.innerWidth : 1024) - 176
                  ),
                  transform: activeWordPopup.position.top < 300 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                  minWidth: '220px',
                  maxWidth: '320px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textAlign: 'left',
                  zIndex: 60
              }}
              onClick={(e) => e.stopPropagation()}
          >
              <div className="border-b border-slate-600/50 pb-2 mb-2">
                  <div className="font-bold text-lg text-sky-300 leading-tight">{activeWordPopup.card.front}</div>
                  {activeWordPopup.card.pronunciation && (
                      <div className="text-xs text-slate-400 mt-0.5 font-mono">{formatPronunciation(activeWordPopup.card.pronunciation)}</div>
                  )}
              </div>
              
              <div className="font-bold text-base text-amber-400 mb-2 leading-snug">{activeWordPopup.card.back}</div>
              
              <div className="text-xs text-slate-300 whitespace-pre-wrap border-t border-slate-600/50 pt-2 mt-2 leading-relaxed opacity-90">
                  <div className="font-bold text-emerald-300 mb-1">単語メモ</div>
                  {activeWordPopup.card.memo || 'この単語にはメモがありません。'}
              </div>

              <span 
                  className={`absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 border-r border-b border-slate-600 transform rotate-45 ${activeWordPopup.position.top < 300 ? '-top-1.5 border-t border-l border-r-0 border-b-0' : '-bottom-1.5'}`}
              ></span>
          </div>

          <div
              role="dialog"
              aria-modal="true"
              aria-label={`${activeWordPopup.card.front} の単語情報`}
              className="sm:hidden fixed z-50 left-3 right-3 bottom-3 max-h-[72dvh] overflow-hidden rounded-2xl bg-slate-800 text-white border border-slate-600 shadow-2xl animate-fade-in"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              onClick={(e) => e.stopPropagation()}
          >
              <div className="max-h-[72dvh] overflow-y-auto p-4 pb-2">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-600/50 pb-3 mb-3">
                      <div className="min-w-0">
                          <div className="font-bold text-xl text-sky-300 leading-tight break-words">{activeWordPopup.card.front}</div>
                          {activeWordPopup.card.pronunciation && (
                              <div className="text-sm text-slate-400 mt-1 font-mono">{formatPronunciation(activeWordPopup.card.pronunciation)}</div>
                          )}
                      </div>
                      <button
                          type="button"
                          onClick={() => setActiveWordPopup(null)}
                          className="flex-shrink-0 w-9 h-9 rounded-full bg-white/10 text-slate-200 flex items-center justify-center"
                          aria-label="単語情報を閉じる"
                      >
                          <span className="text-xl leading-none" aria-hidden="true">×</span>
                      </button>
                  </div>
                  <div className="font-bold text-base text-amber-400 mb-3 leading-snug whitespace-pre-wrap">{activeWordPopup.card.back}</div>
                  <div className="text-sm text-slate-300 whitespace-pre-wrap border-t border-slate-600/50 pt-3 mt-3 leading-relaxed">
                      <div className="font-bold text-emerald-300 mb-1.5">単語メモ</div>
                      {activeWordPopup.card.memo || 'この単語にはメモがありません。'}
                  </div>
              </div>
          </div>
        </>
      )}

      {activeGrammarTerm && (
        <>
          <div 
              className="fixed inset-0 z-40 bg-black/25 sm:bg-transparent" 
              onClick={(e) => {
                  e.stopPropagation();
                  setActiveGrammarTerm(null);
              }}
          />
          <div 
              role="dialog"
              aria-modal="true"
              aria-label={`${activeGrammarTerm.term.term} の文法メモ`}
              className="hidden sm:block fixed z-50 bg-slate-800 text-white text-sm p-3 rounded-lg shadow-2xl border border-slate-600 animate-fade-in"
              style={{ 
                  top: Math.min(
                      Math.round(activeGrammarTerm.position.top + 30),
                      (typeof window !== 'undefined' ? window.innerHeight : 768) - 260
                  ),
                  left: Math.min(
                      Math.max(Math.round(activeGrammarTerm.position.left), 12),
                      (typeof window !== 'undefined' ? window.innerWidth : 1024) - 332
                  ),
                  maxWidth: '320px',
                  width: 'calc(100vw - 24px)',
                  maxHeight: '240px',
                  overflowY: 'auto',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
              }}
              onClick={(e) => e.stopPropagation()}
          >
              <div className="font-bold text-sky-300 mb-1 pb-1 border-b border-slate-600">
                  {activeGrammarTerm.term.term}
              </div>
              <div className="text-gray-300 leading-relaxed text-xs">
                  {activeGrammarTerm.term.description}
              </div>
              <span 
                  className="absolute -top-1.5 left-4 w-3 h-3 bg-slate-800 border-t border-l border-slate-600 transform rotate-45"
              ></span>
          </div>
          <div
              role="dialog"
              aria-modal="true"
              aria-label={`${activeGrammarTerm.term.term} の文法メモ`}
              className="sm:hidden fixed z-50 left-3 right-3 bottom-3 max-h-[58dvh] overflow-hidden rounded-2xl bg-slate-800 text-white border border-slate-600 shadow-2xl animate-fade-in"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
              onClick={(e) => e.stopPropagation()}
          >
              <div className="max-h-[58dvh] overflow-y-auto p-4 pb-2">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-600/50 pb-3 mb-3">
                      <div>
                          <div className="text-[11px] font-bold tracking-[0.18em] text-emerald-300 mb-1">文法メモ</div>
                          <div className="font-bold text-xl text-sky-300 leading-tight break-words">{activeGrammarTerm.term.term}</div>
                      </div>
                      <button
                          type="button"
                          onClick={() => setActiveGrammarTerm(null)}
                          className="flex-shrink-0 w-9 h-9 rounded-full bg-white/10 text-slate-200 flex items-center justify-center"
                          aria-label="文法メモを閉じる"
                      >
                          <span className="text-xl leading-none" aria-hidden="true">×</span>
                      </button>
                  </div>
                  <div className="text-slate-200 leading-7 text-sm whitespace-pre-wrap break-words">
                      {activeGrammarTerm.term.description}
                  </div>
              </div>
          </div>
        </>
      )}

    </div>
  );
};

export default ReaderScreen;
