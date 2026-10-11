/**
 * 登入後課題建議：結合進度表時程、錯題弱項、久未練習。
 */
window.Recommend = (() => {
  function accuracy(stat) {
    if (!stat || !stat.attempts) return null;
    return stat.correct / stat.attempts;
  }

  function daysSince(iso) {
    if (!iso) return Infinity;
    return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function scoreTopic(student, topic, scheduleRows) {
    const stats = student.stats || {};
    let weakScore = 0;
    let overdueScore = 0;
    let freshnessScore = 0;
    let reasonParts = [];

    topic.goals.forEach(g => {
      const st = stats[g.id];
      const acc = accuracy(st);
      if (st && st.streakWrong >= 2) {
        weakScore += 40;
        reasonParts.push(`「${g.text}」連續答錯`);
      } else if (acc !== null && acc < 0.7) {
        weakScore += 30;
        reasonParts.push(`「${g.text}」正確率偏低`);
      } else if (!st) {
        weakScore += 8;
      }
      const age = daysSince(st && st.lastAt);
      if (age > 7) {
        freshnessScore += Math.min(25, age);
        if (age > 14) reasonParts.push(`「${g.text}」超過兩週未練`);
      }
    });

    const related = (scheduleRows || []).filter(r => r.topicId === topic.id);
    const today = todayISO();
    related.forEach(r => {
      if (r.startDate && r.endDate) {
        if (today >= r.startDate && today <= r.endDate) {
          overdueScore += 35;
          reasonParts.push(`進度表第 ${r.week} 週進行中`);
        } else if (today > r.endDate) {
          const anyPractice = topic.goals.some(g => stats[g.id] && stats[g.id].attempts > 0);
          if (!anyPractice) {
            overdueScore += 45;
            reasonParts.push(`進度表第 ${r.week} 週已過但尚未練習`);
          }
        }
      } else if (r.week) {
        // 無日期時：靠週次與已練覆蓋推估
        const covered = topic.goals.filter(g => stats[g.id] && stats[g.id].attempts > 0).length;
        if (covered === 0) overdueScore += 10;
      }
    });

    const total = weakScore + overdueScore + freshnessScore;
    const uniqueReasons = [...new Set(reasonParts)].slice(0, 3);
    if (!uniqueReasons.length) uniqueReasons.push('適合鞏固或預習');

    return {
      topicId: topic.id,
      topicTitle: topic.title,
      strand: topic.strand,
      score: total,
      reasons: uniqueReasons,
      goals: topic.goals.map(g => {
        const st = stats[g.id];
        return {
          id: g.id,
          text: g.text,
          attempts: st ? st.attempts : 0,
          accuracy: accuracy(st),
          streakWrong: st ? st.streakWrong : 0,
          lastAt: st ? st.lastAt : null
        };
      })
    };
  }

  function suggestForStudent(student, limit = 3) {
    const grade = Curriculum.getGrade(student.gradeId);
    if (!grade) return [];
    const schedule = GameDB.getSchedule(student.gradeId);
    const rows = schedule ? schedule.rows : [];
    return grade.topics
      .map(t => scoreTopic(student, t, rows))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /** 從建議課題中挑優先目標：錯最多／未練優先 */
  function pickGoal(suggestion) {
    const ranked = [...suggestion.goals].sort((a, b) => {
      const aw = (a.streakWrong || 0) * 10 + (a.accuracy === null ? 5 : (1 - a.accuracy) * 8);
      const bw = (b.streakWrong || 0) * 10 + (b.accuracy === null ? 5 : (1 - b.accuracy) * 8);
      return bw - aw;
    });
    return ranked[0];
  }

  return { suggestForStudent, pickGoal, scoreTopic };
})();
