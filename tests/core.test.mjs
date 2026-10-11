/**
 * Node 煙霧測試：課程鎖定、去重、隨機 seed、進度表解析約束（本地模式）
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const local = new Map();
const sandbox = {
  window: {},
  console,
  Math,
  Date,
  JSON,
  Object,
  Array,
  String,
  Number,
  Set,
  Map,
  Promise,
  fetch: async () => { throw new Error('offline'); },
  localStorage: {
    getItem: (k) => (local.has(k) ? local.get(k) : null),
    setItem: (k, v) => local.set(k, String(v)),
    removeItem: (k) => local.delete(k)
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

function load(name) {
  const code = readFileSync(join(root, 'js', name), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: name });
}

load('curriculum.js');
load('db.js');
load('questions.js');
load('recommend.js');

const { Curriculum, GameDB, QuestionEngine, Recommend } = sandbox;
let failed = 0;
function assert(cond, msg) {
  if (!cond) {
    failed++;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

await GameDB.init();
assert(GameDB.getMode() === 'local', 'falls back to local when API unavailable');

const g = Curriculum.findGoal('p4', 'p4-t1', 'p4-t1-g1');
assert(g && g.text.includes('基準值'), 'locked goal readable');
assert(Object.isFrozen(Curriculum.LOCKED.p4), 'grade frozen');

const bad = await GameDB.setSchedule('p4', [{ week: 1, topic: '不存在的課題' }]);
assert(!bad.ok, 'reject unknown topic in schedule');

const good = await GameDB.setSchedule('p4', [{
  week: 1,
  topic: '如何比較分數',
  goal: '比較分數與基準值（例如 1/2 或 1）',
  startDate: '2026-09-01',
  endDate: '2026-09-14'
}]);
assert(good.ok && good.schedule.rows.length === 1, 'accept matching textbook topic/goal');
assert(good.schedule.rows[0].topicId === 'p4-t1', 'stores topic id reference only');

const p1 = await GameDB.addPracticeItem({
  gradeId: 'p4', topicId: 'p4-t1', goalId: 'p4-t1-g1',
  categoryId: 'operation', title: '基準值接球', promptHint: '大於1/2',
  verifiedAccurate: true
});
assert(p1.ok, 'add practice');
const p2 = await GameDB.addPracticeItem({
  gradeId: 'p4', topicId: 'p4-t1', goalId: 'p4-t1-g1',
  categoryId: 'operation', title: '基準值接球', promptHint: '大於1/2',
  verifiedAccurate: true
});
assert(!p2.ok, 'duplicate practice blocked');

const student = await GameDB.getOrCreateStudent({ classCode: '4A', studentNo: '12', gradeId: 'p4' });
const a = QuestionEngine.generateSet({ studentId: student.id, goalId: 'p4-t1-g1', goalText: 'x', count: 6 });
const origNow = Date.now;
let t = Date.now() + 99999;
Date.now = () => t;
const b = QuestionEngine.generateSet({ studentId: student.id, goalId: 'p4-t1-g1', goalText: 'x', count: 6 });
Date.now = origNow;
assert(a.seed !== b.seed, 'different seeds across sessions');
assert(a.questions.length === 6, 'question count');
assert(QuestionEngine.checkAnswer(a.questions[0], a.questions[0].answer), 'answer check exact');

const tips = await Recommend.suggestForStudent(student, 3);
assert(tips.length === 3 && tips[0].topicTitle, 'recommendations produced');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll core tests passed');
