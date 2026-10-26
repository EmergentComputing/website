// Emergent Computing — page behaviour. Requires viz.js (the model engine).
// 1. Design switch (A editorial / B instrument), remembered in localStorage.
// 2. Hero: EM43 computations rendered step by step.
// 3. Figures: <canvas data-viz="..."> computed from real models.
// 4. EM43 explorer with task and input controls.
// 5. BibTeX copy buttons and footer year.

(function () {
  const root = document.documentElement;
  const theme = () => root.dataset.theme || "a";
  const redraws = [];
  const redrawAll = () => redraws.forEach((f) => f());

  // ---------- colours ----------
  const probe = document.createElement("canvas").getContext("2d");
  function toRGB(color) {
    probe.clearRect(0, 0, 1, 1); probe.fillStyle = "#000"; probe.fillStyle = color; probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
  }
  function palette(el) {
    const cs = getComputedStyle(el), v = (n) => cs.getPropertyValue(n).trim();
    return { bg: v("--fig"), ink: v("--ink"), ink3: v("--ink-3"), red: v("--red"), blue: v("--blue"), green: v("--green"), grid: v("--grid") };
  }

  // ---------- theme ----------
  function setTheme(t) {
    root.dataset.theme = t;
    try { localStorage.setItem("ec-theme", t); } catch (e) { /* storage unavailable */ }
    document.querySelectorAll("[data-set-theme]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setTheme === t)));
    requestAnimationFrame(redrawAll);
  }

  // ---------- EM43 drawing ----------
  function drawEM43(ctx, run, box, c, upto = run.steps) {
    const { x, y, w, h } = box;
    const cell = Math.min(w / run.cols, h / (run.steps + 1));
    const ox = x + (w - run.cols * cell) / 2, oy = y;
    const pal = [null, c.ink, c.red, c.blue], s = Math.max(cell - (cell > 3 ? 0.6 : 0), 0.8);
    for (let t = 0; t <= upto; t++) {
      const r = run.rows[t];
      for (let j = 0; j < Math.min(r.length, run.cols); j++) if (r[j]) { ctx.fillStyle = pal[r[j]]; ctx.fillRect(ox + j * cell, oy + t * cell, s, s); }
    }
    ctx.fillStyle = c.green; ctx.fillRect(ox + run.x0 * cell - 0.5, oy, 1, (run.steps + 1) * cell);
    return { cell, ox, oy };
  }

  // ---------- figures ----------
  function bitmap(width, height, paint) {
    const off = document.createElement("canvas"); off.width = width; off.height = height;
    const octx = off.getContext("2d"), img = octx.createImageData(width, height);
    paint(img.data); octx.putImageData(img, 0, 0); return off;
  }

  const FIGS = {
    em43(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), run = VZ.em43Run(cv.dataset.task || "mod4", Number(cv.dataset.x || 70));
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const cell = Math.min(w / run.cols, h / (run.steps + 1)), bh = (run.steps + 1) * cell;
      drawEM43(ctx, run, { x: 0, y: (h - bh) / 2, w, h: bh }, c);
    },
    lutm(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), run = VZ.lutm6Run(VZ.LUTM6.parityEvolved, cv.dataset.input || "1101001");
      const bg = toRGB(c.bg), ink = toRGB(c.ink), blue = toRGB(c.blue), red = toRGB(c.red);
      const mid = ink.map((v, i) => Math.round(v * 0.35 + bg[i] * 0.65)), pal = [bg, mid, ink, blue];
      const T = run.rows.length, W = run.width;
      const off = bitmap(T, W, (d) => {
        for (let t = 0; t < T; t++) for (let j = 0; j < W; j++) {
          const col = j === run.heads[t] ? red : pal[run.rows[t][j]], k = (j * T + t) * 4;
          d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
        }
      });
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      const ch = Math.min(h - 8, W * 7); ctx.drawImage(off, 0, (h - ch) / 2, w, ch);
    },
    cem(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), run = VZ.cem1d(8);
      const bg = toRGB(c.bg), neg = toRGB(c.blue), pos = toRGB(c.red), T = run.rows.length, L = run.L;
      const off = bitmap(T, L, (d) => {
        for (let t = 0; t < T; t++) for (let j = 0; j < L; j++) {
          const v = Math.max(-1, Math.min(1, run.rows[t][j] / 2.5)), tgt = v < 0 ? neg : pos, a = Math.abs(v), k = (j * T + t) * 4;
          for (let q = 0; q < 3; q++) d[k + q] = Math.round(bg[q] + (tgt[q] - bg[q]) * a);
          d[k + 3] = 255;
        }
      });
      ctx.imageSmoothingEnabled = false; ctx.drawImage(off, 0, 0, w, h);
      ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.3;
      for (let m = 1; m < T / run.T; m++) { const x = Math.round((m * run.T / T) * w) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      ctx.globalAlpha = 1;
    },
    act(cv, c) {
      const { ctx, w, h } = VZ.fit(cv);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const keys = ["plus1", "x2", "mod4", "rounddiv3", "mod2c"], xs = [];
      for (let x = 0; x <= 120; x += 4) xs.push(x);
      const data = keys.map((k) => xs.map((x) => VZ.em43Run(k, x).steps));
      const maxT = Math.max(...data.flat()), pl = 16, pb = 22, pt = 22;
      const X = (x) => pl + (x / 120) * (w - 2 * pl), Y = (t) => h - pb - (t / maxT) * (h - pb - pt);
      ctx.strokeStyle = c.ink3; ctx.globalAlpha = 0.6; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X(30), pt); ctx.lineTo(X(30), h - pb); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      const cols = [c.ink, c.red, c.blue, c.green, c.ink3];
      data.forEach((series, i) => {
        ctx.strokeStyle = cols[i]; ctx.lineWidth = 1.6; ctx.beginPath();
        series.forEach((t, n) => (n ? ctx.lineTo(X(xs[n]), Y(t)) : ctx.moveTo(X(xs[n]), Y(t)))); ctx.stroke();
      });
      ctx.font = "11px ui-monospace, monospace";
      let lx = w - pl;
      if (w > 620) keys.slice().reverse().forEach((k, n) => {
        const label = VZ.EM43[k].label, tw = ctx.measureText(label).width;
        lx -= tw; ctx.fillStyle = c.ink3; ctx.fillText(label, lx, 14);
        lx -= 12; ctx.fillStyle = cols[keys.length - 1 - n]; ctx.fillRect(lx, 6, 8, 8); lx -= 14;
      });
      ctx.fillStyle = c.ink3;
      ctx.fillText("steps until halt", pl, 14); ctx.fillText("input x →", w - pl - 64, h - 6); ctx.fillText("train ≤ 30", X(30) + 5, h - 6);
    },
    cone(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), cell = 3, cols = Math.floor(w / cell), steps = Math.floor(h / cell), rows = VZ.eca(30, cols, steps);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h); ctx.fillStyle = c.ink;
      rows.forEach((r, t) => r.forEach((v, j) => { if (v) ctx.fillRect(j * cell, t * cell, cell - 0.5, cell - 0.5); }));
      const cx = (cols >> 1) * cell + cell / 2;
      ctx.strokeStyle = c.red; ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx - steps * cell, steps * cell); ctx.moveTo(cx, 0); ctx.lineTo(cx + steps * cell, steps * cell); ctx.stroke();
      ctx.setLineDash([]);
    },
  };

  function setupFigures() {
    document.querySelectorAll("canvas[data-viz]").forEach((cv) => {
      const fn = FIGS[cv.dataset.viz]; if (!fn) return;
      const draw = () => fn(cv, palette(cv));
      draw(); redraws.push(draw);
    });
  }

  // ---------- hero ----------
  function setupHero() {
    const fig = document.querySelector("[data-hero]"); if (!fig) return;
    const cv = fig.querySelector("canvas"), q = (s) => fig.querySelector(s);
    const list = [["x2", 96], ["mod4", 150], ["rounddiv3", 140], ["mod2c", 61], ["plus1", 120]];
    let i = 0, run, k = 0, hold = 0, last = 0;

    function paintRule() {
      const c = palette(fig), pal = [c.grid, c.ink, c.red, c.blue];
      q("[data-hero-rule]").innerHTML = Array.from(VZ.em43Rule(VZ.EM43[run.key]), (v) => `<i style="background:${pal[v]}"></i>`).join("");
    }

    function next() {
      const [key, x] = list[i++ % list.length];
      run = VZ.em43Run(key, x); k = 0; hold = 0;
      q("[data-hero-task]").textContent = VZ.EM43[key].label;
      q("[data-hero-x]").textContent = String(x);
      paintRule();
    }

    function draw() {
      const { ctx, w, h } = VZ.fit(cv), c = palette(fig);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      if (theme() === "a") {
        // Editorial: rows scroll upward as the computation proceeds; diagram on the right.
        const narrow = w < 900, area = narrow ? w : w * 0.56, left = w - area;
        const cell = Math.min(area / run.cols, 9), N = Math.floor(h / cell), start = Math.max(0, k - N + 1);
        const ox = left + (area - run.cols * cell) / 2, pal = [null, c.ink, c.red, c.blue];
        for (let t = start; t <= k; t++) {
          const r = run.rows[t], y = (t - start) * cell;
          for (let j = 0; j < Math.min(r.length, run.cols); j++) if (r[j]) { ctx.fillStyle = pal[r[j]]; ctx.fillRect(ox + j * cell, y, cell - 0.6, cell - 0.6); }
        }
        ctx.fillStyle = c.green; ctx.fillRect(ox + run.x0 * cell - 1, 0, 1.2, h);
      } else {
        // Instrument: grid, time axis and a scan line.
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
        const pl = 36, pt = 14, W = w - pl - 14, H = h - pt - 14;
        const { cell } = drawEM43(ctx, run, { x: pl, y: pt, w: W, h: H }, c, k);
        ctx.fillStyle = c.ink3; ctx.font = "10px ui-monospace, monospace";
        for (let t = 0; t <= run.steps; t += 50) ctx.fillText(String(t), 6, pt + t * cell + 4);
        ctx.fillStyle = c.red; ctx.globalAlpha = 0.18; ctx.fillRect(pl, pt + k * cell, W, Math.max(cell, 2)); ctx.globalAlpha = 1;
      }
      q("[data-hero-t]").textContent = `${k} / ${run.steps}`;
      q("[data-hero-y]").innerHTML = k >= run.steps ? `${run.y} <span class="ok">✓</span>` : "…";
    }

    function tick(t) {
      if (t - last > 28) { last = t; if (k < run.steps) k++; else if (++hold > 70) next(); draw(); }
      requestAnimationFrame(tick);
    }

    next();
    cv.addEventListener("click", () => { next(); draw(); });
    redraws.push(() => { paintRule(); draw(); });
    if (VZ.reduced()) { k = run.steps; draw(); } else requestAnimationFrame(tick);
  }

  // ---------- EM43 explorer ----------
  function setupExplorer(fig) {
    const cv = fig.querySelector("canvas"), sel = fig.querySelector("[data-task]"), inp = fig.querySelector("[data-x]");
    const rnd = fig.querySelector("[data-random]"), out = fig.querySelector("[data-readout]");
    let run;
    const compute = () => { run = VZ.em43Run(sel.value, Math.max(0, Math.min(150, Math.round(Number(inp.value) || 0)))); inp.value = String(run.x); };
    const draw = () => {
      const c = palette(cv), cell = Math.min(cv.clientWidth / run.cols, 460 / (run.steps + 1), 10);
      cv.style.height = `${Math.ceil((run.steps + 1) * cell)}px`;
      const { ctx, w, h } = VZ.fit(cv); ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      drawEM43(ctx, run, { x: 0, y: 0, w, h }, c);
      const task = VZ.EM43[run.key];
      out.innerHTML = `${task.label} at x = ${run.x} → ${run.y ?? "no output"} ` +
        `<span class="${run.ok ? "ok" : "bad"}">${run.ok ? "✓ correct" : `✗ expected ${task.f(run.x)}`}</span> · ${run.steps} steps · ` +
        (run.x > 30 ? "outside the training range" : "inside the training range");
    };
    sel.addEventListener("change", () => { compute(); draw(); });
    inp.addEventListener("change", () => { compute(); draw(); });
    rnd.addEventListener("click", () => { inp.value = String(31 + Math.floor(Math.random() * 120)); compute(); draw(); });
    compute(); draw(); redraws.push(draw);
  }

  // ---------- misc ----------
  function setupCopy() {
    document.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const el = document.getElementById(btn.dataset.copy); if (!el) return;
        try { await navigator.clipboard.writeText(el.textContent.trim()); btn.textContent = "copied"; }
        catch (e) { btn.textContent = "select and copy"; }
        setTimeout(() => { btn.textContent = "copy"; }, 2000);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-set-theme]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.setTheme === theme()));
      b.addEventListener("click", () => setTheme(b.dataset.setTheme));
    });
    document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
    setupCopy();
    setupFigures();
    setupHero();
    document.querySelectorAll("[data-explorer]").forEach(setupExplorer);
    let timer;
    window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(redrawAll, 150); });
  });
})();
