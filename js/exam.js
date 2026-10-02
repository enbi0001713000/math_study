// 単元テスト：出題の選び方と採点
const Exam = (() => {
  const SIZE = 10;
  const PASS_SCORE = 80;

  function shuffle(items, random) {
    const list = items.slice();
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  // 小単元ごとに1問ずつ選び、残りをランダムに足して size 問にする
  function pick(pool, size = SIZE, random = Math.random) {
    const bySection = new Map();
    pool.forEach((problem) => {
      if (!bySection.has(problem.section)) bySection.set(problem.section, []);
      bySection.get(problem.section).push(problem);
    });

    let chosen = [...bySection.values()].map((group) => group[Math.floor(random() * group.length)]);
    if (chosen.length > size) chosen = shuffle(chosen, random).slice(0, size);
    const rest = shuffle(pool.filter((p) => !chosen.includes(p)), random);
    chosen = chosen.concat(rest.slice(0, size - chosen.length));
    return shuffle(chosen, random);
  }

  function grade(questions, answers) {
    const results = questions.map((problem, i) => ({
      problem,
      answer: answers[i] || '',
      correct: Grader.isCorrect(problem, answers[i] || ''),
    }));
    const correctCount = results.filter((r) => r.correct).length;
    const score = questions.length === 0 ? 0 : Math.round((correctCount / questions.length) * 100);
    // 間違えた問題の小単元タグ（重複なし）
    const wrongSections = [...new Set(results.filter((r) => !r.correct).map((r) => r.problem.section))];
    return { results, correctCount, score, passed: score >= PASS_SCORE, wrongSections };
  }

  return { SIZE, PASS_SCORE, pick, grade };
})();
