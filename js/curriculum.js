/**
 * 課本課題與學習目標：唯讀鎖定層（不可在 UI / 匯入流程中修改）
 * 教師可上載「進度表」對齊這些 id，亦可在範疇下新增練習模板，但不得改 goals。
 */
window.Curriculum = (() => {
  const LOCKED = Object.freeze({
    p4: Object.freeze({
      id: 'p4',
      name: '小學四年級 (P4)',
      topics: Object.freeze([
        Object.freeze({
          id: 'p4-t1',
          title: '如何比較分數',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p4-t1-g1', text: '比較分數與基準值（例如 1/2 或 1）' }),
            Object.freeze({ id: 'p4-t1-g2', text: '比較同分母分數的大小' }),
            Object.freeze({ id: 'p4-t1-g3', text: '比較同分子分數的大小' }),
            Object.freeze({ id: 'p4-t1-g4', text: '認識真分數、假分數與帶分數的互換' })
          ])
        }),
        Object.freeze({
          id: 'p4-t2',
          title: '不同分數類型',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p4-t2-g1', text: '分辨真分數、假分數與帶分數' }),
            Object.freeze({ id: 'p4-t2-g2', text: '假分數化為帶分數運算' }),
            Object.freeze({ id: 'p4-t2-g3', text: '帶分數化為假分數運算' })
          ])
        }),
        Object.freeze({
          id: 'p4-t3',
          title: '同分母分數加減法',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p4-t3-g1', text: '同分母分數加法與約簡' }),
            Object.freeze({ id: 'p4-t3-g2', text: '同分母分數減法與退位處理' }),
            Object.freeze({ id: 'p4-t3-g3', text: '帶分數的同分母加減混合計算' })
          ])
        }),
        Object.freeze({
          id: 'p4-t4',
          title: '小數的認識與比較',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p4-t4-g1', text: '認識十分位、百分位與千分位' }),
            Object.freeze({ id: 'p4-t4-g2', text: '比較一位及兩位小數大小' }),
            Object.freeze({ id: 'p4-t4-g3', text: '分數與小數的互相轉換 (如 1/4 = 0.25)' })
          ])
        }),
        Object.freeze({
          id: 'p4-t5',
          title: '周界與面積計算',
          strand: '度量',
          goals: Object.freeze([
            Object.freeze({ id: 'p4-t5-g1', text: '正方形與長方形的周界計算' }),
            Object.freeze({ id: 'p4-t5-g2', text: '正方形與長方形的面積計算' }),
            Object.freeze({ id: 'p4-t5-g3', text: '周界與面積概念分辨與複合圖形' })
          ])
        })
      ])
    }),
    p5: Object.freeze({
      id: 'p5',
      name: '小學五年級 (P5)',
      topics: Object.freeze([
        Object.freeze({
          id: 'p5-t1',
          title: '異分母分數加減法',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p5-t1-g1', text: '利用通分（公分母）計算分數加法' }),
            Object.freeze({ id: 'p5-t1-g2', text: '利用通分計算分數減法及退位' }),
            Object.freeze({ id: 'p5-t1-g3', text: '異分母分數加減混合計算應用題' })
          ])
        }),
        Object.freeze({
          id: 'p5-t2',
          title: '小數乘法運算',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p5-t2-g1', text: '小數乘以整數的算理與小數點定位' }),
            Object.freeze({ id: 'p5-t2-g2', text: '小數乘以小數的積與位數規律' }),
            Object.freeze({ id: 'p5-t2-g3', text: '小數乘法生活購物應用題' })
          ])
        }),
        Object.freeze({
          id: 'p5-t3',
          title: '簡易方程與代數',
          strand: '代數',
          goals: Object.freeze([
            Object.freeze({ id: 'p5-t3-g1', text: '以字母符號列出代數式 (例如 x + 8)' }),
            Object.freeze({ id: 'p5-t3-g2', text: '解一步計算的簡易方程 (涉及加減)' }),
            Object.freeze({ id: 'p5-t3-g3', text: '解一步計算的簡易方程 (涉及乘除)' }),
            Object.freeze({ id: 'p5-t3-g4', text: '利用簡易方程解答實際問題' })
          ])
        }),
        Object.freeze({
          id: 'p5-t4',
          title: '多邊形面積與立體體積',
          strand: '度量',
          goals: Object.freeze([
            Object.freeze({ id: 'p5-t4-g1', text: '三角形面積計算 (底 × 高 ÷ 2)' }),
            Object.freeze({ id: 'p5-t4-g2', text: '平行四邊形與梯形面積計算' }),
            Object.freeze({ id: 'p5-t4-g3', text: '長方體與正方體的體積計算' })
          ])
        }),
        Object.freeze({
          id: 'p5-t5',
          title: '百分數的初步認識',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p5-t5-g1', text: '認識百分數符號 (%) 意義' }),
            Object.freeze({ id: 'p5-t5-g2', text: '百分數、分數與小數三者互換' }),
            Object.freeze({ id: 'p5-t5-g3', text: '計算一個數佔另一個數的百分之幾' })
          ])
        })
      ])
    }),
    p6: Object.freeze({
      id: 'p6',
      name: '小學六年級 (P6)',
      topics: Object.freeze([
        Object.freeze({
          id: 'p6-t1',
          title: '分數除法與四則混合運算',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p6-t1-g1', text: '分數除以整數與「乘以倒數」的算理' }),
            Object.freeze({ id: 'p6-t1-g2', text: '整數除以分數與分數除以分數' }),
            Object.freeze({ id: 'p6-t1-g3', text: '分數四則混合計算與括號先後' })
          ])
        }),
        Object.freeze({
          id: 'p6-t2',
          title: '小數除法與循環小數',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p6-t2-g1', text: '小數除以整數與小數點對齊' }),
            Object.freeze({ id: 'p6-t2-g2', text: '小數除以小數之擴分轉化技巧' }),
            Object.freeze({ id: 'p6-t2-g3', text: '求商至指定小數位（四捨五入）' })
          ])
        }),
        Object.freeze({
          id: 'p6-t3',
          title: '百分數的進階應用',
          strand: '數',
          goals: Object.freeze([
            Object.freeze({ id: 'p6-t3-g1', text: '求折扣（幾折）、折讓金額與售價' }),
            Object.freeze({ id: 'p6-t3-g2', text: '計算成本、利潤、賺蝕率與虧損' }),
            Object.freeze({ id: 'p6-t3-g3', text: '求增加百分率與減少百分率' })
          ])
        }),
        Object.freeze({
          id: 'p6-t4',
          title: '圓周與圓面積計算',
          strand: '度量',
          goals: Object.freeze([
            Object.freeze({ id: 'p6-t4-g1', text: '圓周公式 C = 2πr 或 πd 的計算' }),
            Object.freeze({ id: 'p6-t4-g2', text: '圓面積公式 A = πr² 的計算' }),
            Object.freeze({ id: 'p6-t4-g3', text: '半圓及複合陰影圖形周界與面積' })
          ])
        }),
        Object.freeze({
          id: 'p6-t5',
          title: '速率與行程問題',
          strand: '度量',
          goals: Object.freeze([
            Object.freeze({ id: 'p6-t5-g1', text: '速率單位 (m/s 及 km/h) 概念與換算' }),
            Object.freeze({ id: 'p6-t5-g2', text: '速率、時間與距離三者公式互換' }),
            Object.freeze({ id: 'p6-t5-g3', text: '相向而行與同向追及問題' })
          ])
        })
      ])
    })
  });

  /** 練習範疇：可新增對應練習，不可改課題目標 */
  const PRACTICE_CATEGORIES = Object.freeze([
    Object.freeze({ id: 'concept', label: '概念理解', icon: 'fa-lightbulb' }),
    Object.freeze({ id: 'operation', label: '運算練習', icon: 'fa-calculator' }),
    Object.freeze({ id: 'application', label: '應用題', icon: 'fa-book-open' }),
    Object.freeze({ id: 'visual', label: '圖形／視覺', icon: 'fa-shapes' }),
    Object.freeze({ id: 'game', label: '遊戲化鞏固', icon: 'fa-gamepad' })
  ]);

  function getGrade(gradeId) {
    return LOCKED[gradeId] || null;
  }

  function listGrades() {
    return Object.values(LOCKED);
  }

  function findTopic(gradeId, topicIdOrTitle) {
    const grade = getGrade(gradeId);
    if (!grade) return null;
    return grade.topics.find(t => t.id === topicIdOrTitle || t.title === topicIdOrTitle) || null;
  }

  function findGoal(gradeId, topicIdOrTitle, goalIdOrText) {
    const topic = findTopic(gradeId, topicIdOrTitle);
    if (!topic) return null;
    return topic.goals.find(g => g.id === goalIdOrText || g.text === goalIdOrText) || null;
  }

  /** 進度表列只能參照已鎖定課題，拒絕未知課題／目標字串改寫 */
  function resolveScheduleRow(gradeId, row) {
    const topic = findTopic(gradeId, row.topicId || row.topicTitle || row.topic);
    if (!topic) {
      return { ok: false, error: `找不到課本課題：${row.topicId || row.topicTitle || row.topic}` };
    }
    let goal = null;
    if (row.goalId || row.goalText || row.goal) {
      goal = findGoal(gradeId, topic.id, row.goalId || row.goalText || row.goal);
      if (!goal) {
        return { ok: false, error: `課題「${topic.title}」下找不到目標：${row.goalId || row.goalText || row.goal}` };
      }
    }
    return {
      ok: true,
      item: {
        week: Number(row.week) || 0,
        topicId: topic.id,
        topicTitle: topic.title,
        goalId: goal ? goal.id : null,
        goalText: goal ? goal.text : null,
        startDate: row.startDate || row.start || '',
        endDate: row.endDate || row.end || '',
        note: row.note || ''
      }
    };
  }

  /** 供提示詞產生器沿用的扁平結構（goals 為字串陣列） */
  function asPromptCurriculum() {
    const out = {};
    for (const [key, grade] of Object.entries(LOCKED)) {
      out[key] = {
        name: grade.name,
        topics: grade.topics.map(t => ({
          id: t.id,
          title: t.title,
          strand: t.strand,
          goals: t.goals.map(g => g.text)
        }))
      };
    }
    return out;
  }

  return {
    LOCKED,
    PRACTICE_CATEGORIES,
    getGrade,
    listGrades,
    findTopic,
    findGoal,
    resolveScheduleRow,
    asPromptCurriculum
  };
})();
