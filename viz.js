// Model engine for the site's figures. Every picture is computed from a real model:
//   EM43 (learned rules from arXiv:2608.14019), LUTM-6 (verified program from lu-sim),
//   CEM1D (learned update equation reported in the paper), elementary cellular automata.
(function () {
  const VZ = {};

  // ---------------- EM43 ----------------
  VZ.EM43 = {
    plus1:     { label: "x + 1",           f: (x) => x + 1,             prog: "0000000010", rule: "0000230222312131332223013023013301030321322320102022032031220002" },
    x2:        { label: "2x",              f: (x) => 2 * x,             prog: "0000000100", rule: "0300133120330233123211223003320001111130110302020022323132301231" },
    mod4:      { label: "x mod 4",         f: (x) => x % 4,             prog: "0000002010", rule: "0103032122003020112013030103210203123000200231300000001210323002" },
    rounddiv3: { label: "round(x/3)",      f: (x) => Math.floor(x / 3 + 0.5), prog: "0000000001", rule: "0300222221013333103211231030232103303131021330310010112332303231" },
    mod2c:     { label: "x·(1 + x mod 2)", f: (x) => x * (1 + (x % 2)), prog: "0000000100", rule: "0301001320230020131113332323030202203032320321013031013023332213" },
  };

  VZ.em43Rule = (task) => {
    const r = Uint8Array.from(task.rule, Number);
    r[0] = 0; r[2] = 0; r[8] = 2; r[32] = 0;
    return r;
  };

  VZ.em43Run = (key, x, maxSteps = 4000) => {
    const task = VZ.EM43[key], rule = VZ.em43Rule(task);
    const prog = Uint8Array.from(task.prog, Number), x0 = prog.length + 4;
    let tape = new Uint8Array(x0 + x + 21);
    tape.set(prog); tape[x0 + x] = 2;
    const rows = [tape];
    const halted = (t) => { let l = 0, c = 0; for (const v of t) if (v) { l++; if (v === 3) c++; } return l > 0 && 2 * c >= l; };
    while (!halted(tape) && rows.length <= maxSteps) {
      let last = tape.length - 1; while (last >= 0 && !tape[last]) last--;
      if (tape.length - 1 - last <= 3) { const t2 = new Uint8Array(tape.length + 20); t2.set(tape); tape = t2; }
      const n = tape.length, nx = new Uint8Array(n);
      for (let i = 0; i < n; i++) nx[i] = rule[(i ? tape[i - 1] : 0) * 16 + tape[i] * 4 + (i < n - 1 ? tape[i + 1] : 0)];
      tape = nx; rows.push(tape);
    }
    let y = null;
    for (let i = tape.length - 1; i >= x0; i--) if (tape[i] === 2) { y = i - x0; break; }
    let cols = x0 + x + 3;
    for (const r of rows) for (let i = r.length - 1; i >= 0; i--) if (r[i]) { cols = Math.max(cols, i + 3); break; }
    return { key, x, rows, x0, y, cols, steps: rows.length - 1, ok: y === task.f(x) };
  };

  // ---------------- LUTM-6 (port of lu-sim/js/lutm6.js) ----------------
  const [B, Z, O, X] = [0, 1, 2, 3];
  const bit = (c) => c === Z || c === O;
  const ST = { D: 0, S: 1, W: 2, M: 3, K: 4, C: 5, R: 6, J: 7, U: 8 }, H = 9;
  function tr(s, p, d) {
    switch (s) {
      case ST.D: if (d === O || d === X) return [d, 0, 0, ST.S]; if (bit(p)) return [p === Z ? B : O, 1, 0, ST.M]; return [d, 0, 0, H];
      case ST.S: if (p === X) return [d, 1, 0, ST.W]; if (p === B) return [d, 0, 0, H]; return [d, 1, 0, ST.S];
      case ST.W: if (bit(p)) return [p === Z ? B : O, 1, 0, ST.M]; return [d, 0, 0, H];
      case ST.M: if (bit(p)) return [d, 1, p === Z ? -1 : 1, ST.K]; return [d, 0, 0, H];
      case ST.K: return [d === O || d === X ? X : Z, 0, 0, ST.C];
      case ST.C: if (bit(p)) return [d, 1, 1, ST.C]; return [d, -1, 0, ST.R];
      case ST.R: if (p === B) return [d, 1, 0, ST.J]; return [d, -1, 0, ST.R];
      case ST.J: if (d === Z || d === X) return [d === Z ? B : O, 0, 0, ST.D]; return [d, 0, -1, ST.U];
      case ST.U: if (p === X) return [d, 1, 0, ST.J]; if (p === B) return [d, 0, 0, H]; return [d, 1, 0, ST.U];
    }
  }
  const TABLE = [];
  for (let s = 0; s < 9; s++) for (let p = 0; p < 4; p++) for (let d = 0; d < 4; d++) TABLE.push(tr(s, p, d));
  const CODE = { B: 0, "0": 1, "1": 2, "#": 3 };

  VZ.LUTM6 = {
    parityEvolved: "0111011#11011#000#01#0000#1#1100",
  };

  // Runs a program and returns one row per step: the data tape window and both heads.
  VZ.lutm6Run = (program, input, maxSteps = 200000) => {
    const prog = Uint8Array.from(program, (c) => CODE[c]);
    const N = 4096, off = 2048, tape = new Uint8Array(N);
    const enc = [...input].map((b) => (b === "0" ? "1B" : "11")).join("") + "B1";
    [...enc].forEach((c, i) => { tape[off + i] = CODE[c]; });
    let hp = 0, hd = 0, s = ST.D, T = 0, lo = 0, hi = enc.length;
    const writes = [];   // [hd, value, hp, state] per step
    while (s !== H && T < maxSteps) {
      const p = hp >= 0 && hp < prog.length ? prog[hp] : B;
      const d = tape[off + hd];
      const [w, dp, dd, q] = TABLE[(s * 4 + p) * 4 + d];
      tape[off + hd] = w; writes.push([hd, w, hp, s]);
      hp += dp; hd += dd; s = q; T++;
      lo = Math.min(lo, hd); hi = Math.max(hi, hd + 1);
    }
    let out = "", h = hd;
    while (tape[off + h] === O) { const v = tape[off + h + 1]; if (v !== B && v !== O) break; out += v === B ? "0" : "1"; h += 2; }
    // Rebuild per-step snapshots over [lo, hi).
    const width = hi - lo + 2, cur = new Uint8Array(width), base = lo - 1;
    [...enc].forEach((c, i) => { cur[i - base] = CODE[c]; });
    const rows = [], heads = [], pheads = [];
    for (const [pos, w, ph] of writes) {
      rows.push(cur.slice()); heads.push(pos - base); pheads.push(ph);
      cur[pos - base] = w;
    }
    rows.push(cur.slice()); heads.push(hd - base); pheads.push(hp);
    return { rows, heads, pheads, width, steps: T, halted: s === H, output: out, programLength: program.length };
  };

  // ---------------- CEM1D (learned rule from the paper) ----------------
  // s_j <- s_j + 0.1 (0.796 s_{j-1} - 0.319 s_j - 1.628 s_{j+1} - 0.03 s_j^3), reflecting boundaries.
  VZ.cem1d = (macrosteps = 8, seed = 7) => {
    const L = 19, T = 30, ports = [3, 6, 12, 15];
    let s = new Float32Array(L), r = seed;
    const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
    const rows = [];
    for (let m = 0; m < macrosteps; m++) {
      ports.forEach((j) => { s[j] = rnd() * 1.5; });
      for (let t = 0; t < T; t++) {
        rows.push(s.slice());
        const n = new Float32Array(L);
        for (let j = 0; j < L; j++) {
          const l = s[j > 0 ? j - 1 : 1], c = s[j], rr = s[j < L - 1 ? j + 1 : L - 2];
          n[j] = c + 0.1 * (0.796 * l - 0.319 * c - 1.628 * rr - 0.03 * c * c * c);
        }
        s = n;
      }
    }
    return { rows, L, T, ports, out: 9 };
  };

  // ---------------- elementary CA ----------------
  VZ.eca = (rule, width, steps, init = "single") => {
    let row = new Uint8Array(width);
    if (init === "single") row[width >> 1] = 1; else for (let i = 0; i < width; i++) row[i] = Math.random() < 0.5 ? 1 : 0;
    const rows = [row];
    for (let t = 1; t < steps; t++) {
      const n = new Uint8Array(width);
      for (let i = 0; i < width; i++) n[i] = (rule >> ((row[(i - 1 + width) % width] << 2) | (row[i] << 1) | row[(i + 1) % width])) & 1;
      rows.push(n); row = n;
    }
    return rows;
  };

  // ---------------- drawing helpers ----------------
  VZ.css = (name, el = document.documentElement) => getComputedStyle(el).getPropertyValue(name).trim();

  VZ.fit = (canvas) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  };


  VZ.reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  window.VZ = VZ;
})();
