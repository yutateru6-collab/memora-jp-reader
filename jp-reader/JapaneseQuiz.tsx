import React, { useMemo, useState } from 'react';
import type { JpQuizQuestion } from './types';

interface JapaneseQuizProps {
  questions: JpQuizQuestion[];
  onBack: () => void;
}

const JapaneseQuiz: React.FC<JapaneseQuizProps> = ({ questions, onBack }) => {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = useMemo(
    () => questions.reduce((total, question) => total + (answers[question.id] === question.correctAnswerIndex ? 1 : 0), 0),
    [answers, questions],
  );

  return (
    <section className="jp-quiz" aria-labelledby="jp-quiz-title">
      <div className="jp-quiz__header">
        <button type="button" className="jp-button jp-button--quiet" onClick={onBack}>← 再読に戻る</button>
        <div>
          <p className="jp-eyebrow">QUIZ</p>
          <h2 id="jp-quiz-title">読後クイズ</h2>
        </div>
      </div>
      {submitted && (
        <div className="jp-quiz__result" role="status">
          {questions.length}問中 {score}問正解です。
        </div>
      )}
      <div className="jp-quiz__questions">
        {questions.map((question, questionIndex) => (
          <fieldset key={question.id} className="jp-quiz__question">
            <legend>{questionIndex + 1}. {question.question}</legend>
            <div className="jp-quiz__choices">
              {question.choices.map((choice, choiceIndex) => {
                const selected = answers[question.id] === choiceIndex;
                const correct = submitted && choiceIndex === question.correctAnswerIndex;
                const incorrect = submitted && selected && !correct;
                return (
                  <label key={`${question.id}-${choiceIndex}`} className={`jp-quiz__choice ${selected ? 'is-selected' : ''} ${correct ? 'is-correct' : ''} ${incorrect ? 'is-incorrect' : ''}`}>
                    <input
                      type="radio"
                      name={question.id}
                      checked={selected}
                      disabled={submitted}
                      onChange={() => setAnswers(previous => ({ ...previous, [question.id]: choiceIndex }))}
                    />
                    <span>{choice}</span>
                  </label>
                );
              })}
            </div>
            {submitted && question.explanation && <p className="jp-quiz__explanation">{question.explanation}</p>}
          </fieldset>
        ))}
      </div>
      <div className="jp-quiz__actions">
        {!submitted ? (
          <button
            type="button"
            className="jp-button jp-button--primary"
            disabled={Object.keys(answers).length !== questions.length}
            onClick={() => setSubmitted(true)}
          >
            答え合わせ
          </button>
        ) : (
          <button type="button" className="jp-button jp-button--primary" onClick={() => { setAnswers({}); setSubmitted(false); }}>
            もう一度
          </button>
        )}
      </div>
    </section>
  );
};

export default JapaneseQuiz;

