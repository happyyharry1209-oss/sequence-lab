/** Deterministic numerical core. AI never supplies the calculator's results. */
export const MAX_N = 200;
export const MAX_VALUE = 1e100;
export function number(value, label, limit = 1e6) {
  if (
    !["string", "number"].includes(typeof value) ||
    (typeof value === "string" && !value.trim())
  )
    throw new Error(`${label}必須是數字。`);
  const v = Number(value);
  if (!Number.isFinite(v) || Math.abs(v) > limit)
    throw new Error(
      `${label}須為有限數，且絕對值不超過 ${limit.toLocaleString()}。`,
    );
  return v;
}
export function parameters(input = {}) {
  const type = input.type ?? "arithmetic";
  if (!["arithmetic", "geometric", "recurrence"].includes(type))
    throw new Error("請選擇有效的數列類型。");
  const n = number(input.n ?? 12, "項數", MAX_N);
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`項數須為 1 至 ${MAX_N} 的整數。`);
  const p = { type, a: number(input.a ?? 3, "首項"), n };
  if (type === "arithmetic") p.d = number(input.d ?? 4, "公差");
  if (type === "geometric") p.r = number(input.r ?? 1.5, "公比", 100);
  if (type === "recurrence") {
    p.p = number(input.p ?? 0.8, "倍數 p", 100);
    p.q = number(input.q ?? 5, "增量 q");
  }
  return p;
}
export function sequence(input) {
  const config = parameters(input);
  const terms = [],
    sums = [];
  let v = config.a,
    total = 0,
    compensation = 0;
  for (let i = 0; i < config.n; i++) {
    if (i > 0) {
      if (config.type === "arithmetic") v = config.a + i * config.d;
      else if (config.type === "geometric") v *= config.r;
      else v = config.p * v + config.q;
    }
    if (!Number.isFinite(v) || Math.abs(v) > MAX_VALUE)
      throw new Error("數值增長過大；請減少項數或倍數（支援至 10¹⁰⁰）。");
    const y = v - compensation,
      t = total + y;
    compensation = t - total - y;
    total = t;
    if (!Number.isFinite(total) || Math.abs(total) > MAX_VALUE)
      throw new Error("總和過大；請減少項數或數值。");
    terms.push(v);
    sums.push(total);
  }
  return { config, terms, sums, nth: terms.at(-1), sum: total };
}
export function fmt(x) {
  if (!Number.isFinite(x)) return "—";
  if (Object.is(x, -0) || Math.abs(x) < 1e-300) return "0";
  if (Math.abs(x) >= 1e9 || (Math.abs(x) < 1e-5 && x !== 0))
    return x.toExponential(5);
  return Number(x.toPrecision(11)).toLocaleString("en-US", {
    maximumFractionDigits: 10,
  });
}
export function close(a, b) {
  return Math.abs(a - b) <= 1e-10 * Math.max(Math.abs(a), Math.abs(b), 1e-12);
}
export function parseTerms(text) {
  const values = String(text)
    .trim()
    .split(/[\s,，、;；]+/)
    .filter(Boolean);
  if (values.length < 4 || values.length > 30)
    throw new Error("請輸入 4 至 30 項，以逗號或空格分隔。");
  return values.map((v) => number(v, "每一項", 1e12));
}
export function analyze(text) {
  const values = Array.isArray(text)
    ? parseTerms(text.join(","))
    : parseTerms(text);
  const diffs = values.slice(1).map((v, i) => v - values[i]);
  const second = diffs.slice(1).map((v, i) => v - diffs[i]);
  const candidates = [];
  if (diffs.every((v) => close(v, diffs[0])))
    candidates.push({
      type: "arithmetic",
      label: "等差數列",
      rule: `相鄰兩項的差皆為 ${fmt(diffs[0])}`,
      next: values.at(-1) + diffs[0],
      config: { type: "arithmetic", a: values[0], d: diffs[0], n: 12 },
    });
  // Handle zero without dividing by it: verify a candidate ratio against every pair.
  const index = values.slice(0, -1).findIndex((v) => v !== 0);
  if (index >= 0) {
    const r = values[index + 1] / values[index];
    if (
      Number.isFinite(r) &&
      values.slice(1).every((v, i) => close(v, values[i] * r))
    )
      candidates.push({
        type: "geometric",
        label: "等比數列",
        rule: `每一項均為前一項的 ${fmt(r)} 倍`,
        next: values.at(-1) * r,
        config: { type: "geometric", a: values[0], r, n: 12 },
      });
  } else if (values.every((v) => v === 0)) {
    candidates.push({
      type: "geometric",
      label: "零數列（公比不唯一）",
      rule: "所有項皆為 0，任何有限公比都符合遞推式 aₙ₊₁ = r aₙ；以相鄰項相除的公比則未定義",
      next: 0,
    });
  }
  if (second.every((v) => close(v, second[0])) && !close(second[0], 0))
    candidates.push({
      type: "quadratic",
      label: "二次數列",
      rule: `二階差分固定為 ${fmt(second[0])}；可用 aₙ = a₁ + (n−1)Δ₁ + (n−1)(n−2)Δ²/2`,
      next: values.at(-1) + diffs.at(-1) + second[0],
    });
  if (values.slice(2).every((v, i) => close(v, values[i] + values[i + 1])))
    candidates.push({
      type: "fibonacci",
      label: "前兩項相加",
      rule: "由第三項起，每項等於前兩項之和",
      next: values.at(-1) + values.at(-2),
    });
  return { values, diffs, second, candidates };
}
export function explanation(result) {
  const { config: c, nth, sum } = result;
  if (c.type === "arithmetic")
    return {
      name: "等差數列",
      formula: "aₙ = a₁ + (n − 1)d",
      sumFormula: "Sₙ = n(a₁ + aₙ) / 2",
      steps: [
        `相鄰項固定增加 ${fmt(c.d)}，因此第 ${c.n} 項之前有 ${c.n - 1} 次變化。`,
        `a${c.n} = ${fmt(c.a)} + (${c.n} − 1) × (${fmt(c.d)}) = ${fmt(nth)}`,
        `S${c.n} = ${c.n} × (${fmt(c.a)} + ${fmt(nth)}) ÷ 2 = ${fmt(sum)}`,
      ],
      insight:
        c.d === 0
          ? "公差為 0，所有項相等；總和就是首項乘以項數。"
          : "把首尾配對，每一對的和都相同，這就是等差級數求和公式的由來。",
    };
  if (c.type === "geometric")
    return {
      name: "等比數列",
      formula: "aₙ = a₁ · rⁿ⁻¹",
      sumFormula:
        c.r === 1 ? "Sₙ = n · a₁（r = 1）" : "Sₙ = a₁(1 − rⁿ) / (1 − r)",
      steps: [
        `每一步乘以 ${fmt(c.r)}，第 ${c.n} 項需乘 ${c.n - 1} 次。`,
        `a${c.n} = ${fmt(c.a)} × (${fmt(c.r)})^${c.n - 1} = ${fmt(nth)}`,
        c.r === 1
          ? `公比為 1，避免公式除以 0：S${c.n} = ${c.n} × ${fmt(c.a)} = ${fmt(sum)}`
          : `S${c.n} = ${fmt(c.a)} × (1 − (${fmt(c.r)})^${c.n}) ÷ (1 − (${fmt(c.r)})) = ${fmt(sum)}`,
      ],
      insight:
        Math.abs(c.r) < 1
          ? `因為 |r| < 1，無窮級數收斂至 a₁/(1−r) = ${fmt(c.a / (1 - c.r))}。這與有限 ${c.n} 項總和不同。`
          : c.r < 0
            ? "負公比使正負交替；不要把交替變化誤判為單調增長。"
            : c.r === 1
              ? "公比為 1 的等比數列同時也是公差為 0 的等差數列。"
              : "倍數的重複累積形成指數變化；公比大於 1 不代表負首項會遞增。",
    };
  const fixed = c.p === 1 ? null : c.q / (1 - c.p);
  return {
    name: "一階線性遞迴",
    formula: "aₙ₊₁ = p · aₙ + q",
    sumFormula:
      c.p === 1 ? "aₙ = a₁ + (n − 1)q" : "aₙ = L + (a₁ − L)pⁿ⁻¹；L = q/(1 − p)",
    steps: [
      `從 a₁ = ${fmt(c.a)} 出發，每次先乘 ${fmt(c.p)}，再加 ${fmt(c.q)}。`,
      c.p === 1
        ? "p = 1 時，遞迴退化成公差為 q 的等差數列。"
        : `平衡點 L = ${fmt(c.q)} ÷ (1 − (${fmt(c.p)})) = ${fmt(fixed)}；移項後 aₙ − L 為等比數列。`,
      `逐項計算至 a${c.n} = ${fmt(nth)}；累加前 ${c.n} 項得 ${fmt(sum)}。`,
    ],
    insight:
      Math.abs(c.p) < 1
        ? `|p| < 1，因此數列會趨近 ${fmt(fixed)}；若 p 為負，會在平衡點兩側交替。`
        : c.p === 1
          ? "每次加上固定值，連結遞迴與等差數列兩種觀點。"
          : "|p| ≥ 1 時一般不會趨向平衡點；若首項恰等於平衡點，則維持常數。",
  };
}
