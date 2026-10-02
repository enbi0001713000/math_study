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

  function formatAccuracy(accuracy) {
    return accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`;
  }

  function statusBadge(summary, totalSections) {
    if (summary.status === 'passed') {
      return el('span', { class: 'status is-passed', text: `合格（最高${summary.best}点）` });
    }
    if (summary.status === 'learning') {
      return el('span', { class: 'status is-learning', text: `学習中（${summary.doneCount}/${totalSections} 小単元）` });
    }
    return el('span', { class: 'status is-new', text: '未学習' });
  }

  // 学習できる単元の詳細データをまとめて読み込む
  async function loadAvailableDetails(map) {
    const available = map.units.filter((u) => u.available);
    const entries = await Promise.all(available.map(async (u) => [u.id, await Data.loadUnit(u.id)]));
    return Object.fromEntries(entries);
  }

  async function renderMap(map) {
    const unitsById = Object.fromEntries(map.units.map((u) => [u.id, u]));
    const details = await loadAvailableDetails(map);
    const sections = map.grades.map((grade) => {
      const units = map.units.filter((u) => u.grade === grade.id);
      const cards = units.map((unit) => {
        const card = el('li', { class: `unit-card${unit.available ? '' : ' is-unavailable'}` });
        const title = unit.available
          ? el('a', { class: 'unit-name', href: `#/unit/${unit.id}`, text: unit.name })
          : el('span', { class: 'unit-name', text: unit.name });
        card.append(title);
        if (!unit.available) card.append(el('span', { class: 'badge', text: '準備中' }));
        if (details[unit.id]) {
          const sectionIds = details[unit.id].sections.map((s) => s.id);
          const summary = Progress.unitSummary(unit.id, sectionIds);
          card.append(el('div', { class: 'unit-progress' }, [
            statusBadge(summary, sectionIds.length),
            el('span', { class: 'accuracy', text: `正答率 ${formatAccuracy(summary.accuracy)}` }),
          ]));
        }
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

    // 学習できる前提単元のうち、まだ合格していないものを案内する（ロックはしない）
    const notPassed = unit.prerequisites
      .map((id) => unitsById[id])
      .filter((pre) => pre && pre.available && !Progress.isPassed(pre.id));
    if (notPassed.length > 0) {
      header.push(el('div', { class: 'card recommend' }, [
        el('p', { class: 'recommend-title', text: '先にこちらがおすすめ' }),
        el('p', { class: 'note', text: '前提単元の単元テストにまだ合格していません。' }),
        el('ul', { class: 'recommend-list' }, notPassed.map((pre) => el('li', {}, [
          el('a', { href: `#/unit/${pre.id}`, text: pre.name }),
        ]))),
      ]));
    }

    if (!unit.available) {
      render(...header, el('p', { class: 'message', text: 'この単元は準備中です。' }));
      return;
    }

    const detail = await Data.loadUnit(unitId);
    const summary = Progress.unitSummary(unitId, detail.sections.map((s) => s.id));
    header.push(el('div', { class: 'unit-progress' }, [
      statusBadge(summary, detail.sections.length),
      el('span', { class: 'accuracy', text: `正答率 ${formatAccuracy(summary.accuracy)}` }),
    ]));
    const sectionList = el('ol', { class: 'section-list' }, detail.sections.map((s) => {
      if (isSectionReady(s)) {
        const done = summary.doneSections.includes(s.id);
        return el('li', { class: done ? 'is-done' : '' }, [
          el('a', { href: `#/unit/${unitId}/${s.id}`, text: s.name }),
          ...(done ? [el('span', { class: 'done-mark', text: '✓ 完了' })] : []),
        ]);
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
        ...(summary.testCount > 0 ? [el('p', { class: 'test-record', text: summary.passed
          ? `合格済み（最高${summary.best}点）`
          : `未合格（最高${summary.best}点・${summary.testCount}回受験）` })] : []),
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

  // onFirstAnswer：最初の答え合わせのときだけ呼ぶ（正答率は最初の答えで数える）
  function checkCard(problem, keys, label, { onFirstAnswer = null, onCorrect = null, next = null, correctMessage = '正解！' } = {}) {
    let hintLevel = 0;
    let answered = false;

    const result = el('p', { class: 'result', 'aria-live': 'polite' });
    const hintList = el('ol', { class: 'hint-list' });
    const nextButton = next
      ? el('button', { class: 'button primary', type: 'button', text: next.label, onclick: next.onClick })
      : null;
    if (nextButton) nextButton.hidden = true;

    const keypad = Keypad.create(keys, { onSubmit: (value) => {
      if (value === '') return;
      const correct = Grader.isCorrect(problem, value);
      if (!answered) {
        answered = true;
        if (onFirstAnswer) onFirstAnswer(correct);
      }
      if (correct) {
        result.className = 'result is-correct';
        result.textContent = correctMessage;
        keypad.setDisabled(true);
        if (onCorrect) onCorrect();
        if (nextButton) {
          nextButton.hidden = false;
          nextButton.focus();
        }
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
      ...(nextButton ? [nextButton] : []),
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
        {
          onFirstAnswer: (correct) => Progress.recordAnswer(unitId, problem, correct),
          next: { label: i < checks.length - 1 ? '次の問題へ' : '次へ', onClick: next },
        },
      ) })),
    ];

    function showDone() {
      Progress.markSectionDone(unitId, sectionId);
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
      Progress.recordTest(unitId, grade);
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

  // ---- 学習の記録 ----

  async function renderProgress(map) {
    const details = await loadAvailableDetails(map);
    const units = map.units.filter((u) => details[u.id]);
    const unitsById = Object.fromEntries(map.units.map((u) => [u.id, u]));
    const parts = [el('h1', { class: 'page-title', text: '学習の記録' })];

    if (!Progress.isStorageAvailable()) {
      parts.push(el('p', { class: 'message error', text: 'このブラウザでは記録を保存できません（プライベートモードなど）。ページを閉じると記録は消えます。' }));
    }

    // 単元ごとの状況
    parts.push(el('h2', { class: 'sub-title', text: '単元ごとの状況' }));
    parts.push(el('ul', { class: 'progress-list' }, units.map((unit) => {
      const sections = details[unit.id].sections;
      const summary = Progress.unitSummary(unit.id, sections.map((s) => s.id));
      return el('li', { class: 'card' }, [
        el('a', { class: 'unit-name', href: `#/unit/${unit.id}`, text: unit.name }),
        el('div', { class: 'unit-progress' }, [statusBadge(summary, sections.length)]),
        el('dl', { class: 'progress-stats' }, [
          el('dt', { text: '小単元' }), el('dd', { text: `${summary.doneCount} / ${sections.length} 完了` }),
          el('dt', { text: '正答率' }), el('dd', { text: summary.answered === 0
            ? '—'
            : `${formatAccuracy(summary.accuracy)}（${summary.answered}問中 ${summary.correct}問）` }),
          el('dt', { text: '単元テスト' }), el('dd', { text: summary.testCount === 0
            ? '未受験'
            : `最高${summary.best}点・${summary.passed ? '合格' : '未合格'}` }),
        ]),
      ]);
    })));

    // 弱点
    const weakItems = [];
    units.forEach((unit) => {
      const detail = details[unit.id];
      const summary = Progress.unitSummary(unit.id, detail.sections.map((s) => s.id));
      if (summary.weak) {
        weakItems.push(el('li', {}, [
          el('a', { href: `#/unit/${unit.id}`, text: unit.name }),
          el('span', { class: 'note', text: `（正答率 ${formatAccuracy(summary.accuracy)}）` }),
        ]));
      }
      detail.sections.forEach((section) => {
        const stat = summary.sections[section.id];
        if (stat && stat.weak) {
          weakItems.push(el('li', {}, [
            el('a', { href: `#/unit/${unit.id}/${section.id}`, text: `${unit.name} ＞ ${section.name}` }),
            el('span', { class: 'note', text: `（正答率 ${formatAccuracy(stat.accuracy)}）` }),
          ]));
        }
      });
    });
    const weakRule = `答えた回数が${Progress.WEAK_MIN_ANSWERED}回以上で、正答率が${Math.round(Progress.WEAK_ACCURACY * 100)}%未満の単元・小単元を表示します。`;
    parts.push(el('h2', { class: 'sub-title', text: '弱点' }));
    parts.push(weakItems.length > 0
      ? el('div', { class: 'card' }, [el('p', { class: 'note', text: weakRule }), el('ul', { class: 'weak-list' }, weakItems)])
      : el('p', { class: 'note', text: `今のところ弱点はありません。${weakRule}` }));

    // 復習リスト
    const items = Progress.mistakes()
      .map((m) => {
        const detail = details[m.unitId];
        const problem = detail && detail.problems.find((p) => p.id === m.problemId);
        return problem ? { ...m, problem, unit: unitsById[m.unitId], detail } : null;
      })
      .filter(Boolean);
    parts.push(el('h2', { class: 'sub-title', text: `復習リスト（${items.length}問）` }));
    if (items.length === 0) {
      parts.push(el('p', { class: 'note', text: 'まちがえた問題はありません。' }));
    } else {
      parts.push(el('p', { class: 'note', text: '確認問題や単元テストでまちがえた問題です。解き直して正解すると、リストから外れます。' }));
      parts.push(el('ul', { class: 'review-items' }, items.map((item) => {
        const section = item.detail.sections.find((s) => s.id === item.section);
        const meta = `${item.unit.name} ＞ ${section ? section.name : item.section}・${item.count}回まちがい`;
        const wrapper = el('li', { class: 'review-item' });
        const retry = el('button', { class: 'button secondary', type: 'button', text: '解き直す', onclick: () => {
          wrapper.replaceChildren(checkCard(item.problem, item.unit.keys, meta, {
            onCorrect: () => Progress.resolveMistake(item.problemId),
            correctMessage: '正解！復習リストから外しました。',
          }));
        } });
        wrapper.append(el('div', { class: 'card' }, [
          el('p', { class: 'problem-label', text: meta }),
          el('p', { class: 'problem-question', text: item.problem.question }),
          retry,
        ]));
        return wrapper;
      })));
    }

    parts.push(el('p', { class: 'note storage-note', text: '記録は、この端末のこのブラウザに保存されます。' }));
    render(...parts);
  }

  async function route() {
    try {
      const map = await Data.loadUnitMap();
      const testMatch = location.hash.match(/^#\/test\/([\w-]+)$/);
      const match = location.hash.match(/^#\/unit\/([\w-]+)(?:\/([\w-]+))?$/);
      if (location.hash === '#/progress') {
        await renderProgress(map);
      } else if (testMatch) {
        await renderTest(map, testMatch[1]);
      } else if (match && match[2]) {
        await renderSection(map, match[1], match[2]);
      } else if (match) {
        await renderUnit(map, match[1]);
      } else {
        await renderMap(map);
      }
    } catch (err) {
      console.error(err);
      showError('データを読み込めませんでした。ローカルサーバー経由で開いているか確認してください。');
    }
  }

  window.addEventListener('hashchange', route);
  route();
})();
