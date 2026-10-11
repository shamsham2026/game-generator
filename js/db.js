/**
 * 本地 database 層（localStorage）
 * 結構對齊未來雲端 DB：students / schedules / practice_bank / sessions / attempts
 * 內容準確性：練習以 fingerprint 去重；課題目標永不寫入可改欄位。
 */
window.GameDB = (() => {
  const STORE_KEY = 'math_game_platform_v1';

  const EMPTY = () => ({
    meta: { version: 1, updatedAt: null },
    students: {},
    schedules: {},       // gradeId -> { uploadedAt, rows[] }
    practiceBank: [],    // 範疇練習模板（可新增，不可改 locked goals）
    sessions: [],
    attempts: []
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return EMPTY();
      const data = JSON.parse(raw);
      return { ...EMPTY(), ...data };
    } catch {
      return EMPTY();
    }
  }

  function save(data) {
    data.meta = { version: 1, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
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
        stats: {} // goalId -> { attempts, correct, lastScore, lastAt, streakWrong }
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

    // 同目標同範疇下標題高度相似亦擋下
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

  function listPractice({ gradeId, topicId, goalId, categoryId } = {}) {
    return load().practiceBank.filter(p => {
      if (gradeId && p.gradeId !== gradeId) return false;
      if (topicId && p.topicId !== topicId) return false;
      if (goalId && p.goalId !== goalId) return false;
      if (categoryId && p.categoryId !== categoryId) return false;
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
    return { attempt: att, session };
  }

  function getStudentSessions(studentId) {
    return load().sessions
      .filter(s => s.studentId === studentId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  function exportSnapshot() {
    return load();
  }

  function clearAll() {
    localStorage.removeItem(STORE_KEY);
  }

  return {
    STORE_KEY,
    load,
    studentKey,
    getOrCreateStudent,
    getStudent,
    updateStudentStats,
    setSchedule,
    getSchedule,
    addPracticeItem,
    listPractice,
    createSession,
    getSessionQuestions,
    answerAttempt,
    getStudentSessions,
    exportSnapshot,
    clearAll,
    fingerprintPractice
  };
})();
