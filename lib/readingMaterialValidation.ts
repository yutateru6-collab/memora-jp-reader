const JAPANESE_RE = /[ぁ-んァ-ン一-龯]/;
const ENGLISH_RE = /[A-Za-z]/;
const SEPARATOR = '----------';
const ALLOWED_CARD_KEYS = ['back', 'front', 'memo', 'pronunciation'];
const MEMO_HEADINGS = ['【語源・雑学】', '【覚え方】', '【例文】'];

export interface ReadingMaterialValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cardCount: number | null;
}

const stripStandaloneCodeFences = (value: string) => value
  .split(/\r?\n/)
  .filter(line => !/^\s*```(?:markdown|text|json)?\s*$/i.test(line))
  .join('\n')
  .trim();

const countOccurrences = (text: string, needle: string) => {
  let count = 0;
  let start = 0;
  while (true) {
    const index = text.indexOf(needle, start);
    if (index === -1) return count;
    count += 1;
    start = index + needle.length;
  }
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseProfile = (lines: string[]) => {
  const headerIndex = lines.findIndex(line => line === '【解説担当】');
  if (headerIndex === -1) return { headerIndex, name: '', role: '', trait: '', contentStart: 0 };

  let name = '';
  let role = '';
  let trait = '';
  let contentStart = headerIndex + 1;

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const nameMatch = line.match(/^名前\s*[:：]\s*(.+)$/);
    const roleMatch = line.match(/^役割\s*[:：]\s*(.+)$/);
    const traitMatch = line.match(/^性格\s*[:：]\s*(.+)$/);
    if (nameMatch) name = nameMatch[1].trim();
    else if (roleMatch) role = roleMatch[1].trim();
    else if (traitMatch) trait = traitMatch[1].trim();
    else if (ENGLISH_RE.test(line) && !JAPANESE_RE.test(line)) {
      contentStart = index;
      break;
    }
    contentStart = index + 1;
  }

  return { headerIndex, name, role, trait, contentStart };
};

export const validateGeneratedReadingMaterial = (rawValue: string): ReadingMaterialValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw = rawValue.trim();

  if (!raw) {
    return { valid: false, errors: ['教材データが空です。'], warnings, cardCount: null };
  }

  if (/```/.test(raw)) {
    errors.push('Markdownのコードフェンス（```）を削除してください。');
  }

  const tokenCount = countOccurrences(raw, SEPARATOR);
  const standaloneCount = (raw.match(/^\s*----------\s*$/gm) || []).length;
  if (tokenCount !== 2 || standaloneCount !== 2) {
    errors.push(`区切り行「----------」は独立した行として厳密に2回必要です（現在 ${tokenCount} 回）。`);
  }

  const parts = raw.split(SEPARATOR);
  if (parts.length !== 3) {
    return { valid: false, errors, warnings, cardCount: null };
  }

  const transcriptText = stripStandaloneCodeFences(parts[0]);
  const wordJsonText = stripStandaloneCodeFences(parts[1]);
  const backgroundText = stripStandaloneCodeFences(parts[2]);
  const transcriptLines = transcriptText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const profile = parseProfile(transcriptLines);

  if (profile.headerIndex === -1) errors.push('先頭部分に「【解説担当】」がありません。');
  if (!profile.name) errors.push('解説担当の「名前:」がありません。');
  if (!profile.role) errors.push('解説担当の「役割:」がありません。');
  if (!profile.trait) errors.push('解説担当の「性格:」がありません。');

  const contentLines = transcriptLines.slice(profile.contentStart);
  if (contentLines.length === 0) {
    errors.push('英文・日本語訳・解説がありません。');
  } else if (contentLines.length % 3 !== 0) {
    errors.push('本文は「英文1行→日本語訳1行→解説1行」の3行単位にしてください。');
  }

  const englishSentences: string[] = [];
  const tripleCount = Math.floor(contentLines.length / 3);
  for (let index = 0; index < tripleCount; index += 1) {
    const english = contentLines[index * 3] || '';
    const japanese = contentLines[index * 3 + 1] || '';
    const explanation = contentLines[index * 3 + 2] || '';
    const sentenceLabel = `${index + 1}文目`;

    if (!ENGLISH_RE.test(english) || JAPANESE_RE.test(english) || english.startsWith('[解説]')) {
      errors.push(`${sentenceLabel}の英文行を正しく認識できません。英文1文だけを1行で置き、日本語文字を混ぜないでください。`);
    } else {
      englishSentences.push(english);
    }

    if (!JAPANESE_RE.test(japanese) || japanese.startsWith('[解説]')) {
      errors.push(`${sentenceLabel}の日本語訳行を正しく認識できません。`);
    }

    const explanationMatch = explanation.match(/^\[解説\]\s*([^（(：:]+)\s*[（(]([^）)]+)[）)]\s*[:：]\s*(.+)$/);
    if (!explanationMatch) {
      errors.push(`${sentenceLabel}の解説は「[解説] 名前（役割）: コメント」の1行形式にしてください。`);
    } else {
      const [, speakerName, speakerRole, comment] = explanationMatch;
      if (profile.name && speakerName.trim() !== profile.name) {
        errors.push(`${sentenceLabel}の解説者名「${speakerName.trim()}」がプロフィール名「${profile.name}」と一致していません。`);
      }
      if (profile.role && speakerRole.trim() !== profile.role) {
        errors.push(`${sentenceLabel}の役割「${speakerRole.trim()}」がプロフィール役割「${profile.role}」と一致していません。`);
      }
      if (!comment.trim()) errors.push(`${sentenceLabel}の解説コメントが空です。`);
    }
  }

  let cardCount: number | null = null;
  try {
    const parsed = JSON.parse(wordJsonText);
    if (!Array.isArray(parsed)) {
      errors.push('単語部分はJSON配列にしてください。');
    } else {
      cardCount = parsed.length;
      if (parsed.length !== 30) errors.push(`単語カードは厳密に30件必要です（現在 ${parsed.length} 件）。`);

      const seenFronts = new Set<string>();
      const englishCorpus = englishSentences.join(' ');

      parsed.forEach((item, index) => {
        const cardLabel = `単語カード${index + 1}`;
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`${cardLabel}がJSONオブジェクトではありません。`);
          return;
        }

        const keys = Object.keys(item).sort();
        if (keys.length !== ALLOWED_CARD_KEYS.length || keys.some((key, keyIndex) => key !== ALLOWED_CARD_KEYS[keyIndex])) {
          errors.push(`${cardLabel}のキーは front / back / pronunciation / memo の4つだけにしてください。`);
        }

        for (const key of ALLOWED_CARD_KEYS) {
          if (typeof item[key] !== 'string' || !item[key].trim()) {
            errors.push(`${cardLabel}の「${key}」は空でない文字列にしてください。`);
          }
        }

        if (typeof item.front !== 'string') return;
        const front = item.front.trim();
        const normalizedFront = front.toLowerCase();
        if (!/^[A-Za-z]+(?:[-'][A-Za-z]+)*$/.test(front)) {
          errors.push(`${cardLabel}のfront「${front}」は英単語だけにしてください。`);
        }
        if (seenFronts.has(normalizedFront)) {
          errors.push(`front「${front}」が重複しています。`);
        }
        seenFronts.add(normalizedFront);

        if (front && englishCorpus && !new RegExp(`(^|[^A-Za-z])${escapeRegExp(front)}(?=$|[^A-Za-z])`, 'i').test(englishCorpus)) {
          errors.push(`front「${front}」が本文の英文行に見つかりません。本文に実際に出た綴りを使ってください。`);
        }

        if (typeof item.pronunciation === 'string' && !/\[[^\]]+\]/.test(item.pronunciation)) {
          errors.push(`${cardLabel}のpronunciationは最も強く読む部分を半角[ ]で囲んでください。`);
        }

        if (typeof item.memo === 'string') {
          const memo = item.memo;
          const positions = MEMO_HEADINGS.map(heading => memo.indexOf(heading));
          MEMO_HEADINGS.forEach(heading => {
            if (countOccurrences(memo, heading) !== 1) {
              errors.push(`${cardLabel}のmemoでは「${heading}」を1回だけ使ってください。`);
            }
          });
          if (positions.some(position => position === -1) || !(positions[0] < positions[1] && positions[1] < positions[2])) {
            errors.push(`${cardLabel}のmemo見出しは「語源・雑学→覚え方→例文」の順にしてください。`);
          }
          if (memo.includes(SEPARATOR)) errors.push(`${cardLabel}のmemoに区切り行文字列を入れないでください。`);
        }
      });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    errors.push(`単語JSONを解析できません。JSONの引用符・カンマ・\\nを確認してください（${detail}）。`);
  }

  if (!backgroundText) {
    errors.push('2つ目の区切り行の後に背景知識を入れてください。');
  } else if (backgroundText.length < 180 || backgroundText.length > 750) {
    warnings.push(`背景知識は約400文字が目安です（現在 ${backgroundText.length} 文字）。`);
  }

  return { valid: errors.length === 0, errors, warnings, cardCount };
};

export const formatReadingMaterialValidationError = (result: ReadingMaterialValidationResult) => {
  const shown = result.errors.slice(0, 6);
  const remaining = result.errors.length - shown.length;
  return `READON教材データを取り込めません。\n${shown.map((error, index) => `${index + 1}. ${error}`).join('\n')}${remaining > 0 ? `\nほか ${remaining} 件の問題があります。` : ''}`;
};
