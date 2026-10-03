// 解答入力用のキーパッド
// 入力は1文字ずつの配列で持ち、つなげるとキーパッドの出力表記（-3/4、2^4*3 など）になる
const Keypad = (() => {
  // キー構成のID（units.json の keys）と、そのキーが入力する文字
  const KEY_CHARS = {
    digits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    dot: ['.'],
    plus: ['+'],
    minus: ['-'],
    times: ['*'],
    paren: ['(', ')'],
    pow: ['^'],
    frac: ['/'],
    lt: ['<'],
    gt: ['>'],
    eq: ['='],
    x: ['x'],
    y: ['y'],
    a: ['a'],
    b: ['b'],
    pi: ['π'],
  };

  // 画面に並べる順番（行ごと）。使わないキーは空きにして、数字の並びを崩さない。
  // 1つも使うキーがない行は表示しない
  const LAYOUT = [
    ['7', '8', '9', '(', ')'],
    ['4', '5', '6', '*', '^'],
    ['1', '2', '3', '+', '/'],
    ['0', '.', '-', '<', '>'],
    ['x', 'y', 'a', 'b', '='],
    ['π', '', '', '', ''],
  ];

  const LABELS = { '-': '−', '*': '×', '^': '指数', '/': '分数' };
  const SHOWN = { '-': '−', '*': '×' };

  const isLetter = (c) => /[a-z]/.test(c);
  // 数字・小数点・文字・π のまとまり（分数の分子・分母になれる）
  const isNumberChar = (c) => /[\d.a-zπ]/.test(c);
  // キーボードで打てない文字の代わり
  const KEYBOARD_ALIAS = { p: 'π' };

  let active = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // 位置 from から続く数字・小数点・文字の並びを返す
  function readNumber(tokens, from) {
    let end = from;
    while (end < tokens.length && isNumberChar(tokens[end])) end += 1;
    return tokens.slice(from, end).join('');
  }

  // 指数は数字だけ（a^2 の「2」）
  function readDigits(tokens, from) {
    let end = from;
    while (end < tokens.length && /\d/.test(tokens[end])) end += 1;
    return tokens.slice(from, end).join('');
  }

  // 数字はそのまま、文字はイタリックで表示する
  function termNodes(text) {
    return [...text].map((c) => (isLetter(c) ? el('i', 'kp-var', c) : document.createTextNode(c)));
  }

  function slot(text) {
    const box = document.createDocumentFragment();
    if (text === '') box.append(el('span', 'kp-slot'));
    else box.append(...termNodes(text));
    return box;
  }

  // 入力中の答えを、指数は右上、分数は上下に重ねて表示する
  function renderDisplay(display, tokens, withCaret = true) {
    const nodes = [];
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (isNumberChar(t)) {
        const num = readNumber(tokens, i);
        i += num.length;
        if (tokens[i] === '/') {
          const den = readNumber(tokens, i + 1);
          i += 1 + den.length;
          const frac = el('span', 'kp-frac');
          const top = el('span', 'kp-num');
          const bottom = el('span', 'kp-den');
          top.append(slot(num));
          bottom.append(slot(den));
          frac.append(top, bottom);
          nodes.push(frac);
        } else {
          nodes.push(...termNodes(num));
        }
      } else if (t === '^') {
        const exp = readDigits(tokens, i + 1);
        i += 1 + exp.length;
        const sup = el('sup', 'kp-sup');
        sup.append(slot(exp));
        nodes.push(sup);
      } else {
        nodes.push(document.createTextNode(SHOWN[t] || t));
        i += 1;
      }
    }
    if (withCaret) nodes.push(el('span', 'kp-caret'));
    display.replaceChildren(...nodes);
  }

  // 保存された答え（-3/4、2^4*3 など）を、キーパッドと同じ見た目で表示する
  function renderValue(text) {
    const node = el('span', 'kp-value');
    renderDisplay(node, [...String(text)], false);
    return node;
  }

  function create(keyIds, { onSubmit, submitLabel = '答え合わせ' }) {
    const enabled = new Set();
    let hasDelete = false;
    (keyIds || []).forEach((id) => {
      if (id === 'del') hasDelete = true;
      else if (KEY_CHARS[id]) KEY_CHARS[id].forEach((c) => enabled.add(c));
      else console.warn(`[キーパッド] 不明なキー「${id}」です`);
    });

    const tokens = [];
    let disabled = false;

    const display = el('div', 'kp-display');
    display.setAttribute('role', 'textbox');
    display.setAttribute('aria-readonly', 'true');
    display.setAttribute('aria-label', '答え');
    const grid = el('div', 'kp-grid');
    const root = el('div', 'keypad');
    root.append(display, grid);

    function update() {
      renderDisplay(display, tokens);
    }

    function input(c) {
      if (disabled || !enabled.has(c)) return;
      const prev = tokens[tokens.length - 1];
      // 分数は数字・文字のあと、指数は数字・文字か「)」のあとにだけ置ける
      if (c === '/' && !(prev && isNumberChar(prev))) return;
      if (c === '^' && !(prev && (isNumberChar(prev) || prev === ')'))) return;
      tokens.push(c);
      update();
    }

    function remove() {
      if (disabled) return;
      tokens.pop();
      update();
    }

    function submit() {
      if (disabled) return;
      onSubmit(tokens.join(''));
    }

    function addKey(label, className, handler) {
      const button = el('button', `kp-key ${className}`, label);
      button.type = 'button';
      button.addEventListener('click', handler);
      grid.append(button);
      return button;
    }

    LAYOUT.filter((row) => row.some((c) => enabled.has(c))).forEach((row) => {
      row.forEach((c) => {
        if (!enabled.has(c)) {
          grid.append(el('span', 'kp-gap'));
          return;
        }
        let className = 'is-symbol';
        if (/\d/.test(c)) className = 'is-digit';
        else if (isLetter(c)) className = 'is-letter';
        const button = addKey(LABELS[c] || c, className, () => input(c));
        if (LABELS[c] && LABELS[c].length > 1) button.classList.add('is-word');
      });
    });
    if (hasDelete) addKey('削除', 'is-delete', remove);
    addKey(submitLabel, 'is-submit', submit);

    update();

    const keypad = {
      element: root,
      getValue: () => tokens.join(''),
      setDisabled(value) {
        disabled = value;
        root.classList.toggle('is-disabled', value);
        grid.querySelectorAll('button').forEach((b) => { b.disabled = value; });
      },
      // PC のキーボード入力
      handleKey(event) {
        if (event.key === 'Backspace' && hasDelete) remove();
        else if (event.key === 'Enter') submit();
        else if (enabled.has(event.key)) input(event.key);
        else if (enabled.has(KEYBOARD_ALIAS[event.key])) input(KEYBOARD_ALIAS[event.key]);
        else return false;
        return true;
      },
    };
    // 画面に複数あるときは、最後に触ったキーパッドがキーボード入力を受け取る
    root.addEventListener('pointerdown', () => { active = keypad; });
    active = keypad;
    return keypad;
  }

  document.addEventListener('keydown', (event) => {
    if (!active || !active.element.isConnected) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest && event.target.closest('input, textarea, select, summary, a')) return;
    // キーパッド以外のボタンにフォーカスがあるときの Enter は、そのボタンの動作を優先する
    if (event.key === 'Enter' && event.target.tagName === 'BUTTON' && !active.element.contains(event.target)) return;
    if (active.handleKey(event)) event.preventDefault();
  });

  return { create, renderValue };
})();
