import React, { useState, useEffect } from 'react';
import { Theme } from '../App';
import { TranscriptEntry, Card, QuizQuestion } from '../types';
import { getMaterialById } from '../lib/db';

interface PdfExportModalProps {
  T: Theme;
  onClose: () => void;
  materialId: number;
  title: string;
  transcript: TranscriptEntry[];
  hasWordFile: boolean;
  hasQuizFile: boolean;
}

const PrinterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const stripWordCodeFences = (text: string) => text
  .trim()
  .replace(/^```(?:json|text)?\s*/i, '')
  .replace(/\s*```$/, '')
  .trim();

const mapCardJsonArray = (json: any[]): Card[] => json.map((item: any, index: number) => ({
  id: index,
  front: item.front || item.word || '',
  back: item.back || item.meaning || '',
  pronunciation: item.pronunciation,
  memo: item.memo,
}));

export const formatPdfPronunciation = (value?: string) => {
  if (!value) return '';
  const normalized = value.replace(/［/g, '[').replace(/］/g, ']');
  return normalized.includes('[') || normalized.includes(']') ? normalized : `[${normalized}]`;
};

export const parsePdfWordCards = (rawText: string, fileName = '', fileType = ''): Card[] => {
  const text = stripWordCodeFences(rawText);
  const isDeclaredJson = fileName.toLowerCase().endsWith('.json') || fileType === 'application/json';

  if (text.startsWith('[')) {
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) return mapCardJsonArray(json);
      if (isDeclaredJson) return [];
    } catch (e) {
      if (isDeclaredJson) return [];
    }
  } else if (isDeclaredJson) {
    return [];
  }

  return text.split('\n').filter(line => line.trim()).map((line, index) => {
    const spacedParts = line.split(/\s+\/\s+/).map(part => part.trim());
    const parts = spacedParts.length >= 2 ? spacedParts : line.split('/').map(part => part.trim());
    const firstPart = parts[0] || '';
    const richPromptFormat = parts.length >= 4 && /語源|雑学|【覚え方】/.test(parts[2] || '');

    if (richPromptFormat) {
      const withoutLeadingEmoji = firstPart.replace(/^[^A-Za-z0-9]+/, '').trim();
      const pronunciationMatch = withoutLeadingEmoji.match(/^(.+?)\s+([ァ-ヶー]*[［\[][ァ-ヶー]+[］\]][ァ-ヶー]*|[ァ-ヶー]+)\s*$/);
      if (pronunciationMatch) {
        const etymology = parts[2] || '';
        const example = parts.slice(3).join(' / ');
        return {
          id: index,
          front: pronunciationMatch[1].trim(),
          back: parts[1] || '',
          pronunciation: pronunciationMatch[2].replace(/［/g, '[').replace(/］/g, ']'),
          memo: `${etymology.startsWith('【語源・雑学】') ? '' : '【語源・雑学】\n'}${etymology}${example ? `\n\n【例文】\n${example}` : ''}`,
        };
      }
    }

    return {
      id: index,
      front: parts[0] || '',
      back: parts[1] || '',
      pronunciation: parts[2],
      memo: parts[3],
    };
  });
};

const PdfExportModal: React.FC<PdfExportModalProps> = ({ T, onClose, materialId, title, transcript, hasWordFile, hasQuizFile }) => {
  const [options, setOptions] = useState({
    english: true,
    japanese: true,
    explanation: true,
    wordList: hasWordFile,
    quiz: hasQuizFile,
  });

  const [layout, setLayout] = useState<'sideBySide' | 'englishOnly' | 'japaneseOnly'>('sideBySide');
  const [words, setWords] = useState<Card[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Calculate default target study times
  // Count words
  const totalWordCount = React.useMemo(() => {
    return transcript.reduce((acc, t) => {
      const wordsInSentence = t.english.split(/\s+/).filter(Boolean).length;
      return acc + wordsInSentence;
    }, 0);
  }, [transcript]);

  // Target times calculations (WPM 120 and WPM 150)
  const default1stTime = Math.round(totalWordCount / (120 / 60)); // WPM 120
  const default2ndTime = Math.round(totalWordCount / (150 / 60)); // WPM 150

  const [targetTime1st, setTargetTime1st] = useState<number | string>(default1stTime);
  const [targetTime2nd, setTargetTime2nd] = useState<number | string>(default2ndTime);
  const [chapterNo, setChapterNo] = useState<string>('36');

  useEffect(() => {
    const loadData = async () => {
        try {
            const material = await getMaterialById(materialId);
            
            // Load Words
            if (material.wordFile) {
                const text = await material.wordFile.text();
                const parsedCards = parsePdfWordCards(text, material.wordFile.name, material.wordFile.type);
                setWords(parsedCards);
            }

            // Load Quiz
            if (material.quizFile) {
                const text = await material.quizFile.text();
                const questions = JSON.parse(text) as QuizQuestion[];
                setQuizQuestions(questions);
            }
            
            setDataLoaded(true);
        } catch (e) {
            console.error("Failed to load auxiliary data", e);
            setDataLoaded(true);
        }
    };
    loadData();
  }, [materialId]);

  const cleanTextForCopy = (text: string) => {
    if (!text) return '';
    return text
        .replace(/__PERSONA_PROFILE__[\s\S]*?__END_PERSONA__/g, '')
        .replace(/__BACKGROUND_INFO__[\s\S]*?__END_BACKGROUND__/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[\[\]]/g, '')
        .trim();
  };

  // Helper to parse markdown bold text to beautiful textbook pink highlighting
  const parseMarkdownToReact = (text: string) => {
    if (!text) return null;
    const clean = text
        .replace(/__PERSONA_PROFILE__[\s\S]*?__END_PERSONA__/g, '')
        .replace(/__BACKGROUND_INFO__[\s\S]*?__END_BACKGROUND__/g, '')
        .replace(/[\[\]]/g, '');

    const parts = clean.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2);
            return (
                <span 
                    key={index} 
                    className="text-[#e11d48] font-bold bg-pink-100/70 border-b border-pink-300 px-1 rounded mx-0.5"
                    style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                >
                    {inner}
                </span>
            );
        }
        return part;
    });
  };

  const generateText = () => {
      let text = `${title}\n\n`;
      if (options.english || options.japanese || options.explanation) {
          transcript.forEach((entry, i) => {
              if (options.english) text += `${cleanTextForCopy(entry.english)}\n`;
              if (options.japanese && entry.japanese) text += `${cleanTextForCopy(entry.japanese)}\n`;
              if (options.explanation && entry.explanation) {
                  const cleanExpl = cleanTextForCopy(entry.explanation);
                  if (cleanExpl) text += `(解説: ${cleanExpl})\n`;
              }
              text += '\n';
          });
          text += '----------------------------------------\n\n';
      }
      if (options.wordList && words.length > 0) {
          text += '【単語リスト】\n\n';
          words.forEach((w, i) => {
              text += `${i + 1}. ${w.front}`;
              if (w.pronunciation) text += ` ${formatPdfPronunciation(w.pronunciation)}`;
              text += ` : ${w.back}\n`;
          });
           text += '\n----------------------------------------\n\n';
      }
      if (options.quiz && quizQuestions.length > 0) {
          text += '【クイズ】\n\n';
          quizQuestions.forEach((q, i) => {
              text += `Q${i + 1}. ${cleanTextForCopy(q.question)}\n`;
              q.choices.forEach((c, ci) => {
                  text += `   ${String.fromCharCode(65 + ci)}. ${cleanTextForCopy(c)}\n`;
              });
              text += '\n';
          });
          text += '\n【クイズ解答】\n';
          quizQuestions.forEach((q, i) => {
              const explanation = cleanTextForCopy(q.explanationCorrect || q.explanation || '');
              text += `Q${i + 1}: ${String.fromCharCode(65 + q.correctAnswerIndex)}\n`;
              if(explanation) text += `(解説: ${explanation})\n`;
          });
      }
      return text;
  }

  const handleCopyClick = () => {
      const text = generateText();
      navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => {
            setCopied(false);
          }, 1500);
      });
  };

  const handlePrintClick = () => {
      window.print();
  };

  // Generate Circle Numbers for Sentences like ①, ②, ③...
  const getCircleNo = (index: number) => {
      const circleChars = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑿', '㉑', '㉒', '㉓', '㉔', '㉕', '㉖', '㉗', '㉘', '㉙', '㉚'];
      return circleChars[index] || `[${index + 1}]`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      {/* Dynamic styles injected just for printing configuration */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
            body * {
                visibility: hidden !important;
            }
            #textbook-print-area, #textbook-print-area * {
                visibility: visible !important;
            }
            #textbook-print-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background-color: white !important;
                color: black !important;
                font-family: 'Noto Sans JP', 'Inter', sans-serif !important;
                font-size: 11pt !important;
                line-height: 1.7 !important;
            }
            @page {
                size: B5 landscape;
                margin: 12mm 15mm 12mm 15mm;
            }
            /* Prevent print breaking inside sections */
            .print-no-break {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            .border-custom-pink {
                border-color: #f43f5e !important;
            }
        }
      `}} />

      <div 
        className={`${T.containerBg} rounded-xl shadow-2xl max-w-5xl w-full border ${T.border} flex flex-col md:flex-row h-[90vh] md:h-[80vh] overflow-hidden animate-fade-in`} 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Left Side: Controller Options (1/3) */}
        <div className={`p-5 flex flex-col justify-between border-b md:border-b-0 md:border-r ${T.border} md:w-80 flex-shrink-0 bg-black/20`}>
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center justify-between">
              <h3 className={`text-lg font-bold ${T.textPrimary}`}>印刷・PDF出力設定</h3>
              <button onClick={onClose} className={`p-1.5 rounded-full ${T.button} hover:bg-white/10 text-gray-400`} title="閉じる">
                <CloseIcon />
              </button>
            </div>

            {/* Layout Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 block mb-1">レイアウト形式</label>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { id: 'sideBySide', label: '📖 左右対訳形式 (市販テキスト風)' },
                  { id: 'englishOnly', label: '🇬🇧 英語のみ (和訳非表示で暗記用)' },
                  { id: 'japaneseOnly', label: '🇯🇵 日本語のみ' }
                ].map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                        setLayout(l.id as any);
                        if (l.id === 'englishOnly') {
                            setOptions(o => ({...o, english: true, japanese: false}));
                        } else if (l.id === 'japaneseOnly') {
                            setOptions(o => ({...o, english: false, japanese: true}));
                        } else {
                            setOptions(o => ({...o, english: true, japanese: true}));
                        }
                    }}
                    className={`text-left px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      layout === l.id 
                        ? 'bg-sky-500/15 border-sky-400 text-sky-400 font-bold' 
                        : `border-white/5 ${T.button} text-gray-300 hover:bg-white/5`
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Print Items */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 block">出力項目</label>
              
              <div className="space-y-1.5">
                {layout === 'sideBySide' && (
                  <>
                    <label className={`flex items-center gap-2.5 p-2 rounded-md ${T.button} hover:bg-white/5 cursor-pointer text-xs`}>
                      <input 
                        type="checkbox" 
                        checked={options.english} 
                        onChange={e => setOptions({...options, english: e.target.checked})} 
                        className={`w-4 h-4 rounded text-sky-500 bg-gray-800 border-white/10`} 
                      />
                      <span className={T.textPrimary}>英文本文 (English Text)</span>
                    </label>

                    <label className={`flex items-center gap-2.5 p-2 rounded-md ${T.button} hover:bg-white/5 cursor-pointer text-xs`}>
                      <input 
                        type="checkbox" 
                        checked={options.japanese} 
                        onChange={e => setOptions({...options, japanese: e.target.checked})} 
                        className={`w-4 h-4 rounded text-sky-500 bg-gray-800 border-white/10`} 
                      />
                      <span className={T.textPrimary}>日本語訳 (Translation)</span>
                    </label>
                  </>
                )}

                <label className={`flex items-center gap-2.5 p-2 rounded-md ${T.button} hover:bg-white/5 cursor-pointer text-xs`}>
                  <input 
                    type="checkbox" 
                    checked={options.explanation} 
                    onChange={e => setOptions({...options, explanation: e.target.checked})} 
                    className={`w-4 h-4 rounded text-sky-500 bg-gray-800 border-white/10`} 
                  />
                  <span className={T.textPrimary}>文ごとの詳細解説 (Explanation)</span>
                </label>

                {hasWordFile && (
                  <label className={`flex items-center gap-2.5 p-2 rounded-md ${T.button} hover:bg-white/5 cursor-pointer text-xs`}>
                    <input 
                      type="checkbox" 
                      checked={options.wordList} 
                      onChange={e => setOptions({...options, wordList: e.target.checked})} 
                      className={`w-4 h-4 rounded text-sky-500 bg-gray-800 border-white/10`} 
                    />
                    <span className={T.textPrimary}>単語リスト「Check」({words.length}語)</span>
                  </label>
                )}

                {hasQuizFile && (
                  <label className={`flex items-center gap-2.5 p-2 rounded-md ${T.button} hover:bg-white/5 cursor-pointer text-xs`}>
                    <input 
                      type="checkbox" 
                      checked={options.quiz} 
                      onChange={e => setOptions({...options, quiz: e.target.checked})} 
                      className={`w-4 h-4 rounded text-sky-500 bg-gray-800 border-white/10`} 
                    />
                    <span className={T.textPrimary}>クイズ＆解答解説 ({quizQuestions.length}問)</span>
                  </label>
                )}
              </div>
            </div>

            {/* B5 Custom Headers (Study Goals) */}
            <div className="space-y-3 bg-white/5 p-3 rounded-lg border border-white/5">
              <label className="text-xs font-bold text-gray-300 block mb-1">📐 テキストヘッダー設定</label>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 block">Unit/No.</label>
                  <input 
                    type="text" 
                    value={chapterNo} 
                    onChange={e => setChapterNo(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white" 
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block font-mono">Word Count</label>
                  <div className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 font-bold">
                    {totalWordCount} w
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 block">1st目標 ( 秒)</label>
                  <input 
                    type="number" 
                    value={targetTime1st} 
                    onChange={e => setTargetTime1st(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white" 
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block">2nd目標 (秒)</label>
                  <input 
                    type="number" 
                    value={targetTime2nd} 
                    onChange={e => setTargetTime2nd(e.target.value)} 
                    className="w-full bg-black/30 border border-white/10 rounded px-2 py-1 text-xs text-white" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 mt-4 pt-4 border-t border-white/10">
            <button 
                onClick={handlePrintClick} 
                disabled={!dataLoaded}
                className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 active:scale-[0.98] text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
                <PrinterIcon />
                <span>B5横・PDF印刷 / 保存</span>
            </button>

            <button 
                onClick={handleCopyClick} 
                disabled={!dataLoaded}
                className={`w-full py-2 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5`}
            >
                <CopyIcon />
                <span>{copied ? 'コピーしました！' : 'テキストとして全コピー'}</span>
            </button>
          </div>
        </div>

        {/* Right Side: Print Preview (2/3) */}
        <div className="flex-grow p-4 md:p-6 bg-black/40 flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-gray-400">📄 印刷プレビュー面イメージ (B5 Landscape)</span>
            <span className="text-[10px] text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded font-bold">
              ※実際の印刷/PDF保存時に、B5用紙にフィットします
            </span>
          </div>

          <div className="flex-grow w-full overflow-auto rounded-lg border border-white/10 bg-gray-900/50 p-2 md:p-4">
            
            {/* The Actual B5 Landscape Layout Card */}
            <div 
              id="textbook-print-area" 
              className="w-[100%] min-w-[700px] bg-white text-black text-left rounded shadow-2xl p-8 border border-gray-200"
              style={{ minHeight: '500px', fontFamily: '"Noto Sans JP", sans-serif' }}
            >
              {/* Header Box */}
              <div className="flex justify-between items-end border-b-2 border-stone-800 pb-2 mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-stone-800 text-white font-bold text-xl px-3 py-1 flex items-center justify-center rounded">
                    {chapterNo}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-stone-900">{title}</h1>
                    <span className="text-xs text-gray-500 font-mono">({totalWordCount} words)</span>
                  </div>
                </div>

                <div className="text-[10px] sm:text-xs text-stone-700 font-medium flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span>チャレンジ!</span>
                    <span className="inline-block border border-stone-300 rounded px-1.5 py-0.5 bg-stone-50 font-bold">⏱️ 目標</span>
                  </div>
                  <div>
                    1st <span className="font-bold border-b border-stone-800 px-1 inline-block min-w-[30px] text-center">{targetTime1st || '___'}</span>秒 → <span className="text-xs text-gray-400">タイム ______ 秒</span>
                  </div>
                  <div>
                    2nd <span className="font-bold border-b border-stone-800 px-1 inline-block min-w-[30px] text-center">{targetTime2nd || '___'}</span>秒 → <span className="text-xs text-gray-400">タイム ______ 秒</span>
                  </div>
                </div>
              </div>

              {/* Main Bilingual Sentences Grid */}
              <div className="space-y-3">
                {transcript.map((entry, idx) => {
                  const circleNo = getCircleNo(idx);
                  return (
                    <div 
                      key={idx} 
                      className={`grid ${layout === 'sideBySide' ? 'grid-cols-2 gap-8' : 'grid-cols-1'} py-2.5 border-b border-stone-100 last:border-b-0 print-no-break align-top`}
                    >
                      {/* Left: English Column */}
                      {options.english && (
                        <div className="text-stone-900 leading-relaxed text-[13.5px] pr-2">
                          <span className="font-semibold text-rose-500 mr-2 inline-block shrink-0 select-none">{circleNo}</span>
                          <span className="font-serif italic text-[14.5px] font-medium inline">
                            {parseMarkdownToReact(entry.english)}
                          </span>
                        </div>
                      )}

                      {/* Right: Japanese Column */}
                      {layout === 'sideBySide' ? (
                        options.japanese ? (
                          <div className={`text-stone-700 leading-relaxed text-[12.5px] pl-3 border-l border-stone-200/40 line-clamp-none`}>
                            <span className="font-semibold text-rose-500 mr-2 inline-block shrink-0">{circleNo}</span>
                            <span className="inline">
                              {parseMarkdownToReact(entry.japanese || '')}
                            </span>
                          </div>
                        ) : (
                          <div className="border-l border-stone-200/40 pl-3 text-stone-300 italic text-[11px] flex items-center">
                            (復習用の和訳学習エリア)
                          </div>
                        )
                      ) : (
                        options.japanese && entry.japanese && (
                          <div className="text-stone-700 leading-relaxed text-[12.5px] mt-1 pl-4 border-l-2 border-stone-300">
                            <span className="font-semibold text-rose-500 mr-2">{circleNo}</span>
                            <span>{parseMarkdownToReact(entry.japanese)}</span>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Additional Pages / Break Elements for Wordlist and Quiz */}
              {((options.wordList && words.length > 0) || (options.quiz && quizQuestions.length > 0) || (options.explanation && transcript.some(t => t.explanation))) && (
                <div className="mt-8 pt-6 border-t-2 border-dashed border-stone-300 print-no-break">
                  
                  {/* Vocabulary Section (Check Box Checklist) */}
                  {options.wordList && words.length > 0 && (
                    <div className="mb-6 bg-stone-50 rounded-xl p-5 border border-stone-200 print-no-break">
                      <h4 className="text-sm font-bold text-stone-800 mb-3 border-custom-pink border-l-4 pl-2 flex items-center justify-between">
                        <span>Check & Review (重要単語チェック)</span>
                        <span className="text-[10px] font-mono text-stone-500">学習語彙: {words.length} 項目</span>
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs text-stone-700">
                        {words.map((w, wIdx) => (
                          <div key={w.id} className="flex items-start gap-1.5 py-0.5 truncate border-b border-stone-100 last:border-b-0">
                            <span className="text-stone-400 select-none">☐</span>
                            <span className="font-semibold text-stone-900 min-w-[50px]">{w.front}</span>
                            {w.pronunciation && <span className="text-[10px] text-stone-500 font-mono">{formatPdfPronunciation(w.pronunciation)}</span>}
                            <span className="text-stone-500 truncate ml-auto">{w.back}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detailed Explanations Column/Box */}
                  {options.explanation && transcript.some(t => t.explanation) && (
                    <div className="mb-6 bg-amber-50/40 rounded-xl p-5 border border-amber-200/50 print-no-break">
                      <h4 className="text-sm font-bold text-stone-800 mb-3 border-amber-500 border-l-4 pl-2">
                        💡 読解のポイント・文法解説
                      </h4>
                      <div className="space-y-3">
                        {transcript.map((t, idx) => {
                          if (!t.explanation) return null;
                          return (
                            <div key={idx} className="text-xs text-stone-700 leading-relaxed border-b border-stone-150/50 pb-2 last:border-0">
                              <span className="font-semibold text-amber-600 mr-1.5">{getCircleNo(idx)}</span>
                              <span className="font-serif italic font-medium inline mr-2 text-stone-900 border-b border-dashed border-stone-200">
                                {cleanTextForCopy(t.english)}
                              </span>
                              <p className="mt-1 pl-4 text-stone-600 font-sans">{cleanTextForCopy(t.explanation)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quiz Section */}
                  {options.quiz && quizQuestions.length > 0 && (
                    <div className="mb-6 bg-sky-50/40 rounded-xl p-5 border border-sky-200/50 print-no-break">
                      <h4 className="text-sm font-bold text-sky-900 mb-3 border-sky-400 border-l-4 pl-2">
                        📝 理解度確認クイズ
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-stone-800">
                        {quizQuestions.map((q, idx) => (
                          <div key={idx} className="space-y-1.5 p-2 bg-white rounded border border-stone-200/60">
                            <span className="font-bold text-sky-600">Q{idx + 1}. </span>
                            <span className="font-medium">{cleanTextForCopy(q.question)}</span>
                            <div className="pl-3 space-y-1 mt-1 text-stone-600">
                              {q.choices.map((c, cIdx) => (
                                <div key={cIdx} className="flex gap-2">
                                  <span>{String.fromCharCode(65 + cIdx)}.</span>
                                  <span>{cleanTextForCopy(c)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Quiz Answers block */}
                      <div className="mt-4 pt-3 border-t border-sky-200/30 text-stone-700 text-xs">
                        <span className="font-bold text-sky-800">【クイズ解答＆一言解説】</span>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-[11px]">
                          {quizQuestions.map((q, idx) => (
                            <div key={idx} className="flex gap-1">
                              <span className="font-bold">Q{idx + 1}: {String.fromCharCode(65 + q.correctAnswerIndex)}</span>
                              {(q.explanationCorrect || q.explanation) && (
                                <span className="text-stone-500 truncate">({cleanTextForCopy(q.explanationCorrect || q.explanation || '')})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PdfExportModal;
