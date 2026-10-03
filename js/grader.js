// 採点：キーパッドの出力表記で answers と照合する
const Grader = (() => {
  // 空白を除き、先頭の「+」（+3、+x など、数や文字の前の符号）を外す
  function normalize(text) {
    let s = String(text).replace(/\s+/g, '');
    if (/^\+[\d.a-zπ]/.test(s)) s = s.slice(1);
    return s;
  }

  function isCorrect(problem, input) {
    const value = normalize(input);
    if (value === '') return false;
    return problem.answers.some((answer) => normalize(answer) === value);
  }

  return { normalize, isCorrect };
})();
