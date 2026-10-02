// 画面の切り替えと描画
(() => {
  const app = document.getElementById('app');

  // 要素を作る小さなヘルパー（文章は textContent で入れる）
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else if (key === 'onclick') node.addEventListener('click', value);
      else node.setAttribute(key, value);
    });
    children.forEach((child) => node.append(child));
    return node;
  }

  function render(...nodes) {
    app.replaceChildren(...nodes);
    window.scrollTo(0, 0);
  }

  function showError(message) {
    render(el('p', { class: 'message error', text: message }));
  }

  function prerequisiteLinks(unit, unitsById) {
    if (unit.prerequisites.length === 0) {
      return el('span', { class: 'prereq-none', text: 'なし' });
    }
    const list = el('span', { class: 'prereq-list' });
    unit.prerequisites.forEach((id) => {
      const pre = unitsById[id];
      list.append(el('a', { class: 'prereq-link', href: `#/unit/${id}`, text: pre ? pre.name : id }));
    });
    return list;
  }

  // 解説があれば、その小単元は学習できる
  function isSectionReady(section) {
    return Array.isArray(section.explanation) && section.explanation.length > 0;
  }

  function renderMap(map) {
    const unitsById = Object.fromEntries(map.units.map((u) => [u.id, u]));
    const sections = map.grades.map((grade) => {
      const units = map.units.filter((u) => u.grade === grade.id);
      const cards = units.map((unit) => {
        const card = el('li', { class: `unit-card${unit.available ? '' : ' is-unavailable'}` });
        const title = unit.available
          ? el('a', { class: 'unit-name', href: `#/unit/${unit.id}`, text: unit.name })
          : el('span', { class: 'unit-name', text: unit.name });
        card.append(title);
        if (!unit.available) card.append(el('span', { class: 'badge', text: '準備中' }));
        card.append(el('div', { class: 'unit-prereq' }, [
          el('span', { class: 'label', text: '前提：' }),
          prerequisiteLinks(unit, unitsById),
        ]));
        return card;
      });
      return el('section', { class: 'grade' }, [
        el('h2', { class: 'grade-name', text: grade.name }),
        el('ul', { class: 'unit-list' }, cards),
      ]);
    });
    render(el('h1', { class: 'page-title', text: '単元マップ' }), ...sections);
  }

  async function renderUnit(map, unitId) {
    const unitsById = Object.fromEntries(map.units.map((u) => [u.id, u]));
    const unit = unitsById[unitId];
    if (!unit) {
      showError('単元が見つかりません。');
      return;
    }
    const grade = map.grades.find((g) => g.id === unit.grade);
    const header = [
      el('a', { class: 'back-link', href: '#/', text: '← 単元マップ' }),
      el('p', { class: 'unit-grade', text: grade ? grade.name : '' }),
      el('h1', { class: 'page-title', text: unit.name }),
      el('div', { class: 'unit-prereq' }, [
        el('span', { class: 'label', text: '前提単元：' }),
        prerequisiteLinks(unit, unitsById),
      ]),
    ];

    if (!unit.available) {
      render(...header, el('p', { class: 'message', text: 'この単元は準備中です。' }));
      return;
    }

    const detail = await Data.loadUnit(unitId);
    const sectionList = el('ol', { class: 'section-list' }, detail.sections.map((s) => {
      if (isSectionReady(s)) {
        return el('li', {}, [el('a', { href: `#/unit/${unitId}/${s.id}`, text: s.name })]);
      }
      return el('li', { class: 'is-unavailable' }, [
        el('span', { text: s.name }),
        el('span', { class: 'badge', text: '準備中' }),
      ]);
    }));

    const first = detail.sections.find(isSectionReady);
    const start = first
      ? el('a', { class: 'button primary', href: `#/unit/${unitId}/${first.id}`, text: '学習を始める' })
      : el('p', { class: 'note', text: '学習画面は準備中です。' });
    const testArea = [el('h2', { class: 'sub-title', text: '単元テスト' })];
    if (hasTest(detail)) {
      testArea.push(
        el('p', { class: 'note', text: `${Exam.SIZE}問・${Exam.PASS_SCORE}点以上で合格です。小単元をひととおり学んでから受けよう。` }),
        el('a', { class: 'button secondary', href: `#/test/${unitId}`, text: '単元テストを受ける' }),
      );
    } else {
      testArea.push(el('p', { class: 'note', text: '単元テストは準備中です。' }));
    }
    render(...header, el('h2', { class: 'sub-title', text: '小単元' }), sectionList, start, ...testArea);
  }

  function hasTest(detail) {
    return detail.problems.some((p) => p.role === 'test');
  }

  // ---- 小単元の学習画面（解説 → 例題 → 確認問題） ----

  const STAGES = [
    { id: 'explain', name: '解説' },
    { id: 'example', name: '例題' },
    { id: 'check', name: '確認問題' },
  ];

  function stepper(current) {
    return el('ol', { class: 'stepper' }, STAGES.map((stage) => el('li', {
      class: stage.id === current ? 'is-current' : '',
      text: stage.name,
    })));
  }

  function explanationBlock(block) {
    if (block.type === 'math') return el('p', { class: 'block-math', text: block.text });
    if (block.type === 'figure') return el('div', { class: 'block-figure' }, [Figure.render(block.figure)]);
    return el('p', { class: 'block-text', text: block.text });
  }

  function solutionToggle(problem) {
    return el('details', { class: 'solution' }, [
      el('summary', { text: '解き方を見る' }),
      el('p', { class: 'solution-text', text: problem.solution }),
    ]);
  }

  function problemBody(problem, label) {
    const body = [
      el('p', { class: 'problem-label', text: label }),
      el('p', { class: 'problem-question', text: problem.question }),
    ];
    if (problem.figure) body.push(el('div', { class: 'block-figure' }, [Figure.render(problem.figure)]));
    return body;
  }

  function checkCard(problem, keys, label, onNext, nextLabel) {
    let hintLevel = 0;

    const result = el('p', { class: 'result', 'aria-live': 'polite' });
    const hintList = el('ol', { class: 'hint-list' });
    const next = el('button', { class: 'button primary', type: 'button', text: nextLabel, onclick: onNext });
    next.hidden = true;

    const keypad = Keypad.create(keys, { onSubmit: (value) => {
      if (value === '') return;
      if (Grader.isCorrect(problem, value)) {
        result.className = 'result is-correct';
        result.textContent = '正解！';
        keypad.setDisabled(true);
        next.hidden = false;
        next.focus();
        return;
      }
      result.className = 'result is-wrong';
      if (hintLevel < problem.hints.length) {
        hintList.append(el('li', { text: problem.hints[hintLevel] }));
        hintLevel += 1;
        result.textContent = '不正解です。ヒントを見て、もう一度考えてみよう。';
      } else {
        result.textContent = '不正解です。解き方を見て、もう一度考えてみよう。';
      }
    } });

    return el('div', { class: 'card' }, [
      ...problemBody(problem, label),
      keypad.element,
      result,
      hintList,
      solutionToggle(problem),
      next,
    ]);
  }

  async function renderSection(map, unitId, sectionId) {
    const unit = map.units.find((u) => u.id === unitId);
    if (!unit || !unit.available) {
      showError('単元が見つかりません。');
      return;
    }
    const detail = await Data.loadUnit(unitId);
    const index = detail.sections.findIndex((s) => s.id === sectionId);
    const section = detail.sections[index];
    if (!section || !isSectionReady(section)) {
      showError('この小単元は準備中です。');
      return;
    }

    const problems = detail.problems.filter((p) => p.section === sectionId);
    const examples = problems.filter((p) => p.role === 'example');
    const checks = problems.filter((p) => p.role === 'check');
    const nextSection = detail.sections.slice(index + 1).find(isSectionReady);

    const header = [
      el('a', { class: 'back-link', href: `#/unit/${unitId}`, text: `← ${unit.name}` }),
      el('h1', { class: 'page-title', text: section.name }),
    ];

    // 表示する画面を順番に並べ、1つずつ進める
    const steps = [
      { stage: 'explain', draw: (next) => el('div', { class: 'card' }, [
        ...section.explanation.map(explanationBlock),
        el('button', { class: 'button primary', type: 'button', text: '次へ', onclick: next }),
      ]) },
      ...examples.map((problem, i) => ({ stage: 'example', draw: (next) => el('div', { class: 'card' }, [
        ...problemBody(problem, examples.length > 1 ? `例題 ${i + 1}` : '例題'),
        solutionToggle(problem),
        el('button', { class: 'button primary', type: 'button', text: '次へ', onclick: next }),
      ]) })),
      ...checks.map((problem, i) => ({ stage: 'check', draw: (next) => checkCard(
        problem,
        unit.keys,
        `確認問題 ${i + 1} / ${checks.length}`,
        next,
        i < checks.length - 1 ? '次の問題へ' : '次へ',
      ) })),
    ];

    function showDone() {
      const actions = [];
      if (nextSection) {
        actions.push(el('a', { class: 'button primary', href: `#/unit/${unitId}/${nextSection.id}`, text: '次の小単元へ' }));
      } else if (hasTest(detail)) {
        actions.push(el('a', { class: 'button primary', href: `#/test/${unitId}`, text: '単元テストへ' }));
      }
      actions.push(el('a', { class: 'button secondary', href: `#/unit/${unitId}`, text: `${unit.name}のトップへ戻る` }));
      render(...header, el('div', { class: 'card' }, [
        el('p', { class: 'done-message', text: 'この小単元の学習はおわりです。' }),
        el('div', { class: 'button-row' }, actions),
      ]));
    }

    function show(i) {
      if (i >= steps.length) {
        showDone();
        return;
      }
      render(...header, stepper(steps[i].stage), steps[i].draw(() => show(i + 1)));
    }

    show(0);
  }

  // ---- 単元テスト ----

  async function renderTest(map, unitId) {
    const unit = map.units.find((u) => u.id === unitId);
    if (!unit || !unit.available) {
      showError('単元が見つかりません。');
      return;
    }
    const detail = await Data.loadUnit(unitId);
    const pool = detail.problems.filter((p) => p.role === 'test');
    const header = [
      el('a', { class: 'back-link', href: `#/unit/${unitId}`, text: `← ${unit.name}` }),
      el('h1', { class: 'page-title', text: `${unit.name} 単元テスト` }),
    ];
    if (pool.length === 0) {
      render(...header, el('p', { class: 'message', text: '単元テストは準備中です。' }));
      return;
    }

    const questions = Exam.pick(pool);
    const answers = [];

    function showQuestion(i) {
      if (i >= questions.length) {
        showResult(Exam.grade(questions, answers));
        return;
      }
      const problem = questions[i];
      const isLast = i === questions.length - 1;
      const keypad = Keypad.create(unit.keys, {
        submitLabel: isLast ? '採点する' : '次へ',
        onSubmit: (value) => {
          answers[i] = value;
          showQuestion(i + 1);
        },
      });
      render(...header, el('div', { class: 'card' }, [
        ...problemBody(problem, `問題 ${i + 1} / ${questions.length}`),
        keypad.element,
        el('p', { class: 'note', text: 'わからないときは、空欄のまま進めます（不正解になります）。' }),
      ]));
    }

    function answerLine(label, value) {
      const shown = value === '' ? el('span', { class: 'empty-answer', text: '（空欄）' }) : Keypad.renderValue(value);
      return el('p', { class: 'answer-line' }, [el('span', { class: 'answer-label', text: label }), shown]);
    }

    function resultItem(result, i) {
      const { problem } = result;
      const details = el('details', { class: 'solution' }, [
        el('summary', { text: 'ヒントと解き方を見る' }),
        el('ol', { class: 'hint-list' }, problem.hints.map((h) => el('li', { text: h }))),
        el('p', { class: 'solution-text', text: problem.solution }),
      ]);
      return el('li', { class: `result-item ${result.correct ? 'is-correct' : 'is-wrong'}` }, [
        el('p', { class: 'result-mark', text: `${result.correct ? '○' : '×'} 問題 ${i + 1}` }),
        el('p', { class: 'problem-question', text: problem.question }),
        ...(problem.figure ? [el('div', { class: 'block-figure' }, [Figure.render(problem.figure)])] : []),
        answerLine('あなたの答え：', result.answer),
        ...(result.correct ? [] : [answerLine('正解：', problem.answers[0])]),
        details,
      ]);
    }

    function showResult(grade) {
      const summary = el('div', { class: `card score-card ${grade.passed ? 'is-passed' : 'is-failed'}` }, [
        el('p', { class: 'score', text: `${grade.score}点` }),
        el('p', { class: 'score-detail', text: `${questions.length}問中 ${grade.correctCount}問 正解` }),
        el('p', { class: 'score-message', text: grade.passed
          ? '合格！単元完了です。'
          : `不合格です。${Exam.PASS_SCORE}点以上で合格です。` }),
      ]);

      const retry = el('button', { class: 'button primary', type: 'button', text: '再受験する', onclick: () => renderTest(map, unitId) });
      const back = el('a', { class: 'button secondary', href: `#/unit/${unitId}`, text: `${unit.name}のトップへ戻る` });

      const parts = [...header, summary];
      if (!grade.passed) {
        // 間違えた問題のタグから、復習する小単元を案内する
        const reviewLinks = detail.sections
          .filter((s) => grade.wrongSections.includes(s.id))
          .map((s) => {
            const wrong = grade.results.filter((r) => !r.correct && r.problem.section === s.id).length;
            return el('li', {}, [
              el('a', { href: `#/unit/${unitId}/${s.id}`, text: s.name }),
              el('span', { class: 'note', text: `（${wrong}問まちがい）` }),
            ]);
          });
        parts.push(el('div', { class: 'card review-card' }, [
          el('h2', { class: 'sub-title', text: '復習しよう' }),
          el('p', { class: 'note', text: 'まちがえた問題の小単元を復習してから、もう一度受けてみよう。' }),
          el('ul', { class: 'review-list' }, reviewLinks),
        ]));
      }
      parts.push(
        el('div', { class: 'button-row result-actions' }, grade.passed ? [back] : [retry, back]),
        el('h2', { class: 'sub-title', text: '問題ごとの結果' }),
        el('ol', { class: 'result-list' }, grade.results.map(resultItem)),
      );
      render(...parts);
    }

    showQuestion(0);
  }

  async function route() {
    try {
      const map = await Data.loadUnitMap();
      const testMatch = location.hash.match(/^#\/test\/([\w-]+)$/);
      const match = location.hash.match(/^#\/unit\/([\w-]+)(?:\/([\w-]+))?$/);
      if (testMatch) {
        await renderTest(map, testMatch[1]);
      } else if (match && match[2]) {
        await renderSection(map, match[1], match[2]);
      } else if (match) {
        await renderUnit(map, match[1]);
      } else {
        renderMap(map);
      }
    } catch (err) {
      console.error(err);
      showError('データを読み込めませんでした。ローカルサーバー経由で開いているか確認してください。');
    }
  }

  window.addEventListener('hashchange', route);
  route();
})();
