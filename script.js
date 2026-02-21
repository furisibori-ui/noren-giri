/**
 * THE NOREN GIRI - のれん切り
 * HTML5 Canvas + Vanilla JS / BigInt スコア・日本式単位表記
 */
(function () {
  'use strict';

  const UNITS = ['', '万', '億', '兆', '京', '垓', '秭', '穣', '溝', '澗', '正', '載', '極', '恒河沙', '阿僧祇', '那由他', '不可思議', '無量大数'];

  function formatJapaneseYen(value) {
    if (typeof value !== 'bigint') value = BigInt(value);
    if (value < 0n) value = 0n;
    if (value === 0n) return '0円';
    const str = value.toString();
    const len = str.length;
    const segments = [];
    for (let i = 0; i < len; i += 4) {
      const start = Math.max(0, len - i - 4);
      const end = len - i;
      const part = str.slice(start, end);
      const num = parseInt(part, 10);
      const unitIndex = Math.floor(i / 4);
      if (num > 0 && unitIndex < UNITS.length) {
        segments.unshift(num + UNITS[unitIndex]);
      }
    }
    return (segments.join('') || '0') + '円';
  }

  function getScoreFontScale(formatted) {
    const len = formatted.replace(/[^0-9０-９]/g, '').length;
    if (len <= 6) return 1;
    if (len <= 10) return 1.15;
    if (len <= 14) return 1.35;
    return Math.min(2, 1.2 + len * 0.04);
  }

  const DEFICIT_MAX = 3;
  const BASE_PRICE_START = 100n * 10000n * 10000n;
  const BASE_PRICE_END = 500n * 10000n * 10000n * 10000n;
  const INFLATION_DURATION_MS = 120000;
  const COMBO_MULTIPLIER = (combo) => {
    if (combo <= 1) return 1.0;
    if (combo < 10) return 1 + (combo - 1) * (4 / 9);
    if (combo < 50) return 5 + (combo - 10) * (45 / 40);
    return 50 + (combo - 50) * 0.5;
  };
  const NOREN_WIDTH_RATIO = 0.2;
  const NOREN_MAX_HEIGHT_RATIO = 0.95;
  const NOREN_GROWTH_PER_FRAME = 0.0065;
  const SPAWN_INTERVAL_MIN_MS = 680;
  const SPAWN_INTERVAL_MAX_MS = 1320;
  const SWIPE_THRESHOLD = 10;
  const TAP_SLASH_LENGTH = 40;
  const NOREN_GROWTH_VARY = 0.18;
  const NOREN_STRIPES = 5;
  const FLOAT_BILL_COUNT = 42;
  const FLOAT_BILL_BASE_RATIO = 0.2;
  const FLOAT_BILL_SCALE_MIN = 0.28;
  const FLOAT_BILL_SCALE_MAX = 0.5;
  const SCATTER_ON_MISS = 35;
  const SCATTER_ON_GAMEOVER = 85;
  const SCATTER_ON_CUT_RED = 55;
  const SLASH_EFFECT_DURATION_MS = 280;
  const DEADLINE_RATIO = 0.82;
  const DEADLINE_DANGER_START = 0.62;
  const DEADLINE_FLASH_SPEED = 0.012;
  const SPAWN_INTERVAL_MIN_FINAL_MS = 320;
  const SPAWN_INTERVAL_DECAY_MS = 90000;
  const NOREN_GROWTH_ACCEL_MS = 80000;
  const SPECIAL_GAUGE_PER_RED_CUT = 0.22;
  const SPECIAL_GAUGE_PINCH_PER_FRAME = 0.004;
  const SPECIAL_AUTO_CUT_DURATION_MS = 2500;
  const SPECIAL_AUTO_CUT_MULT = 1n;
  const SPECIAL_SPAWN_DIVIDER = 10;

  const titleScreen = document.getElementById('title-screen');
  const gameScreen = document.getElementById('game-screen');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const startBtn = document.getElementById('start-btn');
  const retryBtn = document.getElementById('retry-btn');
  const shareBtn = document.getElementById('share-btn');
  const shareArea = document.getElementById('share-area');
  const canvas = document.getElementById('game-canvas');
  const scoreEl = document.getElementById('score-value');
  const comboEl = document.getElementById('combo-value');
  const deficitFill = document.getElementById('deficit-fill');
  const specialFill = document.getElementById('special-fill');
  const specialBtn = document.getElementById('special-btn');
  const finalScoreEl = document.getElementById('final-score');
  const popupContainer = document.getElementById('popup-container');
  const recordNameInput = document.getElementById('record-name');
  const recordBtn = document.getElementById('record-btn');
  const recordMsg = document.getElementById('record-msg');
  const rankingOverlay = document.getElementById('ranking-overlay');
  const rankingListEl = document.getElementById('ranking-list');
  const rankingBtn = document.getElementById('ranking-btn');
  const rankingCloseBtn = document.getElementById('ranking-close');

  const RANKING_KEY = 'norenGiriRanking';
  const RANKING_MAX = 20;

  let ctx;
  let gameState = 'title';
  let score = 0n;
  let combo = 0;
  let deficit = 0;
  let gameStartTime = 0;
  let lastSpawnTime = 0;
  let nextSpawnDelayMs = 1000;
  let norenList = [];
  let norenId = 0;
  let swipeStart = null;
  let animationId = 0;
  let bgImage = null;
  let bgImageFallback = null;
  let specialImage = null;
  let billImages = [];
  let imagesLoaded = false;
  let floatBills = [];
  let scatterBills = [];
  let slashEffects = [];
  let billSeed = 0;
  let audioCtx = null;
  let bgm = null;
  let specialMeter = 0;
  let specialActiveUntil = 0;

  function loadImages(cb) {
    const path = window.location.pathname;
    const dir = (path.endsWith('/') ? path : path.replace(/\/[^/]*$/, '')) || '/';
    const base = (dir === '/' ? '' : dir) + '/assets/images/';
    let done = 0;
    const total = 3;
    function onLoad() {
      done++;
      if (done >= total) {
        imagesLoaded = true;
        if (cb) cb();
      }
    }
    bgImage = new Image();
    bgImage.onload = onLoad;
    bgImage.onerror = onLoad;
    bgImage.src = base + 'background.png';
    bgImageFallback = new Image();
    bgImageFallback.onload = function () {};
    bgImageFallback.onerror = function () {};
    bgImageFallback.src = base + 'background-fallback.png';
    const logoImg = new Image();
    logoImg.onload = onLoad;
    logoImg.onerror = onLoad;
    logoImg.src = base + 'logo.png';
    specialImage = new Image();
    specialImage.onload = onLoad;
    specialImage.onerror = onLoad;
    specialImage.src = base + 'oni_juusoku_zan.png';
    billImages = [new Image(), new Image()];
    billImages[0].src = base + 'bill1.png';
    billImages[1].src = base + 'bill2.png';
  }

  function random() {
    billSeed = (billSeed * 9301 + 49297) % 233280;
    return billSeed / 233280;
  }

  function initFloatBills(w, h) {
    floatBills = [];
    billSeed = Date.now() % 233280;
    const baseW = Math.min(w, h) * FLOAT_BILL_BASE_RATIO;
    for (let i = 0; i < FLOAT_BILL_COUNT; i++) {
      floatBills.push({
        x: w * (random() * 1.2 - 0.1),
        y: h * (random() * 1.4 - 0.2),
        rotation: random() * Math.PI * 2,
        rotationSpeed: (random() - 0.5) * 0.008,
        scale: FLOAT_BILL_SCALE_MIN + random() * (FLOAT_BILL_SCALE_MAX - FLOAT_BILL_SCALE_MIN),
        imgIndex: Math.floor(random() * 2),
        phase: random() * Math.PI * 2,
        baseW,
      });
    }
  }

  function spawnScatterBills(w, h, count, fromCenter) {
    const baseW = Math.min(w, h) * 0.18;
    const cx = w * 0.5;
    const cy = h * (fromCenter ? 0.6 : 0.85);
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const speed = 2 + random() * 6;
      scatterBills.push({
        x: cx + (random() - 0.5) * w * 0.4,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: -3 - random() * 8,
        rotation: random() * Math.PI * 2,
        rotationSpeed: (random() - 0.5) * 0.3,
        scale: 0.2 + random() * 0.3,
        imgIndex: Math.floor(random() * 2),
        baseW,
      });
    }
  }

  function spawnScatterBillsFromCut(w, h, cx, cy, count) {
    const baseW = Math.min(w, h) * 0.22;
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2;
      const speed = 6 + random() * 14;
      scatterBills.push({
        x: cx + (random() - 0.5) * w * 0.15,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: -8 - random() * 18,
        rotation: random() * Math.PI * 2,
        rotationSpeed: (random() - 0.5) * 0.5,
        scale: 0.3 + random() * 0.35,
        imgIndex: Math.floor(random() * 2),
        baseW,
      });
    }
  }

  function drawBill(b, isScatter) {
    const img = billImages[b.imgIndex];
    const w = b.baseW * b.scale;
    const h = w * 0.45;
    ctx.save();
    ctx.globalAlpha = isScatter ? 0.85 : 0.6;
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);
    if (img && img.complete && img.naturalWidth) {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      ctx.scale(w / iw, h / ih);
      ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
    } else {
      ctx.fillStyle = '#e8d4a0';
      ctx.strokeStyle = 'rgba(180,150,80,0.6)';
      ctx.lineWidth = 2;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  function updateFloatBills(w, h) {
    const t = Date.now() * 0.001;
    for (let i = 0; i < floatBills.length; i++) {
      const b = floatBills[i];
      b.x += Math.sin(t + b.phase) * 0.4;
      b.y += 0.15;
      b.rotation += b.rotationSpeed;
      if (b.y > h + 80) {
        b.y = -60;
        b.x = w * (random() * 1.1 - 0.05);
      }
      if (b.x > w + 60) b.x = -60;
      if (b.x < -60) b.x = w + 60;
    }
  }

  function updateScatterBills(w, h) {
    for (let i = scatterBills.length - 1; i >= 0; i--) {
      const b = scatterBills[i];
      b.x += b.vx;
      b.y += b.vy;
      b.vy += 0.08;
      b.rotation += b.rotationSpeed;
      if (b.y > h + 100 || b.y < -100 || b.x < -100 || b.x > w + 100) {
        scatterBills.splice(i, 1);
      }
    }
  }

  function initAudio() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function () {});
      }
      return;
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function () {});
      }
    } catch (e) {
      console.warn('AudioContext not available');
    }
  }

  function playBGM() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(function () { startBGM(); }).catch(function () {});
    } else {
      startBGM();
    }
  }
  function startBGM() {
    if (!audioCtx) return;
    const src = 'assets/sounds/bgm.mp3';
    const a = new Audio(src);
    a.loop = true;
    a.volume = 0;
    const targetVolume = 0.4;
    const fadeSec = 1.5;
    const fadeOutLeadSec = 2;
    a.play().catch(() => {});
    bgm = a;
    let bgmDuration = 0;
    let isFadingOut = false;
    let needFadeInAfterLoop = false;
    let lastTime = 0;
    function runFadeIn(onComplete) {
      const start = performance.now();
      function tick() {
        const elapsed = (performance.now() - start) / 1000;
        if (elapsed >= fadeSec) {
          a.volume = targetVolume;
          if (onComplete) onComplete();
          return;
        }
        a.volume = (elapsed / fadeSec) * targetVolume;
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    runFadeIn();
    a.addEventListener('loadedmetadata', () => { bgmDuration = a.duration; });
    a.addEventListener('timeupdate', () => {
      if (!bgmDuration && a.duration) bgmDuration = a.duration;
      const t = a.currentTime;
      if (bgmDuration && fadeOutLeadSec < bgmDuration) {
        if (t >= bgmDuration - fadeOutLeadSec) {
          if (!isFadingOut) {
            isFadingOut = true;
            needFadeInAfterLoop = true;
          }
          const remain = bgmDuration - t;
          a.volume = Math.max(0, targetVolume * (remain / fadeOutLeadSec));
        } else {
          if (t < 0.5 && needFadeInAfterLoop && lastTime > 1) {
            needFadeInAfterLoop = false;
            isFadingOut = false;
            runFadeIn();
          }
          a.playbackRate = 0.99 + 0.02 * Math.sin(Date.now() * 0.00035);
        }
      }
      lastTime = t;
    });
  }

  function playSlash(comboForPitch) {
    if (!audioCtx) return;
    const base = 'assets/sounds/';
    const wellCut = comboForPitch >= 3;
    const src = wellCut ? base + 'slash_good.mp3' : base + 'slash_soft.mp3';
    const a = new Audio(src);
    a.onerror = function () {
      const fallback = new Audio(base + 'slash.mp3');
      fallback.playbackRate = Math.min(2, Math.max(0.5, 1 + comboForPitch * 0.02));
      fallback.volume = 0.6;
      fallback.play().catch(function () {});
    };
    a.playbackRate = Math.min(2, Math.max(0.5, 1 + comboForPitch * 0.02));
    a.volume = 0.6;
    a.play().catch(function () {});
  }

  function playExplosion(pitch) {
    if (!audioCtx) return;
    const a = new Audio('assets/sounds/explosion.mp3');
    a.playbackRate = Math.min(2, Math.max(0.5, pitch));
    a.volume = 0.5;
    a.play().catch(() => {});
  }

  function playBadCut() {
    if (!audioCtx) return;
    const a = new Audio('assets/sounds/bad_cut.mp3');
    a.volume = 0.7;
    a.play().catch(() => {});
  }

  function playSpecial() {
    if (!audioCtx) return;
    const a = new Audio('assets/sounds/special.mp3');
    a.volume = 0.85;
    a.play().catch(() => {});
  }

  function getBasePricePerNoren() {
    const elapsed = Date.now() - gameStartTime;
    const t = Math.min(1, elapsed / INFLATION_DURATION_MS);
    const logStart = Math.log(Number(BASE_PRICE_START));
    const logEnd = Math.log(Number(BASE_PRICE_END));
    return BigInt(Math.floor(Math.exp(logStart + (logEnd - logStart) * t)));
  }

  function getScorePerNoren() {
    const base = getBasePricePerNoren();
    const mult = COMBO_MULTIPLIER(combo);
    return BigInt(Math.floor(Number(base) * mult));
  }

  function spawnNoren() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const elapsed = Date.now() - gameStartTime;
    const t = Math.min(1, elapsed / SPAWN_INTERVAL_DECAY_MS);
    const minI = SPAWN_INTERVAL_MIN_MS + (SPAWN_INTERVAL_MIN_FINAL_MS - SPAWN_INTERVAL_MIN_MS) * t;
    const maxI = SPAWN_INTERVAL_MAX_MS + (SPAWN_INTERVAL_MIN_FINAL_MS * 1.5 - SPAWN_INTERVAL_MAX_MS) * t;
    nextSpawnDelayMs = minI + Math.random() * (maxI - minI);
    const nw = w * NOREN_WIDTH_RATIO;
    const maxH = h * NOREN_MAX_HEIGHT_RATIO;
    const halfG = NOREN_GROWTH_VARY / 2;
    function addOne() {
      const type = Math.random() < 0.75 ? 'red' : 'black';
      norenList.push({
        id: ++norenId,
        x: Math.random() * (w - nw),
        y: 0,
        width: nw,
        maxHeight: maxH,
        currentHeight: 0,
        type,
        growthMult: 1 + (Math.random() * NOREN_GROWTH_VARY - halfG),
      });
    }
    addOne();
    if (t > 0.4 && Math.random() < 0.35) addOne();
  }

  function lineRectHit(x1, y1, x2, y2, rx, ry, rw, rh) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.ceil(len / 8);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      if (px >= rx && px <= rx + rw && py >= ry && py <= ry + rh) return true;
    }
    return false;
  }

  function showPopup(text, x, y, isBad) {
    const el = document.createElement('div');
    el.className = 'popup-score' + (isBad ? ' popup-bad' : '');
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.fontSize = Math.min(48, 24 + text.length * 2) + 'px';
    popupContainer.appendChild(el);
    requestAnimationFrame(() => { el.style.left = (x - el.offsetWidth / 2) + 'px'; });
    setTimeout(() => el.remove(), isBad ? 800 : 1000);
  }

  function getEventPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function getEventPointSingle(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;
    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function onPointerStart(e) {
    e.preventDefault();
    e.stopPropagation();
    if (gameState !== 'playing') return;
    swipeStart = getEventPoint(e);
  }

  function onPointerEnd(e) {
    e.preventDefault();
    e.stopPropagation();
    if (gameState !== 'playing' || !swipeStart) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    let end = getEventPointSingle(e);
    let dx = end.x - swipeStart.x;
    let dy = end.y - swipeStart.y;
    const dist = Math.hypot(dx, dy);
    if (dist < SWIPE_THRESHOLD) {
      end = { x: swipeStart.x, y: Math.min(h, swipeStart.y + TAP_SLASH_LENGTH) };
      dx = 0;
      dy = TAP_SLASH_LENGTH;
    }
    if (Math.hypot(dx, dy) < SWIPE_THRESHOLD) {
      swipeStart = null;
      return;
    }
    const hitList = [];
    for (let i = norenList.length - 1; i >= 0; i--) {
      const n = norenList[i];
      const rh = n.currentHeight || n.maxHeight;
      if (lineRectHit(swipeStart.x, swipeStart.y, end.x, end.y, n.x, 0, n.width, rh)) {
        hitList.push({ index: i, noren: n });
      }
    }
    const midX = (swipeStart.x + end.x) / 2;
    const midY = (swipeStart.y + end.y) / 2;
    const rect = canvas.getBoundingClientRect();
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;
    const popupX = midX / scaleX;
    const popupY = midY / scaleY;
    slashEffects.push({ x1: swipeStart.x, y1: swipeStart.y, x2: end.x, y2: end.y, birthTime: Date.now() });
    if (hitList.length > 0) {
      const hit = hitList[0];
      const n = hit.noren;
      if (n.type === 'red') {
        const add = getScorePerNoren();
        score += add;
        combo++;
        specialMeter = Math.min(1, specialMeter + SPECIAL_GAUGE_PER_RED_CUT);
        playSlash(combo);
        playExplosion(1 + combo * 0.015);
        spawnScatterBillsFromCut(w, h, midX, midY, SCATTER_ON_CUT_RED);
        showPopup('+' + formatJapaneseYen(add), popupX, popupY, false);
      } else {
        combo = 0;
        playBadCut();
        showPopup('コンボリセット！', popupX, popupY, true);
      }
      norenList.splice(hit.index, 1);
    }
    swipeStart = null;
  }

  function drawNoren(n) {
    const x = n.x;
    const y = n.y;
    const w = n.width;
    const h = n.currentHeight;
    if (h <= 0) return;
    const isRed = n.type === 'red';
    const waveA = w * 0.03;
    const waveF = (Math.PI * 2) / (w * 0.4);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    for (let px = x + w; px >= x; px -= 6) {
      const wave = Math.sin(px * waveF + (n.id * 0.5)) * waveA;
      ctx.lineTo(px, y + h + wave);
    }
    ctx.closePath();
    ctx.clip();
    const stripeW = w / NOREN_STRIPES;
    if (isRed) {
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, '#5a1010');
      grad.addColorStop(0.3, '#8b2020');
      grad.addColorStop(0.7, '#a82828');
      grad.addColorStop(1, '#6b1818');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y - 2, w, h + waveA * 2 + 2);
      ctx.strokeStyle = 'rgba(255,200,180,0.35)';
      ctx.lineWidth = Math.max(1, w / 80);
      for (let i = 1; i < NOREN_STRIPES; i++) {
        const sx = x + i * stripeW;
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.lineTo(sx, y + h + waveA);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      for (let px = x + w; px >= x; px -= 6) {
        ctx.lineTo(px, y + h + Math.sin(px * waveF + (n.id * 0.5)) * waveA);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, '#0a0a0a');
      grad.addColorStop(0.4, '#1a1a1a');
      grad.addColorStop(0.7, '#252525');
      grad.addColorStop(1, '#0f0f0f');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y - 2, w, h + waveA * 2 + 2);
      ctx.strokeStyle = 'rgba(120,120,120,0.3)';
      ctx.lineWidth = Math.max(1, w / 80);
      for (let i = 1; i < NOREN_STRIPES; i++) {
        const sx = x + i * stripeW;
        ctx.beginPath();
        ctx.moveTo(sx, y);
        ctx.lineTo(sx, y + h + waveA);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      for (let px = x + w; px >= x; px -= 6) {
        ctx.lineTo(px, y + h + Math.sin(px * waveF + (n.id * 0.5)) * waveA);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDeadline(w, h) {
    const y = h * DEADLINE_RATIO;
    ctx.save();
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 80, 80, 0.9)';
    ctx.font = 'bold 14px "Noto Sans JP", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('デッドライン — ここまで伸びたらアウト', w / 2, y - 10);
    ctx.restore();
  }

  function drawDangerFlash(w, h, dangerRatio, nowMs) {
    const pulse = 0.4 + 0.35 * Math.sin(nowMs * DEADLINE_FLASH_SPEED) * dangerRatio;
    ctx.save();
    ctx.fillStyle = 'rgba(180, 0, 0, ' + (pulse * dangerRatio) + ')';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function render() {
    const dpr = window.devicePixelRatio || 1;
    let w = canvas.width / dpr;
    let h = canvas.height / dpr;
    if (w <= 0 || h <= 0) {
      resizeCanvas();
      w = canvas.width / dpr;
      h = canvas.height / dpr;
      if (w <= 0 || h <= 0) {
        w = Math.max(1, window.innerWidth);
        h = Math.max(1, window.innerHeight);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
        if (floatBills.length === 0) initFloatBills(w, h);
      }
    }
    if (gameState !== 'playing' && gameState !== 'gameover') return;
    if (!ctx) {
      requestAnimationFrame(render);
      return;
    }
    w = Math.max(1, w);
    h = Math.max(1, h);
    if (bgImage && bgImage.complete && bgImage.naturalWidth) {
      ctx.drawImage(bgImage, 0, 0, w, h);
    } else if (bgImageFallback && bgImageFallback.complete && bgImageFallback.naturalWidth) {
      ctx.drawImage(bgImageFallback, 0, 0, w, h);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1a0f0a');
      grad.addColorStop(1, '#0d0505');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    updateFloatBills(w, h);
    updateScatterBills(w, h);
    floatBills.forEach(function (b) { drawBill(b, false); });
    scatterBills.forEach(function (b) { drawBill(b, true); });
    const nowMs = Date.now();
    for (let i = slashEffects.length - 1; i >= 0; i--) {
      const s = slashEffects[i];
      const age = nowMs - s.birthTime;
      if (age >= SLASH_EFFECT_DURATION_MS) {
        slashEffects.splice(i, 1);
        continue;
      }
      const t = 1 - age / SLASH_EFFECT_DURATION_MS;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = '#ffdd88';
      ctx.lineWidth = 4 + (1 - t) * 8;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    if (gameState === 'gameover') {
      showGameover();
      return;
    }
    const now = Date.now();
    const elapsed = now - gameStartTime;
    const growthAccel = 1 + Math.min(1.8, elapsed / NOREN_GROWTH_ACCEL_MS);
    const baseGrowth = h * NOREN_GROWTH_PER_FRAME * growthAccel;
    let closestBottom = 0;
    for (let i = norenList.length - 1; i >= 0; i--) {
      const n = norenList[i];
      const growth = baseGrowth * (n.growthMult ?? 1);
      n.currentHeight = Math.min(n.currentHeight + growth, n.maxHeight);
      const bottom = n.currentHeight;
      if (bottom > closestBottom) closestBottom = bottom;
      const deadlineY = h * DEADLINE_RATIO;
      if (bottom >= deadlineY) {
        if (n.type === 'red') {
          deficit++;
          spawnScatterBills(w, h, SCATTER_ON_MISS, true);
          if (deficit >= DEFICIT_MAX) {
            spawnScatterBills(w, h, SCATTER_ON_GAMEOVER, true);
            if (specialBtn) specialBtn.classList.add('hidden');
            gameState = 'gameover';
          } else {
            deficitFill.style.width = (deficit / DEFICIT_MAX * 100) + '%';
          }
        }
        norenList.splice(i, 1);
        continue;
      }
      drawNoren(n);
    }
    if (specialActiveUntil > 0 && now < specialActiveUntil) {
      const base = getBasePricePerNoren();
      norenList.forEach(function (n) {
        if (n.type === 'red') {
          const cutX = w * (0.2 + 0.6 * Math.random());
          const cutY = h * (0.3 + 0.4 * Math.random());
          const len = Math.min(w, h) * (0.42 + 0.38 * Math.random());
          const angle = (Math.random() - 0.5) * Math.PI * 0.5;
          slashEffects.push({
            x1: cutX - Math.cos(angle) * len,
            y1: cutY + Math.sin(angle) * len,
            x2: cutX + Math.cos(angle) * len,
            y2: cutY - Math.sin(angle) * len,
            birthTime: Date.now()
          });
          playSlash(1);
          playExplosion(1);
          score += base * SPECIAL_AUTO_CUT_MULT;
        }
      });
      norenList = [];
    }
    if (specialActiveUntil > 0 && now >= specialActiveUntil) specialActiveUntil = 0;
    drawDeadline(w, h);
    const deadlineY = h * DEADLINE_RATIO;
    const dangerRange = deadlineY - h * DEADLINE_DANGER_START;
    const dangerRatio = closestBottom >= h * DEADLINE_DANGER_START
      ? Math.min(1, (closestBottom - h * DEADLINE_DANGER_START) / dangerRange)
      : 0;
    if (dangerRatio > 0) {
      specialMeter = Math.min(1, specialMeter + SPECIAL_GAUGE_PINCH_PER_FRAME);
      drawDangerFlash(w, h, dangerRatio, nowMs);
    }
    if (specialFill) specialFill.style.width = (specialMeter * 100) + '%';
    if (specialBtn) {
      if (specialMeter >= 1) {
        specialBtn.classList.remove('hidden');
      } else {
        specialBtn.classList.add('hidden');
      }
    }
    scoreEl.textContent = formatJapaneseYen(score);
    scoreEl.style.transform = 'scale(' + getScoreFontScale(scoreEl.textContent) + ')';
    scoreEl.style.transformOrigin = 'left top';
    comboEl.textContent = combo;
    deficitFill.style.width = (deficit / DEFICIT_MAX * 100) + '%';
    const spawnInterval = (specialActiveUntil > 0 && now < specialActiveUntil) ? nextSpawnDelayMs / SPECIAL_SPAWN_DIVIDER : nextSpawnDelayMs;
    if (now - lastSpawnTime > spawnInterval) {
      lastSpawnTime = now;
      spawnNoren();
    }
    if (specialActiveUntil > 0 && now < specialActiveUntil) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      for (let i = 0; i < slashEffects.length; i++) {
        const s = slashEffects[i];
        const age = nowMs - s.birthTime;
        if (age >= SLASH_EFFECT_DURATION_MS) continue;
        const t = 1 - age / SLASH_EFFECT_DURATION_MS;
        ctx.save();
        ctx.globalAlpha = t;
        ctx.strokeStyle = '#ffdd88';
        ctx.lineWidth = 6 + (1 - t) * 12;
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      ctx.save();
      const sz = Math.min(w, h) * 0.52;
      const logoX = (w - sz) / 2;
      const logoY = (h - sz) / 2;
      if (specialImage && specialImage.complete && specialImage.naturalWidth) {
        ctx.shadowColor = 'rgba(255, 220, 80, 0.95)';
        ctx.shadowBlur = 35 + 12 * Math.sin(now * 0.005);
        ctx.globalAlpha = 0.95 + 0.05 * Math.sin(now * 0.006);
        ctx.drawImage(specialImage, logoX, logoY, sz, sz);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      } else {
        ctx.shadowColor = 'rgba(255, 220, 80, 0.9)';
        ctx.shadowBlur = 30;
        ctx.fillStyle = 'rgba(255, 230, 100, ' + (0.9 + 0.1 * Math.sin(now * 0.008)) + ')';
        ctx.font = '900 ' + Math.floor(Math.min(w, h) * 0.14) + 'px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('鬼十速斬', w / 2, h / 2);
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
    animationId = requestAnimationFrame(render);
  }

  function getRanking() {
    try {
      const raw = localStorage.getItem(RANKING_KEY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveToRanking(name, scoreBigInt) {
    const nameTrim = String(name).trim().slice(0, 5) || '名無し';
    const scoreStr = scoreBigInt.toString();
    const list = getRanking();
    list.push({ name: nameTrim, score: scoreStr, date: Date.now() });
    list.sort((a, b) => {
      const sa = BigInt(a.score);
      const sb = BigInt(b.score);
      return sa > sb ? -1 : sa < sb ? 1 : 0;
    });
    const top = list.slice(0, RANKING_MAX);
    try {
      localStorage.setItem(RANKING_KEY, JSON.stringify(top));
    } catch (e) {}
    return top;
  }

  function renderRankingList(el) {
    const list = getRanking();
    if (!el) return;
    el.innerHTML = '';
    if (list.length === 0) {
      el.innerHTML = '<li class="ranking-empty">まだ記録がありません</li>';
      return;
    }
    list.forEach((entry, i) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="rank">' + (i + 1) + '</span><span class="name">' + escapeHtml(entry.name) + '</span><span class="score">' + formatJapaneseYen(BigInt(entry.score)) + '</span>';
      el.appendChild(li);
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function showGameover() {
    cancelAnimationFrame(animationId);
    if (specialBtn) specialBtn.classList.add('hidden');
    gameoverOverlay.classList.remove('hidden');
    finalScoreEl.textContent = formatJapaneseYen(score);
    finalScoreEl.style.transform = 'scale(' + Math.min(getScoreFontScale(finalScoreEl.textContent), 1.8) + ')';
    finalScoreEl.style.transformOrigin = 'center center';
    shareArea.classList.remove('copied');
    if (recordNameInput) recordNameInput.value = '';
    if (recordMsg) {
      recordMsg.textContent = '';
      recordMsg.classList.add('hidden');
    }
  }

  function startGame() {
    gameState = 'playing';
    score = 0n;
    combo = 0;
    deficit = 0;
    gameStartTime = Date.now();
    lastSpawnTime = gameStartTime;
    nextSpawnDelayMs = SPAWN_INTERVAL_MIN_MS + Math.random() * (SPAWN_INTERVAL_MAX_MS - SPAWN_INTERVAL_MIN_MS);
    norenList = [];
    scatterBills = [];
    slashEffects = [];
    specialMeter = 0;
    specialActiveUntil = 0;
    if (specialBtn) specialBtn.classList.add('hidden');
    if (specialFill) specialFill.style.width = '0%';
    deficitFill.style.width = '0%';
    titleScreen.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initAudio();
    playBGM();
    resizeCanvas();
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.floor(window.innerWidth));
    const ch = Math.max(1, Math.floor(window.innerHeight));
    if (floatBills.length === 0) initFloatBills(cw, ch);
    requestAnimationFrame(render);
  }

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    var w, h;
    if (gameScreen && !gameScreen.classList.contains('hidden')) {
      w = window.innerWidth;
      h = window.innerHeight;
    } else {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      if (w <= 0 || h <= 0) {
        w = window.innerWidth;
        h = window.innerHeight;
      }
    }
    w = Math.max(1, Math.floor(w));
    h = Math.max(1, Math.floor(h));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }

  function getShareText() {
    return '【決算報告】私の損切り総額は ' + formatJapaneseYen(score) + ' でした。 #THE_NOREN_GIRI';
  }

  function copyShareAndShow() {
    const text = getShareText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        shareArea.classList.add('copied');
        setTimeout(() => shareArea.classList.remove('copied'), 3000);
      }).catch(() => fallbackShare(text));
    } else {
      fallbackShare(text);
    }
  }

  function fallbackShare(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      shareArea.classList.add('copied');
      setTimeout(() => shareArea.classList.remove('copied'), 3000);
    } catch (e) {}
    document.body.removeChild(ta);
  }

  function doShare() {
    const text = getShareText();
    if (navigator.share) {
      navigator.share({ title: 'THE NOREN GIRI', text }).then(() => {
        shareArea.classList.add('copied');
        setTimeout(() => shareArea.classList.remove('copied'), 3000);
      }).catch(() => copyShareAndShow());
    } else {
      copyShareAndShow();
    }
  }

  startBtn.addEventListener('click', () => {
    if (imagesLoaded) startGame();
    else loadImages(startGame);
  });
  retryBtn.addEventListener('click', () => {
    gameoverOverlay.classList.add('hidden');
    gameScreen.classList.add('hidden');
    titleScreen.classList.remove('hidden');
  });
  if (recordBtn && recordNameInput && recordMsg) {
    recordBtn.addEventListener('click', () => {
      const name = recordNameInput.value.trim().slice(0, 5) || '名無し';
      saveToRanking(name, score);
      recordMsg.textContent = '記録しました！';
      recordMsg.classList.remove('hidden');
    });
  }
  if (rankingBtn && rankingOverlay) {
    rankingBtn.addEventListener('click', () => {
      rankingOverlay.classList.remove('hidden');
      renderRankingList(rankingListEl);
    });
  }
  if (rankingCloseBtn && rankingOverlay) {
    rankingCloseBtn.addEventListener('click', () => {
      rankingOverlay.classList.add('hidden');
    });
  }
  if (specialBtn) {
    specialBtn.addEventListener('click', () => {
      if (gameState !== 'playing' || specialMeter < 1) return;
      specialMeter = 0;
      specialActiveUntil = Date.now() + SPECIAL_AUTO_CUT_DURATION_MS;
      playSpecial();
      if (specialBtn) specialBtn.classList.add('hidden');
    });
  }
  shareBtn.addEventListener('click', doShare);
  canvas.addEventListener('touchstart', onPointerStart, { passive: false });
  canvas.addEventListener('touchend', onPointerEnd, { passive: false });
  canvas.addEventListener('mousedown', onPointerStart, false);
  canvas.addEventListener('mouseup', onPointerEnd, false);
  canvas.addEventListener('mouseleave', () => { swipeStart = null; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); }, false);
  window.addEventListener('resize', () => {
    if (gameState === 'playing') resizeCanvas();
  });

  loadImages();
  resizeCanvas();
})();
