import React from 'react';
import { StoredMaterial } from '../types';
import { Theme } from '../App';

interface DeckListScreenProps {
  decks: StoredMaterial[];
  onStudy: (id: number) => void;
  onGame: (id: number) => void;
  onBack: () => void;
  onRead: (id: number) => void;
  onViewList: (id: number) => void;
  T: Theme;
}

const DeckItem: React.FC<{
  deck: StoredMaterial;
  onStudy: (id: number) => void;
  onGame: (id: number) => void;
  onRead: (id: number) => void;
  onViewList: (id: number) => void;
}> = ({ deck, onStudy, onGame, onRead, onViewList }) => {
  const reviewedCount = deck.cardStats ? Object.keys(deck.cardStats).length : 0;

  return (
    <article className="memora-deck-card">
      <div className="memora-deck-card__copy">
        <span>MEMORIZE</span>
        <h2>{deck.name}</h2>
        <p>{reviewedCount > 0 ? `${reviewedCount}枚に復習記録があります` : '単語カード付きの教材です'}</p>
      </div>
      <div className="memora-deck-card__actions" aria-label={`${deck.name}の学習メニュー`}>
        <button type="button" onClick={() => onViewList(deck.id)}>カード一覧</button>
        <button type="button" onClick={() => onGame(deck.id)}>4択ゲーム</button>
        <button type="button" className="is-primary" onClick={() => onStudy(deck.id)}>単語を覚える</button>
        {deck.hasTextFile && <button type="button" onClick={() => onRead(deck.id)}>本文を読む</button>}
      </div>
    </article>
  );
};

const DeckListScreen: React.FC<DeckListScreenProps> = ({ decks, onStudy, onGame, onBack, onRead, onViewList }) => {
  return (
    <main className="memora-deck-screen">
      <div className="memora-deck-screen__inner">
        <header className="memora-deck-header">
          <div className="memora-deck-header__topline">
            <button type="button" onClick={onBack} className="memora-header-button memora-header-button--back">
              <span aria-hidden="true">←</span><span>教材ライブラリへ</span>
            </button>
          </div>
          <div className="memora-deck-header__body">
            <div>
              <p>MEMORIZE</p>
              <h1>単語デッキ</h1>
              <span>教材で出会った単語を、自分のペースで覚えます。</span>
            </div>
            {decks.length > 0 && <img src="/memora-world/memorize-v1.webp" alt="" aria-hidden="true" draggable={false} />}
          </div>
        </header>

        <section className="memora-deck-list" aria-label="単語デッキ一覧">
          {decks.length > 0 ? (
            decks.map(deck => (
              <DeckItem key={deck.id} deck={deck} onStudy={onStudy} onGame={onGame} onRead={onRead} onViewList={onViewList} />
            ))
          ) : (
            <div className="memora-deck-empty">
              <img src="/memora-world/memorize-v1.webp" alt="" aria-hidden="true" draggable={false} />
              <p>MEMORIZE</p>
              <h2>まだ単語デッキがありません</h2>
              <span>単語カードが入った教材を追加すると、ここに表示されます。</span>
              <button type="button" onClick={onBack}>教材ライブラリへ</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default DeckListScreen;
