import React, { useCallback, useEffect, useState } from 'react';
import { deleteKnownJpLexeme, getAllKnownJpLexemes } from './db';
import type { JpKnownLexeme } from './types';

interface Props { onBack: () => void; onChanged?: () => void; }

const JapaneseKnownWords: React.FC<Props> = ({ onBack, onChanged }) => {
  const [items, setItems] = useState<JpKnownLexeme[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getAllKnownJpLexemes());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '既知語を読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (key: string) => {
    await deleteKnownJpLexeme(key);
    await load();
    onChanged?.();
  };

  return (
    <section className="jp-learning-panel" data-testid="jp-known-words">
      <header className="jp-learning-panel__header">
        <button type="button" className="jp-button jp-button--quiet" onClick={onBack}>← 教材一覧</button>
        <div><p className="jp-eyebrow">KNOWN WORDS</p><h2>知っている語</h2><p>ここに入った語は「知らない語だけ」ふりがなモードで補助を減らします。</p></div>
      </header>
      {message && <p className="jp-reader-message">{message}</p>}
      {loading ? <div className="jp-empty" role="status"><strong>既知語を読み込んでいます…</strong></div> : items.length === 0 ? <div className="jp-empty"><strong>既知語はまだありません</strong><p>Readerの語彙情報から「知っている」にできます。</p></div> : (
        <div className="jp-known-grid">
          {items.map(item => (
            <article key={item.key} className="jp-known-card">
              <h3>{item.surface}</h3>
              {item.reading && <p>{item.reading}</p>}
              {item.lemma && item.lemma !== item.surface && <small>辞書形：{item.lemma}</small>}
              <button type="button" className="jp-button jp-button--quiet" onClick={() => void remove(item.key)}>既知語から外す</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
export default JapaneseKnownWords;
