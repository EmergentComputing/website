// Emergent Computing — page behaviour. Requires viz.js (the model engine).
// 1. Light/dark mode (system default, manual override remembered).
// 2. Hero: interactive EM43 player (task, input, play/pause, step, restart, speed).
// 3. Figures: <canvas data-viz="..."> computed from real models; animated ones play while visible.
// 4. EM43 explorer, BibTeX copy, footer year.

(function () {
  const root = document.documentElement;
  const redraws = [];
  const redrawAll = () => { palettes.clear(); redraws.forEach((f) => f()); };

  // ---------- colours ----------
  const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  function toRGB(color) {
    probe.clearRect(0, 0, 1, 1); probe.fillStyle = "#000"; probe.fillStyle = color; probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
  }
  const palettes = new Map();
  function palette(el) {
    if (palettes.has(el)) return palettes.get(el);
    const cs = getComputedStyle(el), v = (n) => cs.getPropertyValue(n).trim();
    const c = {
      bg: v("--fig"), page: v("--bg"), surface: v("--surface"), ink: v("--ink"), ink2: v("--ink-2"), ink3: v("--ink-3"),
      red: v("--red"), blue: v("--blue"), green: v("--green"), grid: v("--grid"), rule: v("--rule"), brand: v("--brand"),
      accent: v("--accent") || v("--brand"),
      tasks: [v("--c-em"), v("--c-lutm"), v("--c-nca"), v("--c-reason"), v("--c-hw")],
    };
    palettes.set(el, c); return c;
  }
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const rgb = (c) => `rgb(${c.join(",")})`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t = clamp(t, 0, 1), t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const MONO = "'IBM Plex Mono', ui-monospace, monospace";
  const MATH = "italic 400 17px 'Newsreader', Georgia, serif";

  // ---------- light / dark ----------
  function setupMode() {
    const btn = document.querySelector("[data-mode-toggle]");
    const say = () => btn && btn.setAttribute("aria-label", root.dataset.mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
    say();
    if (btn) btn.addEventListener("click", () => {
      root.dataset.mode = root.dataset.mode === "dark" ? "light" : "dark";
      try { localStorage.setItem("ec-mode", root.dataset.mode); } catch (e) { /* storage unavailable */ }
      say(); requestAnimationFrame(redrawAll);
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      let stored = null; try { stored = localStorage.getItem("ec-mode"); } catch (err) { /* ignore */ }
      if (!stored) { root.dataset.mode = e.matches ? "dark" : "light"; say(); requestAnimationFrame(redrawAll); }
    });
  }

  // ---------- drawing helpers ----------
  // Pill label, always kept inside the canvas.
  function label(ctx, text, x, y, c, align = "left") {
    ctx.font = `11px ${MONO}`;
    const w = ctx.measureText(text).width + 10, h = 18;
    const W = ctx.canvas.clientWidth || 1e4, H = ctx.canvas.clientHeight || 1e4;
    const bx = clamp(align === "right" ? x - w : x, 2, W - w - 2), cy = clamp(y, h / 2 + 2, H - h / 2 - 2);
    ctx.fillStyle = c.surface; ctx.globalAlpha = 0.94; ctx.fillRect(bx, cy - h / 2, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = c.ink3; ctx.lineWidth = 0.6; ctx.strokeRect(bx + 0.5, cy - h / 2 + 0.5, w - 1, h - 1);
    ctx.fillStyle = c.ink; ctx.fillText(text, bx + 5, cy + 4);
  }
  // maxW > 0 shrinks the font so the string fits in maxW pixels.
  function text(ctx, s, x, y, color, align = "left", font = `11px ${MONO}`, maxW = 0) {
    ctx.font = font;
    const tw = ctx.measureText(s).width;
    if (maxW > 0 && tw > maxW) ctx.font = font.replace(/(\d+(?:\.\d+)?)px/, (m, px) => `${((px * maxW) / tw).toFixed(1)}px`);
    ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y); ctx.textAlign = "left";
  }
  function arrow(ctx, x1, y1, x2, y2, color, lw = 1.5) {
    const a = Math.atan2(y2 - y1, x2 - x1), hd = 8;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - hd * 0.8 * Math.cos(a), y2 - hd * 0.8 * Math.sin(a)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hd * Math.cos(a - 0.45), y2 - hd * Math.sin(a - 0.45));
    ctx.lineTo(x2 - hd * Math.cos(a + 0.45), y2 - hd * Math.sin(a + 0.45)); ctx.fill();
  }
  // Signed value -> colour: red positive, blue negative, background at zero.
  // Horizontal colour bar for diverging(c) over [-vmax, vmax], with end and zero labels.
  function colorbar(ctx, c, col, x, y, w, vmax) {
    const n = 64, fmt = (v) => String(Math.round(v * 10) / 10);
    for (let i = 0; i < n; i++) { ctx.fillStyle = col(-vmax + (2 * vmax * (i + 0.5)) / n, vmax); ctx.fillRect(x + (i * w) / n, y, w / n + 0.6, 6); }
    ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, 7);
    const f = `11px ${MONO}`;
    text(ctx, "−" + fmt(vmax), x, y + 19, c.ink3, "left", f);
    text(ctx, "0", x + w / 2, y + 19, c.ink3, "center", f);
    text(ctx, fmt(vmax), x + w, y + 19, c.ink3, "right", f);
  }

  function diverging(c) {
    const bg = toRGB(c.bg), pos = toRGB(c.red), neg = toRGB(c.blue);
    return (v, scale = 3) => { const a = Math.min(1, Math.abs(v) / scale) ** 0.8; return rgb(mix(bg, v < 0 ? neg : pos, a)); };
  }

  function drawEM43(ctx, run, box, c, from = 0, upto = run.steps, cellMax = Infinity) {
    const { x, y, w, h } = box;
    const rows = upto - from + 1;
    const cell = Math.min(w / run.cols, h / rows, cellMax);
    const ox = x + (w - run.cols * cell) / 2;
    const pal = [null, c.ink, c.red, c.blue], s = Math.max(cell - (cell > 4 ? Math.min(1.2, cell * 0.12) : 0), 0.8);
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

  // ---------- static figures: fn(canvas, colours) ----------
  const FIGS = {
    em43(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), run = VZ.em43Run(cv.dataset.task || "mod4", Number(cv.dataset.x || 70));
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const pad = 10, cell = Math.min((w - 2 * pad) / run.cols, (h - 2 * pad) / (run.steps + 1)), bh = (run.steps + 1) * cell;
      drawEM43(ctx, run, { x: pad, y: (h - bh) / 2, w: w - 2 * pad, h: bh }, c);
    },

    lutm(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), run = VZ.lutm6Run(VZ.LUTM6.parityEvolved, cv.dataset.input || "1101001");
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const pad = 12, laneH = Math.round(h * 0.26), gap = 12, T = run.rows.length, W = run.width;
      const plot = { x: pad, w: w - 2 * pad };
      const dataY = pad + laneH + gap, dataH = h - dataY - pad;
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.strokeRect(plot.x + 0.5, pad + 0.5, plot.w - 1, laneH - 1);
      ctx.strokeStyle = c.accent; ctx.lineWidth = w > 420 ? 1.1 : 0.8; ctx.beginPath();
      run.pheads.forEach((ph, t) => { const X = plot.x + (t / (T - 1)) * plot.w, Y = pad + 3 + (clamp(ph, 0, run.programLength) / run.programLength) * (laneH - 6); t ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
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
          const v = clamp(run.rows[t][j] / 2.5, -1, 1), col = mix(bg, v < 0 ? neg : pos, Math.abs(v) ** 0.8), k = (j * T + t) * 4;
          d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
        }
      });
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      drawCrisp(ctx, off, lab, 0, plotW, h);
      ctx.strokeStyle = c.page; ctx.lineWidth = 1.5;
      for (let m = 1; m < T / run.T; m++) { const x = lab + Math.round((m * run.T / T) * plotW) + 0.5; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      if (lab) {
        run.ports.forEach((j) => text(ctx, "in", 6, ((j + 0.5) / L) * h + 3.5, c.ink3, "left", `10px ${MONO}`));
        text(ctx, "out", 4, ((run.out + 0.5) / L) * h + 3.5, c.green, "left", `10px ${MONO}`);
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
      data.forEach((series, i) => {
        ctx.strokeStyle = c.tasks[i]; ctx.lineWidth = 1.8; ctx.beginPath();
        series.forEach((t, n) => (n ? ctx.lineTo(X(xs[n]), Y(t)) : ctx.moveTo(X(xs[n]), Y(t)))); ctx.stroke();
      });
      ctx.font = `11px ${MONO}`;
      if (w > 620) {
        let lx = w - pl;
        keys.slice().reverse().forEach((k, n) => {
          const t = VZ.EM43[k].label, tw = ctx.measureText(t).width;
          lx -= tw; ctx.fillStyle = c.ink3; ctx.fillText(t, lx, 15);
          lx -= 13; ctx.fillStyle = c.tasks[keys.length - 1 - n]; ctx.fillRect(lx, 7, 9, 9); lx -= 16;
        });
      }
      ctx.fillStyle = c.ink3;
      ctx.fillText("steps until halt", pl, 15); ctx.fillText("input x →", w - pl - 66, h - 7); ctx.fillText("training range", X(0) + 4, h - 7);
    },

    // CEM2D fast field after food and after poison; ports outlined, phase cell circled.
    cem2d(cv, c) {
      const { ctx, w, h } = VZ.fit(cv), D = VZ.CEM2D, col = diverging(c), cm = cv.dataset.fields === "cm";
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const gap = 30, s = Math.min((w - gap - 24) / 16, (h - 72) / 8), ox0 = (w - 16 * s - gap) / 2, oy = Math.max(8, (h - 8 * s - 60) / 2);
      const panels = cm ? [["c · fast activation", D.c], ["m · slow memory", D.m]] : [["after food", D.food], ["after poison", D.poison]];
      panels.forEach(([name, F], k) => {
        const ox = ox0 + k * (8 * s + gap), vmax = cm ? Math.max(...F.flat().map(Math.abs)) : 3.6;
        for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { ctx.fillStyle = col(F[i][j], vmax); ctx.fillRect(ox + j * s + 0.5, oy + i * s + 0.5, s - 1, s - 1); }
        ctx.strokeStyle = c.ink2; ctx.lineWidth = 1; ctx.strokeRect(Math.round(ox) - 0.5, Math.round(oy) - 0.5, Math.round(8 * s) + 1, Math.round(8 * s) + 1);
        for (const [p, [i, j]] of Object.entries(D.ports)) {
          ctx.strokeStyle = p[0] === "I" ? c.ink : c.green; ctx.lineWidth = 1.5; ctx.strokeRect(ox + j * s + 2, oy + i * s + 2, s - 4, s - 4);
          if (s > 22) text(ctx, p, ox + j * s + s / 2, oy + i * s + s / 2 + 4, p[0] === "I" ? c.ink : c.green, "center", `${Math.round(s * 0.3)}px ${MONO}`);
        }
        if (!cm) {
          const [mi, mj] = D.memory;
          ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox + (mj + 0.5) * s, oy + (mi + 0.5) * s, s * 0.62, 0, 7); ctx.stroke();
        }
        text(ctx, name, ox, oy + 8 * s + 20, c.ink2);
        colorbar(ctx, c, col, ox, oy + 8 * s + 34, 8 * s, vmax);
      });
    },

    // LU-A program trace: one row per executed op; 1 dark, 0 light, blank empty; data head in red.
    lua(cv, c) {
      const x = cv.dataset.x || "1011", run = VZ.luaRun(cv.dataset.prog || "(>]x>]<<(0<)1", x), R = run.rows;
      let lo = 0, hi = x.length - 1;
      for (const r of R) { lo = Math.min(lo, r.h, ...r.tape.keys()); hi = Math.max(hi, r.h, ...r.tape.keys()); }
      const ncol = hi - lo + 1, top = 34, bot = 34;
      const cs = Math.min(22, (cv.clientWidth - 150) / ncol, 600 / R.length);
      cv.style.height = `${Math.ceil(top + bot + R.length * cs)}px`;
      const { ctx, w } = VZ.fit(cv), ox = Math.max(44, (w - ncol * cs) / 2);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, cv.clientHeight);
      const bg = toRGB(c.bg), ink = toRGB(c.ink);
      R.forEach((r, t) => {
        const y = top + t * cs;
        if (r.op) text(ctx, r.op, ox - 22, y + cs * 0.72, c.ink3, "center", `${Math.round(cs * 0.6)}px ${MONO}`);
        for (let i = lo; i <= hi; i++) {
          const v = r.tape.get(i) || "B", px = ox + (i - lo) * cs;
          ctx.fillStyle = v === "1" ? c.ink : v === "0" ? rgb(mix(bg, ink, 0.25)) : rgb(mix(bg, ink, 0.05));
          ctx.fillRect(px + 1, y + 1, cs - 2, cs - 2);
        }
        ctx.strokeStyle = c.red; ctx.lineWidth = 2; ctx.strokeRect(ox + (r.h - lo) * cs + 1.5, y + 1.5, cs - 3, cs - 3);
      });
      text(ctx, "op", ox - 22, top - 12, c.ink3, "center");
      text(ctx, `x = ${x}`, ox, top - 12, c.red, "left", MATH);
      text(ctx, `y = ${run.y}  ·  ${R.length - 1} ops executed`, ox, top + R.length * cs + 22, c.red, "left", MATH);
    },

    // NCPU-EM-1D: the input/output channel over time for two tasks (weights loaded on demand).
    ncpu(cv, c) {
      if (!window.NCPU_MODEL) { loadNcpu(cv); return; }
      const T = 12, steps = 120, show = Number(cv.dataset.show || 40);
      if (!cv._runs) cv._runs = cv.dataset.runs.split(";").map((r) => { const [task, x, name] = r.split(":"); return { x, name, ...VZ.ncpuRun(task, x, T, steps) }; });
      const runs = cv._runs, { ctx, w, h } = VZ.fit(cv), col = diverging(c);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const top = 50, gapX = 40, cut = 26, bot = 34, lm = 64;
      const cw = Math.min((w - lm - 20 - gapX * (runs.length - 1)) / (T * runs.length), 26), pw = cw * T;
      const rh = (h - top - bot - cut - 8) / (show + 1 + 3), ox0 = lm + (w - lm - runs.length * pw - (runs.length - 1) * gapX) / 2;
      const yEnd = top + (show + 1) * rh + cut;
      const row = (vals, ox, y, hh) => vals.forEach((v, i) => { ctx.fillStyle = col(v, 1.1); ctx.fillRect(ox + i * cw + 0.5, y, cw - 1, hh + 0.4); });
      runs.forEach((r, k) => {
        const ox = ox0 + k * (pw + gapX);
        const lw = Math.min(pw + gapX - 8, w - ox - 4);
        text(ctx, r.name, ox, 16, c.ink2, "left", `11px ${MONO}`, lw);
        text(ctx, `x = ${r.x}`, ox, 36, c.red, "left", MATH, lw);
        for (let t = 0; t <= show; t++) row(r.rows[t], ox, top + t * rh, rh);
        text(ctx, "⋮", ox + pw / 2, top + (show + 1) * rh + cut * 0.7, c.ink3, "center", `14px ${MONO}`);
        row(r.rows[steps], ox, yEnd, 3 * rh);
        ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.strokeRect(ox - 0.5, yEnd - 0.5, pw + 1, 3 * rh + 1);
        text(ctx, `y = ${r.y}`, ox, yEnd + 3 * rh + 22, c.red, "left", MATH, lw);
      });
      arrow(ctx, ox0 - 14, top, ox0 - 14, top + (show + 1) * rh, c.ink3, 1.2);
      text(ctx, "t", ox0 - 22, top + (show + 1) * rh / 2, c.ink3, "right", MATH);
      text(ctx, `t = ${steps}`, ox0 - 6, yEnd + 2 * rh, c.ink3, "right");
    },

    // Locality bound: an output bit of an n-bit product depends on every input bit, so on a 1D array with
    // radius-r rules it cannot be correct before its backward light cone covers all input cells.
    locality(cv, c) {
      const n = Number(cv.dataset.n || 12), L = 2 * n, o = n - 1, tmin = Math.max(o, L - 1 - o);
      const { ctx, w, h } = VZ.fit(cv);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const lm = 96, rm = 24, top = 48, bot = 40, cs = Math.min((w - lm - rm) / L, (h - top - bot) / (tmin + 2));
      const ox = lm + (w - lm - rm - L * cs) / 2, X = (j) => ox + j * cs, Y = (t) => top + t * cs;
      for (let t = 0; t <= tmin + 1; t++) for (let j = 0; j < L; j++) { ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.strokeRect(X(j) + 0.5, Y(t) + 0.5, cs - 1, cs - 1); }
      // backward light cone of the output cell at t = tmin
      ctx.fillStyle = c.accent; ctx.globalAlpha = 0.14; ctx.beginPath();
      ctx.moveTo(X(o) + cs / 2, Y(tmin) + cs); ctx.lineTo(X(o - tmin), Y(0)); ctx.lineTo(X(o + tmin + 1), Y(0)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath();
      ctx.moveTo(X(o - tmin), Y(0)); ctx.lineTo(X(o) + cs / 2, Y(tmin) + cs); ctx.lineTo(X(o + tmin + 1), Y(0)); ctx.stroke(); ctx.setLineDash([]);
      for (let j = 0; j < L; j++) { ctx.fillStyle = j < n ? c.red : c.blue; ctx.fillRect(X(j) + 2, Y(0) + 2, cs - 4, cs - 4); }
      ctx.fillStyle = c.ink; ctx.fillRect(X(o) + 2, Y(tmin) + 2, cs - 4, cs - 4);
      text(ctx, "a (n bits)", X(0), top - 10, c.red);
      text(ctx, "b (n bits)", X(n), top - 10, c.blue);
      text(ctx, "t = 0", ox - 12, Y(0) + cs * 0.7, c.ink3, "right");
      text(ctx, `t = ${tmin}`, ox - 12, Y(tmin) + cs * 0.7, c.ink3, "right");
      arrow(ctx, ox - 70, Y(0) + cs / 2, ox - 70, Y(tmin) + cs / 2, c.ink3, 1.2);
      label(ctx, `bit ${n - 1} of a·b, earliest step ${tmin} = n`, X(o) + cs + 8, Y(tmin) + cs / 2, c);
      text(ctx, "cells →", w - rm, h - 14, c.ink3, "right");
    },
  };

  let ncpuLoading = null;
  function loadNcpu(cv) {
    const { ctx, w, h } = VZ.fit(cv), c = palette(cv);
    ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
    if (ncpuLoading) return;
    ncpuLoading = document.createElement("script");
    ncpuLoading.src = cv.dataset.model;
    ncpuLoading.onload = redrawAll;
    document.head.appendChild(ncpuLoading);
  }

  // ---------- animated figures: fn(canvas, colours, t seconds since visible) -> phase or nothing ----------
  const ANIM = {
    // Encode, iterate, halt, decode on EM43 (2x, x = 9). Returns the current phase 1..4 for the step list.
    loop(cv, c, t) {
      const run = cv._run || (cv._run = VZ.em43Run(cv.dataset.task || "x2", Number(cv.dataset.x || 9)));
      const R = run.steps + 1, tIn = 1.4, tRun = 4.6, tHold = 3.6, cyc = tIn + 0.8 + tRun + tHold, u = t % cyc;
      const { ctx, w, h } = VZ.fit(cv);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const lm = w < 500 ? 28 : 46, rm = w < 500 ? 58 : 78, top = 52, bot = 52;
      const cell = Math.min((w - lm - rm) / run.cols, (h - top - bot) / R), ox = lm + (w - lm - rm - run.cols * cell) / 2;
      const cx = (j) => ox + j * cell, xOrg = cx(run.x0), xIn = cx(run.x0 + run.x) + cell / 2;
      const rows = u < tIn + 0.8 ? 0 : Math.min(R - 1, Math.floor(((u - tIn - 0.8) / tRun) * R));
      // row 0: the program, then the input cell dropping in
      const sub = { ...run, rows: [run.rows[0].map((v, j) => (j === run.x0 + run.x && u < tIn ? 0 : v))] };
      drawEM43(ctx, sub, { x: ox, y: top, w: run.cols * cell, h: cell }, c, 0, 0);
      if (rows > 0) drawEM43(ctx, run, { x: ox, y: top, w: run.cols * cell, h: (rows + 1) * cell }, c, 0, rows);
      if (u < tIn) {
        const k = ease((u - 0.5) / 0.8), y = top - 30 + k * 30;
        if (u > 0.5) { ctx.fillStyle = c.red; ctx.fillRect(xIn - cell / 2, y, cell - 1, cell - 1); }
      }
      text(ctx, "s₀", ox - 10, top + cell * 0.8, c.ink, "right", MATH);
      arrow(ctx, xOrg, top - 22, xIn, top - 22, c.red);
      text(ctx, `x = ${run.x}`, (xOrg + xIn) / 2, top - 30, c.red, "center", MATH);
      if (u < tIn + 0.8) { ctx.strokeStyle = c.red; ctx.lineWidth = 1.5; ctx.strokeRect(ox - 3, top - 3, run.cols * cell + 6, cell + 6); }
      if (rows > 0) {
        const ax = ox + run.cols * cell + 18, yb = top + (rows + 0.5) * cell;
        arrow(ctx, ax, top + cell / 2, ax, Math.max(yb, top + cell * 1.5), c.ink3, 1.2);
        text(ctx, rows >= R - 1 ? `T = ${run.steps}` : `f ×${rows}`, ax + 8, Math.max(yb, top + cell * 1.5), c.ink2, "left", MATH);
      }
      let phase = u < tIn + 0.8 ? 1 : rows < R - 1 ? 2 : 3;
      if (rows >= R - 1) {
        const yk = top + (R - 1) * cell, xo = cx(run.x0 + run.y) + cell / 2;
        ctx.strokeStyle = c.blue; ctx.lineWidth = 1.5; ctx.strokeRect(ox - 3, yk - 3, run.cols * cell + 6, cell + 6);
        if (u > tIn + 0.8 + tRun + 0.9) {
          phase = 4;
          arrow(ctx, xOrg, yk + cell + 22, xo, yk + cell + 22, c.red);
          text(ctx, `y = ${run.y}`, (xOrg + xo) / 2, yk + cell + 42, c.red, "center", MATH);
        }
        text(ctx, "s", ox - 14, yk + cell * 0.8, c.ink, "right", MATH);
        text(ctx, "T", ox - 8, yk + cell * 0.8 + 4, c.ink, "right", "italic 400 11px 'Newsreader', Georgia, serif");
      }
      return phase;
    },

    // sin x: a fixed-depth network (red) against a looped model (blue): the same network after x <- x - 2 pi until x < 2 pi.
    sine(cv, c, t) {
      const TAU = 2 * Math.PI, XTR = 2 * TAU, XMAX = 6 * TAU, N = 600;
      if (!cv._data) {
        const X = Array.from({ length: N + 1 }, (_, i) => (i / N) * XMAX);
        cv._data = { X, Y: X.map(VZ.sineNet), Yi: X.map((x) => VZ.sineNet(x - TAU * Math.floor(x / TAU))) };
      }
      const { X, Y, Yi } = cv._data, { ctx, w, h } = VZ.fit(cv);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const L = 34, R = w - 22, T = 28, B = h - 30, y0 = -1.6, y1 = 4.6;
      const px = (x) => L + (x / XMAX) * (R - L), py = (y) => B - ((clamp(y, y0, y1) - y0) / (y1 - y0)) * (B - T);
      ctx.fillStyle = c.page; ctx.globalAlpha = 0.7; ctx.fillRect(px(0), T, px(XTR) - px(0), B - T); ctx.globalAlpha = 1;
      text(ctx, "training range", px(0) + 6, T + 14, c.ink3);
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L, py(0)); ctx.lineTo(R, py(0)); ctx.stroke();
      ["0", "2π", "4π", "6π", "8π", "10π", "12π"].forEach((s, k) => { if (k % 2 === 0 || (R - L) / 6 >= 40) text(ctx, s, px(k * TAU), B + 20, c.ink3, "center", MATH); });
      [-1, 1].forEach((v) => text(ctx, v < 0 ? "−1" : "1", L - 8, py(v) + 4, c.ink3, "right"));
      ctx.strokeStyle = c.ink3; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); ctx.beginPath();
      X.forEach((x, i) => (i ? ctx.lineTo(px(x), py(Math.sin(x))) : ctx.moveTo(px(x), py(Math.sin(x))))); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.ink2;
      for (let x = 0.2; x < XTR; x += XTR / 36) { ctx.beginPath(); ctx.arc(px(x), py(Math.sin(x)), 2.2, 0, 7); ctx.fill(); }
      const curve = (V, n, color) => { ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.beginPath(); for (let i = 0; i <= n; i++) i ? ctx.lineTo(px(X[i]), py(V[i])) : ctx.moveTo(px(X[i]), py(V[i])); ctx.stroke(); };
      curve(Y, Math.floor(ease((t - 0.3) / 2.4) * N), c.red);
      curve(Yi, Math.floor(ease((t - 3.0) / 2.4) * N), c.blue);
      if (t > 3) text(ctx, "looped model", px(8.6 * Math.PI), py(-1.32), c.blue, "left");
      if (t > 0.8) text(ctx, "fixed-depth network", px(6.3 * Math.PI), py(3.6), c.red, "left");
    },

    // GoL-EM x + 2: one board per input, run to its fixed point; cycles through three inputs.
    gol(cv, c, t) {
      const xs = (cv.dataset.xs || "2,5,9").split(",").map(Number);
      if (!cv._runs) cv._runs = xs.map(VZ.golRun);
      const fps = 24, h0 = 1.2, h1 = 2.6, lens = cv._runs.map((r) => h0 + r.steps / fps + h1), cyc = lens.reduce((a, b) => a + b, 0);
      let u = t % cyc, k = 0; while (u > lens[k]) { u -= lens[k]; k++; }
      const run = cv._runs[k], f = u < h0 ? 0 : Math.min(run.steps, Math.floor((u - h0) * fps)), a = run.frames[f], D = VZ.GOL, N = run.N;
      const { ctx, w, h } = VZ.fit(cv);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const s = Math.min((w - 20) / N, (h - 64) / N), B = N * s, ox = (w - B) / 2, oy = 10;
      ctx.fillStyle = c.page; ctx.fillRect(ox, oy, D.Lp * s, D.Lp * s);
      ctx.strokeStyle = c.ink3; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, D.Lp * s - 1, D.Lp * s - 1);
      ctx.strokeStyle = c.grid;
      for (let q = D.j0; q <= N; q += D.stride) {
        ctx.beginPath(); ctx.moveTo(ox + q * s, oy + D.j0 * s); ctx.lineTo(ox + q * s, oy + B); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox + D.j0 * s, oy + q * s); ctx.lineTo(ox + B, oy + q * s); ctx.stroke();
      }
      ctx.strokeStyle = c.rule; ctx.strokeRect(ox + 0.5, oy + 0.5, B - 1, B - 1);
      const inBlk = (p, q, i, j) => i >= p && i <= p + 1 && j >= q && j <= q + 1;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (a[i * N + j]) {
        const hot = (f === 0 && inBlk(run.b, run.b, i, j)) || (f === run.steps && run.blk && inBlk(run.blk[0], run.blk[1], i, j));
        ctx.fillStyle = hot ? c.red : c.ink; ctx.fillRect(ox + j * s + 0.5, oy + i * s + 0.5, s - 1, s - 1);
      }
      const ay = oy + B + 8, X = (q) => ox + (D.j0 + D.stride * q + 1) * s;
      for (let q = 0; D.j0 + D.stride * q + 1 < N; q += 5) {
        ctx.strokeStyle = c.ink3; ctx.beginPath(); ctx.moveTo(X(q), ay); ctx.lineTo(X(q), ay + 5); ctx.stroke();
        text(ctx, String(q), X(q), ay + 17, c.ink3, "center");
      }
      text(ctx, "program", ox + 3, oy + D.Lp * s + 12, c.ink3);
      const mark = (q, lab) => text(ctx, lab, X(q), ay + 38, c.red, "center", MATH);
      if (f === 0) mark(run.x, `x = ${run.x}`);
      if (f === run.steps && run.blk) mark(run.y, `y = ${run.y}`);
      text(ctx, `t = ${f}`, ox + B, ay + 38, c.ink3, "right");
    },

    // CEM1D: two impulse pairs under the learned rule; one travels left, the other right.
    pulse(cv, c, t) {
      if (!cv._runs) cv._runs = [[3, -3, "+ −", "moves left"], [3, 3, "+ +", "moves right"]].map(([a, b, pair, dir]) => ({ pair, dir, ...VZ.cem1dPulse([a, b]) }));
      const steps = 18, rev = 3.2, u = t % (rev + 2.8), rows = Math.min(steps + 1, Math.floor((u / rev) * (steps + 1)) + 1);
      const { ctx, w, h } = VZ.fit(cv), col = diverging(c);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const lm = 26, gap = 28, pw = (w - lm - gap - 10) / 2, L = 19, s = Math.min(pw / L, (h - 96) / (steps + 1));
      cv._runs.forEach((r, p) => {
        const ox = lm + p * (pw + gap) + (pw - L * s) / 2, oy = 6;
        for (let k = 0; k < rows; k++) for (let j = 0; j < L; j++) { ctx.fillStyle = col(r.rows[k][j], 3); ctx.fillRect(ox + j * s + 0.5, oy + k * s + 0.5, s - 1, s - 1); }
        ctx.strokeStyle = c.rule; ctx.lineWidth = 1; ctx.strokeRect(ox - 0.5, oy - 0.5, L * s + 1, (steps + 1) * s + 1);
        ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.strokeRect(ox + 8 * s + 1, oy + 1, 2 * s - 2, s - 2);
        text(ctx, r.pair, ox + (L * s) / 2, oy + (steps + 1) * s + 19, c.ink2, "center");
        text(ctx, r.dir, ox + (L * s) / 2, oy + (steps + 1) * s + 34, c.ink2, "center");
      });
      arrow(ctx, 12, 8, 12, 6 + (steps + 1) * s, c.ink3, 1.2);
      const bw = Math.min(220, w - lm - 10);
      colorbar(ctx, c, col, lm + (w - lm - 10 - bw) / 2, 6 + (steps + 1) * s + 52, bw, 3);
    },
  };

  function setupFigures() {
    const anim = [];
    document.querySelectorAll("canvas[data-viz]").forEach((cv) => {
      const name = cv.dataset.viz;
      if (FIGS[name]) { const draw = () => FIGS[name](cv, palette(cv)); draw(); redraws.push(draw); }
      else if (ANIM[name]) {
        const item = { cv, fn: ANIM[name], t0: performance.now(), on: false, steps: cv.closest("[data-phases]") };
        item.draw = (t) => {
          const phase = item.fn(cv, palette(cv), t);
          if (item.steps && phase) item.steps.querySelectorAll("[data-phase]").forEach((el) => el.classList.toggle("active", Number(el.dataset.phase) === phase));
        };
        anim.push(item);
        redraws.push(() => item.draw(VZ.reduced() ? 1e4 : (performance.now() - item.t0) / 1000));
      }
    });
    if (!anim.length) return;
    if (VZ.reduced()) { anim.forEach((a) => a.draw(1e4)); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      const a = anim.find((x) => x.cv === e.target);
      if (e.isIntersecting && !a.on) a.t0 = performance.now();
      a.on = e.isIntersecting;
    }), { threshold: 0.15 });
    anim.forEach((a) => { a.draw(0); io.observe(a.cv); });
    const frame = (now) => { anim.forEach((a) => a.on && a.draw((now - a.t0) / 1000)); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }

  // ---------- hero player ----------
  function setupHero() {
    const hero = document.querySelector("[data-ca]"); if (!hero) return;
    const cv = hero.querySelector("[data-ca-canvas]");
    const q = (s) => hero.querySelector(s);
    const sel = q("[data-ca-task]"), inp = q("[data-ca-x]"), playBtn = q("[data-ca-play]");
    const speedIn = q("[data-ca-speed]"), out = q("[data-ca-readout]");
    const playlist = [["x2", 48], ["mod4", 75], ["rounddiv3", 70], ["mod2c", 31], ["plus1", 60]];
    const HOLD = 3.5;   // seconds the finished run stays on screen before the next one
    let pi = 0, run, k = 0, playing = !VZ.reduced(), auto = true, held = 0, acc = 0, last = 0;

    const setPlayIcon = () => {
      playBtn.innerHTML = playing
        ? '<svg viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z" fill="currentColor"/></svg>';
      playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    };

    function load(key, x) {
      run = VZ.em43Run(key, clamp(x, 0, 150)); k = 0; held = 0;
      sel.value = key; inp.value = String(run.x);
    }

    function readout() {
      const task = VZ.EM43[run.key], done = k >= run.steps;
      const range = run.x > 30 ? "outside the training range (x ≤ 30)" : "inside the training range";
      out.innerHTML = `<span class="readout-line">step <b>${k}</b> / ${run.steps}</span> · ` +
        (done ? `output <b>${run.y}</b> <span class="${run.ok ? "ok" : "bad"}">${run.ok ? "✓" : "✗"}</span> (${task.label} = ${task.f(run.x)})` : "running…") +
        ` · ${range}`;
    }

    function draw() {
      const { ctx, w, h } = VZ.fit(cv), c = palette(hero);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, w, h);
      const pad = 14, top = 34, bottom = 34, area = w - 2 * pad, availH = h - top - bottom;
      const cell = Math.min(area / run.cols, 9), N = Math.max(1, Math.floor(availH / cell));
      const from = Math.max(0, k - N + 1);
      const { ox } = drawEM43(ctx, run, { x: pad, y: top, w: area, h: (k - from + 1) * cell }, c, from, k);
      if (from > 0) {   // fade the oldest rows while scrolling
        const g = ctx.createLinearGradient(0, top, 0, top + 50), bg = toRGB(c.bg);
        g.addColorStop(0, rgb(bg)); g.addColorStop(1, `rgba(${bg.join(",")},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, top - 1, w, 51);
      }
      const fy = top + (k - from) * cell;
      ctx.fillStyle = c.brand; ctx.globalAlpha = 0.14; ctx.fillRect(pad, fy - 1, area, cell + 2); ctx.globalAlpha = 1;
      if (from === 0) {
        label(ctx, "origin", ox + run.x0 * cell - 6, top - 14, c, "right");
        label(ctx, `input x = ${run.x}`, ox + (run.x0 + run.x) * cell - 6, top - 14, c);
      }
      if (k >= run.steps && run.y != null) label(ctx, `output y = ${run.y}`, ox + (run.x0 + run.y) * cell + cell + 6, fy + cell + 14, c);
      readout();
    }

    function tick(t) {
      const dt = Math.min(100, t - (last || t)); last = t;
      if (playing) {
        let changed = false;
        if (k < run.steps) {
          acc += (dt * Number(speedIn.value)) / 1000;
          while (acc >= 1 && k < run.steps) { acc -= 1; k++; changed = true; }
        } else if (auto) {
          held += dt / 1000;
          if (held > HOLD) { pi = (pi + 1) % playlist.length; load(...playlist[pi]); acc = 0; changed = true; }
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
    q("[data-ca-restart]").addEventListener("click", () => { k = 0; held = 0; draw(); });
    q("[data-ca-random]").addEventListener("click", () => { userTakes(); load(sel.value, 31 + Math.floor(Math.random() * 90)); playing = true; setPlayIcon(); draw(); });
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
    const compute = () => { run = VZ.em43Run(sel.value, clamp(Math.round(Number(inp.value) || 0), 0, 150)); inp.value = String(run.x); };
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
    if (document.fonts) document.fonts.ready.then(redrawAll);
  });
})();
