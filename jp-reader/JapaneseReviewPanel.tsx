import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { calculateSRS, getNextReviewText, type Grade } from '../lib/srs';
import {
  getAllJpCards,
  getDueJpCards,
  saveKnownJpLexeme,
  updateJpCardSrs,
} from './db';
import { makeKnownLexeme } from './learning';
import type { StoredJpVocabularyCard } from './types';

interface JapaneseReviewPanelProps {
  onBack: () => void;
  onChanged?: () => void;
}

const GRADE_LABELS: Array<{ grade: Grade; label: string }> = [
  { grade: 'again', label: 'もう一度' },
  { grade: 'hard', label: 'むずかしい' },
  { grade: 'good', label: 'できた' },
  { grade: 'easy', label: 'かんたん' },
];

const JapaneseReviewPanel: React.FC<JapaneseReviewPanelProps> = ({ onBack, onChanged }) => {
  const [queue, setQueue] = useState<StoredJpVocabularyCard[]>([]);
  const [allCount, setAllCount] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [due, all] = await Promise.all([getDueJpCards(), getAllJpCards()]);
      setQueue(due);
      setAllCount(all.length);
      setIndex(0);
      setRevealed(false);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '復習データを読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const current = queue[index];
  const remaining = Math.max(queue.length - index, 0);
  const progress = queue.length ? Math.round((index / queue.length) * 100) : 100;

  const gradeCard = async (grade: Grade) => {
    if (!current) return;
    try {
      const next = calculateSRS(current.srsState, grade);
      await updateJpCardSrs(current.storageKey, next);
      if (grade === 'easy') {
        await saveKnownJpLexeme(makeKnownLexeme({
          id: current.segmentId,
          lexemeId: current.lexemeId,
          surface: current.surface,
          reading: current.reading,
          lemma: current.lemma,
        }, current.materialId));
      }
      setMessage(`${getNextReviewText(grade, current.srsState)}にもう一度出します。${grade === 'easy' ? ' 既知語にも追加しました。' : ''}`);
      setIndex(previous => previous + 1);
      setRevealed(false);
      onChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '復習結果を保存できませんでした。');
    }
  };

  const completed = !loading && queue.length > 0 && index >= queue.length;
  const title = useMemo(() => completed ? '今日の復習は完了です' : '今日の単語復習', [completed]);

  return (
    <section className="jp-learning-panel" data-testid="jp-review-panel" aria-labelledby="jp-review-title">
      <header className="jp-learning-panel__header">
        <button type="button" className="jp-button jp-button--quiet" onClick={onBack}>← 教材一覧</button>
        <div>
          <p className="jp-eyebrow">SPACED REPETITION</p>
          <h2 id="jp-review-title">{title}</h2>
          <p>登録した単語を、忘れそうなタイミングで復習します。</p>
        </div>
      </header>

      {message && <p className="jp-reader-message" role="status">{message}</p>}

      {loading ? (
        <p className="jp-empty">復習カードを読み込んでいます…</p>
      ) : queue.length === 0 ? (
        <div className="jp-empty">
          <strong>今日は復習する単語がありません</strong>
          <p>登録済み {allCount}語。Readerの「学ぶ」から気になる語を追加できます。</p>
        </div>
      ) : completed ? (
        <div className="jp-empty">
          <strong>おつかれさまでした！</strong>
          <p>{queue.length}語を復習しました。</p>
          <button type="button" className="jp-button jp-button--primary" onClick={onBack}>教材一覧へ</button>
        </div>
      ) : current ? (
        <div className="jp-review-card-wrap">
          <div className="jp-review-progress" aria-label={`復習進捗 ${progress}%`}><span style={{ width: `${progress}%` }} /></div>
          <p className="jp-review-counter">残り {remaining}語 / 登録 {allCount}語</p>
          <article className="jp-review-card">
            <p className="jp-eyebrow">WORD</p>
            <h3>{current.surface}</h3>
            {current.reading && <p className="jp-review-reading">{current.reading}</p>}
            {revealed ? (
              <div className="jp-review-answer">
                {current.lemma && <p><strong>辞書形：</strong>{current.lemma}</p>}
                <p><strong>意味：</strong>{current.meaning}</p>
                {current.example && <p><strong>文脈：</strong>{current.example}</p>}
              </div>
            ) : (
              <button type="button" className="jp-button jp-button--primary" data-testid="jp-review-reveal" onClick={() => setRevealed(true)}>答えを表示</button>
            )}
          </article>
          {revealed && (
            <div className="jp-review-grades" data-testid="jp-review-grades">
              {GRADE_LABELS.map(item => (
                <button key={item.grade} type="button" onClick={() => void gradeCard(item.grade)}>
                  <strong>{item.label}</strong>
                  <small>{getNextReviewText(item.grade, current.srsState)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default JapaneseReviewPanel;
