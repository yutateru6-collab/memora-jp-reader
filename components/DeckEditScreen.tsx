
import React, { useState } from 'react';
import { Card } from '../types';
import { Theme } from '../App';

interface DeckEditScreenProps {
  cards: Card[];
  deckName: string;
  onBack: () => void;
  T: Theme;
}

const DeckEditScreen: React.FC<DeckEditScreenProps> = ({ cards, deckName, onBack, T }) => {
  const [currentDeckName, setCurrentDeckName] = useState(deckName);
  const [cardSideCount, setCardSideCount] = useState(4);
  const [wordListText, setWordListText] = useState(
    cards.map(c => [c.front, c.back, c.pronunciation, c.memo].filter(Boolean).join(' / ')).join('\n')
  );
  const [delimiter, setDelimiter] = useState('/');

  return (
    <div className={`flex flex-col h-screen max-h-screen overflow-hidden ${T.bg}`}>
      <header className={`flex-shrink-0 flex items-center justify-between p-3 ${T.containerBg} shadow-md z-10`}>
        <button onClick={onBack} className={`flex items-center gap-2 px-3 py-2 text-sm ${T.button} rounded-md transition-colors`}>
          &larr; デッキ一覧に戻る
        </button>
        <h1 className={`text-xl font-bold ${T.textPrimary}`}>デッキを編集</h1>
        <div className="flex items-center gap-2">
            <button className={`px-4 py-2 text-sm ${T.button} rounded-md`}>プロンプト</button>
            <button className={`px-4 py-2 text-sm ${T.accentBg} ${T.accentBgHover} text-white rounded-md`}>作成に行く</button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center p-4 overflow-y-auto">
        <div className="w-full max-w-5xl space-y-6">
            <p className={`${T.textMuted} text-sm`}>単語リストを以下に貼り付けてください。解析後、カードを作成する前に確認できます。</p>

            <div className={`${T.containerBg} p-6 rounded-lg shadow-lg`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: Editor */}
                    <div className="space-y-4">
                        <div>
                            <label className={`block text-lg font-semibold ${T.textPrimary} mb-2`}>デッキ名</label>
                            <input 
                                type="text"
                                value={currentDeckName}
                                onChange={(e) => setCurrentDeckName(e.target.value)}
                                className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                            />
                        </div>

                        <div>
                            <label className={`block text-lg font-semibold ${T.textPrimary} mb-2`}>カードの面数</label>
                            <div className="flex gap-2">
                                {[2, 3, 4].map(sides => (
                                    <button 
                                        key={sides}
                                        onClick={() => setCardSideCount(sides)}
                                        className={`px-4 py-2 rounded-md ${cardSideCount === sides ? `${T.accentBg} text-white` : T.button}`}
                                    >
                                        {sides}面
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="word-list-area" className={`block text-lg font-semibold ${T.textPrimary} mb-2`}>単語リスト ({cardSideCount}面)</label>
                            <textarea 
                                id="word-list-area"
                                value={wordListText}
                                onChange={(e) => setWordListText(e.target.value)}
                                rows={10}
                                placeholder="例:&#10;update / アップデート / 最新のものにする&#10;refresh / リフレッシュ / 気分をさわやかにする"
                                className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring} font-mono`}
                            />
                        </div>
                        
                         <div>
                            <label htmlFor="supplement-list-area" className={`block text-lg font-semibold ${T.textPrimary} mb-2`}>補足リスト (3面 / 4面)</label>
                            <textarea 
                                id="supplement-list-area"
                                rows={6}
                                placeholder="例文やメモなど"
                                className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring} font-mono`}
                            />
                        </div>

                    </div>
                    
                    {/* Right Column: Delimiter and Preview */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div>
                                <label className={`block text-sm font-semibold ${T.textMuted} mb-1`}>区切り文字で分割</label>
                                <input 
                                    type="text"
                                    value={delimiter}
                                    onChange={(e) => setDelimiter(e.target.value)}
                                    className={`w-20 p-2 text-center ${T.button} ${T.textSecondary} rounded-md border ${T.border}`}
                                />
                            </div>
                            <div className="flex-grow pt-6">
                                <button className={`w-full py-2 ${T.buttonStrong} rounded-md`}>すべて再解析</button>
                            </div>
                        </div>
                        <p className={`text-xs ${T.textMuted}`}>分割が間違っている場合は、正しい区切り文字（タブの場合は空のまま）を入力して「すべて再解析」をクリックしてください。</p>

                        <div className="space-y-2">
                            <label className={`block text-lg font-semibold ${T.textPrimary}`}>プレビュー</label>
                            <div className={`p-4 border ${T.border} rounded-lg h-96 overflow-y-auto space-y-2`}>
                                {/* Placeholder for preview items */}
                                <div className={`${T.button} p-2 rounded text-sm`}>
                                    <strong>表:</strong> update アップデート [デイト]
                                </div>
                                 <div className={`${T.button} p-2 rounded text-sm`}>
                                    <strong>裏:</strong> を最新のものにする；をアップデートする
                                </div>
                                <div className={`${T.button} p-2 rounded text-sm`}>
                                    <strong>補足1:</strong> 「up (上に)」と「date (日付)」を組み合わせた、比較的新しい言葉...
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
      </main>
    </div>
  );
};

export default DeckEditScreen;
