







import React, { useState, useEffect, useCallback } from 'react';
import { BoardThread, BoardPost, BoardKeyword, Card } from '../types';
import { Theme } from '../App';
import { getMaterialById } from '../lib/db';
import LightBulbIcon from './icons/LightBulbIcon';
import { grammarTerms, GrammarTerm } from '../lib/grammarTerms';

interface BoardScreenProps {
  data: BoardThread;
  onBack: () => void;
  T: Theme;
  materialId: number;
  onUpdateMaterial: (id: number, data: { wordFile?: File | null }) => Promise<void>;
}

const sortedGrammarTerms = [...grammarTerms].sort((a, b) => b.term.length - a.term.length);

// ----------------------------------------------------------------------
// Helper Component: Keyword Parser (Logic extracted from old TooltipText)
// ----------------------------------------------------------------------
const KeywordParser: React.FC<{ 
    text: string; 
    keywords?: BoardKeyword[];
    onKeywordClick: (keyword: BoardKeyword, rect: DOMRect) => void; 
}> = ({ text, keywords, onKeywordClick }) => {
    if (!keywords || keywords.length === 0) return <span>{text}</span>;

    // Escape regex special characters
    const escapeRegExp = (string: string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Create a regex that matches any of the keywords, ignoring case
    // Sort keywords by length (longest first) to match specific phrases before partial words
    const sortedKeywords = [...keywords].sort((a, b) => b.word.length - a.word.length);
    const pattern = new RegExp(`(${sortedKeywords.map(k => escapeRegExp(k.word)).join('|')})`, 'gi');
    
    const parts = text.split(pattern);

    return (
        <span>
            {parts.map((part, i) => {
                const match = keywords.find(k => k.word.toLowerCase() === part.toLowerCase());
                
                if (match) {
                    return (
                        <span key={i} className="relative inline-block">
                            <span 
                                className="text-blue-500 underline decoration-dotted decoration-blue-400/50 cursor-pointer hover:text-blue-400 transition-colors font-bold"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    onKeywordClick(match, rect);
                                }}
                            >
                                {part}
                            </span>
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};

// ----------------------------------------------------------------------
// Wrapper Component: Tooltip Text (Handles Bold Highlights + Keywords)
// ----------------------------------------------------------------------
const TooltipText: React.FC<{ 
    text: string; 
    keywords?: BoardKeyword[];
    onKeywordClick: (keyword: BoardKeyword, rect: DOMRect) => void; 
}> = ({ text, keywords, onKeywordClick }) => {
    // Split by **bold** markers first
    // Matches **content** and captures content
    const parts = text.split(/(\*\*[^*]+\*\*)/g);

    return (
        <span>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    // Extract content inside **...**
                    const content = part.slice(2, -2);
                    return (
                        <span key={i} className="bg-yellow-300/40 text-yellow-700 dark:text-yellow-200 font-black px-1 mx-0.5 rounded shadow-sm border-b-2 border-yellow-400/50">
                            <KeywordParser 
                                text={content} 
                                keywords={keywords} 
                                onKeywordClick={onKeywordClick} 
                            />
                        </span>
                    );
                }
                // Normal text
                return (
                    <KeywordParser 
                        key={i} 
                        text={part} 
                        keywords={keywords} 
                        onKeywordClick={onKeywordClick} 
                    />
                );
            })}
        </span>
    );
};

// ----------------------------------------------------------------------
// Helper Component: Board Post Item
// ----------------------------------------------------------------------
const BoardPostItem: React.FC<{ 
    post: BoardPost; 
    textColorClass: string;
    onSaveKeywords: (keywords: BoardKeyword[]) => void;
    onSaveLine: (jp: string, en: string, postInfo: string) => void; 
    isSaving: boolean;
    onGrammarClick: (e: React.MouseEvent<HTMLSpanElement>, term: GrammarTerm) => void;
    onKeywordClick: (keyword: BoardKeyword, rect: DOMRect) => void;
}> = ({ post, textColorClass, onSaveKeywords, onSaveLine, isSaving, onGrammarClick, onKeywordClick }) => {
  const [openLines, setOpenLines] = useState<Set<number>>(new Set());
  const [savedLines, setSavedLines] = useState<Set<number>>(new Set());
  const [showExplanation, setShowExplanation] = useState(false); // Controls explanation visibility
  const [isSaved, setIsSaved] = useState(false);

  // 5ch-like style formatting
  const nameColor = 'text-[#228b22] font-bold';
  const metaColor = 'text-gray-500 text-sm font-mono';

  // Handle Word Saving
  const handleSaveClick = () => {
      if (isSaved || !post.keywords || post.keywords.length === 0) return;
      onSaveKeywords(post.keywords);
      setIsSaved(true);
  };
  
  const toggleLine = (index: number) => {
      setOpenLines(prev => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return next;
      });
  };

  const handleLineCheck = (e: React.MouseEvent, index: number, jp: string, en: string) => {
      e.stopPropagation();
      if (savedLines.has(index)) return; // Already saved

      const postInfo = `元スレ >>${post.id}`;
      onSaveLine(jp, en, postInfo);
      
      setSavedLines(prev => {
          const next = new Set(prev);
          next.add(index);
          return next;
      });
  };

  const renderGrammarTerms = (text: string) => {
      if (!text) return null;
      const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(${sortedGrammarTerms.map(t => escapeRegExp(t.term)).join('|')})`, 'g');
      
      const parts = text.split(pattern);
      
      return parts.map((part, i) => {
          const term = sortedGrammarTerms.find(t => t.term === part);
          if (term) {
              return (
                  <span 
                      key={i} 
                      className="border-b border-dotted border-gray-400 cursor-help hover:text-sky-500 hover:border-sky-500 transition-colors font-medium"
                      onClick={(e) => onGrammarClick(e, term)}
                  >
                      {part}
                  </span>
              );
          }
          return part;
      });
  };

  const jpLines = post.jp.split('\n');
  const enLines = post.en.split('\n');

  return (
    <div className="mb-8 font-sans group animate-fade-in">
      {/* Header: 1 Name Date ID */}
      <div className="mb-1 flex justify-between items-center">
        <div>
            <span className={`${textColorClass} font-bold mr-2`}>{post.id}:</span>
            <span className={`${nameColor} mr-2`}>{post.name}</span>
            <span className={metaColor}>{post.date} ID:{post.uid}</span>
        </div>
        
        {/* Save Button */}
        {post.keywords && post.keywords.length > 0 && (
            <button 
                onClick={handleSaveClick}
                disabled={isSaved || isSaving}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-all transform active:scale-95
                ${isSaved ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-700 border border-gray-300'}`}
                title="このレスの単語を保存"
            >
                <span className="text-lg leading-none">{isSaved ? '✓' : '👍️'}</span>
                <span className="hidden sm:inline font-bold">{isSaved ? 'Saved' : 'Good'}</span>
            </button>
        )}
      </div>

      {/* Body */}
      <div className={`ml-4 sm:ml-8 text-lg leading-relaxed ${textColorClass}`}>
         <div className="flex flex-col items-start gap-1">
            {jpLines.map((line, i) => {
                // Skip empty lines in display if they have no content, but keep index logic
                if (!line.trim() && !enLines[i]) return <div key={i} className="h-2" />;
                
                const isLineSaved = savedLines.has(i);

                return (
                    <div key={i} className="w-full mb-1 flex items-start gap-2 group/line">
                        {/* Stealth Checkbox */}
                        <button
                            onClick={(e) => handleLineCheck(e, i, line, enLines[i] || '')}
                            className={`mt-1.5 w-4 h-4 flex-shrink-0 rounded-sm border flex items-center justify-center transition-all duration-200 cursor-pointer
                                ${isLineSaved 
                                    ? 'bg-green-500 border-green-500 text-white opacity-100' 
                                    : 'border-gray-400 text-transparent bg-transparent opacity-20 hover:opacity-100 hover:border-blue-400'
                                }`}
                            title="この文をカードとして保存"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                {isLineSaved ? <polyline points="20 6 9 17 4 12" /> : <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>}
                            </svg>
                        </button>

                        <div className="flex-grow">
                            <div 
                                className={`whitespace-pre-wrap font-medium relative inline-block cursor-pointer px-1 -ml-1 rounded transition-colors hover:bg-black/5 ${openLines.has(i) ? 'bg-black/5' : ''}`}
                                onClick={() => toggleLine(i)}
                                title="クリックして英語を表示/非表示"
                            >
                                {/* Anchor only on first line */}
                                {i === 0 && post.anchor && (
                                    <span 
                                        className="text-blue-500 mr-1 underline cursor-pointer hover:text-blue-400"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        &gt;&gt;{post.anchor}
                                    </span>
                                )}
                                {line}
                            </div>

                            {openLines.has(i) && (
                                <div className="mt-2 pl-4 border-l-4 border-gray-300 animate-slide-in-left bg-gray-50/50 rounded-r-lg p-2">
                                    {/* Good English (Simplified: No Bad English, No Circle Symbol) */}
                                    <div className="text-lg font-bold text-gray-800">
                                        <TooltipText 
                                            text={enLines[i] || ''} 
                                            keywords={post.keywords} 
                                            onKeywordClick={onKeywordClick}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
         </div>

         {/* Explanation Button (Always at bottom of post) */}
         <div className="pt-2 flex justify-end">
            <button 
                onClick={() => setShowExplanation(!showExplanation)}
                className={`text-xs px-3 py-1 rounded-full border transition-all flex items-center gap-1 ${showExplanation ? 'bg-yellow-100 text-yellow-700 border-yellow-300 font-bold shadow-inner' : 'bg-white border-gray-300 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 hover:bg-yellow-50 shadow-sm'}`}
            >
                <LightBulbIcon className="w-3 h-3" />
                {showExplanation ? '解説を閉じる' : '解説を見る'}
            </button>
         </div>

         {/* Explanation Content */}
         {showExplanation && (
            <div className="mt-2 p-3 bg-yellow-50 rounded-lg text-sm leading-relaxed border border-yellow-200 text-gray-700 animate-fade-in shadow-sm">
                <span className="font-bold block mb-1">解説：</span>
                {renderGrammarTerms(post.explanation || post.nuance_tip || "解説はありません。")}
            </div>
         )}
      </div>
    </div>
  );
};

const BoardScreen: React.FC<BoardScreenProps> = ({ data, onBack, T, materialId, onUpdateMaterial }) => {
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [activeGrammarTerm, setActiveGrammarTerm] = useState<{ term: GrammarTerm, position: { top: number, left: number, width: number } } | null>(null);
  const [activeKeywordPopup, setActiveKeywordPopup] = useState<{ 
        keyword: BoardKeyword, 
        position: { top: number, left: number, width: number } 
  } | null>(null);
  const [openRelatedIndices, setOpenRelatedIndices] = useState<Set<number>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // State for background color, defaulting to JSON data or White
  const [bgColor, setBgColor] = useState(data.background_color || '#FFFFFF');

  const handleGrammarClick = useCallback((e: React.MouseEvent<HTMLSpanElement>, term: GrammarTerm) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveGrammarTerm({
          term,
          position: { top: rect.top, left: rect.left, width: rect.width }
      });
      setActiveKeywordPopup(null);
  }, []);

  const handleKeywordClick = useCallback((keyword: BoardKeyword, rect: DOMRect) => {
      setActiveKeywordPopup({
          keyword,
          position: { top: rect.top, left: rect.left, width: rect.width }
      });
      setActiveGrammarTerm(null);
  }, []);

  // Chameleon Logic: Dynamic Styles based on JSON data
  // Override App Theme just for this component
  const dynamicHeaderStyle = data.theme_color ? { backgroundColor: data.theme_color } : {};
  
  // Logic for smart text contrast based on background color
  // Simple heuristic: If background is light, text should be dark
  const isLightBg = (color: string) => {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return brightness > 155;
  };
  
  // Override the dark mode text color if the background is light (e.g. white summary site)
  const textColorClass = isLightBg(bgColor) ? 'text-gray-900' : 'text-gray-100';

  const dynamicBgStyle = { backgroundColor: bgColor };
  
  // Use the blog title from JSON if available, otherwise use thread title or default
  const blogTitle = data.blog_title || "まとめブログ速報";

  const showToast = (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 2000);
  };

  const handleSaveLine = useCallback(async (jp: string, en: string, postInfo: string) => {
      if (!materialId) {
          alert("この機能を使用するには、まずこのスレッドをライブラリに保存してください。");
          return;
      }
      
      try {
          // 1. Fetch existing word file content
          let existingCards: Card[] = [];
          const material = await getMaterialById(materialId);
          
          if (material.wordFile) {
              const text = await material.wordFile.text();
              try {
                   const json = JSON.parse(text);
                   if (Array.isArray(json)) {
                       existingCards = json.map((item: any, i: number) => ({
                           id: item.id || i,
                           front: item.front || item.word,
                           back: item.back || item.meaning,
                           pronunciation: item.pronunciation,
                           memo: item.memo
                       }));
                   }
              } catch (e) {}
          }

          // 2. Append new card
          const nextId = existingCards.length > 0 ? Math.max(...existingCards.map(c => Number(c.id))) + 1 : 0;
          
          const newCard: Card = {
              id: nextId,
              front: jp,
              back: en,
              memo: `${postInfo} / ${data.title.substring(0, 15)}...`
          };
          
          // Avoid duplicates (exact match of front)
          if (existingCards.some(c => c.front === jp)) {
              showToast("既に保存済みです");
              return;
          }

          const updatedCards = [...existingCards, newCard];

          // 3. Save back
          const jsonString = JSON.stringify(updatedCards.map(c => ({
              word: c.front, // Using 'word' schema for compatibility
              meaning: c.back,
              memo: c.memo
          })), null, 2);
          
          const newFile = new File([jsonString], "words.json", { type: "application/json" });
          await onUpdateMaterial(materialId, { wordFile: newFile });
          
          showToast("文を保存しました！");

      } catch (e) {
          console.error("Failed to save line", e);
          showToast("保存に失敗しました");
      }
  }, [materialId, onUpdateMaterial, data.title]);

  const handleSaveKeywords = useCallback(async (keywords: BoardKeyword[]) => {
      if (!materialId) {
          alert("この機能を使用するには、まずこのスレッドをライブラリに保存してください。");
          return;
      }
      setIsSavingFile(true);

      try {
          // 1. Fetch existing word file content
          let existingCards: Card[] = [];
          const material = await getMaterialById(materialId);
          
          if (material.wordFile) {
              const text = await material.wordFile.text();
              try {
                   const json = JSON.parse(text);
                   if (Array.isArray(json)) {
                       // Map raw JSON to Cards to normalize
                       existingCards = json.map((item: any, i: number) => ({
                           id: item.id || i,
                           front: item.front || item.word,
                           back: item.back || item.meaning,
                           pronunciation: item.pronunciation,
                           memo: item.memo
                       }));
                   }
              } catch (e) {
                  console.warn("Could not parse existing word file as JSON, starting fresh or appending if possible.");
              }
          }

          // 2. Append new keywords
          let nextId = existingCards.length > 0 ? Math.max(...existingCards.map(c => Number(c.id))) + 1 : 0;
          
          const newCards: Card[] = keywords.map(k => ({
              id: nextId++,
              front: k.word,
              back: k.meaning,
              memo: `Src: ${data.title.substring(0, 20)}...`
          }));
          
          // Filter duplicates (simple check by front)
          const uniqueNewCards = newCards.filter(nc => !existingCards.some(ec => ec.front.toLowerCase() === nc.front.toLowerCase()));

          if (uniqueNewCards.length === 0) {
              showToast("これらの単語は既に保存されています");
              setIsSavingFile(false);
              return;
          }

          const updatedCards = [...existingCards, ...uniqueNewCards];

          // 3. Save back to file
          const jsonString = JSON.stringify(updatedCards.map(c => ({
              word: c.front,
              meaning: c.back,
              memo: c.memo
          })), null, 2);
          
          const newFile = new File([jsonString], "words.json", { type: "application/json" });
          await onUpdateMaterial(materialId, { wordFile: newFile });
          showToast(`${uniqueNewCards.length}単語を保存しました！`);

      } catch (e) {
          console.error("Failed to save words", e);
          showToast("単語の保存に失敗しました");
      } finally {
          setIsSavingFile(false);
      }
  }, [materialId, onUpdateMaterial, data.title]);

  const toggleRelatedThread = (index: number, hasEnglish: boolean) => {
      if (!hasEnglish) {
          alert("※このスレッドは過去ログ倉庫に格納されています。\n(これはダミーリンクです)");
          return;
      }
      setOpenRelatedIndices(prev => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return next;
      });
  };

  // Background Presets
  const bgPresets = [
      '#FFFFFF', // White
      '#202020', // Dark
      '#FFFDE7', // Light Yellow (Paper)
      '#F0F9FF', // Light Blue (Tech)
      '#FFF0F5', // Pink (Sweet)
  ];

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 relative`} style={dynamicBgStyle}>
      {/* Toast Notification */}
      {toastMessage && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-black/80 text-white px-4 py-2 rounded-full shadow-lg animate-fade-in text-sm font-bold flex items-center gap-2">
              <span className="text-green-400">✓</span> {toastMessage}
          </div>
      )}

      {/* Blog Header (Chameleon) */}
      <header 
        className={`flex-shrink-0 flex items-center gap-4 p-4 border-b border-black/5 sticky top-0 z-20 shadow-md transition-colors duration-200`}
        style={dynamicHeaderStyle} // Apply dynamic color here
      >
         <button onClick={onBack} className={`flex items-center gap-2 px-3 py-2 text-sm bg-black/20 text-white rounded-md transition-colors hover:bg-black/40 shadow-sm`}>
          &larr; 戻る
        </button>
        <div className="flex-grow">
            <h1 className={`text-xl md:text-2xl font-black tracking-tighter text-white drop-shadow-md line-clamp-1`}>
               {blogTitle}
            </h1>
            <p className="text-[10px] text-white/80 leading-none font-bold">VIP・なんJ・英語学習まとめ</p>
        </div>
        
        {/* Background Color Switcher */}
        <div className="flex items-center gap-1.5 bg-black/20 p-1.5 rounded-full backdrop-blur-sm flex-shrink-0">
            {bgPresets.map(color => (
                <button
                    key={color}
                    onClick={() => setBgColor(color)}
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border transition-transform hover:scale-110 ${bgColor === color ? 'border-white scale-110 shadow-md ring-1 ring-white/50' : 'border-transparent opacity-70 hover:opacity-100'}`}
                    style={{ backgroundColor: color }}
                    title={color}
                />
            ))}
        </div>
      </header>

      {/* Main Content: Thread Title + Posts */}
      <main className="flex-grow p-2 sm:p-6 max-w-4xl mx-auto w-full">
         
         {/* Thread Title Area */}
         <div className="mb-6 px-2">
             <h2 className={`text-xl md:text-2xl font-bold mb-2 leading-relaxed ${isLightBg(bgColor) ? 'text-[#ff4500]' : 'text-[#ff6347]'}`}>
                 {data.title}
             </h2>
             <div className={`text-xs flex gap-4 ${isLightBg(bgColor) ? 'text-gray-500' : 'text-gray-400'}`}>
                 <span>{data.posts.length} comments</span>
                 <span>1000kb</span>
             </div>
         </div>

         {/* Posts Container */}
         <div className={`rounded-lg min-h-full p-2 sm:p-6 shadow-sm ${isLightBg(bgColor) ? 'bg-white' : 'bg-black/20 backdrop-blur-sm border border-white/5'}`}>
             {data.posts.map((post) => (
                 <BoardPostItem 
                    key={post.id} 
                    post={post} 
                    textColorClass={textColorClass}
                    onSaveKeywords={handleSaveKeywords}
                    onSaveLine={handleSaveLine}
                    isSaving={isSavingFile}
                    onGrammarClick={handleGrammarClick}
                    onKeywordClick={handleKeywordClick}
                />
             ))}

             {/* Related Threads (New Feature) */}
             {data.related_threads && data.related_threads.length > 0 && (
                <div className="mt-12 mb-8 pt-8 border-t border-gray-200/50">
                    <div className={`text-base font-bold mb-3 ${isLightBg(bgColor) ? 'text-gray-700' : 'text-gray-300'} border-l-4 border-blue-500 pl-3`}>
                        あわせて読みたい
                    </div>
                    <ul className="space-y-2.5">
                        {data.related_threads.map((thread, index) => (
                            <li key={index} className="flex flex-col">
                                <div className="flex items-start gap-2">
                                    <span className="text-gray-400 text-xs pt-1">●</span>
                                    <button 
                                        onClick={() => toggleRelatedThread(index, !!thread.title_en)}
                                        className={`text-left text-sm sm:text-base hover:underline font-medium leading-relaxed transition-colors ${isLightBg(bgColor) ? 'text-blue-700 visited:text-purple-800 hover:text-orange-600' : 'text-blue-400 visited:text-purple-400 hover:text-orange-400'}`}
                                    >
                                        {thread.title}
                                    </button>
                                </div>
                                {openRelatedIndices.has(index) && thread.title_en && (
                                    <div className={`ml-5 mt-1 p-2 rounded text-sm border-l-4 border-green-400 animate-fade-in ${isLightBg(bgColor) ? 'bg-gray-100 text-gray-800' : 'bg-gray-800 text-gray-200'}`}>
                                        <span className="font-bold text-xs text-green-600 block mb-0.5">English Title:</span>
                                        {thread.title_en}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
             )}
         </div>
         
         {/* Footer Area */}
         <div className={`mt-12 pt-8 border-t ${isLightBg(bgColor) ? 'border-gray-200 text-gray-400' : 'border-gray-700 text-gray-500'} text-center text-sm pb-8`}>
             <p className="mb-2">元スレ: {data.title}</p>
             <p>Copyright © {blogTitle} All Rights Reserved.</p>
         </div>
      </main>

      {/* Fixed Keyword Popup */}
      {activeKeywordPopup && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveKeywordPopup(null)} />
          <div 
              className="fixed z-50 bg-slate-800 text-white text-xs p-2 rounded shadow-xl border border-slate-600 animate-fade-in min-w-[120px] max-w-[200px]"
              style={{ 
                  top: Math.round(activeKeywordPopup.position.top) + 30, 
                  left: Math.round(activeKeywordPopup.position.left + (activeKeywordPopup.position.width / 2)), 
                  transform: 'translate(-50%, 0)',
                  marginTop: '0.5rem',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
              }}
              onClick={(e) => e.stopPropagation()}
          >
              <div className="font-bold text-sky-300 mb-1 pb-1 border-b border-slate-600">{activeKeywordPopup.keyword.word}</div>
              <div>{activeKeywordPopup.keyword.meaning}</div>
              {/* Arrow pointing up */}
              <div className="absolute top-[-5px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 border-t border-l border-slate-600 transform rotate-45"></div>
          </div>
        </>
      )}

      {activeGrammarTerm && (
        <>
          <div 
              className="fixed inset-0 z-40 bg-transparent" 
              onClick={(e) => {
                  e.stopPropagation();
                  setActiveGrammarTerm(null);
              }}
          />
          <div 
              className="fixed z-50 bg-slate-800 text-white text-sm p-3 rounded-lg shadow-2xl border border-slate-600 animate-fade-in"
              style={{ 
                  top: Math.round(activeGrammarTerm.position.top) + 30, 
                  left: Math.round(activeGrammarTerm.position.left),
                  maxWidth: '300px',
                  width: 'max-content',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale'
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
        </>
      )}
    </div>
  );
};

export default BoardScreen;