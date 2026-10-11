/**
 * Database 層：優先連線雲端 API，失敗則退回 localStorage。
 * 對外方法一律回傳 Promise，方便 App 統一 await。
 */
window.GameDB = (() => {
  const STORE_KEY = 'math_game_platform_v1';
  let mode = 'local'; // 'cloud' | 'local'
  let apiBase = '';
  let ready = null;

  const EMPTY = () => ({
    meta: { version: 1, updatedAt: null },
    students: {},
    schedules: {},
    practiceBank: [],
    sessions: [],
    attempts: []
  });

  function localLoad() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return EMPTY();
      return { ...EMPTY(), ...JSON.parse(raw) };
    } catch {
      return EMPTY();
    }
  }

  function localSave(data) {
    data.meta = { version: 1, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    return data;
  }

  async function api(path, options = {}) {
    const res = await fetch(`${apiBase}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) {
      const err = new Error(body?.error || body?.errors?.join?.('; ') || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  async function init(options = {}) {
    if (ready) return ready;
    ready = (async () => {
      apiBase = (options.apiBase || '').replace(/\/$/, '');
      try {
        const health = await fetch(`${apiBase}/api/health`, { cache: 'no-store' });
        if (health.ok) {
          mode = 'cloud';
          return { mode, apiBase };
        }
      } catch {
        /* offline / file:// */
      }
      mode = 'local';
      return { mode, apiBase };
    })();
    return ready;
  }

  function getMode() { return mode; }
  function isCloud() { return mode === 'cloud'; }

  function studentKey(classCode, studentNo) {
    return `${String(classCode).trim().toUpperCase()}::${String(studentNo).trim()}`;
  }

  /* ——— local implementations ——— */
  function localGetOrCreateStudent({ classCode, studentNo, gradeId, displayName }) {
    const data = localLoad();
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
    localSave(data);
    return data.students[key];
  }

  function localUpdateStudentStats(studentId, goalId, { correct, score }) {
    const data = localLoad();
    const s = data.students[studentId];
    if (!s) return null;
    if (!s.stats[goalId]) {
      s.stats[goalId] = { attempts: 0, correct: 0, lastScore: 0, lastAt: null, streakWrong: 0 };
    }
    const st = s.stats[goalId];
    st.attempts += 1;
    if (correct) { st.correct += 1; st.streakWrong = 0; }
    else st.streakWrong += 1;
    st.lastScore = score;
    st.lastAt = new Date().toISOString();
    localSave(data);
    return st;
  }

  function localSetSchedule(gradeId, rows) {
    const data = localLoad();
    const resolved = [];
    const errors = [];
    rows.forEach((row, i) => {
      const r = Curriculum.resolveScheduleRow(gradeId, row);
      if (r.ok) resolved.push(r.item);
      else errors.push(`第 ${i + 1} 列：${r.error}`);
    });
    if (errors.length && !resolved.length) return { ok: false, errors };
    data.schedules[gradeId] = {
      uploadedAt: new Date().toISOString(),
      rows: resolved.sort((a, b) => a.week - b.week)
    };
    localSave(data);
    return { ok: true, errors, schedule: data.schedules[gradeId] };
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

  function localAddPracticeItem(item) {
    const data = localLoad();
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
    localSave(data);
    return { ok: true, item: record };
  }

  function localCreateSession({ studentId, gradeId, topicId, goalId, seed, questions }) {
    const data = localLoad();
    const session = {
      id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      studentId, gradeId, topicId, goalId, seed,
      questionCount: questions.length,
      createdAt: new Date().toISOString(),
      finishedAt: null, score: 0, correctCount: 0
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
    localSave(data);
    return session;
  }

  function localAnswerAttempt(attemptId, studentAnswer, isCorrect) {
    const data = localLoad();
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
      if (sessAttempts.length === session.questionCount) session.finishedAt = new Date().toISOString();
    }
    localSave(data);
    if (session) {
      localUpdateStudentStats(att.studentId, att.goalId, { correct: !!isCorrect, score: session.score });
    }
    return { attempt: att, session };
  }

  /* ——— public async API ——— */
  async function getOrCreateStudent(payload) {
    await init();
    if (mode === 'cloud') return api('/api/students', { method: 'POST', body: JSON.stringify(payload) });
    return localGetOrCreateStudent(payload);
  }

  async function getStudent(classCode, studentNo) {
    await init();
    if (mode === 'cloud') {
      try {
        return await api(`/api/students/${encodeURIComponent(classCode)}/${encodeURIComponent(studentNo)}`);
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    }
    return localLoad().students[studentKey(classCode, studentNo)] || null;
  }

  async function setSchedule(gradeId, rows) {
    await init();
    if (mode === 'cloud') {
      try {
        return await api(`/api/schedules/${encodeURIComponent(gradeId)}`, {
          method: 'PUT',
          body: JSON.stringify({ rows })
        });
      } catch (e) {
        return e.body || { ok: false, errors: [e.message] };
      }
    }
    return localSetSchedule(gradeId, rows);
  }

  async function getSchedule(gradeId) {
    await init();
    if (mode === 'cloud') return api(`/api/schedules/${encodeURIComponent(gradeId)}`);
    return localLoad().schedules[gradeId] || null;
  }

  async function addPracticeItem(item) {
    await init();
    if (mode === 'cloud') {
      try {
        return await api('/api/practice', { method: 'POST', body: JSON.stringify(item) });
      } catch (e) {
        return e.body || { ok: false, error: e.message };
      }
    }
    return localAddPracticeItem(item);
  }

  async function listPractice(filters = {}) {
    await init();
    if (mode === 'cloud') {
      const q = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
      const qs = q.toString();
      return api(`/api/practice${qs ? `?${qs}` : ''}`);
    }
    return localLoad().practiceBank.filter(p => {
      if (filters.gradeId && p.gradeId !== filters.gradeId) return false;
      if (filters.topicId && p.topicId !== filters.topicId) return false;
      if (filters.goalId && p.goalId !== filters.goalId) return false;
      if (filters.categoryId && p.categoryId !== filters.categoryId) return false;
      return true;
    });
  }

  async function createSession(payload) {
    await init();
    if (mode === 'cloud') {
      return api('/api/sessions', { method: 'POST', body: JSON.stringify(payload) });
    }
    return localCreateSession(payload);
  }

  async function getSessionQuestions(sessionId) {
    await init();
    if (mode === 'cloud') return api(`/api/sessions/${encodeURIComponent(sessionId)}/questions`);
    return localLoad().attempts
      .filter(a => a.sessionId === sessionId)
      .sort((a, b) => a.index - b.index);
  }

  async function answerAttempt(attemptId, studentAnswer, isCorrect) {
    await init();
    if (mode === 'cloud') {
      return api(`/api/attempts/${encodeURIComponent(attemptId)}/answer`, {
        method: 'POST',
        body: JSON.stringify({ studentAnswer, correct: !!isCorrect })
      });
    }
    return localAnswerAttempt(attemptId, studentAnswer, isCorrect);
  }

  async function getStudentSessions(studentId) {
    await init();
    if (mode === 'cloud') {
      return api(`/api/students-by-id/${encodeURIComponent(studentId)}/sessions`);
    }
    return localLoad().sessions
      .filter(s => s.studentId === studentId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  async function getClassOverview(classCode) {
    await init();
    if (mode === 'cloud') return api(`/api/classes/${encodeURIComponent(classCode)}/overview`);
    const data = localLoad();
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
      }));
    return { classCode: code, count: students.length, students };
  }

  async function exportSnapshot() {
    await init();
    if (mode === 'cloud') return api('/api/export');
    return localLoad();
  }

  function clearAll() {
    localStorage.removeItem(STORE_KEY);
  }

  /** 同步讀本地快照（測試／匯出後備）；雲端模式請用 exportSnapshot() */
  function load() {
    return localLoad();
  }

  return {
    STORE_KEY,
    init,
    getMode,
    isCloud,
    load,
    studentKey,
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
    getClassOverview,
    exportSnapshot,
    clearAll,
    fingerprintPractice
  };
})();
