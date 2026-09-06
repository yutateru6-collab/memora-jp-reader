
import React, { useState, useEffect, useCallback } from 'react';
import { AmazonData, AmazonReview, BoardKeyword, Card } from '../types';
import { Theme } from '../App';
import LightBulbIcon from './icons/LightBulbIcon';
import { getMaterialById } from '../lib/db';
import { grammarTerms, GrammarTerm } from '../lib/grammarTerms';

interface AmazonScreenProps {
  data: AmazonData;
  onBack: () => void;
  T: Theme;
  materialId: number;
  thumbnailUrl?: string;
  onUpdateMaterial: (id: number, data: any) => Promise<void>;
}

const sortedGrammarTerms = [...grammarTerms].sort((a, b) => b.term.length - a.term.length);

// ----------------------------------------------------------------------
// Helper Component: Tooltip Text (Matched with BoardScreen)
// ----------------------------------------------------------------------
const TooltipText: React.FC<{ 
    text: string; 
    keywords?: BoardKeyword[];
    onKeywordClick: (keyword: BoardKeyword, rect: DOMRect) => void;
}> = ({ text, keywords, onKeywordClick }) => {
    if (!keywords || keywords.length === 0) return <span>{text}</span>;

    const escapeRegExp = (string: string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

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

// Helper: Review Item
const ReviewItem: React.FC<{ 
    review: AmazonReview; 
    onSaveKeywords: (keywords: BoardKeyword[]) => void;
    isSaving: boolean;
    onGrammarClick: (e: React.MouseEvent<HTMLSpanElement>, term: GrammarTerm) => void;
    onKeywordClick: (keyword: BoardKeyword, rect: DOMRect) => void;
}> = ({ review, onSaveKeywords, isSaving, onGrammarClick, onKeywordClick }) => {
    const [openLines, setOpenLines] = useState<Set<number>>(new Set());
    const [showExplanation, setShowExplanation] = useState(false);
    const [showStars, setShowStars] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const toggleLine = (index: number) => {
        setOpenLines(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const handleSaveClick = () => {
        if (isSaved || !review.keywords || review.keywords.length === 0) return;
        onSaveKeywords(review.keywords);
        setIsSaved(true);
    };

    const cleanText = (text: string) => {
      if (!text) return "";
      // Remove romaji pronunciation in parentheses that follows Japanese characters.
      // Specifically targets lowercase to avoid removing grammatical markers like (S), (V), (O), (C).
      return text.replace(/([ぁ-んァ-ン一-龯])\s*\([a-z\s]+\)/g, '$1');
    };

    const renderGrammarTerms = (text: string) => {
      if (!text) return null;
      
      const cleanedText = cleanText(text);

      const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(${sortedGrammarTerms.map(t => escapeRegExp(t.term)).join('|')})`, 'g');
      
      const parts = cleanedText.split(pattern);
      
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

    // Render stars (Hidden by default logic)
    const stars = Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < Math.floor(review.rating) ? "text-yellow-500" : "text-gray-300"}>★</span>
    ));

    const jpLines = review.jp.split('\n');
    const enLines = review.en.split('\n');

    return (
        <div className="border-b border-gray-200 py-6 last:border-0 animate-fade-in font-sans">
            {/* Review Header */}
            <div className="flex justify-between items-start mb-2">
                <div>
                     <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-xs">
                            {review.author.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{review.author}</span>
                    </div>
                    
                    <div 
                        className="flex items-center gap-2 mb-1 cursor-pointer select-none" 
                        onClick={() => setShowStars(!showStars)}
                        title="クリックして評価を表示 (皮肉検知ゲーム)"
                    >
                        <div className="flex text-sm transition-opacity duration-300">
                            {showStars ? stars : <span className="text-gray-400 font-mono tracking-widest text-xs bg-gray-100 px-1 rounded">????? (Click to reveal)</span>}
                        </div>
                        <span className="font-bold text-gray-900 text-sm hover:underline">{review.title}</span>
                    </div>

                    <div className="text-xs text-gray-500 mb-2">
                        {review.date}
                        {review.verified_purchase && (
                            <span className="ml-2 text-orange-600 font-bold border-l border-gray-300 pl-2">Amazonで購入</span>
                        )}
                    </div>
                </div>

                {/* Helpful / Save Button */}
                {review.keywords && review.keywords.length > 0 && (
                     <button 
                        onClick={handleSaveClick}
                        disabled={isSaved || isSaving}
                        className={`flex items-center gap-1 text-xs px-3 py-1 rounded-md border shadow-sm transition-all transform active:scale-95
                        ${isSaved ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-default' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                        <span>{isSaved ? '✓ 役に立った' : '役に立った'}</span>
                    </button>
                )}
            </div>

            {/* Content: Japanese (Default) -> Click to show English (Line by Line) */}
            <div className="text-gray-800 text-base leading-relaxed mb-4">
                 <div className="flex flex-col items-start gap-1">
                    {jpLines.map((line, i) => {
                        if (!line.trim() && !enLines[i]) return <div key={i} className="h-2" />;
                        return (
                            <div key={i} className="w-full mb-1">
                                <div 
                                    className={`font-medium relative inline-block cursor-pointer px-1 -ml-1 rounded transition-colors hover:bg-gray-100 ${openLines.has(i) ? 'bg-gray-100' : ''}`}
                                    onClick={() => toggleLine(i)}
                                    title="クリックして英語を表示/非表示"
                                >
                                    {line}
                                </div>
                                {openLines.has(i) && (
                                    <div className="mt-1 pl-3 border-l-2 border-blue-200 animate-slide-in-left bg-blue-50/30 rounded-r p-1 text-gray-900">
                                         <TooltipText 
                                            text={enLines[i] || ''} 
                                            keywords={review.keywords} 
                                            onKeywordClick={onKeywordClick}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                 </div>
            </div>

            {/* Explanation Toggle */}
            <div className="flex justify-start">
                 <button 
                    onClick={() => setShowExplanation(!showExplanation)}
                    className={`text-xs px-3 py-1 rounded-full border transition-all flex items-center gap-1 ${showExplanation ? 'bg-yellow-100 text-yellow-700 border-yellow-300 font-bold' : 'bg-white border-gray-300 text-gray-500 hover:border-yellow-400 hover:text-yellow-600 hover:bg-yellow-50'}`}
                >
                    <LightBulbIcon className="w-3 h-3" />
                    {showExplanation ? '解説を閉じる' : '解説を見る'}
                </button>
            </div>
             {showExplanation && (
                <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm leading-relaxed border border-yellow-200 text-gray-700 animate-fade-in">
                    <span className="font-bold block mb-1">解説：</span>
                    {renderGrammarTerms(review.explanation)}
                </div>
             )}
        </div>
    );
};

const AmazonScreen: React.FC<AmazonScreenProps> = ({ data, onBack, T, materialId, thumbnailUrl, onUpdateMaterial }) => {
    // Colors
    const themeColor = data.theme_color || '#232F3E'; // Default Amazon Dark Blue
    const [isSavingFile, setIsSavingFile] = useState(false);
    const [cartCount, setCartCount] = useState(0);
    const [activeGrammarTerm, setActiveGrammarTerm] = useState<{ term: GrammarTerm, position: { top: number, left: number, width: number } } | null>(null);
    const [activeKeywordPopup, setActiveKeywordPopup] = useState<{ 
        keyword: BoardKeyword, 
        position: { top: number, left: number, width: number } 
    } | null>(null);

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

    // State for toggling Product Info (Japanese/English)
    const [showTitleEn, setShowTitleEn] = useState(false);
    const [showDescriptionEn, setShowDescriptionEn] = useState(false);
    const [featureEnStates, setFeatureEnStates] = useState<Set<number>>(new Set());

    const toggleFeatureEn = (index: number) => {
        setFeatureEnStates(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const handleSaveKeywords = useCallback(async (keywords: BoardKeyword[], showMessage = true) => {
        if (!materialId) {
            alert("この機能を使用するには、まずこの商品をライブラリに保存してください。");
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
                         existingCards = json.map((item: any, i: number) => ({
                             id: item.id || i,
                             front: item.front || item.word,
                             back: item.back || item.meaning,
                             pronunciation: item.pronunciation,
                             memo: item.memo
                         }));
                     }
                } catch (e) {
                    console.warn("Parsing failed", e);
                }
            }
            // 2. Append new keywords
            let nextId = existingCards.length > 0 ? Math.max(...existingCards.map(c => Number(c.id))) + 1 : 0;
            const newCards: Card[] = keywords.map(k => ({
                id: nextId++,
                front: k.word,
                back: k.meaning,
                memo: `Src: ${data.product.title.substring(0, 15)}...`
            }));
            
            // Filter duplicates
            const uniqueNewCards = newCards.filter(nc => !existingCards.some(ec => ec.front.toLowerCase() === nc.front.toLowerCase()));
            
            if (uniqueNewCards.length > 0) {
                const updatedCards = [...existingCards, ...uniqueNewCards];
                const jsonString = JSON.stringify(updatedCards.map(c => ({
                    word: c.front,
                    meaning: c.back,
                    memo: c.memo
                })), null, 2);
                const newFile = new File([jsonString], "words.json", { type: "application/json" });
                await onUpdateMaterial(materialId, { wordFile: newFile });
                setCartCount(prev => prev + uniqueNewCards.length);
            } else if (showMessage) {
                 // Only alert if specifically clicked "Helpful", not bulk add
                 alert("これらの単語は既に保存されています！");
            }
        } catch (e) {
            console.error("Failed to save words", e);
            alert("単語の保存に失敗しました。");
        } finally {
            setIsSavingFile(false);
        }
    }, [materialId, onUpdateMaterial, data.product.title]);

    const handleAddToCart = async () => {
        // Gather ALL keywords from reviews and related items
        let allKeywords: BoardKeyword[] = [];
        data.reviews.forEach(r => {
            if (r.keywords) allKeywords.push(...r.keywords);
        });
        if (data.frequently_bought_together) {
            data.frequently_bought_together.forEach(item => {
                allKeywords.push({ word: item.name, meaning: item.meaning });
            });
        }
        
        if (allKeywords.length === 0) {
            alert("保存する単語が見つかりませんでした。");
            return;
        }

        if (window.confirm(`${allKeywords.length}個の単語を単語帳に追加しますか？`)) {
             await handleSaveKeywords(allKeywords, false);
             alert(`ありがとうございます！\n${allKeywords.length}語の単語をカート(単語帳)に追加しました。`);
        }
    };

    // Prepare display data (Fallback to English if Japanese is missing)
    const displayTitle = data.product.title_jp || data.product.title;
    const englishTitle = data.product.title_jp ? data.product.title : null;

    const displayDescription = data.product.description_jp || data.product.description;
    const englishDescription = data.product.description_jp ? data.product.description : null;

    const displayFeatures = data.product.features_jp || data.product.features;
    const englishFeatures = data.product.features_jp ? data.product.features : null;

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 pb-12">
            {/* Header */}
            <header className="sticky top-0 z-30 flex items-center justify-between p-3 text-white shadow-md" style={{ backgroundColor: themeColor }}>
                 <div className="flex items-center gap-4">
                     <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-md transition-colors font-bold text-sm">
                        &larr; 戻る
                     </button>
                     <div className="font-bold text-xl tracking-tight">Amazon.ai</div>
                 </div>
                 <div className="flex-grow max-w-2xl mx-4 hidden sm:block">
                     <div className="flex bg-white rounded overflow-hidden">
                         <input type="text" className="flex-grow px-3 py-2 text-gray-900 outline-none" placeholder="Amazon.ai で検索" />
                         <button className="px-4 bg-orange-400 hover:bg-orange-500 transition-colors">🔍</button>
                     </div>
                 </div>
                 <div className="flex gap-4 text-sm font-bold items-center">
                     <div className="cursor-pointer hover:underline">注文履歴</div>
                     <div className="cursor-pointer hover:underline flex items-center gap-1">
                        <span>カート</span>
                        <span className="bg-orange-400 text-gray-900 rounded-full w-5 h-5 flex items-center justify-center text-xs">{cartCount}</span>
                     </div>
                 </div>
            </header>

            {/* Sub-header (Navigation) */}
            <div className="bg-gray-800 text-white text-sm px-4 py-2 flex gap-4 overflow-x-auto whitespace-nowrap scrollbar-hide" style={{ backgroundColor: '#232f3e' }}>
                <span className="font-bold">☰ すべて</span>
                <span>タイムセール</span>
                <span>カスタマーサービス</span>
                <span>リスト</span>
                <span>ギフトカード</span>
                <span>出品</span>
            </div>

            <main className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
                {/* Product Section */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12 border-b border-gray-200 pb-8">
                    {/* Image Column */}
                    <div className="md:col-span-5 flex justify-center">
                        <div className="relative w-full aspect-square max-w-md border border-gray-200 rounded p-4 flex items-center justify-center bg-white">
                             {thumbnailUrl ? (
                                 <img src={thumbnailUrl} alt={data.product.title} className="max-w-full max-h-full object-contain" />
                             ) : (
                                 <div className="text-gray-300 flex flex-col items-center">
                                     <span className="text-6xl mb-2">📦</span>
                                     <span>No Image Available</span>
                                 </div>
                             )}
                        </div>
                    </div>

                    {/* Details Column */}
                    <div className="md:col-span-5">
                         {/* Product Title (Toggleable) */}
                         <div 
                            className="mb-2 cursor-pointer group" 
                            onClick={() => setShowTitleEn(!showTitleEn)}
                            title="クリックして英語原文を表示"
                         >
                             <h1 className="text-2xl sm:text-3xl font-medium leading-tight text-gray-900 group-hover:text-blue-700">
                                 {displayTitle}
                             </h1>
                             {showTitleEn && englishTitle && (
                                 <div className="mt-2 text-base text-gray-500 font-normal animate-fade-in border-l-2 border-gray-300 pl-2">
                                     {englishTitle}
                                 </div>
                             )}
                         </div>

                         <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-4">
                             <div className="flex text-yellow-500 text-sm">
                                 {Array.from({length:5}).map((_,i) => <span key={i}>{i < Math.floor(data.product.rating) ? '★' : '☆'}</span>)}
                             </div>
                             <span className="text-blue-600 hover:underline cursor-pointer">{data.product.rating_count} ratings</span>
                         </div>
                         
                         <div className="mb-4">
                             <span className="text-sm text-gray-500">価格:</span>
                             <span className="text-2xl text-red-700 font-medium ml-2">{data.product.price}</span>
                         </div>

                         {/* Features (Bullet Points) */}
                         <div className="mb-6">
                             <h3 className="font-bold text-gray-900 mb-2">この商品について</h3>
                             <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
                                 {displayFeatures.map((feature, i) => (
                                     <li 
                                        key={i} 
                                        onClick={() => toggleFeatureEn(i)}
                                        className="cursor-pointer hover:bg-gray-50 rounded p-1 transition-colors"
                                        title="クリックして英語を表示"
                                     >
                                         <div className="font-medium">{feature}</div>
                                         {featureEnStates.has(i) && englishFeatures && englishFeatures[i] && (
                                             <div className="mt-1 text-gray-500 text-xs border-l-2 border-gray-300 pl-2 animate-fade-in">
                                                 {englishFeatures[i]}
                                             </div>
                                         )}
                                     </li>
                                 ))}
                             </ul>
                         </div>
                         
                         {/* Description (Toggleable) */}
                         {displayDescription && (
                             <div 
                                className="text-sm text-gray-800 leading-relaxed mb-4 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                                onClick={() => setShowDescriptionEn(!showDescriptionEn)}
                                title="クリックして英語原文を表示"
                             >
                                 <div>{displayDescription}</div>
                                 {showDescriptionEn && englishDescription && (
                                     <div className="mt-2 text-gray-500 border-l-2 border-gray-300 pl-2 animate-fade-in">
                                         {englishDescription}
                                     </div>
                                 )}
                             </div>
                         )}

                         {/* Frequently Bought Together (Related Words) */}
                         {data.frequently_bought_together && data.frequently_bought_together.length > 0 && (
                             <div className="mt-8 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                                 <h3 className="font-bold text-orange-700 mb-3 text-sm uppercase tracking-wide">よく一緒に購入されている商品 (関連語)</h3>
                                 <div className="space-y-2">
                                     {data.frequently_bought_together.map((item, i) => (
                                         <div key={i} className="flex items-center gap-2 text-sm group cursor-pointer hover:bg-gray-50 p-1 rounded">
                                             <div className="w-5 h-5 border border-gray-300 rounded bg-blue-500 flex items-center justify-center text-white text-[10px]">✓</div>
                                             <span className="font-bold text-blue-600 group-hover:underline">{item.name}</span>
                                             <span className="text-gray-500 text-xs">- {item.meaning}</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         )}
                    </div>

                    {/* Buy Box Column */}
                    <div className="md:col-span-2">
                        <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
                            <div className="text-xl text-red-700 font-medium mb-2">{data.product.price}</div>
                            <div className="text-sm text-green-700 font-bold mb-4">在庫あり</div>
                            
                            <button 
                                onClick={handleAddToCart}
                                disabled={isSavingFile}
                                className="w-full bg-yellow-400 hover:bg-yellow-500 py-2 rounded-full shadow-sm text-sm font-medium mb-2 transition-colors flex items-center justify-center gap-1 active:scale-95 transform"
                            >
                                <span className="text-lg">🛒</span> カートに入れる
                            </button>
                            <p className="text-xs text-gray-500 text-center mb-4">
                                ※ページ内の全単語を保存します
                            </p>

                            <button className="w-full bg-orange-400 hover:bg-orange-500 py-2 rounded-full shadow-sm text-sm font-medium transition-colors cursor-not-allowed opacity-80">
                                今すぐ買う
                            </button>
                        </div>
                    </div>
                </div>

                {/* Reviews Section */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                     <div className="md:col-span-3">
                         <h3 className="font-bold text-lg mb-2">カスタマーレビュー</h3>
                         <div className="flex items-center gap-2 mb-2">
                             <div className="flex text-yellow-500 text-sm">★★★★☆</div>
                             <span className="text-gray-800 font-medium">{data.product.rating} / 5</span>
                         </div>
                         <div className="text-sm text-gray-500 mb-4">{data.product.rating_count} 件のグローバル評価</div>
                         {/* Fake histogram */}
                         {[5,4,3,2,1].map((star, i) => (
                             <div key={star} className="flex items-center gap-2 text-sm text-blue-600 hover:underline cursor-pointer mb-1">
                                 <span className="w-12 text-gray-700 no-underline hover:no-underline">星{star}つ</span>
                                 <div className="flex-grow h-4 bg-gray-100 rounded-sm overflow-hidden border border-gray-200">
                                     <div className="h-full bg-yellow-400 border border-yellow-500" style={{ width: `${star === 5 ? 60 : star === 4 ? 20 : star === 1 ? 10 : 5}%` }}></div>
                                 </div>
                                 <span className="w-8 text-right text-gray-700 no-underline hover:no-underline">{star === 5 ? '60%' : '10%'}</span>
                             </div>
                         ))}
                     </div>

                     <div className="md:col-span-9">
                         <div className="flex justify-between items-center mb-4">
                             <h3 className="font-bold text-lg">トップレビュー</h3>
                         </div>
                         
                         <div>
                             {data.reviews.map((review) => (
                                 <ReviewItem 
                                    key={review.id} 
                                    review={review}
                                    onSaveKeywords={handleSaveKeywords}
                                    isSaving={isSavingFile}
                                    onGrammarClick={handleGrammarClick}
                                    onKeywordClick={handleKeywordClick}
                                />
                             ))}
                         </div>
                     </div>
                </div>
            </main>

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

export default AmazonScreen;
