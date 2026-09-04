import React, { useCallback, useMemo, useState } from 'react';
import type { PromptPersonaSelection } from './PromptLibraryScreen';
import {
  buildReadingPrompt,
  getReaderCompatibleRole,
  KNOWLEDGE_DEPTH_OPTIONS,
  type KnowledgeDepth,
} from '../lib/readingPrompt';
import '../create-home.css';
import '../create-depth.css';

interface CreateHomeScreenProps {
  onOpenLibrary: () => void;
  onOpenJapaneseReader: () => void;
  onOpenOtherModes: () => void;
  onNavigateToPasteJSON: (personas: PromptPersonaSelection[]) => void;
}

const AI_STUDIO_URL = 'https://aistudio.google.com/app/u/0/prompts/new_chat?model=gemini-3-pro-preview';

const levelOptions = {
  '日本の「英検1級」レベル': '英検1級',
  '日本の「英検準1級」レベル': '英検準1級',
  '日本の「英検2級」レベル': '英検2級',
  '日本の「英検準2級」レベル': '英検準2級',
  '日本の「英検3級」レベル': '英検3級',
  '日本の「大学入学共通テスト英語」で高得点を狙えるレベル': '共通テスト',
};

const lengthOptions = {
  '200': '約200語',
  '400': '約400語',
  '600': '約600語',
};

const roleOptions = [
  'やさしく導く先生',
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

const traitOptions = [
  'やさしくて、まなびを楽しませてくれる！',
  'とにかく褒めてくれる',
  'ものすごく真面目',
  '完全なるポジティブ',
  '徹底的に論理的',
  '異常なまでに好奇心旺盛',
  'お節介すぎるほど世話好き',
  'ひねくれすぎな皮肉屋',
  '口がものすごく悪い',
  '過剰に詩的',
  '無理やりすぎる例え話が好き',
  '空気も凍るダジャレを挟む',
];

const BookIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" />
  </svg>
);

const FeatherIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.5 3.5c-5.8-.4-10.8 1.7-13.7 5.8-1.7 2.4-2.2 5.1-1.8 7.9 2.7.4 5.5-.1 7.9-1.8 4.1-2.9 6.2-7.9 5.8-13.7l1.8 1.8Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20c4.4-4.5 8.5-8.1 12.6-11.1" />
  </svg>
);

const ClipboardIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5.5h6M9.5 3h5a1 1 0 0 1 1 1v3h-7V4a1 1 0 0 1 1-1Z" />
    <rect x="5" y="5.5" width="14" height="15.5" rx="2.5" />
    <path strokeLinecap="round" d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" />
  </svg>
);

const ImportIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 14v4.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V14" />
  </svg>
);

const WandIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="m4 20 10.5-10.5M13 5l1-2 1 2 2 1-2 1-1 2-1-2-2-1 2-1ZM18 12l.8-1.6.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 17.5 3 3" />
  </svg>
);

const CreateHomeScreen: React.FC<CreateHomeScreenProps> = ({
  onOpenLibrary,
  onOpenJapaneseReader,
  onOpenOtherModes,
  onNavigateToPasteJSON,
}) => {
  const [topic, setTopic] = useState('');
  const [exampleKeyword, setExampleKeyword] = useState('');
  const [level, setLevel] = useState('日本の「英検準1級」レベル');
  const [knowledgeDepth, setKnowledgeDepth] = useState<KnowledgeDepth>('familiar');
  const [length, setLength] = useState('400');
  const [role, setRole] = useState('やさしく導く先生');
  const [trait, setTrait] = useState('やさしくて、まなびを楽しませてくれる！');
  const [copied, setCopied] = useState(false);

  const personalSettingsEnabled = useMemo(
    () => typeof window === 'undefined' || localStorage.getItem('use_personal_settings') !== 'false',
    [],
  );

  const generatePrompt = useCallback(() => {
    const usePersonalSettings = localStorage.getItem('use_personal_settings') !== 'false';
    return buildReadingPrompt({
      topic,
      additionalRequest: exampleKeyword,
      level,
      knowledgeDepth,
      length,
      role,
      trait,
      inspirationSeed: usePersonalSettings ? localStorage.getItem('inspiration_seed') || '' : '',
      angerSeed: usePersonalSettings ? localStorage.getItem('anger_seed') || '' : '',
    });
  }, [topic, exampleKeyword, level, knowledgeDepth, length, role, trait]);

  const copyPrompt = useCallback(async () => {
    const text = generatePrompt();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [generatePrompt]);

  const handleOpenAiStudio = useCallback(async () => {
    await copyPrompt();
    window.open(AI_STUDIO_URL, '_blank', 'noopener,noreferrer');
  }, [copyPrompt]);

  const selectedPersona: PromptPersonaSelection = useMemo(
    () => ({ name: '', role: getReaderCompatibleRole(role), trait }),
    [role, trait],
  );

  return (
    <main className="create-home" data-testid="create-home">
      <div className="create-home__ambient create-home__ambient--one" aria-hidden="true" />
      <div className="create-home__ambient create-home__ambient--two" aria-hidden="true" />
      <div className="create-home__content">
        <section className="create-home__hero" aria-labelledby="create-home-title">
          <img
            className="create-home__hero-art"
            src="/memora-world/create-v1.webp"
            alt=""
            aria-hidden="true"
            draggable={false}
            loading="eager"
            decoding="async"
          />

          <button type="button" className="create-home__library-button" onClick={onOpenLibrary}>
            <BookIcon />
            <span>教材一覧</span>
          </button>

          <div className="create-home__hero-copy">
            <div className="create-home__brand-lockup">
              <h1 id="create-home-title" aria-label="リードン READON">
                <span className="create-home__brand-reading">リードン</span>
                <span className="create-home__brand-name">READON</span>
              </h1>
              <p className="create-home__brand-tagline">好きからつくる、英語長文。</p>
            </div>
            <p className="create-home__hero-description">
              <span>好きなテーマで</span>
              <span>自分だけの</span>
              <span><strong>英語教材</strong>を作ろう！</span>
            </p>
          </div>
        </section>

        <button
          type="button"
          className="create-home__japanese-button"
          onClick={onOpenJapaneseReader}
          data-testid="open-japanese-reader"
        >
          <span className="create-home__japanese-mark" aria-hidden="true">あ</span>
          <span>
            <strong>日本語 Reader Mode</strong>
            <small>好きな日本語を、今の自分に読める日本語へ。</small>
          </span>
          <span className="create-home__japanese-chevron" aria-hidden="true">›</span>
        </button>

        <section className="create-home__glass-card create-home__topic-card" aria-label="長文の内容">
          <label className="create-home__field">
            <span className="create-home__field-label"><span aria-hidden="true">★</span> テーマ</span>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="例：日本のラーメン文化"
              data-testid="create-topic"
            />
          </label>

          <label className="create-home__field create-home__field--keyword">
            <span className="create-home__field-label"><FeatherIcon /> 入れたいこと <small>（任意）</small></span>
            <input
              value={exampleKeyword}
              onChange={(event) => setExampleKeyword(event.target.value)}
              placeholder="内容・使いたい単語・伝えたいポイントなど"
              data-testid="create-keyword"
            />
          </label>
        </section>

        <section className="create-home__choice-grid" aria-label="教材の英語レベル、テーマへの詳しさ、長さ">
          <label className="create-home__glass-card create-home__choice-card create-home__choice-card--level">
            <span className="create-home__choice-title"><span aria-hidden="true">✦</span> 英語レベル</span>
            <div className="create-home__select-wrap">
              <BookIcon />
              <select value={level} onChange={(event) => setLevel(event.target.value)} data-testid="create-level">
                {Object.entries(levelOptions).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <small>長文の難易度を選びます</small>
          </label>

          <label className="create-home__glass-card create-home__choice-card create-home__choice-card--knowledge">
            <span className="create-home__choice-title"><span aria-hidden="true">✦</span> テーマへの詳しさ</span>
            <div className="create-home__select-wrap">
              <BookIcon />
              <select
                value={knowledgeDepth}
                onChange={(event) => setKnowledgeDepth(event.target.value as KnowledgeDepth)}
                data-testid="create-depth"
              >
                {KNOWLEDGE_DEPTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <small>背景知識・マニアック度を選びます</small>
          </label>

          <label className="create-home__glass-card create-home__choice-card create-home__choice-card--length">
            <span className="create-home__choice-title"><span aria-hidden="true">★</span> 長文の長さ</span>
            <div className="create-home__select-wrap">
              <FeatherIcon />
              <select value={length} onChange={(event) => setLength(event.target.value)} data-testid="create-length">
                {Object.entries(lengthOptions).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <small>おおよその単語数を選びます</small>
          </label>
        </section>

        <section className="create-home__glass-card create-home__persona-card" aria-labelledby="persona-heading">
          <div className="create-home__persona-heading-row">
            <h2 id="persona-heading"><span aria-hidden="true">✦</span> 解説キャラ</h2>
            <span className="create-home__persona-sparkles" aria-hidden="true">★ · ✧ · ★</span>
          </div>

          <div className="create-home__persona-summary">
            <div className="create-home__persona-copy">
              <p><span className="create-home__pill">役割</span> {role}</p>
              <p><span className="create-home__pill create-home__pill--star">性格</span> {trait}</p>
            </div>
          </div>

          <div className="create-home__persona-controls">
            <label>
              <span>役割</span>
              <select value={role} onChange={(event) => setRole(event.target.value)} data-testid="create-role">
                {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label>
              <span>性格</span>
              <select value={trait} onChange={(event) => setTrait(event.target.value)} data-testid="create-trait">
                {traitOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="create-home__actions" aria-label="教材作成アクション">
          <button type="button" className="create-home__action create-home__action--primary" onClick={handleOpenAiStudio} data-testid="create-open-ai-studio">
            <span className="create-home__action-icon"><WandIcon /></span>
            <span className="create-home__action-copy"><strong>AI Studioで教材をつくる</strong><small>作成用の指示をコピーしてAI Studioを開きます</small></span>
            <span className="create-home__chevron" aria-hidden="true">›</span>
          </button>

          <button
            type="button"
            className="create-home__action create-home__action--import"
            onClick={() => onNavigateToPasteJSON([selectedPersona])}
            data-testid="create-import"
          >
            <span className="create-home__action-icon"><ImportIcon /></span>
            <span className="create-home__action-copy"><strong>できた教材を取り込む</strong><small>AI Studioで作った結果を貼り付けます</small></span>
            <span className="create-home__chevron" aria-hidden="true">›</span>
          </button>

          <button type="button" className="create-home__action create-home__action--copy" onClick={copyPrompt} data-testid="create-copy">
            <span className="create-home__action-icon"><ClipboardIcon /></span>
            <span className="create-home__action-copy"><strong>{copied ? 'コピーしました！' : '作成用の指示だけコピー'}</strong><small>AI Studioへ貼り付ける内容をコピーします</small></span>
            <span className="create-home__chevron" aria-hidden="true">›</span>
          </button>
        </section>

        <footer className="create-home__footer">
          <img className="create-home__footer-flowers" src="/create-home/footer-flowers.webp" alt="" aria-hidden="true" draggable={false} loading="lazy" decoding="async" />
          <div className="create-home__footer-note">
            <span aria-hidden="true">♢</span>
            <span>{personalSettingsEnabled ? 'あなたのパーソナル設定は長文に反映されます' : 'パーソナル設定は現在オフです'}</span>
          </div>

          <button
            type="button"
            className="create-home__other-modes"
            onClick={onOpenOtherModes}
            aria-label="匿名掲示板など、その他の教材をつくる"
          >
            その他の教材
          </button>
        </footer>
      </div>
    </main>
  );
};

export default CreateHomeScreen;
