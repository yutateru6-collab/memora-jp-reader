
import React, { useState, useEffect, useRef } from 'react';
import { LegendData, LegendItem } from '../types';
import { Theme } from '../App';

interface LegendScreenProps {
  data: LegendData;
  onBack: () => void;
  T: Theme;
}

// Interactive Text Component
const InteractiveText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    const [activePopup, setActivePopup] = useState<string | null>(null);

    // Format: [Display](Hidden) where Hidden can be "Meaning|Pronunciation"
    const parts = text.split(/(\[.*?\]\(.*?\))/g);

    return (
        <span className={`leading-relaxed ${className}`}>
            {parts.map((part, index) => {
                const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
                if (match) {
                    const display = match[1];
                    const hiddenContent = match[2];
                    const key = `${index}-${display}`;
                    const isActive = activePopup === key;

                    // Parse "Meaning|Pronunciation" if separator exists
                    const [meaning, pronunciation] = hiddenContent.split('|');

                    return (
                        <span key={key} className="relative inline-block mx-1">
                            <span 
                                className="cursor-pointer border-b border-white/50 hover:border-white transition-colors select-none font-bold text-sky-300"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActivePopup(isActive ? null : key);
                                }}
                            >
                                {display}
                            </span>
                            
                            {/* Popup */}
                            {isActive && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setActivePopup(null)} />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 bg-white text-slate-900 rounded-lg shadow-2xl z-50 whitespace-nowrap animate-fade-in flex flex-col items-center gap-1 min-w-[80px]">
                                        {pronunciation && (
                                            <span className="text-[10px] text-purple-600 font-bold bg-purple-100 px-2 py-0.5 rounded-full">
                                                {pronunciation}
                                            </span>
                                        )}
                                        <span className="font-bold text-base">{meaning}</span>
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white"></div>
                                    </span>
                                </>
                            )}
                        </span>
                    );
                }
                return <span key={index}>{part}</span>;
            })}
        </span>
    );
};

export const LegendScreen: React.FC<LegendScreenProps> = ({ data, onBack, T }) => {
    const [displayedCount, setDisplayedCount] = useState(1); // Number of lines currently shown
    const [currentLevel, setCurrentLevel] = useState<1 | 2 | 3>(1);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showCongrats, setShowCongrats] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new line is added
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [displayedCount]);

    const handleNext = () => {
        if (displayedCount < data.content.length) {
            setDisplayedCount(prev => prev + 1);
        } else if (currentLevel < 3) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentLevel(prev => (prev + 1) as 1 | 2 | 3);
                setIsAnimating(false);
                // Reset congrats if re-playing, but here we just level up
            }, 600);
        } else {
            setShowCongrats(true);
        }
    };

    const handleReset = () => {
        setDisplayedCount(1);
        setCurrentLevel(1);
        setShowCongrats(false);
    };

    const handleLevelChange = (level: 1 | 2 | 3) => {
        setCurrentLevel(level);
        setShowCongrats(false);
    };

    const currentItem = data.content[displayedCount - 1];
    const isLastLine = displayedCount === data.content.length;
    const progress = (displayedCount / data.content.length) * 100;

    // Get comment based on level, with fallback
    const getComment = (item: LegendItem, level: number) => {
        if (level === 1) return item.comment_1 || item.character_comment || "素晴らしい！";
        if (level === 2) return item.comment_2 || item.comment_1 || item.character_comment || "その調子！";
        if (level === 3) return item.comment_3 || item.comment_2 || item.character_comment || "君は天才だ！";
        return "";
    };

    const currentComment = getComment(currentItem, currentLevel);

    return (
        <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 bg-[#1a1a2e] text-white overflow-hidden relative`}>
            {/* Background Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
                <div className="absolute top-10 left-10 w-20 h-20 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-20 w-32 h-32 bg-purple-500 rounded-full blur-3xl animate-pulse delay-1000"></div>
            </div>

            {/* Header */}
            <header className="flex-shrink-0 flex items-center justify-between p-4 z-20 relative border-b border-white/10 bg-[#1a1a2e]/90 backdrop-blur-sm">
                <button onClick={onBack} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-sm">
                    &larr; <span className="hidden sm:inline font-bold">戻る</span>
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-pink-400 drop-shadow-sm">
                        {data.title || "伝説の始まり"}
                    </h1>
                    <div className="flex gap-2 mt-1">
                        {[1, 2, 3].map((lvl) => (
                            <button
                                key={lvl}
                                onClick={() => handleLevelChange(lvl as 1 | 2 | 3)}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer hover:bg-white/10 ${
                                    currentLevel === lvl
                                        ? lvl === 1 ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                                        : lvl === 2 ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                        : 'bg-green-500/20 border-green-500 text-green-300'
                                        : 'border-transparent text-gray-500'
                                }`}
                            >
                                {lvl === 1 && 'Lv.1 ルー語'}
                                {lvl === 2 && 'Lv.2 ちゃんぽん'}
                                {lvl === 3 && 'Lv.3 英語'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="w-16 text-right text-xs font-mono text-white/50">
                    {displayedCount}/{data.content.length}
                </div>
            </header>

            {/* Main Content (Document Style) */}
            <main 
                ref={scrollRef}
                className="flex-grow overflow-y-auto p-4 sm:p-8 relative z-10 scroll-smooth pb-40"
            >
                {showCongrats ? (
                    <div className="flex flex-col items-center justify-center h-full animate-fade-in space-y-6 text-center">
                        <div className="text-6xl mb-4 animate-bounce">🎉</div>
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500">
                            MISSION COMPLETE!
                        </h2>
                        <p className="text-lg text-gray-300">
                            素晴らしい！最後まで読み切りましたね。<br/>
                            君の英語力は確実にレベルアップした！
                        </p>
                        <button 
                            onClick={handleReset}
                            className="px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                        >
                            もう一度読む
                        </button>
                    </div>
                ) : (
                    <div className={`max-w-3xl mx-auto space-y-6 transition-opacity duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
                        {data.content.slice(0, displayedCount).map((item, index) => (
                            <div key={index} className="animate-slide-in-right">
                                <div className={`p-6 rounded-xl border border-white/5 bg-black/20 backdrop-blur-sm shadow-sm hover:bg-white/5 transition-colors`}>
                                    <div className="text-lg sm:text-xl leading-loose tracking-wide">
                                        {currentLevel === 1 && <InteractiveText text={item.jp_mixed} />}
                                        {currentLevel === 2 && <InteractiveText text={item.en_mixed} />}
                                        {currentLevel === 3 && <span className="font-serif text-gray-200">{item.en_full}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* Invisible spacer for auto-scroll */}
                        <div className="h-4"></div>
                    </div>
                )}
            </main>

            {/* Footer Action Area */}
            {!showCongrats && (
                <div className="absolute bottom-0 left-0 right-0 p-4 z-30 bg-gradient-to-t from-[#1a1a2e] via-[#1a1a2e]/90 to-transparent pt-12">
                    <div className="max-w-3xl mx-auto flex flex-col gap-4">
                        
                        {/* Character Comment (Latest Line) */}
                        <div className="flex items-end gap-3 animate-slide-in-left">
                            <div className="w-12 h-12 rounded-full border-2 border-white/50 bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0 shadow-lg flex items-center justify-center text-2xl overflow-hidden relative">
                                <span className="z-10">👑</span>
                            </div>
                            <div className="bg-white/90 text-gray-900 px-4 py-3 rounded-2xl rounded-bl-none shadow-lg relative text-sm font-bold flex-grow max-w-md">
                                <span className="text-xs text-pink-600 block mb-1 font-extrabold flex items-center gap-1">
                                    {currentItem.character_name}
                                    {currentLevel === 2 && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 rounded-full ml-1">豆知識モード</span>}
                                </span>
                                {currentComment}
                            </div>
                        </div>

                        {/* Main Button */}
                        <button 
                            onClick={handleNext}
                            disabled={isAnimating}
                            className={`
                                w-full py-4 rounded-xl font-black text-lg tracking-wider shadow-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2
                                ${!isLastLine 
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white' 
                                    : (currentLevel < 3 
                                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 hover:scale-[1.02] text-white animate-pulse' 
                                        : 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:scale-[1.02] text-black')
                                }
                            `}
                        >
                            {!isLastLine ? (
                                <>
                                    <span>次へ進む</span>
                                    <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                </>
                            ) : (
                                currentLevel < 3 ? (
                                    <>
                                        <span>LEVEL UP! (Lv.{currentLevel + 1}へ)</span>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                    </>
                                ) : "伝説達成！ (Finish)"
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
