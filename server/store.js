/**
 * 伺服器端持久化資料庫（JSON 檔）
 * 與前端 GameDB schema 對齊，供多裝置／多學生連線共用。
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function loadCurriculum() {
  const code = fs.readFileSync(path.join(__dirname, '../js/curriculum.js'), 'utf8');
  const sandbox = {
    window: {},
    Object,
    Array,
    String,
    Number,
    Math,
    console,
    Date
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'curriculum.js' });
  return sandbox.Curriculum;
}

const Curriculum = loadCurriculum();

function empty() {
  return {
    meta: { version: 1, updatedAt: null },
    students: {},
    schedules: {},
    practiceBank: [],
    sessions: [],
    attempts: []
  };
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(empty(), null, 2));
  }
}

function load() {
  ensure();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return { ...empty(), ...JSON.parse(raw) };
  } catch {
    return empty();
  }
}

function save(data) {
  ensure();
  data.meta = { version: 1, updatedAt: new Date().toISOString() };
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_PATH);
  return data;
}

function studentKey(classCode, studentNo) {
  return `${String(classCode).trim().toUpperCase()}::${String(studentNo).trim()}`;
}

function getOrCreateStudent({ classCode, studentNo, gradeId, displayName }) {
  const data = load();
  const key = studentKey(classCode, studentNo);
  if (!data.students[key]) {
    data.students[key] = {
      id: key,
      classCode: String(classCode).trim().toUpperCase(),
      studentNo: String(studentNo).trim(),
      gradeId: gradeId || 'p4',
      displayName: displayName || `${classCode}-${studentNo}`,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      stats: {}
    };
  }
  data.students[key].lastLoginAt = new Date().toISOString();
  if (gradeId) data.students[key].gradeId = gradeId;
  save(data);
  return data.students[key];
}

function getStudent(classCode, studentNo) {
  return load().students[studentKey(classCode, studentNo)] || null;
}

function updateStudentStats(studentId, goalId, { correct, score }) {
  const data = load();
  const s = data.students[studentId];
  if (!s) return null;
  if (!s.stats[goalId]) {
    s.stats[goalId] = { attempts: 0, correct: 0, lastScore: 0, lastAt: null, streakWrong: 0 };
  }
  const st = s.stats[goalId];
  st.attempts += 1;
  if (correct) {
    st.correct += 1;
    st.streakWrong = 0;
  } else {
    st.streakWrong += 1;
  }
  st.lastScore = score;
  st.lastAt = new Date().toISOString();
  save(data);
  return st;
}

function setSchedule(gradeId, rows) {
  const data = load();
  const resolved = [];
  const errors = [];
  rows.forEach((row, i) => {
    const r = Curriculum.resolveScheduleRow(gradeId, row);
    if (r.ok) resolved.push(r.item);
    else errors.push(`第 ${i + 1} 列：${r.error}`);
  });
  if (errors.length && !resolved.length) {
    return { ok: false, errors };
  }
  data.schedules[gradeId] = {
    uploadedAt: new Date().toISOString(),
    rows: resolved.sort((a, b) => a.week - b.week)
  };
  save(data);
  return { ok: true, errors, schedule: data.schedules[gradeId] };
}

function getSchedule(gradeId) {
  return load().schedules[gradeId] || null;
}

function normalizePracticeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。、！？,.!?：:；;（）()【】\[\]「」""'']/g, '');
}

function fingerprintPractice({ goalId, categoryId, title, promptHint }) {
  return `${goalId}|${categoryId}|${normalizePracticeText(title)}|${normalizePracticeText(promptHint)}`;
}

function addPracticeItem(item) {
  const data = load();
  const goal = Curriculum.findGoal(item.gradeId, item.topicId, item.goalId);
  if (!goal) return { ok: false, error: '只能掛載在已鎖定的課本目標之下' };

  const categoryOk = Curriculum.PRACTICE_CATEGORIES.some(c => c.id === item.categoryId);
  if (!categoryOk) return { ok: false, error: '未知練習範疇' };

  const fp = fingerprintPractice(item);
  const dup = data.practiceBank.find(p => p.fingerprint === fp);
  if (dup) return { ok: false, error: '內容重複：相同目標、範疇與練習描述已存在', duplicateOf: dup.id };

  const near = data.practiceBank.find(p =>
    p.goalId === item.goalId &&
    p.categoryId === item.categoryId &&
    normalizePracticeText(p.title) === normalizePracticeText(item.title)
  );
  if (near) return { ok: false, error: '標題重複：請調整練習名稱以避免重疊', duplicateOf: near.id };

  const record = {
    id: `prac_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    gradeId: item.gradeId,
    topicId: item.topicId,
    goalId: goal.id,
    categoryId: item.categoryId,
    title: String(item.title).trim(),
    promptHint: String(item.promptHint || '').trim(),
    gameType: item.gameType || '接球 🧺',
    verifiedAccurate: !!item.verifiedAccurate,
    fingerprint: fp,
    createdAt: new Date().toISOString()
  };
  data.practiceBank.push(record);
  save(data);
  return { ok: true, item: record };
}

function listPractice(filters = {}) {
  return load().practiceBank.filter(p => {
    if (filters.gradeId && p.gradeId !== filters.gradeId) return false;
    if (filters.topicId && p.topicId !== filters.topicId) return false;
    if (filters.goalId && p.goalId !== filters.goalId) return false;
    if (filters.categoryId && p.categoryId !== filters.categoryId) return false;
    return true;
  });
}

function createSession({ studentId, gradeId, topicId, goalId, seed, questions }) {
  const data = load();
  const session = {
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    studentId,
    gradeId,
    topicId,
    goalId,
    seed,
    questionCount: questions.length,
    createdAt: new Date().toISOString(),
    finishedAt: null,
    score: 0,
    correctCount: 0
  };
  data.sessions.push(session);
  questions.forEach((q, idx) => {
    data.attempts.push({
      id: `att_${session.id}_${idx}`,
      sessionId: session.id,
      studentId,
      goalId,
      index: idx,
      prompt: q.prompt,
      answer: q.answer,
      studentAnswer: null,
      correct: null,
      answeredAt: null
    });
  });
  save(data);
  return session;
}

function getSessionQuestions(sessionId) {
  return load().attempts
    .filter(a => a.sessionId === sessionId)
    .sort((a, b) => a.index - b.index);
}

function answerAttempt(attemptId, studentAnswer, isCorrect) {
  const data = load();
  const att = data.attempts.find(a => a.id === attemptId);
  if (!att) return null;
  att.studentAnswer = studentAnswer;
  att.correct = !!isCorrect;
  att.answeredAt = new Date().toISOString();

  const session = data.sessions.find(s => s.id === att.sessionId);
  if (session) {
    const sessAttempts = data.attempts.filter(a => a.sessionId === session.id && a.correct !== null);
    session.correctCount = sessAttempts.filter(a => a.correct).length;
    session.score = Math.round((session.correctCount / session.questionCount) * 100);
    if (sessAttempts.length === session.questionCount) {
      session.finishedAt = new Date().toISOString();
    }
  }
  save(data);
  if (session) {
    updateStudentStats(att.studentId, att.goalId, {
      correct: !!isCorrect,
      score: session.score
    });
  }
  // reload after stats update
  const fresh = load();
  return {
    attempt: fresh.attempts.find(a => a.id === attemptId),
    session: fresh.sessions.find(s => s.id === att.sessionId),
    student: fresh.students[att.studentId]
  };
}

function getStudentSessions(studentId) {
  return load().sessions
    .filter(s => s.studentId === studentId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function exportSnapshot() {
  return load();
}

function classOverview(classCode) {
  const data = load();
  const code = String(classCode).trim().toUpperCase();
  const students = Object.values(data.students)
    .filter(s => s.classCode === code)
    .map(s => ({
      id: s.id,
      studentNo: s.studentNo,
      gradeId: s.gradeId,
      lastLoginAt: s.lastLoginAt,
      sessionCount: data.sessions.filter(x => x.studentId === s.id).length,
      avgScore: (() => {
        const done = data.sessions.filter(x => x.studentId === s.id && x.finishedAt);
        if (!done.length) return null;
        return Math.round(done.reduce((a, b) => a + b.score, 0) / done.length);
      })()
    }))
    .sort((a, b) => String(a.studentNo).localeCompare(String(b.studentNo), undefined, { numeric: true }));
  return { classCode: code, count: students.length, students };
}

export {
  Curriculum,
  getOrCreateStudent,
  getStudent,
  setSchedule,
  getSchedule,
  addPracticeItem,
  listPractice,
  createSession,
  getSessionQuestions,
  answerAttempt,
  getStudentSessions,
  exportSnapshot,
  classOverview,
  studentKey
};
