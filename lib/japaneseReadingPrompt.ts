import type { KnowledgeDepth } from './readingPrompt';
import type { JpTargetLevel } from '../jp-reader/types';

export interface JapaneseReadingPromptConfig {
  topic: string;
  additionalRequest?: string;
  level: JpTargetLevel;
  knowledgeDepth?: KnowledgeDepth;
  length: string;
  role: string;
  trait: string;
  inspirationSeed?: string;
  angerSeed?: string;
}

const DEPTH_PROFILES: Record<KnowledgeDepth, { label: string; rules: string[] }> = {
  beginner: {
    label: '初心者｜全体像から',
    rules: [
      'テーマについてほとんど知らない学習者でも内容を追えるよう、全体像・基本構造・代表例を優先する。',
      '固有名詞や専門語を詰め込みすぎず、必要な背景は本文の流れで分かるようにする。',
    ],
  },
  familiar: {
    label: 'ある程度｜もう一歩深く',
    rules: [
      '基本的な知識はある想定で、理由・比較・背景・少し意外な事実まで一段深く扱う。',
      '入門的な定義の繰り返しだけで終わらず、具体的な違いや因果関係を少なくとも一つ扱う。',
    ],
  },
  advanced: {
    label: 'かなり詳しい｜細部まで',
    rules: [
      '一般向けの概要は知っている想定で、細分類・例外・条件差・歴史的変化などを具体的に扱う。',
      '難しい情報を扱っても、日本語自体は指定JLPTレベルから大きく外さない。',
    ],
  },
  expert: {
    label: 'マニア・専門家級｜とことん',
    rules: [
      '一般的な入門説明は最小限にし、狭く具体的な論点を深く掘る。',
      '不確かな固有名詞・数値・逸話を作らず、確実に説明できる論点だけを扱う。',
    ],
  },
};

const LENGTH_PROFILES: Record<string, string> = {
  '700': '本文全体で約600〜800字',
  '1200': '本文全体で約1,000〜1,300字',
  '1800': '本文全体で約1,600〜2,000字',
};

const LEVEL_RULES: Record<JpTargetLevel, string> = {
  N4: 'N4修了前後の学習者向け。基本文型を中心にし、長い修飾・省略・抽象語を増やしすぎない。難しい語は学習対象として限定的に使う。',
  N3: 'N3前後の学習者向け。自然な接続・複文・やや抽象的な語彙を含めるが、N2以上の表現を連続させない。',
  N2: 'N2前後の学習者向け。自然な書き言葉、抽象語、複雑な修飾を扱ってよいが、読解不能になるほど専門語を密集させない。',
};

const buildPersonalInstructions = (inspirationSeed?: string, angerSeed?: string) => {
  const blocks: string[] = [];
  if (inspirationSeed?.trim()) {
    blocks.push(`【ひらめきの種】\n次の情報は、題材や例文に自然に使える場合だけ活用する。事実を勝手に追加しない。\n${inspirationSeed.trim()}`);
  }
  if (angerSeed?.trim()) {
    blocks.push(`【避けたいこと】\n次の内容は、教材の質を損なわない範囲で避ける。\n${angerSeed.trim()}`);
  }
  return blocks.length ? `\n\n${blocks.join('\n\n')}` : '';
};

export const buildJapaneseReadingPrompt = ({
  topic,
  additionalRequest = '',
  level,
  knowledgeDepth = 'familiar',
  length,
  role,
  trait,
  inspirationSeed = '',
  angerSeed = '',
}: JapaneseReadingPromptConfig) => {
  const topicText = topic.trim() || '日本のラーメン文化';
  const requestText = additionalRequest.trim();
  const depth = DEPTH_PROFILES[knowledgeDepth];
  const lengthRule = LENGTH_PROFILES[length] || LENGTH_PROFILES['1200'];
  const extraRequest = requestText
    ? `\n【追加要望】\n${requestText}\n本文・語彙・例文・解説に自然に反映する。ただし無理に全項目へ入れない。`
    : '';
  const personalInstructions = buildPersonalInstructions(inspirationSeed, angerSeed);

  return `あなたはMEMORA Japanese Reader用の日本語読解教材を作る、日本語教育専門家・編集者・校正者です。
テーマは「${topicText}」です。
学習者が「好きな内容を読みながら、日本語の語彙・漢字・活用・文法・ニュアンスを学べる」教材を作ってください。${extraRequest}${personalInstructions}

【最重要】
・本文は必ず自然な日本語で書く。英語長文を作らない。
・最終回答は有効なJSONオブジェクトだけにする。挨拶、説明、Markdownコードフェンス、JSON外の文字を一切付けない。
・schemaVersion は必ず "memora-jp-reader-v1"、mode は必ず "jp-reader" にする。
・targetLevel は必ず "${level}" にする。
・visibility は "private"、publicShareAllowed は false にする。
・source.type は "ai-generated"、source.rightsStatus は "unknown" にする。
・analysisStatus は "complete" にする。
・本文、易しい日本語、翻訳、語彙、文法、クイズをすべて同じJSONに入れる。

【本文の設計】
・日本語レベル: ${level}。
・${LEVEL_RULES[level]}
・テーマへの詳しさ: ${depth.label}。
${depth.rules.map(rule => `・${rule}`).join('\n')}
・長さ: ${lengthRule}。
・読み物として面白く、導入→具体化→別角度または対比→まとめ、の流れを基本にする。
・本文はテーマに沿った完全オリジナルの文章にする。
・既存の小説・漫画・アニメ・映画をテーマにする場合、台詞や文章をコピーせず、筋書きを長く再現しない。一般的な紹介・考察・文化的背景など、教材として新しく書き下ろす。
・不確かな事実、固有名詞、数値、逸話を作らない。確信できない場合は断定を避けるか、その情報を使わない。

【易しい日本語版】
・各文に original と adapted を作る。
・original は指定レベルの自然な日本語。
・adapted は original の意味・事実関係を変えず、一段理解しやすい日本語にする。
・adapted.isAiGenerated は true にする。
・単に丁寧体へ変えるだけではなく、難しい語・長い修飾・省略・抽象的な言い回しを必要に応じて易しくする。
・original と adapted の違いは adaptationReasons に日本語で短く説明する。

【segmentsの絶対ルール】
・original.text と original.segments[].surface を先頭から連結した文字列は、1文字も違わず完全一致させる。
・adapted.text と adapted.segments[].surface も同様に完全一致させる。
・句読点、括弧、引用符、記号、空白も本文にあるなら必ずsegmentとして含める。
・surface は本文中に実際に現れる形。lemma は辞書形。
・活用している語は、surface と lemma を混同しない。
・漢字の reading は、その文脈での実際の読みをひらがなで入れる。
・一日、今日、生、上手、人気など、文脈で読みや意味が変わる語は特に注意する。
・人名・地名・作品名を普通名詞として誤解析しない。
・segment id は original なら s1-o-1, s1-o-2...、adapted なら s1-a-1, s1-a-2... のように文内で一意にする。
・contextualGloss は英語で、その文脈での意味だけを書く。
・jlptEstimate は N5/N4/N3/N2/N1/unknown のいずれか。
・register は「一般」「丁寧」「くだけた会話」「書き言葉」「若者言葉」「古風」など、必要な場合だけ入れる。

【文法・ニュアンス】
・各文の grammar には、本当に学習価値がある文法だけを0〜3件入れる。
・grammar.explanation と grammar.meaning は、英語を母語とする日本語学習者が理解できる簡潔な英語で書く。
・omittedElements は、省略された主語・目的語などが理解に重要な場合だけ日本語で入れる。
・nuanceNotes は、普通体/丁寧体、硬さ、口語性、含みなどを日本語で簡潔に説明する。
・cultureNote は文化的背景が必要な文だけ入れ、不要なら null。
・confidence は0〜1。不確かな読み・解析・文化説明がある場合は下げ、warnings に具体的に書く。

【翻訳】
・translation は各文につける。
・language は "en"。
・text は自然な英訳にする。直訳しすぎず、原文の意味・態度・時制を変えない。

【単語カード】
・vocabularyCards は本文理解に重要な語・チャンクから選ぶ。
・目安: N4は8〜12件、N3は10〜16件、N2は12〜20件。
・本文にない語をカード化しない。
・sentenceId と segmentId は必ず実在する original のIDを参照する。
・variant は "original"。
・surface は本文中の形、lemma は辞書形、reading は本文での読み、meaning は短い英語訳。
・example は同じ語を使った短く自然な別の日本語例文にする。

【クイズ】
・quiz は5問。
・内容理解2問、語彙1問、文法/ニュアンス1問、原文と易しい日本語の対応1問を基本にする。
・choices は3〜4択、correctAnswerIndex は0始まり。
・本文から判断できない問題や複数正解になる問題を作らない。
・explanation は日本語または簡潔な英語で、正解根拠を明示する。

【解説の雰囲気】
・解説役のイメージ: ${role}
・性格: ${trait}
・grammar.explanation、nuanceNotes、文化補足は、この雰囲気を少し反映してよい。ただし正確さと簡潔さを優先し、キャラ口調が学習の邪魔をしないようにする。

【出力スキーマ】
以下のキー構造を厳守する。省略可能な情報がない場合も、配列は []、cultureNote は null、confidence は数値または null を必ず出す。

{
  "schemaVersion": "memora-jp-reader-v1",
  "mode": "jp-reader",
  "title": "日本語の教材タイトル",
  "targetLevel": "${level}",
  "source": {
    "type": "ai-generated",
    "title": "日本語の教材タイトル",
    "rightsStatus": "unknown",
    "importedAt": "ISO 8601形式の現在日時"
  },
  "visibility": "private",
  "publicShareAllowed": false,
  "analysisStatus": "complete",
  "sentences": [
    {
      "id": "s1",
      "original": {
        "text": "日本語の一文。",
        "segments": [
          {
            "id": "s1-o-1",
            "lexemeId": "optional-stable-id",
            "surface": "日本語",
            "reading": "にほんご",
            "lemma": "日本語",
            "partOfSpeech": "名詞",
            "contextualGloss": "Japanese language",
            "jlptEstimate": "N5",
            "register": "一般",
            "example": "日本語を勉強しています。"
          },
          {
            "id": "s1-o-2",
            "surface": "の",
            "reading": "の",
            "lemma": "の",
            "partOfSpeech": "助詞",
            "contextualGloss": "of",
            "jlptEstimate": "N5"
          },
          {
            "id": "s1-o-3",
            "surface": "一文",
            "reading": "いちぶん",
            "lemma": "一文",
            "partOfSpeech": "名詞",
            "contextualGloss": "sentence",
            "jlptEstimate": "N3"
          },
          { "id": "s1-o-4", "surface": "。" }
        ]
      },
      "adapted": {
        "text": "やさしくした日本語の一文。",
        "isAiGenerated": true,
        "segments": [
          { "id": "s1-a-1", "surface": "やさしく", "reading": "やさしく", "lemma": "やさしい", "partOfSpeech": "形容詞", "conjugation": "連用形", "contextualGloss": "in an easy way", "jlptEstimate": "N5" },
          { "id": "s1-a-2", "surface": "した", "reading": "した", "lemma": "する", "partOfSpeech": "動詞", "conjugation": "過去形", "contextualGloss": "made", "jlptEstimate": "N5" },
          { "id": "s1-a-3", "surface": "日本語", "reading": "にほんご", "lemma": "日本語", "partOfSpeech": "名詞", "contextualGloss": "Japanese", "jlptEstimate": "N5" },
          { "id": "s1-a-4", "surface": "の", "reading": "の", "lemma": "の", "partOfSpeech": "助詞", "contextualGloss": "of", "jlptEstimate": "N5" },
          { "id": "s1-a-5", "surface": "一文", "reading": "いちぶん", "lemma": "一文", "partOfSpeech": "名詞", "contextualGloss": "sentence", "jlptEstimate": "N3" },
          { "id": "s1-a-6", "surface": "。" }
        ]
      },
      "translation": { "language": "en", "text": "A Japanese sentence." },
      "grammar": [],
      "omittedElements": [],
      "nuanceNotes": [],
      "cultureNote": null,
      "adaptationReasons": ["難しい表現を分かりやすくしました。"],
      "confidence": 0.98,
      "warnings": []
    }
  ],
  "vocabularyCards": [],
  "quiz": [],
  "confidence": 0.98,
  "warnings": []
}

【最終自己検査】
JSONを出す直前に内部で必ず確認する。
1. 本文が英語長文ではなく日本語長文になっているか。
2. schemaVersion/mode/targetLevel/visibility/publicShareAllowed が指定どおりか。
3. 全 original.text が segments.surface の完全連結と1文字単位で一致するか。
4. 全 adapted.text が segments.surface の完全連結と1文字単位で一致するか。
5. reading と lemma と conjugation が文脈に合っているか。
6. vocabularyCards の sentenceId/segmentId が実在するか。
7. translation が原文の意味を変えていないか。
8. quiz の正答が一つに決まるか。
9. JSONとしてそのまま JSON.parse できるか。
10. JSON外の説明やMarkdownを一切付けていないか。`;
};
