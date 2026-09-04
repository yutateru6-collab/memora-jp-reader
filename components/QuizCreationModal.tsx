
import React, { useState, useCallback } from 'react';
import { Theme } from '../App';
import { TranscriptEntry, QuizQuestion } from '../types';

interface QuizCreationModalProps {
    T: Theme;
    transcript: TranscriptEntry[];
    personaProfile: string | null;
    onClose: () => void;
    onSave: (file: File) => Promise<void>;
    isAdding?: boolean;
}

type QuizType = 'grammar' | 'content';

const stripQuizCodeFences = (content: string) => content
    .trim()
    .replace(/^```(?:json|text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

export const parseQuizContent = (content: string): QuizQuestion[] => {
    const cleaned = stripQuizCodeFences(content);
    let parsed: unknown;

    try {
        parsed = JSON.parse(cleaned);
    } catch (e) {
        throw new Error('無効なJSON形式です。AI StudioのJSONコードブロック全体をそのまま貼り付けても保存できます。');
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('JSONが配列形式ではありません、または問題が空です。');
    }

    parsed.forEach((item, index) => {
        const question = item as Partial<QuizQuestion>;
        if (typeof question.question !== 'string' || !question.question.trim()) {
            throw new Error(`問題${index + 1}の question が正しくありません。`);
        }
        if (!Array.isArray(question.choices) || question.choices.length !== 4 || question.choices.some(choice => typeof choice !== 'string' || !choice.trim())) {
            throw new Error(`問題${index + 1}の choices は4つの文字列にしてください。`);
        }
        if (!Number.isInteger(question.correctAnswerIndex) || question.correctAnswerIndex! < 0 || question.correctAnswerIndex! > 3) {
            throw new Error(`問題${index + 1}の correctAnswerIndex は0〜3の整数にしてください。`);
        }
    });

    return parsed as QuizQuestion[];
};

const QuizCreationModal: React.FC<QuizCreationModalProps> = ({ T, transcript, personaProfile, onClose, onSave, isAdding = false }) => {
    const [quizContent, setQuizContent] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [quizType, setQuizType] = useState<QuizType>('grammar');

    const generateQuizPrompt = useCallback(() => {
        const fullTranscriptText = transcript.map(t => t.english).join('\n');
        const personaText = personaProfile || 'プロの英語講師として、フレンドリーかつ丁寧に';

        const grammarInstructions = `
1. **クイズの内容 (Grammar Focus)**:
   - 【原文】の中から、学習者が間違いやすい、あるいは重要な文法事項、語法、イディオムを題材にした4択問題を5問作成してください。
   - 問題は、空欄補充、同意表現の選択、文法的に正しいものの選択など、形式は問いません。`;

        const contentInstructions = `
1. **クイズの内容 (Content Understanding Focus)**:
   - 【原文】の「内容理解」を問う4択問題を5問作成してください。文法ではなく、話の流れや意味が分かっているかをテストします。
   - 以下のタイプの問題をバランスよく含めてください：
     - **大意把握 (Main Idea)**: 文章全体のテーマや筆者の主張を問う問題。
     - **詳細読解 (Detail)**: 本文に書かれている具体的な事実や情報を問う問題（False/Trueなど）。
     - **推論 (Inference)**: 文脈から読み取れる筆者の意図、感情、または暗示されている内容を問う問題。
     - **言い換え (Paraphrasing)**: 本文中のフレーズや単語が、文脈の中でどのような意味（同義語）で使われているかを問う問題。`;

        return `命令書
あなたは、プロの英語講師であり、個性的で魅力的なキャラクターになりきって解説を行うエンターテイナーでもあります。これから、以下の【原文】と【絶対的制約条件】に従って、英語の4択クイズを作成してください。

【原文】
--- ここから ---
${fullTranscriptText}
--- ここまで ---

【絶対的制約条件】
${quizType === 'grammar' ? grammarInstructions : contentInstructions}

2. **解説のペルソナ**:
   - 解説は、以下のペルソナに完璧になりきって記述してください。
   - ペルソナ設定: ${personaText}
   - **正解時の解説 (\`explanationCorrect\`)**: 学習者を褒め称え、自信をつけさせるようなポジティブなトーンで、正解の根拠を解説してください。さらに知識が深まるような豆知識を加えるなど、知的好奇心を刺激する内容にしてください。
   - **不正解時の解説 (\`explanationIncorrect\`)**: 学習者の気持ちに寄り添い、励ますような優しいトーンで、なぜその選択肢が間違いなのか、そしてどの選択肢が正解なのかを丁寧に解説してください。決して見下したり、馬鹿にしたりするような態度は取らないでください。
   - どちらの解説も、ペルソナらしいユニークで解像度の高い口調を大げさに盛り込んでください。
   - **重要: 解説文や問題文の中に、強調のためのアスタリスク（**）やMarkdown記法は絶対に使用しないでください。強調したい場合は「」や【】などの記号を使用してください。

3. **出力形式**:
   - **必ず、以下のJSON形式のコードブロックでだしてください。
   - 全体を単一のJSON配列 \`[]\` としてください。
   - 配列の各要素は、以下のキーを持つオブジェクト \`{}\` としてください。
     - \`question\`: 問題文 (string) ※英語で記述
     - \`choices\`: 4つの選択肢を格納した配列 (string[]) ※英語で記述
     - \`correctAnswerIndex\`: 正解の選択肢のインデックス (number, 0から3)
     - \`explanationCorrect\`: 正解した場合のペルソナによる解説文 (string) ※日本語で記述
     - \`explanationIncorrect\`: 間違えた場合のペルソナによる解説文 (string) ※日本語で記述

4. **コードブロックのJSON出力例**:
   \`\`\`json
   [
     {
       "question": "According to the text, why did the protagonist decide to leave?",
       "choices": [
         "Because it was raining",
         "To pursue a new career",
         "He was fired",
         "The text does not say"
       ],
       "correctAnswerIndex": 1,
       "explanationCorrect": "その通り！よく読んでるね！本文の第2段落に'seeking new horizons'ってあるでしょ？これが「新しいキャリアを追い求める」ってことなのさ。あんたの読解力、伊達じゃないね！",
       "explanationIncorrect": "あちゃー、ちょっと引っかかっちゃったかな？雨が降ってた描写はあるけど、それが帰る理由とは書いてないんだよね。文脈をもう一度確認してみて！正解は「新しいキャリアのため」だよ。"
     }
   ]
   \`\`\`

以上の全ての条件を完璧に満たした、最高品質のクイズを生成してください。`;
    }, [transcript, personaProfile, quizType]);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(generateQuizPrompt());
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleSaveClick = async () => {
        setError('');
        if (!quizContent.trim()) {
            setError('クイズデータを貼り付けてください。');
            return;
        }
        try {
            const parsed = parseQuizContent(quizContent);
            const normalizedQuizContent = JSON.stringify(parsed, null, 2);
            const file = new File([normalizedQuizContent], 'quiz.json', { type: 'application/json' });
            setIsSaving(true);
            await onSave(file);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'クイズデータの解析に失敗しました。');
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className={`${T.containerBg} p-6 rounded-lg shadow-xl max-w-2xl w-full border ${T.border} animate-fade-in`} onClick={(e) => e.stopPropagation()}>
                <h3 className={`text-xl font-bold ${T.textPrimary} mb-4`}>{isAdding ? 'クイズを追加' : 'クイズを作成'}</h3>
                
                <div className="space-y-4">
                    {/* Quiz Type Selection Tabs */}
                    <div className="flex gap-2 border-b border-white/10 pb-4">
                        <button
                            onClick={() => setQuizType('grammar')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
                                quizType === 'grammar' 
                                    ? `${T.accentBg} text-white shadow-md` 
                                    : `${T.button} ${T.textSecondary} hover:bg-white/10`
                            }`}
                        >
                            文法・語法
                        </button>
                        <button
                            onClick={() => setQuizType('content')}
                            className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${
                                quizType === 'content' 
                                    ? `${T.accentBg} text-white shadow-md` 
                                    : `${T.button} ${T.textSecondary} hover:bg-white/10`
                            }`}
                        >
                            内容理解・読解
                        </button>
                    </div>

                    <div>
                        <p className={`${T.textSecondary} text-sm mb-2`}>
                            1. プロンプトをコピーし、AI Studioで<span className="font-bold text-sky-400">{quizType === 'grammar' ? '文法クイズ' : '内容理解クイズ'}</span>を生成します。
                        </p>
                        <div className="flex items-center gap-2">
                            <button onClick={handleCopy} className={`w-full px-4 py-2 ${T.button} rounded-md font-semibold transition-colors`}>
                                {isCopied ? 'コピーしました！' : 'プロンプトをコピー'}
                            </button>
                            <a href="https://aistudio.google.com/app/u/0/prompts/new_chat?model=gemini-3-pro-preview" target="_blank" rel="noopener noreferrer" className={`w-full px-4 py-2 ${T.accentBg} ${T.accentBgHover} text-white text-center rounded-md font-semibold transition-colors`}>
                                AI Studioで作成
                            </a>
                        </div>
                    </div>
                    <div>
                        <p className={`${T.textSecondary} text-sm mb-2`}>2. AI Studioから得られたJSONデータを以下に貼り付けてください。</p>
                        <textarea
                            value={quizContent}
                            onChange={(e) => setQuizContent(e.target.value)}
                            placeholder="ここにJSONデータを貼り付け..."
                            rows={8}
                            className={`w-full p-2 text-sm ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring} font-mono`}
                        />
                    </div>
                     {error && <p className="text-red-400 text-sm">{error}</p>}
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={onClose} className={`px-4 py-2 ${T.button} rounded-md font-semibold transition-colors`}>
                        キャンセル
                    </button>
                    <button onClick={handleSaveClick} disabled={isSaving} className={`px-4 py-2 ${T.buttonStrong} rounded-md font-semibold transition-colors disabled:opacity-50`}>
                        {isSaving ? '保存中...' : (isAdding ? '追加して保存' : '保存してクイズを開始')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuizCreationModal;
