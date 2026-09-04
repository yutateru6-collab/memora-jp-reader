import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../types';
import { Theme } from '../App';

interface GameScreenProps {
  cards: Card[];
  deckName: string;
  onBack: () => void;
  T: Theme;
}

// FIX: Changed from generic arrow function to a function declaration
// to resolve a TypeScript inference issue within the TSX file, which
// caused the return type to be inferred as `unknown[]`.
function shuffleArray<T>(array: T[]): T[] {
  return [...array].sort(() => Math.random() - 0.5);
}

const GameScreen: React.FC<GameScreenProps> = ({ cards, deckName, onBack, T }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const currentCard = useMemo(() => cards[currentIndex], [cards, currentIndex]);

  useEffect(() => {
    if (cards.length > 0) {
      const correctAnswer = currentCard.back;
      const distractors = shuffleArray(cards.filter(c => c.id !== currentCard.id))
        .slice(0, 3)
        // FIX: Cast 'c' to 'Card' to address type inference issue where it was treated as 'unknown'.
        .map(c => (c as Card).back);
      
      const allChoices = shuffleArray([correctAnswer, ...distractors]);
      setChoices(allChoices);
      setSelectedAnswer(null);
      setIsCorrect(null);
    }
  }, [currentIndex, cards, currentCard]);

  const handleAnswer = (answer: string) => {
    if (selectedAnswer) return; // Prevent multiple clicks

    setSelectedAnswer(answer);
    const correct = answer === currentCard.back;
    setIsCorrect(correct);
    if (correct) {
      setScore(s => s + 1);
    }

    setTimeout(() => {
      setCurrentIndex(i => (i + 1) % cards.length);
    }, 1500);
  };

  if (cards.length < 4) {
      return (
          <div className="flex flex-col h-screen items-center justify-center p-4">
              <h1 className={`${T.textPrimary} text-2xl font-bold mb-4`}>ゲームをプレイできません</h1>
              <p className={`${T.textSecondary} text-center mb-6`}>このゲームをプレイするには、デッキに少なくとも4枚のユニークなカードが必要です。</p>
              <button onClick={onBack} className={`px-4 py-2 ${T.button} rounded-md`}>戻る</button>
          </div>
      );
  }

  return (
    <div className={`flex flex-col h-screen max-h-screen overflow-hidden ${T.containerBg}`}>
      <header className={`flex-shrink-0 flex items-center justify-between p-3 ${T.bg} shadow-md z-10`}>
        <button onClick={onBack} className={`px-3 py-1 rounded-md ${T.button} transition-colors`}>
          &larr; 戻る
        </button>
        <div className={`font-mono ${T.textSecondary}`}>{currentIndex + 1} / {cards.length}</div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <img
            src="/memora-world/play-v1.webp"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
            className="w-9 h-9 sm:w-11 sm:h-11 object-contain drop-shadow-md select-none pointer-events-none"
          />
          <div className={`font-bold ${T.textPrimary}`}>Score: {score}</div>
        </div>
      </header>
      
      <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-8 space-y-8">
        <div className="w-full max-w-2xl text-center">
            <div className="bg-sky-600 text-white p-8 sm:p-12 rounded-lg shadow-2xl mb-8">
                <div className="flex items-center justify-center gap-4">
                    <span className="text-3xl bg-black/20 rounded-full w-12 h-12 flex items-center justify-center font-bold">
                        {currentIndex + 1}
                    </span>
                    <h2 className="text-4xl sm:text-5xl font-bold">
                        🌽 {currentCard.front} {currentCard.pronunciation ? `[${currentCard.pronunciation}]` : ''}
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {choices.map((choice, index) => {
                    let buttonClass = `${T.button} ${T.textPrimary}`;
                    if (selectedAnswer) {
                        if (choice === currentCard.back) {
                           buttonClass = 'bg-green-500 text-white';
                        } else if (choice === selectedAnswer) {
                            buttonClass = 'bg-red-500 text-white';
                        }
                    }

                    return (
                        <button
                            key={index}
                            onClick={() => handleAnswer(choice)}
                            disabled={!!selectedAnswer}
                            className={`p-6 rounded-lg text-lg font-semibold transition-all duration-300 transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none ${buttonClass}`}
                        >
                            {choice}
                        </button>
                    );
                })}
            </div>
        </div>
      </main>
    </div>
  );
};

export default GameScreen;
