export const QA_FRONT_WORDS = [
  'students', 'analyze', 'ramen', 'culture', 'region', 'links', 'broth', 'noodles', 'flavor', 'tradition',
  'recipe', 'shop', 'chef', 'customer', 'community', 'history', 'ingredient', 'texture', 'aroma', 'style',
  'innovation', 'local', 'pride', 'popular', 'appeal', 'meal', 'customs', 'bowl', 'design', 'identity',
];

const sentence = 'Students analyze ramen culture by asking how each region links broth, noodles, flavor, tradition, recipe, shop, chef, customer, community, history, ingredient, texture, aroma, style, innovation, local pride, popular appeal, meal customs, bowl design, and identity.';
const translation = '学生は、各地域がスープ、麺、風味、伝統などをどのように結びつけ、ラーメン文化のアイデンティティを形作るのかを分析します。';
const background = 'ラーメンは、麺・スープ・具材の組み合わせによって地域差が生まれやすい料理です。同じ名称でも、地域の食材、気候、流通、店の歴史などによって味や提供方法が変わります。英語で文化を読むときは、単に有名な料理として覚えるのではなく、どの要素が地域性を作っているのかを見ると理解が深まります。このQA教材では、本文・対訳・解説・単語カードの対応関係と、貼り付けから保存完了までが正しく機能するかを確認します。';

export const buildValidQaMaterial = ({ cardCount = 30, paragraphCount = 1 } = {}) => {
  const cards = QA_FRONT_WORDS.slice(0, cardCount).map((front, index) => ({
    front,
    back: `QA確認語${index + 1}`,
    pronunciation: 'テ[ス]ト',
    memo: `【語源・雑学】READONのQAで使う確認用データ。\n【覚え方】${front}を本文の語と結びつけて覚える。\n【例文】The word ${front} appears in this QA example.`,
  }));
  const transcript = Array.from({ length: paragraphCount }, (_, index) => [
    sentence,
    translation,
    `[解説] ひなた（やさしく導く高校教師）: ${index + 1}文目は、主語 (S) のStudentsと動詞 (V) のanalyzeを中心に、地域ごとの要素がidentityへつながる構造を確認します。`,
  ].join('\n')).join('\n');

  return `【解説担当】
名前: ひなた
役割: やさしく導く高校教師
性格: やさしくて、まなびを楽しませてくれる！

${transcript}
----------
${JSON.stringify(cards, null, 2)}
----------
${background}`;
};
