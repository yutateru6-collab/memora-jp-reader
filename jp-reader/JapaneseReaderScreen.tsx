import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildJpCardStorageKey,
  getJpCardsForMaterial,
  getJpProgress,
  registerJpVocabularyCard,
  saveJpProgress,
  unregisterJpVocabularyCard,
} from './db';
import JapaneseQuiz from './JapaneseQuiz';
import type {
  FuriganaMode,
  JlptLevel,
  JpReaderMode,
  JpSegment,
  JpSentence,
  JpTargetLevel,
  JpTextVariant,
  StoredJpMaterial,
  StoredJpVocabularyCard,
} from './types';
import './jp-reader.css';

interface JapaneseReaderScreenProps {
  material: StoredJpMaterial;
  onBack: () => void;
}

interface ActiveSegment {
  sentence: JpSentence;
  segment: JpSegment;
  variant: JpTextVariant;
}

const JLPT_DIFFICULTY: Record<JlptLevel, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
const hasKanji = (value: string) => /[々〇〆ヶ一-龯]/u.test(value);
const safeSourceUrl = (value?: string) => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const formatSeconds = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const shouldShowRuby = (segment: JpSegment, mode: FuriganaMode, learnerLevel: JpTargetLevel) => {
  if (mode === 'none' || !segment.reading || !hasKanji(segment.surface)) return false;
  if (mode === 'all') return true;
  if (!segment.jlptEstimate || segment.jlptEstimate === 'unknown') return true;
  return JLPT_DIFFICULTY[segment.jlptEstimate] > JLPT_DIFFICULTY[learnerLevel];
};

interface JapaneseSentenceSectionProps {
  sentence: JpSentence;
  sentenceIndex: number;
  materialId: number;
  readerMode: JpReaderMode;
  textVariant: JpTextVariant;
  furiganaMode: FuriganaMode;
  learnerLevel: JpTargetLevel;
  registeredKeys: ReadonlySet<string>;
  isPlaying: boolean;
  onSpeak: (index: number, continuous: boolean) => void;
  onSegmentSelect: (event: React.MouseEvent, sentence: JpSentence, segment: JpSegment, variant: JpTextVariant) => void;
  onSentenceSelect: (sentence: JpSentence) => void;
}

const JapaneseSentenceSection = React.memo(function JapaneseSentenceSection({
  sentence,
  sentenceIndex,
  materialId,
  readerMode,
  textVariant,
  furiganaMode,
  learnerLevel,
  registeredKeys,
  isPlaying,
  onSpeak,
  onSegmentSelect,
  onSentenceSelect,
}: JapaneseSentenceSectionProps) {
  const selectedVariant: JpTextVariant = textVariant === 'adapted' && sentence.adapted ? 'adapted' : 'original';
  const selected = selectedVariant === 'adapted' ? sentence.adapted! : sentence.original;
  return (
    <section
      id={`jp-sentence-${sentence.id}`}
      data-sentence-id={sentence.id}
      className={`jp-sentence ${readerMode === 'study' ? 'is-study' : ''} ${isPlaying ? 'is-playing' : ''}`}
      onClick={() => {
        if (readerMode === 'study') onSentenceSelect(sentence);
      }}
    >
      <div className="jp-sentence__line">
        <button
          type="button"
          className="jp-sentence__play"
          aria-label={`${sentenceIndex + 1}文目を読み上げる`}
          onClick={event => { event.stopPropagation(); onSpeak(sentenceIndex, false); }}
        >
          {isPlaying ? '■' : '▶'}
        </button>
        <p>
          {selected.segments.map(segment => {
            const storageKey = buildJpCardStorageKey(materialId, sentence.id, segment.id, selectedVariant);
            const registered = registeredKeys.has(storageKey);
            const ruby = shouldShowRuby(segment, furiganaMode, learnerLevel);
            const contentNode = ruby ? <ruby>{segment.surface}<rt>{segment.reading}</rt></ruby> : segment.surface;
            if (!segment.surface.trim()) return <span key={segment.id}>{segment.surface}</span>;
            if (readerMode !== 'study') {
              return (
                <span
                  key={segment.id}
                  data-sentence-id={sentence.id}
                  data-segment-id={segment.id}
                  data-variant={selectedVariant}
                  className={`jp-segment ${registered && readerMode === 'reread' ? 'is-registered' : ''}`}
                >
                  {contentNode}
                </span>
              );
            }
            return (
              <button
                key={segment.id}
                type="button"
                data-sentence-id={sentence.id}
                data-segment-id={segment.id}
                data-variant={selectedVariant}
                className="jp-segment"
                tabIndex={readerMode === 'study' ? 0 : -1}
                aria-label={readerMode === 'study' ? `${segment.surface}の語彙情報` : undefined}
                onClick={event => onSegmentSelect(event, sentence, segment, selectedVariant)}
              >
                {contentNode}
              </button>
            );
          })}
        </p>
      </div>
      {selectedVariant === 'adapted' ? <p className="jp-sentence__ai-label">AIによる易しい日本語版</p> : null}
      {readerMode === 'study' ? (
        <button
          type="button"
          className="jp-sentence__hint"
          onClick={event => { event.stopPropagation(); onSentenceSelect(sentence); }}
        >
          文の翻訳・文法・ニュアンスを見る
        </button>
      ) : null}
    </section>
  );
});

const JapaneseReaderScreen: React.FC<JapaneseReaderScreenProps> = ({ material, onBack }) => {
  const content = material.content;
  const [readerMode, setReaderMode] = useState<JpReaderMode>('read');
  const [textVariant, setTextVariant] = useState<JpTextVariant>('original');
  const [furiganaMode, setFuriganaMode] = useState<FuriganaMode>('outside-level');
  const [learnerLevel, setLearnerLevel] = useState<JpTargetLevel>(content.targetLevel);
  const [readingSeconds, setReadingSeconds] = useState(0);
  const [lastSentenceId, setLastSentenceId] = useState<string | undefined>();
  const [activeSegment, setActiveSegment] = useState<ActiveSegment | null>(null);
  const [activeSentence, setActiveSentence] = useState<JpSentence | null>(null);
  const [cards, setCards] = useState<StoredJpVocabularyCard[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [ttsMessage, setTtsMessage] = useState('');
  const [playingSentenceIndex, setPlayingSentenceIndex] = useState<number | null>(null);
  const [continuousPlayback, setContinuousPlayback] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const hydratedRef = useRef(false);
  const continuousRef = useRef(false);
  const speakRef = useRef<(index: number, continuous: boolean) => void>(() => undefined);

  const adaptedAvailable = useMemo(() => content.sentences.some(sentence => Boolean(sentence.adapted)), [content.sentences]);
  const sourceUrl = safeSourceUrl(content.source.url);
  const registeredKeys = useMemo(() => new Set(cards.map(card => card.storageKey)), [cards]);

  useEffect(() => {
    let active = true;
    Promise.all([getJpProgress(material.id), getJpCardsForMaterial(material.id)])
      .then(([progress, storedCards]) => {
        if (!active) return;
        if (progress) {
          setReaderMode(progress.readerMode);
          setTextVariant(progress.textVariant === 'adapted' && adaptedAvailable ? 'adapted' : 'original');
          setFuriganaMode(progress.furiganaMode);
          setLearnerLevel(progress.learnerLevel);
          setReadingSeconds(progress.readingSeconds || 0);
          setLastSentenceId(progress.lastSentenceId);
        }
        setCards(storedCards);
        hydratedRef.current = true;
      })
      .catch(error => setStatusMessage(error instanceof Error ? error.message : '学習状態を読み込めませんでした。'));
    return () => { active = false; };
  }, [adaptedAvailable, material.id]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      saveJpProgress({
        materialId: material.id,
        readerMode,
        textVariant,
        furiganaMode,
        learnerLevel,
        lastSentenceId,
        readingSeconds,
        updatedAt: new Date().toISOString(),
      }).catch(error => setStatusMessage(error instanceof Error ? error.message : '学習状態を保存できませんでした。'));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [furiganaMode, lastSentenceId, learnerLevel, material.id, readerMode, readingSeconds, textVariant]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (readerMode === 'read' && document.visibilityState === 'visible') setReadingSeconds(previous => previous + 5);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [readerMode]);

  useEffect(() => {
    const closeSheets = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setActiveSegment(null);
      setActiveSentence(null);
    };
    document.addEventListener('keydown', closeSheets);
    return () => document.removeEventListener('keydown', closeSheets);
  }, []);

  useEffect(() => {
    if (!activeSegment && !activeSentence) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [activeSegment, activeSentence]);

  const stopSpeech = useCallback(() => {
    continuousRef.current = false;
    setContinuousPlayback(false);
    setPlayingSentenceIndex(null);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  useEffect(() => stopSpeech, [stopSpeech]);

  const speakSentence = useCallback((index: number, continuous: boolean) => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setTtsMessage('この端末では音声読み上げを利用できません。');
      stopSpeech();
      return;
    }
    if (index < 0 || index >= content.sentences.length) {
      stopSpeech();
      return;
    }
    const sentence = content.sentences[index];
    const selected = textVariant === 'adapted' && sentence.adapted ? sentence.adapted : sentence.original;
    if (!selected.text.trim()) {
      if (continuous) speakRef.current(index + 1, true);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(selected.text);
    const voices = window.speechSynthesis.getVoices();
    const japaneseVoice = voices.find(voice => voice.lang.toLowerCase() === 'ja-jp')
      || voices.find(voice => voice.lang.toLowerCase().startsWith('ja'));
    if (japaneseVoice) utterance.voice = japaneseVoice;
    utterance.lang = 'ja-JP';
    utterance.rate = 0.95;
    continuousRef.current = continuous;
    setContinuousPlayback(continuous);
    setPlayingSentenceIndex(index);
    setLastSentenceId(sentence.id);
    setTtsMessage(japaneseVoice
      ? ''
      : voices.length === 0
        ? '端末の音声一覧を取得できないため、既定音声で再生を試します。'
        : '日本語音声が見つからないため、端末の既定音声を使用します。');
    document.getElementById(`jp-sentence-${sentence.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    utterance.onend = () => {
      if (continuousRef.current) speakRef.current(index + 1, true);
      else setPlayingSentenceIndex(null);
    };
    utterance.onerror = event => {
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        setTtsMessage('音声を再生できませんでした。端末の日本語音声設定を確認してください。');
      }
      setPlayingSentenceIndex(null);
    };
    window.speechSynthesis.speak(utterance);
  }, [content.sentences, stopSpeech, textVariant]);

  useEffect(() => { speakRef.current = speakSentence; }, [speakSentence]);

  const changeReaderMode = (mode: JpReaderMode) => {
    stopSpeech();
    setShowQuiz(false);
    setActiveSegment(null);
    setActiveSentence(null);
    setReaderMode(mode);
  };

  const handleSegmentClick = useCallback((event: React.MouseEvent, sentence: JpSentence, segment: JpSegment, variant: JpTextVariant) => {
    event.stopPropagation();
    if (readerMode !== 'study' || !segment.surface.trim()) return;
    setActiveSentence(null);
    setActiveSegment({ sentence, segment, variant });
  }, [readerMode]);

  const handleSentenceSelect = useCallback((sentence: JpSentence) => {
    setLastSentenceId(sentence.id);
    if (readerMode !== 'study') return;
    setActiveSegment(null);
    setActiveSentence(sentence);
  }, [readerMode]);

  const activeCardKey = activeSegment
    ? buildJpCardStorageKey(material.id, activeSegment.sentence.id, activeSegment.segment.id, activeSegment.variant)
    : '';
  const activeCard = cards.find(card => card.storageKey === activeCardKey);

  const toggleActiveCard = async () => {
    if (!activeSegment) return;
    try {
      if (activeCard) {
        await unregisterJpVocabularyCard(activeCard.storageKey);
        setCards(previous => previous.filter(card => card.storageKey !== activeCard.storageKey));
        setStatusMessage('単語カードから外しました。');
      } else {
        const { sentence, segment, variant } = activeSegment;
        const card = await registerJpVocabularyCard(material.id, {
          id: `${sentence.id}-${variant}-${segment.id}`,
          sentenceId: sentence.id,
          segmentId: segment.id,
          variant,
          lexemeId: segment.lexemeId,
          surface: segment.surface,
          reading: segment.reading,
          lemma: segment.lemma,
          meaning: segment.contextualGloss || '意味情報なし',
          example: segment.example || (variant === 'adapted' && sentence.adapted ? sentence.adapted.text : sentence.original.text),
        }, variant);
        setCards(previous => [...previous.filter(item => item.storageKey !== card.storageKey), card]);
        setStatusMessage('単語カードに登録しました。');
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '単語カードを更新できませんでした。');
    }
  };

  if (showQuiz) {
    return (
      <main className="jp-reader-screen">
        <JapaneseQuiz questions={content.quiz} onBack={() => setShowQuiz(false)} />
      </main>
    );
  }

  return (
    <main className="jp-reader-screen" data-testid="jp-reader-screen">
      <header className="jp-reader-header">
        <div className="jp-reader-header__top">
          <button type="button" className="jp-button jp-button--quiet" onClick={onBack}>← 教材一覧</button>
          <div className="jp-reader-header__meta">
            <span>{learnerLevel}</span>
            <span>{formatSeconds(readingSeconds)}</span>
            <span>{cards.length}語登録</span>
          </div>
        </div>
        <div className="jp-reader-header__title">
          <div>
            <p className="jp-eyebrow">JAPANESE READER</p>
            <h1>{content.title}</h1>
            <p className="jp-reader-header__source">
              {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">元のURL</a> : '出典URLなし'}
              <span>・非公開</span>
              {content.analysisStatus !== 'complete' && <span>・詳細解析なし</span>}
            </p>
          </div>
          {content.analysisStatus !== 'complete' && (
            <div className="jp-reader-header__warning" role="note">本文は読めますが、語彙・文法情報がない部分があります。</div>
          )}
        </div>
        <nav className="jp-mode-tabs" aria-label="学習モード">
          {([
            ['read', '読む'],
            ['study', '学ぶ'],
            ['reread', '再読'],
          ] as const).map(([mode, label]) => (
            <button key={mode} type="button" data-testid={`jp-mode-${mode}`} aria-pressed={readerMode === mode} onClick={() => changeReaderMode(mode)}>{label}</button>
          ))}
        </nav>
        <div className="jp-reader-controls">
          <label>
            <span>本文</span>
            <select data-testid="jp-text-variant" value={textVariant} onChange={event => setTextVariant(event.target.value as JpTextVariant)}>
              <option value="original">原文</option>
              <option value="adapted" disabled={!adaptedAvailable}>易しい日本語</option>
            </select>
          </label>
          <label>
            <span>ふりがな</span>
            <select data-testid="jp-furigana-mode" value={furiganaMode} onChange={event => setFuriganaMode(event.target.value as FuriganaMode)}>
              <option value="all">全部</option>
              <option value="outside-level">レベル外だけ</option>
              <option value="none">なし</option>
            </select>
          </label>
          <label>
            <span>自分のレベル</span>
            <select value={learnerLevel} onChange={event => setLearnerLevel(event.target.value as JpTargetLevel)}>
              <option value="N4">N4</option>
              <option value="N3">N3</option>
              <option value="N2">N2</option>
            </select>
          </label>
          {readerMode === 'reread' && (
            <button
              type="button"
              className="jp-button jp-button--primary jp-reader-controls__play"
              onClick={() => continuousPlayback ? stopSpeech() : speakSentence(Math.max(playingSentenceIndex || 0, 0), true)}
            >
              {continuousPlayback ? '停止' : '連続再生'}
            </button>
          )}
        </div>
        {ttsMessage && <p className="jp-reader-message jp-reader-message--warning" role="status">{ttsMessage}</p>}
        {statusMessage && <p className="jp-reader-message" role="status">{statusMessage}</p>}
      </header>

      <article className="jp-reader-document" aria-label="日本語本文">
        {content.sentences.map((sentence, sentenceIndex) => {
          return (
            <JapaneseSentenceSection
              key={sentence.id}
              sentence={sentence}
              sentenceIndex={sentenceIndex}
              materialId={material.id}
              readerMode={readerMode}
              textVariant={textVariant}
              furiganaMode={furiganaMode}
              learnerLevel={learnerLevel}
              registeredKeys={registeredKeys}
              isPlaying={playingSentenceIndex === sentenceIndex}
              onSpeak={speakSentence}
              onSegmentSelect={handleSegmentClick}
              onSentenceSelect={handleSentenceSelect}
            />
          );
        })}

        <section className="jp-reader-finish">
          <p>ここまで読み終わりました。</p>
          {content.quiz.length > 0 ? (
            <button type="button" className="jp-button jp-button--primary" onClick={() => { stopSpeech(); setShowQuiz(true); }}>読後クイズへ</button>
          ) : (
            <p className="jp-reader-finish__empty">この教材にはクイズがありません。</p>
          )}
        </section>
      </article>

      {activeSegment && (
        <div className="jp-sheet-backdrop" onClick={() => setActiveSegment(null)}>
          <section className="jp-sheet" role="dialog" aria-modal="true" aria-labelledby="jp-word-sheet-title" onClick={event => event.stopPropagation()}>
            <div className="jp-sheet__handle" aria-hidden="true" />
            <div className="jp-sheet__header">
              <div>
                <p className="jp-eyebrow">WORD</p>
                <h2 id="jp-word-sheet-title">{activeSegment.segment.surface}</h2>
                {activeSegment.segment.reading && <p className="jp-sheet__reading">{activeSegment.segment.reading}</p>}
              </div>
              <button type="button" aria-label="語彙情報を閉じる" onClick={() => setActiveSegment(null)}>×</button>
            </div>
            <dl className="jp-detail-grid">
              <div><dt>辞書形</dt><dd>{activeSegment.segment.lemma || '情報なし'}</dd></div>
              <div><dt>品詞</dt><dd>{activeSegment.segment.partOfSpeech || '情報なし'}</dd></div>
              <div><dt>活用</dt><dd>{activeSegment.segment.conjugation || '情報なし'}</dd></div>
              <div><dt>JLPT目安</dt><dd>{activeSegment.segment.jlptEstimate || '不明'}</dd></div>
              <div className="is-wide"><dt>この文での意味</dt><dd>{activeSegment.segment.contextualGloss || '詳細解析がありません。'}</dd></div>
              <div className="is-wide"><dt>使用域</dt><dd>{activeSegment.segment.register || '情報なし'}</dd></div>
              <div className="is-wide"><dt>例文</dt><dd>{activeSegment.segment.example || '情報なし'}</dd></div>
            </dl>
            <button type="button" className={`jp-button ${activeCard ? 'jp-button--danger' : 'jp-button--primary'} jp-sheet__primary-action`} onClick={toggleActiveCard}>
              {activeCard ? '単語カードから外す' : '単語カードに登録'}
            </button>
          </section>
        </div>
      )}

      {activeSentence && (
        <div className="jp-sheet-backdrop" onClick={() => setActiveSentence(null)}>
          <section className="jp-sheet jp-sheet--sentence" role="dialog" aria-modal="true" aria-labelledby="jp-sentence-sheet-title" onClick={event => event.stopPropagation()}>
            <div className="jp-sheet__handle" aria-hidden="true" />
            <div className="jp-sheet__header">
              <div><p className="jp-eyebrow">SENTENCE</p><h2 id="jp-sentence-sheet-title">文の解説</h2></div>
              <button type="button" aria-label="文の解説を閉じる" onClick={() => setActiveSentence(null)}>×</button>
            </div>
            <div className="jp-sentence-details">
              <section><h3>翻訳</h3><p>{activeSentence.translation?.text || '翻訳情報がありません。'}</p>{activeSentence.translation && <small>言語: {activeSentence.translation.language}</small>}</section>
              <section><h3>文法</h3>{activeSentence.grammar.length ? activeSentence.grammar.map(point => <div key={point.id} className="jp-grammar-point"><strong>{point.pattern}</strong><p>{point.meaning}</p><p>{point.explanation}</p>{point.example && <small>例：{point.example}</small>}</div>) : <p>文法情報がありません。</p>}</section>
              <section><h3>省略されている要素</h3>{activeSentence.omittedElements.length ? <ul>{activeSentence.omittedElements.map(item => <li key={item}>{item}</li>)}</ul> : <p>情報がありません。</p>}</section>
              <section><h3>ニュアンス</h3>{activeSentence.nuanceNotes.length ? <ul>{activeSentence.nuanceNotes.map(item => <li key={item}>{item}</li>)}</ul> : <p>情報がありません。</p>}</section>
              <section><h3>文化的背景</h3><p>{activeSentence.cultureNote || '情報がありません。'}</p></section>
              <section><h3>易しい日本語へ変えた理由</h3>{activeSentence.adaptationReasons.length ? <ul>{activeSentence.adaptationReasons.map(item => <li key={item}>{item}</li>)}</ul> : <p>情報がありません。</p>}</section>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};

export default JapaneseReaderScreen;
