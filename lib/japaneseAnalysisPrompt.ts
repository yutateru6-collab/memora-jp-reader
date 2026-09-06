import type { JpTargetLevel } from '../jp-reader/types';

export const buildJapaneseAnalysisPrompt = (input: { text: string; title?: string; level: JpTargetLevel }) => {
  const title = input.title?.trim() || '貼り付けた日本語教材';
  const text = input.text.trim();
  return `あなたはMEMORA Japanese Reader用の日本語教育専門家です。\n以下の日本語原文を一字一句勝手に書き換えず、学習者向けに解析して、MEMORAで読み込めるJSONだけを返してください。\n\n【対象レベル】${input.level}\n【タイトル】${title}\n\n【原文】\n${text}\n\n【絶対条件】\n・最終回答はJSONオブジェクトだけ。Markdownコードフェンス禁止。\n・schemaVersionは\"memora-jp-reader-v1\"、modeは\"jp-reader\"。\n・targetLevelは\"${input.level}\"。\n・source.typeは\"user-paste\"、source.rightsStatusは\"unknown\"。\n・visibilityは\"private\"、publicShareAllowedはfalse。\n・analysisStatusは\"complete\"。\n・original.textには上の原文を文単位に分けた文字列をそのまま使い、意味・語句・句読点を勝手に変更しない。\n・original.segments[].surfaceを順番に連結するとoriginal.textと完全一致すること。\n・各segmentにreading、lemma、partOfSpeech、conjugation、contextualGloss、jlptEstimate、register、exampleを可能な範囲で入れる。\n・各文に自然な英訳translationを入れる。\n・各文に学習価値のあるgrammar、omittedElements、nuanceNotes、cultureNote、confidence、warningsを入れる。\n・adaptedには意味を変えない一段やさしい日本語を入れ、isAiGeneratedをtrueにする。\n・vocabularyCardsは本文理解に重要な語・チャンクを選び、実在するoriginalのsentenceId/segmentIdを参照する。\n・quizは内容理解2、語彙1、文法/ニュアンス1、原文とやさしい日本語1の合計5問を基本にする。\n・不確かな解析はconfidenceを下げ、warningsに明記する。\n\nJSON構造は既存のMEMORA Japanese Reader v1に厳密に合わせること。`;
};
