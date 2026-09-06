
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StoredMaterial, StoredFolder, TranscriptEntry, Word } from '../types';
import { Theme, Themes } from '../App';
import TrashIcon from './icons/TrashIcon';
import FolderIcon from './icons/FolderIcon';
import MusicIcon from './icons/MusicIcon';
import PlusIcon from './icons/PlusIcon';
import XMarkIcon from './icons/XMarkIcon';
import SettingsIcon from './icons/SettingsIcon';
import { getMaterialById } from '../lib/db';
import { prepareReadingMaterialImport } from '../lib/readingMaterialImport';

interface UploadScreenProps {
  onBack: () => void;
  onLoad: (data: {
    name: string;
    mediaFile?: File;
    textFile?: File;
    wordFile?: File;
    wordContent?: string;
    plainTextContent?: string;
    thumbnail?: string;
  }) => Promise<boolean>;
  error: string | null;
  onClearError?: () => void;
  storedMaterials: StoredMaterial[];
  storedFolders: StoredFolder[];
  onLoadFromDB: (id: number) => void;
  onDeleteFromDB: (id: number) => void;
  onUpdateMaterial: (id: number, data: { name?: string; thumbnail?: string, folderId?: number | null, bgmFile?: File | null, wordFile?: File | null, mediaFile?: File | null, textFile?: File | null, quizFile?: File | null, quizBookmarks?: number[] }) => Promise<void>;
  onAddFolder: (name: string) => void;
  onUpdateFolder: (id: number, name: string) => void;
  onDeleteFolder: (id: number) => void;
  onGoToDeckList: () => void;
  onStudy: (id: number) => void;
  onGame: (id: number) => void;
  onStartQuiz: (id: number) => void;
  onLoadBoard?: (data: any) => void; // New prop for board data
  T: Theme;
  setTheme: (themeName: string) => void;
  themes: Themes;
  dueCardCount?: number;
  onStartDailyReview?: () => void;
  initialOpenPasteJson?: boolean;
  onClearPasteJson?: () => void;
}

const EditableTitle: React.FC<{ initialTitle: string; onSave: (newTitle: string) => void; T: Theme, isFolder?: boolean }> = ({ initialTitle, onSave, T, isFolder=false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(initialTitle);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        setIsEditing(false);
        if (title.trim() && title !== initialTitle) {
            onSave(title);
        } else {
            setTitle(initialTitle);
        }
    };
    
    const titleClass = isFolder ? `text-lg font-semibold ${T.textPrimary}` : `text-lg font-bold ${T.textPrimary} line-clamp-1`;

    return isEditing ? (
        <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setTitle(initialTitle); setIsEditing(false); } }}
            className={`${titleClass} bg-transparent border-b-2 ${T.border} ${T.ring} outline-none w-full p-0 m-0`}
        />
    ) : (
        <div onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className={`${titleClass} cursor-pointer hover:opacity-70 transition-opacity`} title="タイトルを編集">
            {title}
        </div>
    );
};

const formatDuration = (seconds: number | undefined) => {
    if (seconds === undefined || isNaN(seconds)) return '?:??';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

// --- Daily Quest Banner ---
const DailyQuestBanner: React.FC<{ count: number; onStart: () => void; T: Theme }> = ({ count, onStart, T }) => {
    if (count <= 0) return null;

    return (
        <div className="w-full mb-8 animate-fade-in">
            <div className={`relative w-full rounded-2xl overflow-hidden shadow-2xl group cursor-pointer border border-yellow-500/30 bg-gradient-to-r from-orange-900/80 to-amber-900/80`} onClick={onStart}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20" />
                <div className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                             <span className="text-2xl">🔥</span>
                             <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-md">今日のクエスト</h2>
                        </div>
                        <p className="text-orange-100 text-sm md:text-base font-medium">
                            忘却曲線に基づき、今日復習すべきカードが <span className="text-xl md:text-2xl font-bold text-white">{count}</span> 枚あります。
                        </p>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onStart(); }}
                        className="px-6 py-2 md:px-8 md:py-3 text-sm md:text-base bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white font-bold rounded-full shadow-lg transform transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                    >
                        復習を開始する
                    </button>
                </div>
            </div>
        </div>
    );
};

const MaterialCard: React.FC<{
    material: StoredMaterial;
    isDeleteMode: boolean;
    storedFolders: StoredFolder[];
    onLoadFromDB: (id: number) => void;
    onDeleteFromDB: (id: number) => void;
    onUpdateMaterial: (id: number, data: any) => Promise<void>;
    setEditingMaterialId: (id: number | null) => void;
    thumbnailInputRef: React.RefObject<HTMLInputElement>;
    onStudy: (id: number) => void;
    onGame: (id: number) => void;
    onStartQuiz: (id: number) => void;
    T: Theme;
    onLoadBoard?: (data: any) => void;
}> = ({ material, isDeleteMode, storedFolders, onLoadFromDB, onDeleteFromDB, onUpdateMaterial, setEditingMaterialId, thumbnailInputRef, onStudy, onGame, onStartQuiz, T, onLoadBoard }) => {
    const [isAddingBgm, setIsAddingBgm] = useState(false);
    const [isAddingWordFile, setIsAddingWordFile] = useState(false);
    const [isAddingFile, setIsAddingFile] = useState(false);
    const [isEditingFolder, setIsEditingFolder] = useState(false);
    
    const [isPasting, setIsPasting] = useState(false);
    const [pasteContent, setPasteContent] = useState('');
    const [contentStats, setContentStats] = useState({ readingWords: 0, wordCards: 0, quizQuestions: 0 });

    useEffect(() => {
        let active = true;
        const countArray = (value: unknown) => Array.isArray(value) ? value.length : 0;
        const loadContentStats = async () => {
            try {
                const fullMaterial = await getMaterialById(material.id);
                let readingWords = 0;
                let wordCards = 0;
                let quizQuestions = 0;

                if (fullMaterial.textFile) {
                    const parsed = JSON.parse(await fullMaterial.textFile.text());
                    if (Array.isArray(parsed)) {
                        readingWords = parsed.reduce((total, entry) => {
                            const english = typeof entry?.english === 'string' ? entry.english.trim() : '';
                            return total + (english ? english.split(/\s+/).length : 0);
                        }, 0);
                    }
                }
                if (fullMaterial.wordFile) {
                    const parsed = JSON.parse(await fullMaterial.wordFile.text());
                    wordCards = countArray(parsed) || countArray(parsed?.cards) || countArray(parsed?.words);
                }
                if (fullMaterial.quizFile) {
                    const parsed = JSON.parse(await fullMaterial.quizFile.text());
                    quizQuestions = countArray(parsed) || countArray(parsed?.questions);
                }

                if (active) setContentStats({ readingWords, wordCards, quizQuestions });
            } catch {
                if (active) setContentStats({ readingWords: 0, wordCards: 0, quizQuestions: 0 });
            }
        };
        loadContentStats();
        return () => { active = false; };
    }, [material.id, material.hasTextFile, material.hasWordFile, material.hasQuizFile]);

    const folderName = material.folderId ? storedFolders.find(f => f.id === material.folderId)?.name : 'フォルダなし';

    const handleBgmFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onUpdateMaterial(material.id, { bgmFile: file });
        setIsAddingBgm(false);
        e.target.value = '';
    };
    const handleWordFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onUpdateMaterial(material.id, { wordFile: file });
        setIsAddingWordFile(false);
        e.target.value = '';
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const isAudioVideo = file.type.startsWith('audio/') || file.type.startsWith('video/') || /\.(mp3|m4a|mp4|mov|wav|ogg|flac)$/i.test(file.name);
            const isText = file.type === 'application/json' || file.type === 'text/plain' || /\.(json|txt)$/i.test(file.name);
            if (isAudioVideo) onUpdateMaterial(material.id, { mediaFile: file });
            else if (isText) onUpdateMaterial(material.id, { textFile: file });
            else onUpdateMaterial(material.id, { mediaFile: file });
        }
        setIsAddingFile(false);
        e.target.value = '';
    };
    
    const normalize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const handlePasteSave = async () => {
         if (!pasteContent.trim()) return;
        
        try {
            const cleanedContent = pasteContent.trim()
                .replace(/^```json\s*/, '')
                .replace(/^```\s*/, '')
                .replace(/\s*```$/, '');

            const parsedData = JSON.parse(cleanedContent);

            // Check if it is Board Data or Amazon Data
            if ((parsedData.posts || parsedData.mode === 'amazon') && onLoadBoard) {
                if (parsedData.posts || parsedData.product) {
                    const contentToSave = JSON.stringify(parsedData);
                    const fileName = parsedData.mode === 'amazon' ? 'amazon_data.json' : 'board_data.json';
                    const file = new File([new Blob([contentToSave], { type: 'application/json' })], fileName, { type: 'application/json' });
                    await onUpdateMaterial(material.id, { textFile: file });
                    setIsPasting(false);
                    setPasteContent('');
                    setIsAddingFile(false);
                    onLoadFromDB(material.id);
                    return;
                }
            }

            let finalEntries: TranscriptEntry[] = [];
            let flatTimestamps: Word[] | null = null;
            let sentenceEntries: TranscriptEntry[] | null = null;

            if (Array.isArray(parsedData)) {
                sentenceEntries = parsedData as TranscriptEntry[];
            } else if (parsedData.timestamps && Array.isArray(parsedData.timestamps)) {
                flatTimestamps = parsedData.timestamps as Word[];
            } else {
                 throw new Error("Invalid format: Expected array or object with 'timestamps', 'posts', or 'mode: amazon'");
            }
            
             if (flatTimestamps) {
                 if (!material.hasTextFile) {
                     alert("エラー: タイムスタンプを適用するためのテキストが見つかりません。先にテキストを追加してください。");
                     return;
                 }
                 const fullMaterial = await getMaterialById(material.id);
                 if (!fullMaterial.textFile) throw new Error("Text file missing");
                 
                 const text = await fullMaterial.textFile.text();
                 const existingEntries = JSON.parse(text) as TranscriptEntry[];
                 let tsIndex = 0;
                 finalEntries = existingEntries.map(entry => {
                     const targetClean = normalize(entry.english);
                     if (targetClean.length === 0) return { ...entry, words: [], start: 0, end: 0 };
                     let accumulatedClean = "";
                     const newWords: Word[] = [];
                     let start = Infinity;
                     let end = -Infinity;

                     while (flatTimestamps && tsIndex < flatTimestamps.length) {
                         const ts = flatTimestamps[tsIndex];
                         const tsWordClean = normalize(ts.word);
                         if (accumulatedClean.length + tsWordClean.length > targetClean.length) {
                             const overrun = (accumulatedClean.length + tsWordClean.length) - targetClean.length;
                             const underrun = targetClean.length - accumulatedClean.length;
                             if (underrun < overrun && newWords.length > 0) break;
                         }
                         accumulatedClean += tsWordClean;
                         newWords.push(ts);
                         if (ts.start < start) start = ts.start;
                         if (ts.end > end) end = ts.end;
                         tsIndex++;
                         if (accumulatedClean.length >= targetClean.length) break;
                     }
                     if (newWords.length === 0) return { ...entry, words: [], start: 0, end: 0 };
                     return { ...entry, start: start === Infinity ? 0 : start, end: end === -Infinity ? 0 : end, words: newWords };
                 });

            } else if (sentenceEntries) {
                  finalEntries = sentenceEntries; 
                  if (material.hasTextFile) {
                      try {
                        const fullMaterial = await getMaterialById(material.id);
                        if (fullMaterial.textFile) {
                            const text = await fullMaterial.textFile.text();
                            const existing = JSON.parse(text);
                            if (Array.isArray(existing)) {
                                finalEntries = sentenceEntries.map((ent, i) => {
                                    const ex = existing[i];
                                    if (ex) return { ...ent, japanese: ex.japanese || ent.japanese, explanation: ex.explanation || ent.explanation };
                                    return ent;
                                });
                                 if (existing.length > 0 && existing[0].explanation) {
                                    const existingExpl = existing[0].explanation;
                                    if (finalEntries.length > 0) {
                                        const newExpl = finalEntries[0].explanation || '';
                                        if (!newExpl.includes('__PERSONA_PROFILE__') && existingExpl.includes('__PERSONA_PROFILE__')) {
                                            const match = existingExpl.match(/(__PERSONA_PROFILE__[\s\S]*?__END_PERSONA__)/);
                                            if (match) finalEntries[0].explanation = match[1] + newExpl;
                                        }
                                        const bgMatch = existingExpl.match(/(__BACKGROUND_INFO__[\s\S]*?__END_BACKGROUND__)/);
                                        if (bgMatch) {
                                             if(!finalEntries[0].explanation?.includes('__BACKGROUND_INFO__')) finalEntries[0].explanation = (finalEntries[0].explanation || '') + bgMatch[1];
                                        }
                                    }
                                 }
                            }
                        }
                      } catch(e) { console.warn("Merge failed", e); }
                  }
            }
            const contentToSave = JSON.stringify(finalEntries);
            const file = new File([new Blob([contentToSave], { type: 'application/json' })], 'timestamp.json', { type: 'application/json' });
            await onUpdateMaterial(material.id, { textFile: file });
            setIsPasting(false);
            setPasteContent('');
            setIsAddingFile(false);
            onLoadFromDB(material.id);

        } catch (e) {
            console.error(e);
            alert("エラー: データの解析に失敗しました。\n" + (e instanceof Error ? e.message : ""));
        }
    };

    return (
        <>
            <article className={`memora-material-card ${T.containerBg} group relative flex flex-col rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl border ${T.border}`}>
                 <div 
                  className="relative aspect-video w-full cursor-pointer overflow-hidden bg-black/10"
                  onClick={() => { setEditingMaterialId(material.id); thumbnailInputRef.current?.click(); }}
                >
                    {material.thumbnail ? (
                        <img src={material.thumbnail} alt={material.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                    ) : (
                        <div className={`w-full h-full flex items-center justify-center ${T.panelBg}`}>
                            <svg className={`w-8 h-8 md:w-12 md:h-12 ${T.textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                    )}
                    {material.cardStats && (
                         <div className="absolute top-2 left-2">
                             <span className="bg-green-500/80 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm font-bold shadow-sm">
                                学習中: {Object.keys(material.cardStats).length}
                             </span>
                         </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-sm font-semibold px-3 py-1 bg-black/50 rounded-full backdrop-blur-sm">画像を変更</span>
                    </div>
                     <div className="absolute top-2 right-2 flex flex-col gap-1">
                        {material.duration && (
                            <span className="text-xs font-mono bg-black/60 text-white px-2 py-0.5 rounded-md backdrop-blur-sm">
                                {formatDuration(material.duration)}
                            </span>
                        )}
                    </div>
                    <div className="absolute bottom-2 left-2 flex gap-1">
                        {material.hasBgm && <span className={`p-1 rounded-full bg-black/50 text-white backdrop-blur-sm`} title="BGMあり"><MusicIcon className="w-3 h-3" /></span>}
                         {material.hasWordFile && !material.duration && <span className={`p-1 rounded-full bg-black/50 text-white backdrop-blur-sm`} title="単語帳"><svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h4a1 1 0 100-2H7zm0 4a1 1 0 100 2h4a1 1 0 100-2H7z" clipRule="evenodd" /></svg></span>}
                    </div>
                </div>

                <div className="flex flex-col flex-grow p-4">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex-grow min-w-0 mr-2">
                            <EditableTitle initialTitle={material.name} onSave={(newTitle) => onUpdateMaterial(material.id, { name: newTitle })} T={T} />
                             <div className="flex items-center mt-1">
                                {isEditingFolder ? (
                                    <select
                                        autoFocus
                                        value={material.folderId || ''}
                                        onChange={(e) => { onUpdateMaterial(material.id, { folderId: e.target.value ? Number(e.target.value) : null }); setIsEditingFolder(false); }}
                                        onBlur={() => setIsEditingFolder(false)}
                                        className={`w-full p-1 text-xs ${T.button} ${T.textSecondary} rounded-md border ${T.border}`}
                                    >
                                        <option value="">(フォルダなし)</option>
                                        {storedFolders.map(f => (<option key={f.id} value={f.id}>{f.name}</option>))}
                                    </select>
                                ) : (
                                    <div onClick={(e) => { e.stopPropagation(); !isDeleteMode && setIsEditingFolder(true); }} className={`flex items-center gap-1 text-xs ${T.textMuted} hover:text-sky-400 cursor-pointer transition-colors truncate`} title="フォルダを移動">
                                        <FolderIcon className="w-3 h-3" /><span>{folderName}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {isDeleteMode && <ConfirmDeleteButton itemType="file" onDelete={() => onDeleteFromDB(Number(material.id))} />}
                    </div>

                    <div className="memora-material-card__meta" aria-label="教材に含まれる学習内容">
                        {(material.hasTextFile || material.duration) && <span>読む{contentStats.readingWords > 0 ? `・約${contentStats.readingWords}語` : ''}</span>}
                        {material.hasWordFile && <span>単語{contentStats.wordCards > 0 ? contentStats.wordCards : ''}</span>}
                        {material.hasQuizFile && <span>クイズ{contentStats.quizQuestions > 0 ? contentStats.quizQuestions : ''}</span>}
                    </div>

                     {!isDeleteMode && (
                        <div className="flex items-center justify-end gap-2 mb-3">
                             {/* Dynamic Add Buttons */}
                             {isAddingFile ? (
                                <div className={`absolute inset-x-2 bottom-16 z-10 p-2 rounded-lg shadow-xl ${T.panelBg} border ${T.border} flex items-center justify-between gap-2 animate-fade-in`}>
                                     <label className="flex-grow text-xs text-center cursor-pointer hover:text-sky-400 p-1">
                                        ファイル
                                        <input type="file" accept="audio/*,video/*,.json,.txt" onChange={handleFileChange} className="hidden" />
                                    </label>
                                    <span className={`text-xs ${T.textMuted}`}>|</span>
                                     <button 
                                        onClick={(e) => { e.stopPropagation(); setIsPasting(true); }}
                                        className="flex-grow text-xs text-center hover:text-sky-400 p-1"
                                     >
                                        貼付
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setIsAddingFile(false); }} className={`text-xs p-1 rounded-full hover:bg-red-500 hover:text-white`}>✕</button>
                                </div>
                             ) : null}
                             
                             {isAddingWordFile && (
                                <div className={`absolute inset-x-2 bottom-16 z-10 p-2 rounded-lg shadow-xl ${T.panelBg} border ${T.border} flex items-center justify-between animate-fade-in`}>
                                    <label className="flex-grow text-xs text-center cursor-pointer hover:text-sky-400 p-1">
                                        単語ファイル
                                        <input type="file" accept=".json,.txt,text/plain,application/json" onChange={handleWordFileChange} className="hidden" />
                                    </label>
                                    <button onClick={(e) => { e.stopPropagation(); setIsAddingWordFile(false); }} className={`text-xs p-1 rounded-full hover:bg-red-500 hover:text-white`}>✕</button>
                                </div>
                             )}
                             
                             {isAddingBgm && (
                                <div className={`absolute inset-x-2 bottom-16 z-10 p-2 rounded-lg shadow-xl ${T.panelBg} border ${T.border} flex items-center justify-between animate-fade-in`}>
                                     <label className="flex-grow text-xs text-center cursor-pointer hover:text-sky-400 p-1">
                                        BGMファイル
                                        <input type="file" accept="audio/*" onChange={handleBgmFileChange} className="hidden" />
                                    </label>
                                    <button onClick={(e) => { e.stopPropagation(); setIsAddingBgm(false); }} className={`text-xs p-1 rounded-full hover:bg-red-500 hover:text-white`}>✕</button>
                                </div>
                             )}

                            <button onClick={(e) => {e.stopPropagation(); setIsAddingFile(!isAddingFile)}} className={`p-1.5 rounded-md ${T.button} text-xs text-opacity-70`} title="音源・テキスト追加">＋音源</button>
                            <button onClick={(e) => {e.stopPropagation(); setIsAddingWordFile(!isAddingWordFile)}} className={`p-1.5 rounded-md ${T.button} text-xs text-opacity-70`} title="単語追加">＋単語</button>
                            <button onClick={(e) => {e.stopPropagation(); setIsAddingBgm(!isAddingBgm)}} className={`p-1.5 rounded-md ${T.button} text-xs text-opacity-70`} title="BGM追加">＋BGM</button>
                        </div>
                    )}

                    <div className="mt-auto grid grid-cols-2 gap-2">
                         {(material.hasTextFile || material.duration) ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); onLoadFromDB(material.id); }}
                              className={`col-span-2 w-full py-2 ${T.accentBg} hover:brightness-110 text-white rounded-lg font-bold text-sm shadow-sm transition-all`}
                            >
                              読む
                            </button>
                        ) : (
                            <button disabled className={`col-span-2 w-full py-2 ${T.button} opacity-50 cursor-not-allowed rounded-lg text-xs`}>
                                テキスト/音声なし
                            </button>
                        )}
                        
                        {material.hasWordFile && (
                            <>
                                <button onClick={(e) => {e.stopPropagation(); onGame(material.id)}} className="py-1.5 bg-pink-600 hover:bg-pink-500 text-white rounded-md font-semibold text-xs transition-colors">4択ゲーム</button>
                                <button onClick={(e) => {e.stopPropagation(); onStudy(material.id)}} className="py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-md font-semibold text-xs transition-colors">単語</button>
                            </>
                        )}
                         {material.hasQuizFile && (
                             <button onClick={(e) => {e.stopPropagation(); onStartQuiz(material.id)}} className={`py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md font-semibold text-xs transition-colors ${!material.hasWordFile ? 'col-span-2' : ''}`}>
                                クイズ
                            </button>
                        )}
                    </div>
                </div>
            </article>
              {isPasting && (
                 <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setIsPasting(false); }}>
                    <div className={`${T.containerBg} p-6 rounded-lg shadow-xl max-w-lg w-full border ${T.border}`} onClick={e => e.stopPropagation()}>
                        <h3 className={`text-lg font-bold ${T.textPrimary} mb-4`}>データを貼り付け</h3>
                         <textarea
                            value={pasteContent}
                            onChange={(e) => setPasteContent(e.target.value)}
                            placeholder="JSONデータ、またはタイムスタンプデータをここに貼り付けてください..."
                            rows={10}
                            className={`w-full p-2 text-sm ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring} font-mono mb-4`}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                             <button onClick={() => setIsPasting(false)} className={`px-4 py-2 text-sm ${T.button} rounded-md`}>キャンセル</button>
                             <button onClick={handlePasteSave} className={`px-4 py-2 text-sm ${T.accentBg} hover:brightness-110 text-white rounded-md`}>保存</button>
                        </div>
                    </div>
                 </div>
            )}
        </>
    );
};

const HeroSection: React.FC<{ material: StoredMaterial; onLoad: (id: number) => void; T: Theme; }> = ({ material, onLoad, T }) => {
    return (
        <section className="memora-recent w-full mb-8 animate-fade-in" aria-labelledby="recent-material-heading">
            <h2 id="recent-material-heading" className="memora-section-title">最近ひらいた教材</h2>
            <div className={`relative w-full h-48 sm:h-64 rounded-2xl overflow-hidden shadow-2xl group cursor-pointer border ${T.border}`} onClick={() => onLoad(material.id)}>
                {material.thumbnail ? (
                    <>
                        <img src={material.thumbnail} alt={material.name} className="absolute inset-0 w-full h-full object-cover blur-sm opacity-50 scale-105 group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    </>
                ) : (
                    <div className={`absolute inset-0 ${T.accentBg} opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]`} />
                )}
                <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs font-bold tracking-wider rounded-full bg-white/20 text-white backdrop-blur-md`}>最近ひらいた教材</span>
                        <span className="text-white/70 text-sm">{new Date(material.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4 line-clamp-2 drop-shadow-md">{material.name}</h2>
                    <div className="flex items-center gap-4">
                        <button onClick={(e) => { e.stopPropagation(); onLoad(material.id); }} className={`flex items-center gap-2 px-6 py-3 ${T.accentBg} hover:brightness-110 text-white rounded-full font-bold shadow-lg transform transition-all hover:scale-105 active:scale-95`}>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><span>続きから読む</span>
                        </button>
                        {material.duration && <span className="text-white/80 font-mono text-sm bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">{formatDuration(material.duration)}</span>}
                    </div>
                </div>
                 {material.thumbnail && (
                    <div className="absolute right-8 bottom-8 w-32 aspect-video rounded-lg shadow-xl overflow-hidden border-2 border-white/20 hidden sm:block transform rotate-3 group-hover:rotate-0 transition-transform duration-500">
                         <img src={material.thumbnail} alt="" className="w-full h-full object-cover" />
                    </div>
                )}
            </div>
        </section>
    );
};

const ConfirmDeleteButton: React.FC<{ onDelete: () => void; itemType: 'file' | 'folder'; }> = ({ onDelete, itemType }) => {
    const [confirming, setConfirming] = useState(false);
    const timeoutRef = useRef<number | null>(null);
    const handleClick = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); if (confirming) onDelete(); else { setConfirming(true); timeoutRef.current = window.setTimeout(() => setConfirming(false), 3000); } };
    useEffect(() => () => { if(timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
    return <button type="button" onClick={handleClick} className={`relative z-50 p-2 rounded-full transition-all duration-200 flex items-center justify-center flex-shrink-0 cursor-pointer shadow-md ${confirming ? 'bg-red-600 text-white w-auto px-3' : 'bg-red-500 text-white w-8 h-8 hover:bg-red-600'}`} title={confirming ? "クリックして削除" : "削除"}>{confirming ? <span className="text-xs font-bold whitespace-nowrap">削除?</span> : <TrashIcon className="w-4 h-4 pointer-events-none" />}</button>;
};

const UploadScreen: React.FC<UploadScreenProps> = ({ onBack, onLoad, error, onClearError, storedMaterials, storedFolders, onLoadFromDB, onDeleteFromDB, onUpdateMaterial, onAddFolder, onUpdateFolder, onDeleteFolder, onGoToDeckList, onStudy, onGame, onStartQuiz, onLoadBoard, T, setTheme, themes, dueCardCount = 0, onStartDailyReview, initialOpenPasteJson, onClearPasteJson }) => {
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [textFile, setTextFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);
  const [materialName, setMaterialName] = useState('');
  const [wordContent, setWordContent] = useState('');
  const [plainTextContent, setPlainTextContent] = useState('');
  const [isPlainTextEditing, setIsPlainTextEditing] = useState(true);
  const [thumbnailFile, setThumbnailFile] = useState<string | undefined>(undefined);
  
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null); 
  const plainTextInputRef = useRef<HTMLTextAreaElement>(null);
  const addModalBackdropRef = useRef<HTMLDivElement>(null);
  const addModalRef = useRef<HTMLDivElement>(null);
  const addModalCloseButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const modalViewportBaselineRef = useRef(0);

  const [editingMaterialId, setEditingMaterialId] = useState<number | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isPersonalSettingsOpen, setIsPersonalSettingsOpen] = useState(false);
  const [inspirationSeed, setInspirationSeed] = useState('');
  const [angerSeed, setAngerSeed] = useState('');
  const [personalSettingsEnabled, setPersonalSettingsEnabled] = useState(true);

  useEffect(() => {
      setInspirationSeed(localStorage.getItem('inspiration_seed') || '');
      setAngerSeed(localStorage.getItem('anger_seed') || '');
      setPersonalSettingsEnabled(localStorage.getItem('use_personal_settings') !== 'false');
  }, []);
  
  const handleSavePersonalSettings = () => {
      localStorage.setItem('inspiration_seed', inspirationSeed);
      localStorage.setItem('anger_seed', angerSeed);
      localStorage.setItem('use_personal_settings', String(personalSettingsEnabled));
      setIsPersonalSettingsOpen(false);
  };

  const [newFolderName, setNewFolderName] = useState("");
  const settingsContainerRef = useRef<HTMLDivElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isTimestampPasteMode, setIsTimestampPasteMode] = useState(false);
  const [timestampPasteContent, setTimestampPasteContent] = useState('');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (settingsContainerRef.current && !settingsContainerRef.current.contains(event.target as Node)) {
            setIsSettingsOpen(false);
        }
    };
    if (isSettingsOpen) { document.addEventListener('mousedown', handleClickOutside); }
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, [isSettingsOpen]);
  
  useEffect(() => {
    if (initialOpenPasteJson) {
        setIsAddModalOpen(true);
        const isTouchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
        if (!isTouchDevice) {
            window.setTimeout(() => plainTextInputRef.current?.focus({ preventScroll: true }), 100);
        }
        onClearPasteJson?.();
    }
  }, [initialOpenPasteJson, onClearPasteJson]);

  useEffect(() => {
    if (!isAddModalOpen) return;

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add('memora-import-modal-open');
    modalViewportBaselineRef.current = Math.max(window.innerHeight, window.visualViewport?.height || 0);

    const syncVisualViewport = () => {
        const viewport = window.visualViewport;
        const backdrop = addModalBackdropRef.current;
        const modal = addModalRef.current;
        if (!backdrop) return;
        const top = Math.round(viewport?.offsetTop || 0);
        const left = Math.round(viewport?.offsetLeft || 0);
        const width = Math.round(viewport?.width || window.innerWidth);
        const height = Math.round(viewport?.height || window.innerHeight);
        modalViewportBaselineRef.current = Math.max(modalViewportBaselineRef.current, window.innerHeight, height);
        backdrop.style.setProperty('--memora-modal-viewport-top', `${top}px`);
        backdrop.style.setProperty('--memora-modal-viewport-left', `${left}px`);
        backdrop.style.setProperty('--memora-modal-viewport-width', `${width}px`);
        backdrop.style.setProperty('--memora-modal-viewport-height', `${height}px`);
        backdrop.style.setProperty('top', `${top}px`, 'important');
        backdrop.style.setProperty('left', `${left}px`, 'important');
        backdrop.style.setProperty('width', `${width}px`, 'important');
        backdrop.style.setProperty('height', `${height}px`, 'important');
        if (modal && width <= 640) {
            const mobileHeight = `${height}px`;
            modal.style.setProperty('height', mobileHeight, 'important');
            modal.style.setProperty('max-height', mobileHeight, 'important');
            const activeElement = document.activeElement;
            const hasTextFocus = activeElement instanceof HTMLInputElement
                || activeElement instanceof HTMLTextAreaElement
                || activeElement instanceof HTMLSelectElement;
            const keyboardOpen = hasTextFocus && height < modalViewportBaselineRef.current - 120;
            modal.classList.toggle('memora-modal--keyboard-open', keyboardOpen);
        }
    };

    const handleModalKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setIsAddModalOpen(false);
            return;
        }
        if (event.key !== 'Tab') return;

        const focusable: HTMLElement[] = addModalRef.current
            ? (Array.from(addModalRef.current.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )) as HTMLElement[]).filter(element => element.offsetParent !== null)
            : [];
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    syncVisualViewport();
    const viewportSyncTimer = window.setInterval(syncVisualViewport, 100);
    const focusTimer = window.setTimeout(() => addModalCloseButtonRef.current?.focus({ preventScroll: true }), 0);
    window.visualViewport?.addEventListener('resize', syncVisualViewport);
    window.visualViewport?.addEventListener('scroll', syncVisualViewport);
    window.addEventListener('resize', syncVisualViewport);
    document.addEventListener('keydown', handleModalKeyDown);

    return () => {
        window.clearTimeout(focusTimer);
        window.clearInterval(viewportSyncTimer);
        window.visualViewport?.removeEventListener('resize', syncVisualViewport);
        window.visualViewport?.removeEventListener('scroll', syncVisualViewport);
        window.removeEventListener('resize', syncVisualViewport);
        document.removeEventListener('keydown', handleModalKeyDown);
        document.body.classList.remove('memora-import-modal-open');
        previouslyFocusedElementRef.current?.focus({ preventScroll: true });
    };
  }, [isAddModalOpen]);

  useEffect(() => { if (isCreatingFolder) newFolderInputRef.current?.focus(); }, [isCreatingFolder]);

  const handleMediaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { setMediaFile(file); if (!materialName) setMaterialName(file.name.replace(/\.[^/.]+$/, "")); } };
  const handleTextFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { setTextFile(e.target.files?.[0] || null); };
  const handleWordFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { setWordFile(e.target.files?.[0] || null); if (e.target.files?.[0]) setWordContent(''); };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => setThumbnailFile(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleImagePaste = (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
          if (item.type.indexOf("image") !== -1) {
              const blob = item.getAsFile();
              if (blob) {
                  const reader = new FileReader();
                  reader.onload = () => setThumbnailFile(reader.result as string);
                  reader.readAsDataURL(blob);
              }
              e.preventDefault();
              return;
          }
      }
  };

  const clearPlainTextAlternatives = () => {
      setWordFile(null);
      setTextFile(null);
      setWordContent('');
  };

  const handlePlainTextPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData('text/plain');
      if (!pastedText) return;

      e.preventDefault();
      const textarea = e.currentTarget;
      const selectionStart = textarea.selectionStart ?? plainTextContent.length;
      const selectionEnd = textarea.selectionEnd ?? selectionStart;
      const nextValue = `${plainTextContent.slice(0, selectionStart)}${pastedText}${plainTextContent.slice(selectionEnd)}`;
      setPlainTextContent(nextValue);
      onClearError?.();
      clearPlainTextAlternatives();
      setIsPlainTextEditing(false);
      window.setTimeout(() => textarea.blur(), 0);
  };

  const beginPlainTextEditing = (clearFirst = false) => {
      onClearError?.();
      if (clearFirst) setPlainTextContent('');
      setIsPlainTextEditing(true);
      window.requestAnimationFrame(() => {
          const textarea = plainTextInputRef.current;
          if (!textarea) return;
          textarea.focus({ preventScroll: true });
          const caret = clearFirst ? 0 : textarea.value.length;
          textarea.setSelectionRange(caret, caret);
      });
  };


  const handleLoadClick = async () => {
    if (isImporting) return;
    if (isTimestampPasteMode && timestampPasteContent && onLoadBoard) {
    }

    let finalTextFile = textFile;
    let finalPlainText = plainTextContent;

    if (isTimestampPasteMode && timestampPasteContent) {
        finalPlainText = timestampPasteContent;
        const blob = new Blob([timestampPasteContent], { type: 'application/json' });
        finalTextFile = new File([blob], 'timestamp.json', { type: 'application/json' });
    }

    setIsImporting(true);
    try {
        const succeeded = await onLoad({
            name: materialName,
            mediaFile: mediaFile || undefined,
            textFile: finalTextFile || undefined,
            wordFile: wordFile || undefined,
            wordContent: wordContent || undefined,
            plainTextContent: finalPlainText || undefined,
            thumbnail: thumbnailFile
        });
        if (!succeeded) return;

        setIsAddModalOpen(false);
        setMediaFile(null);
        setTextFile(null);
        setWordFile(null);
        setMaterialName('');
        setWordContent('');
        setPlainTextContent('');
        setIsPlainTextEditing(true);
        setIsTimestampPasteMode(false);
        setTimestampPasteContent('');
        setThumbnailFile(undefined);
    } finally {
        setIsImporting(false);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>, materialId: number) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onUpdateMaterial(materialId, { thumbnail: reader.result as string });
      reader.readAsDataURL(file);
  };

  const handleCreateFolder = () => { if(newFolderName.trim()){ onAddFolder(newFolderName.trim()); setNewFolderName(""); setIsCreatingFolder(false); } };

  const rootMaterials = storedMaterials.filter(m => !m.folderId);
  const plainTextAnalysis = useMemo(() => {
      if (!plainTextContent.trim()) return null;
      try {
          const prepared = prepareReadingMaterialImport(plainTextContent);
          return {
              valid: true as const,
              sentenceCount: prepared.transcript.length,
              cardCount: prepared.cards.length,
              adjustments: prepared.repairs.length + prepared.warnings.length,
              message: '',
          };
      } catch (analysisError) {
          return {
              valid: false as const,
              sentenceCount: 0,
              cardCount: 0,
              adjustments: 0,
              message: analysisError instanceof Error ? analysisError.message : '教材データを確認できませんでした。',
          };
      }
  }, [plainTextContent]);
  const isLoadable = plainTextContent
      ? plainTextAnalysis?.valid === true
      : Boolean(mediaFile || textFile || wordFile || wordContent || timestampPasteContent);
  const latestMaterial = storedMaterials.length > 0 ? storedMaterials[0] : null;
  const isFirstRun = storedMaterials.length === 0 && storedFolders.length === 0;

  return (
    <div className="memora-library-screen flex-grow flex flex-col items-center justify-start p-4 pb-24 md:p-8 relative min-h-screen">
      <div className="w-full max-w-6xl">
        <header className="memora-app-header memora-app-header--read">
          <div className="memora-app-header__topline">
            <button type="button" onClick={onBack} className="memora-header-button memora-header-button--back" aria-label="教材作成画面に戻る">
              <span aria-hidden="true">←</span><span>教材作成</span>
            </button>
            <div className="memora-app-header__actions">
              <button type="button" onClick={() => setIsAddModalOpen(true)} className="memora-header-button memora-header-button--primary">教材を追加</button>
              <div className="relative" ref={settingsContainerRef}>
                <button type="button" onClick={() => isDeleteMode ? setIsDeleteMode(false) : setIsSettingsOpen(prev => !prev)} className={`memora-header-button memora-header-button--icon ${isDeleteMode ? 'is-active' : ''}`} aria-label={isDeleteMode ? '整理を完了' : 'ライブラリメニュー'}>
                  {isDeleteMode ? <span className="font-bold text-xs">完了</span> : <SettingsIcon className="h-5 w-5" />}
                </button>
                {isSettingsOpen && (
                  <div className="memora-header-menu">
                    <button type="button" onClick={() => { setIsSettingsOpen(false); onBack(); }}>教材をつくる</button>
                    <button type="button" onClick={() => { setIsSettingsOpen(false); onGoToDeckList(); }}>単語デッキ</button>
                    <button type="button" onClick={() => { setIsSettingsOpen(false); setIsCreatingFolder(true); }}>新しいフォルダ</button>
                    <button type="button" onClick={() => { setIsSettingsOpen(false); setIsPersonalSettingsOpen(true); }}>パーソナル設定</button>
                    <div className="memora-header-menu__theme">
                      <label htmlFor="theme-select">表示テーマ</label>
                      <select id="theme-select" value={Object.keys(themes).find(key => themes[key as keyof Themes]?.name === T.name)} onChange={(e) => setTheme(e.target.value)}>
                        {Object.entries(themes).map(([key, theme]) => (<option key={key} value={key}>{(theme as Theme).name}</option>))}
                      </select>
                    </div>
                    <button type="button" className="memora-header-menu__danger" onClick={() => { setIsDeleteMode(true); setIsSettingsOpen(false); }}>整理・削除</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="memora-app-header__body">
            <div className="memora-app-header__copy">
              <p className="memora-app-header__role">READ</p>
              <h1>教材ライブラリ</h1>
              <p>つくった教材を、いつでもここから。</p>
            </div>
            {!isFirstRun && (
              <img src="/memora-world/read-v1.webp" alt="" aria-hidden="true" draggable={false} className="memora-app-header__character" />
            )}
          </div>
        </header>
        
        {error && !isAddModalOpen && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm mb-6 animate-fade-in">{error}</div>}
        
        {!isDeleteMode && dueCardCount > 0 && onStartDailyReview && (
            <DailyQuestBanner count={dueCardCount} onStart={onStartDailyReview} T={T} />
        )}

        {isCreatingFolder && (
            <div className={`p-4 rounded-xl ${T.containerBg} border ${T.border} mb-8 flex items-center gap-4 animate-fade-in shadow-lg`}>
                <FolderIcon className={`h-6 w-6 ${T.textMuted}`} />
                <input ref={newFolderInputRef} type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); if(e.key === 'Escape') setIsCreatingFolder(false); }} placeholder="新しいフォルダ名" className={`flex-grow ${T.textPrimary} bg-transparent border-b-2 ${T.border} ${T.ring} outline-none py-1`}/>
                <button onClick={handleCreateFolder} className={`px-4 py-2 text-sm ${T.accentBg} hover:brightness-110 text-white rounded-lg font-bold`}>作成</button>
                <button onClick={() => setIsCreatingFolder(false)} className={`px-4 py-2 text-sm ${T.button} rounded-lg`}>キャンセル</button>
            </div>
        )}

        {latestMaterial && !isDeleteMode && dueCardCount === 0 && (
            <HeroSection material={latestMaterial} onLoad={onLoadFromDB} T={T} />
        )}

        {storedMaterials.length > 0 || storedFolders.length > 0 ? (
          <div className="space-y-12">
            {storedFolders.map(folder => {
              const materialsInFolder = storedMaterials.filter(m => m.folderId === folder.id);
              return (
                <div key={folder.id} className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2 border-white/10">
                        <div className="flex items-center gap-3">
                            <FolderIcon className={`h-5 w-5 md:h-6 md:w-6 ${T.textMuted}`} />
                            <EditableTitle initialTitle={folder.name} onSave={(newName) => onUpdateFolder(folder.id, newName)} T={T} isFolder />
                            <span className={`text-xs px-2 py-1 rounded-full ${T.button} ${T.textMuted}`}>{materialsInFolder.length}</span>
                        </div>
                         {isDeleteMode && <ConfirmDeleteButton itemType="folder" onDelete={() => onDeleteFolder(folder.id)} />}
                    </div>
                    {materialsInFolder.length > 0 ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {materialsInFolder.map(material => (
                                <MaterialCard {...{material, isDeleteMode, storedFolders, onLoadFromDB, onDeleteFromDB, onUpdateMaterial, setEditingMaterialId, thumbnailInputRef, onStudy, onGame, onStartQuiz, T, onLoadBoard}} key={material.id}/>
                            ))}
                         </div>
                    ) : (
                        <p className={`text-sm ${T.textMuted} italic ml-9`}>このフォルダは空です。</p>
                    )}
                </div>
              )
            })}
            {rootMaterials.length > 0 && (
                <div className="space-y-4">
                     <div className="flex items-center gap-3 border-b pb-2 border-white/10">
                        <span className={`memora-section-title text-base md:text-lg font-semibold ${T.textPrimary}`}>すべての教材</span>
                     </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rootMaterials.map(material => (
                            <MaterialCard {...{material, isDeleteMode, storedFolders, onLoadFromDB, onDeleteFromDB, onUpdateMaterial, setEditingMaterialId, thumbnailInputRef, onStudy, onGame, onStartQuiz, T, onLoadBoard}} key={material.id}/>
                        ))}
                    </div>
                </div>
            )}
            <input type="file" ref={thumbnailInputRef} accept="image/*" onChange={(e) => editingMaterialId && handleThumbnailChange(e, editingMaterialId)} className="hidden"/>
          </div>
        ) : (
          <section aria-label="教材がないときの案内" className="memora-empty-state">
            <img src="/memora-world/read-v1.webp" alt="" aria-hidden="true" draggable={false} />
            <p className="memora-empty-state__role">READ</p>
            <h2>まだ教材がありません</h2>
            <p>好きなテーマから、自分だけの英語教材をつくれます。</p>
            <div className="memora-empty-state__actions">
              <button type="button" onClick={onBack} className="memora-button memora-button--primary">教材をつくる</button>
              <button type="button" onClick={() => setIsAddModalOpen(true)} className="memora-button memora-button--secondary">できた教材を取り込む</button>
            </div>
          </section>
        )}
      </div>

      {!isFirstRun && (
        <button onClick={() => setIsAddModalOpen(true)} className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl ${T.accentBg} text-white flex items-center justify-center hover:scale-110 transition-transform z-30 group`} title="新規追加">
          <PlusIcon className="w-6 h-6 md:w-8 md:h-8 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}
      
      {isAddModalOpen && (
        <div ref={addModalBackdropRef} className="memora-modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isImporting && setIsAddModalOpen(false)}>
            <div ref={addModalRef} role="dialog" aria-modal="true" aria-labelledby="add-material-title" tabIndex={-1} className={`memora-modal ${T.containerBg} w-full max-w-2xl rounded-2xl shadow-2xl border ${T.border} overflow-hidden animate-fade-in flex flex-col max-h-[90vh]`} onClick={e => e.stopPropagation()}>
                <div className={`memora-modal__header flex items-center justify-between p-6 border-b ${T.border}`}>
                    <div>
                      <p className="memora-modal__eyebrow">ORGANIZE</p>
                      <h2 id="add-material-title" className={`text-2xl font-bold ${T.textPrimary}`}>新しい教材を追加</h2>
                    </div>
                    <button ref={addModalCloseButtonRef} type="button" aria-label="教材の追加を閉じる" disabled={isImporting} onClick={() => setIsAddModalOpen(false)} className={`p-2 rounded-full ${T.button} hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50`}><XMarkIcon /></button>
                </div>
                <div className="memora-modal__body flex-1 min-h-0 p-6 overflow-y-auto space-y-8">
                     {error && <div role="alert" className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm">{error}</div>}
                    <div>
                        <label htmlFor={plainTextContent && !isPlainTextEditing ? 'add-material-data-preview' : 'add-material-data'} className={`memora-field-label ${T.textMuted}`}>1. 教材データ</label>
                        <p className="memora-field-help">AI Studioで作った結果を貼り付けます。</p>
                        {plainTextContent && !isPlainTextEditing ? (
                            <div id="add-material-data-preview" data-testid="material-paste-preview" data-character-count={plainTextContent.length} tabIndex={0} aria-live="polite" className={`memora-import-preview ${T.button} ${T.textSecondary} border ${T.border}`}>
                                <div className={`memora-import-preview__status ${plainTextAnalysis?.valid === false ? 'memora-import-preview__status--invalid' : ''}`}>
                                    <strong>{plainTextAnalysis?.valid === false ? '教材データを確認してください' : '教材データを認識しました'}</strong>
                                    <span>
                                      {plainTextAnalysis?.valid
                                        ? `${plainTextAnalysis.sentenceCount}文・${plainTextAnalysis.cardCount}枚`
                                        : `${plainTextContent.length.toLocaleString('ja-JP')}文字`}
                                    </span>
                                </div>
                                {plainTextAnalysis?.valid === false && <p role="alert" className="memora-import-preview__error">{plainTextAnalysis.message}</p>}
                                {plainTextAnalysis?.valid && plainTextAnalysis.adjustments > 0 && <p className="memora-import-preview__notice">小さな表記ゆれを {plainTextAnalysis.adjustments} 件、自動で補正して取り込みます。</p>}
                                <pre>{plainTextContent}</pre>
                                <div className="memora-import-preview__actions">
                                    <button type="button" onClick={() => beginPlainTextEditing(false)}>内容を編集</button>
                                    <button type="button" onClick={() => beginPlainTextEditing(true)}>貼り直す</button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <textarea id="add-material-data" ref={plainTextInputRef} value={plainTextContent} onPaste={handlePlainTextPaste} onBlur={() => { if (plainTextContent.trim()) setIsPlainTextEditing(false); }} onChange={(e) => { setPlainTextContent(e.target.value); onClearError?.(); if (e.target.value) clearPlainTextAlternatives(); }} placeholder="AI Studioで作った教材データをここに貼り付けてください" rows={6} className={`memora-import-textarea w-full p-3 text-sm ${T.button} ${T.textSecondary} rounded-xl border ${T.border} focus:outline-none focus:ring-2 ${T.ring} font-mono resize-none`}/>
                                {plainTextContent && <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setIsPlainTextEditing(false)} className="memora-import-edit-done">編集を完了</button>}
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="add-material-name" className={`memora-field-label ${T.textMuted}`}>教材名 <small>（任意・空欄なら英文から自動作成）</small></label>
                        <input id="add-material-name" type="text" value={materialName} onChange={(e) => setMaterialName(e.target.value)} placeholder="例：Japan’s Ramen Culture" className={`w-full p-3 ${T.button} ${T.textPrimary} rounded-xl border ${T.border} focus:outline-none focus:ring-2 ${T.ring} text-lg`}/>
                    </div>

                    <div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className={`memora-field-label ${T.textMuted}`}>2. 音声 <small>（任意）</small></label>
                              <button type="button" onClick={() => mediaInputRef.current?.click()} className={`memora-file-picker group relative flex w-full flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed ${T.border} hover:border-sky-500 hover:bg-sky-500/10 transition-all`}>
                                  <div className={`mb-2 p-3 rounded-full ${T.button} group-hover:bg-sky-500 group-hover:text-white transition-colors`}><MusicIcon className="w-6 h-6" /></div>
                                  <span className={`font-semibold ${T.textPrimary}`}>音声・動画を選ぶ</span>
                                  <span className={`text-xs ${T.textMuted} mt-1 text-center max-w-full truncate px-2`}>{mediaFile?.name || 'ファイル未選択'}</span>
                                  <input type="file" ref={mediaInputRef} accept="audio/*,video/*,.mp3,.m4a,.mp4,.mov,.wav,.ogg,.flac" onChange={handleMediaFileChange} className="hidden"/>
                              </button>
                            </div>
                            <div>
                              <label className={`memora-field-label ${T.textMuted}`}>3. タイムスタンプ <small>（任意）</small></label>
                              {isTimestampPasteMode ? (
                                  <div className={`memora-file-picker relative flex flex-col p-0 rounded-xl border-2 ${T.border} overflow-hidden`}>
                                      <textarea aria-label="タイムスタンプのデータ" autoFocus value={timestampPasteContent} onChange={(e) => setTimestampPasteContent(e.target.value)} placeholder="タイムスタンプのデータを貼り付け" className={`w-full h-full p-3 text-xs ${T.button} ${T.textSecondary} resize-none focus:outline-none`} style={{ minHeight: '120px' }}/>
                                      <button type="button" aria-label="タイムスタンプの貼り付けをやめる" onClick={() => { setIsTimestampPasteMode(false); setTimestampPasteContent(''); }} className={`absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-red-500`}><XMarkIcon className="w-4 h-4"/></button>
                                  </div>
                              ) : (
                                  <div className={`memora-file-picker group relative flex w-full flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed ${T.border} hover:border-sky-500 hover:bg-sky-500/10 transition-all`}>
                                      <button type="button" onClick={() => textInputRef.current?.click()} className="flex w-full flex-col items-center justify-center">
                                      <span className={`font-semibold ${T.textPrimary}`}>タイムスタンプを選ぶ</span>
                                      <span className={`text-xs ${T.textMuted} mt-1 text-center max-w-full truncate px-2`}>{textFile?.name || 'ファイル未選択'}</span>
                                      </button>
                                      <input type="file" ref={textInputRef} accept=".txt,.json,text/plain,application/json" onChange={handleTextFileChange} className="hidden"/>
                                      <button type="button" onClick={() => { setIsTimestampPasteMode(true); setTextFile(null); }} className="mt-2 text-xs text-sky-400 hover:underline z-10">データを直接貼り付ける</button>
                                  </div>
                              )}
                            </div>
                         </div>
                    </div>
                     
                     <div>
                        <label className={`memora-field-label ${T.textMuted}`}>4. 単語カード <small>（任意・JSON形式）</small></label>
                        <div className="flex gap-2 mb-2">
                            <button type="button" onClick={() => wordInputRef.current?.click()} className={`px-4 py-2 ${T.button} rounded-lg text-xs font-bold`}>ファイル選択</button>
                            <span className={`flex items-center text-xs ${T.textMuted}`}>{wordFile?.name}</span>
                            <input type="file" ref={wordInputRef} accept=".json,.txt,text/plain,application/json" onChange={handleWordFileChange} className="hidden"/>
                        </div>
                            <textarea aria-label="単語カードのデータ" value={wordContent} onChange={(e) => { setWordContent(e.target.value); if (e.target.value) { setWordFile(null); setPlainTextContent(''); setIsPlainTextEditing(true); } }} placeholder="単語カードのデータを直接貼り付けることもできます" rows={3} className={`w-full p-3 text-sm ${T.button} ${T.textSecondary} rounded-xl border ${T.border} focus:outline-none focus:ring-2 ${T.ring} font-mono`}/>
                    </div>

                    <div onPaste={handleImagePaste}>
                        <label className={`memora-field-label ${T.textMuted}`}>5. 表紙画像 <small>（任意）</small></label>
                        <div className={`w-full border-2 border-dashed ${T.border} rounded-xl p-6 flex flex-col items-center justify-center transition-colors hover:bg-white/5 relative`}>
                            {thumbnailFile ? (
                                <div className="relative w-full aspect-video flex items-center justify-center overflow-hidden rounded-lg">
                                    <img src={thumbnailFile} alt="Preview" className="max-w-full max-h-48 object-contain" />
                                    <button type="button" aria-label="表紙画像を削除" onClick={() => setThumbnailFile(undefined)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-md"><XMarkIcon className="w-4 h-4"/></button>
                                </div>
                            ) : (
                                <button type="button" className="w-full text-center" onClick={() => imageInputRef.current?.click()}>
                                    <PlusIcon className="mx-auto mb-2 h-7 w-7 opacity-60" />
                                    <p className={`text-sm font-bold ${T.textPrimary} mb-1`}>クリックして画像を選択</p>
                                    <p className={`text-xs ${T.textMuted}`}>または Ctrl+V で画像を貼り付け</p>
                                </button>
                            )}
                            <input type="file" ref={imageInputRef} accept="image/*" onChange={handleImageFileChange} className="hidden" />
                        </div>
                    </div>

                </div>
                <div className={`memora-modal__footer p-6 border-t ${T.border} bg-black/10`}>
                    <button type="button" onClick={handleLoadClick} disabled={isImporting || !isLoadable} className="memora-button memora-button--primary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all active:scale-[0.99] shadow-lg">{isImporting ? '取り込み中…' : '教材として取り込む'}</button>
                </div>
            </div>
        </div>
      )}
      {isPersonalSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsPersonalSettingsOpen(false)}>
            <div className={`${T.containerBg} w-full max-w-xl rounded-2xl shadow-2xl border ${T.border} overflow-hidden animate-fade-in flex flex-col max-h-[90vh]`} onClick={e => e.stopPropagation()}>
                <div className={`flex items-center justify-between p-6 border-b ${T.border}`}>
                    <h2 className={`text-2xl font-bold ${T.textPrimary} flex items-center gap-2`}><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>パーソナル設定</h2>
                    <button onClick={() => setIsPersonalSettingsOpen(false)} className={`p-2 rounded-full ${T.button} hover:bg-red-500 hover:text-white transition-colors`}><XMarkIcon className="w-5 h-5"/></button>
                </div>
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* 長文への反映オン・オフ切り替え */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                        <span className={`text-sm font-bold ${T.textPrimary}`}>好きなこと・嫌いなことを長文に反映する</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={personalSettingsEnabled} 
                                onChange={(e) => setPersonalSettingsEnabled(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>

                     <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <label className={`text-sm font-bold flex items-center gap-2 ${T.textPrimary} mb-2`}>
                            <span>🖋️ ひらめきの種</span>
                        </label>
                        <p className={`text-xs ${T.textMuted} mb-3`}>暗記を「自分事」に変えるためのパーソナル設定。好きなものや最近の出来事を入力するだけで、AIが生成する例文の解像度がマニアックに向上します。</p>
                        <textarea value={inspirationSeed} onChange={(e) => setInspirationSeed(e.target.value)} placeholder="好きなもの、近況、趣味など...AIが生成する例文の「隠し味」になります。" rows={3} className={`w-full p-3 text-sm ${T.button} ${T.textSecondary} rounded-xl border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}/>
                    </div>
                    
                    <div className="bg-red-900/10 p-4 rounded-xl border border-red-500/20">
                        <label className={`text-sm font-bold flex items-center gap-2 text-red-400 mb-2`}>
                            <span>🔥 怒りの種</span>
                        </label>
                        <p className={`text-xs ${T.textMuted} mb-3`}>感情の負エネルギーを暗記のブーストに変換します。許せないものを指定すると、AIが最高に性格の悪い皮肉屋となり、脳を揺さぶる例文を生成します。</p>
                        <textarea value={angerSeed} onChange={(e) => setAngerSeed(e.target.value)} placeholder="絶対に許せないこと、嫌いなもの、親の仇など...AIの「毒舌スイッチ」が入ります。" rows={3} className={`w-full p-3 text-sm ${T.button} ${T.textSecondary} rounded-xl border border-red-500/30 focus:outline-none focus:ring-2 ring-red-500`}/>
                    </div>
                </div>
                <div className={`p-4 border-t ${T.border} flex justify-end bg-black/20`}>
                     <button onClick={handleSavePersonalSettings} className={`px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl shadow-lg transition-all`}>登録完了！</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UploadScreen;
