// Emergent Computing — site script.
// 1. EM43 space-time diagrams computed from the published learned rules.
// 2. Copy-to-clipboard for BibTeX blocks.
// 3. Current year in the footer.

// EM43 genomes from Bocchese et al. (2026), arXiv:2608.14019 (one run per task).
// prog: 10-cell program; rule: 64-entry lookup table indexed by (left*16 + centre*4 + right).
const EM43_TASKS = {
  plus1:     { label: "x + 1",            f: (x) => x + 1,              prog: "0000000010", rule: "0000230222312131332223013023013301030321322320102022032031220002" },
  x2:        { label: "2x",               f: (x) => 2 * x,              prog: "0000000100", rule: "0300133120330233123211223003320001111130110302020022323132301231" },
  mod4:      { label: "x mod 4",          f: (x) => x % 4,              prog: "0000002010", rule: "0103032122003020112013030103210203123000200231300000001210323002" },
  rounddiv3: { label: "round(x/3)",       f: (x) => Math.floor(x / 3 + 0.5), prog: "0000000001", rule: "0300222221013333103211231030232103303131021330310010112332303231" },
  mod2c:     { label: "x·(1 + x mod 2)",  f: (x) => x * (1 + (x % 2)),  prog: "0000000100", rule: "0301001320230020131113332323030202203032320321013031013023332213" },
};

const EM43 = {
  separator: 4,      // blank cells between program and encoding region
  padding: 20,       // blank cells appended to the right of the input
  extendMargin: 3,   // extend the tape when activity gets this close to its end
  extendBy: 20,
  maxSteps: 4000,
  trainMax: 30,      // training range in the paper: x in [0, 30]
  inputMax: 150,
};

function em43Rule(task) {
  const rule = Uint8Array.from(task.rule, Number);
  // Entries fixed in the paper: 000->0, 002->0, 020->2, 200->0.
  rule[0] = 0; rule[2] = 0; rule[8] = 2; rule[32] = 0;
  return rule;
}

function em43Run(task, x) {
  const rule = em43Rule(task);
  const prog = Uint8Array.from(task.prog, Number);
  const x0 = prog.length + EM43.separator;
  let tape = new Uint8Array(x0 + x + 1 + EM43.padding);
  tape.set(prog, 0);
  tape[x0 + x] = 2;

  const rows = [tape];
  const halted = (t) => {
    let live = 0, ctrl = 0;
    for (const v of t) { if (v) { live++; if (v === 3) ctrl++; } }
    return live > 0 && 2 * ctrl >= live;
  };

  while (!halted(tape) && rows.length <= EM43.maxSteps) {
    let last = tape.length - 1;
    while (last >= 0 && tape[last] === 0) last--;
    if (tape.length - 1 - last <= EM43.extendMargin) {
      const longer = new Uint8Array(tape.length + EM43.extendBy);
      longer.set(tape);
      tape = longer;
    }
    const n = tape.length;
    const next = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const l = i > 0 ? tape[i - 1] : 0;
      const r = i < n - 1 ? tape[i + 1] : 0;
      next[i] = rule[l * 16 + tape[i] * 4 + r];
    }
    tape = next;
    rows.push(tape);
  }

  const done = halted(tape);
  let y = null;
  if (done) {
    for (let i = tape.length - 1; i >= x0; i--) {
      if (tape[i] === 2) { y = i - x0; break; }
    }
  }
  return { rows, x0, y, steps: rows.length - 1, halted: done };
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function em43Draw(canvas, run, maxHeight) {
  let cols = run.x0 + 1;
  for (const row of run.rows) {
    for (let i = row.length - 1; i >= 0; i--) {
      if (row[i]) { cols = Math.max(cols, i + 3); break; }
    }
  }
  const nRows = run.rows.length;
  const width = canvas.clientWidth || canvas.parentElement.clientWidth;
  const cell = Math.max(0.5, Math.min(width / cols, maxHeight / nRows, 12));
  const height = Math.ceil(nRows * cell);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = cssVar("--surface");
  ctx.fillRect(0, 0, width, height);

  const colors = [null, cssVar("--ink"), cssVar("--red"), cssVar("--blue")];
  const left = (width - cols * cell) / 2;
  const gap = cell >= 4 ? 0.5 : 0;
  for (let t = 0; t < nRows; t++) {
    const row = run.rows[t];
    const n = Math.min(row.length, cols);
    for (let i = 0; i < n; i++) {
      const v = row[i];
      if (!v) continue;
      ctx.fillStyle = colors[v];
      ctx.fillRect(left + i * cell, t * cell, cell - gap, cell - gap);
    }
  }

  // Encoding origin x0, drawn as in the paper's figures.
  ctx.fillStyle = cssVar("--green");
  ctx.fillRect(Math.round(left + run.x0 * cell) - 1, 0, 1.5, height);
}

function em43Readout(el, task, x, run) {
  if (!el) return;
  const expected = task.f(x);
  const range = x > EM43.trainMax ? "outside the training range" : "inside the training range";
  if (!run.halted) {
    el.innerHTML = `x = ${x}: <span class="bad">did not halt within ${EM43.maxSteps} steps</span>`;
    return;
  }
  const ok = run.y === expected;
  el.innerHTML =
    `${task.label} at x = ${x} → output ${run.y ?? "none"} ` +
    `<span class="${ok ? "ok" : "bad"}">${ok ? "✓ correct" : `✗ expected ${expected}`}</span>` +
    ` · halted after ${run.steps} steps · ${range}`;
}

function setupEm43(figure) {
  const canvas = figure.querySelector("canvas");
  const taskSelect = figure.querySelector("[data-em43-task]");
  const input = figure.querySelector("[data-em43-x]");
  const randomBtn = figure.querySelector("[data-em43-random]");
  const readout = figure.querySelector("[data-em43-readout]");
  const maxHeight = Number(figure.dataset.maxHeight || 420);

  let taskKey = figure.dataset.task;
  let x = Number(figure.dataset.x);
  let run = null;

  const render = (recompute) => {
    const task = EM43_TASKS[taskKey];
    if (recompute || !run) run = em43Run(task, x);
    em43Draw(canvas, run, maxHeight);
    em43Readout(readout, task, x, run);
  };

  if (taskSelect) {
    taskSelect.value = taskKey;
    taskSelect.addEventListener("change", () => { taskKey = taskSelect.value; render(true); });
  }
  if (input) {
    input.value = String(x);
    input.max = String(EM43.inputMax);
    input.addEventListener("change", () => {
      const v = Math.round(Number(input.value));
      x = Number.isFinite(v) ? Math.min(EM43.inputMax, Math.max(0, v)) : 0;
      input.value = String(x);
      render(true);
    });
  }
  if (randomBtn) {
    randomBtn.addEventListener("click", () => {
      x = EM43.trainMax + 1 + Math.floor(Math.random() * (EM43.inputMax - EM43.trainMax));
      if (input) input.value = String(x);
      render(true);
    });
  }

  render(true);
  return () => render(false);
}

function setupCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const target = document.getElementById(btn.dataset.copy);
      if (!target) return;
      try {
        await navigator.clipboard.writeText(target.textContent.trim());
        btn.textContent = "copied";
      } catch {
        btn.textContent = "select and copy";
      }
      setTimeout(() => { btn.textContent = "copy"; }, 2000);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  setupCopyButtons();

  const redraws = Array.from(document.querySelectorAll("[data-em43]"), setupEm43);
  if (redraws.length) {
    let timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => redraws.forEach((redraw) => redraw()), 150);
    });
    window.matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => redraws.forEach((redraw) => redraw()));
  }
});
