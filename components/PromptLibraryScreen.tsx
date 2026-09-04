
import React, { useState, useCallback } from 'react';
import { Theme } from '../App';
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon';

export interface PromptPersonaSelection {
  name: string;
  role: string;
  trait: string;
}

interface PromptLibraryScreenProps {
  onBack: () => void;
  T: Theme;
  onNavigateToPasteJSON?: (personas: PromptPersonaSelection[]) => void;
}

const DiceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 8h.01"></path>
    <path d="M8 8h.01"></path>
    <path d="M8 16h.01"></path>
    <path d="M16 16h.01"></path>
    <path d="M12 12h.01"></path>
  </svg>
);

const OFFICIAL_PERSONA_OPTIONS = [
    'ギャル',
    '大学生',
    '高校教師',
    '司書',
    '主婦',
    '経営者',
    'おじいちゃん',
    'ゲーム実況者',
    'ミステリー小説の探偵',
    '異世界から来た騎士',
];

// --- Accordion Wrapper Component ---
const PromptAccordion: React.FC<{
  T: Theme;
  title: string;
  icon: string;
  borderColor?: string;
  children: React.ReactNode;
  description?: string;
}> = ({ T, title, icon, borderColor = `border-white/10`, children, description }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`${T.containerBg} rounded-lg shadow-sm border ${borderColor} transition-all duration-100 overflow-hidden`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-white/5 ${isOpen ? 'border-b border-white/5' : ''}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{icon}</span>
          <div className="flex flex-col">
             <h3 className={`text-lg font-bold ${T.textPrimary}`}>{title}</h3>
             {description && !isOpen && <p className={`text-xs ${T.textMuted} line-clamp-1 mt-0.5`}>{description}</p>}
          </div>
        </div>
        <div className={`transition-transform duration-100 ${isOpen ? 'rotate-180' : ''} ${T.textMuted}`}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      <div 
        className={`grid transition-[grid-template-rows] duration-100 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
            <div className="p-4 pt-2">
                {description && <p className={`text-sm ${T.textMuted} mb-4`}>{description}</p>}
                {children}
            </div>
        </div>
      </div>
    </div>
  );
};

const mnemonicRules = `【覚え方】
[語源と雑学]の文章の最後に、必ず【覚え方】という見出しを付け、以下の「絶対的生成ルール」に従って、面白くて覚えやすい語呂合わせを作成してください。

絶対的生成ルール（Think Harder & Create Impact）

1.  **音の解体と再構築（空耳化）**
    *   英単語の発音を忠実なカタカナにするのではなく、「日本語の何に聞こえるか（空耳）」で分解してください。
    *   例: \`Universe\` → ユニ・バース → 「ウニ」＋「バス」

2.  **異常な映像の喚起（シュールレアリスム）**
    *   平凡な文章は禁止です。「ありえない状況」「感情的な場面（怒り・悲しみ・恐怖）」「シュールな絵」が脳裏に浮かぶようなストーリーにしてください。
    *   インパクト重視で、多少強引でも構いません。

3.  **文末着地（意味の固定）**
    *   語呂合わせの文章の**最後（または文中の重要なオチ部分）**に、必ずその英単語の「日本語訳」を配置してください。
    *   「音（A）といえば、意味（B）」という回路を脳に焼き付けるためです。

4.  **形式の統一（シンプル・イズ・ベスト）**
    *   出力は以下の1行形式のみとしてください。余計な記号やカッコは排除し、リズムを重視してください。
    *   形式: **[空耳を使った文章] + [日本語訳]**
    *   ※日本語訳の部分は【 】で囲んで強調してください。

## 悪い例（禁止）
*   × Specific → スペース引くほど広いね（意味が含まれていない）
*   × Struggle → ストライキでラグビー部がもがく（映像が弱く、リズムが悪い）

## 良い例（合格ライン）
*   ○ Specific → スペース引くほど【具体的】に
*   ○ Struggle → 素手で虎来る、必死に【もがく】
*   ○ Ambiguous → 案、微妙で具体性なく【曖昧】っす`;

// --- SNS Thread Prompt Card (X Style) ---
const SnsThreadPromptCard: React.FC<{ T: Theme }> = ({ T }) => {
    const [topic, setTopic] = useState('');
    const [persona, setPersona] = useState('炎上系インフルエンサー');
    const [chaosLevel, setChaosLevel] = useState(3);
    const [englishLevel, setEnglishLevel] = useState('英検2級');
    const [copied, setCopied] = useState(false);

    const personaOptions = [
        '炎上系インフルエンサー', '起業家・マーケター', '美容垢（毒舌）', 
        '裏垢女子', '政治家', '陰謀論者', '公式アカウント(中の人)', '技術者(エンジニア)', 
        'ご意見番', '就活生', 'ガジェットオタク', '地下アイドル'
    ];

    const levelOptions = [
        '英検1級', '英検準1級', '英検2級', '英検準2級', '英検3級', '共通テスト'
    ];

    const getChaosLabel = (level: number) => {
        if (level <= 1) return "Lv.1 平和 (ポジティブ勢中心)";
        if (level <= 2) return "Lv.2 ちょい荒れ (たまに自分語り)";
        if (level <= 3) return "Lv.3 通常 (称賛とクソリプが半々)";
        if (level <= 4) return "Lv.4 カオス (スパムとレスバ多め)";
        return "Lv.5 地獄 (インプレゾンビと陰謀論の巣窟)";
    };

    const generatePrompt = useCallback(() => {
        // Determine distribution based on chaos level
        let selectionLogic = "";
        if (chaosLevel <= 1) {
            selectionLogic = "【ポジティブ勢】リストからランダムに8名、【カオス勢】（軽いもの）から2名を選出し、建設的で平和な議論を行わせてください。";
        } else if (chaosLevel <= 2) {
            selectionLogic = "【ポジティブ勢】を6割、【カオス勢】（自分語りやクソバイスなど）を4割選出し、たまにイラッとするが基本は成立している会話にしてください。";
        } else if (chaosLevel <= 3) {
            selectionLogic = "【ポジティブ勢】と【カオス勢】を5:5の割合でランダムに選出してください。称賛と批判、スパムが入り混じるリアルなTLにしてください。";
        } else if (chaosLevel <= 4) {
            selectionLogic = "【カオス勢】を7割選出してください。スパム、論破マン、陰謀論者を多用し、かなり荒れたリプ欄にしてください。";
        } else {
            selectionLogic = "【カオス勢】リストから9割を選出してください。インプレゾンビ、陰謀論者、クソリプおじさんを多用し、会話が成立しない地獄のようなリプライ欄を生成してください。まともなことを言っている人（ポジティブ勢）が1人紛れ込むものの、声がかき消されている様子を描写してください。";
        }

        return `命令書
あなたは超一流のSNSマーケターであり、現代のネットの闇（インプレゾンビ、クソリプ、スパム広告）にも精通したクリエイターです。
私のために、以下のテーマと設定で**「現代のX（旧Twitter）のカオスなリプライ欄」**をリアルに再現したスレッドデータを作成してください。

## 1. 今回のテーマ
*   **テーマ:** ${topic || '（AIにお任せ：バズりそうな時事ネタや炎上ネタ）'}
*   **メインの投稿者:** ${persona} (このペルソナになりきって、万バズしそうな投稿をしてください)
*   **英語レベル:** ${englishLevel}
*   **リプライ欄の雰囲気:** ${getChaosLabel(chaosLevel)}

## 2. 登場人物データベース
以下のリストから、指定された割合でリプライ投稿者（計10〜15人）を選出してください。

**【カオス勢（15種）】**
1.  **公式マーク付きインプレゾンビ**: 文脈無視の「Great!」「Wow」や謎のアラビア語、元ツイのコピペを連投。
2.  **FF外から失礼する自分語りマン**: 「FF外から失礼します」と丁寧に始まり、隙あらば自分の話にすり替えて長文を語る。
3.  **冷笑系・論破したいマン**: 「これだから〇〇は…」「感情論ですね」と冷徹な分析（のフリ）をしてマウントを取る。
4.  **距離感バグりクソリプおじさん**: 絵文字（😅、🙏、💦）多用。「ナンチャッテ😅」など文脈無視で馴れ馴れしい。
5.  **情報商材・プロフ誘導垢**: 共感するフリをして「稼ぎ方はプロフ（固ツイ）で！」「LINE追加で教えます✨」と誘導。
6.  **学歴・偏差値マウント厨**: 話題が何であれ、すぐに大学名や偏差値の話に持ち込み格付けする。「Fラン乙」
7.  **謎の「要約」アカウント**: 「【要約すると】1. 〇〇...」と勝手に箇条書きでまとめ、最後に自分の宣伝をする。
8.  **文脈読めない正義マン（自治厨）**: 冗談に対して「不謹慎です」「子供が見たらどうするんですか」とマジレス説教。
9.  **全てを陰謀に繋げる人**: 天気や芸能ニュースでも「政府の陰謀」「DSの仕業」「目覚めよ」と結びつける。
10. **全肯定信者（囲い）**: 「さすがです！」「天才！」「神！」としか言わず、思考停止で称賛する。
11. **隙あらば政治批判**: ランチの画像に対しても「自民党の〇〇政策のせいで庶民は…」と無理やり政治批判に繋げる。
12. **「嘘松」・創作実話クリエイター**: 「電車で女子高生が…って話してて泣いた」など、作り話っぽいイイ話を披露。
13. **クソバイス（頼んでないアドバイス）厨**: 「FF外から失礼します。次は〇〇すべきですね」と上から目線で助言。
14. **カタカナ語多用の意識高い系**: 「アジェンダ」「コンセンサス」などを乱用し、賢そうだが中身がない。
15. **読解力ゼロの曲解マン**: 「猫が好き」と言っただけで「じゃあ犬は嫌いなんですか？差別です！」と勝手に激怒。

**【ポジティブ勢（7種）】**
1.  **補足情報の神（ソース提示ニキ）**: 「これについては〇〇省のデータ(URL)が参考になります」と有益な一次情報を提示。
2.  **圧倒的聖人**: 批判的なリプ欄でも「私はあなたの姿勢に勇気をもらいました」と優しい言葉をかける。
3.  **ユーモアセンス抜群の秀才**: 殺伐とした空気を、誰も傷つけない高度なジョークで和ませる。
4.  **冷静な仲裁者**: 「AさんもBさんも視点が違うだけで正解ですよ」とレスバを収める。
5.  **翻訳・要約の達人（有能ver）**: 難解な文脈を「つまりこういうことですね」と分かりやすく噛み砕く。
6.  **古参の良き理解者**: 「昔から見てますが、今回も一貫していて安心しました」と浅い批判を否定。
7.  **実体験シェア（成功・共感）**: 「私も同じ状況でしたが、こうしたら上手くいきました！」と役立つ体験談を共有。

## 3. リプライ生成ルール
**選出ロジック:**
${selectionLogic}

**記述のルール:**
*   **日本語(jp_content):** 各キャラクターの特徴を捉えた口調（スラング、絵文字、構文）で記述してください。
*   **英語(en_content):** その英訳。日本のネットスラングのニュアンスを、英語圏のネットスラング（lol, lmao, ratio, cap, bot behavior, scam等）にうまく変換してください。
*   **解説(explanation):**
    *   **【重要】** 投稿者のキャラ設定の解説は不要です。代わりに、**英語のスラング、口語表現、文法、単語のニュアンス**について、学習者にとって有益な解説を日本語で記述してください。（例：「ここでの'cap'は嘘という意味のスラングです」「'ratio'はリプライ数がいいね数を上回ることを指し...」など）
*   **【重要】** 英語と日本語は、必ず「行数」と「改行位置」を一致させてください。

## 4. 出力形式（厳守！）
以下の**JSON形式**のみを出力してください。Markdownのコードブロック（\`\`\`json）で囲んでください。
アバター画像は\`avatar_emoji\`に絵文字1つを指定してください。

**メイン投稿者プロフィール (\`author_info\`):**
メイン投稿者については、そのペルソナ（${persona}）を解像度高く表現したプロフィール情報（自己紹介文など）を必ず作成してください。Bioは痛々しかったり、意識高かったり、毒舌だったりと、キャラが立っているものにしてください。
**【重要】** プロフィール文（bio）に対しても、学習用に**英訳（bio_en）**を必ず作成してください。bioとbio_enは「行数」と「改行位置」を一致させてください。

\`\`\`json
{
  "mode": "x_thread",
  "theme_color": "#000000",
  "main_post": {
    "author_name": "表示名",
    "handle": "@ユーザーID",
    "is_verified": true,
    "avatar_emoji": "🚀", 
    "timestamp": "2h",
    "jp_content": "日本語のツイート内容...",
    "en_content": "英語の翻訳内容...",
    "explanation": "英語のスラングや文法に関する学習用解説...",
    "author_info": {
        "bio": "（日本語）ここにペルソナの解像度の高い自己紹介文を記述。\\n改行も含めてリアルに。",
        "bio_en": "（英語）自己紹介文の英訳。\\n行数と改行位置を日本語と合わせてください。",
        "location": "港区 / Dubai",
        "website": "lit.link/...",
        "born": "1995",
        "joined": "2015年4月",
        "following": "102",
        "followers": "5.4M"
    },
    "stats": {
      "replies": "542",
      "reposts": "1.2K",
      "likes": "5.4K",
      "views": "12M"
    },
    "keywords": [
        {"word": "viral", "meaning": "バズる"}
    ]
  },
  "replies": [
    {
      "id": 1,
      "author_name": "魔界の副業ママ💰️",
      "handle": "@money_mama_999",
      "is_verified": true,
      "avatar_emoji": "👩",
      "timestamp": "1h",
      "jp_content": "素晴らしいですね！私のプロフも見てください✨\\nLINE追加で5万円プレゼント🎁",
      "en_content": "Amazing! Please check my profile ✨\\nAdd LINE and get 50,000 yen present 🎁",
      "explanation": "ここでは 'Check bio' (プロフィールを見て) という表現がよく使われます。...",
      "keywords": [
          {"word": "bio", "meaning": "プロフィール(biography)"},
          {"word": "scam", "meaning": "詐欺"}
      ]
    },
    ... (計10〜15人分)
  ]
}
\`\`\``;
    }, [topic, persona, chaosLevel, englishLevel]);

    const handleCopy = () => {
        navigator.clipboard.writeText(generatePrompt()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <PromptAccordion 
            T={T} 
            title="SNSスレッドメーカー (X風)" 
            icon="🐦"
            borderColor="border-slate-600"
            description="クソリプ、インプレゾンビ、謎の広告を含む、リアルでカオスなリプライ欄を再現します。"
        >
            <div className="space-y-4 mb-4">
                 <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>スレッドのテーマ</label>
                    <input 
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="例：AIの進化について、炎上した謝罪会見"
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    />
                </div>
                
                <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>投稿者ペルソナ</label>
                    <select
                        value={persona}
                        onChange={(e) => setPersona(e.target.value)}
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    >
                        {personaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>

                <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>カオス度 (民度)</label>
                    <div className="relative pt-1">
                        <input 
                            type="range" 
                            min="1" 
                            max="5" 
                            step="1" 
                            value={chaosLevel} 
                            onChange={(e) => setChaosLevel(Number(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Lv.1 平和</span>
                            <span>Lv.3 通常</span>
                            <span>Lv.5 地獄</span>
                        </div>
                        <div className="text-center mt-2 text-sky-400 text-sm font-bold animate-fade-in">
                            {getChaosLabel(chaosLevel)}
                        </div>
                    </div>
                </div>

                <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>英語レベル</label>
                    <select
                        value={englishLevel}
                        onChange={(e) => setEnglishLevel(e.target.value)}
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    >
                        {levelOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex gap-2 mt-auto pt-4 border-t border-white/10">
                <button onClick={handleCopy} className={`flex-1 px-3 py-2 text-sm ${T.buttonStrong} rounded-md font-semibold transition-colors`}>
                    {copied ? 'コピー完了' : 'プロンプトをコピー'}
                </button>
                <a href={'https://aistudio.google.com/app/u/0/prompts/new_chat?model=gemini-3-pro-preview'} target="_blank" rel="noopener noreferrer" className={`flex-1 px-3 py-2 text-sm ${T.accentBg} ${T.accentBgHover} text-white text-center rounded-md font-semibold transition-colors`}>
                    AI Studioで作成
                </a>
            </div>
        </PromptAccordion>
    );
};

// --- Legend Prompt Card (New) ---
const LegendPromptCard: React.FC<{ T: Theme }> = ({ T }) => {
    const [topic, setTopic] = useState('');
    const [personaRole, setPersonaRole] = useState('熱血コーチ');
    const [personaTrait, setPersonaTrait] = useState('とにかく褒めてくれる（激甘モード）');
    const [copied, setCopied] = useState(false);

    const personaOptions = [
        '熱血コーチ', 'ギャル', '大学生', '小学生', '部長', '主婦', '浪人生', '政治家', 'インフルエンサー', 'バンドマン', 
        'ミステリー小説の探偵', 'おじいちゃん', 'おばあちゃん', '中学生', '司書', '経営者', 'オカルト好き', 
        '異世界から来た騎士', '歴史上の人物', '就活中の大学生', 'アイドルオタク', 'スピリチュアルカウンセラー', 
        'ゲーム実況者', '漫画家', '高校教師', '美容師', '新米ママ', '花屋の店主', '帰国子女', 'トラック運転手'
    ];
    
    const personaTraitOptions = [
        'とにかく褒めてくれる（激甘モード）', // Special mode
        '口がものすごく悪い', 'ものすごく真面目', '極端にOCD気味', '極端に不安性', '完全なるポジティブ', 
        '異常に怒りっぽい', '徹底的に論理的', 'ひねくれすぎな皮肉屋', '過剰に詩的', '異常なまでに好奇心旺盛', 
        'お節介すぎるほど世話好き', '度が過ぎるナルシスト', '極限まで怠惰', '底抜けに天真爛漫', '何でも懐疑的', 
        '小難しく考えすぎるほど哲学的', '病的なまでに結論を急かす', '異常なほど共感を求める', 
        '狂信的なデータ至上主義', '突拍子もない陰謀論を信じがち', 'ありえないほど話を盛り気味', 
        '聞いている方が心配になるほど自虐的', 'マニュアル原理主義', '無理やりすぎる例え話が好き', 
        'わざとらしいほどカタコトの外国人風', 'ことあるごとに五・七・五で詠みがち', '尋常じゃないくらい擬音語・擬態語を多用', 
        '秒で話を脱線させる', '森羅万象をランキング付けする', '息をするように過去の武勇伝を語りがち', 
        '空気も凍るダジャレを挟む', '偏見まみれの決めつけが激しい', 'クセが強すぎる相槌', '恐縮しすぎなくらい過剰に丁寧'
    ];

    const generatePrompt = useCallback(() => {
        const isSweetMode = personaTrait === 'とにかく褒めてくれる（激甘モード）';
        
        let personaInstruction = "";
        if (isSweetMode) {
            personaInstruction = `以下のキャラになりきって、**とにかくユーザーを褒めちぎってください**。たとえ「厳しい」キャラ設定であっても、今回だけは**「お前、天才か？」「貴様、素晴らしいぞ！」と全肯定**してください。ユーザーの自己肯定感を爆上げすることがあなたの使命です。`;
        } else {
            personaInstruction = `以下のキャラになりきってコメントしてください。**「${personaTrait}」という性格設定を極端に反映させ、容赦なくその口調でコメントしてください。** 毒舌なら徹底的にディスり、皮肉屋なら皮肉を言い、臆病なら怯えてください。中途半端なキャラ作りは禁止です。`;
        }

        return `命令書
あなたはプロの英語コーチであり、エンターテイナーです。
英語が全くできない超初心者のために、以下のテーマで**「絶対に挫折しない、楽しい教材」**を作ってください。

## 1. 今回のテーマ
**${topic || '（テーマをここに入力してください）'}**
（このテーマについて、短くて簡単なストーリーを作ってください）

## 2. 応援してくれるキャラクター
${personaInstruction}
名前: ${personaRole}
性格: ${personaTrait}

## 3. 記事の書き方（ここが最重要！）
以下の3段階のレベルをセットにして書いてください。
**単語を強調する際は、\`[表示する単語](意味|発音)\` という形式を使用してください。縦棒(|)で区切るのがルールです。**

1.  **レベル1（ルー語）:**
    日本語の文章ですが、名詞や動詞だけを**「英語」**に置き換えてください。
    **形式: \`[English Word](日本語の意味|カタカナ読み)\`**
    例：「昨日、[Friend](友達|フレンド)と[Lunch](昼食|ランチ)した。」

2.  **レベル2（逆ルー語・ちゃんぽん）:**
    **英語の語順**で記述しますが、難しい単語（名詞や動詞など）は**「日本語」**のままにしてください。
    **形式: \`[日本語単語](English Word|カタカナ読み)\`**
    例：「Yesterday, I ate [昼食](Lunch|ランチ) with my [友達](Friend|フレンド).」
    ※注意: 基本構造は英語ですが、キーワードとなる単語を日本語で表示し、クリックすると英語と発音が出るようにします。

3.  **レベル3（英語）:**
    短くてシンプルな、完全な英語の文章。注釈は付けないでください。

## 4. キャラのコメント（多層化）
各レベルごとに、キャラクターが発するコメントを変えてください。
*   **Lv1用 (comment_1):** とにかく激甘に褒めちぎってください。「天才か？」「その調子！」など。
*   **Lv2用 (comment_2):** 褒め言葉に加え、ストーリーの内容に関連した**「面白い雑学・うんちく」**を1つ披露してください。「へぇ〜」と思える知識をキャラの口調で語ってください。
*   **Lv3用 (comment_3):** 褒め言葉に加え、英語学習に関する格言や、感動的なフィナーレの言葉を贈ってください。

## 5. 出力形式（厳守！）
アプリで読み込みたいので、最終的に以下の**JSON形式**のみを出力してください。Markdownのコードブロック（\`\`\`json）で囲んでください。

\`\`\`json
{
  "mode": "legend",
  "title": "【伝説の始まり】から始まる楽しいタイトル",
  "content": [
    {
      "jp_mixed": "私は[Pen](ペン|ペン)を持っています。",
      "en_mixed": "I have a [ペン](Pen|ペン).",
      "en_full": "I have a pen.",
      "comment_1": "Lv1用のコメント（激甘な褒め）",
      "comment_2": "Lv2用のコメント（褒め＋関連する面白雑学・うんちく）",
      "comment_3": "Lv3用のコメント（褒め＋感動・格言）",
      "character_name": "${personaRole}"
    },
    ... （これを5〜8個くらい繰り返す）
  ]
}
\`\`\`
`;
    }, [topic, personaRole, personaTrait]);

    const handleCopy = () => {
        navigator.clipboard.writeText(generatePrompt()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const randomize = () => {
        const rRole = personaOptions[Math.floor(Math.random() * personaOptions.length)];
        const rTrait = personaTraitOptions[Math.floor(Math.random() * personaTraitOptions.length)];
        setPersonaRole(rRole);
        setPersonaTrait(rTrait);
    };

    return (
        <PromptAccordion 
            T={T} 
            title="伝説の始まり（超初心者モード）" 
            icon="🔰"
            borderColor="border-pink-500/30"
            description="「ルー語」から始めて、気づいたら英語が読めている！？キャラ設定可能。"
        >
            <div className="space-y-4 mb-4">
                 <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>ストーリーのテーマ</label>
                    <input 
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="例：初めての海外旅行、猫の日常"
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-2 relative">
                    <button 
                        onClick={randomize}
                        className={`absolute -top-7 right-0 text-xs flex items-center gap-1 px-2 py-1 rounded-md ${T.button} hover:text-pink-400 transition-colors`}
                        title="役割と性格をランダムに設定"
                    >
                        <DiceIcon className="w-3 h-3" />
                        ランダム
                    </button>
                    <div>
                        <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>役割 (キャラ名)</label>
                        <select
                            value={personaRole}
                            onChange={(e) => setPersonaRole(e.target.value)}
                            className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                        >
                            {personaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>性格・特徴</label>
                        <select
                            value={personaTrait}
                            onChange={(e) => setPersonaTrait(e.target.value)}
                            className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                        >
                            {personaTraitOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mt-auto pt-4 border-t border-white/10">
                <button onClick={handleCopy} className={`flex-1 px-3 py-2 text-sm ${T.buttonStrong} rounded-md font-semibold transition-colors`}>
                    {copied ? 'コピー完了！' : 'プロンプトをコピー'}
                </button>
                <a href={'https://aistudio.google.com/app/u/0/prompts/new_chat?model=gemini-3-pro-preview'} target="_blank" rel="noopener noreferrer" className={`flex-1 px-3 py-2 text-sm ${T.accentBg} ${T.accentBgHover} text-white text-center rounded-md font-semibold transition-colors`}>
                    AI Studioで作成
                </a>
            </div>
        </PromptAccordion>
    );
};

// --- New Amazon Prompt Card ---
const AmazonPromptCard: React.FC<{ T: Theme }> = ({ T }) => {
    const levelOptions = [
        '英検1級',
        '英検準1級',
        '英検2級',
        '英検準2級',
        '英検3級',
        '共通テスト'
    ];

    const [theme, setTheme] = useState('');
    const [englishLevel, setEnglishLevel] = useState(levelOptions[0]);
    const [copied, setCopied] = useState(false);

    const generatePrompt = useCallback(() => {
        return `命令書
あなたは超一流のコンテンツ・ライターであり、Amazonのマーケティング専門家です。
私がAI Studioに**「画像」**とこのテキストをアップロードします。
その画像を詳細に分析し、**「日本のAmazonの商品ページ」**を架空に作り上げてください。

## 1. 入力画像について
添付された画像を詳細に観察してください。
その画像に描かれている物体、風景、人物、あるいは抽象的な概念を「商品」として定義し、魅力的な（あるいはネタ的な）商品名をつけてください。

## 2. 商品設定（テーマ: ${theme || '画像から自動判定'}）
*   設定: **これは日本のAmazonで売られている商品です。**
*   商品名(日本語): 画像の特徴を捉えた、いかにも日本のAmazonにありそうな商品名（キーワードの羅列など）。
*   価格: 日本円表記 (¥表記) または概念的な価格。
*   特徴(日本語): 画像内の要素をスペックとして箇条書きにしてください。

## 3. レビュー作成ルール (日本人が書いたリアルなレビュー)
この商品に対する「カスタマーレビュー」を5〜8件作成してください。
**レビューはすべて「日本人」が書いたものとして作成してください。**
翻訳調の日本語は禁止です。文脈に合わせて、若者言葉、おじさん構文、主婦の口調、ネットスラング、顔文字などを使い分け、**「本当にいろんなペルソナの日本人が書いたような自然でありつつ、極端で記憶に残る内容の日本語」**にしてください。

*   **日本語(jp):** 上記の通り、自然な日本語で書いてください。
*   **英語(en):** その日本語レビューを、「${englishLevel}」の英語に翻訳してください。学習用テキストとして機能するようにしてください。
*   **解説(explanation):** 英訳の中で使われている重要な英単語、文法、スラングについて、日本語で詳しく解説してください。**※重要: 日本語の単語の読み方（ローマ字）は解説文に絶対に含めないでください。**
*   **キーワード(keywords):** そのレビュー（英訳）に含まれる「覚えるべき単語・熟語」を抽出し、意味とセットでリストにしてください。
*   **【重要】**英語(en)と日本語訳(jp)は、必ず「行数」と「改行位置」を一致させてください。

## 4. 出力形式（厳守！）
アプリで読み込むため、以下の**JSON形式**のみを出力してください。Markdownのコードブロック（\`\`\`json）で囲んでください。
**重要：** productオブジェクト内には、title, features, description (英語) と title_jp, features_jp, description_jp (日本語) の両方を含めてください。

\`\`\`json
{
  "mode": "amazon",
  "theme_color": "#232F3E",
  "product": {
    "title": "英訳された商品名",
    "title_jp": "【公式】画像から考えた日本のAmazon風の商品名 (2024年最新版) ...",
    "price": "¥2,980",
    "rating": 4.5,
    "rating_count": 1204,
    "features": [
      "英訳された特徴1...",
      "英訳された特徴2..."
    ],
    "features_jp": [
      "日本語の特徴1...",
      "日本語の特徴2..."
    ],
    "description": "英訳された商品説明文",
    "description_jp": "画像全体を説明する魅力的な商品説明文（自然な日本語）"
  },
  "reviews": [
    {
      "id": 1,
      "author": "Amazon カスタマー",
      "rating": 1, // 1~5
      "title": "最悪でした",
      "date": "2024年10月15日に日本でレビュー済み",
      "jp": "日本語の原文レビュー。\n顔文字なども適度に入れて自然に。\n行数と改行位置を英語訳と必ず合わせてください。",
      "en": "英語の翻訳レビュー。\n行数と改行位置を日本語原文と必ず合わせてください。",
      "explanation": "文法や単語の解説。(ローマ字読みは不要)",
      "verified_purchase": true,
      "keywords": [
        {"word": "english_word", "meaning": "単語の意味"}
      ]
    },
    ...
  ],
  "frequently_bought_together": [
    {"name": "関連商品名 (英語)", "meaning": "日本語の意味"},
    {"name": "関連商品名 (英語)", "meaning": "日本語の意味"}
  ]
}
\`\`\`
`;
    }, [theme, englishLevel]);

    const handleCopyImagePrompt = () => {
        navigator.clipboard.writeText(generatePrompt()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <PromptAccordion
            T={T}
            title="Amazon商品レビュー メーカー"
            icon="🛒"
            borderColor="border-yellow-500/30"
            description="画像をアップロードして、それを「商品」に見立てたレビュー記事を生成します。"
        >
            <div className="space-y-4 mb-4">
                 <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>商品カテゴリ（テーマ）</label>
                    <input 
                        type="text"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        placeholder="例：ブラックホール、未来のガジェット (空欄でAI任せ)"
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    />
                </div>
                
                <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>学習用英語レベル</label>
                    <select
                        value={englishLevel}
                        onChange={(e) => setEnglishLevel(e.target.value)}
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    >
                        {levelOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex gap-2 mt-auto pt-4 border-t border-white/10">
                {/* Image Upload Prompt Button */}
                <div className="w-full flex flex-col gap-2">
                     <p className={`text-xs ${T.textMuted} text-center`}>使い方: 1. 画像を用意 2. プロンプトをコピー 3. AI Studioに画像と一緒に貼り付け</p>
                     <div className="flex gap-2">
                         <button onClick={handleCopyImagePrompt} className={`flex-1 px-3 py-2 text-sm ${T.buttonStrong} rounded-md font-semibold transition-colors`}>
                            {copied ? 'コピー完了！' : 'プロンプトをコピー'}
                        </button>
                        <a href={'https://aistudio.google.com/app/u/0/prompts/new_chat?model=gemini-3-pro-preview'} target="_blank" rel="noopener noreferrer" className={`flex-1 px-3 py-2 text-sm ${T.accentBg} ${T.accentBgHover} text-white text-center rounded-md font-semibold transition-colors`}>
                            AI Studioで作成
                        </a>
                     </div>
                </div>
            </div>
        </PromptAccordion>
    );
};

const BoardPromptCard: React.FC<{ T: Theme }> = ({ T }) => {
    const [topic, setTopic] = useState('');
    const [targetVocab, setTargetVocab] = useState('');
    const [personas, setPersonas] = useState([
        { id: 1, name: '名無しさん', role: '大学生', trait: 'ひねくれすぎな皮肉屋' }
    ]);
    const [copied, setCopied] = useState(false);

    const levelOptions = [
        '英検1級',
        '英検準1級',
        '英検2級',
        '英検準2級',
        '英検3級',
        '共通テスト'
    ];

    const [englishLevel, setEnglishLevel] = useState(levelOptions[0]);

    const personaOptions = OFFICIAL_PERSONA_OPTIONS;
    
    const personaTraitOptions = [
        '口がものすごく悪い', 'ものすごく真面目', '極端にOCD気味', '極端に不安性', '完全なるポジティブ', 
        '異常に怒りっぽい', '徹底的に論理的', 'ひねくれすぎな皮肉屋', '過剰に詩的', '異常なまでに好奇心旺盛', 
        'お節介すぎるほど世話好き', '度が過ぎるナルシスト', '極限まで怠惰', '底抜けに天真爛漫', '何でも懐疑的', 
        '小難しく考えすぎるほど哲学的', '病的なまでに結論を急かす', '異常なほど共感を求める', 
        '狂信的なデータ至上主義', '突拍子もない陰謀論を信じがち', 'ありえないほど話を盛り気味', 
        '聞いている方が心配になるほど自虐的', 'マニュアル原理主義', '無理やりすぎる例え話が好き', 
        'わざとらしいほどカタコトの外国人風', 'ことあるごとに五・七・五で詠みがち', '尋常じゃないくらい擬音語・擬態語を多用', 
        '秒で話を脱線させる', '森羅万象をランキング付けする', '息をするように過去の武勇伝を語りがち', 
        '空気も凍るダジャレを挟む', '偏見まみれの決めつけが激しい', 'クセが強すぎる相槌', '恐縮しすぎなくらい過剰に丁寧'
    ];

    const addPersona = () => {
        if (personas.length < 5) {
            setPersonas([...personas, { id: Date.now(), name: '名無しさん', role: '大学生', trait: 'ひねくれすぎな皮肉屋' }]);
        }
    };

    const removePersona = (id: number) => {
        if (personas.length > 1) {
            setPersonas(personas.filter(p => p.id !== id));
        }
    };

    const updatePersona = (id: number, field: 'name' | 'role' | 'trait', value: string) => {
        setPersonas(personas.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const randomizePersona = (id: number) => {
        const randomRole = personaOptions[Math.floor(Math.random() * personaOptions.length)];
        const randomTrait = personaTraitOptions[Math.floor(Math.random() * personaTraitOptions.length)];
        setPersonas(personas.map(p => p.id === id ? { ...p, role: randomRole, trait: randomTrait } : p));
    };

    const generatePrompt = useCallback(() => {
        const personaList = personas.map(p => 
            `- 名前: ${p.name || '名無しさん'}\n  役割: ${p.role || '一般人'}\n  性格: ${p.trait || '普通'}`
        ).join('\n');

        const vocabInstruction = targetVocab.trim() ? `
## 【最重要】ターゲット単語の埋め込み指令
ユーザーが覚えたい以下の英単語（Target Vocabulary）を、スレッド内の**「英語翻訳 (en)」**の中に、すべて自然に盛り込んでください。

### 1. 英語 (en) のルール
*   ターゲット単語を使用する箇所は、必ず \`**\` (アスタリスク2つ) で囲んで強調してください。
*   活用形（過去形、進行形など）もOKです。
    *   例: "I always **procrastinate**..."

### 2. 日本語 (jp) のルール（絶対厳守！）
*   **日本語訳には強調記号（\`**\`）を一切つけないでください。**
*   英語側で強調されていても、日本語側は**プレーンテキスト**のままにしてください。
*   **禁止例:** "私はいつも**先延ばし**にする"
*   **正解例:** "私はいつも先延ばしにする"

**Target Vocabulary List:**
${targetVocab}
` : '';

        return `命令書
あなたは超一流のコンテンツ・ライターであり、日米のネット文化に精通した翻訳家です。
私のために、以下のテーマで**「日本の匿名掲示板まとめサイト（5ch/2chまとめ風）」の会話劇**を作ってください。

## 1. 今回のテーマ
**${topic || '（ここにテーマが入ります）'}**
（このテーマについて、スレ主（>>1）が立てたスレッドが、カオスな展開を見せる様子を描いてください）

${vocabInstruction}

## 2. 登場人物（住人たち）
以下の**「固定キャラクター」**に加え、後述する**「カオスな住人リスト」からランダムに多数（総勢15名程度）**を参加させ、賑やかでカオスなスレッドにしてください。

【固定キャラクター（ユーザー指定）】
${personaList}

【カオスな住人リスト（ここからAIがランダムに配役）】
1.  **スレ主 (>>1)**: 必死に状況を説明するが、どこか抜けていてツッコミ待ち。
2.  **特定班**: わずかな情報からスレ主の状況や場所を特定しようとする。「これ〇〇じゃね？」
3.  **冷笑系**: 「はい解散」「嘘松」とすぐに冷めたレスをする。
4.  **自分語りマン**: 隙あらばスレ主の話を自分の自慢話にすり替える。
5.  **博識ニキ**: 無駄に専門的な知識を長文で披露する（早口）。
6.  **煽り屋**: 何を言っても噛みついてレスバトルを仕掛ける。
7.  **安価 (>>) ミス**: アンカーを間違えて会話が噛み合わないドジっ子。
8.  **擬音・草**: 「ｗｗｗｗｗ」「ファッ！？」などリアクション担当。
9.  **自治厨**: ルールにうるさい。「sageろ」「半年ROMれ」
10. **業者**: 空気を読まずに怪しいURLを貼る。

## 3. 記事の構成ルール (Chaos Engine)
以下の流れで、**「30〜50個」**程度の「レス（書き込み）」を書いてください。
**「AIっぽい綺麗な日本語」は厳禁です。誤字脱字、独特なネットスラング、感情的な書き込み、会話の脱線を積極的に取り入れてください。**

1.  **ブログ設定の自動決定 (カメレオン・システム):**
    *   記事の内容に合わせて、架空の「まとめサイト名」と「配色」をJSON内で指定してください。（例：フルボッコ速報, 哲学ニュースnwk風など）

2.  **書き込み（レス）の作成:**
    *   **流れの構築:**
        *   **序盤:** >>1の報告と、住人たちの探り合い。
        *   **中盤:** 議論の紛糾、特定班の活躍、レスバトル、話の脱線。
        *   **終盤:** 意外なオチ、またはグダグダな解散。
    *   **日本語(jp):** リアルなネットスラング（草、ワイ、〜なんだが、ガチで）を多用してください。
    *   **英語(en):** 指定されたレベル「${englishLevel}」に合わせて翻訳してください。ただし、**ネットスラングのニュアンス（lol, lmao, troll, boomerなど）をうまく英語圏の文化に変換**してください。
    *   **解説(explanation):** キャラクターの口調で、英語の構文、文法、単語のニュアンス、または文化的背景について**詳細に（400文字程度）**解説してください。
    *   **【最重要】行数と改行の完全一致**:
        *   jpとenは、必ず「行数」と「改行位置」を一致させてください。

3. **関連記事（あわせて読みたい）の生成**
    *   クリックしたくなるような『架空の関連記事タイトル』を5つ生成してください。（必ず英語タイトル \`title_en\` も併記）

## 4. 出力形式（厳守！）
アプリで読み込みたいので、最終的に以下の**「データ形式（JSON）」**ひとつだけで出力してください。Markdownのコードブロック（\`\`\`json）で囲んでください。

\`\`\`json
{
  "title": "【悲報】などの煽り文句を入れたスレッドタイトル",
  "blog_title": "記事の内容に合わせた架空のブログ名",
  "theme_color": "#FF0000",
  "background_color": "#FFFFFF",
  "posts": [
    {
      "id": 1,
      "name": "風吹けば名無し",
      "date": "YYYY/MM/DD(Day) HH:MM:SS",
      "uid": "ID文字列",
      "jp": "日本語の書き込み（行数を意識して記述）",
      "en": "英語の翻訳（jpと同じ行数で、改行位置を合わせる）",
      "explanation": "詳細な解説...",
      "keywords": [
        {"word": "slang_word", "meaning": "単語の意味"}
      ],
      "anchor": null
    },
    ... (30〜50個程度)
  ],
  "related_threads": [
    {"title": "日本語タイトル", "title_en": "English Title", "url": "dummy"}
  ]
}
\`\`\`
`;
    }, [topic, personas, englishLevel, targetVocab]);

    const handleCopy = () => {
        navigator.clipboard.writeText(generatePrompt()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <PromptAccordion
            T={T}
            title="匿名掲示板メーカー（学習機能付き）"
            icon="💬"
            description="好きなテーマを匿名掲示板風の英語教材にします。"
        >
            <div className="space-y-4 mb-4">
                 <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>スレッドのテーマ</label>
                    <input 
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="例：今回の期末テストで留年が確定しそうwww"
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    />
                </div>

                <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>覚えたい英単語リスト (ターゲット)</label>
                    <textarea
                        value={targetVocab}
                        onChange={(e) => setTargetVocab(e.target.value)}
                        placeholder="例: procrastinate, inevitable, ephemeral (カンマや改行区切りで入力)"
                        rows={3}
                        className={`w-full p-2 text-sm ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring} resize-none`}
                    />
                    <p className={`text-xs ${T.textMuted} mt-1`}>※入力した単語が、生成されるスレッドの「英訳部分」に自然に紛れ込みます。</p>
                </div>
                
                <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>英語レベル</label>
                    <select
                        value={englishLevel}
                        onChange={(e) => setEnglishLevel(e.target.value)}
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    >
                        {levelOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                 
                <div className="space-y-3 border-t border-white/10 pt-4">
                    <div className="flex justify-between items-center">
                        <label className={`block text-sm font-medium ${T.textSecondary}`}>登場人物 (住人) <span className="text-xs font-normal opacity-70">※他はAIが自動召喚</span></label>
                         {personas.length < 5 && (
                            <button 
                                onClick={addPersona}
                                className={`flex items-center gap-1 px-2 py-1 text-xs ${T.accentBg} text-white rounded-full hover:brightness-110 transition`}
                            >
                                <PlusIcon className="w-3 h-3" /> 追加
                            </button>
                        )}
                    </div>
                    {personas.map((p) => (
                         <div key={p.id} className={`p-3 rounded-lg ${T.bg} border ${T.border} animate-fade-in relative`}>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                                <div className="sm:col-span-3">
                                     <label className={`block text-xs ${T.textMuted} mb-1`}>名前</label>
                                     <input 
                                        type="text" 
                                        value={p.name}
                                        onChange={(e) => updatePersona(p.id, 'name', e.target.value)}
                                        placeholder="名無しさん"
                                        className={`w-full p-1.5 text-sm ${T.button} ${T.textSecondary} rounded border ${T.border}`}
                                    />
                                </div>
                                <div className="sm:col-span-3">
                                    <div className="flex justify-between">
                                        <label className={`block text-xs ${T.textMuted} mb-1`}>役割</label>
                                        <button 
                                            onClick={() => randomizePersona(p.id)} 
                                            className={`text-[10px] flex items-center gap-0.5 text-pink-400 hover:text-pink-300 transition-colors`}
                                            title="役割と性格をランダムに設定"
                                        >
                                            <DiceIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <select 
                                        value={p.role} 
                                        onChange={(e) => updatePersona(p.id, 'role', e.target.value)}
                                        className={`w-full p-1.5 text-sm ${T.button} ${T.textSecondary} rounded border ${T.border}`}
                                    >
                                        {personaOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                                    </select>
                                </div>
                                <div className="sm:col-span-5">
                                    <label className={`block text-xs ${T.textMuted} mb-1`}>特徴</label>
                                    <select 
                                        value={p.trait} 
                                        onChange={(e) => updatePersona(p.id, 'trait', e.target.value)}
                                        className={`w-full p-1.5 text-sm ${T.button} ${T.textSecondary} rounded border ${T.border}`}
                                    >
                                        {personaTraitOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                                    </select>
                                </div>
                                <div className="sm:col-span-1 flex justify-end pb-1">
                                    {personas.length > 1 && (
                                        <button 
                                            onClick={() => removePersona(p.id)}
                                            className="text-red-400 hover:text-red-300 p-1"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2 mt-auto">
                <button onClick={handleCopy} className={`w-full px-3 py-2 text-sm ${T.buttonStrong} rounded-md font-semibold transition-colors`}>
                    {copied ? 'コピーしました！' : 'プロンプトをコピー'}
                </button>
                <a href={'https://aistudio.google.com/app/u/0/prompts/new_chat?model=gemini-3-pro-preview'} target="_blank" rel="noopener noreferrer" className={`w-full px-3 py-2 text-sm ${T.accentBg} ${T.accentBgHover} text-white text-center rounded-md font-semibold transition-colors`}>
                    AI Studioで作成
                </a>
            </div>
        </PromptAccordion>
    );
};

// --- English Explanation Card ---
const EnglishExplanationCard: React.FC<{ T: Theme }> = ({ T }) => {
    const [sourceText, setSourceText] = useState('');
    const [personaRole, setPersonaRole] = useState('熱血コーチ');
    const [personaTrait, setPersonaTrait] = useState('とにかく褒めてくれる（激甘モード）');
    const [copied, setCopied] = useState(false);

    const personaOptions = [
        '熱血コーチ', 'ギャル', '大学生', '小学生', '部長', '主婦', '浪人生', '政治家', 'インフルエンサー', 'バンドマン', 
        'ミステリー小説の探偵', 'おじいちゃん', 'おばあちゃん', '中学生', '司書', '経営者', 'オカルト好き', 
        '異世界から来た騎士', '歴史上の人物', '就活中の大学生', 'アイドルオタク', 'スピリチュアルカウンセラー', 
        'ゲーム実況者', '漫画家', '高校教師', '美容師', '新米ママ', '花屋の店主', '帰国子女', 'トラック運転手'
    ];
    
    const personaTraitOptions = [
        'とにかく褒めてくれる（激甘）', 
        '口がものすごく悪い', 'ものすごく真面目', '極端にOCD気味', '極端に不安性', '完全なるポジティブ', 
        '異常に怒りっぽい', '徹底的に論理的', 'ひねくれすぎな皮肉屋', '過剰に詩的', '異常なまでに好奇心旺盛', 
        'お節介すぎるほど世話好き', '度が過ぎるナルシスト', '極限まで怠惰', '底抜けに天真爛漫', '何でも懐疑的', 
        '小難しく考えすぎるほど哲学的', '病的なまでに結論を急かす', '異常なほど共感を求める', 
        '狂信的なデータ至上主義', '突拍子もない陰謀論を信じがち', 'ありえないほど話を盛る', 
        '聞いている方が心配になるほど自虐的', 'マニュアル原理主義', '無理やりすぎる例え話', 
        'わざとらしいほどカタコトの外国人風', '五・七・五で詠みがち', '尋常じゃないくらい擬音語・擬態語を多用', 
        '秒で話を脱線させる', '森羅万象をランキング付けする', '息をするように過去の武勇伝を語りがち', 
        '空気も凍るダジャレを挟む', '偏見まみれの決めつけが激しい', 'クセが強すぎる相槌', '恐縮しすぎなくらい過剰に丁寧'
    ];

    const randomize = () => {
        const rRole = personaOptions[Math.floor(Math.random() * personaOptions.length)];
        const rTrait = personaTraitOptions[Math.floor(Math.random() * personaTraitOptions.length)];
        setPersonaRole(rRole);
        setPersonaTrait(rTrait);
    };

    const generatePrompt = useCallback(() => {
        let personaInstruction = "";
        if (personaTrait === 'とにかく褒めてくれる（激甘モード）') {
            personaInstruction = `**とにかくユーザーを褒めちぎってください**。「天才か？」「素晴らしいぞ！」と全肯定してください。`;
        } else {
            personaInstruction = `**「${personaTrait}」という性格設定を極端に反映させ、その口調で容赦なくコメントしてください。**`;
        }

        return `命令書
あなたはプロの英語講師であり、個性的で魅力的なキャラクターになりきって解説を行うエンターテイナーです。
私が提供する【入力英文】を教材として、以下の形式で解説コンテンツを作成してください。

## 1. 解説キャラクター設定
名前: （この役割と性格にふさわしい日本の名前を命名）
役割: ${personaRole}
性格: ${personaTrait}
${personaInstruction}

## 2. 入力英文
"""
${sourceText || '（ここに英文を入力してください）'}
"""

## 3. 出力形式（厳守！）
以下のMarkdownコードブロックの形式のみを出力してください。冒頭の挨拶や余計な説明は不要です。
**重要: 名前を出力する際は、「命名した」や「名前」などの接頭辞や説明文を絶対に付けず、名前そのもの（例: [自動命名]）のみを出力してください。**

\`\`\`markdown
【解説担当】
名前: （AIが決めた名前）
役割: ${personaRole}
性格: ${personaTrait}
（ここからキャラの自己紹介と意気込みを一言）

[英文の第1文]
[その日本語訳]
（AIが決めた名前）: （第1文の文法構造、単語、ニュアンスについての詳細な解説。キャラの口調で。）

[英文の第2文]
[その日本語訳]
（AIが決めた名前）: （第2文の解説...）

...（全ての文について繰り返す）

----------

（以下、「単語のまとめ方」に従った単語リスト）

----------
（この英文に関連する背景知識や雑学を400文字程度で記述）
\`\`\`

## 解説のポイント
*   英文の構造（S+V+Oなど）を分かりやすく説明すること。
*   単語のニュアンスや語源にも触れること。
*   **重要:** キャラクターの個性を全開にし、読んでいて飽きない楽しい解説にすること。

## 単語リスト生成ルール
${mnemonicRules}
`;
    }, [sourceText, personaRole, personaTrait]);

    const handleCopy = () => {
        navigator.clipboard.writeText(generatePrompt()).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <PromptAccordion 
            T={T} 
            title="英文解説 (リーダー対応)" 
            icon="📖"
            borderColor="border-indigo-500/30"
            description="手持ちの英文を貼り付けて、キャラに解説させるプロンプトを作成します。"
        >
            <div className="space-y-4 mb-4">
                 <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>解説させたい英文</label>
                    <textarea 
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        placeholder="例：The quick brown fox jumps over the lazy dog..."
                        rows={6}
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring} font-mono text-sm`}
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-2 relative">
                    <button 
                        onClick={randomize}
                        className={`absolute -top-7 right-0 text-xs flex items-center gap-1 px-2 py-1 rounded-md ${T.button} hover:text-indigo-400 transition-colors`}
                        title="役割と性格をランダムに設定"
                    >
                        <DiceIcon className="w-3 h-3" />
                        ランダム
                    </button>
                    <div>
                        <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>役割 (キャラ名)</label>
                        <select
                            value={personaRole}
                            onChange={(e) => setPersonaRole(e.target.value)}
                            className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                        >
                            {personaOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>性格・特徴</label>
                        <select
                            value={personaTrait}
                            onChange={(e) => setPersonaTrait(e.target.value)}
                            className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                        >
                            {personaTraitOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 mt-auto pt-4 border-t border-white/10">
                <button onClick={handleCopy} className={`flex-1 px-3 py-2 text-sm ${T.buttonStrong} rounded-md font-semibold transition-colors`}>
                    {copied ? 'コピー完了！' : 'プロンプトをコピー'}
                </button>
                <a href={'https://aistudio.google.com/app/u/0/prompts/new_chat?model=gemini-3-pro-preview'} target="_blank" rel="noopener noreferrer" className={`flex-1 px-3 py-2 text-sm ${T.accentBg} ${T.accentBgHover} text-white text-center rounded-md font-semibold transition-colors`}>
                    AI Studioで作成
                </a>
            </div>
        </PromptAccordion>
    );
};

const CustomPromptCard: React.FC<{ T: Theme; onNavigateToPasteJSON?: (personas: PromptPersonaSelection[]) => void }> = ({ T, onNavigateToPasteJSON }) => {
    const [topic, setTopic] = useState('');
    const [exampleKeyword, setExampleKeyword] = useState('');
    const [level, setLevel] = useState('日本の「英検準1級」レベル');
    const [length, setLength] = useState('400');
    const [depth, setDepth] = useState(3);
    const [paragraphs, setParagraphs] = useState(4);
    const [copied, setCopied] = useState(false);
    const [explanationLevel, setExplanationLevel] = useState(3);
    
    const [personas, setPersonas] = useState([
        { id: 1, name: '', role: 'ギャル', trait: '口がものすごく悪い' }
    ]);

    const levelOptions = {
        '日本の「英検1級」レベル': '英検1級',
        '日本の「英検準1級」レベル': '英検準1級',
        '日本の「英検2級」レベル': '英検2級',
        '日本の「英検準2級」レベル': '英検準2級',
        '日本の「英検3級」レベル': '英検3級',
        '日本の「大学入学共通テスト英語」で高得点を狙えるレベル': '共通テスト',
    };

    const lengthOptions = {
        '200': '短め (約200語)',
        '400': '普通 (約400語)',
        '600': '長め (約600語)',
    };
    
    const personaOptions = OFFICIAL_PERSONA_OPTIONS;
    
    const personaTraitOptions = [
        '口がものすごく悪い', 'ものすごく真面目', '極端にOCD気味', '極端に不安性', '完全なるポジティブ', 
        '異常に怒りっぽい', '徹底的に論理的', 'ひねくれすぎな皮肉屋', '過剰に詩的', '異常なまでに好奇心旺盛', 
        'お節介すぎるほど世話好き', '度が過ぎるナルシスト', '極限まで怠惰', '底抜けに天真爛漫', '何でも懐疑的', 
        '小難しく考えすぎるほど哲学的', '病的なまでに結論を急かす', '異常なほど共感を求める', 
        '狂信的なデータ至上主義', '突拍子もない陰謀論を信じがち', 'ありえないほど話を盛り気味', 
        '聞いている方が心配になるほど自虐的', 'マニュアル原理主義', '無理やりすぎる例え話が好き', 
        'わざとらしいほどカタコトの外国人風', 'ことあるごとに五・七・五で詠みがち', '尋常じゃないくらい擬音語・擬態語を多用', 
        '秒で話を脱線させる', '森羅万象をランキング付けする', '息をするように過去の武勇伝を語りがち', 
        '空気も凍るダジャレを挟む', '偏見まみれの決めつけが激しい', 'クセが強すぎる相槌', '恐縮しすぎなくらい過剰に丁寧'
    ];

    const depthDescriptions: { [key: number]: string } = {
        1: '簡潔で分かりやすい概要を記述してください。',
        2: 'いくつかの興味深い詳細や事実を含めてください。',
        3: '具体的な例を交えながら、バランスの取れた分析を行ってください。',
        4: '知識豊富なファンが興味を持つような、ニッチな情報を含む詳細な分析を提供してください。',
        5: '非常にマニアックな事実、秘話、鋭い批判的考察を含めてください。',
    };
    
    const addPersona = () => {
        if (personas.length < 3) {
            setPersonas([...personas, { id: Date.now(), name: '', role: 'ギャル', trait: '口がものすごく悪い' }]);
        }
    };

    const removePersona = (id: number) => {
        if (personas.length > 1) {
            setPersonas(personas.filter(p => p.id !== id));
        }
    };

    const updatePersona = (id: number, field: 'name' | 'role' | 'trait', value: string) => {
        setPersonas(personas.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const randomizePersona = (id: number) => {
        const randomRole = personaOptions[Math.floor(Math.random() * personaOptions.length)];
        const randomTrait = personaTraitOptions[Math.floor(Math.random() * personaTraitOptions.length)];
        setPersonas(personas.map(p => p.id === id ? { ...p, role: randomRole, trait: randomTrait } : p));
    };

    const generatePrompt = useCallback(() => {
        const premiseDescriptions: { [key: number]: string } = {
            1: '読者はトピックについてほとんど知識がありません。',
            2: '読者はトピックについて基本的な情報を知っています。',
            3: '読者はトピックについてある程度の知識を持っています。',
            4: '読者はトピックの熱心なファンで、深い知識があります。',
            5: '読者は専門家レベルの知識を持っています。',
        };
        
        const personaDescriptions = personas.map((p, index) => 
            `${index + 1}. 名前: ${p.name ? p.name : '（この役割と性格にふさわしい日本の名前（下の名前やあだ名）をランダムに命名してください）'}\n   役割: ${p.role}\n   性格: ${p.trait}`
        ).join('\n');

        const personaInstructions = personas.map(p => 
            `・${p.name || '命名した名前'} (${p.role}) の発言: ${p.trait}という特徴を色濃く反映させた口調で、鋭い指摘やユニークな感想を述べること。`
        ).join('\n');
        
        const outputFormatExample = personas.map(p => 
            `[解説] ${p.name || '（AIが決めた名前）'}（${p.role}）: [${p.trait}な${p.role}としてのコメント]`
        ).join('\n');

        const examplePersonaProfile = personas.map(p => 
`名前: ${p.name || '（AIが決めた名前）'}
役割: ${p.role}
性格: ${p.trait}
（ここからキャラの自己紹介と意気込みを一言）`
        ).join('\n\n');

        const levelInstruction = 
            explanationLevel === 1 ? "【レベル1：解説量 10%】（ほぼリアクションのみ）\n英語の構文や文法の解説は最小限（全体の1割程度）に留め、キャラクターの感情的なリアクションや感想、ツッコミをメイン（9割）にしてください。" :
            explanationLevel === 2 ? "【レベル2：解説量 30%】（ワンポイント指摘）\n重要な単語や構文をワンポイントで指摘する程度に留め、残りはキャラクター同士の会話やリアクションに充ててください。" :
            explanationLevel === 3 ? "【レベル3：解説量 50%】（標準的な構造説明）\n標準的な文法構造（S+VOCなど）の解説と、キャラクターの会話・リアクションを半々のバランスで行ってください。" :
            "【レベル4：解説量 70%】（詳細な文法分解）\n文法用語（形式主語、関係代名詞、同格など）を多用し、構造を詳細に分解・解説することをメインにしてください。リアクションは控えめにし、知的な分析を重視してください。";

        // パーソナル設定の取得と反映
        const usePersonalSettings = localStorage.getItem('use_personal_settings') !== 'false';
        const inspirationSeed = localStorage.getItem('inspiration_seed') || '';
        const angerSeed = localStorage.getItem('anger_seed') || '';

        let personalInstructions = '';
        if (usePersonalSettings) {
            if (inspirationSeed.trim()) {
                personalInstructions += `\n【重要：ひらめきの種（パーソナライズ指示）】\nユーザーの好きなことや近況として以下の情報があります。作成する英語長文の内容や、キャラクターたちの解説、例文の中に、これらの要素を散りばめるか、またはこれらにマニアックに言及してください：\n${inspirationSeed}\n`;
            }
            if (angerSeed.trim()) {
                personalInstructions += `\n【重要：怒りの種（毒舌・皮肉指示）】\nユーザーの嫌いなことや絶対に許せないこととして以下の情報があります。キャラクターたちが英文の解説やツッコミを行う際、以下の内容についてユーモアを交えた強烈な皮肉や毒舌、憤りとして散りばめてください：\n${angerSeed}\n`;
            }
        }

        const prompt = `命令書${personalInstructions ? '\nまた、以下のパーソナライズ指示に絶対に従ってください：' + personalInstructions : ''}
あなたは、英語文章を作成する際は「${topic || '日本のラーメン文化'}」についてユーザーの理解に合わせたレベルでその内容について書いてください。一方で、文章の解説を行う際は、後述するキャラクターたちになりきって、掛け合い形式で解説を行ってください。

以下の形式はMEMORA Sentencesへそのまま貼り付けて解析するためのアプリ用データです。
完成した英文全文を別の場所へ先に出力したり、同じ英文を二重に出力したりしないでください。
Markdownのコードフェンス（\`\`\`markdown、\`\`\`text、\`\`\`json等）も付けないでください。
最終回答は、以下に指定する1つのデータブロックだけを出力してください。

【出力形式】

【解説担当】
${examplePersonaProfile}

[英語の原文一文]
[その日本語訳一文]
${outputFormatExample}

[次の英語の原文一文]
[その日本語訳一文]
${outputFormatExample}

（同じセットを全文の文数だけ繰り返す）

----------
[
  {
    "front": "ramen",
    "back": "ラーメン、中華麺",
    "pronunciation": "[ラ]ーメン",
    "memo": "【語源・雑学】語源・関連語・雑学をここに記述。\\n【覚え方】覚えやすい語呂やイメージをここに記述。\\n【例文】英単語を使った面白い英語例文をここに記述。"
  }
]
----------
[背景知識を日本語で約400文字]

【最重要：対訳・解説のルール】
・英語は必ず一文ずつ出力し、その直後にその一文だけの自然な日本語訳を置いてください。
・各解説コメントは必ず「[解説] 名前（役割）: コメント」の1行形式で開始してください。
・各[解説]行の「名前」と「役割」は、【解説担当】プロフィール内の同じ人物の表記と一字一句同じにしてください。
・複数の解説担当がいる場合、同じ英文の日本語訳の直後に担当者ごとの[解説]行を連続して置いてください。
・コメントには文法構造（主語S・動詞Vなどを実際の英単語と共に示す）、重要語句、内容の要約、関連雑学を、設定された解説量に応じて入れてください。
・キャラクターの口調と個性を反映しつつ、解説として意味が通る内容にしてください。
・「命名した」「名前:」など、人物名そのものではない余計な接頭辞を人物名に付けないでください。

【最重要：単語JSONのルール】
・単語リスト部分だけを、有効なJSON配列として30語出力してください。長文全体をJSONにしないでください。
・各要素で使用できるキーは "front", "back", "pronunciation", "memo" の4つだけです。
・front: 英単語のみ。絵文字、発音、品詞記号などを混ぜないでください。
・back: 日本語の主な意味を2〜3個。
・pronunciation: 一般的なカタカナ発音。最も強く読む部分を半角の[ ]で囲んでください（例: ネ[ゴ]シエイト）。
・memo: 「【語源・雑学】」「【覚え方】」「【例文】」の3見出しをこの順で1つの文字列に入れてください。改行はJSON文字列内の \\n で表現してください。
・JSON内ではダブルクォートを使用し、末尾カンマ、コメント、Markdown、JSON前後の説明文を入れないでください。
・【語源・雑学】では語源、同語源の関連語、文化・歴史・科学などの面白い雑学を含めてください。
・【覚え方】は以下のルールに従って、音と意味が結びつく印象的な覚え方を作ってください。
${mnemonicRules}
・【例文】では対象単語を必ず使い、ユニークで少し笑える自然な英語例文を作ってください。ユーザー情報「${exampleKeyword || '指定なし'}」がある場合は、3回に1回程度の自然な頻度でパーソナライズしてください。

【背景知識】
単語JSONの後に「----------」だけの行を1行置き、この英語長文の内容に関する背景知識・関連情報・うんちく・雑学を日本語で約400文字記述してください。Markdownの強調記法は使わずプレーンテキストにしてください。

絶対的制約条件
読者層と前提
読者: そのトピックに興味を持つ人。
前提知識: ${premiseDescriptions[depth as keyof typeof premiseDescriptions]}
内容と分析の方向性
内容の深さ: ${depthDescriptions[depth]}
構成と文章量
段落数: ${paragraphs}段落
文章の長さ: 約${length}語
言語と表現
言語: 英語。
英語レベル: ${level}※必ずその英検レベルの難易度を守ること。特に単語を難しくしすぎないこと。

解説キャラクター設定:
${personaDescriptions}

解説の指示:
${personaInstructions}

解説の英語量指示:
${levelInstruction}

思考プロセスと禁止事項
思考法: 常に水平思考（Lateral Thinking）を意識し、既成概念にとらわれない独創的で多角的な視点からアプローチしてください。
ハルシネーションの禁止: 生成する内容は、広く認められている解釈を元に構築してください。
以上の全ての条件を満たし、MEMORA Sentencesへそのまま貼り付けられるデータだけを出力してください。
※Always think harder, deeper, longer and more careful for the best quality!`;
        return prompt;
    }, [topic, level, length, depth, paragraphs, exampleKeyword, personas, explanationLevel]);

    const handleCopy = () => {
        const promptText = generatePrompt();
        navigator.clipboard.writeText(promptText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <PromptAccordion
            T={T}
            title="好きな内容の長文"
            icon="📝"
            description="あなたの興味に合わせた長文を作成し、ペルソナが解説します。"
        >
            <div className="space-y-4 my-4">
                {/* ... (Existing form inputs) ... */}
                <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>テーマ</label>
                    <input 
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="日本のラーメン文化"
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    />
                </div>
                <div>
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>例文キーワード</label>
                    <input 
                        type="text"
                        value={exampleKeyword}
                        onChange={(e) => setExampleKeyword(e.target.value)}
                        placeholder="（任意）例文に含めたい個人的な情報（趣味、目標など）"
                        className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-8 gap-4">
                    <div className="lg:col-span-2">
                        <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>英語レベル</label>
                        <select value={level} onChange={(e) => setLevel(e.target.value)} className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}>
                            {Object.entries(levelOptions).map(([value, name]) => (<option key={value} value={value}>{name}</option>))}
                        </select>
                    </div>
                     <div className="lg:col-span-2">
                        <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>文量</label>
                        <select value={length} onChange={(e) => setLength(e.target.value)} className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}>
                           {Object.entries(lengthOptions).map(([value, name]) => (<option key={value} value={value}>{name}</option>))}
                        </select>
                    </div>
                    <div className="lg:col-span-2">
                        <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>深さ</label>
                        <select value={depth} onChange={(e) => setDepth(Number(e.target.value))} className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}>
                            {[1, 2, 3, 4, 5].map(d => (<option key={d} value={d}>レベル {d}</option>))}
                        </select>
                    </div>
                    <div className="lg:col-span-2">
                        <label className={`block text-sm font-medium ${T.textSecondary} mb-1`}>段落</label>
                        <select value={paragraphs} onChange={(e) => setParagraphs(Number(e.target.value))} className={`w-full p-2 ${T.button} ${T.textSecondary} rounded-md border ${T.border} focus:outline-none focus:ring-2 ${T.ring}`}>
                            {Array.from({ length: 8 }, (_, i) => i + 1).map(p => (<option key={p} value={p}>{p}段落</option>))}
                        </select>
                    </div>
                </div>

                {/* Multi Persona Section */}
                <div className="space-y-3 border-t border-white/10 pt-4">
                    <div className="flex justify-between items-center">
                        <label className={`block text-sm font-medium ${T.textSecondary}`}>解説ペルソナ (最大3人)</label>
                         {personas.length < 3 && (
                            <button 
                                onClick={addPersona}
                                className={`flex items-center gap-1 px-2 py-1 text-xs ${T.accentBg} text-white rounded-full hover:brightness-110 transition`}
                            >
                                <PlusIcon className="w-3 h-3" /> 追加
                            </button>
                        )}
                    </div>
                    
                    {personas.map((p, index) => (
                        <div key={p.id} className={`p-3 rounded-lg ${T.bg} border ${T.border} animate-fade-in relative`}>
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                                <div className="sm:col-span-3">
                                     <label className={`block text-xs ${T.textMuted} mb-1`}>名前</label>
                                     <input 
                                        type="text" 
                                        value={p.name}
                                        onChange={(e) => updatePersona(p.id, 'name', e.target.value)}
                                        placeholder={`（空欄で自動命名）`}
                                        className={`w-full p-1.5 text-sm ${T.button} ${T.textSecondary} rounded border ${T.border}`}
                                    />
                                </div>
                                <div className="sm:col-span-3">
                                    <div className="flex justify-between">
                                        <label className={`block text-xs ${T.textMuted} mb-1`}>役割</label>
                                        <button 
                                            onClick={() => randomizePersona(p.id)} 
                                            className={`text-[10px] flex items-center gap-0.5 text-pink-400 hover:text-pink-300 transition-colors`}
                                            title="役割と性格をランダムに設定"
                                        >
                                            <DiceIcon className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <select 
                                        value={p.role} 
                                        onChange={(e) => updatePersona(p.id, 'role', e.target.value)}
                                        className={`w-full p-1.5 text-sm ${T.button} ${T.textSecondary} rounded border ${T.border}`}
                                    >
                                        {personaOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                                    </select>
                                </div>
                                <div className="sm:col-span-5">
                                    <label className={`block text-xs ${T.textMuted} mb-1`}>特徴</label>
                                    <select 
                                        value={p.trait} 
                                        onChange={(e) => updatePersona(p.id, 'trait', e.target.value)}
                                        className={`w-full p-1.5 text-sm ${T.button} ${T.textSecondary} rounded border ${T.border}`}
                                    >
                                        {personaTraitOptions.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                                    </select>
                                </div>
                                <div className="sm:col-span-1 flex justify-end pb-1">
                                    {personas.length > 1 && (
                                        <button 
                                            onClick={() => removePersona(p.id)}
                                            className="text-red-400 hover:text-red-300 p-1"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* Explanation Level Slider */}
                <div className="mt-4 border-t border-white/10 pt-4">
                    <label className={`block text-sm font-medium ${T.textSecondary} mb-2`}>
                        解説の割合 (キャラクターのリアクション vs 文法解説)
                    </label>
                    <div className="relative pt-1">
                        <input 
                            type="range" 
                            min="1" 
                            max="4" 
                            step="1" 
                            value={explanationLevel} 
                            onChange={(e) => setExplanationLevel(Number(e.target.value))}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>リアクション重視</span>
                            <span>バランス</span>
                            <span>文法重視</span>
                        </div>
                        <div className="text-center mt-2 text-sky-400 text-sm font-bold animate-fade-in">
                            {explanationLevel === 1 && "レベル1: ほぼ雑談・リアクション (文法1割)"}
                            {explanationLevel === 2 && "レベル2: ワンポイント解説 (文法3割)"}
                            {explanationLevel === 3 && "レベル3: 標準的な解説 (文法5割)"}
                            {explanationLevel === 4 && "レベル4: ガチ解説・文法用語多め (文法7割)"}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-auto border-t border-white/10 pt-4">
                <button onClick={handleCopy} className={`flex-1 px-3 py-2 text-sm ${T.buttonStrong} rounded-md font-semibold transition-colors`}>
                    {copied ? 'コピーしました！' : 'プロンプトをコピー'}
                </button>
                <button 
                    onClick={() => {
                        handleCopy();
                        window.open('https://aistudio.google.com/app/u/0/prompts/new_chat?model=gemini-3-pro-preview', '_blank', 'noopener,noreferrer');
                    }}
                    className={`flex-1 px-3 py-2 text-sm ${T.accentBg} ${T.accentBgHover} text-white text-center rounded-md font-semibold transition-colors`}
                >
                    AI Studioで作成
                </button>
                {onNavigateToPasteJSON && (
                    <button
                        onClick={() => onNavigateToPasteJSON(personas.map(({ name, role, trait }) => ({ name, role, trait })))}
                        className={`flex-1 px-3 py-2 text-sm bg-green-600 hover:bg-green-500 text-white text-center rounded-md font-semibold transition-colors`}
                        title="選択した解説キャラ情報と一緒に生成データを貼り付けます"
                    >
                        JSONを貼る
                    </button>
                )}
            </div>
        </PromptAccordion>
    );
};

export const PromptLibraryScreen: React.FC<PromptLibraryScreenProps> = ({ onBack, T, onNavigateToPasteJSON }) => {
  return (
    <div className={`min-h-screen ${T.bg} flex flex-col font-sans`}>
      {/* Header */}
      <header className={`flex-shrink-0 flex items-center justify-between p-3 ${T.containerBg} shadow-md z-10 border-b ${T.border}`}>
        <button onClick={onBack} className={`flex items-center gap-2 px-3 py-2 text-sm ${T.button} rounded-md transition-colors`}>
          &larr; 戻る
        </button>
        <h1 className={`text-xl font-bold ${T.textPrimary}`}>教材をつくる</h1>
        <div className="w-16"></div>
      </header>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
            
            <div>
                <div className="mb-4 border-b border-gray-700 pb-3 flex items-end justify-between gap-3">
                    <div>
                        <h2 className={`text-xl font-bold ${T.textPrimary}`}>
                            作成モードを選ぶ
                        </h2>
                        <p className={`mt-1 text-sm ${T.textMuted}`}>
                            長文教材か、匿名掲示板風教材のどちらかを選んでください。
                        </p>
                    </div>
                    <img
                        src="/memora-world/explore-v1.webp"
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-lg select-none pointer-events-none"
                    />
                </div>
                <div className="grid gap-4">
                    <CustomPromptCard T={T} onNavigateToPasteJSON={onNavigateToPasteJSON} />
                    <BoardPromptCard T={T} />
                </div>
            </div>

        </div>
      </main>
    </div>
  );
};
