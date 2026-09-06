import React, { useCallback, useEffect, useState } from 'react';
import { deleteJpGrammarNote, getAllJpGrammarNotes } from './db';
import type { JpGrammarNote } from './types';

interface Props { onBack: () => void; onChanged?: () => void; }

const JapaneseGrammarNotebook: React.FC<Props> = ({ onBack, onChanged }) => {
  const [notes, setNotes] = useState<JpGrammarNote[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try { setNotes(await getAllJpGrammarNotes()); }
    catch (error) { setMessage(error instanceof Error ? error.message : '文法ノートを読み込めませんでした。'); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const remove = async (key: string) => {
    await deleteJpGrammarNote(key);
    await load();
    onChanged?.();
  };

  return (
    <section className="jp-learning-panel" data-testid="jp-grammar-notebook">
      <header className="jp-learning-panel__header">
        <button type="button" className="jp-button jp-button--quiet" onClick={onBack}>← 教材一覧</button>
        <div><p className="jp-eyebrow">GRAMMAR NOTEBOOK</p><h2>文法ノート</h2><p>読んでいる途中で残した文法を、教材をまたいで見返せます。</p></div>
      </header>
      {message && <p className="jp-reader-message">{message}</p>}
      {notes.length === 0 ? <div className="jp-empty"><strong>保存した文法はまだありません</strong><p>Readerの文解説から「文法ノートに保存」を押してください。</p></div> : (
        <div className="jp-note-list">
          {notes.map(note => (
            <article key={note.storageKey} className="jp-note-card">
              <div><span className="jp-material-card__level">{note.materialTitle}</span><h3>{note.pattern}</h3></div>
              {note.meaning && <p>{note.meaning}</p>}
              <p>{note.explanation}</p>
              {note.example && <small>例：{note.example}</small>}
              <button type="button" className="jp-button jp-button--quiet" onClick={() => void remove(note.storageKey)}>ノートから外す</button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
export default JapaneseGrammarNotebook;
