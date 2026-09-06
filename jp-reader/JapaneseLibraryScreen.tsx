import React, { useCallback, useEffect, useRef, useState } from 'react';
import { buildJapaneseAnalysisPrompt } from '../lib/japaneseAnalysisPrompt';
import {
  deleteJpMaterial,
  findJpMaterialsByTitle,
  getAllJpCards,
  getAllJpGrammarNotes,
  getAllJpMaterials,
  getAllJpProgress,
  getAllKnownJpLexemes,
  getDueJpCards,
  initJpReaderDB,
  saveJpMaterial,
} from './db';
import {
  createMaterialFromPlainJapanese,
  formatJpImportError,
  prepareJapaneseReaderImport,
  type JpImportResult,
} from './import';
import JapaneseGrammarNotebook from './JapaneseGrammarNotebook';
import JapaneseKnownWords from './JapaneseKnownWords';
import JapaneseReviewPanel from './JapaneseReviewPanel';
import type {
  JapaneseReaderMaterialV1,
  JpRightsStatus,
  JpTargetLevel,
  StoredJpMaterial,
} from './types';
import './jp-reader.css';
import './learning.css';

interface JapaneseLibraryScreenProps {
  onBack: () => void;
  onOpenMaterial: (material: StoredJpMaterial) => void;
}

type ImportTab = 'json-paste' | 'json-file' | 'plain-text';
type LibraryPanel = 'library' | 'review' | 'known' | 'grammar';

const AI_STUDIO_URL = 'https://aistudio.google.com/app/u/0/prompts/new_chat?model=gemini-3-pro-preview';

const RIGHTS_OPTIONS: Array<{ value: JpRightsStatus; label: string }> = [
  { value: 'unknown', label: '不明・確認していない' },
  { value: 'owned', label: '自分が書いた文章' },
  { value: 'permission-granted', label: '利用許可を得ている' },
  { value: 'licensed', label: '利用条件・ライセンスを確認済み' },
  { value: 'public-domain', label: 'パブリックドメイン' },
];

interface LearningSummary {
  totalSeconds: number;
  registeredWords: number;
  dueWords: number;
  knownWords: number;
  grammarNotes: number;
}

const EMPTY_SUMMARY: LearningSummary = { totalSeconds: 0, registeredWords: 0, dueWords: 0, knownWords: 0, grammarNotes: 0 };

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
};

const JapaneseLibraryScreen: React.FC<JapaneseLibraryScreenProps> = ({ onBack, onOpenMaterial }) => {
  const [panel, setPanel] = useState<LibraryPanel>('library');
  const [materials, setMaterials] = useState<StoredJpMaterial[]>([]);
  const [summary, setSummary] = useState<LearningSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab>('json-paste');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonFileName, setJsonFileName] = useState('');
  const [plainText, setPlainText] = useState('');
  const [plainTitle, setPlainTitle] = useState('');
  const [targetLevel, setTargetLevel] = useState<JpTargetLevel>('N3');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rightsStatus, setRightsStatus] = useState<JpRightsStatus>('unknown');
  const [prepared, setPrepared] = useState<JpImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [duplicate, setDuplicate] = useState<{ material: JapaneseReaderMaterialV1; existing: StoredJpMaterial } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoredJpMaterial | null>(null);
  const [analysisCopied, setAnalysisCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstTabRef = useRef<HTMLButtonElement>(null);
  const importLockRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      await initJpReaderDB();
      const [nextMaterials, progress, cards, due, known, grammar] = await Promise.all([
        getAllJpMaterials(),
        getAllJpProgress(),
        getAllJpCards(),
        getDueJpCards(),
        getAllKnownJpLexemes(),
        getAllJpGrammarNotes(),
      ]);
      setMaterials(nextMaterials);
      setSummary({
        totalSeconds: progress.reduce((sum, item) => sum + (item.readingSeconds || 0), 0),
        registeredWords: cards.length,
        dueWords: due.length,
        knownWords: known.length,
        grammarNotes: grammar.length,
      });
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '日本語教材を読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('memora-jp-open-import') === '1') {
        sessionStorage.removeItem('memora-jp-open-import');
        setImportTab('json-paste');
        setIsImportOpen(true);
      }
    } catch { /* continue with normal library */ }
  }, []);

  const resetImport = useCallback(() => {
    setJsonInput('');
    setJsonFileName('');
    setPlainText('');
    setPlainTitle('');
    setTargetLevel('N3');
    setSourceUrl('');
    setRightsStatus('unknown');
    setPrepared(null);
    setDuplicate(null);
    setError('');
    setAnalysisCopied(false);
  }, []);

  useEffect(() => {
    if (!isImportOpen && !deleteTarget) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = isImportOpen ? window.setTimeout(() => firstTabRef.current?.focus({ preventScroll: true }), 0) : undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isImportOpen && !isImporting) { setIsImportOpen(false); resetImport(); }
      else if (deleteTarget) setDeleteTarget(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      if (focusTimer !== undefined) window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [deleteTarget, isImportOpen, isImporting, resetImport]);

  const closeImport = () => {
    if (isImporting) return;
    setIsImportOpen(false);
    resetImport();
  };

  const selectTab = (tab: ImportTab) => {
    setImportTab(tab);
    setPrepared(null);
    setDuplicate(null);
    setError('');
  };

  const handleJsonFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setJsonInput(await file.text());
      setJsonFileName(file.name);
      setPrepared(null);
      setError('');
    } catch {
      setError('JSONファイルを読み込めませんでした。別のファイルを選んでください。');
    }
  };

  const finishSave = async (material: JapaneseReaderMaterialV1, options?: { replaceId?: number; duplicateTitle?: boolean }) => {
    const saved = await saveJpMaterial(material, options);
    await reload();
    setSuccess(`「${saved.title}」を取り込みました。`);
    setIsImportOpen(false);
    resetImport();
    onOpenMaterial(saved);
  };

  const handleImport = async () => {
    if (importLockRef.current) return;
    importLockRef.current = true;
    setIsImporting(true);
    setError('');
    setSuccess('');
    try {
      let material: JapaneseReaderMaterialV1;
      if (importTab === 'plain-text') {
        material = createMaterialFromPlainJapanese({ text: plainText, title: plainTitle, targetLevel, sourceUrl, rightsStatus });
      } else if (!prepared) {
        setPrepared(prepareJapaneseReaderImport(jsonInput));
        return;
      } else {
        material = prepared.material;
      }
      const matches = await findJpMaterialsByTitle(material.title);
      if (matches.length > 0) { setDuplicate({ material, existing: matches[0] }); return; }
      await finishSave(material);
    } catch (importError) {
      setError(formatJpImportError(importError));
    } finally {
      importLockRef.current = false;
      setIsImporting(false);
    }
  };

  const handleDuplicateChoice = async (choice: 'copy' | 'replace') => {
    if (!duplicate || importLockRef.current) return;
    importLockRef.current = true;
    setIsImporting(true);
    try {
      await finishSave(duplicate.material, choice === 'replace' ? { replaceId: duplicate.existing.id } : { duplicateTitle: true });
    } catch (saveError) {
      setError(formatJpImportError(saveError));
    } finally {
      importLockRef.current = false;
      setIsImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteJpMaterial(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
      setSuccess('教材を削除しました。');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '教材を削除できませんでした。');
    }
  };

  const analyzePlainText = async () => {
    if (!plainText.trim()) return;
    await copyText(buildJapaneseAnalysisPrompt({ text: plainText, title: plainTitle, level: targetLevel }));
    setAnalysisCopied(true);
    window.open(AI_STUDIO_URL, '_blank', 'noopener,noreferrer');
  };

  if (panel === 'review') return <main className="jp-library"><JapaneseReviewPanel onBack={() => { setPanel('library'); void reload(); }} onChanged={reload} /></main>;
  if (panel === 'known') return <main className="jp-library"><JapaneseKnownWords onBack={() => { setPanel('library'); void reload(); }} onChanged={reload} /></main>;
  if (panel === 'grammar') return <main className="jp-library"><JapaneseGrammarNotebook onBack={() => { setPanel('library'); void reload(); }} onChanged={reload} /></main>;

  return (
    <main className="jp-library" data-testid="jp-library">
      <header className="jp-library-header">
        <div className="jp-library-header__top">
          <button type="button" className="jp-button jp-button--quiet" onClick={onBack}>← 作成トップ</button>
          <button type="button" className="jp-button jp-button--primary" data-testid="jp-open-import" onClick={() => setIsImportOpen(true)}>教材を取り込む</button>
        </div>
        <div className="jp-library-header__copy">
          <p className="jp-eyebrow">MEMORA JAPANESE READER</p>
          <h1>読むほど、<br />自分専用の日本語Readerへ。</h1>
          <p>読んだ語・覚えた語・文法を残し、次の読書で必要な補助だけを表示します。</p>
        </div>
      </header>

      {error && !isImportOpen && <pre className="jp-banner jp-banner--error" role="alert">{error}</pre>}
      {success && <p className="jp-banner jp-banner--success" role="status">{success}</p>}

      <section className="jp-learning-dashboard" data-testid="jp-learning-dashboard" aria-label="日本語学習状況">
        <div><strong>{Math.floor(summary.totalSeconds / 60)}</strong><span>読書分</span></div>
        <div><strong>{summary.registeredWords}</strong><span>登録語</span></div>
        <div><strong>{summary.knownWords}</strong><span>既知語</span></div>
        <div><strong>{summary.grammarNotes}</strong><span>文法</span></div>
      </section>

      <section className="jp-learning-actions" aria-label="学習メニュー">
        <button type="button" data-testid="jp-open-review" onClick={() => setPanel('review')}><span>今日の単語復習</span><strong>{summary.dueWords}語</strong></button>
        <button type="button" data-testid="jp-open-known" onClick={() => setPanel('known')}><span>知っている語</span><strong>{summary.knownWords}語</strong></button>
        <button type="button" data-testid="jp-open-grammar" onClick={() => setPanel('grammar')}><span>文法ノート</span><strong>{summary.grammarNotes}件</strong></button>
      </section>

      <section className="jp-library-list" aria-labelledby="jp-library-title">
        <div className="jp-section-heading"><div><p className="jp-eyebrow">LIBRARY</p><h2 id="jp-library-title">日本語教材</h2></div><span>{materials.length}件</span></div>
        {loading ? <p className="jp-empty">教材を読み込んでいます…</p> : materials.length === 0 ? (
          <div className="jp-empty"><strong>まだ日本語教材がありません</strong><p>AIで教材JSONを作るか、日本語本文をそのまま取り込めます。</p><button type="button" className="jp-button jp-button--primary" onClick={() => setIsImportOpen(true)}>最初の教材を取り込む</button></div>
        ) : (
          <div className="jp-material-grid">
            {materials.map(item => (
              <article key={item.id} className="jp-material-card">
                <button type="button" className="jp-material-card__main" onClick={() => onOpenMaterial(item)}>
                  <span className="jp-material-card__level">{item.targetLevel}</span>
                  <h3>{item.title}</h3>
                  <p>{item.content.sentences.length}文 ・ {item.content.analysisStatus === 'complete' ? '詳細解析あり' : '詳細解析なし'}</p>
                  <small>{new Date(item.updatedAt).toLocaleDateString('ja-JP')}</small>
                </button>
                <button type="button" className="jp-material-card__delete" aria-label={`${item.title}を削除`} onClick={() => setDeleteTarget(item)}>削除</button>
              </article>
            ))}
          </div>
        )}
      </section>

      {isImportOpen && (
        <div className="jp-modal-backdrop" onClick={closeImport}>
          <section className="jp-import-modal" data-testid="jp-import-modal" role="dialog" aria-modal="true" aria-labelledby="jp-import-title" onClick={event => event.stopPropagation()}>
            <header className="jp-import-modal__header"><div><p className="jp-eyebrow">IMPORT</p><h2 id="jp-import-title">日本語教材を取り込む</h2></div><button type="button" aria-label="取り込み画面を閉じる" disabled={isImporting} onClick={closeImport}>×</button></header>
            <div className="jp-import-tabs" role="tablist" aria-label="取り込み方法">
              <button ref={firstTabRef} type="button" role="tab" aria-selected={importTab === 'json-paste'} onClick={() => selectTab('json-paste')}>JSONを貼る</button>
              <button type="button" role="tab" aria-selected={importTab === 'json-file'} onClick={() => selectTab('json-file')}>JSONファイル</button>
              <button type="button" role="tab" aria-selected={importTab === 'plain-text'} onClick={() => selectTab('plain-text')}>日本語本文</button>
            </div>
            <div className="jp-import-modal__body" data-testid="jp-import-body">
              {error && <pre className="jp-banner jp-banner--error" role="alert">{error}</pre>}
              {duplicate ? (
                <div className="jp-duplicate-panel"><h3>同じ名前の教材があります</h3><p>「{duplicate.existing.title}」を上書きするか、コピーとして保存してください。</p><div><button type="button" className="jp-button jp-button--quiet" disabled={isImporting} onClick={() => setDuplicate(null)}>内容に戻る</button><button type="button" className="jp-button jp-button--secondary" disabled={isImporting} onClick={() => void handleDuplicateChoice('copy')}>コピーとして保存</button><button type="button" className="jp-button jp-button--primary" disabled={isImporting} onClick={() => void handleDuplicateChoice('replace')}>上書きする</button></div></div>
              ) : (
                <>
                  {importTab === 'json-paste' && <label className="jp-field"><span>日本語Reader教材JSON</span><textarea data-testid="jp-json-input" value={jsonInput} onChange={event => { setJsonInput(event.target.value); setPrepared(null); setError(''); }} rows={12} placeholder={'{\n  "schemaVersion": "memora-jp-reader-v1",\n  "mode": "jp-reader",\n  ...\n}'} /></label>}
                  {importTab === 'json-file' && <div className="jp-file-picker"><input ref={fileInputRef} data-testid="jp-json-file" type="file" accept=".json,application/json,text/plain" onChange={handleJsonFile} /><button type="button" className="jp-button jp-button--secondary" onClick={() => fileInputRef.current?.click()}>JSONファイルを選ぶ</button><p>{jsonFileName || 'ファイルはまだ選ばれていません。'}</p>{jsonInput && <small>{jsonInput.length.toLocaleString('ja-JP')}文字を読み込みました。</small>}</div>}
                  {importTab === 'plain-text' && (
                    <div className="jp-import-form">
                      <label className="jp-field"><span>日本語本文</span><textarea data-testid="jp-plain-input" value={plainText} onChange={event => setPlainText(event.target.value)} rows={9} placeholder="読みたい日本語の文章を貼り付けてください。" /></label>
                      <label className="jp-field"><span>教材名 <small>（空欄なら本文から作成）</small></span><input value={plainTitle} onChange={event => setPlainTitle(event.target.value)} /></label>
                      <div className="jp-import-form__row"><label className="jp-field"><span>学習レベル</span><select value={targetLevel} onChange={event => setTargetLevel(event.target.value as JpTargetLevel)}><option value="N4">N4</option><option value="N3">N3</option><option value="N2">N2</option></select></label><label className="jp-field"><span>権利状態</span><select value={rightsStatus} onChange={event => setRightsStatus(event.target.value as JpRightsStatus)}>{RIGHTS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
                      <label className="jp-field"><span>元のURL <small>（任意・自動取得はしません）</small></span><input type="url" value={sourceUrl} onChange={event => setSourceUrl(event.target.value)} placeholder="https://..." /></label>
                      <div className="jp-analysis-callout"><strong>詳しく学びたい場合</strong><p>この本文をそのまま保ったまま、読み・辞書形・文法・英訳・やさしい日本語・クイズ付きJSONへ変換する指示を作れます。</p><button type="button" className="jp-button jp-button--secondary" data-testid="jp-analyze-plain-text" disabled={!plainText.trim()} onClick={() => void analyzePlainText()}>{analysisCopied ? '解析指示をコピーしました' : 'AI Studioでこの本文を解析'}</button></div>
                      <p className="jp-import-note">「教材として取り込む」だけなら本文はすぐ読めますが、詳細解析は付きません。</p>
                    </div>
                  )}
                  {prepared && <div className="jp-import-preview" role="status"><strong>日本語教材JSONを確認できました</strong><p>{prepared.material.sentences.length}文・単語カード候補{prepared.material.vocabularyCards.length}件・クイズ{prepared.material.quiz.length}問</p>{prepared.repairs.length > 0 && <ul>{prepared.repairs.map(item => <li key={item}>{item}</li>)}</ul>}{prepared.warnings.length > 0 && <details><summary>警告 {prepared.warnings.length}件</summary><ul>{prepared.warnings.slice(0, 12).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul></details>}</div>}
                </>
              )}
            </div>
            {!duplicate && <footer className="jp-import-modal__footer" data-testid="jp-import-footer"><button type="button" className="jp-button jp-button--primary" data-testid="jp-import-submit" disabled={isImporting || (importTab === 'plain-text' ? !plainText.trim() : !jsonInput.trim())} onClick={() => void handleImport()}>{isImporting ? '確認・保存中…' : importTab === 'plain-text' || prepared ? '教材として取り込む' : '内容を確認する'}</button></footer>}
          </section>
        </div>
      )}

      {deleteTarget && <div className="jp-modal-backdrop" onClick={() => setDeleteTarget(null)}><section className="jp-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="jp-delete-title" onClick={event => event.stopPropagation()}><h2 id="jp-delete-title">この教材を削除しますか？</h2><p>「{deleteTarget.title}」と、その教材の学習記録・登録単語・文法ノートを削除します。</p><div><button type="button" className="jp-button jp-button--quiet" onClick={() => setDeleteTarget(null)}>キャンセル</button><button type="button" className="jp-button jp-button--danger" onClick={() => void handleDelete()}>削除する</button></div></section></div>}
    </main>
  );
};

export default JapaneseLibraryScreen;
