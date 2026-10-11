/**
 * 純演算法隨機出題：每次登入 / 開局使用新 seed，避免固定清單。
 * 答案以可驗證數學結果為準，確保內容準確。
 */
window.QuestionEngine = (() => {
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFrom(studentId, goalId, nowMs) {
    const s = `${studentId}|${goalId}|${nowMs}|${Math.random()}`;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }

  function randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a || 1;
  }

  function simplify(n, d) {
    const g = gcd(n, d);
    return [n / g, d / g];
  }

  function fracHtml(n, d) {
    return `<span class="math-frac"><span class="math-num">${n}</span><span class="math-den">${d}</span></span>`;
  }

  function compareFracVsHalf(rng) {
    const den = randInt(rng, 3, 12);
    let num = randInt(rng, 1, den * 2);
    if (num === den / 2) num = Math.max(1, num - 1);
    const val = num / den;
    const half = 0.5;
    let answer;
    if (Math.abs(val - half) < 1e-9) answer = '=';
    else answer = val > half ? '>' : '<';
    return {
      prompt: `${fracHtml(num, den)} 與 ${fracHtml(1, 2)} 比較，結果是？`,
      choices: ['>', '<', '='],
      answer,
      explain: `將分數化小數約為 ${val.toFixed(3)}，與 0.5 比較。`
    };
  }

  function sameDenomCompare(rng) {
    const den = randInt(rng, 4, 12);
    let a = randInt(rng, 1, den - 1);
    let b = randInt(rng, 1, den - 1);
    while (a === b) b = randInt(rng, 1, den - 1);
    const answer = a > b ? 'A' : 'B';
    return {
      prompt: `哪個較大？ A: ${fracHtml(a, den)}　B: ${fracHtml(b, den)}`,
      choices: ['A', 'B'],
      answer,
      explain: '同分母時，分子較大者較大。'
    };
  }

  function sameNumerCompare(rng) {
    const num = randInt(rng, 1, 5);
    let d1 = randInt(rng, 3, 12);
    let d2 = randInt(rng, 3, 12);
    while (d1 === d2) d2 = randInt(rng, 3, 12);
    const answer = d1 < d2 ? 'A' : 'B';
    return {
      prompt: `哪個較大？ A: ${fracHtml(num, d1)}　B: ${fracHtml(num, d2)}`,
      choices: ['A', 'B'],
      answer,
      explain: '同分子時，分母較小者較大。'
    };
  }

  function improperToMixed(rng) {
    const whole = randInt(rng, 1, 4);
    const den = randInt(rng, 2, 9);
    const numPart = randInt(rng, 1, den - 1);
    const improper = whole * den + numPart;
    const answer = `${whole} ${numPart}/${den}`;
    return {
      prompt: `把假分數 ${fracHtml(improper, den)} 化為帶分數（格式如 2 1/3）`,
      choices: null,
      answer,
      input: true,
      explain: `${improper} ÷ ${den} = ${whole} …… ${numPart}`
    };
  }

  function sameDenomAdd(rng) {
    const den = randInt(rng, 4, 12);
    const a = randInt(rng, 1, den - 2);
    const b = randInt(rng, 1, den - a);
    const [n, d] = simplify(a + b, den);
    return {
      prompt: `${fracHtml(a, den)} + ${fracHtml(b, den)} = ?（請約簡，格式 n/d）`,
      choices: null,
      answer: `${n}/${d}`,
      input: true,
      explain: `分子相加得 ${a + b}/${den}，約簡為 ${n}/${d}。`
    };
  }

  function decimalCompare(rng) {
    const a = (randInt(rng, 10, 99) / 10).toFixed(1);
    let b = (randInt(rng, 10, 99) / 10).toFixed(1);
    while (b === a) b = (randInt(rng, 10, 99) / 10).toFixed(1);
    const answer = Number(a) > Number(b) ? a : b;
    return {
      prompt: `${a} 與 ${b}，哪個較大？`,
      choices: [a, b],
      answer,
      explain: '由左至右比較整數位再比較十分位。'
    };
  }

  function rectPerimeter(rng) {
    const l = randInt(rng, 3, 20);
    const w = randInt(rng, 2, 15);
    const answer = String(2 * (l + w));
    return {
      prompt: `長 ${l} cm、闊 ${w} cm 的長方形，周界是多少 cm？`,
      choices: null,
      answer,
      input: true,
      explain: `周界 = 2 × (${l} + ${w}) = ${answer}`
    };
  }

  function rectArea(rng) {
    const l = randInt(rng, 3, 20);
    const w = randInt(rng, 2, 15);
    return {
      prompt: `長 ${l} cm、闊 ${w} cm 的長方形，面積是多少 cm²？`,
      choices: null,
      answer: String(l * w),
      input: true,
      explain: `面積 = ${l} × ${w} = ${l * w}`
    };
  }

  function unlikeFracAdd(rng) {
    const d1 = pick(rng, [2, 3, 4, 5, 6]);
    let d2 = pick(rng, [2, 3, 4, 5, 6]);
    while (d2 === d1) d2 = pick(rng, [2, 3, 4, 5, 6]);
    const a = randInt(rng, 1, d1 - 1);
    const b = randInt(rng, 1, d2 - 1);
    const den = d1 * d2 / gcd(d1, d2);
    const num = a * (den / d1) + b * (den / d2);
    const [n, d] = simplify(num, den);
    return {
      prompt: `${fracHtml(a, d1)} + ${fracHtml(b, d2)} = ?（約簡，格式 n/d）`,
      choices: null,
      answer: `${n}/${d}`,
      input: true,
      explain: `通分後相加再約簡得 ${n}/${d}。`
    };
  }

  function decimalTimesInt(rng) {
    const dec = (randInt(rng, 11, 99) / 10).toFixed(1);
    const n = randInt(rng, 2, 9);
    const product = (Number(dec) * n).toFixed(1).replace(/\.0$/, '');
    return {
      prompt: `${dec} × ${n} = ?`,
      choices: null,
      answer: String(Number(dec) * n),
      accept: [String(Number(dec) * n), product],
      input: true,
      explain: `先當整數相乘再還原小數位。`
    };
  }

  function percentOf(rng) {
    const whole = randInt(rng, 20, 200);
    const pct = pick(rng, [10, 20, 25, 50, 75]);
    const answer = String((whole * pct) / 100);
    return {
      prompt: `${whole} 的 ${pct}% 是多少？`,
      choices: null,
      answer,
      input: true,
      explain: `${whole} × ${pct}/100 = ${answer}`
    };
  }

  function triangleArea(rng) {
    const base = randInt(rng, 4, 20);
    const height = randInt(rng, 4, 16);
    const area = (base * height) / 2;
    return {
      prompt: `底 ${base} cm、高 ${height} cm 的三角形，面積是多少 cm²？`,
      choices: null,
      answer: String(area),
      input: true,
      explain: `面積 = ${base} × ${height} ÷ 2 = ${area}`
    };
  }

  function discountPrice(rng) {
    const price = pick(rng, [80, 100, 120, 150, 200]);
    const fold = pick(rng, [7, 8, 9]); // 幾折
    const sold = (price * fold) / 10;
    return {
      prompt: `原價 $${price}，打 ${fold} 折後售價是多少？`,
      choices: null,
      answer: String(sold),
      input: true,
      explain: `售價 = ${price} × ${fold}/10 = ${sold}`
    };
  }

  function speedDistance(rng) {
    const speed = pick(rng, [40, 50, 60, 80]);
    const time = pick(rng, [2, 3, 4, 5]);
    const dist = speed * time;
    return {
      prompt: `以每小時 ${speed} km 行駛 ${time} 小時，路程是多少 km？`,
      choices: null,
      answer: String(dist),
      input: true,
      explain: `路程 = 速率 × 時間 = ${dist}`
    };
  }

  const GENERATORS = {
    'p4-t1-g1': compareFracVsHalf,
    'p4-t1-g2': sameDenomCompare,
    'p4-t1-g3': sameNumerCompare,
    'p4-t1-g4': improperToMixed,
    'p4-t2-g1': improperToMixed,
    'p4-t2-g2': improperToMixed,
    'p4-t3-g1': sameDenomAdd,
    'p4-t4-g2': decimalCompare,
    'p4-t5-g1': rectPerimeter,
    'p4-t5-g2': rectArea,
    'p5-t1-g1': unlikeFracAdd,
    'p5-t2-g1': decimalTimesInt,
    'p5-t4-g1': triangleArea,
    'p5-t5-g3': percentOf,
    'p6-t3-g1': discountPrice,
    'p6-t5-g2': speedDistance
  };

  function fallback(rng, goalText) {
    const a = randInt(rng, 2, 20);
    const b = randInt(rng, 2, 20);
    return {
      prompt: `（${goalText}）熱身：${a} + ${b} = ?`,
      choices: null,
      answer: String(a + b),
      input: true,
      explain: `${a} + ${b} = ${a + b}`
    };
  }

  function normalizeAnswer(v) {
    return String(v ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/／/g, '/');
  }

  function checkAnswer(question, studentAnswer) {
    const sa = normalizeAnswer(studentAnswer);
    if (question.accept && question.accept.some(a => normalizeAnswer(a) === sa)) return true;
    return normalizeAnswer(question.answer) === sa;
  }

  /**
   * 每次開局產生全新隨機題組；以 fingerprint 去重避免同一局內重複。
   */
  function generateSet({ studentId, goalId, goalText, count = 8 }) {
    const seed = seedFrom(studentId, goalId, Date.now());
    const rng = mulberry32(seed);
    const gen = GENERATORS[goalId] || ((r) => fallback(r, goalText));
    const seen = new Set();
    const questions = [];
    let guard = 0;
    while (questions.length < count && guard < count * 30) {
      guard++;
      const q = gen(rng);
      const fp = normalizeAnswer(q.prompt.replace(/<[^>]+>/g, '')) + '|' + normalizeAnswer(q.answer);
      if (seen.has(fp)) continue;
      seen.add(fp);
      questions.push({
        ...q,
        id: `q_${seed}_${questions.length}`,
        seed,
        goalId
      });
    }
    return { seed, questions };
  }

  return {
    seedFrom,
    generateSet,
    checkAnswer,
    GENERATORS
  };
})();
