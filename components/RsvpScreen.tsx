
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { TranscriptEntry } from '../types';
import PlayIcon from './icons/PlayIcon';
import PauseIcon from './icons/PauseIcon';
import XMarkIcon from './icons/XMarkIcon';
import SettingsIcon from './icons/SettingsIcon';
import RotateIcon from './icons/RotateIcon';

interface RsvpScreenProps {
  transcript: TranscriptEntry[];
  onClose: () => void;
  initialWpm?: number;
}

// Animation Styles injection
const animationStyles = `
  @keyframes revealFade {
    0% { opacity: 0; transform: translateY(5px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes revealFlash {
    0% { opacity: 0; filter: brightness(3) saturate(1.5); }
    50% { opacity: 0.8; filter: brightness(1.5) saturate(1.2); }
    100% { opacity: 1; filter: brightness(1) saturate(1); }
  }
  @keyframes revealBlur {
    0% { opacity: 0; filter: blur(8px); }
    100% { opacity: 1; filter: blur(0); }
  }
  @keyframes revealZoom {
    0% { opacity: 0; transform: scale(1.1); }
    100% { opacity: 1; transform: scale(1); }
  }
  .animate-reveal-fade { animation: revealFade 0.15s ease-out forwards; }
  .animate-reveal-flash { animation: revealFlash 0.15s ease-out forwards; }
  .animate-reveal-blur { animation: revealBlur 0.2s ease-out forwards; }
  .animate-reveal-zoom { animation: revealZoom 0.15s ease-out forwards; }
`;

type AnimationType = 'none' | 'fade' | 'flash' | 'blur' | 'zoom';

export const RsvpScreen: React.FC<RsvpScreenProps> = ({ transcript, onClose, initialWpm = 150 }) => {
  // Settings
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(Math.min(Math.max(initialWpm, 50), 200)); // Clamp initial WPM
  const [chunkSize, setChunkSize] = useState(3); // Default to 3
  const [animationType, setAnimationType] = useState<AnimationType>('fade');
  const [fontSize, setFontSize] = useState(1.5); // Default font size smaller
  const [showSettings, setShowSettings] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  
  // Data
  const [wordIndex, setWordIndex] = useState(0);
  
  // Flatten words logic
  const allWords = useMemo(() => {
    return transcript.flatMap((entry, sentenceIdx) => {
      // Remove brackets and extra spaces, split by space
      const text = entry.english.replace(/[\[\]]/g, '').trim();
      if (!text) return [];
      return text.split(/\s+/).map((word, idx) => ({
        word,
        sentenceIdx,
        wordIdxInSentence: idx,
        translation: entry.japanese,
        originalEntry: entry
      }));
    });
  }, [transcript]);

  // Timer logic
  const timerRef = useRef<number | null>(null);

  const msPerChunk = useMemo(() => {
    // 60000ms / WPM = ms per word. 
    // ms per chunk = ms per word * chunk size.
    return (60000 / wpm) * chunkSize;
  }, [wpm, chunkSize]);

  const step = useCallback(() => {
    setWordIndex(prev => {
      const next = prev + chunkSize;
      if (next >= allWords.length) {
        setIsPlaying(false);
        return 0; // Reset or stay at end? Let's loop or stop. Stopping is better.
      }
      return next;
    });
  }, [chunkSize, allWords.length]);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(step, msPerChunk);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, msPerChunk, step]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(p => !p);
      }
      if (e.code === 'ArrowLeft') {
        setWordIndex(p => Math.max(0, p - chunkSize * 5)); // Rewind a bit
      }
      if (e.code === 'ArrowRight') {
        setWordIndex(p => Math.min(allWords.length - 1, p + chunkSize * 5));
      }
      if (e.code === 'Escape') {
          onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chunkSize, allWords.length, onClose]);

  // Current Display Chunk
  const currentChunk = useMemo(() => {
    return allWords.slice(wordIndex, wordIndex + chunkSize);
  }, [allWords, wordIndex, chunkSize]);

  const progress = Math.min(100, (wordIndex / allWords.length) * 100);

  // Rotate styling logic
  const containerStyle: React.CSSProperties = isLandscape ? {
      width: '100vh',
      height: '100vw',
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%) rotate(90deg)',
  } : {
      width: '100%',
      height: '100%',
      position: 'fixed',
      top: 0,
      left: 0
  };

  return (
    <div 
        className="z-50 flex flex-col items-center justify-center bg-black text-[#e0e0e0] font-sans overflow-hidden"
        style={containerStyle}
    >
      <style>{animationStyles}</style>
      
      {/* Header */}
      <div className={`absolute top-0 left-0 w-full flex justify-between items-center z-10 ${isLandscape ? 'p-3' : 'p-6'}`}>
        <div className="flex items-center gap-2">
            <span className="text-[#00f0ff] font-black text-lg tracking-tighter">SPARTAN READER</span>
            <span className="bg-[#1e1e24] text-xs px-2 py-0.5 rounded text-gray-400 font-mono">{wpm} WPM</span>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsLandscape(!isLandscape)} 
                className={`p-2 transition-colors bg-transparent rounded-full ${isLandscape ? 'text-[#00f0ff]' : 'text-gray-400 hover:text-white'}`}
                title={isLandscape ? "縦画面に戻る" : "横画面にする"}
            >
                <RotateIcon />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-[#ff2a4d] transition-colors bg-transparent rounded-full">
                <XMarkIcon />
            </button>
        </div>
      </div>

      {/* Main Display Area */}
      <div className="relative flex-grow flex flex-col items-center justify-center w-full max-w-7xl px-4">
        {!isPlaying && (
          <img
            src="/memora-world/explore-v1.webp"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute left-3 bottom-3 w-14 sm:w-20 max-h-20 object-contain opacity-75 drop-shadow-lg select-none pointer-events-none"
          />
        )}
        
        {/* The Word(s) */}
        <div className={`relative z-10 flex flex-wrap justify-center items-baseline gap-4 ${isLandscape ? 'w-full px-12 mb-0' : 'mb-4'}`}>
            {currentChunk.map((item, i) => (
                <span 
                    key={`${wordIndex}-${i}`} // Key change triggers animation
                    className={`
                        font-bold text-center tracking-tight text-white text-shadow
                        ${animationType !== 'none' ? `animate-reveal-${animationType}` : ''}
                    `}
                    style={{ 
                        fontSize: `${fontSize}rem`,
                        lineHeight: 1.1,
                        textShadow: '0 0 30px rgba(255,255,255,0.6)' 
                    }}
                >
                    {item.word}
                </span>
            ))}
        </div>

      </div>

      {/* Controls & Settings */}
      <div className={`w-full max-w-3xl px-6 z-20 relative ${isLandscape ? 'pb-2' : 'pb-12'}`}>
        
        {/* Settings Overlay */}
        {showSettings && (
            <>
                {/* Invisible Backdrop to close settings */}
                <div 
                    className="fixed inset-0 z-20 cursor-default" 
                    onClick={() => setShowSettings(false)} 
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-full max-w-md mb-4 z-30 animate-fade-in">
                    <div className="bg-[#1e1e24] border border-gray-800 rounded-xl p-6 shadow-2xl relative">
                        <button onClick={() => setShowSettings(false)} className="absolute top-2 right-2 p-2 text-gray-500 hover:text-white">
                            <XMarkIcon className="w-4 h-4" />
                        </button>

                        <div className="space-y-6 mt-2">
                            {/* Font Size */}
                            <div>
                                <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                    <span>Font Size</span>
                                    <span className="text-[#00f0ff]">{fontSize}rem</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.5" max="3.0" step="0.1" 
                                    value={fontSize} 
                                    onChange={(e) => setFontSize(Number(e.target.value))}
                                    className="w-full h-2 bg-[#0f0f13] rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                                />
                            </div>

                            {/* Animation Type */}
                            <div>
                                <button 
                                    onClick={() => setAnimationType(prev => {
                                        const types: AnimationType[] = ['none', 'fade', 'flash', 'blur', 'zoom'];
                                        const idx = types.indexOf(prev);
                                        return types[(idx + 1) % types.length];
                                    })}
                                    className="w-full py-3 px-4 bg-[#0f0f13] border border-gray-700 rounded-lg flex items-center justify-center gap-2 hover:border-[#00f0ff] transition-colors group"
                                >
                                    <span className="text-gray-400 text-sm group-hover:text-white">Effect:</span>
                                    <span className="text-[#00f0ff] font-bold uppercase">{animationType}</span>
                                </button>
                            </div>

                            {/* Chunk Size */}
                            <div>
                                <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                    <span>Words per Flash</span>
                                    <span className="text-[#00f0ff]">{chunkSize}</span>
                                </div>
                                <div className="flex gap-1 bg-[#0f0f13] p-1 rounded-lg border border-gray-800">
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <button 
                                            key={n}
                                            onClick={() => setChunkSize(n)}
                                            className={`flex-1 py-2 rounded font-mono font-bold text-sm transition-colors ${chunkSize === n ? 'bg-[#00f0ff] text-[#0f0f13]' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* WPM Slider */}
                            <div>
                                <div className="flex justify-between text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                                    <span>Speed (WPM)</span>
                                    <span className="text-[#00f0ff] text-lg">{wpm}</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="50" max="200" step="5" 
                                    value={wpm} 
                                    onChange={(e) => setWpm(Number(e.target.value))}
                                    className="w-full h-2 bg-[#0f0f13] rounded-lg appearance-none cursor-pointer accent-[#00f0ff]"
                                />
                                <div className="flex justify-between text-[10px] text-gray-600 mt-1 font-mono uppercase">
                                    <span>50</span>
                                    <span>125</span>
                                    <span>200</span>
                                </div>
                                
                                {/* Preset Buttons */}
                                <div className="flex gap-2 mt-4">
                                    {[
                                        { label: '基礎', wpm: 120, sub: 'Lv.1' },
                                        { label: '共通テスト', wpm: 150, sub: 'Lv.2' },
                                        { label: '上級', wpm: 180, sub: 'Lv.3' },
                                    ].map((level) => (
                                        <button
                                            key={level.wpm}
                                            onClick={() => setWpm(level.wpm)}
                                            className={`flex-1 py-2 rounded-lg border transition-all flex flex-col items-center justify-center gap-0.5
                                                ${wpm === level.wpm 
                                                ? 'bg-[#00f0ff]/10 border-[#00f0ff] text-white' 
                                                : 'bg-[#0f0f13] border-gray-800 text-gray-500 hover:border-gray-600 hover:text-gray-300'
                                                }`}
                                        >
                                            <span className="text-[10px] font-bold opacity-80">{level.sub}</span>
                                            <span className="text-xs font-bold">{level.label}</span>
                                            <span className="text-[9px] opacity-50 font-mono">{level.wpm}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )}

        {/* Progress Bar */}
        <div className={`w-full h-1.5 bg-[#1e1e24] rounded-full ${isLandscape ? 'mb-2' : 'mb-8'} overflow-hidden cursor-pointer group`}
             onClick={(e) => {
                 const rect = e.currentTarget.getBoundingClientRect();
                 const pos = (e.clientX - rect.left) / rect.width;
                 setWordIndex(Math.floor(pos * allWords.length));
             }}
        >
            <div 
                className="h-full bg-[#00f0ff] shadow-[0_0_10px_#00f0ff] transition-all duration-100 ease-linear group-hover:bg-white"
                style={{ width: `${progress}%` }}
            />
        </div>

        <div className={`flex items-center justify-center ${isLandscape ? 'gap-4' : 'gap-8'} ${isLandscape ? 'mb-1' : 'mb-4'}`}>
             <button onClick={() => setShowSettings(!showSettings)} className={`rounded-full transition-colors ${showSettings ? 'text-[#00f0ff] bg-[#00f0ff]/10' : 'text-gray-500 hover:text-white hover:bg-white/10'} ${isLandscape ? 'p-2' : 'p-3'}`}>
                <SettingsIcon className={isLandscape ? "w-4 h-4" : "w-6 h-6"} />
            </button>

             {/* Play/Pause Big Button */}
             <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={`rounded-full bg-[#00f0ff] text-[#0f0f13] flex items-center justify-center hover:scale-110 hover:shadow-[0_0_20px_#00f0ff] transition-all active:scale-95 ${isLandscape ? 'w-10 h-10' : 'w-16 h-16'}`}
            >
                {isPlaying ? <PauseIcon className={isLandscape ? "w-4 h-4" : ""} /> : <PlayIcon className={isLandscape ? "w-4 h-4" : ""} />}
            </button>
            
            {/* Placeholder for symmetry */}
            <div className={isLandscape ? "w-8" : "w-12"}></div>
        </div>
        
        <div className={`text-center text-gray-600 text-xs font-mono ${isLandscape ? 'hidden' : ''}`}>
            {wordIndex} / {allWords.length} WORDS
        </div>
      </div>
    </div>
  );
};
