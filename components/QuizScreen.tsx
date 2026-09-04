
import React, { useState, useMemo } from 'react';
import { QuizQuestion, TranscriptEntry } from '../types';
import { Theme } from '../App';
import BookmarkIcon from './icons/BookmarkIcon';
import QuizCreationModal from './QuizCreationModal';

interface QuizScreenProps {
  questions: QuizQuestion[];
  deckName: string;
  onBack: () => void;
  T: Theme;
  bookmarks: number[];
  onUpdateBookmarks: (bookmarks: number[]) => void;
  transcript: TranscriptEntry[];
  personaProfile: string | null;
  materialId: number;
  onUpdateMaterial: (id: number, data: { quizFile?: File | null }) => Promise<void>;
  onReload: () => void;
}

const QuestionCard: React.FC<{ 
    question: QuizQuestion; 
    index: number; // Display index (1-based)
    T: Theme;
    isBookmarked: boolean;
    onToggleBookmark: () => void;
    onAnswer: (isCorrect: boolean) => void;
}> = ({ question, index, T, isBookmarked, onToggleBookmark, onAnswer }) => {
    const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);

    const handleChoiceClick = (choiceIndex: number) => {
        if (isAnswered) return;
        setSelectedChoice(choiceIndex);
        setIsAnswered(true);
        
        const isCorrect = choiceIndex === question.correctAnswerIndex;
        onAnswer(isCorrect);
    };

    return (
        <div className={`p-6 rounded-lg ${T.containerBg} border ${T.border} shadow-lg relative`}>
            <div className="flex justify-between items-start mb-4">
                <p className={`text-sm font-semibold ${T.textMuted}`}>Question {index}</p>
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
                    className={`p-2 rounded-full transition-colors ${isBookmarked ? 'text-yellow-500' : `${T.textMuted} hover:text-yellow-500`}`}
                    title={isBookmarked ? "ブックマークを解除" : "ブックマークする"}
                >
                    <BookmarkIcon filled={isBookmarked} className="w-6 h-6" />
                </button>
            </div>
            
            <p className={`text-lg ${T.textPrimary} mb-4 whitespace-pre-wrap`}>{question.question}</p>
            <div className="space-y-3">
                {question.choices.map((choice, choiceIndex) => {
                    const isCorrect = choiceIndex === question.correctAnswerIndex;
                    const isSelected = choiceIndex === selectedChoice;
                    
                    let buttonClass = `${T.button} hover:border-sky-500`;
                    if (isAnswered) {
                        if (isCorrect) {
                            buttonClass = 'bg-green-500/80 border-green-400 text-white';
                        } else if (isSelected) {
                            buttonClass = 'bg-red-500/80 border-red-400 text-white';
                        } else {
                             buttonClass = `${T.button} opacity-60`;
                        }
                    }
                    
                    return (
                        <button
                            key={choiceIndex}
                            onClick={() => handleChoiceClick(choiceIndex)}
                            disabled={isAnswered}
                            className={`w-full text-left p-3 border-2 rounded-md transition-colors duration-200 disabled:cursor-not-allowed ${buttonClass}`}
                        >
                            <span className="font-mono mr-3">{String.fromCharCode(65 + choiceIndex)}.</span>
                            <span>{choice}</span>
                        </button>
                    );
                })}
            </div>

            {isAnswered && (
                <div className={`mt-4 p-4 rounded-md animate-fade-in border ${selectedChoice === question.correctAnswerIndex ? `bg-green-500/10 border-green-500/30 ${T.textPrimary}` : `bg-red-500/10 border-red-500/30 ${T.textPrimary}`}`}>
                    <div className="flex items-start gap-3">
                        <img
                            src="/memora-world/quiz-v1.webp"
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0 drop-shadow-md select-none pointer-events-none"
                        />
                        <div className="min-w-0">
                            <h4 className="font-bold mb-2">{selectedChoice === question.correctAnswerIndex ? '正解！' : '残念！'}</h4>
                            <p className="whitespace-pre-wrap font-sans text-sm">
                                {selectedChoice === question.correctAnswerIndex
                                    ? (question.explanationCorrect || question.explanation)
                                    : (question.explanationIncorrect || question.explanation)
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const QuizScreen: React.FC<QuizScreenProps> = ({ questions, deckName, onBack, T, bookmarks, onUpdateBookmarks, transcript, personaProfile, materialId, onUpdateMaterial, onReload }) => {
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // When in review mode, filter questions based on whether their ORIGINAL index is in the bookmarks array
  const displayQuestions = useMemo(() => {
      if (isReviewMode) {
          return questions
            .map((q, i) => ({ q, originalIndex: i }))
            .filter(item => bookmarks.includes(item.originalIndex));
      }
      return questions.map((q, i) => ({ q, originalIndex: i }));
  }, [questions, isReviewMode, bookmarks]);

  const handleToggleBookmark = (originalIndex: number) => {
      const newBookmarks = bookmarks.includes(originalIndex)
        ? bookmarks.filter(id => id !== originalIndex)
        : [...bookmarks, originalIndex];
      onUpdateBookmarks(newBookmarks);
  };

  const handleAnswer = (originalIndex: number, isCorrect: boolean) => {
    // Automatically bookmark if incorrect and not already bookmarked
    if (!isCorrect && !bookmarks.includes(originalIndex)) {
        const newBookmarks = [...bookmarks, originalIndex];
        onUpdateBookmarks(newBookmarks);
    }
  };

  const handleAddQuestions = async (file: File) => {
      try {
          const text = await file.text();
          const newQuestions = JSON.parse(text) as QuizQuestion[];
          if (!Array.isArray(newQuestions)) {
              throw new Error("Invalid JSON format");
          }
          
          const updatedQuestions = [...questions, ...newQuestions];
          const updatedFile = new File([JSON.stringify(updatedQuestions)], 'quiz.json', { type: 'application/json' });
          
          await onUpdateMaterial(materialId, { quizFile: updatedFile });
          onReload(); // Refresh the questions list
          setIsAddModalOpen(false);
      } catch (e) {
          console.error("Failed to add questions", e);
          alert("問題の追加に失敗しました。JSON形式を確認してください。");
      }
  };

  return (
    <div className={`flex flex-col h-screen max-h-screen overflow-hidden ${T.bg}`}>
      <header className={`flex-shrink-0 flex items-center justify-between p-3 ${T.containerBg} shadow-md z-10 border-b ${T.border}`}>
        <button onClick={onBack} className={`flex items-center gap-2 px-3 py-2 text-sm ${T.button} rounded-md transition-colors`}>
          &larr; 戻る
        </button>
        <h1 className={`text-xl font-bold ${T.textPrimary}`}>{deckName} - 文法クイズ</h1>
        <div className="flex justify-end gap-2">
             <button 
                onClick={() => setIsAddModalOpen(true)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${T.button} hover:${T.buttonStrong} flex items-center gap-1`}
                title="問題を追加"
            >
                <span className="text-lg font-bold">+</span> 問題を追加
            </button>
            {bookmarks.length > 0 && (
                <button 
                    onClick={() => setIsReviewMode(!isReviewMode)}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors flex items-center gap-1 ${isReviewMode ? 'bg-yellow-500 text-white' : `${T.button} text-yellow-500`}`}
                    title={isReviewMode ? "全問題を表示" : "ブックマークのみ表示"}
                >
                    <BookmarkIcon filled={true} className="w-4 h-4" />
                    {isReviewMode ? '復習中' : '復習モード'}
                </button>
            )}
        </div>
      </header>
      
      <main className="flex-grow overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
            {displayQuestions.length > 0 ? (
                displayQuestions.map((item, index) => (
                    <QuestionCard 
                        // Changing the key when mode changes forces the component to remount,
                        // resetting the local state (isAnswered, selectedChoice).
                        key={`${item.originalIndex}-${isReviewMode ? 'review' : 'normal'}`}
                        question={item.q} 
                        index={index + 1} 
                        T={T} 
                        isBookmarked={bookmarks.includes(item.originalIndex)}
                        onToggleBookmark={() => handleToggleBookmark(item.originalIndex)}
                        onAnswer={(isCorrect) => handleAnswer(item.originalIndex, isCorrect)}
                    />
                ))
            ) : (
                <div className={`text-center p-8 rounded-lg ${T.containerBg}`}>
                    <p className={`${T.textMuted}`}>
                        {isReviewMode ? "復習する問題はありません！" : "問題がありません。"}
                    </p>
                </div>
            )}
        </div>
      </main>
      
      {isAddModalOpen && (
        <QuizCreationModal 
            T={T}
            transcript={transcript}
            personaProfile={personaProfile}
            onClose={() => setIsAddModalOpen(false)}
            onSave={handleAddQuestions}
            isAdding={true}
        />
      )}
    </div>
  );
};

export default QuizScreen;
