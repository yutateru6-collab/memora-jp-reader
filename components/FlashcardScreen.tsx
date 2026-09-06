
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Card, SRSState } from '../types';
import { Theme, Themes } from '../App';
import SettingsIcon from './icons/SettingsIcon';
import GridIcon from './icons/GridIcon';
import { Grade, getNextReviewText } from '../lib/srs';

interface FlashcardScreenProps {
  cards: Card[];
  deckName: string;
  onBack: () => void;
  onEditDeck: () => void;
  T: Theme;
  setTheme: (themeName: string) => void;
  themes: Themes;
  materialId: number;
  duration?: number;
  onGoToReader: (id: number) => void;
  onGoToCardList: (id: number) => void;
  onSaveCardStats?: (card: Card, newState: SRSState) => Promise<void>;
}

const FlashcardScreen: React.FC<FlashcardScreenProps> = ({ cards, deckName, onBack, onEditDeck, T, setTheme, themes, materialId, duration, onGoToReader, onGoToCardList, onSaveCardStats }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [faceIndex, setFaceIndex] = useState(0);
  const [fontSize, setFontSize] = useState(150); 
  const [fontFamily, setFontFamily] = useState("'system-ui', sans-serif");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const settingsContainerRef = useRef<HTMLDivElement>(null);
  
  const fontOptions = {
    "'system-ui', sans-serif": 'デフォルト',
    "'Noto Sans JP', sans-serif": 'ゴシック体',
    "'Noto Serif JP', serif": '明朝体',
    "'RocknRoll One', sans-serif": 'ロックンロール',
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (settingsContainerRef.current && !settingsContainerRef.current.contains(event.target as Node)) {
            setIsSettingsOpen(false);
        }
    };
    if (isSettingsOpen) { document.addEventListener('mousedown', handleClickOutside); }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [isSettingsOpen]);

  const currentCard = useMemo(() => cards[currentIndex], [cards, currentIndex]);
  
  // Reset state when card changes
  useEffect(() => {
      setShowAnswer(false);
      setFaceIndex(0);
  }, [currentIndex]);

  const faces = useMemo(() => {
      if (!currentCard) return [];
      return [
          currentCard.front, 
          currentCard.back, 
          currentCard.pronunciation, 
          currentCard.memo
      ].filter((f): f is string => typeof f === 'string' && f.trim() !== '');
  }, [currentCard]);

  const canGoToReader = duration && duration > 0;

  const handleGrade = useCallback(async (grade: Grade) => {
      if (onSaveCardStats && currentCard) {
           const { calculateSRS } = await import('../lib/srs');
           const newState = calculateSRS(currentCard.srsState, grade);
           await onSaveCardStats(currentCard, newState);
      }
      
      // Move to next
      if (currentIndex < cards.length - 1) {
          setCurrentIndex(prev => prev + 1);
      } else {
          setIsSessionComplete(true);
      }
  }, [currentCard, currentIndex, cards.length, onSaveCardStats]);

  const handleRestartSession = () => {
      setCurrentIndex(0);
      setFaceIndex(0);
      setShowAnswer(false);
      setIsSessionComplete(false);
  };

  // Legacy navigation for decks without SRS or manual browsing
  const handleNextCard = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % cards.length);
  }, [cards.length]);

  const handlePrevCard = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + cards.length) % cards.length);
  }, [cards.length]);

  const handleCardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (faces.length === 0) return;
    setShowAnswer(true);
    setFaceIndex(prev => {
        if (!showAnswer) return 1; // If hidden, show back (index 1 usually)
        return (prev + 1) % faces.length; // Cycle
    });
  }, [faces.length, showAnswer]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if(e.key === 'ArrowRight') handleNextCard();
        if(e.key === 'ArrowLeft') handlePrevCard();
        if(e.key === ' ') {
          e.preventDefault();
           if (!showAnswer) {
               setShowAnswer(true);
               if (faces.length > 1) setFaceIndex(1);
           } else {
               // Space when answer shown -> Cycle faces
               setFaceIndex(prev => (prev + 1) % faces.length);
           }
        };
        // Shortcut keys for grading
        if (showAnswer && onSaveCardStats) {
            if (e.key === '1') handleGrade('again');
            if (e.key === '2') handleGrade('hard');
            if (e.key === '3') handleGrade('good');
            if (e.key === '4') handleGrade('easy');
        }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextCard, handlePrevCard, faces.length, showAnswer, onSaveCardStats, handleGrade]);

  // Visual state
  const frontContentIndex = 0; // Always front first
  // If showAnswer is true, we show faceIndex (which cycles). If false, we show 0.
  const displayIndex = showAnswer ? (faceIndex === 0 ? 1 : faceIndex) : 0; 
  
  const content = faces[displayIndex] || '';
  const isBack = displayIndex > 0;

  if (!cards || cards.length === 0 || !currentCard) {
    return (
      <div className={`flex flex-col h-screen items-center justify-center p-4 ${T.containerBg}`}>
          <h1 className={`${T.textPrimary} text-2xl font-bold mb-4`}>カードがありません</h1>
          <p className={`${T.textSecondary} text-center mb-6`}>このデッキには有効なカードデータがありません。</p>
          <button onClick={onBack} className={`px-4 py-2 ${T.button} rounded-md`}>戻る</button>
      </div>
    );
  }

  return (
    <div className={`memora-flashcard-screen flex flex-col h-[100dvh] max-h-[100dvh] overflow-hidden ${T.bg}`}>
      {/* Progress Bar */}
      <div className="w-full h-1 bg-gray-800">
          <div 
            className={`h-full ${T.accentBg} transition-all duration-300`} 
            style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
          />
      </div>

      <header className={`memora-flashcard-header flex-shrink-0 flex items-center justify-between p-3 ${T.containerBg} shadow-md z-10`}>
        <div className="flex items-center gap-2">
            <button onClick={onBack} aria-label="戻る" className={`flex items-center gap-2 px-3 py-2 text-sm ${T.button} rounded-md transition-colors`}>
              &larr; 戻る
            </button>
        </div>
        <div className="memora-flashcard-header__title">
          <span>MEMORIZE</span>
          <h1 className={T.textPrimary}>{deckName}</h1>
        </div>
        <div className="flex justify-end items-center gap-2">
            {materialId > 0 && (
                <button 
                    onClick={() => onGoToCardList(materialId)} 
                    className={`p-2 rounded-full transition-colors ${T.button} hover:bg-white/20`}
                    title="一覧表示"
                >
                    <GridIcon className="h-5 w-5" />
                </button>
            )}
            <div className="relative" ref={settingsContainerRef}>
                <button onClick={() => setIsSettingsOpen(prev => !prev)} className={`p-2 rounded-full transition-colors ${T.button} hover:bg-white/20`}>
                    <SettingsIcon className="h-6 w-6" />
                </button>
              {isSettingsOpen && (
                <div className={`absolute top-full right-0 mt-2 w-64 ${T.containerBg} rounded-lg shadow-xl border ${T.border} z-10 p-3 space-y-3`}>
                  <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>文字サイズ</label>
                    <input type="range" min="70" max="300" step="10" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className={`w-full ${T.accent}`}/>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>フォント</label>
                    <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className={`w-full p-2 text-sm ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-1 ${T.ring}`}>
                      {Object.entries(fontOptions).map(([value, name]) => (<option key={value} value={value}>{name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>テーマ</label>
                    <select value={Object.keys(themes).find(key => themes[key as keyof Themes]?.name === T.name)} onChange={(e) => setTheme(e.target.value)} className={`w-full p-2 text-sm ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-1 ${T.ring}`}>
                      {Object.entries(themes).map(([key, theme]) => (<option key={key} value={key}>{(theme as Theme).name}</option>))}
                    </select>
                  </div>
                </div>
              )}
            </div>
        </div>
      </header>

      <main className={`memora-flashcard-main flex-grow flex flex-col items-center justify-center p-4 relative ${T.containerBg}`}>
        {/* Main Card Content */}
        <div className="w-full max-w-3xl flex flex-col items-center justify-center relative flex-grow">
            {!isSessionComplete && <img
                src="/memora-world/memorize-v1.webp"
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                draggable={false}
                className="absolute top-0 right-0 w-14 sm:w-20 max-h-20 object-contain drop-shadow-lg select-none pointer-events-none z-[1]"
            />}
            <div className={`memora-flashcard-status absolute top-0 left-0 text-sm ${T.textMuted}`}>
                <span>{currentIndex + 1} / {cards.length}</span>
                {currentCard.srsState && (
                    <span>
                        次の復習：{new Date(currentCard.srsState.dueDate).toLocaleDateString('ja-JP')}
                    </span>
                )}
                {!currentCard.srsState && <span>新しいカード</span>}
            </div>
            
            <div 
                className={`memora-flashcard-card w-full max-w-3xl h-80 sm:h-96 rounded-xl shadow-2xl flex flex-col items-center justify-center p-8 border ${T.border} cursor-pointer overflow-hidden transition-all duration-300 ${isBack ? `${T.highlightBg} is-back` : T.panelBg}`}
                onClick={handleCardClick}
            >
                 <div className="text-4xl sm:text-5xl font-bold text-center overflow-y-auto max-h-full w-full flex-grow flex items-center justify-center" style={{ fontSize: `${fontSize}%`, fontFamily: fontFamily }}>
                    <span className="whitespace-pre-wrap">{content}</span>
                 </div>
                 
                 {/* Pagination dots */}
                 {faces.length > 1 && (
                    <div className="flex gap-2 mt-4 h-2 items-end justify-center w-full pointer-events-none opacity-70">
                        {faces.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-200 ${i === displayIndex ? `w-8 ${T.accentBg}` : 'w-2 bg-gray-400/50'}`} />
                        ))}
                    </div>
                 )}
            </div>
        </div>

        {/* Footer Controls */}
        <div className="w-full max-w-3xl flex flex-col items-center mt-6 h-24 justify-end">
            {showAnswer ? (
                 /* SRS Buttons */
                <div className="memora-grade-grid grid grid-cols-2 sm:grid-cols-4 gap-2 w-full animate-fade-in">
                    <button onClick={() => handleGrade('again')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500 text-red-200 transition-colors">
                        <span className="font-bold">もう一度</span>
                        <span className="text-xs opacity-70">{getNextReviewText('again', currentCard.srsState)}</span>
                    </button>
                    <button onClick={() => handleGrade('hard')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500 text-orange-200 transition-colors">
                        <span className="font-bold">むずかしい</span>
                         <span className="text-xs opacity-70">{getNextReviewText('hard', currentCard.srsState)}</span>
                    </button>
                    <button onClick={() => handleGrade('good')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500 text-green-200 transition-colors">
                        <span className="font-bold">できた</span>
                         <span className="text-xs opacity-70">{getNextReviewText('good', currentCard.srsState)}</span>
                    </button>
                    <button onClick={() => handleGrade('easy')} className="flex flex-col items-center justify-center p-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500 text-blue-200 transition-colors">
                        <span className="font-bold">かんたん</span>
                         <span className="text-xs opacity-70">{getNextReviewText('easy', currentCard.srsState)}</span>
                    </button>
                </div>
            ) : (
                /* Show Answer Button */
                <button 
                    onClick={() => setShowAnswer(true)}
                    className={`w-full py-4 rounded-xl ${T.accentBg} hover:brightness-110 text-white font-bold text-lg shadow-lg transform transition-all active:scale-95`}
                >
                    答えを表示
                </button>
            )}
        </div>
      </main>

      {isSessionComplete && (
        <div className="memora-flashcard-complete" role="dialog" aria-modal="true" aria-labelledby="review-complete-title">
          <div className="memora-flashcard-complete__card">
            <img src="/memora-world/memorize-v1.webp" alt="" aria-hidden="true" draggable={false} />
            <p>MEMORIZE COMPLETE</p>
            <h2 id="review-complete-title">今日の復習、おわり！</h2>
            <span>{cards.length}枚クリアしました</span>
            <div>
              <button type="button" onClick={handleRestartSession}>もう一度</button>
              <button type="button" className="is-primary" onClick={onBack}>ライブラリへ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashcardScreen;
