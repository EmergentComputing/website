// Emergent Computing — page behaviour. Requires viz.js (the model engine).
// 1. Light/dark mode (system default, manual override remembered).
// 2. Hero: interactive EM43 player (task, input, play/pause, step, restart, speed).
// 3. Figures: <canvas data-viz="..."> computed from real models.
// 4. EM43 explorer (Emergent Models page), BibTeX copy, footer year.

(function () {
  const root = document.documentElement;
  const redraws = [];
  const redrawAll = () => redraws.forEach((f) => f());

  // ---------- colours ----------
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  function toRGB(color) {
    probe.clearRect(0, 0, 1, 1); probe.fillStyle = "#000"; probe.fillStyle = color; probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
  }
  function palette(el) {
    const cs = getComputedStyle(el), v = (n) => cs.getPropertyValue(n).trim();
    return {
      bg: v("--fig"), page: v("--bg"), surface: v("--surface"), ink: v("--ink"), ink2: v("--ink-2"), ink3: v("--ink-3"),
      red: v("--red"), blue: v("--blue"), green: v("--green"), grid: v("--grid"), brand: v("--brand"),
      accent: v("--accent") || v("--brand"),
      tasks: [v("--c-em"), v("--c-lutm"), v("--c-nca"), v("--c-reason"), v("--c-hw")],
    };
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c) => `rgb(${c.join(",")})`;

  // ---------- light / dark ----------
  function setupMode() {
    const btn = document.querySelector("[data-mode-toggle]");
    const label = () => btn && btn.setAttribute("aria-label", root.dataset.mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
    label();
    if (btn) btn.addEventListener("click", () => {
      root.dataset.mode = root.dataset.mode === "dark" ? "light" : "dark";
      try { localStorage.setItem("ec-mode", root.dataset.mode); } catch (e) { /* storage unavailable */ }
      label(); requestAnimationFrame(redrawAll);
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", (e) => {
      let stored = null; try { stored = localStorage.getItem("ec-mode"); } catch (err) { /* ignore */ }
      if (!stored) { root.dataset.mode = e.matches ? "dark" : "light"; label(); requestAnimationFrame(redrawAll); }
    });
  }

  // ---------- drawing helpers ----------
  function label(ctx, text, x, y, c, align = "left") {
    ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
    const w = ctx.measureText(text).width + 10, h = 18;
    const bx = align === "right" ? x - w : x;
    ctx.fillStyle = c.surface; ctx.globalAlpha = 0.92; ctx.fillRect(bx, y - h / 2, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 0.6; ctx.strokeRect(bx + 0.5, y - h / 2 + 0.5, w - 1, h - 1);
    ctx.fillStyle = c.ink; ctx.fillText(text, bx + 5, y + 4);
  }

  function drawEM43(ctx, run, box, c, from = 0, upto = run.steps) {
    const { x, y, w, h } = box;
    const rows = upto - from + 1;
    const cell = Math.min(w / run.cols, h / rows);
    const ox = x + (w - run.cols * cell) / 2;
    const pal = [null, c.ink, c.red, c.blue], s = Math.max(cell - (cell > 3 ? 0.7 : 0), 0.8);
    for (let t = from; t <= upto; t++) {
      const r = run.rows[t], py = y + (t - from) * cell;
      for (let j = 0; j < Math.min(r.length, run.cols); j++) if (r[j]) { ctx.fillStyle = pal[r[j]]; ctx.fillRect(ox + j * cell, py, s, s); }
    }
    ctx.fillStyle = c.green; ctx.fillRect(ox + run.x0 * cell - 0.75, y, 1.5, rows * cell);
    return { cell, ox };
  }

  function bitmap(width, height, paint) {
    const off = document.createElement("canvas"); off.width = width; off.height = height;
    const octx = off.getContext("2d"), img = octx.createImageData(width, height);
    paint(img.data); octx.putImageData(img, 0, 0); return off;
  }

  // Downsample horizontally with smoothing, then upscale vertically without it: crisp rows, no streaks.
  function drawCrisp(ctx, src, x, y, w, h) {
    const mid = document.createElement("canvas"); mid.width = Math.max(1, Math.round(w)); mid.height = src.height;
    const m = mid.getContext("2d"); m.imageSmoothingEnabled = true; m.imageSmoothingQuality = "high";
    m.drawImage(src, 0, 0, mid.width, src.height);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(mid, x, y, w, h); ctx.imageSmoothingEnabled = true;
  }

  // ---------- figures ----------
  const FIGS = {
    em43(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), run = VZ.em43Run(cv.dataset.task || "mod4", Number(cv.dataset.x || 70));
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const pad = 10, cell = Math.min((w - 2 * pad) / run.cols, (h - 2 * pad) / (run.steps + 1)), bh = (run.steps + 1) * cell;
      drawEM43(ctx, run, { x: pad, y: (h - bh) / 2, w: w - 2 * pad, h: bh }, c);
    },

    lutm(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), run = VZ.lutm6Run(VZ.LUTM6.parityEvolved, cv.dataset.input || "1101001");
      const accent = c.accent || c.tasks[1];
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const pad = 12, laneH = Math.round(h * 0.26), gap = 12, T = run.rows.length, W = run.width;
      const plot = { x: pad, w: w - 2 * pad };
      const dataY = pad + laneH + gap, dataH = h - dataY - pad;
      // program-head lane
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.strokeRect(plot.x + 0.5, pad + 0.5, plot.w - 1, laneH - 1);
      ctx.strokeStyle = accent; ctx.lineWidth = w > 420 ? 1.1 : 0.8; ctx.beginPath();
      run.pheads.forEach((ph, t) => { const X = plot.x + (t / (T - 1)) * plot.w, Y = pad + 3 + (Math.max(0, Math.min(run.programLength, ph)) / run.programLength) * (laneH - 6); t ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
      // data tape
      const bg = toRGB(c.bg), ink = toRGB(c.ink), blue = toRGB(c.blue);
      const pal = [bg, mix(bg, ink, 0.28), mix(bg, ink, 0.85), blue];
      const off = bitmap(T, W, (d) => {
        for (let t = 0; t < T; t++) for (let j = 0; j < W; j++) {
          const col = pal[run.rows[t][j]], k = (j * T + t) * 4;
          d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
        }
      });
      drawCrisp(ctx, off, plot.x, dataY, plot.w, dataH);
      ctx.strokeStyle = c.red; ctx.lineWidth = 1.1; ctx.beginPath();
      run.heads.forEach((hd, t) => { const X = plot.x + (t / (T - 1)) * plot.w, Y = dataY + ((hd + 0.5) / W) * dataH; t ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
      if (w > 420) {
        label(ctx, "program head", plot.x + 6, pad + 12, c);
        label(ctx, `time → ${run.steps} steps`, plot.x + plot.w - 6, pad + 12, c, "right");
        label(ctx, "data tape", plot.x + 6, dataY + 12, c);
      }
    },

    cem(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), run = VZ.cem1d(8);
      const bg = toRGB(c.bg), neg = toRGB(c.blue), pos = toRGB(c.red), T = run.rows.length, L = run.L;
      const lab = w > 260 ? 30 : 0, plotW = w - lab;
      const off = bitmap(T, L, (d) => {
        for (let t = 0; t < T; t++) for (let j = 0; j < L; j++) {
          const v = Math.max(-1, Math.min(1, run.rows[t][j] / 2.5)), col = mix(bg, v < 0 ? neg : pos, Math.pow(Math.abs(v), 0.8)), k = (j * T + t) * 4;
          d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
        }
      });
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      drawCrisp(ctx, off, lab, 0, plotW, h);
      ctx.strokeStyle = c.page; ctx.lineWidth = 1.5;
      for (let m = 1; m < T / run.T; m++) { const x = lab + Math.round((m * run.T / T) * plotW) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      if (lab) {
        ctx.font = "10px 'IBM Plex Mono', ui-monospace, monospace";
        run.ports.forEach((j) => { ctx.fillStyle = c.ink3; ctx.fillText("in", 6, ((j + 0.5) / L) * h + 3.5); });
        ctx.fillStyle = c.green; ctx.fillText("out", 4, ((run.out + 0.5) / L) * h + 3.5);
      }
    },

    act(cv, c) {
      const { ctx, w, h } = VZ.fit(cv);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const keys = ["plus1", "x2", "mod4", "rounddiv3", "mod2c"], xs = [];
      for (let x = 0; x <= 120; x += 4) xs.push(x);
      const data = keys.map((k) => xs.map((x) => VZ.em43Run(k, x).steps));
      const maxT = Math.max(...data.flat()), pl = 16, pb = 24, pt = 26;
      const X = (x) => pl + (x / 120) * (w - 2 * pl), Y = (t) => h - pb - (t / maxT) * (h - pb - pt);
      ctx.fillStyle = c.page; ctx.globalAlpha = 0.5; ctx.fillRect(X(0), pt, X(30) - X(0), h - pb - pt); ctx.globalAlpha = 1;
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl, h - pb + 0.5); ctx.lineTo(w - pl, h - pb + 0.5); ctx.stroke();
      const cols = c.tasks;
      data.forEach((series, i) => {
        ctx.strokeStyle = cols[i]; ctx.lineWidth = 1.8; ctx.beginPath();
        series.forEach((t, n) => (n ? ctx.lineTo(X(xs[n]), Y(t)) : ctx.moveTo(X(xs[n]), Y(t)))); ctx.stroke();
      });
      ctx.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
      if (w > 620) {
        let lx = w - pl;
        keys.slice().reverse().forEach((k, n) => {
          const t = VZ.EM43[k].label, tw = ctx.measureText(t).width;
          lx -= tw; ctx.fillStyle = c.ink3; ctx.fillText(t, lx, 15);
          lx -= 13; ctx.fillStyle = cols[keys.length - 1 - n]; ctx.fillRect(lx, 7, 9, 9); lx -= 16;
        });
      }
      ctx.fillStyle = c.ink3;
      ctx.fillText("steps until halt", pl, 15); ctx.fillText("input x →", w - pl - 66, h - 7); ctx.fillText("training range", X(0) + 4, h - 7);
    },

    cone(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), cell = 3, cols = Math.floor(w / cell), steps = Math.floor(h / cell), rows = VZ.eca(30, cols, steps);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h); ctx.fillStyle = c.ink;
      rows.forEach((r, t) => r.forEach((v, j) => { if (v) ctx.fillRect(j * cell, t * cell, cell - 0.6, cell - 0.6); }));
      const cx = (cols >> 1) * cell + cell / 2;
      ctx.strokeStyle = c.accent || c.tasks[4]; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
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

  // ---------- hero player ----------
  function setupHero() {
    const hero = document.querySelector("[data-ca]"); if (!hero) return;
    const cv = hero.querySelector("[data-ca-canvas]"), panel = hero.querySelector(".ca-panel");
    const q = (s) => hero.querySelector(s);
    const sel = q("[data-ca-task]"), inp = q("[data-ca-x]"), playBtn = q("[data-ca-play]");
    const speedIn = q("[data-ca-speed]"), out = q("[data-ca-readout]");
    const playlist = [["x2", 96], ["mod4", 150], ["rounddiv3", 140], ["mod2c", 61], ["plus1", 120]];
    let pi = 0, run, k = 0, playing = !VZ.reduced(), auto = true, hold = 0, acc = 0, last = 0;

    const setPlayIcon = () => {
      playBtn.innerHTML = playing
        ? '<svg viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>';
      playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    };

    function load(key, x) {
      run = VZ.em43Run(key, Math.max(0, Math.min(150, x))); k = 0; hold = 0;
      sel.value = key; inp.value = String(run.x);
    }

    function readout() {
      const task = VZ.EM43[run.key], done = k >= run.steps;
      const range = run.x > 30 ? "outside training range (x ≤ 30)" : "inside training range";
      out.innerHTML = `<span class="readout-line">step <b>${k}</b> / ${run.steps}</span> · ` +
        (done ? `output <b>${run.y}</b> <span class="${run.ok ? "ok" : "bad"}">${run.ok ? "✓" : "✗"}</span> (${task.label} = ${task.f(run.x)})` : "running…") +
        ` · ${range}`;
    }

    function draw() {
      const { ctx, w, h } = VZ.fit(cv), c = palette(hero);
      ctx.fillStyle = c.page; ctx.fillRect(0, 0, w, h);
      const narrow = w < 860;
      const area = narrow ? w - 24 : Math.min(w * 0.5, w - 700) - 32, left = narrow ? 12 : w - area - 32;
      const reserve = narrow ? 12 : (panel ? panel.offsetHeight + 56 : 40);
      const top = narrow ? 14 : 48, availH = h - top - reserve;
      const cell = Math.min(area / run.cols, 10), N = Math.max(1, Math.floor(availH / cell));
      const from = Math.max(0, k - N + 1);
      const { ox } = drawEM43(ctx, run, { x: left, y: top, w: area, h: (k - from + 1) * cell }, c, from, k);
      // fade older rows when scrolling
      if (from > 0) {
        const g = ctx.createLinearGradient(0, top, 0, top + 60);
        const pg = toRGB(c.page);
        g.addColorStop(0, rgb(pg)); g.addColorStop(1, `rgba(${pg.join(",")},0)`);
        ctx.fillStyle = g; ctx.fillRect(left - 2, top - 1, area + 4, 61);
      }
      // computation frontier
      const fy = top + (k - from) * cell;
      ctx.fillStyle = c.brand; ctx.globalAlpha = 0.14; ctx.fillRect(left, fy - 1, area, cell + 2); ctx.globalAlpha = 1;
      // annotations
      if (from === 0 && w > 500) {
        label(ctx, "input x", ox + (run.x0 + run.x) * cell + cell + 6, top + cell / 2 + 10, c);
        label(ctx, "origin", ox + run.x0 * cell - 6, top - 14, c, "right");
      }
      if (k >= run.steps && run.y != null && w > 500) {
        label(ctx, `output y = ${run.y}`, ox + (run.x0 + run.y) * cell + cell + 6, fy + cell / 2, c);
      }
      readout();
    }

    function tick(t) {
      const dt = Math.min(100, t - (last || t)); last = t;
      if (playing) {
        acc += dt * Number(speedIn.value) / 1000;
        let changed = false;
        while (acc >= 1) {
          acc -= 1;
          if (k < run.steps) { k++; changed = true; }
          else if (auto && ++hold > 60) { pi = (pi + 1) % playlist.length; load(...playlist[pi]); changed = true; }
        }
        if (changed) draw();
      }
      requestAnimationFrame(tick);
    }

    const userTakes = () => { auto = false; };
    sel.addEventListener("change", () => { userTakes(); load(sel.value, Number(inp.value)); playing = true; setPlayIcon(); draw(); });
    inp.addEventListener("change", () => { userTakes(); load(sel.value, Math.round(Number(inp.value) || 0)); playing = true; setPlayIcon(); draw(); });
    playBtn.addEventListener("click", () => { if (!playing && k >= run.steps) k = 0; playing = !playing; setPlayIcon(); draw(); });
    q("[data-ca-step]").addEventListener("click", () => { userTakes(); playing = false; setPlayIcon(); if (k < run.steps) k++; draw(); });
    q("[data-ca-restart]").addEventListener("click", () => { k = 0; hold = 0; draw(); });
    q("[data-ca-random]").addEventListener("click", () => { userTakes(); load(sel.value, 31 + Math.floor(Math.random() * 120)); playing = true; setPlayIcon(); draw(); });
    q("[data-ca-end]").addEventListener("click", () => { userTakes(); k = run.steps; playing = false; setPlayIcon(); draw(); });

    load(...playlist[0]);
    if (!playing) k = run.steps;
    setPlayIcon(); draw(); redraws.push(draw);
    requestAnimationFrame(tick);
  }

  // ---------- EM43 explorer ----------
  function setupExplorer(fig) {
    const cv = fig.querySelector("canvas"), sel = fig.querySelector("[data-task]"), inp = fig.querySelector("[data-x]");
    const rnd = fig.querySelector("[data-random]"), out = fig.querySelector("[data-readout]");
    let run;
    const compute = () => { run = VZ.em43Run(sel.value, Math.max(0, Math.min(150, Math.round(Number(inp.value) || 0)))); inp.value = String(run.x); };
    const draw = () => {
      const c = palette(cv), cell = Math.min((cv.clientWidth - 20) / run.cols, 460 / (run.steps + 1), 10);
      cv.style.height = `${Math.ceil((run.steps + 1) * cell) + 20}px`;
      const { ctx, w, h } = VZ.fit(cv); ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      drawEM43(ctx, run, { x: 10, y: 10, w: w - 20, h: h - 20 }, c);
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
    document.querySelectorAll("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
    setupMode();
    setupCopy();
    setupFigures();
    setupHero();
    document.querySelectorAll("[data-explorer]").forEach(setupExplorer);
    let timer;
    window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(redrawAll, 150); });
  });
})();
