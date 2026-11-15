/*
 * FitAdım – paylaşım videoları ve kartları.
 * Her şey kullanıcının cihazında çizilir ve kaydedilir; hiçbir sunucuya gönderilmez.
 *
 * Dart tarafı: window.fitadimMedia.open(kind, jsonString)
 *   kind: 'milestone' | 'badge' (video), 'musclemap' | 'badgecard' | 'streakcard' (resim)
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ yardımcılar
  const FONT = '"Inter", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const font = (w, s) => `${w} ${s}px ${FONT}`;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const easeOut = (x) => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
  const backOut = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const fmt1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.', ',');

  function hexRgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
  function mix(h1, h2, t) {
    const a = hexRgb(h1), b = hexRgb(h2);
    return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function text(ctx, s, x, y, f, color, align = 'left', base = 'middle') {
    ctx.font = f; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
    ctx.fillText(s, x, y);
  }

  const THEMES = {
    koyu: { bg: '#000000', card: '#121212', border: '#262626', text: '#F5F5F5', muted: '#A3A3A3', accent: '#C8F135', accentText: '#000000', base: '#1E1E1E', track: '#262626', chip: '#232323', soft: '#22300C', fig: '#444444', figFar: '#2B2B2B' },
    acik: { bg: '#FFFFFF', card: '#F4F4F6', border: '#E4E4E9', text: '#18181B', muted: '#62626B', accent: '#FF6A2B', accentText: '#1F1300', base: '#E2E2E6', track: '#E8E8EC', chip: '#EAEAEE', soft: '#FFE6DA', fig: '#BDBDC4', figFar: '#D9D9DE' },
  };

  // ------------------------------------------------------------------ ikonlar (24x24 çizgi)
  const ICONS = {
    star: 'M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.3 6.8 19l1-5.8L3.6 9.1l5.8-.8z',
    flame: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9z',
    dumbbell: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
    bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M9 20h6',
    leg: 'M9 3v7l-2 9h4l2-7 2 7h3l-3-10V3',
    core: 'M8 4h8v16H8zM8 9h8M8 14h8M12 4v16',
    scale: 'M4 7h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM12 11l2-2M9 4h6',
    target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
    drop: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  };
  const iconCache = {};
  function icon(ctx, key, cx, cy, size, color, lw = 2) {
    const d = ICONS[key] || ICONS.star;
    const p = iconCache[key] || (iconCache[key] = new Path2D(d));
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(p);
    ctx.restore();
  }

  // ------------------------------------------------------------------ rozet çizimi
  function drawBadge(ctx, b, cx, cy, size, opts = {}) {
    const x = cx - size / 2, y = cy - size / 2, r = size * 0.29;
    ctx.save();
    ctx.shadowColor = rgba(b.col, 0.75); ctx.shadowBlur = size * (opts.glow ?? 0.35);
    const g = ctx.createRadialGradient(x + size * 0.3, y + size * 0.25, 0, x + size * 0.3, y + size * 0.25, size * 1.0);
    g.addColorStop(0, b.hi); g.addColorStop(0.45, b.col); g.addColorStop(1, b.lo);
    ctx.fillStyle = g; rr(ctx, x, y, size, size, r); ctx.fill();
    ctx.shadowBlur = 0; ctx.fill();
    // üst parlaklık
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, size * 0.008);
    rr(ctx, x + 1, y + 1, size - 2, size - 2, r); ctx.stroke();
    // parıltı bandı
    if (opts.shine != null && opts.shine > 0 && opts.shine < 1) {
      rr(ctx, x, y, size, size, r); ctx.clip();
      const sx = x - size * 0.6 + opts.shine * size * 2.2;
      const sg = ctx.createLinearGradient(sx - size * 0.25, 0, sx + size * 0.25, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.55)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.moveTo(sx, y - 10); ctx.lineTo(sx + size * 0.18, y - 10); ctx.lineTo(sx - size * 0.1, y + size + 10); ctx.lineTo(sx - size * 0.28, y + size + 10); ctx.fill();
    }
    ctx.restore();
    if (opts.label) {
      text(ctx, opts.label, cx, cy - size * 0.06, font(900, size * 0.42), '#0B0B0B', 'center');
      text(ctx, opts.sub || '', cx, cy + size * 0.28, font(900, size * 0.13), '#0B0B0B', 'center');
    } else {
      icon(ctx, b.icon, cx, cy, size * 0.56, '#0B0B0B', 2.1);
    }
    if (opts.sparkle !== false) {
      const sp = [[0.78, -0.32, 0.045], [-0.62, -0.42, 0.028], [0.66, 0.08, 0.024], [-0.52, 0.62, 0.022]];
      ctx.save();
      for (const [dx, dy, s] of sp) {
        ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = size * 0.08;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(cx + dx * size * 0.62, cy + dy * size * 0.62, size * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ------------------------------------------------------------------ figür (960x620 mantıksal kutu)
  const GROUND = 560, LIMB = 40, TORSO = 56, HEAD = 36;
  function ik(a, c, l1, l2, bend) {
    const dx = c[0] - a[0], dy = c[1] - a[1];
    const dist = clamp(Math.hypot(dx, dy), 1e-3, l1 + l2 - 1e-3);
    const ang = Math.atan2(dy, dx);
    const A = Math.acos(clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1)) * bend;
    return [a[0] + l1 * Math.cos(ang + A), a[1] + l1 * Math.sin(ang + A)];
  }
  const pm = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  const off = (q, o) => [q[0] + o[0], q[1] + o[1]];
  const R = (d) => d * Math.PI / 180;

  function pose(kind, p) {
    let near = [], far = [], worked = [], head;
    if (kind === 0) { // squat
      const ankle = [470, GROUND];
      const a1 = R(lerp(4, 38, p)), a2 = R(lerp(4, 82, p)), a3 = R(lerp(6, 42, p));
      const knee = [ankle[0] + 150 * Math.sin(a1), ankle[1] - 150 * Math.cos(a1)];
      const hip = [knee[0] - 155 * Math.sin(a2), knee[1] - 155 * Math.cos(a2)];
      const sh = [hip[0] + 175 * Math.sin(a3), hip[1] - 175 * Math.cos(a3)];
      head = [sh[0] + 62 * Math.sin(a3), sh[1] - 62 * Math.cos(a3)];
      const b = R(lerp(10, 92, p));
      const hand = [sh[0] + 150 * Math.sin(b), sh[1] + 150 * Math.cos(b)];
      const elbow = [sh[0] + 76 * Math.sin(b - 0.08), sh[1] + 76 * Math.cos(b - 0.08)];
      const o = [-16, -6];
      far = [[off(ankle, o), off(knee, o)], [off(knee, o), off(hip, o)], [off(sh, o), off(elbow, o)], [off(elbow, o), off(hand, o)]];
      near = [[[ankle[0] + 58, GROUND], ankle, LIMB], [ankle, knee, LIMB], [knee, hip, LIMB], [hip, sh, TORSO], [sh, elbow, LIMB], [elbow, hand, LIMB]];
      worked = [['cap', hip, pm(hip, knee, 0.85), 38], ['dot', hip, 34]];
    } else if (kind === 1) { // şınav
      const feet = [170, GROUND], hand = [660, GROUND];
      const sh = [650, lerp(GROUND - 175, GROUND - 72, p)];
      const ang = Math.atan2(sh[1] - feet[1], sh[0] - feet[0]);
      const L = Math.hypot(sh[0] - feet[0], sh[1] - feet[1]);
      const hip = [feet[0] + 0.52 * L * Math.cos(ang), feet[1] + 0.52 * L * Math.sin(ang)];
      const knee = [feet[0] + 0.26 * L * Math.cos(ang), feet[1] + 0.26 * L * Math.sin(ang)];
      head = [sh[0] + 66 * Math.cos(ang), sh[1] + 66 * Math.sin(ang) - 10];
      const elbow = ik(sh, hand, 92, 92, -1);
      const o = [-10, -12];
      far = [[off(sh, o), off(elbow, o)], [off(elbow, o), off(hand, o)], [off(feet, o), off(knee, o)]];
      near = [[feet, knee, LIMB], [knee, hip, LIMB], [hip, sh, TORSO], [sh, elbow, LIMB], [elbow, hand, LIMB]];
      worked = [['cap', sh, pm(sh, hip, 0.3), 46], ['cap', sh, elbow, 36]];
    } else if (kind === 2) { // jumping jack
      const cx = 480, hip = [cx, 345], sh = [cx, 185];
      head = [cx, 118];
      for (const s of [-1, 1]) {
        const foot = [cx + s * lerp(40, 150, p), GROUND];
        const knee = [(hip[0] + foot[0]) / 2 + s * 6, (hip[1] + foot[1]) / 2];
        const th = R(lerp(18, 165, p));
        const hand = [sh[0] + s * 160 * Math.sin(th), sh[1] + 160 * Math.cos(th)];
        const elbow = [sh[0] + s * 80 * Math.sin(th), sh[1] + 80 * Math.cos(th)];
        near.push([hip, knee, LIMB], [knee, foot, LIMB], [sh, elbow, LIMB], [elbow, hand, LIMB]);
        worked.push(['cap', hip, pm(hip, knee, 0.9), 38], ['dot', [sh[0] + s * 22, sh[1] + 6], 30]);
      }
      near.unshift([hip, sh, TORSO]);
    } else { // mekik
      const hip = [410, GROUND - 16], foot = [660, GROUND];
      const knee = ik(hip, foot, 150, 150, -1);
      const phi = R(lerp(4, 46, p));
      const sh = [hip[0] - 180 * Math.cos(phi), hip[1] - 180 * Math.sin(phi)];
      head = [sh[0] - 60 * Math.cos(phi), sh[1] - 60 * Math.sin(phi)];
      const psi = R(lerp(10, 30, p));
      const hand = [sh[0] + 150 * Math.cos(psi), sh[1] - 150 * Math.sin(psi) + 40];
      const o = [14, -10];
      far = [[off(hip, o), off(knee, o)], [off(knee, o), off(foot, o)]];
      near = [[foot, knee, LIMB], [knee, hip, LIMB], [hip, sh, TORSO], [sh, hand, LIMB]];
      worked = [['cap', pm(hip, sh, 0.15), pm(hip, sh, 0.75), 46]];
    }
    return { near, far, head, worked };
  }

  function cap(ctx, a, b, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function dot(ctx, c, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, Math.PI * 2); ctx.fill(); }
  function body(ctx, P, nearCol, farCol) {
    for (const [a, b] of P.far) cap(ctx, a, b, LIMB, farCol);
    for (const [a, b, w] of P.near) cap(ctx, a, b, w, nearCol);
    dot(ctx, P.head, HEAD, nearCol);
  }

  /** Figürü (x,y) sol üst köşeli, genişliği w olan kutuya çizer. */
  function drawFigure(ctx, kind, pf, t, style, accent, th, x, y, w) {
    const s = w / 960;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    cap(ctx, [120, GROUND + 22], [840, GROUND + 22], 6, th.border);
    const p = pf(t);
    if (style === 'trail') {
      const ghosts = [[0.24, 0.14], [0.18, 0.24], [0.12, 0.38], [0.06, 0.56]];
      const ga = ctx.globalAlpha;
      ctx.save();
      for (const [dt, a] of ghosts) {
        ctx.globalAlpha = ga * a;
        body(ctx, pose(kind, pf(Math.max(0, t - dt))), accent, accent);
      }
      ctx.restore();
      ctx.shadowColor = rgba(accent, 0.8); ctx.shadowBlur = 30;
      body(ctx, pose(kind, p), accent, mix(accent, th.bg, 0.45));
      ctx.shadowBlur = 0;
    } else {
      const P = pose(kind, p);
      body(ctx, P, th.fig, th.figFar);
      ctx.save();
      ctx.globalAlpha *= 0.65 + 0.35 * p;
      ctx.shadowColor = accent; ctx.shadowBlur = 20 + 30 * p;
      for (const wk of P.worked) {
        if (wk[0] === 'cap') cap(ctx, wk[1], wk[2], wk[3], accent);
        else dot(ctx, wk[1], wk[2], accent);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ ortak sahne parçaları
  function logo(ctx, th, x, y, name) {
    ctx.font = font(800, 30);
    const w = ctx.measureText(name).width;
    ctx.fillStyle = th.accent; rr(ctx, x, y, w + 44, 58, 29); ctx.fill();
    text(ctx, name, x + 22, y + 30, font(800, 30), th.accentText);
    return w + 44;
  }

  function glowText(ctx, s, x, y, size, color, alpha) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.shadowColor = color; ctx.shadowBlur = 50;
    text(ctx, s, x, y, font(900, size), color, 'center');
    ctx.shadowBlur = 20;
    text(ctx, s, x, y, font(900, size), color, 'center');
    ctx.restore();
  }

  // ------------------------------------------------------------------ KİLOMETRE TAŞI VİDEOSU
  function milestoneScene(d) {
    const th = THEMES[d.theme] || THEMES.koyu;
    const A = th.accent;
    const N = d.days;
    const DUR = 13.5, MAIN0 = 1.2, MAIN1 = 10.2, FIN = 10.0;
    const exs = (d.exercises && d.exercises.length ? d.exercises : [{ name: 'Antrenman', sets: '', muscles: [], kind: 0 }]).slice(0, 4);
    const W = d.weights || [];
    const hasW = W.length >= 2;
    const wFirst = hasW ? W[0].w : 0, wLast = hasW ? W[W.length - 1].w : 0;
    let wmin = Infinity, wmax = -Infinity;
    for (const e of W) { wmin = Math.min(wmin, e.w); wmax = Math.max(wmax, e.w); }
    wmin -= 0.5; wmax += 0.5;
    const done = new Set(d.doneDays || []);
    const weightAt = (day) => {
      if (!hasW) return 0;
      if (day <= W[0].d) return W[0].w;
      for (let i = 1; i < W.length; i++) {
        if (day <= W[i].d) return lerp(W[i - 1].w, W[i].w, (day - W[i - 1].d) / Math.max(1e-6, W[i].d - W[i - 1].d));
      }
      return W[W.length - 1].w;
    };
    const delta = wLast - wFirst;
    const absD = Math.abs(delta);
    const verb = absD < 0.05 ? 'kilomu korudum' : (delta < 0 ? 'kilo verdim' : 'kilo aldım');
    const sign = absD < 0.05 ? '' : (delta < 0 ? '−' : '+');

    function intro(ctx, t) {
      const a = easeOut(t / 0.6);
      const y = lerp(1000, 900, a);
      const l1 = `${N} GÜNLÜK`, l2 = 'İLERLEMEM';
      text(ctx, l1, 540, y, font(900, 130), mix(th.bg, th.text, ease(t / 0.5)), 'center');
      text(ctx, l2, 540, y + 150, font(900, 130), mix(th.bg, A, ease(t / 0.5 - 0.3)), 'center');
      text(ctx, d.dateRange || '', 540, y + 300, font(600, 40), mix(th.bg, th.muted, ease((t - 0.4) / 0.4)), 'center');
    }

    function main(ctx, t) {
      const lt = t - MAIN0;
      logo(ctx, th, 70, 80, d.appName || 'FitAdım');
      text(ctx, `${N} GÜNLÜK İLERLEME`, 1010, 110, font(700, 28), th.muted, 'right');
      const seg = (MAIN1 - MAIN0) / exs.length;
      const idx = Math.min(exs.length - 1, Math.floor(Math.max(0, lt) / seg));
      const st = clamp((lt - idx * seg) / seg);
      const ex = exs[idx];
      // hareket kartı
      ctx.fillStyle = th.card; rr(ctx, 60, 190, 960, 810, 44); ctx.fill();
      ctx.strokeStyle = th.border; ctx.lineWidth = 2; ctx.stroke();
      const tf = easeOut(st / 0.18);
      text(ctx, `HAREKET ${idx + 1}/${exs.length}`, 110, 250, font(700, 28), th.muted);
      text(ctx, ex.name, 110 - (1 - tf) * 30, 322, font(900, ex.name.length > 16 ? 60 : 80), mix(th.card, th.text, tf));
      text(ctx, ex.sets || '', 970, 322, font(800, 44), mix(th.card, A, tf), 'right');
      const pf = (x) => 0.5 - 0.5 * Math.cos(2 * Math.PI * 2 * clamp((x - idx * seg) / seg));
      drawFigure(ctx, ex.kind || 0, pf, Math.max(0, lt), d.style, A, th, 150, 372, 780);
      let x = 110;
      (ex.muscles || []).slice(0, 3).forEach((m, j) => {
        ctx.font = font(700, 30);
        const w = ctx.measureText(m).width + 48;
        if (x + w > 990) return;
        ctx.fillStyle = j === 0 ? A : th.chip; rr(ctx, x, 900, w, 60, 30); ctx.fill();
        text(ctx, m, x + w / 2, 931, font(700, 30), j === 0 ? th.accentText : th.text, 'center');
        x += w + 16;
      });
      // kilo / ilerleme kartı
      const dayf = 1 + (N - 1) * ease((lt - 0.2) / (MAIN1 - MAIN0 - 0.6));
      ctx.fillStyle = th.card; rr(ctx, 60, 1040, 960, 640, 44); ctx.fill();
      ctx.strokeStyle = th.border; ctx.lineWidth = 2; ctx.stroke();
      text(ctx, hasW ? 'KİLO' : 'ANTRENMAN', 110, 1095, font(700, 28), th.muted);
      text(ctx, `GÜN ${Math.round(dayf)} / ${N}`, 970, 1095, font(700, 28), th.muted, 'right');
      let cnt = 0;
      for (let k = 1; k <= Math.floor(dayf); k++) if (done.has(k)) cnt++;
      if (hasW) {
        const wn = weightAt(dayf);
        text(ctx, fmt1(wn), 110, 1262, font(900, 130), th.text, 'left', 'alphabetic');
        ctx.font = font(900, 130); const nw = ctx.measureText(fmt1(wn)).width;
        text(ctx, 'kg', 110 + nw + 16, 1262, font(800, 50), th.muted, 'left', 'alphabetic');
        const dv = wn - wFirst;
        const ds = (Math.abs(dv) < 0.05 ? '' : (dv < 0 ? '−' : '+')) + fmt1(Math.abs(dv)) + ' kg';
        ctx.font = font(800, 46); const dw = ctx.measureText(ds).width + 50;
        ctx.fillStyle = th.soft; rr(ctx, 970 - dw, 1190, dw, 70, 35); ctx.fill();
        text(ctx, ds, 970 - dw / 2, 1226, font(800, 46), A, 'center');
      } else {
        text(ctx, String(cnt), 110, 1262, font(900, 130), th.text, 'left', 'alphabetic');
        ctx.font = font(900, 130); const nw = ctx.measureText(String(cnt)).width;
        text(ctx, 'antrenman', 110 + nw + 16, 1262, font(800, 50), th.muted, 'left', 'alphabetic');
      }
      // grafik
      const CX = 80, CY = 1340, CW = 920, CH = 300;
      ctx.strokeStyle = th.track; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) { const yy = CY + 20 + k * (CH - 40) / 4; ctx.beginPath(); ctx.moveTo(CX, yy); ctx.lineTo(CX + CW, yy); ctx.stroke(); }
      const PX = (day) => CX + 20 + (day - 1) / Math.max(1, N - 1) * (CW - 40);
      // kilometre taşı çizgileri
      for (let m = 15; m < N; m += 15) {
        const mx = PX(m);
        ctx.save(); ctx.setLineDash([16, 16]); ctx.strokeStyle = th.muted; ctx.globalAlpha *= 0.5; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(mx, CY); ctx.lineTo(mx, CY + CH); ctx.stroke(); ctx.restore();
        const lit = dayf >= m, flash = lit ? clamp(1 - (dayf - m) / 3) : 0;
        ctx.fillStyle = lit ? (flash > 0.4 ? A : th.chip) : th.card; rr(ctx, mx - 50, CY - 32, 100, 38, 19); ctx.fill();
        text(ctx, `${m}. gün`, mx, CY - 12, font(700, 22), lit && flash > 0.4 ? th.accentText : (lit ? th.text : th.muted), 'center');
      }
      if (hasW) {
        const PY = (w) => CY + 20 + (wmax - w) / (wmax - wmin) * (CH - 40);
        const pts = [];
        for (let day = 1; day <= dayf; day += Math.max(0.25, N / 120)) pts.push([PX(day), PY(weightAt(day))]);
        pts.push([PX(dayf), PY(weightAt(dayf))]);
        ctx.beginPath(); ctx.moveTo(pts[0][0], CY + CH);
        for (const q of pts) ctx.lineTo(q[0], q[1]);
        ctx.lineTo(pts[pts.length - 1][0], CY + CH); ctx.closePath();
        ctx.fillStyle = rgba(A, 0.18); ctx.fill();
        ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
        ctx.strokeStyle = A; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
        dot(ctx, [PX(1), PY(wFirst)], 9, th.muted);
        const e = pts[pts.length - 1];
        ctx.save(); ctx.shadowColor = A; ctx.shadowBlur = 30; dot(ctx, e, 16, A); ctx.restore();
        dot(ctx, e, 7, th.bg);
      } else {
        // antrenman sütunları
        const bw = Math.max(4, (CW - 40) / N - 4);
        for (let k = 1; k <= Math.floor(dayf); k++) {
          if (!done.has(k)) continue;
          ctx.fillStyle = A; rr(ctx, PX(k) - bw / 2, CY + 60, bw, CH - 80, Math.min(8, bw / 2)); ctx.fill();
        }
      }
      // gün şeridi
      const gap = N <= 30 ? 6 : (N <= 60 ? 4 : 2);
      const cw = (960 - (N - 1) * gap) / N;
      for (let k = 1; k <= N; k++) {
        const x0 = 60 + (k - 1) * (cw + gap);
        const lit = done.has(k) && k <= dayf;
        ctx.fillStyle = lit ? A : th.track; rr(ctx, x0, 1730, cw, 60, Math.min(8, cw / 2)); ctx.fill();
      }
      text(ctx, `${cnt} antrenman`, 60, 1842, font(700, 32), th.text);
      text(ctx, 'Sen de başla →', 1020, 1842, font(700, 32), th.muted, 'right');
    }

    function fin(ctx, t) {
      const lt = t - FIN;
      logo(ctx, th, 70, 80, d.appName || 'FitAdım');
      const a = easeOut((lt - 0.3) / 0.5);
      text(ctx, `${N} GÜNDE`, 540, 330, font(900, 64), mix(th.bg, th.muted, a), 'center');
      const vis = ease((lt - 0.4) / 0.3);
      if (hasW) {
        const v = absD * easeOut((lt - 0.4) / 0.9);
        if (vis > 0) glowText(ctx, sign + fmt1(v), 540, 580, 230, A, vis);
        text(ctx, verb, 540, 790, font(800, 56), mix(th.bg, th.text, vis), 'center');
      } else {
        const v = Math.round((d.workouts || 0) * easeOut((lt - 0.4) / 0.9));
        if (vis > 0) glowText(ctx, String(v), 540, 580, 230, A, vis);
        text(ctx, 'antrenman yaptım', 540, 790, font(800, 56), mix(th.bg, th.text, vis), 'center');
      }
      const tier = d.tier;
      const bt = (lt - 1.2) / 0.45;
      if (bt > 0 && tier) {
        const sc = backOut(bt);
        ctx.save(); ctx.globalAlpha *= clamp(bt * 2);
        drawBadge(ctx, tier, 540, 1075, 260 * sc, { label: String(tier.n), sub: 'GÜN' });
        ctx.restore();
        text(ctx, `Yeni seviye: ${tier.name}`, 540, 1290, font(800, 56), mix(th.bg, tier.col, ease((lt - 1.5) / 0.3)), 'center');
      }
      const lad = ease((lt - 1.9) / 0.4);
      if (lad > 0 && d.ladder) {
        const k = d.ladder.length, size = 96, gap = 30;
        const x0 = (1080 - (k * size + (k - 1) * gap)) / 2;
        d.ladder.forEach((s, i) => {
          const x = x0 + i * (size + gap) + size / 2, y = 1418;
          ctx.save(); ctx.globalAlpha *= lad;
          if (s.n <= N) {
            dot(ctx, [x, y], size / 2, s.col);
            text(ctx, String(s.n), x, y + 2, font(900, 34), '#0B0B0B', 'center');
          } else {
            const nxt = s.n === N + 15;
            ctx.strokeStyle = nxt ? s.col : th.border; ctx.lineWidth = nxt ? 5 : 3;
            ctx.beginPath(); ctx.arc(x, y, size / 2 - 3, 0, Math.PI * 2); ctx.stroke();
            text(ctx, String(s.n), x, y + 2, font(900, 30), nxt ? s.col : th.muted, 'center');
          }
          ctx.restore();
        });
        if (d.next) text(ctx, `Sıradaki: ${d.next} · 15 gün sonra`, 540, 1520, font(700, 34), mix(th.bg, th.muted, lad), 'center');
      }
      const st = ease((lt - 2.3) / 0.4);
      if (st > 0) {
        const stats = [[String(d.workouts || 0), 'antrenman'], [fmt1(d.hours || 0), 'saat'], [`${d.best || 0} gün`, 'en uzun seri']];
        stats.forEach(([v1, v2], i) => {
          const cx = 540 + (i - 1) * 320;
          text(ctx, v1, cx, 1650, font(900, 64), mix(th.bg, th.text, st), 'center');
          text(ctx, v2, cx, 1712, font(600, 30), mix(th.bg, th.muted, st), 'center');
        });
        text(ctx, 'Sen de başla →', 540, 1840, font(700, 34), mix(th.bg, A, st), 'center');
      }
    }

    function frame(ctx, t) {
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, 1080, 1920);
      if (t < MAIN0) {
        intro(ctx, t);
        if (t > MAIN0 - 0.3) { ctx.save(); ctx.globalAlpha = (t - (MAIN0 - 0.3)) / 0.3; ctx.fillStyle = th.bg; ctx.fillRect(0, 0, 1080, 1920); main(ctx, MAIN0); ctx.restore(); }
      } else if (t < FIN) {
        main(ctx, t);
      } else if (t < FIN + 0.35) {
        main(ctx, Math.min(t, MAIN1));
        ctx.save(); ctx.globalAlpha = (t - FIN) / 0.35; ctx.fillStyle = th.bg; ctx.fillRect(0, 0, 1080, 1920); fin(ctx, t); ctx.restore();
      } else {
        fin(ctx, t);
      }
    }
    return { dur: DUR, frame, name: `fitadim_${N}gun` };
  }

  // ------------------------------------------------------------------ ROZET VİDEOSU
  function badgeScene(d) {
    const th = THEMES[d.theme] || THEMES.koyu;
    const b = d.badge;
    const col = b.col;
    const DUR = 7.0;
    function frame(ctx, t) {
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, 1080, 1920);
      logo(ctx, th, 70, 80, d.appName || 'FitAdım');
      text(ctx, 'YENİ ROZET AÇILDI', 540, 300, font(800, 46), mix(th.bg, col, ease(t / 0.5)), 'center');
      if (t < 1.3) {
        const pt = clamp(t / 1.1);
        for (let i = 0; i < 14; i++) {
          const ang = i / 14 * Math.PI * 2 + 0.4;
          const r = lerp(620, 30, easeOut(pt));
          const r2 = lerp(6, 14, pt) * (1 - clamp((t - 1.0) / 0.3));
          if (r2 > 0.5) dot(ctx, [540 + r * Math.cos(ang), 820 + r * Math.sin(ang) * 1.1], r2, mix(th.bg, col, clamp(pt * 2)));
        }
      }
      if (t > 1.0 && t < 1.7) {
        const ft = (t - 1.0) / 0.7;
        ctx.save(); ctx.globalAlpha *= 1 - ft; ctx.strokeStyle = col; ctx.lineWidth = 10;
        ctx.beginPath(); ctx.arc(540, 820, lerp(120, 560, easeOut(ft)), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (t >= 1.0) {
        const pop = backOut((t - 1.0) / 0.5);
        const mv = ease((t - 3.0) / 0.7);
        const size = 360 * pop * lerp(1, 0.56, mv);
        const cy = lerp(820, 520, mv);
        if (size > 4) drawBadge(ctx, b, 540, cy, size, { shine: (t - 1.6) / 0.9 });
        const ta = ease((t - 1.5) / 0.4);
        const ny = lerp(1150, 790, mv);
        text(ctx, b.name, 540, ny, font(900, b.name.length > 14 ? 74 : 96), mix(th.bg, th.text, ta), 'center');
        text(ctx, b.desc, 540, ny + 80, font(600, 38), mix(th.bg, th.muted, ta), 'center');
      }
      if (t > 3.4) {
        const st = b.stat || { type: 'none' };
        const mt = (t - 3.4) / 2.2;
        const a = ease((t - 3.4) / 0.4);
        ctx.save(); ctx.globalAlpha *= a;
        ctx.fillStyle = th.card; rr(ctx, 60, 940, 960, 740, 44); ctx.fill();
        ctx.strokeStyle = th.border; ctx.lineWidth = 2; ctx.stroke();
        if (st.type === 'reps') {
          const pf = (x) => 0.5 - 0.5 * Math.cos(2 * Math.PI * 3 * clamp(x / 2.2));
          drawFigure(ctx, st.kind || 0, pf, t - 3.4, d.style, col, th, 160, 950, 760);
          text(ctx, String(Math.round(st.target * easeOut(mt))), 540, 1530, font(900, 130), col, 'center');
          text(ctx, st.unit, 540, 1615, font(700, 36), th.muted, 'center');
        } else if (st.type === 'days') {
          const n = Math.min(st.n, 10), gap = 22, size = Math.min(104, (900 - (n - 1) * gap) / n);
          const x0 = (1080 - (n * size + (n - 1) * gap)) / 2;
          for (let i = 0; i < n; i++) {
            const on = mt * (n + 1) > i + 1;
            const cx = x0 + i * (size + gap) + size / 2;
            if (on) {
              ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 30; dot(ctx, [cx, 1172], size / 2, col); ctx.restore();
              icon(ctx, b.icon, cx, 1172, size * 0.55, '#0B0B0B', 2.4);
            } else {
              ctx.strokeStyle = th.border; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, 1172, size / 2 - 3, 0, Math.PI * 2); ctx.stroke();
            }
          }
          const shown = st.n > 10 ? Math.round(st.n * clamp(mt)) : Math.min(n, Math.floor(mt * (n + 1)));
          text(ctx, `${shown} / ${st.n}`, 540, 1440, font(900, 120), col, 'center');
          text(ctx, st.unit, 540, 1540, font(700, 36), th.muted, 'center');
        } else {
          const v = Math.round((st.target || 0) * easeOut(mt));
          text(ctx, String(v), 540, 1250, font(900, 160), col, 'center');
          text(ctx, st.unit || '', 540, 1370, font(700, 40), th.muted, 'center');
        }
        ctx.restore();
      }
      const fa = ease((t - 5.6) / 0.4);
      if (fa > 0) {
        text(ctx, d.counter ? `Rozet ${d.counter}` : '', 70, 1780, font(700, 34), mix(th.bg, th.muted, fa));
        text(ctx, 'Sen de başla →', 1010, 1780, font(700, 34), mix(th.bg, th.accent, fa), 'right');
      }
    }
    return { dur: DUR, frame, name: `fitadim_rozet` };
  }

  // ------------------------------------------------------------------ KARTLAR (tek kare)
  const REGIONS = {
    // [şekil, x, y, w, h | rx, ry] 420x400 kutu, ön (x<200) ve arka (x>=220)
    shoulders: [['e', 60, 76, 16, 13], ['e', 140, 76, 16, 13], ['e', 282, 80, 15, 12], ['e', 358, 80, 15, 12]],
    chest: [['r', 66, 66, 32, 36], ['r', 102, 66, 32, 36]],
    abs: [['r', 84, 106, 15, 14], ['r', 101, 106, 15, 14], ['r', 84, 122, 15, 14], ['r', 101, 122, 15, 14], ['r', 84, 138, 15, 14], ['r', 101, 138, 15, 14], ['r', 68, 106, 14, 46], ['r', 118, 106, 14, 46]],
    biceps: [['r', 40, 88, 18, 44], ['r', 142, 88, 18, 44]],
    triceps: [['r', 260, 90, 18, 44], ['r', 362, 90, 18, 44]],
    back: [['p', [[300, 52], [340, 52], [352, 72], [288, 72]]], ['r', 288, 76, 30, 60], ['r', 322, 76, 30, 60], ['r', 305, 138, 30, 22]],
    glutes: [['e', 305, 178, 17, 16], ['e', 335, 178, 17, 16]],
    quads: [['r', 70, 180, 27, 88], ['r', 103, 180, 27, 88]],
    hamstrings: [['r', 290, 198, 26, 70], ['r', 324, 198, 26, 70]],
    calves: [['r', 293, 280, 20, 60], ['r', 327, 280, 20, 60]],
  };
  const BASE_SHAPES = [['c', 100, 30, 18], ['r', 92, 46, 16, 14], ['r', 72, 156, 56, 22], ['r', 38, 136, 16, 42], ['r', 146, 136, 16, 42], ['r', 74, 280, 20, 62], ['r', 106, 280, 20, 62],
    ['c', 320, 30, 18], ['r', 312, 46, 16, 14], ['r', 258, 138, 16, 42], ['r', 366, 138, 16, 42]];

  function shape(ctx, s) {
    ctx.beginPath();
    if (s[0] === 'c') ctx.arc(s[1], s[2], s[3], 0, Math.PI * 2);
    else if (s[0] === 'e') ctx.ellipse(s[1], s[2], s[3], s[4], 0, 0, Math.PI * 2);
    else if (s[0] === 'p') { s[1].forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
    else { const r = Math.min(s[3], s[4]) / 2.2; rr(ctx, s[1], s[2], s[3], s[4], Math.min(r, 13)); }
    ctx.fill();
  }

  function bodyMap(ctx, x, y, w, levels, th) {
    const s = w / 420;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = th.base;
    for (const sh of BASE_SHAPES) shape(ctx, sh);
    for (const k in REGIONS) { const lv = levels[k] || 0; if (lv <= 0) for (const sh of REGIONS[k]) shape(ctx, sh); }
    ctx.shadowColor = th.accent; ctx.shadowBlur = 24;
    for (const k in REGIONS) {
      const lv = levels[k] || 0;
      if (lv <= 0) continue;
      ctx.globalAlpha = 0.4 + 0.6 * clamp(lv);
      ctx.fillStyle = th.accent;
      for (const sh of REGIONS[k]) shape(ctx, sh);
    }
    ctx.restore();
  }

  function cardScene(kind, d) {
    const th = THEMES[d.theme] || THEMES.koyu;
    const A = th.accent;
    function frame(ctx) {
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, 1080, 1920);
      logo(ctx, th, 76, 80, d.appName || 'FitAdım');
      text(ctx, d.date || '', 1004, 110, font(700, 34), th.muted, 'right');
      if (kind === 'musclemap') {
        text(ctx, 'BUGÜNÜN KAS HARİTASI', 76, 250, font(800, 34), th.muted);
        text(ctx, d.title || 'Antrenman tamam.', 76, 330, font(900, d.title && d.title.length > 18 ? 70 : 86), th.text);
        bodyMap(ctx, 110, 430, 860, d.levels || {}, th);
        let x = 76, y = 1300;
        (d.muscles || []).slice(0, 6).forEach((m, j) => {
          ctx.font = font(800, 34);
          const w = ctx.measureText(m).width + 56;
          if (x + w > 1004) { x = 76; y += 84; }
          ctx.fillStyle = j === 0 ? A : th.chip; rr(ctx, x, y, w, 68, 34); ctx.fill();
          text(ctx, m, x + w / 2, y + 35, font(800, 34), j === 0 ? th.accentText : th.text, 'center');
          x += w + 16;
        });
        ctx.fillStyle = th.border; ctx.fillRect(76, 1600, 928, 2);
        const stats = [[String(Math.round(d.minutes || 0)), 'dakika'], [String(d.moves || 0), 'hareket'], [String(Math.round(d.kcal || 0)), 'kcal']];
        stats.forEach(([v, l], i) => {
          const cx = 76 + 928 / 6 + i * 928 / 3;
          text(ctx, v, cx, 1700, font(900, 80), th.text, 'center');
          text(ctx, l, cx, 1780, font(700, 34), th.muted, 'center');
        });
      } else if (kind === 'badgecard') {
        const b = d.badge;
        text(ctx, 'YENİ ROZET AÇILDI', 540, 420, font(900, 46), b.col, 'center');
        drawBadge(ctx, b, 540, 820, 440, { glow: 0.45 });
        text(ctx, b.name, 540, 1260, font(900, b.name.length > 14 ? 88 : 110), th.text, 'center');
        text(ctx, b.desc, 540, 1360, font(700, 42), th.muted, 'center');
        ctx.fillStyle = th.border; ctx.fillRect(76, 1720, 928, 2);
        text(ctx, d.counter ? `Rozet ${d.counter}` : '', 76, 1800, font(800, 36), th.muted);
        text(ctx, 'Sen de başla →', 1004, 1800, font(800, 36), A, 'right');
      } else {
        const N = d.days || 30;
        text(ctx, (d.monthLabel || '').toUpperCase(), 76, 270, font(800, 34), th.muted);
        text(ctx, `${d.count || 0} gün`, 76, 400, font(900, 170), th.text);
        text(ctx, 'antrenman yaptım.', 76, 530, font(700, 46), th.muted);
        const heads = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
        const cell = 112, gap = 18, x0 = 76;
        heads.forEach((h, i) => text(ctx, h, x0 + i * (cell + gap) + cell / 2, 660, font(800, 30), th.muted, 'center'));
        const doneSet = new Set(d.done || []);
        const off0 = d.offset || 0;
        for (let day = 1; day <= N; day++) {
          const idx = off0 + day - 1;
          const cx = x0 + (idx % 7) * (cell + gap), cy = 700 + Math.floor(idx / 7) * (cell + gap);
          const on = doneSet.has(day);
          ctx.save();
          if (on) { ctx.shadowColor = A; ctx.shadowBlur = 26; }
          ctx.fillStyle = on ? A : th.card; rr(ctx, cx, cy, cell, cell, 24); ctx.fill();
          ctx.restore();
          text(ctx, String(day), cx + cell / 2, cy + cell / 2 + 2, font(800, 36), on ? th.accentText : th.muted, 'center');
        }
        ctx.fillStyle = th.border; ctx.fillRect(76, 1600, 928, 2);
        const stats = [[`${d.best || 0} gün`, 'en uzun seri'], [fmt1(d.hours || 0), 'saat'], [String(d.badges || 0), 'yeni rozet']];
        stats.forEach(([v, l], i) => {
          const cx = 76 + 928 / 6 + i * 928 / 3;
          text(ctx, v, cx, 1700, font(900, 72), th.text, 'center');
          text(ctx, l, cx, 1780, font(700, 32), th.muted, 'center');
        });
      }
    }
    return { frame, name: `fitadim_${kind}` };
  }

  // ------------------------------------------------------------------ kayıt
  function pickMime() {
    if (!window.MediaRecorder) return null;
    const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const m of list) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* */ } }
    return '';
  }

  const RW = 720, RH = 1280; // kayıt çözünürlüğü (telefonda akıcı olsun diye)

  function recordScene(scene, canvas, onProgress) {
    return new Promise((resolve, reject) => {
      const mime = pickMime();
      if (mime === null || !canvas.captureStream) { reject(new Error('Bu tarayıcı video kaydını desteklemiyor.')); return; }
      const ctx = canvas.getContext('2d');
      const draw = (t) => { ctx.save(); ctx.scale(RW / 1080, RH / 1920); scene.frame(ctx, t); ctx.restore(); };
      draw(0);
      const stream = canvas.captureStream(30);
      const opts = { videoBitsPerSecond: 6000000 };
      if (mime) opts.mimeType = mime;
      let rec;
      try { rec = new MediaRecorder(stream, opts); } catch (e) { reject(e); return; }
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
        resolve(new Blob(chunks, { type }));
      };
      rec.onerror = (e) => reject(e.error || e);
      rec.start(250);
      const t0 = performance.now();
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        if (t >= scene.dur) { draw(scene.dur); setTimeout(() => rec.stop(), 120); onProgress(1); return; }
        draw(t); onProgress(t / scene.dur);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function renderCard(scene) {
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1920;
    scene.frame(c.getContext('2d'));
    return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
  }

  // ------------------------------------------------------------------ önizleme katmanı (Paylaş / Kaydet)
  function el(tag, css, html) { const e = document.createElement(tag); if (css) e.style.cssText = css; if (html != null) e.textContent = html; return e; }

  function overlay(theme) {
    const th = THEMES[theme] || THEMES.koyu;
    const root = el('div', `position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px;box-sizing:border-box;font-family:${FONT};-webkit-tap-highlight-color:transparent`);
    const box = el('div', 'position:relative;height:min(68vh,calc((100vw - 32px) * 16 / 9));aspect-ratio:9/16;border-radius:20px;overflow:hidden;background:#000;box-shadow:0 10px 40px rgba(0,0,0,0.6)');
    const status = el('div', 'color:#fff;font-size:16px;font-weight:700;text-align:center;min-height:22px', '');
    const bar = el('div', 'width:min(320px,80vw);height:8px;border-radius:4px;background:rgba(255,255,255,0.15);overflow:hidden');
    const fill = el('div', `height:100%;width:0%;background:${th.accent};border-radius:4px`);
    bar.appendChild(fill);
    const row = el('div', 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center');
    const btn = (label, primary) => {
      const b = el('button', `min-height:48px;padding:0 22px;border-radius:14px;border:${primary ? '0' : '1px solid rgba(255,255,255,0.3)'};background:${primary ? th.accent : 'transparent'};color:${primary ? th.accentText : '#fff'};font:800 16px ${FONT};cursor:pointer`, label);
      b.type = 'button';
      return b;
    };
    root.append(box, status, bar, row);
    document.body.appendChild(root);
    return { root, box, status, bar, fill, row, btn, th };
  }

  function ext(blob) { return blob.type.includes('mp4') ? 'mp4' : (blob.type.includes('png') ? 'png' : 'webm'); }

  async function share(blob, name, text_) {
    const file = new File([blob], `${name}.${ext(blob)}`, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: text_ }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    save(blob, name);
    return 'saved';
  }

  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.${ext(blob)}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function finish(ui, blob, name, shareText, isVideo, resolve) {
    ui.bar.style.display = 'none';
    ui.box.innerHTML = '';
    const url = URL.createObjectURL(blob);
    let media;
    if (isVideo) {
      media = el('video', 'width:100%;height:100%;object-fit:cover;display:block');
      media.src = url; media.autoplay = true; media.loop = true; media.muted = true; media.playsInline = true;
      media.setAttribute('playsinline', '');
    } else {
      media = el('img', 'width:100%;height:100%;object-fit:cover;display:block');
      media.src = url; media.alt = 'Paylaşım kartı';
    }
    ui.box.appendChild(media);
    ui.status.textContent = isVideo ? 'Videon hazır! Telefonuna kaydedebilir ya da paylaşabilirsin.' : 'Kartın hazır!';
    const bShare = ui.btn('Paylaş', true), bSave = ui.btn('Kaydet', false), bClose = ui.btn('Kapat', false);
    bShare.onclick = async () => {
      const r = await share(blob, name, shareText);
      ui.status.textContent = r === 'shared' ? 'Paylaşıldı 🎉' : (r === 'saved' ? 'Cihazına indirildi.' : ui.status.textContent);
    };
    bSave.onclick = () => { save(blob, name); ui.status.textContent = 'Cihazına kaydedildi. (iPhone\'da Paylaş → Videoyu Kaydet de kullanabilirsin.)'; };
    bClose.onclick = () => { ui.root.remove(); URL.revokeObjectURL(url); resolve('closed'); };
    ui.row.append(bShare, bSave, bClose);
  }

  function makeScene(kind, d) {
    if (kind === 'milestone') return milestoneScene(d);
    if (kind === 'badge') return badgeScene(d);
    return cardScene(kind, d);
  }

  /** Ana giriş: Dart buradan çağırır. Katman kapanınca 'closed' veya hata metniyle çözülür. */
  function open(kind, json) {
    return new Promise((resolve) => {
      let d;
      try { d = JSON.parse(json); } catch (e) { resolve('error: veri okunamadı'); return; }
      const scene = makeScene(kind, d);
      const ui = overlay(d.theme);
      const isVideo = kind === 'milestone' || kind === 'badge';
      const shareText = d.shareText || 'FitAdım ile ilerliyorum 💪';
      const fail = (msg) => {
        ui.status.textContent = msg; ui.bar.style.display = 'none';
        const b = ui.btn('Kapat', true); b.onclick = () => { ui.root.remove(); resolve('error'); }; ui.row.appendChild(b);
      };
      if (isVideo) {
        const canvas = el('canvas', 'width:100%;height:100%;display:block');
        canvas.width = RW; canvas.height = RH;
        ui.box.appendChild(canvas);
        ui.status.textContent = 'Videon hazırlanıyor… Bu ekranı açık tut.';
        const cancel = ui.btn('Vazgeç', false);
        let cancelled = false;
        cancel.onclick = () => { cancelled = true; ui.root.remove(); resolve('cancelled'); };
        ui.row.appendChild(cancel);
        recordScene(scene, canvas, (p) => { ui.fill.style.width = `${Math.round(p * 100)}%`; })
          .then((blob) => { if (cancelled) return; ui.row.innerHTML = ''; finish(ui, blob, scene.name, shareText, true, resolve); })
          .catch((e) => { if (!cancelled) { ui.row.innerHTML = ''; fail('Video oluşturulamadı: ' + (e && e.message ? e.message : e)); } });
      } else {
        ui.status.textContent = 'Kart hazırlanıyor…';
        ui.bar.style.display = 'none';
        renderCard(scene).then((blob) => finish(ui, blob, scene.name, shareText, false, resolve)).catch((e) => fail('Kart oluşturulamadı: ' + e));
      }
    });
  }

  window.fitadimMedia = {
    open,
    supported: () => !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream),
    // test için
    _drawFrame: (kind, json, t, canvas) => { const s = makeScene(kind, JSON.parse(json)); const ctx = canvas.getContext('2d'); s.frame(ctx, t); },
    _record: (kind, json) => recordScene(makeScene(kind, JSON.parse(json)), Object.assign(document.createElement('canvas'), { width: RW, height: RH }), () => {}),
  };
})();
