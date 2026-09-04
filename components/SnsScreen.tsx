




import React, { useState, useCallback } from 'react';
import { SnsThreadData, SnsPost, BoardKeyword, Card, SnsAuthorInfo } from '../types';
import { Theme } from '../App';
import { getMaterialById } from '../lib/db';
import LightBulbIcon from './icons/LightBulbIcon';

interface SnsScreenProps {
  data: SnsThreadData;
  onBack: () => void;
  T: Theme;
  materialId: number;
  onUpdateMaterial: (id: number, data: { wordFile?: File | null }) => Promise<void>;
}

// Icons specific to X/SNS style
const XBackIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor"><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"></path></svg>;
const VerifiedIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-400 fill-current ml-1"><g><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .495.083.965.238 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"></path></g></svg>;
const ReplyIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><g><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.135 3.646 8.135 8.135v5.604c0 3.058-1.73 5.825-4.4 7.045L13.29 20H9.755c-4.42 0-8.004-3.584-8.004-8.005 0-.195.012-.39.037-.582l.025-.198C1.772 10.8 1.75 10.4 1.75 10zM14.12 4H9.755C6.44 4 3.745 6.694 3.745 10.005c0 2.17 1.16 4.063 2.912 5.095l.54.318.163 1.017c.16 1.004.65 1.9 1.38 2.565h4.55c2.21 0 4-1.79 4-4v-5.604c0-3.385-2.75-6.136-6.136-6.136z"></path></g></svg>;
const RepostIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><g><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></g></svg>;
const LikeIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><g><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>;
const ShareIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><g><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"></path></g></svg>;
const StatsIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><g><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"></path></g></svg>;
const BookmarkIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><g><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"></path></g></svg>;
const CalendarIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><g><path d="M7 4V3h2v1h6V3h2v1h1.5C19.89 4 21 5.12 21 6.5v12c0 1.38-1.11 2.5-2.5 2.5h-13C4.12 21 3 19.88 3 18.5v-12C3 5.12 4.12 4 5.5 4H7zm0 2H5.5c-.27 0-.5.22-.5.5v12c0 .28.23.5.5.5h13c.28 0 .5-.22.5-.5v-12c0-.28-.22-.5-.5-.5H17v1h-2V6H9v1H7V6zm0 6h2v-2H7v2zm0 4h2v-2H7v2zm4-4h2v-2h-2v2zm0 4h2v-2h-2v2zm4-4h2v-2h-2v2zm0 4h2v-2h-2v2z"></path></g></svg>;
const LinkIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><g><path d="M18.36 5.64c-1.95-1.96-5.11-1.96-7.07 0L9.88 7.05 8.46 5.64l1.42-1.42c2.73-2.73 7.16-2.73 9.9 0 2.73 2.74 2.73 7.17 0 9.9l-1.42 1.42-1.41-1.42 1.41-1.41c1.96-1.96 1.96-5.12 0-7.07zm-2.12 3.53l-7.07 7.07-1.41-1.41 7.07-7.07 1.41 1.41zm-12.02.71l1.42-1.42 1.41 1.42-1.41 1.41c-1.96 1.96-1.96 5.12 0 7.07 1.95 1.96 5.11 1.96 7.07 0l1.41-1.41 1.42 1.41-1.42 1.42c-2.73 2.73-7.16 2.73-9.9 0-2.73-2.74-2.73-7.17 0-9.9z"></path></g></svg>;
const LocationIcon: React.FC = () => <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><g><path d="M12 1.75c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69L12 22l2.31-2.56c3.85-1.02 6.69-4.52 6.69-8.69 0-4.97-4.03-9-9-9zm0 2c3.87 0 7 3.13 7 7 0 3.17-2.11 5.85-5 6.71V17h-4v.46c-2.89-.86-5-3.54-5-6.71 0-3.87 3.13-7 7-7zm0 5.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"></path></g></svg>;

// ----------------------------------------------------------------------
// Helper Component: Tooltip Text
// ----------------------------------------------------------------------
const TooltipText: React.FC<{ 
    text: string; 
    keywords?: BoardKeyword[];
    onKeywordClick?: (keyword: BoardKeyword, rect: DOMRect) => void; 
}> = ({ text, keywords, onKeywordClick }) => {
    if (!keywords || keywords.length === 0) return <span>{text}</span>;

    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
                                className="text-blue-400 underline decoration-dotted decoration-blue-400/50 cursor-pointer hover:text-blue-300 transition-colors font-bold"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onKeywordClick) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        onKeywordClick(match, rect);
                                    }
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
// Component: SNS Profile Card (New)
// ----------------------------------------------------------------------
const SnsProfileCard: React.FC<{ 
    post: SnsPost; 
    onSaveLine: (jp: string, en: string, postInfo: string) => void;
    savedLines: Set<string>;
}> = ({ post, onSaveLine, savedLines }) => {
    if (!post.author_info) return null;
    const info = post.author_info;
    
    const [openBioLines, setOpenBioLines] = useState<Set<number>>(new Set());

    const bioJpLines = info.bio.split('\n');
    const bioEnLines = info.bio_en ? info.bio_en.split('\n') : [];

    const toggleBioLine = (index: number) => {
        setOpenBioLines(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const handleBioLineCheck = (e: React.MouseEvent, index: number, jp: string, en: string) => {
        e.stopPropagation();
        const lineKey = `bio-${index}`;
        if (savedLines.has(lineKey)) return;
        onSaveLine(jp, en, `SNS Bio: ${post.author_name}`);
    };

    return (
        <div className="mb-4 border-b border-gray-800 pb-4">
            {/* Header Image */}
            <div className="h-32 bg-gradient-to-r from-slate-800 to-slate-700 w-full relative"></div>
            
            {/* Icon & Edit Button */}
            <div className="flex justify-between items-start px-4 -mt-10 mb-3">
                <div className="w-20 h-20 rounded-full border-4 border-black bg-gray-700 flex items-center justify-center text-4xl overflow-hidden relative z-10">
                    {post.avatar_emoji}
                </div>
                <button className="mt-12 px-4 py-1.5 rounded-full border border-gray-600 font-bold text-sm hover:bg-white/10 transition-colors text-white">
                    Follow
                </button>
            </div>

            {/* Name & Bio */}
            <div className="px-4 mb-3">
                <div className="flex flex-col mb-3">
                    <div className="flex items-center gap-1 text-xl font-bold text-white leading-tight">
                        {post.author_name}
                        {post.is_verified && <VerifiedIcon />}
                    </div>
                    <div className="text-gray-500 text-sm">{post.handle}</div>
                </div>
                
                {/* Bio Content (Line by Line) */}
                <div className="text-white text-[15px] mb-3 leading-relaxed">
                    {bioJpLines.map((line, i) => {
                        const lineKey = `bio-${i}`; // Simplified key for local usage
                        const isLineSaved = savedLines.has(lineKey) || savedLines.has(line); // Check against content or key logic (passed prop uses content for dedup usually, but here we need to be careful. Let's assume parent handles dedup logic, but UI state needs a unique key. Actually savedLines from parent is likely based on content. So we check if `line` is in it.)
                        
                        return (
                            <div key={i} className="w-full mb-1 flex items-start gap-2 group/line">
                                <div className="flex-grow">
                                    <div 
                                        className={`relative inline-block cursor-pointer px-1 -ml-1 rounded transition-colors hover:bg-white/10 ${openBioLines.has(i) ? 'bg-white/10' : ''}`}
                                        onClick={() => toggleBioLine(i)}
                                        title="クリックして英語を表示/非表示"
                                    >
                                        {line}
                                    </div>
                                    {openBioLines.has(i) && bioEnLines[i] && (
                                        <div className="mt-1 pl-3 border-l-2 border-[#1d9bf0] animate-slide-in-left bg-[#1d9bf0]/10 rounded-r p-1 text-gray-300 text-sm">
                                            {bioEnLines[i]}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {/* Meta Info */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-gray-500 text-sm mb-3">
                    {info.location && (
                        <div className="flex items-center gap-1">
                            <LocationIcon /> {info.location}
                        </div>
                    )}
                    {info.website && (
                        <div className="flex items-center gap-1">
                            <LinkIcon /> <span className="text-[#1d9bf0]">{info.website}</span>
                        </div>
                    )}
                    {info.born && (
                        <div className="flex items-center gap-1">
                            <span>🎈 Born {info.born}</span>
                        </div>
                    )}
                    {info.joined && (
                        <div className="flex items-center gap-1">
                            <CalendarIcon /> Joined {info.joined}
                        </div>
                    )}
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-sm">
                    <div className="hover:underline cursor-pointer">
                        <span className="font-bold text-white">{info.following}</span> <span className="text-gray-500">Following</span>
                    </div>
                    <div className="hover:underline cursor-pointer">
                        <span className="font-bold text-white">{info.followers}</span> <span className="text-gray-500">Followers</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ----------------------------------------------------------------------
// Component: SNS Post Item (Main or Reply)
// ----------------------------------------------------------------------
const SnsPostItem: React.FC<{ 
    post: SnsPost; 
    isMain?: boolean;
    onSaveKeywords: (keywords: BoardKeyword[]) => void;
    onSaveLine: (jp: string, en: string, postInfo: string) => void;
    isSaving: boolean;
    savedLines: Set<string>;
}> = ({ post, isMain = false, onSaveKeywords, onSaveLine, isSaving, savedLines }) => {
    const [openLines, setOpenLines] = useState<Set<number>>(new Set());
    const [showExplanation, setShowExplanation] = useState(false);
    const [showFullTranslate, setShowFullTranslate] = useState(false);
    const [activeKeywordPopup, setActiveKeywordPopup] = useState<{ 
        keyword: BoardKeyword, 
        position: { top: number, left: number, width: number } 
    } | null>(null);

    const jpLines = post.jp_content.split('\n');
    const enLines = post.en_content.split('\n');

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
        if (savedLines.has(jp)) return; // Simple check by content
        
        const postInfo = `SNS: ${post.handle} (${post.author_name})`;
        onSaveLine(jp, en, postInfo);
    };

    const handleKeywordClick = (keyword: BoardKeyword, rect: DOMRect) => {
        setActiveKeywordPopup({
            keyword,
            position: { top: rect.top, left: rect.left, width: rect.width }
        });
    };

    // Basic Text Styles
    const textSizeClass = isMain ? "text-[17px] leading-snug" : "text-[15px]";
    const containerClass = isMain ? "" : "flex gap-3 border-b border-gray-800 py-3 animate-fade-in px-4";

    const content = (
        <>
            {/* Profile Card for Main Post */}
            {isMain && post.author_info && <SnsProfileCard post={post} onSaveLine={onSaveLine} savedLines={savedLines} />}

            {/* Author Row (Only for Reply or if no profile card) */}
            {(!isMain || !post.author_info) && (
                <div className={isMain ? "flex gap-3 mb-3 px-4 pt-4" : "flex flex-col items-center flex-shrink-0"}>
                    <div className={`${isMain ? "w-12 h-12" : "w-10 h-10"} rounded-full bg-gray-700 flex items-center justify-center text-xl overflow-hidden`}>
                        {post.avatar_emoji}
                    </div>
                    {isMain && (
                        <div className="flex flex-col justify-center">
                            <div className="flex items-center gap-1 font-bold text-white">
                                {post.author_name}
                                {post.is_verified && <VerifiedIcon />}
                            </div>
                            <div className="text-gray-500 text-sm">{post.handle}</div>
                        </div>
                    )}
                    {isMain && <button className="ml-auto text-gray-500 text-xl font-bold hover:bg-gray-900 w-8 h-8 rounded-full flex items-center justify-center">···</button>}
                </div>
            )}
            
            <div className={!isMain ? "flex-grow min-w-0" : "px-4"}>
                {!isMain && (
                    <div className="flex items-center gap-1 text-[15px] mb-0.5">
                        <span className="font-bold text-white truncate">{post.author_name}</span>
                        {post.is_verified && <VerifiedIcon />}
                        <span className="text-gray-500 truncate ml-1">{post.handle}</span>
                        <span className="text-gray-500 mx-1">·</span>
                        <span className="text-gray-500">{post.timestamp}</span>
                    </div>
                )}

                {/* Body Content (Line by Line) */}
                <div className={`${textSizeClass} text-white whitespace-pre-wrap mb-3`}>
                    {jpLines.map((line, i) => {
                        if (!line.trim() && !enLines[i]) return <div key={i} className="h-2" />;
                        
                        const isLineSaved = savedLines.has(line);

                        return (
                            <div key={i} className="w-full mb-1 flex items-start gap-2 group/line">
                                 {/* Stealth Checkbox */}
                                 <button
                                    onClick={(e) => handleLineCheck(e, i, line, enLines[i] || '')}
                                    className={`mt-1 w-4 h-4 flex-shrink-0 rounded-full border flex items-center justify-center transition-all duration-200 cursor-pointer
                                        ${isLineSaved 
                                            ? 'bg-green-500 border-green-500 text-white opacity-100' 
                                            : 'border-gray-600 text-transparent bg-transparent opacity-10 group-hover/line:opacity-100 hover:border-blue-400'
                                        }`}
                                    title="この文をカードとして保存"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                                        {isLineSaved ? <polyline points="20 6 9 17 4 12" /> : <plus x1="12" y1="5" x2="12" y2="19" />}
                                        {!isLineSaved && <path d="M12 5v14M5 12h14" />}
                                    </svg>
                                </button>

                                <div className="flex-grow">
                                    <div 
                                        className={`relative inline-block cursor-pointer px-1 -ml-1 rounded transition-colors hover:bg-white/10 ${openLines.has(i) ? 'bg-white/10' : ''}`}
                                        onClick={() => toggleLine(i)}
                                    >
                                        {line}
                                    </div>
                                    {openLines.has(i) && (
                                        <div className="mt-1 pl-3 border-l-2 border-[#1d9bf0] animate-slide-in-left bg-[#1d9bf0]/10 rounded-r p-1 text-gray-300 text-sm">
                                            <TooltipText 
                                                text={enLines[i] || ''} 
                                                keywords={post.keywords} 
                                                onKeywordClick={handleKeywordClick}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Learning Features (Translate & Explanation) */}
                <div className="flex justify-between items-center mb-3">
                    <div className="flex gap-3 items-center">
                        <button 
                            onClick={() => setShowFullTranslate(!showFullTranslate)}
                            className="text-[#1d9bf0] text-sm hover:underline"
                        >
                            {showFullTranslate ? "Hide translation" : "Translate post"}
                        </button>
                    </div>
                    
                    <div className="flex gap-2 items-center">
                        {/* Save Words Button */}
                        {post.keywords && post.keywords.length > 0 && (
                            <button 
                                onClick={() => post.keywords && onSaveKeywords(post.keywords)}
                                disabled={isSaving}
                                className="text-xs border border-blue-500/30 text-blue-400 px-2 py-1 rounded-full hover:bg-blue-500/10 transition-colors"
                            >
                                + Save Words
                            </button>
                        )}
                        {/* Explanation Bulb */}
                        <button 
                            onClick={() => setShowExplanation(!showExplanation)}
                            className={`p-1.5 rounded-full transition-all ${showExplanation ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10'}`}
                            title="解説を表示"
                        >
                            <LightBulbIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Hidden Learning Content Area */}
                {(showFullTranslate || showExplanation) && (
                    <div className="bg-[#16181c] rounded-xl p-3 mb-3 border border-gray-800 animate-fade-in">
                        {showFullTranslate && (
                            <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-2 border-b border-gray-700 pb-2">
                                {post.en_content}
                            </div>
                        )}
                        {showExplanation && (
                            <div className="text-sm text-gray-400 leading-relaxed">
                                <span className="text-yellow-500 font-bold mr-2">💡 Learning Point:</span>
                                {post.explanation}
                            </div>
                        )}
                    </div>
                )}

                {/* Metadata & Actions (Only Main Post) */}
                {isMain && (
                    <>
                        <div className="text-gray-500 text-[15px] border-b border-gray-800 pb-3 mb-3">
                            {post.timestamp} · <span className="text-white font-bold">{post.stats?.views || "1M"}</span> Views
                        </div>
                        <div className="flex gap-6 border-b border-gray-800 pb-3 mb-3 text-sm">
                            <div className="text-gray-500"><span className="font-bold text-white">{post.stats?.reposts || "100"}</span> Reposts</div>
                            <div className="text-gray-500"><span className="font-bold text-white">{post.stats?.likes || "500"}</span> Likes</div>
                            <div className="text-gray-500"><span className="font-bold text-white">{post.stats?.replies || "20"}</span> Replies</div>
                        </div>
                    </>
                )}

                {/* Action Buttons */}
                <div className={`flex justify-between text-gray-500 ${isMain ? "border-b border-gray-800 pb-3 mb-3 px-2" : "max-w-md mb-2"}`}>
                    <button className="hover:text-[#1d9bf0] flex items-center gap-1 group transition-colors">
                        <div className={`p-2 group-hover:bg-[#1d9bf0]/10 rounded-full`}>{!isMain ? <div className="w-4 h-4"><ReplyIcon /></div> : <ReplyIcon />}</div>
                    </button>
                    <button className="hover:text-[#00ba7c] flex items-center gap-1 group transition-colors">
                        <div className={`p-2 group-hover:bg-[#00ba7c]/10 rounded-full`}>{!isMain ? <div className="w-4 h-4"><RepostIcon /></div> : <RepostIcon />}</div>
                    </button>
                    <button className="hover:text-[#f91880] flex items-center gap-1 group transition-colors">
                        <div className={`p-2 group-hover:bg-[#f91880]/10 rounded-full`}>{!isMain ? <div className="w-4 h-4"><LikeIcon /></div> : <LikeIcon />}</div>
                    </button>
                    <button className="hover:text-[#1d9bf0] flex items-center gap-1 group transition-colors">
                        <div className={`p-2 group-hover:bg-[#1d9bf0]/10 rounded-full`}>{!isMain ? <div className="w-4 h-4"><StatsIcon /></div> : <BookmarkIcon />}</div>
                    </button>
                    {isMain && <button className="hover:text-[#1d9bf0] transition-colors"><ShareIcon /></button>}
                </div>
            </div>

            {/* Popup for Keyword */}
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
                        <div className="absolute top-[-5px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 border-t border-l border-slate-600 transform rotate-45"></div>
                    </div>
                </>
            )}
        </>
    );

    return isMain ? <article className="animate-fade-in">{content}</article> : <div className={containerClass}>{content}</div>;
};

export const SnsScreen: React.FC<SnsScreenProps> = ({ data, onBack, T, materialId, onUpdateMaterial }) => {
    const [isSavingFile, setIsSavingFile] = useState(false);
    const [savedLines, setSavedLines] = useState<Set<string>>(new Set());
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2000);
    };

    const handleSaveLine = useCallback(async (jp: string, en: string, postInfo: string) => {
        if (!materialId) {
            alert("この機能を使用するには、まずライブラリに保存してください。");
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
                memo: postInfo
            };
            
            // Avoid duplicates
            if (existingCards.some(c => c.front === jp)) {
                showToast("既に保存済みです");
                setSavedLines(prev => new Set(prev).add(jp));
                return;
            }

            const updatedCards = [...existingCards, newCard];

            // 3. Save back
            const jsonString = JSON.stringify(updatedCards.map(c => ({
                word: c.front,
                meaning: c.back,
                memo: c.memo
            })), null, 2);
            
            const newFile = new File([jsonString], "words.json", { type: "application/json" });
            await onUpdateMaterial(materialId, { wordFile: newFile });
            
            setSavedLines(prev => new Set(prev).add(jp));
            showToast("文を保存しました！");

        } catch (e) {
            console.error("Failed to save line", e);
            showToast("保存に失敗しました");
        }
    }, [materialId, onUpdateMaterial]);

    const handleSaveKeywords = useCallback(async (keywords: BoardKeyword[]) => {
        if (!materialId) {
            alert("この機能を使用するには、まずライブラリに保存してください。");
            return;
        }
        setIsSavingFile(true);
        try {
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
            let nextId = existingCards.length > 0 ? Math.max(...existingCards.map(c => Number(c.id))) + 1 : 0;
            const newCards: Card[] = keywords.map(k => ({
                id: nextId++,
                front: k.word,
                back: k.meaning,
                memo: `SNS: ${data.main_post.jp_content.substring(0, 10)}...`
            }));
            
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
                alert(`${uniqueNewCards.length}単語を保存しました。`);
            } else {
                 alert("保存済みの単語です。");
            }
        } catch (e) {
            console.error("Failed to save words", e);
        } finally {
            setIsSavingFile(false);
        }
    }, [materialId, onUpdateMaterial, data.main_post.jp_content]);

    return (
        <div className="min-h-screen bg-black text-white font-sans flex flex-col relative">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-[#1d9bf0] text-white px-4 py-2 rounded-full shadow-lg animate-fade-in text-sm font-bold flex items-center gap-2">
                    <span>✓</span> {toastMessage}
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-30 flex items-center gap-6 p-3 bg-black/80 backdrop-blur-md border-b border-gray-800">
                <button onClick={onBack} className="p-2 hover:bg-gray-900 rounded-full transition-colors">
                    <XBackIcon />
                </button>
                <h1 className="font-bold text-xl">Post</h1>
            </header>

            <main className="flex-grow max-w-2xl mx-auto w-full pb-20">
                
                {/* Main Post */}
                <SnsPostItem 
                    post={data.main_post} 
                    isMain={true} 
                    onSaveKeywords={handleSaveKeywords} 
                    onSaveLine={handleSaveLine}
                    isSaving={isSavingFile} 
                    savedLines={savedLines}
                />

                {/* Reply Input Fake */}
                <div className="flex gap-3 items-center py-3 border-b border-gray-800 mb-0 px-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-orange-500"></div>
                    <div className="text-gray-500 text-lg">Post your reply</div>
                    <button className="ml-auto bg-[#1d9bf0] text-white font-bold px-4 py-1.5 rounded-full opacity-50 cursor-not-allowed">Reply</button>
                </div>

                {/* Replies List */}
                <div className="space-y-0">
                    {data.replies.map((reply, index) => (
                        <SnsPostItem 
                            key={index} 
                            post={reply} 
                            isMain={false} 
                            onSaveKeywords={handleSaveKeywords} 
                            onSaveLine={handleSaveLine}
                            isSaving={isSavingFile} 
                            savedLines={savedLines}
                        />
                    ))}
                </div>
            </main>
        </div>
    );
};