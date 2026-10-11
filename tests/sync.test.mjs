/**
 * 雲端同步測試：兩名「學生」共用同一伺服器資料庫
 */
const BASE = process.env.SYNC_URL || 'http://127.0.0.1:8787';

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const body = await res.json();
  if (!res.ok && !body.ok && !body.errors) {
    throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`);
  }
  return { status: res.status, body };
}

let failed = 0;
function assert(cond, msg) {
  if (!cond) { failed++; console.error('FAIL:', msg); }
  else console.log('OK:', msg);
}

const health = await api('/api/health');
assert(health.body.ok === true, 'health ok');

const stamp = Date.now();
const s1 = await api('/api/students', {
  method: 'POST',
  body: JSON.stringify({ classCode: '4A', studentNo: `T${stamp}a`, gradeId: 'p4' })
});
const s2 = await api('/api/students', {
  method: 'POST',
  body: JSON.stringify({ classCode: '4A', studentNo: `T${stamp}b`, gradeId: 'p4' })
});
assert(s1.body.id && s2.body.id && s1.body.id !== s2.body.id, 'two students created');

const schedule = await api('/api/schedules/p4', {
  method: 'PUT',
  body: JSON.stringify({
    rows: [{
      week: 1,
      topic: '如何比較分數',
      goal: '比較分數與基準值（例如 1/2 或 1）',
      startDate: '2026-01-01',
      endDate: '2026-12-31'
    }]
  })
});
assert(schedule.body.ok === true, 'schedule synced on server');

const pracTitle = `同步練習-${stamp}`;
const prac = await api('/api/practice', {
  method: 'POST',
  body: JSON.stringify({
    gradeId: 'p4',
    topicId: 'p4-t1',
    goalId: 'p4-t1-g1',
    categoryId: 'game',
    title: pracTitle,
    promptHint: 'shared',
    verifiedAccurate: true
  })
});
assert(prac.body.ok === true, 'practice added on server');

const list = await api('/api/practice?gradeId=p4');
assert(list.body.some(p => p.title === pracTitle), 'both clients would see shared practice bank');

const session = await api('/api/sessions', {
  method: 'POST',
  body: JSON.stringify({
    studentId: s1.body.id,
    gradeId: 'p4',
    topicId: 'p4-t1',
    goalId: 'p4-t1-g1',
    seed: 12345,
    questions: [
      { prompt: '1+1?', answer: '2' },
      { prompt: '2+2?', answer: '4' }
    ]
  })
});
assert(session.status === 201 && session.body.id, 'session created');

const qs = await api(`/api/sessions/${session.body.id}/questions`);
assert(qs.body.length === 2, 'session questions persisted');

await api(`/api/attempts/${qs.body[0].id}/answer`, {
  method: 'POST',
  body: JSON.stringify({ studentAnswer: '2', correct: true })
});
await api(`/api/attempts/${qs.body[1].id}/answer`, {
  method: 'POST',
  body: JSON.stringify({ studentAnswer: '4', correct: true })
});

const overview = await api(`/api/classes/4A/overview`);
assert(overview.body.students.some(s => s.studentNo === `T${stamp}a`), 'class overview includes student A');
assert(overview.body.students.some(s => s.studentNo === `T${stamp}b`), 'class overview includes student B');

const bad = await api('/api/schedules/p4', {
  method: 'PUT',
  body: JSON.stringify({ rows: [{ week: 9, topic: '假課題' }] })
});
assert(bad.body.ok === false, 'server rejects unknown textbook topic');

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll sync tests passed');
