import { sequence, explanation, analyze, fmt, close } from "./math.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const escape = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private browsing still works */
    }
  },
};
let config = { type: "arithmetic", a: 3, d: 4, n: 12 },
  result = sequence(config),
  chartMode = "terms",
  timer = null,
  playing = 0,
  currentView = "",
  backend = store.get("sequence-backend", ""),
  aiReady = false,
  busy = false;
const names = {
  explore: "探索實驗室",
  detective: "規律偵探",
  applications: "生活應用",
  practice: "練習挑戰",
  notes: "學習筆記",
  tutor: "AI 導師",
};
const defaults = {
  arithmetic: { type: "arithmetic", a: 3, d: 4, n: 12 },
  geometric: { type: "geometric", a: 2, r: 1.5, n: 12 },
  recurrence: { type: "recurrence", a: 5, p: 0.8, q: 5, n: 20 },
};
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").hidden = true), 3800);
}
function navigate() {
  const key = location.hash.slice(1),
    view = names[key] ? key : "explore";
  $$(".view").forEach((s) => (s.hidden = s.id !== `view-${view}`));
  $$("[data-view]").forEach((a) => {
    a.classList.toggle("active", a.dataset.view === view);
    if (a.dataset.view === view) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#crumb").textContent = names[view];
  document.title = `${names[view]} · 數列研究所`;
  $(".sidebar").classList.remove("open");
  $(".mobile-menu").setAttribute("aria-expanded", "false");
  if (view === "tutor") updateTutor();
  if (currentView && view !== currentView) {
    stopPlay();
    window.scrollTo({ top: 0, behavior: "instant" });
    $("#main").focus({ preventScroll: true });
  }
  currentView = view;
}
window.addEventListener("hashchange", navigate);
$(".mobile-menu").addEventListener("click", () => {
  const open = $(".sidebar").classList.toggle("open");
  $(".mobile-menu").setAttribute("aria-expanded", String(open));
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    $(".sidebar").classList.remove("open");
    $(".mobile-menu").setAttribute("aria-expanded", "false");
  }
});
function setConfig(next) {
  stopPlay();
  config = { ...next };
  $("#a").value = config.a;
  $("#n").value = config.n;
  $("#n-number").value = config.n;
  $$("[data-type]").forEach((b) => {
    const active = b.dataset.type === config.type;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active);
  });
  const field = (id, label, symbol, val, max = 1e6) =>
    `<label class="field">${label} <span>${symbol}</span><input id="${id}" name="${id}" type="number" value="${val}" step="any" min="${-max}" max="${max}" required></label>`;
  $("#dynamic-fields").innerHTML =
    config.type === "arithmetic"
      ? field("d", "公差", "d", config.d)
      : config.type === "geometric"
        ? field("r", "公比", "r", config.r, 100)
        : field("p", "倍數", "p", config.p, 100) +
          field("q", "增量", "q", config.q);
  $("#type-description").textContent = {
    arithmetic: "每往前一項，加上相同的數。",
    geometric: "每往前一項，乘以相同的數。",
    recurrence: "以前一項為起點，先乘再加。",
  }[config.type];
  $("#experiment-tip").textContent = {
    arithmetic: "試試負公差，觀察數列如何從增長變成遞減。",
    geometric: "試試 r = −0.8，看看數列如何交替並趨近 0。",
    recurrence: "試試改變首項：|p| < 1 時，會走向同一平衡點嗎？",
  }[config.type];
  compute();
}
function readForm() {
  const next = { type: config.type, a: $("#a").value, n: $("#n-number").value };
  if (config.type === "arithmetic") next.d = $("#d").value;
  if (config.type === "geometric") next.r = $("#r").value;
  if (config.type === "recurrence") {
    next.p = $("#p").value;
    next.q = $("#q").value;
  }
  return next;
}
function compute() {
  try {
    const next = sequence(readForm());
    result = next;
    config = next.config;
    $("#lab-error").textContent = "";
    $("#n-output").textContent = `${config.n} 項`;
    $("#metric-n").textContent = config.n;
    $("#nth").textContent = fmt(result.nth);
    $("#sum").textContent = fmt(result.sum);
    $("#change-label").textContent = {
      arithmetic: "公差 d",
      geometric: "公比 r",
      recurrence: "平衡點 L",
    }[config.type];
    $("#change").textContent =
      config.type === "arithmetic"
        ? `${config.d > 0 ? "+" : ""}${fmt(config.d)}`
        : config.type === "geometric"
          ? fmt(config.r)
          : config.p === 1
            ? "無唯一值"
            : fmt(config.q / (1 - config.p));
    const exp = explanation(result);
    $("#chart-series-name").textContent = exp.name;
    $("#chart-subtitle").textContent = `前 ${config.n} 項 · ${exp.name}`;
    $("#formula").textContent = exp.formula;
    $("#sum-formula").textContent = exp.sumFormula;
    $("#steps").replaceChildren(
      ...exp.steps.map((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        return li;
      }),
    );
    $("#insight").textContent = exp.insight;
    $("#terms-table").innerHTML = result.terms
      .map(
        (v, i) =>
          `<tr><td>${String(i + 1).padStart(2, "0")}</td><td>${fmt(v)}</td><td>${fmt(result.sums[i])}</td></tr>`,
      )
      .join("");
    renderChart();
    updateTutor();
    ["#play", "#download-csv"].forEach((id) => ($(id).disabled = false));
  } catch (e) {
    stopPlay();
    $("#lab-error").textContent = `${e.message} 圖表保留上次有效結果。`;
    ["#play", "#download-csv"].forEach((id) => ($(id).disabled = true));
  }
}
$("#parameters").addEventListener("submit", (e) => e.preventDefault());
$("#parameters").addEventListener("input", (e) => {
  stopPlay();
  if (e.target.id === "n") $("#n-number").value = e.target.value;
  if (e.target.id === "n-number") $("#n").value = e.target.value;
  compute();
});
$$("[data-type]").forEach((b) =>
  b.addEventListener("click", () => setConfig(defaults[b.dataset.type])),
);
$("#reset").addEventListener("click", () => {
  setConfig(defaults[config.type]);
  toast("已重設這類數列的參數");
});
$$("[data-chart]").forEach((b) =>
  b.addEventListener("click", () => {
    chartMode = b.dataset.chart;
    $$("[data-chart]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", x === b);
    });
    renderChart();
  }),
);
function renderChart(count = result.config.n) {
  const all = chartMode === "terms" ? result.terms : result.sums,
    vals = all.slice(0, count);
  const W = Math.max(310, Math.min(1000, $("#chart").clientWidth || 700)),
    H = 250,
    pad = { l: 66, r: 18, t: 20, b: 30 },
    width = W - pad.l - pad.r,
    height = H - pad.t - pad.b;
  let min = Math.min(0, ...all),
    max = Math.max(0, ...all);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.08;
  max += span * 0.12;
  const x = (i) =>
      pad.l + (all.length === 1 ? width / 2 : (i / (all.length - 1)) * width),
    y = (v) => pad.t + ((max - v) / (max - min)) * height;
  const grid = Array.from({ length: 5 }, (_, i) => {
    const v = min + ((max - min) * i) / 4,
      yy = y(v);
    return `<path d="M${pad.l} ${yy}H${W - pad.r}" stroke="#e7ecdf" stroke-dasharray="3 5"/><text x="${pad.l - 10}" y="${yy + 3}" text-anchor="end">${escape(fmt(v))}</text>`;
  }).join("");
  const indices = [
    ...new Set(
      Array.from({ length: Math.min(6, all.length) }, (_, i) =>
        Math.round(
          (i * (all.length - 1)) / Math.max(1, Math.min(6, all.length) - 1),
        ),
      ),
    ),
  ];
  const axis = indices
    .map(
      (i) =>
        `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${i + 1}</text>`,
    )
    .join("");
  const line = vals
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(v)}`)
    .join(" ");
  const points = vals
    .map(
      (v, i) =>
        `<circle tabindex="0" data-index="${i}" cx="${x(i)}" cy="${y(v)}" r="${all.length > 70 ? 2 : 3.5}" fill="${i === vals.length - 1 ? "#d87842" : "#426e53"}" stroke="white" stroke-width="1.5" aria-label="第 ${i + 1} 項，${chartMode === "terms" ? "數值" : "累計"} ${escape(fmt(v))}"><title>n = ${i + 1}，${chartMode === "terms" ? "aₙ" : "Sₙ"} = ${escape(fmt(v))}</title></circle>`,
    )
    .join("");
  $("#chart").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="plot-title plot-description"><title id="plot-title">${explanation(result).name}：${chartMode === "terms" ? "每項數值" : "前 n 項和"}</title><desc id="plot-description">共 ${all.length} 項，從 ${fmt(all[0])} 至 ${fmt(all.at(-1))}。精確資料列於下方數據表。</desc>${grid}<path d="M${pad.l} ${y(0)}H${W - pad.r}" stroke="#c7d4bf"/>${axis}<path d="${line}" fill="none" stroke="#8ba180" stroke-width="1.5" stroke-dasharray="4 4"/>${points}</svg>`;
  $("#point-detail").textContent =
    count < all.length ? `播放中 · 第 ${count} 項` : "移到圓點查看數值";
}
function showPoint(e) {
  const i = e.target.dataset.index;
  if (i === undefined) return;
  const vals = chartMode === "terms" ? result.terms : result.sums;
  $("#point-detail").textContent =
    `n = ${Number(i) + 1} · ${chartMode === "terms" ? "aₙ" : "Sₙ"} = ${fmt(vals[i])}`;
}
$("#chart").addEventListener("pointerover", showPoint);
$("#chart").addEventListener("focusin", showPoint);
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderChart(playing || result.config.n), 120);
});
function stopPlay() {
  if (timer) clearInterval(timer);
  timer = null;
  $("#play").textContent = "▷ 逐項播放";
  if (playing) {
    playing = 0;
    renderChart();
  }
}
$("#play").addEventListener("click", () => {
  if (timer) {
    stopPlay();
    return;
  }
  playing = 1;
  $("#play").textContent = "Ⅱ 停止播放";
  renderChart(playing);
  timer = setInterval(
    () => {
      playing++;
      renderChart(playing);
      if (playing >= config.n) stopPlay();
    },
    Math.max(60, Math.min(450, 5000 / config.n)),
  );
});
function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#download-csv").addEventListener("click", () => {
  download(
    "sequence-lab.csv",
    "\uFEFFn,a_n,S_n\r\n" +
      result.terms
        .map((v, i) => `${i + 1},${v},${result.sums[i]}`)
        .join("\r\n"),
    "text/csv;charset=utf-8",
  );
  toast("已匯出完整數列 CSV");
});
function detect() {
  try {
    const a = analyze($("#detective-input").value);
    $("#detective-error").textContent = "";
    $("#detective-results").innerHTML =
      `<div class="evidence"><small>一階差分 Δ</small><code>${a.diffs.map(fmt).join(" → ")}</code></div><div class="evidence"><small>二階差分 Δ²</small><code>${a.second.map(fmt).join(" → ")}</code></div>` +
      (a.candidates.length
        ? a.candidates
            .map(
              (c, i) =>
                `<div class="candidate"><h3>${escape(c.label)}</h3><p>${escape(c.rule)}</p><strong>假設成立，下一項是 ${fmt(c.next)}</strong>${c.config && Math.abs(c.config.r ?? 0) <= 100 && Math.abs(c.config.a) <= 1e6 && Math.abs(c.config.d ?? 0) <= 1e6 ? `<button class="text-button" data-candidate="${i}">帶到實驗台驗證 ↗</button>` : ""}</div>`,
            )
            .join("")
        : '<div class="candidate"><h3>暫未找到這四類簡單規律</h3><p>不代表數列沒有規律。可以嘗試更多資料，或思考交替、分組與其他遞迴關係。</p></div>');
    $$("[data-candidate]").forEach((b) =>
      b.addEventListener("click", () => {
        setConfig(a.candidates[Number(b.dataset.candidate)].config);
        location.hash = "explore";
      }),
    );
  } catch (e) {
    $("#detective-error").textContent = e.message;
    $("#detective-results").textContent = "請修正輸入後重新分析。";
  }
}
$("#detect").addEventListener("click", detect);
$$("[data-example]").forEach((b) =>
  b.addEventListener("click", () => {
    $("#detective-input").value = b.dataset.example;
    detect();
  }),
);
const scenarios = [
  {
    icon: "▤",
    label: "ARITHMETIC / 等差",
    title: "把一本書，讀成一個計劃。",
    short: "每天比前一天多讀一點，兩星期能讀多少？",
    story:
      "第一天讀 a₁ 頁，每天比前一天多讀 d 頁。假設能每天持續完成，看看 n 天的閱讀總量。",
    fields: [
      ["a", "第一天頁數", 8, 0, 10000],
      ["d", "每天增加頁數", 2, 0, 1000],
      ["n", "閱讀天數", 14, 1, 200],
    ],
    config: (v) => ({ type: "arithmetic", ...v }),
    unit: "頁",
    detail: "總頁數使用等差級數求和；每天閱讀量是數列的每一項。",
  },
  {
    icon: "⌁",
    label: "GEOMETRIC / 等比",
    title: "一張紙，可以有多厚？",
    short: "每次對摺厚度加倍，指數增長有多快？",
    story:
      "把未摺的厚度記作第 1 項，每對摺一次乘以 2。若對摺 k 次，要看第 k+1 項。這是理想模型，忽略紙張大小與摺疊限制。",
    fields: [
      ["a", "紙張原厚度（mm）", 0.1, 0.000001, 100],
      ["folds", "對摺次數 k", 12, 0, 50],
    ],
    config: (v) => ({ type: "geometric", a: v.a, r: 2, n: v.folds + 1 }),
    unit: "mm",
    detail: "本情境看最後厚度；把每次厚度相加沒有直接物理意義。",
    noSum: true,
  },
  {
    icon: "↻",
    label: "RECURRENCE / 遞迴",
    title: "每天學新字，能留下多少？",
    short: "保留一部分，再加入新知，找到平衡點。",
    story:
      "第 1 天以 a₁ 個熟悉詞彙開始。之後每天保留前一天的 p 比例，再學 q 個新字。用連續數量作平均模型，並非個人的真實記憶預測。",
    fields: [
      ["a", "起始詞彙量", 20, 0, 1000000],
      ["p", "每天保留比例 p", 0.85, 0, 1],
      ["q", "每天新增詞彙 q", 10, 0, 10000],
      ["n", "觀察天數", 30, 1, 200],
    ],
    config: (v) => ({ type: "recurrence", ...v }),
    unit: "個（平均）",
    detail:
      "當 0 ≤ p < 1，平衡點為 q/(1−p)；累計每天的庫存不等於學過的不重複詞彙數。",
    noSum: true,
  },
];
let scenarioIndex = 0,
  scenarioResult;
function selectScenario(i) {
  scenarioIndex = i;
  const s = scenarios[i];
  $$(".scenario-card").forEach((b, j) => {
    b.classList.toggle("active", i === j);
    b.setAttribute("aria-pressed", String(i === j));
  });
  $("#scenario-title").textContent = s.title;
  $("#scenario-story").textContent = s.story;
  $("#scenario-form").innerHTML = s.fields
    .map(
      ([id, label, val, min, max]) =>
        `<label class="field">${label}<input name="${id}" aria-label="${label}" type="number" step="${["n", "folds", "d", "q"].includes(id) ? 1 : "any"}" min="${min}" max="${max}" value="${val}" required></label>`,
    )
    .join("");
  calculateScenario();
}
function calculateScenario() {
  try {
    const s = scenarios[scenarioIndex],
      values = {};
    for (const input of $("#scenario-form").elements) {
      if (!input.checkValidity() || input.value === "")
        throw new Error("請輸入範圍內的有效數字；天數和對摺次數必須為整數。");
      values[input.name] = Number(input.value);
    }
    scenarioResult = sequence(s.config(values));
    $("#scenario-result").innerHTML =
      `<div class="application-result"><div><span>${scenarioIndex === 1 ? `對摺 ${values.folds} 次後` : `第 ${values.n} 天`}</span><strong>${fmt(scenarioResult.nth)} <small>${s.unit}</small></strong></div>${!s.noSum ? `<div><span>累計閱讀</span><strong>${fmt(scenarioResult.sum)} <small>${s.unit}</small></strong></div>` : ""}<p>${s.detail}</p></div>`;
    $("#open-scenario").disabled = false;
  } catch (e) {
    scenarioResult = null;
    $("#scenario-result").innerHTML =
      `<p class="error" role="alert">${escape(e.message)}</p>`;
    $("#open-scenario").disabled = true;
  }
}
$("#scenario-grid").innerHTML = scenarios
  .map(
    (s, i) =>
      `<button class="scenario-card" data-scenario="${i}" aria-pressed="false"><span class="scenario-icon">${s.icon}</span><small>${s.label}</small><h2>${s.title}</h2><p>${s.short}</p></button>`,
  )
  .join("");
$$("[data-scenario]").forEach((b) =>
  b.addEventListener("click", () => selectScenario(Number(b.dataset.scenario))),
);
$("#scenario-form").addEventListener("input", calculateScenario);
$("#scenario-form").addEventListener("submit", (e) => e.preventDefault());
$("#open-scenario").addEventListener("click", () => {
  if (scenarioResult) {
    setConfig(scenarioResult.config);
    location.hash = "explore";
  }
});
let progress = store.get("sequence-progress", { done: 0, correct: 0 });
if (
  !Number.isInteger(progress?.done) ||
  !Number.isInteger(progress?.correct) ||
  progress.done < 0 ||
  progress.correct < 0 ||
  progress.correct > progress.done
)
  progress = { done: 0, correct: 0 };
let question,
  attempted = false,
  solved = false,
  questionNo = 0;
const randint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
function newQuestion() {
  const kind = questionNo++ % 6,
    a = randint(1, 9),
    d = randint(2, 6),
    n = randint(5, 12),
    r = randint(2, 3);
  const questions = [
    {
      label: "等差 · 第 n 項",
      text: `等差數列的首項為 ${a}，公差為 ${d}。第 ${n} 項是多少？`,
      answer: a + (n - 1) * d,
      hint: "第 n 項與首項之間，有 n−1 次變化。",
      why: `aₙ = a₁ + (n−1)d = ${a} + (${n}−1) × ${d} = ${a + (n - 1) * d}。`,
    },
    {
      label: "等比 · 第 n 項",
      text: `等比數列 ${a}, ${a * r}, ${a * r * r}, … 的第 6 項是多少？`,
      answer: a * r ** 5,
      hint: `公比為 ${r}。從首項到第 6 項，要乘幾次？`,
      why: `a₆ = a₁r⁵ = ${a} × ${r}⁵ = ${a * r ** 5}。不是乘 6 次。`,
    },
    {
      label: "等差 · 前 n 項和",
      text: `等差數列首項 ${a}、公差 ${d}，求前 ${n} 項和。`,
      answer: (n * (2 * a + (n - 1) * d)) / 2,
      hint: "先求末項，再把首尾配對：Sₙ = n(a₁+aₙ)/2。",
      why: `末項為 ${a + (n - 1) * d}；Sₙ = ${n} × (${a} + ${a + (n - 1) * d}) ÷ 2 = ${(n * (2 * a + (n - 1) * d)) / 2}。`,
    },
    {
      label: "等比 · 特殊情況",
      text: `首項為 ${a}、公比為 1 的等比數列，前 ${n} 項和是多少？`,
      answer: a * n,
      hint: "公比為 1，每項都等於首項。不要代入分母 1−r 的公式。",
      why: `每項都為 ${a}，因此 Sₙ = na₁ = ${n} × ${a} = ${a * n}。`,
    },
    {
      label: "遞迴 · 平衡點",
      text: `數列滿足 aₙ₊₁ = 0.5aₙ + ${d}。若收斂，平衡點 L 是多少？`,
      answer: d / 0.5,
      hint: "平衡時下一項與當前項相同，所以 L = 0.5L + q。",
      why: `L = 0.5L + ${d}，所以 0.5L = ${d}，L = ${d * 2}。因 |0.5| < 1，各首項均趨近這個值。`,
    },
    {
      label: "規律 · 二階差分",
      text: `假設數列遵循正整數平方的規律：1, 4, 9, 16, 25, …，下一項是多少？`,
      answer: 36,
      hint: "一階差為 3,5,7,9；下一個差是多少？",
      why: "下一個差為 11，所以 25 + 11 = 36 = 6²。這以「平方規律繼續成立」為假設。",
    },
  ];
  question = questions[kind];
  attempted = false;
  solved = false;
  $("#quiz-category").textContent = question.label;
  $("#quiz-counter").textContent = `本次第 ${questionNo} 題`;
  $("#quiz-question").textContent = question.text;
  $("#quiz-hint").textContent = question.hint;
  $("#quiz-hint").hidden = true;
  $("#quiz-answer").value = "";
  $("#quiz-answer").disabled = false;
  $("#quiz-feedback").replaceChildren();
  $("#next-question").hidden = true;
  $("#check-answer").hidden = false;
  updateProgress();
}
function updateProgress() {
  $("#quiz-score").textContent = progress.correct;
  $("#quiz-done").textContent = `${progress.done} 題`;
  $("#quiz-accuracy").textContent = progress.done
    ? `${Math.round((progress.correct / progress.done) * 100)}%`
    : "—";
}
$("#quiz-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (solved || $("#quiz-answer").value === "") return;
  const answer = Number($("#quiz-answer").value);
  if (!Number.isFinite(answer)) return;
  const correct = close(answer, question.answer);
  if (!attempted) {
    progress.done++;
    if (correct) progress.correct++;
    store.set("sequence-progress", progress);
    attempted = true;
    updateProgress();
  }
  $("#quiz-feedback").innerHTML =
    `<div class="feedback ${correct ? "" : "wrong"}"><strong>${correct ? "✓ 想對了！" : "再想一步 · 正確答案是 " + fmt(question.answer)}</strong>${escape(question.why)}</div>`;
  $("#next-question").hidden = false;
  if (correct) {
    solved = true;
    $("#quiz-answer").disabled = true;
    $("#check-answer").hidden = true;
  }
});
$("#show-hint").addEventListener(
  "click",
  () => ($("#quiz-hint").hidden = false),
);
$("#next-question").addEventListener("click", newQuestion);
$("#reset-progress").addEventListener("click", () => {
  progress = { done: 0, correct: 0 };
  store.set("sequence-progress", progress);
  updateProgress();
  toast("本機學習紀錄已重設");
});
$$("[data-load-type]").forEach((b) =>
  b.addEventListener("click", () => {
    setConfig(defaults[b.dataset.loadType]);
    location.hash = "explore";
  }),
);
function updateTutor() {
  const exp = explanation(result),
    c = result.config;
  $("#tutor-type").textContent = exp.name;
  $("#tutor-context").innerHTML =
    `首項 a₁ = ${fmt(c.a)}<br>${c.type === "arithmetic" ? `公差 d = ${fmt(c.d)}` : c.type === "geometric" ? `公比 r = ${fmt(c.r)}` : `p = ${fmt(c.p)}，q = ${fmt(c.q)}`}<br>觀察 ${c.n} 項<br>第 ${c.n} 項 = ${fmt(result.nth)}<br>前 ${c.n} 項和 = ${fmt(result.sum)}`;
}
function addMessage(role, message, label) {
  const el = document.createElement("div");
  el.className = `chat-message ${role}`;
  if (label) {
    const small = document.createElement("small");
    small.textContent = label;
    el.append(small);
  }
  el.append(document.createTextNode(message));
  $("#chat-log").append(el);
  $("#chat-log").scrollTop = $("#chat-log").scrollHeight;
}
$$("[data-prompt]").forEach((b) =>
  b.addEventListener("click", () => {
    addMessage("user", b.textContent);
    const exp = explanation(result),
      c = result.config;
    const text =
      b.dataset.prompt === "why"
        ? `首項的索引是 1，尚未做任何變化。從第 1 項走到第 ${c.n} 項，需要 ${c.n - 1} 步。因此等差用 (n−1)d、等比用 r^(n−1)。\n\n想想：第 1 項代入時，變化次數是否恰好為 0？`
        : b.dataset.prompt === "sum"
          ? `${exp.sumFormula}\n\n${exp.steps.join("\n\n")}\n\n切換實驗台到「累計 Sₙ」，比較 aₙ 與 Sₙ 的差別。`
          : c.type === "recurrence"
            ? "保持 p 與 q 不變，把首項改成原來的兩倍。兩列數之間的差，會如何逐步變化？先猜想，再用圖像驗證。"
            : `保持其他參數不變，把${c.type === "arithmetic" ? "公差改成負數" : "公比改成負數"}。圖像、符號與總和會如何改變？請先寫下預測，再試驗。`;
    addMessage("assistant", text, "本機導學 · 根據規則產生，非 AI");
  }),
);
function validateBackend(value) {
  if (!value) return "";
  const url = new URL(value),
    local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" && !(local && url.protocol === "http:"))
  )
    throw new Error(
      "請使用沒有金鑰、查詢參數或帳密的 HTTPS API 網址；本機開發可用 HTTP localhost。",
    );
  return url.href.replace(/\/$/, "");
}
try {
  backend = validateBackend(typeof backend === "string" ? backend : "");
} catch {
  backend = "";
}
function connectionText(message = "") {
  $("#connection-status").textContent =
    message ||
    (aiReady
      ? "已連接後端 · 可向大語言模型提問"
      : backend
        ? "後端未就緒 · 可使用本機導學"
        : "尚未連接後端 · 可使用本機導學");
  $("#tutor-mode").textContent = aiReady
    ? "大語言模型已連線 · 回覆仍需驗證"
    : "本機導學 · 非大語言模型";
}
async function checkBackend() {
  aiReady = false;
  if (!backend) {
    connectionText();
    return;
  }
  connectionText("正在檢查後端…");
  try {
    const r = await fetch(backend, {
      signal: AbortSignal.timeout(8000),
      credentials: "omit",
    });
    const d = await r.json();
    aiReady = r.ok && d.ready === true;
    connectionText(aiReady ? "" : "後端可連線，但尚未設定 OpenRouter 金鑰");
  } catch {
    connectionText("無法連接後端，請檢查網址、網路與來源設定。");
  }
}
$("#configure-ai").addEventListener("click", () => {
  $("#backend-url").value = backend;
  $("#settings-error").textContent = "";
  $("#ai-dialog").showModal();
});
$("#close-dialog").addEventListener("click", () => $("#ai-dialog").close());
$("#ai-settings").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    backend = validateBackend($("#backend-url").value.trim());
    store.set("sequence-backend", backend);
    $("#ai-dialog").close();
    await checkBackend();
  } catch (e) {
    $("#settings-error").textContent = e.message;
  }
});
$("#disconnect-ai").addEventListener("click", () => {
  backend = "";
  aiReady = false;
  store.set("sequence-backend", "");
  $("#ai-dialog").close();
  connectionText();
  toast("已切換本機導學");
});
$("#chat-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = $("#chat-input").value.trim();
  if (!message || busy) return;
  if (!backend) {
    addMessage(
      "assistant",
      "尚未設定 AI 後端。請先按「設定後端網址」連接已在伺服器設定金鑰的服務。你也可以點選上方三個問題，使用無需連線的本機導學。",
      "連線提示 · 此訊息並非 AI 回覆",
    );
    return;
  }
  const requestConfig = { ...result.config },
    contextName = explanation(result).name;
  addMessage(
    "user",
    message,
    `提問時的實驗：${contextName}，n = ${requestConfig.n}`,
  );
  $("#chat-input").value = "";
  busy = true;
  $("#send-chat").disabled = true;
  $("#send-chat").textContent = "思考中…";
  try {
    const r = await fetch(backend, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, config: requestConfig }),
      credentials: "omit",
      signal: AbortSignal.timeout(45000),
    });
    const d = await r.json();
    if (!r.ok || typeof d.reply !== "string")
      throw new Error(d.error || "AI 服務暫時無法回覆。");
    aiReady = true;
    connectionText();
    addMessage(
      "assistant",
      d.reply.slice(0, 12000),
      "AI 導師 · 請以實驗台核對計算",
    );
  } catch (e) {
    addMessage(
      "assistant",
      e.name === "TimeoutError"
        ? "回覆逾時，請稍後再試；你仍可使用本機導學。"
        : `未取得 AI 回覆：${e.message}`,
      "連線提示 · 此訊息並非 AI 回覆",
    );
  } finally {
    busy = false;
    $("#send-chat").disabled = false;
    $("#send-chat").textContent = "詢問 AI ↗";
  }
});
$("#export-report").addEventListener("click", () => {
  const exp = explanation(result),
    date = new Intl.DateTimeFormat("zh-Hant", {
      timeZone: "Asia/Hong_Kong",
      dateStyle: "long",
    }).format(new Date());
  const report = `# 數列研究所 · 學習紀錄\n\n日期：${date}\n\n## 實驗設定\n\n類型：${exp.name}\n參數：${JSON.stringify(result.config)}\n\n## 公式與計算\n\n${exp.formula}\n${exp.sumFormula}\n\n${exp.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n${exp.insight}\n\n## 練習紀錄\n\n完成 ${progress.done} 題；首次答對 ${progress.correct} 題。\n\n## 我的觀察\n\n請填寫：我改變了哪個參數？我先猜想了甚麼？圖像與計算支持了哪個結論？模型有甚麼限制？\n\n## AI 與資安\n\n${aiReady ? "後端已連線（不代表本紀錄使用了 AI 回覆）。" : "未啟用大語言模型；本機導學是固定規則，不是 AI。"}\nAPI key 只應存於伺服器環境變數。數值由確定性演算法計算，畫面有浮點四捨五入。\n\n## 數據\n\n| n | a_n | S_n |\n|---|---|---|\n${result.terms.map((v, i) => `| ${i + 1} | ${v} | ${result.sums[i]} |`).join("\n")}\n`;
  download("數列研究所_學習紀錄.md", report, "text/markdown;charset=utf-8");
  toast("已匯出可編輯的學習紀錄");
});
setConfig(defaults.arithmetic);
detect();
selectScenario(0);
newQuestion();
navigate();
// Same-origin deployment automatically detects its server. GitHub Pages does not host /api.
if (!backend && ["localhost", "127.0.0.1"].includes(location.hostname))
  backend = `${location.origin}/api/tutor`;
if (!backend && !location.hostname.endsWith("github.io"))
  backend = `${location.origin}/api/tutor`;
checkBackend();
