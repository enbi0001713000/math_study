// 画面の切り替えと描画
(() => {
  const app = document.getElementById('app');

  // 要素を作る小さなヘルパー（文章は textContent で入れる）
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
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
    const sectionList = el('ol', { class: 'section-list' },
      detail.sections.map((s) => el('li', { text: s.name })));
    const startButton = el('button', { class: 'button primary', type: 'button', text: '学習を始める', disabled: '' });
    render(
      ...header,
      el('h2', { class: 'sub-title', text: '小単元' }),
      sectionList,
      startButton,
      el('p', { class: 'note', text: '学習画面は準備中です。' }),
    );
  }

  async function route() {
    try {
      const map = await Data.loadUnitMap();
      const match = location.hash.match(/^#\/unit\/([\w-]+)$/);
      if (match) {
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
