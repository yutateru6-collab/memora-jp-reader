import React, { useMemo, useState } from 'react';
import { Card } from '../types';
import { Theme } from '../App';

interface CardListScreenProps {
  cards: Card[];
  deckName: string;
  onBack: () => void;
  T: Theme;
}

export const CardListScreen: React.FC<CardListScreenProps> = ({ cards, deckName, onBack }) => {
  const [cardStates, setCardStates] = useState<number[]>(new Array(cards.length).fill(0));

  const getFaces = (card: Card) => [card.front, card.back, card.pronunciation, card.memo]
    .filter((face): face is string => typeof face === 'string' && face.trim() !== '');

  const hasFlippedCard = useMemo(() => cardStates.some(state => state > 0), [cardStates]);

  const handleCardClick = (index: number) => {
    setCardStates(previous => {
      const next = [...previous];
      const facesCount = getFaces(cards[index]).length || 1;
      next[index] = (next[index] + 1) % facesCount;
      return next;
    });
  };

  const handleFlipAll = () => {
    setCardStates(previous => previous.map((state, index) => {
      const facesCount = getFaces(cards[index]).length || 1;
      return (state + 1) % facesCount;
    }));
  };

  const handleResetAll = () => setCardStates(new Array(cards.length).fill(0));
  const faceLabels = ['英単語', '意味', '発音', 'メモ'];

  return (
    <main className="memora-card-list-screen">
      <header className="memora-card-list-header">
        <button type="button" onClick={onBack} aria-label="戻る" className="memora-header-button memora-header-button--back">
          <span aria-hidden="true">←</span><span>戻る</span>
        </button>
        <div className="memora-card-list-header__title">
          <p>ORGANIZE</p>
          <h1>単語カード一覧</h1>
          <span>{deckName}・{cards.length}枚</span>
        </div>
        <img
          src={hasFlippedCard ? '/memora-world/organize-v2.webp' : '/memora-world/organize-v1.webp'}
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <div className="memora-card-list-header__actions">
          <button type="button" onClick={handleResetAll}>すべて表へ</button>
          <button type="button" className="is-primary" onClick={handleFlipAll}>一括めくり</button>
        </div>
      </header>

      <section className="memora-card-grid" aria-label="単語カード">
        {cards.length > 0 ? cards.map((card, index) => {
          const faces = getFaces(card);
          const faceIndex = cardStates[index] % (faces.length || 1);
          const content = faces[faceIndex] || '内容がありません';

          return (
            <button
              type="button"
              key={card.id}
              onClick={() => handleCardClick(index)}
              className={`memora-card-tile ${faceIndex > 0 ? 'is-back' : ''}`}
              aria-label={`${card.front || '単語カード'}：タップして次の面へ`}
            >
              <span className="memora-card-tile__face">{faceLabels[faceIndex] || `面${faceIndex + 1}`}</span>
              <strong>{content}</strong>
              {faces.length > 1 && (
                <span className="memora-card-tile__dots" aria-hidden="true">
                  {faces.map((_, dotIndex) => <i key={dotIndex} className={dotIndex === faceIndex ? 'is-active' : ''} />)}
                </span>
              )}
            </button>
          );
        }) : (
          <div className="memora-card-list-empty">
            <h2>この教材には単語カードがありません</h2>
            <button type="button" onClick={onBack}>戻る</button>
          </div>
        )}
      </section>
    </main>
  );
};
