/* ================================================================
   ChromaHarmony — script.js
   Author: Senior Frontend Engineer
   Sections:
     1. Color Conversion Utilities
     2. WCAG Luminance & Contrast
     3. Color Harmony Algorithms
     4. Canvas Color Wheel
     5. Module 1 — Palette Generator
     6. Module 2 — Contrast Checker
     7. Smart Harmonic Recommender
     8. Initialization & Event Wiring
   ================================================================ */

'use strict';

/* ================================================================
   SECTION 1 — COLOR CONVERSION UTILITIES
   ================================================================ */

/**
 * Clamps a number between min and max (inclusive).
 */
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Convert HEX string (with or without #) to { r, g, b } (0–255).
 * Returns null if invalid.
 */
function hexToRgb(hex) {
  hex = hex.replace(/^#/, '').trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

/**
 * Convert { r, g, b } (0–255) to uppercase 6-char HEX string.
 */
function rgbToHex({ r, g, b }) {
  return [r, g, b]
    .map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Convert { r, g, b } (0–255) to { h: 0-360, s: 0-100, l: 0-100 }.
 */
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Convert { h: 0-360, s: 0-100, l: 0-100 } to { r, g, b } (0–255).
 */
function hslToRgb({ h, s, l }) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255)
  };
}

/**
 * Convenience: { h, s, l } → HEX string.
 */
function hslToHex(hsl) {
  return rgbToHex(hslToRgb(hsl));
}

/**
 * Convenience: HEX → { h, s, l }.
 */
function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb);
}

/* ================================================================
   SECTION 2 — WCAG LUMINANCE & CONTRAST
   ================================================================ */

/**
 * Compute relative luminance (WCAG 2.x) from an sRGB component (0–255).
 * Returns a value in [0, 1].
 */
function sRGBtoLinear(c) {
  const val = c / 255;
  return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance of an RGB color (0–255 each).
 * Returns a value in [0, 1].
 */
function relativeLuminance({ r, g, b }) {
  return 0.2126 * sRGBtoLinear(r)
       + 0.7152 * sRGBtoLinear(g)
       + 0.0722 * sRGBtoLinear(b);
}

/**
 * WCAG contrast ratio between two RGB colors.
 * Returns a value in [1, 21].
 */
function contrastRatio(rgb1, rgb2) {
  const L1 = relativeLuminance(rgb1);
  const L2 = relativeLuminance(rgb2);
  const lighter = Math.max(L1, L2);
  const darker  = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns the WCAG conformance level string given a contrast ratio.
 * @param {number} ratio
 * @returns {{ label: string, cssClass: string }}
 */
function wcagLevel(ratio) {
  if (ratio >= 7)   return { label: 'AAA Pass',       cssClass: 'badge-aaa'  };
  if (ratio >= 4.5) return { label: 'AA Pass',        cssClass: 'badge-aa'   };
  if (ratio >= 3)   return { label: 'AA Large Only',  cssClass: 'badge-aalg' };
  return               { label: 'Fail — Low Contrast', cssClass: 'badge-fail' };
}

/**
 * Choose #FFFFFF or #0F172A as overlay text on a colored swatch,
 * based on relative luminance, for maximum readability.
 * @param {string} hex
 * @returns {string} hex color string (with #)
 */
function autoTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#0F172A';
  const L = relativeLuminance(rgb);
  // WCAG: use white if the background is dark, dark if light
  return L > 0.179 ? '#0F172A' : '#FFFFFF';
}

/* ================================================================
   SECTION 3 — COLOR HARMONY ALGORITHMS
   ================================================================ */

/**
 * Generate 5 palette entries (as HEX strings) from a base HSL
 * according to the chosen harmony rule.
 *
 * @param {{ h:number, s:number, l:number }} base  — the base color in HSL
 * @param {string} mode  — 'complementary'|'analogous'|'triadic'|'split-complementary'|'monochromatic'
 * @returns {string[]} array of 5 HEX strings (base color is always index 0)
 */
function generateHarmony(base, mode) {
  const { h, s, l } = base;

  // Normalise any angle value into [0, 360)
  const hue = v => ((v % 360) + 360) % 360;

  let hues;

  switch (mode) {

    // ── Complementary ────────────────────────────────────────────
    // Core: H  and  H + 180°
    // Fill the remaining 3 slots with lightness/saturation variants
    // so the palette reads as a coherent two-pole colour story.
    case 'complementary':
      hues = [
        { h: hue(h),       s,                           l },
        { h: hue(h),       s: clamp(s - 15, 10, 100),  l: clamp(l + 18, 10, 90) },
        { h: hue(h + 180), s,                           l },
        { h: hue(h + 180), s: clamp(s - 15, 10, 100),  l: clamp(l + 18, 10, 90) },
        { h: hue(h + 180), s: clamp(s + 10, 10, 100),  l: clamp(l - 18, 10, 90) }
      ];
      break;

    // ── Analogous ────────────────────────────────────────────────
    // 5 hues in a 120° arc, each step = 30°
    // Order: H-60°, H-30°, H (base), H+30°, H+60°
    case 'analogous':
      hues = [
        { h: hue(h - 60), s, l },
        { h: hue(h - 30), s, l },
        { h: hue(h),      s, l },
        { h: hue(h + 30), s, l },
        { h: hue(h + 60), s, l }
      ];
      break;

    // ── Triadic ──────────────────────────────────────────────────
    // 3 equidistant hues: H, H+120°, H+240°
    // Fill 5 columns: base, base-tint, triad-2, triad-3, triad-3-tint
    case 'triadic':
      hues = [
        { h: hue(h),       s,                           l },
        { h: hue(h),       s: clamp(s - 20, 10, 100),  l: clamp(l + 22, 10, 90) },
        { h: hue(h + 120), s,                           l },
        { h: hue(h + 240), s,                           l },
        { h: hue(h + 240), s: clamp(s - 20, 10, 100),  l: clamp(l + 22, 10, 90) }
      ];
      break;

    // ── Split-Complementary ──────────────────────────────────────
    // Core: H, H+150°, H+210°  (flank the complement)
    // Fill remaining 2 with variants of base and the first split
    case 'split-complementary':
      hues = [
        { h: hue(h),       s,                           l },
        { h: hue(h),       s: clamp(s - 20, 10, 100),  l: clamp(l + 22, 10, 90) },
        { h: hue(h + 150), s,                           l },
        { h: hue(h + 210), s,                           l },
        { h: hue(h + 150), s: clamp(s - 15, 10, 100),  l: clamp(l - 15, 10, 90) }
      ];
      break;

    // ── Monochromatic ────────────────────────────────────────────
    // Same hue H across all 5; vary only Saturation and Lightness
    // from darkest (low L, high S) to lightest (high L, low S)
    case 'monochromatic':
    default:
      hues = [
        { h, s: clamp(s + 10, 10, 100), l: clamp(l - 30, 5, 95) },
        { h, s: clamp(s +  5, 10, 100), l: clamp(l - 15, 5, 95) },
        { h, s,                          l                        },
        { h, s: clamp(s - 10, 10, 100), l: clamp(l + 15, 5, 95) },
        { h, s: clamp(s - 20, 10, 100), l: clamp(l + 30, 5, 95) }
      ];
      break;
  }

  return hues.map(hslToHex);
}

/* ================================================================
   SECTION 4 — CANVAS COLOR WHEEL
   ================================================================ */

const wheelCanvas = document.getElementById('color-wheel');
const wheelCtx    = wheelCanvas.getContext('2d');

// Cache the raw spectrum pixels so we can redraw the overlay cheaply
// without re-computing every pixel each time.
let wheelSpectrumCache = null;

/**
 * Draw just the HSL spectrum ring into an ImageData and cache it.
 * Call once at boot; subsequent redraws restore from cache.
 */
function buildWheelSpectrum() {
  const { width, height } = wheelCanvas;
  const cx = width / 2, cy = height / 2;
  const radius = Math.min(cx, cy);
  const imageData = wheelCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      const angle = Math.atan2(dy, dx);
      const hue   = ((angle * 180 / Math.PI) + 360) % 360;
      const sat   = Math.round((dist / radius) * 100);
      const { r, g, b } = hslToRgb({ h: hue, s: sat, l: 50 });
      const idx = (y * width + x) * 4;
      imageData.data[idx]     = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = 255;
    }
  }
  wheelSpectrumCache = imageData;
}

/**
 * Convert (h degrees, s 0-100) to canvas pixel coordinates.
 */
function hslToWheelXY(h, s) {
  const { width, height } = wheelCanvas;
  const cx = width / 2, cy = height / 2;
  const radius = Math.min(cx, cy);
  const angle  = h * Math.PI / 180;
  const dist   = (s / 100) * radius;
  return {
    x: cx + Math.cos(angle) * dist,
    y: cy + Math.sin(angle) * dist
  };
}

/**
 * Draw (or redraw) the wheel: restore spectrum from cache, then paint
 * the harmony overlay — connecting lines and marker dots — on top.
 *
 * paletteHsl: array of { h, s } objects for each active palette slot
 *             (index 0 is always the base color)
 */
function drawColorWheel(paletteHsl) {
  if (!wheelSpectrumCache) buildWheelSpectrum();
  wheelCtx.putImageData(wheelSpectrumCache, 0, 0);

  if (!paletteHsl || paletteHsl.length === 0) return;

  const { width, height } = wheelCanvas;
  const cx = width / 2, cy = height / 2;

  // Build pixel positions for every slot
  const pts = paletteHsl.map(({ h, s }) => hslToWheelXY(h, s));

  // ── Connecting Lines ──────────────────────────────────────────
  // Draw lines from center to every marker (spokes), then link
  // markers to each other where the harmony rule implies a shape.
  wheelCtx.save();
  wheelCtx.strokeStyle = 'rgba(255,255,255,0.85)';
  wheelCtx.lineWidth   = 1.5;
  wheelCtx.setLineDash([]);

  // Spokes: center → each marker
  pts.forEach(pt => {
    wheelCtx.beginPath();
    wheelCtx.moveTo(cx, cy);
    wheelCtx.lineTo(pt.x, pt.y);
    wheelCtx.stroke();
  });

  // Peripheral ring: connect markers in order (closes the shape)
  if (pts.length > 1) {
    wheelCtx.beginPath();
    pts.forEach((pt, i) => {
      if (i === 0) wheelCtx.moveTo(pt.x, pt.y);
      else         wheelCtx.lineTo(pt.x, pt.y);
    });
    wheelCtx.closePath();
    wheelCtx.stroke();
  }
  wheelCtx.restore();

  // ── Marker Dots ───────────────────────────────────────────────
  pts.forEach((pt, i) => {
    const isBase = (i === 0);
    const outerR = isBase ? 9 : 7;
    const innerR = isBase ? 5 : 3.5;

    // Shadow ring
    wheelCtx.save();
    wheelCtx.shadowColor   = 'rgba(0,0,0,0.45)';
    wheelCtx.shadowBlur    = 6;
    wheelCtx.shadowOffsetX = 0;
    wheelCtx.shadowOffsetY = 2;

    // White outer circle
    wheelCtx.beginPath();
    wheelCtx.arc(pt.x, pt.y, outerR, 0, Math.PI * 2);
    wheelCtx.fillStyle = '#FFFFFF';
    wheelCtx.fill();
    wheelCtx.restore();

    // Coloured inner dot (actual swatch hue at L=50)
    const col = hslToRgb({ h: paletteHsl[i].h, s: paletteHsl[i].s, l: 50 });
    wheelCtx.beginPath();
    wheelCtx.arc(pt.x, pt.y, innerR, 0, Math.PI * 2);
    wheelCtx.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
    wheelCtx.fill();
  });
}

/* ================================================================
   SECTION 5 — MODULE 1: PALETTE GENERATOR
   ================================================================ */

// ── State ────────────────────────────────────────────────────────
const paletteState = {
  baseHsl:  { h: 220, s: 75, l: 50 },
  locks:    [false, false, false, false, false],
  colors:   ['', '', '', '', ''],   // current HEX values
};

/**
 * Entry point: redraw spectrum + overlay using current palette state.
 * Must be defined after paletteState so the const reference is valid.
 */
function redrawWheel() {
  const { h, s } = paletteState.baseHsl;
  const mode = document.querySelector('input[name="harmony"]:checked')
    ? document.querySelector('input[name="harmony"]:checked').value
    : 'complementary';

  // Derive HSL entries for each palette slot (we only need h,s for positions)
  const generated = generateHarmony(paletteState.baseHsl, mode);
  const paletteHsl = generated.map(hex => {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHsl(rgb) : { h, s };
  });

  drawColorWheel(paletteHsl);
}

// ── DOM Refs ─────────────────────────────────────────────────────
const baseHexInput  = document.getElementById('base-hex-input');
const sliderSat     = document.getElementById('slider-sat');
const sliderLig     = document.getElementById('slider-lig');
const satVal        = document.getElementById('sat-val');
const ligVal        = document.getElementById('lig-val');
const basePreview   = document.getElementById('base-preview');
const baseColorMeta = document.getElementById('base-color-meta');
const paletteStrip  = document.getElementById('palette-strip');
const btnGenerate   = document.getElementById('btn-generate');

/** Update the base color preview and all displays from paletteState.baseHsl */
function syncBaseColorUI() {
  const { h, s, l } = paletteState.baseHsl;
  const hex = hslToHex({ h, s, l });
  const rgb = hslToRgb({ h, s, l });

  basePreview.style.backgroundColor = `#${hex}`;
  baseHexInput.value = hex;
  baseColorMeta.textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})  •  hsl(${h}, ${s}%, ${l}%)`;
  sliderSat.value = s;
  sliderLig.value = l;
  satVal.textContent = `${s}%`;
  ligVal.textContent = `${l}%`;
  // Wheel overlay is refreshed by renderPalette / redrawWheel
}

/** Build / refresh the 5-column palette strip. */
function renderPalette() {
  const { h, s, l } = paletteState.baseHsl;
  const mode = document.querySelector('input[name="harmony"]:checked').value;
  const generated = generateHarmony({ h, s, l }, mode);

  // Respect locks
  generated.forEach((hex, i) => {
    if (!paletteState.locks[i]) {
      paletteState.colors[i] = hex;
    }
  });

  // SVG icons — defined once, reused per column
  const SVG_LOCKED = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const SVG_UNLOCKED = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;

  paletteStrip.innerHTML = '';
  paletteState.colors.forEach((hex, i) => {
    const textColor = autoTextColor(hex);
    const rgb = hexToRgb(hex);
    const rgbStr = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '';
    const isLocked = paletteState.locks[i];

    const col = document.createElement('div');
    // Apply 'locked' class to the whole column card when locked
    col.className = `palette-col${isLocked ? ' locked' : ''}`;
    col.setAttribute('role', 'listitem');
    col.innerHTML = `
      <div class="palette-swatch" style="background:#${hex}; position:relative;">
        <span class="swatch-hex-label" style="color:${textColor}" aria-hidden="true">#${hex}</span>
      </div>
      <button class="lock-btn${isLocked ? ' locked' : ''}"
        aria-label="${isLocked ? 'Klik untuk membuka kunci warna ini' : 'Klik untuk mengunci warna ini'}"
        title="${isLocked ? 'Klik untuk membuka kunci warna ini' : 'Klik untuk mengunci warna ini'}"
        data-index="${i}">
        <span class="lock-icon">${isLocked ? SVG_LOCKED : SVG_UNLOCKED}</span>
        ${isLocked ? '<span class="lock-badge" aria-label="Locked">LOCKED</span>' : ''}
      </button>
      <div class="palette-info">
        <div class="palette-hex">#${hex}</div>
        <div class="palette-rgb">${rgbStr}</div>
        <div class="palette-actions">
          <button class="btn btn-ghost btn-sm copy-hex-btn" data-hex="${hex}" aria-label="Copy HEX #${hex}">Copy</button>
          <button class="btn btn-ghost btn-sm use-bg-btn"  data-hex="${hex}" aria-label="Use #${hex} as background">BG</button>
          <button class="btn btn-ghost btn-sm use-txt-btn" data-hex="${hex}" aria-label="Use #${hex} as text">Text</button>
        </div>
      </div>
    `;
    paletteStrip.appendChild(col);
  });

  // Attach per-column button listeners
  paletteStrip.querySelectorAll('.lock-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      paletteState.locks[idx] = !paletteState.locks[idx];
      // Brief scale-pop animation on the button before re-render
      e.currentTarget.classList.add('lock-pop');
      // Let the animation play one frame, then re-render
      requestAnimationFrame(() => renderPalette());
    });
  });

  paletteStrip.querySelectorAll('.copy-hex-btn').forEach(btn => {
    btn.addEventListener('click', () => copyToClipboard(`#${btn.dataset.hex}`, `Copied #${btn.dataset.hex}!`));
  });

  paletteStrip.querySelectorAll('.use-bg-btn').forEach(btn => {
    btn.addEventListener('click', () => setCheckerColor('bg', btn.dataset.hex));
  });

  paletteStrip.querySelectorAll('.use-txt-btn').forEach(btn => {
    btn.addEventListener('click', () => setCheckerColor('text', btn.dataset.hex));
  });
  // After DOM is updated, redraw the wheel overlay to reflect new colors
  redrawWheel();
}

/**
 * Generate button / Spacebar handler.
 * Picks a fresh random base hue (0–360) and saturation (60–95%),
 * keeps the current lightness, respects locked palette slots,
 * then re-renders the palette and wheel overlay.
 */
function generatePalette() {
  const newH = Math.floor(Math.random() * 360);
  const newS = Math.floor(Math.random() * 36) + 60; // 60–95
  paletteState.baseHsl = { h: newH, s: newS, l: paletteState.baseHsl.l };
  syncBaseColorUI();
  renderPalette(); // renderPalette now calls redrawWheel internally
}

/* ================================================================
   SECTION 6 — MODULE 2: CONTRAST CHECKER
   ================================================================ */

// ── State ────────────────────────────────────────────────────────
const checkerState = {
  bgHex:   '1E3A5F',
  textHex: 'F0F9FF',
};

// ── DOM Refs ─────────────────────────────────────────────────────
const bgColorPicker    = document.getElementById('bg-color-picker');
const bgHexInput       = document.getElementById('bg-hex-input');
const textColorPicker  = document.getElementById('text-color-picker');
const textHexInput     = document.getElementById('text-hex-input');
const contrastDisplay  = document.getElementById('contrast-ratio-display');
const contrastBadges   = document.getElementById('contrast-badges');
const liveCard         = document.getElementById('live-preview-card');
const previewHeading   = document.getElementById('preview-heading');
const previewBody      = document.getElementById('preview-body');
const previewCta       = document.getElementById('preview-cta');

/**
 * Fully update Module 2 UI:
 * — Live preview card colors
 * — Contrast ratio display & badges
 * — Smart recommender panel
 */
function updateChecker() {
  const bgRgb   = hexToRgb(checkerState.bgHex);
  const textRgb = hexToRgb(checkerState.textHex);

  if (!bgRgb || !textRgb) return;

  // ── Live Preview Card ──
  liveCard.style.backgroundColor = `#${checkerState.bgHex}`;
  liveCard.style.color            = `#${checkerState.textHex}`;
  previewHeading.style.color      = `#${checkerState.textHex}`;
  previewBody.style.color         = `#${checkerState.textHex}`;
  previewCta.style.color          = `#${checkerState.textHex}`;
  previewCta.style.borderColor    = `#${checkerState.textHex}`;

  // ── Sync pickers ──
  bgColorPicker.value   = `#${checkerState.bgHex}`;
  textColorPicker.value = `#${checkerState.textHex}`;
  bgHexInput.value      = checkerState.bgHex.toUpperCase();
  textHexInput.value    = checkerState.textHex.toUpperCase();

  // ── Contrast Ratio ──
  const ratio = contrastRatio(bgRgb, textRgb);
  contrastDisplay.textContent = `${ratio.toFixed(2)} : 1`;

  // ── Badges ──
  const levels = [
    { text: 'Normal Text  AA',     pass: ratio >= 4.5, cls: ratio >= 4.5 ? 'badge-aa' : 'badge-fail' },
    { text: 'Normal Text  AAA',    pass: ratio >= 7,   cls: ratio >= 7   ? 'badge-aaa' : 'badge-fail' },
    { text: 'Large Text  AA',      pass: ratio >= 3,   cls: ratio >= 3   ? 'badge-aa' : 'badge-fail'  },
    { text: 'Large Text  AAA',     pass: ratio >= 4.5, cls: ratio >= 4.5 ? 'badge-aaa': 'badge-fail'  },
    { text: 'UI Components  AA',   pass: ratio >= 3,   cls: ratio >= 3   ? 'badge-aa' : 'badge-fail'  },
  ];

  contrastBadges.innerHTML = levels.map(lv => `
    <div class="badge ${lv.cls}">
      <span>${lv.text}</span>
      <span>${lv.pass ? '✓ Pass' : '✗ Fail'}</span>
    </div>
  `).join('');

  // ── Smart Recommender ──
  updateRecommendations();
}

/**
 * Set a color in the checker (from palette buttons or input).
 * @param {'bg'|'text'} target
 * @param {string} hex  — 6-char uppercase HEX without #
 */
function setCheckerColor(target, hex) {
  hex = hex.replace(/^#/, '').toUpperCase();
  if (target === 'bg') {
    checkerState.bgHex = hex;
  } else {
    checkerState.textHex = hex;
  }
  updateChecker();
  showToast(`${target === 'bg' ? 'Background' : 'Text'} set to #${hex}`);
}

/* ================================================================
   SECTION 7 — SMART HARMONIC TEXT RECOMMENDER
   ================================================================ */

/**
 * Auto-Luminance Search Loop — AAA-first with mid-tone fallback.
 *
 * Strategy:
 *  1. Preserve the hue (H) of the candidate so harmonic identity is kept.
 *  2. Determine search direction from background luminance:
 *       L_bg ≤ 0.179  → dark bg  → search lightness 98 → 2  (find a light text)
 *       L_bg  > 0.179  → light bg → search lightness  2 → 98 (find a dark text)
 *  3. First pass: aim for 7.0 : 1 (AAA). Stop as soon as it's reached.
 *  4. If AAA is unreachable (mid-tone background), do a second full pass
 *     and keep the lightness value that achieved the highest ratio ≥ 4.5 : 1.
 *  5. Returns { hex, ratio, badge } or null if even AA is impossible.
 *
 * @param {{ h:number, s:number }} hsl   — hue + saturation of the harmonic candidate
 * @param {{ r:number, g:number, b:number }} bgRgb
 * @returns {{ hex: string, ratio: number, badge: string } | null}
 */
function adjustForContrast(hsl, bgRgb) {
  const bgLum = relativeLuminance(bgRgb);

  // Lightness search range: step in integer % increments for deterministic results
  const isDarkBg = bgLum <= 0.179;
  const steps = isDarkBg
    ? Array.from({ length: 97 }, (_, i) => 98 - i)   // 98 → 2  (try lightest first)
    : Array.from({ length: 97 }, (_, i) => 2  + i);  // 2  → 98 (try darkest first)

  // ── Pass 1: hunt for AAA (7.0 : 1) ────────────────────────────
  for (const l of steps) {
    const rgb   = hslToRgb({ h: hsl.h, s: hsl.s, l });
    const ratio = contrastRatio(bgRgb, rgb);
    if (ratio >= 7.0) {
      return { hex: rgbToHex(rgb), ratio, badge: 'AAA Pass' };
    }
  }

  // ── Pass 2: mid-tone fallback — best ratio ≥ AA (4.5 : 1) ─────
  // Scan the full range and record the lightness with the highest ratio.
  let best = { ratio: 0, hex: null };
  for (const l of steps) {
    const rgb   = hslToRgb({ h: hsl.h, s: hsl.s, l });
    const ratio = contrastRatio(bgRgb, rgb);
    if (ratio > best.ratio) {
      best = { ratio, hex: rgbToHex(rgb) };
    }
  }

  if (best.hex && best.ratio >= 4.5) {
    return { hex: best.hex, ratio: best.ratio, badge: 'AA Pass · Max Contrast' };
  }

  // Could not achieve even AA — return best available so the slot is never empty
  if (best.hex) {
    return { hex: best.hex, ratio: best.ratio, badge: 'AA Large Only' };
  }

  return null;
}

/**
 * Build 5 harmonic text recommendation cards based on the current background.
 * Candidates use the 5 required harmony relationships specified in the brief:
 *   Complementary (H+180°), Split-Compl Left (H+150°), Split-Compl Right (H+210°),
 *   Analogous (H+30°), Monochromatic (same H).
 */
function updateRecommendations() {
  const bgRgb = hexToRgb(checkerState.bgHex);
  if (!bgRgb) return;

  const bgHsl = rgbToHsl(bgRgb);
  const { h, s } = bgHsl;
  const hue = v => ((v % 360) + 360) % 360;

  // Five harmonic candidates — hue preserved, saturation from bg (clamped)
  const harmonyDefs = [
    { rule: 'Complementary',       angle: hue(h + 180) },
    { rule: 'Split-Compl. Left',   angle: hue(h + 150) },
    { rule: 'Split-Compl. Right',  angle: hue(h + 210) },
    { rule: 'Analogous (+30°)',    angle: hue(h +  30) },
    { rule: 'Monochromatic',       angle: hue(h)       },
  ];

  const grid = document.getElementById('recommendation-grid');
  grid.innerHTML = '';

  harmonyDefs.forEach(({ rule, angle }) => {
    // Keep saturation consistent with the background's vibrancy (min 25 so colour is visible)
    const candidateHsl = { h: angle, s: clamp(s, 25, 95) };
    const result = adjustForContrast(candidateHsl, bgRgb);
    if (!result) return;

    const { hex, ratio, badge } = result;

    // Choose badge CSS class based on achieved level
    const badgeCls = ratio >= 7.0   ? 'badge-aaa'
                   : ratio >= 4.5   ? 'badge-aa'
                   : ratio >= 3.0   ? 'badge-aalg'
                   :                  'badge-fail';

    const card = document.createElement('button');
    card.className = 'rec-card';
    card.setAttribute('aria-label',
      `Apply ${rule} text color #${hex} — ${ratio.toFixed(2)}:1 (${badge})`);
    card.innerHTML = `
      <div class="rec-swatch" style="background:#${hex};"></div>
      <div class="rec-info">
        <div class="rec-hex">#${hex}</div>
        <div class="rec-rule">${rule}</div>
      </div>
      <div class="rec-ratio-wrap">
        <div class="rec-ratio">${ratio.toFixed(2)} : 1</div>
        <div class="badge ${badgeCls}" style="font-size:0.65rem; padding:0.15rem 0.5rem; margin-top:2px;">${badge}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      setCheckerColor('text', hex);
      showToast(`Text color set to #${hex} (${rule}, ${ratio.toFixed(2)}:1)`);
    });
    grid.appendChild(card);
  });
}

/* ================================================================
   SECTION 8 — UTILITIES: TOAST & CLIPBOARD
   ================================================================ */

let toastTimer = null;

/** Show a temporary toast notification. */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

/** Copy text to clipboard; show a toast on success. */
function copyToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast(successMsg))
      .catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(successMsg);
  } catch (_) {
    showToast('Copy failed — please copy manually.');
  }
  document.body.removeChild(ta);
}

/* ================================================================
   SECTION 9 — EVENT WIRING & INITIALIZATION
   ================================================================ */

// ── Color Wheel Interaction ─────────────────────────────────────

function handleWheelPick(e) {
  const rect   = wheelCanvas.getBoundingClientRect();
  const scaleX = wheelCanvas.width  / rect.width;
  const scaleY = wheelCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top)  * scaleY;
  const cx = wheelCanvas.width / 2, cy = wheelCanvas.height / 2;
  const dx = x - cx, dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const radius = Math.min(cx, cy);

  if (dist > radius) return; // outside circle

  const angle = Math.atan2(dy, dx);
  const h = Math.round(((angle * 180 / Math.PI) + 360) % 360);
  const s = Math.round((dist / radius) * 100);

  paletteState.baseHsl.h = h;
  paletteState.baseHsl.s = clamp(s, 0, 100);
  syncBaseColorUI();
  renderPalette();
}

let wheelDragging = false;
wheelCanvas.addEventListener('mousedown', e => { wheelDragging = true; handleWheelPick(e); });
document.addEventListener('mousemove',   e => { if (wheelDragging) handleWheelPick(e); });
document.addEventListener('mouseup',     () => { wheelDragging = false; });

// Touch support for color wheel
wheelCanvas.addEventListener('touchstart', e => {
  wheelDragging = true;
  handleWheelPick(e.touches[0]);
  e.preventDefault();
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (wheelDragging) { handleWheelPick(e.touches[0]); e.preventDefault(); }
}, { passive: false });
document.addEventListener('touchend', () => { wheelDragging = false; });

// ── Saturation & Lightness Sliders ─────────────────────────────
sliderSat.addEventListener('input', () => {
  paletteState.baseHsl.s = parseInt(sliderSat.value, 10);
  satVal.textContent = `${sliderSat.value}%`;
  syncBaseColorUI();
  renderPalette();
});

sliderLig.addEventListener('input', () => {
  paletteState.baseHsl.l = parseInt(sliderLig.value, 10);
  ligVal.textContent = `${sliderLig.value}%`;
  syncBaseColorUI();
  renderPalette();
});

// ── Base HEX Input ──────────────────────────────────────────────
baseHexInput.addEventListener('input', () => {
  const val = baseHexInput.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
  baseHexInput.value = val.toUpperCase();
  if (val.length === 6) {
    const hsl = hexToHsl(val);
    if (hsl) {
      paletteState.baseHsl = hsl;
      syncBaseColorUI();
      renderPalette();
    }
  }
});

// ── Harmony Radio Change ────────────────────────────────────────
document.querySelectorAll('input[name="harmony"]').forEach(radio => {
  radio.addEventListener('change', () => renderPalette());
});

// ── Generate Button ─────────────────────────────────────────────
btnGenerate.addEventListener('click', generatePalette);

// ── Spacebar shortcut ───────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Skip if user is typing in an input
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    generatePalette();
  }
});

// ── Module 2 — Background Color Picker ─────────────────────────
bgColorPicker.addEventListener('input', () => {
  checkerState.bgHex = bgColorPicker.value.replace('#', '').toUpperCase();
  bgHexInput.value   = checkerState.bgHex;
  updateChecker();
});

bgHexInput.addEventListener('input', () => {
  const val = bgHexInput.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase();
  bgHexInput.value = val;
  if (val.length === 6 && hexToRgb(val)) {
    checkerState.bgHex = val;
    bgColorPicker.value = `#${val}`;
    updateChecker();
  }
});

// ── Module 2 — Text Color Picker ────────────────────────────────
textColorPicker.addEventListener('input', () => {
  checkerState.textHex = textColorPicker.value.replace('#', '').toUpperCase();
  textHexInput.value   = checkerState.textHex;
  updateChecker();
});

textHexInput.addEventListener('input', () => {
  const val = textHexInput.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase();
  textHexInput.value = val;
  if (val.length === 6 && hexToRgb(val)) {
    checkerState.textHex = val;
    textColorPicker.value = `#${val}`;
    updateChecker();
  }
});

// ── Boot ────────────────────────────────────────────────────────
(function init() {
  buildWheelSpectrum(); // pre-compute spectrum cache once
  syncBaseColorUI();
  renderPalette();      // calls redrawWheel() internally → draws overlay
  updateChecker();
})();
