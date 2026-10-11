/**
 * 公開學生練習平台 + 教師管理 主控（支援雲端同步）
 */
window.App = (() => {
  let currentStudent = null;
  let practiceSession = null;
  let practiceQueue = [];
  let practiceIndex = 0;

  function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    t.classList.remove('translate-y-20', 'opacity-0');
    t.classList.add('translate-y-0', 'opacity-100');
    setTimeout(() => {
      t.classList.remove('translate-y-0', 'opacity-100');
      t.classList.add('translate-y-20', 'opacity-0');
    }, 3000);
  }

  function showView(id) {
    document.querySelectorAll('[data-view]').forEach(el => {
      el.classList.toggle('hidden', el.dataset.view !== id);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateConnBadge() {
    const el = document.getElementById('conn-badge');
    if (!el) return;
    if (GameDB.isCloud()) {
      el.textContent = '已連線 · 全班資料同步';
      el.className = 'conn-badge conn-cloud';
    } else {
      el.textContent = '離線模式 · 僅本機儲存';
      el.className = 'conn-badge conn-local';
    }
  }

  async function init() {
    PromptGenerator.init();
    fillGradeSelects();
    fillPracticeFormSelects();
    bindTeacherPracticeForm();
    await GameDB.init();
    updateConnBadge();
    await renderCurriculumLockPanel();
    showView('home');
  }

  function fillGradeSelects() {
    const html = Curriculum.listGrades().map(g =>
      `<option value="${g.id}">${g.name}</option>`
    ).join('');
    ['student-grade', 'schedule-grade', 'prac-grade'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
  }

  function fillPracticeFormSelects() {
    const cat = document.getElementById('prac-category');
    if (cat) {
      cat.innerHTML = Curriculum.PRACTICE_CATEGORIES.map(c =>
        `<option value="${c.id}">${c.label}</option>`
      ).join('');
    }
    const game = document.getElementById('prac-game');
    if (game) {
      game.innerHTML = PromptGenerator.optionsData.gameType.map(g =>
        `<option value="${g}">${g}</option>`
      ).join('');
    }
    onPracGradeChange();
  }

  function onPracGradeChange() {
    const gradeId = document.getElementById('prac-grade')?.value || 'p4';
    const grade = Curriculum.getGrade(gradeId);
    const topicSel = document.getElementById('prac-topic');
    if (!topicSel || !grade) return;
    topicSel.innerHTML = grade.topics.map(t =>
      `<option value="${t.id}">${t.title}</option>`
    ).join('');
    onPracTopicChange();
    renderPracticeBankTeacher();
  }

  function onPracTopicChange() {
    const gradeId = document.getElementById('prac-grade')?.value || 'p4';
    const topicId = document.getElementById('prac-topic')?.value;
    const topic = Curriculum.findTopic(gradeId, topicId);
    const goalSel = document.getElementById('prac-goal');
    if (!goalSel || !topic) return;
    goalSel.innerHTML = topic.goals.map(g =>
      `<option value="${g.id}">${g.text}</option>`
    ).join('');
    const note = document.getElementById('prac-goal-lock-note');
    if (note) note.textContent = '學習目標來自課本，僅可選擇、不可改寫。';
  }

  function bindTeacherPracticeForm() {
    document.getElementById('prac-grade')?.addEventListener('change', onPracGradeChange);
    document.getElementById('prac-topic')?.addEventListener('change', onPracTopicChange);
  }

  async function enterStudent() {
    const classCode = document.getElementById('student-class').value.trim();
    const studentNo = document.getElementById('student-no').value.trim();
    const gradeId = document.getElementById('student-grade').value;
    if (!classCode || !studentNo) {
      showToast('請輸入班別與學號');
      return;
    }
    try {
      currentStudent = await GameDB.getOrCreateStudent({ classCode, studentNo, gradeId });
      await renderStudentHome();
      showView('student');
      const syncNote = GameDB.isCloud() ? '（已同步到伺服器）' : '';
      showToast(`歡迎回來，${currentStudent.classCode} ${currentStudent.studentNo}${syncNote}`);
    } catch (e) {
      showToast(`登入失敗：${e.message}`);
    }
  }

  function logoutStudent() {
    currentStudent = null;
    practiceSession = null;
    showView('home');
  }

  async function backToStudent() {
    if (!currentStudent) {
      showView('home');
      return;
    }
    currentStudent = (await GameDB.getStudent(currentStudent.classCode, currentStudent.studentNo)) || currentStudent;
    await renderStudentHome();
    showView('student');
  }

  async function renderStudentHome() {
    if (!currentStudent) return;
    document.getElementById('student-badge').textContent =
      `${currentStudent.classCode} · 學號 ${currentStudent.studentNo}`;
    document.getElementById('student-grade-label').textContent =
      Curriculum.getGrade(currentStudent.gradeId)?.name || '';

    const suggestions = await Recommend.suggestForStudent(currentStudent, 4);
    const box = document.getElementById('suggest-list');
    box.innerHTML = suggestions.map((s, i) => `
      <article class="suggest-item ${i === 0 ? 'suggest-priority' : ''}">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-[11px] uppercase tracking-wider text-amber-300/80 font-bold mb-1">
              ${i === 0 ? '建議先練' : `建議 ${i + 1}`} · ${s.strand || '課題'}
            </p>
            <h3 class="text-lg font-bold text-white mb-1">${s.topicTitle}</h3>
            <p class="text-xs text-slate-300 leading-relaxed">${s.reasons.join('；')}</p>
          </div>
          <button type="button" class="shrink-0 custom-pill !text-xs" onclick="App.startPractice('${s.topicId}')">
            開始練習
          </button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          ${s.goals.slice(0, 3).map(g => {
            const pct = g.accuracy === null ? '未練' : `${Math.round(g.accuracy * 100)}%`;
            return `<span class="goal-chip">${g.text}<em>${pct}</em></span>`;
          }).join('')}
        </div>
      </article>
    `).join('') || '<p class="text-slate-400 text-sm">暫無建議，請先由教師上載進度表或直接選課題練習。</p>';

    const sessions = (await GameDB.getStudentSessions(currentStudent.id)).slice(0, 5);
    document.getElementById('recent-sessions').innerHTML = sessions.length
      ? sessions.map(s => {
          const topic = Curriculum.findTopic(s.gradeId, s.topicId);
          const goal = Curriculum.findGoal(s.gradeId, s.topicId, s.goalId);
          return `<li class="flex justify-between gap-2 text-sm border-b border-slate-800 py-2">
            <span>${topic?.title || s.topicId}<span class="block text-[11px] text-slate-400">${goal?.text || ''}</span></span>
            <span class="text-amber-300 font-bold">${s.finishedAt ? s.score + ' 分' : '進行中'}</span>
          </li>`;
        }).join('')
      : '<li class="text-slate-400 text-sm py-2">尚未有練習紀錄，開始第一局吧！</li>';

    const bank = await GameDB.listPractice({ gradeId: currentStudent.gradeId });
    document.getElementById('practice-bank-student').innerHTML = bank.length
      ? bank.slice(0, 8).map(p => {
          const cat = Curriculum.PRACTICE_CATEGORIES.find(c => c.id === p.categoryId);
          return `<button type="button" class="bank-chip" onclick="App.startPractice('${p.topicId}','${p.goalId}')">
            <i class="fa-solid ${cat?.icon || 'fa-puzzle-piece'}"></i>
            <span>${p.title}</span>
            ${p.verifiedAccurate ? '<i class="fa-solid fa-circle-check text-emerald-400 text-[10px]"></i>' : ''}
          </button>`;
        }).join('')
      : '<p class="text-slate-500 text-xs">教師尚未新增範疇練習；可直接按上方建議開始隨機出題。</p>';
  }

  async function startPractice(topicId, goalId) {
    if (!currentStudent) return;
    const topic = Curriculum.findTopic(currentStudent.gradeId, topicId);
    if (!topic) { showToast('課題不存在'); return; }

    let goal = goalId
      ? Curriculum.findGoal(currentStudent.gradeId, topicId, goalId)
      : null;
    if (!goal) {
      const schedule = await GameDB.getSchedule(currentStudent.gradeId);
      const suggestion = Recommend.scoreTopic(currentStudent, topic, schedule?.rows || []);
      const picked = Recommend.pickGoal(suggestion);
      goal = Curriculum.findGoal(currentStudent.gradeId, topicId, picked.id);
    }

    const { seed, questions } = QuestionEngine.generateSet({
      studentId: currentStudent.id,
      goalId: goal.id,
      goalText: goal.text,
      count: 8
    });

    try {
      practiceSession = await GameDB.createSession({
        studentId: currentStudent.id,
        gradeId: currentStudent.gradeId,
        topicId: topic.id,
        goalId: goal.id,
        seed,
        questions
      });
      const attempts = await GameDB.getSessionQuestions(practiceSession.id);
      practiceQueue = attempts.map((att, i) => ({
        attempt: att,
        question: questions[i]
      }));
      practiceIndex = 0;

      document.getElementById('practice-meta').textContent =
        `${topic.title} · ${goal.text} · seed ${seed}`;
      showView('practice');
      renderPracticeQuestion();
    } catch (e) {
      showToast(`開始練習失敗：${e.message}`);
    }
  }

  function renderPracticeQuestion() {
    const item = practiceQueue[practiceIndex];
    if (!item) return;
    const q = item.question;
    document.getElementById('practice-progress').textContent =
      `${practiceIndex + 1} / ${practiceQueue.length}`;
    document.getElementById('practice-prompt').innerHTML = q.prompt;
    document.getElementById('practice-feedback').textContent = '';
    document.getElementById('practice-feedback').className = 'text-sm min-h-[1.25rem]';

    const choices = document.getElementById('practice-choices');
    const inputWrap = document.getElementById('practice-input-wrap');
    if (q.choices && q.choices.length) {
      inputWrap.classList.add('hidden');
      choices.classList.remove('hidden');
      choices.innerHTML = '';
      q.choices.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice-btn';
        btn.textContent = String(c);
        btn.addEventListener('click', () => App.submitAnswer(String(c)));
        choices.appendChild(btn);
      });
    } else {
      choices.classList.add('hidden');
      inputWrap.classList.remove('hidden');
      const input = document.getElementById('practice-input');
      input.value = '';
      input.focus();
    }
  }

  async function submitAnswer(value) {
    const item = practiceQueue[practiceIndex];
    if (!item) return;
    let ans = value;
    if (ans === undefined) {
      ans = document.getElementById('practice-input').value;
    }
    if (ans === '' || ans == null) { showToast('請先作答'); return; }

    const ok = QuestionEngine.checkAnswer(item.question, ans);
    try {
      await GameDB.answerAttempt(item.attempt.id, String(ans), ok);
    } catch (e) {
      showToast(`儲存答題失敗：${e.message}`);
      return;
    }

    const fb = document.getElementById('practice-feedback');
    fb.className = `text-sm min-h-[1.25rem] font-bold ${ok ? 'text-emerald-300' : 'text-rose-300'}`;
    fb.textContent = '';
    if (ok) {
      fb.textContent = '✓ 正確！';
    } else {
      const line = document.createElement('span');
      line.textContent = `✗ 再想想。正確答案：${item.question.answer}`;
      fb.appendChild(line);
      if (item.question.explain) {
        const ex = document.createElement('span');
        ex.className = 'block text-xs font-normal text-slate-400 mt-1';
        ex.textContent = item.question.explain;
        fb.appendChild(ex);
      }
    }

    setTimeout(async () => {
      practiceIndex += 1;
      if (practiceIndex >= practiceQueue.length) {
        await finishPractice();
      } else {
        renderPracticeQuestion();
      }
    }, ok ? 700 : 1400);
  }

  async function finishPractice() {
    currentStudent = await GameDB.getStudent(currentStudent.classCode, currentStudent.studentNo);
    const sessions = await GameDB.getStudentSessions(currentStudent.id);
    const last = sessions[0];
    showToast(`本局完成！得分 ${last?.score ?? 0}`);
    await renderStudentHome();
    showView('student');
  }

  function parseScheduleCSV(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].split(/[,，\t]/).map(h => h.trim().toLowerCase());
    const hasHeader = header.some(h => /week|週|topic|課題/.test(h));
    const rows = [];
    const start = hasHeader ? 1 : 0;
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(/[,，\t]/).map(c => c.trim());
      if (hasHeader) {
        const obj = {};
        header.forEach((h, idx) => { obj[h] = cols[idx]; });
        rows.push({
          week: obj.week || obj['週'] || obj['周'] || cols[0],
          topic: obj.topic || obj.topictitle || obj['課題'] || cols[1],
          goal: obj.goal || obj.goaltext || obj['目標'] || cols[2],
          startDate: obj.startdate || obj.start || obj['開始'] || cols[3] || '',
          endDate: obj.enddate || obj.end || obj['結束'] || cols[4] || '',
          note: obj.note || obj['備註'] || cols[5] || ''
        });
      } else {
        rows.push({
          week: cols[0],
          topic: cols[1],
          goal: cols[2],
          startDate: cols[3] || '',
          endDate: cols[4] || '',
          note: cols[5] || ''
        });
      }
    }
    return rows;
  }

  async function uploadSchedule() {
    const gradeId = document.getElementById('schedule-grade').value;
    const fileInput = document.getElementById('schedule-file');
    const paste = document.getElementById('schedule-paste').value.trim();

    const apply = async (text) => {
      const rows = parseScheduleCSV(text);
      const result = await GameDB.setSchedule(gradeId, rows);
      const out = document.getElementById('schedule-result');
      if (!result.ok) {
        out.innerHTML = `<p class="text-rose-300 text-sm">${(result.errors || [result.error]).join('<br>')}</p>`;
        showToast('進度表匯入失敗：課題必須對齊課本');
        return;
      }
      out.innerHTML = `
        <p class="text-emerald-300 text-sm mb-2">已匯入 ${result.schedule.rows.length} 列（課題／目標僅參照課本，不可改寫）${GameDB.isCloud() ? ' · 已同步全班' : ''}。</p>
        ${result.errors?.length ? `<p class="text-amber-300 text-xs mb-2">略過：${result.errors.join('；')}</p>` : ''}
        <ul class="text-xs text-slate-300 space-y-1 max-h-40 overflow-y-auto">
          ${result.schedule.rows.map(r => `<li>第 ${r.week} 週 · ${r.topicTitle}${r.goalText ? ' · ' + r.goalText : ''}</li>`).join('')}
        </ul>`;
      showToast('進度表已更新');
      await renderCurriculumLockPanel();
    };

    if (fileInput.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => apply(e.target.result);
      reader.readAsText(fileInput.files[0]);
    } else if (paste) {
      await apply(paste);
    } else {
      showToast('請上載 CSV 或貼上進度表內容');
    }
  }

  async function addPracticeFromForm(e) {
    e.preventDefault();
    const payload = {
      gradeId: document.getElementById('prac-grade').value,
      topicId: document.getElementById('prac-topic').value,
      goalId: document.getElementById('prac-goal').value,
      categoryId: document.getElementById('prac-category').value,
      title: document.getElementById('prac-title').value.trim(),
      promptHint: document.getElementById('prac-hint').value.trim(),
      gameType: document.getElementById('prac-game').value,
      verifiedAccurate: document.getElementById('prac-verified').checked
    };
    if (!payload.title) { showToast('請填寫練習名稱'); return; }
    const result = await GameDB.addPracticeItem(payload);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(GameDB.isCloud() ? '已新增並同步全班練習庫' : '已新增範疇練習（已檢查不重複）');
    e.target.reset();
    document.getElementById('prac-verified').checked = true;
    onPracGradeChange();
    await renderPracticeBankTeacher();
  }

  async function renderPracticeBankTeacher() {
    const gradeId = document.getElementById('prac-grade')?.value || 'p4';
    const list = await GameDB.listPractice({ gradeId });
    const el = document.getElementById('teacher-bank-list');
    if (!el) return;
    el.innerHTML = list.length
      ? list.map(p => {
          const topic = Curriculum.findTopic(p.gradeId, p.topicId);
          const cat = Curriculum.PRACTICE_CATEGORIES.find(c => c.id === p.categoryId);
          return `<li class="py-2 border-b border-slate-800 text-sm">
            <span class="text-amber-300 font-bold">${cat?.label || p.categoryId}</span>
            · ${p.title}
            <span class="block text-[11px] text-slate-400">${topic?.title} · ${p.verifiedAccurate ? '已核對準確' : '待核對'}</span>
          </li>`;
        }).join('')
      : '<li class="text-slate-500 text-sm py-2">尚未新增練習</li>';
  }

  async function renderCurriculumLockPanel() {
    const el = document.getElementById('curriculum-lock-panel');
    if (!el) return;
    const blocks = [];
    for (const g of Curriculum.listGrades()) {
      const sch = await GameDB.getSchedule(g.id);
      blocks.push(`<div class="lock-grade">
        <h4 class="font-bold text-amber-300 mb-2">${g.name}
          <span class="text-[10px] ml-2 px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-600">課題目標鎖定</span>
          ${sch ? `<span class="text-[10px] ml-1 text-emerald-400">進度表 ${sch.rows.length} 列</span>` : ''}
        </h4>
        <ul class="space-y-2 text-xs text-slate-300">
          ${g.topics.map(t => `
            <li>
              <div class="font-semibold text-slate-100">${t.title} <span class="text-slate-500">(${t.strand})</span></div>
              <ol class="list-decimal ml-4 mt-1 text-slate-400">
                ${t.goals.map(goal => `<li>${goal.text}</li>`).join('')}
              </ol>
            </li>`).join('')}
        </ul>
      </div>`);
    }
    el.innerHTML = blocks.join('');
  }

  async function refreshClassOverview() {
    const classCode = document.getElementById('class-overview-code')?.value.trim();
    const out = document.getElementById('class-overview-result');
    if (!classCode || !out) return;
    try {
      const data = await GameDB.getClassOverview(classCode);
      out.innerHTML = data.count
        ? `<p class="text-xs text-slate-400 mb-2">${data.classCode} 共 ${data.count} 位曾登入${GameDB.isCloud() ? '（伺服器資料）' : '（本機）'}</p>
           <ul class="text-sm space-y-1">${data.students.map(s =>
             `<li class="flex justify-between border-b border-slate-800 py-1.5">
               <span>學號 ${s.studentNo}</span>
               <span class="text-slate-400">${s.sessionCount} 局 · ${s.avgScore == null ? '—' : s.avgScore + ' 分'}</span>
             </li>`).join('')}</ul>`
        : `<p class="text-slate-500 text-sm">尚未有 ${classCode} 學生登入紀錄</p>`;
    } catch (e) {
      out.innerHTML = `<p class="text-rose-300 text-sm">${e.message}</p>`;
    }
  }

  async function openTeacher() {
    updateConnBadge();
    await renderPracticeBankTeacher();
    await renderCurriculumLockPanel();
    showView('teacher');
    PromptGenerator.updatePrompt();
  }

  async function exportData() {
    const snap = await GameDB.exportSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `math-platform-db-${Date.now()}.json`;
    a.click();
    showToast(GameDB.isCloud() ? '已匯出伺服器 database 快照' : '已匯出本地 database 快照');
  }

  return {
    init,
    showToast,
    showView,
    enterStudent,
    logoutStudent,
    backToStudent,
    startPractice,
    submitAnswer,
    uploadSchedule,
    addPracticeFromForm,
    openTeacher,
    exportData,
    onPracGradeChange,
    renderPracticeBankTeacher,
    refreshClassOverview,
    updateConnBadge
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
