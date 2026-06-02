/* =========================================================
   MORSE CODE DEVICE — script.js
   ========================================================= */
"use strict";

/* ---------- Morse maps ---------- */
const MORSE = {
  A:".-", B:"-...", C:"-.-.", D:"-..", E:".", F:"..-.",
  G:"--.", H:"....", I:"..", J:".---", K:"-.-", L:".-..",
  M:"--", N:"-.", O:"---", P:".--.", Q:"--.-", R:".-.",
  S:"...", T:"-", U:"..-", V:"...-", W:".--", X:"-..-",
  Y:"-.--", Z:"--..",
  "0":"-----", "1":".----", "2":"..---", "3":"...--", "4":"....-",
  "5":".....", "6":"-....", "7":"--...", "8":"---..", "9":"----.",
  ".":".-.-.-", ",":"--..--", "?":"..--..", "!":"-.-.--", "/":"-..-."
};
const FROM_MORSE = Object.fromEntries(Object.entries(MORSE).map(([k,v]) => [v,k]));
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const NUMBERS = "0123456789".split("");
const PUNCT   = [".",",","?","!","/"];

/* ---------- tree layout ----------
 *  1 — standard binary tree (letters) + chip rows for numbers/punct (default)
 *  2 — extended binary tree: numbers + punctuation also as LEDs (level 5/6)
 *  3 — letters only
 *  4 — compact "horizontal-spine" layout, letters only
 */

// Model 4 — compact mirrored layout on a column/row grid.
// ViewBox 1000 wide, antenna at x=500. dot spine extends LEFT, dash spine
// extends RIGHT (dot=left convention). Branches are drawn as right-angle
// (L-shaped) connectors. Fitted so the bottom row lands at the same height
// as the letters-only model, for seamless switching.
const M4_COL = 86;   // horizontal spacing per column step
const M4_ROW = 52;   // vertical spacing per row step
const M4_X   = 500;  // antenna x
const M4_TOP = 70;   // antenna y (matches defaultBinaryTreePos TOP_Y for seamless height)
const m4 = (col, row) => ({ x: M4_X + col * M4_COL, y: M4_TOP + row * M4_ROW });
const MODEL4_POSITIONS = {
  "":     m4(0, 0),   // antenna / root

  // top spine — DOT side (left), dash side (right)
  ".":    m4(-1, 0),  // E
  "..":   m4(-2, 0),  // I
  "...":  m4(-3, 0),  // S
  "....": m4(-4, 0),  // H
  "-":    m4(1, 0),   // T
  "--":   m4(2, 0),   // M
  "---":  m4(3, 0),   // O

  // E sub-tree
  ".-":     m4(-1, 3),  // A
  ".-.":    m4(-2, 3),  // R
  ".-..":   m4(-3, 3),  // L
  ".--":    m4(-1, 5),  // W
  ".--.":   m4(-2, 5),  // P
  ".---":   m4(-1, 6),  // J

  // I sub-tree
  "..-":    m4(-2, 1),  // U
  "..-.":   m4(-2, 2),  // F

  // S sub-tree
  "...-":   m4(-3, 1),  // V

  // T sub-tree
  "-.":     m4(1, 3),   // N
  "-.-":    m4(2, 3),   // K
  "-.--":   m4(3, 3),   // Y
  "-.-.":   m4(2, 4),   // C
  "-..":    m4(1, 5),   // D
  "-..-":   m4(2, 5),   // X
  "-...":   m4(1, 6),   // B

  // M sub-tree
  "--.":    m4(2, 1),   // G
  "--..":   m4(2, 2),   // Z
  "--.-":   m4(3, 1),   // Q
};

const MODELS = {
  "1": {
    label: "Original",
    showLetterLEDs: true,
    showNumPunctAsLEDs: false,
    showNumPunctAsChips: true,
    pos: defaultBinaryTreePos,
  },
  "2": {
    label: "Extended",
    showLetterLEDs: true,
    showNumPunctAsLEDs: true,
    showNumPunctAsChips: false,
    pos: defaultBinaryTreePos,
  },
  "3": {
    label: "Letters only",
    showLetterLEDs: true,
    showNumPunctAsLEDs: false,
    showNumPunctAsChips: false,
    pos: defaultBinaryTreePos,
  },
  "4": {
    label: "Compact",
    showLetterLEDs: true,
    showNumPunctAsLEDs: false,
    showNumPunctAsChips: false,
    pos: (morse) => MODEL4_POSITIONS[morse] || null,
  },
};

function defaultBinaryTreePos(morse, { extended } = {}) {
  const W = extended ? 960 : 880;
  const CX = 500;
  const TOP_Y = 70;
  const LEVEL_DY = extended ? 72 : 78;
  let x = CX, dx = W / 4;
  for (let i = 0; i < morse.length; i++) {
    x += (morse[i] === "." ? -1 : 1) * dx;
    dx /= 2;
  }
  return { x, y: TOP_Y + morse.length * LEVEL_DY };
}

// Build the nodes + branches for a given tree model.
function buildTree(modelId) {
  const model = MODELS[modelId] || MODELS["1"];

  // Collect every code path we need to render (all prefixes of every letter).
  const codes = new Set([""]);
  if (model.showLetterLEDs) {
    LETTERS.forEach(L => {
      const m = MORSE[L];
      for (let i = 0; i <= m.length; i++) codes.add(m.slice(0, i));
    });
  }
  if (model.showNumPunctAsLEDs) {
    [...NUMBERS, ...PUNCT].forEach(ch => {
      const m = MORSE[ch];
      for (let i = 0; i <= m.length; i++) codes.add(m.slice(0, i));
    });
  }

  // Compute positions; skip codes the model has no position for (Model 4).
  const positionOpts = { extended: modelId === "2" };
  const nodes = {};
  codes.forEach(c => {
    const p = model.pos(c, positionOpts);
    if (!p) return;
    nodes[c] = { x: p.x, y: p.y, code: c, label: FROM_MORSE[c] || null };
  });

  // Each non-root node has a parent one char shorter; that's the branch.
  const branches = [];
  Object.keys(nodes).forEach(c => {
    if (c === "") return;
    const parent = c.slice(0, -1);
    if (nodes[parent]) branches.push({ from: parent, to: c, sym: c.slice(-1) });
  });

  return { nodes, branches, model, modelId };
}

let TREE = buildTree("1");

/* ---------- AUDIO ---------- */
const Beeper = (() => {
  let ctx, masterGain;
  let muted = false;
  let scheduledNodes = [];
  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = .35;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function trackNode(n) {
    scheduledNodes.push(n);
    n.onended = () => {
      const i = scheduledNodes.indexOf(n);
      if (i !== -1) scheduledNodes.splice(i, 1);
    };
  }
  function beep(durMs, tone = "sine") {
    if (muted) return;
    ensure();
    const t0 = ctx.currentTime;
    const dur = durMs / 1000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(1, t0 + 0.008);
    env.gain.setValueAtTime(1, t0 + Math.max(dur - 0.02, 0.01));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    env.connect(masterGain);

    if (tone === "sine") {
      const o = ctx.createOscillator();
      o.type = "sine"; o.frequency.value = 700;
      o.connect(env);
      o.start(t0); o.stop(t0 + dur + 0.02);
      trackNode(o);
    } else if (tone === "telegraph") {
      // Tight square-ish click + tone
      const o1 = ctx.createOscillator(); o1.type = "square"; o1.frequency.value = 620;
      const o2 = ctx.createOscillator(); o2.type = "triangle"; o2.frequency.value = 1240;
      const mix = ctx.createGain(); mix.gain.value = 0.5;
      o1.connect(mix); o2.connect(mix); mix.connect(env);
      o1.start(t0); o2.start(t0); o1.stop(t0 + dur + 0.02); o2.stop(t0 + dur + 0.02);
      trackNode(o1); trackNode(o2);
    } else if (tone === "buzzer") {
      // Sawtooth with slight detune for rasp
      const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 480;
      const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = 484;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1600;
      o1.connect(lp); o2.connect(lp); lp.connect(env);
      o1.start(t0); o2.start(t0); o1.stop(t0 + dur + 0.02); o2.stop(t0 + dur + 0.02);
      trackNode(o1); trackNode(o2);
    }
  }
  function killAll() {
    scheduledNodes.forEach(n => { try { n.stop(); } catch(_){} });
    scheduledNodes = [];
  }
  function setMuted(v) { muted = !!v; if (muted) killAll(); }
  return { beep, ensure, setMuted, killAll, get muted(){return muted;} };
})();

/* ---------- STATE ---------- */
const State = {
  wpm: 15,
  tone: "sine",
  buffer: "",       // current dot/dash buffer being typed
  decoded: "",      // accumulated decoded text
  morseOut: "",     // accumulated raw morse (with " " and "/" separators)
  playing: false,   // text-to-morse playback in progress
  abortPlay: false,
};
const unit = () => 1200 / State.wpm;
// Decoder commit-pause: must exceed one dash plus a human inter-symbol gap.
const pauseMs = () => Math.max(700, unit() * 5);

/* ---------- TREE RENDERING ---------- */
const svg = document.getElementById("tree-svg");
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs = {}) {
  const e = document.createElementNS(SVG_NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function renderTree() {
  svg.innerHTML = "";
  const model = TREE.model;
  const modelId = TREE.modelId;
  // group for branches (drawn under nodes)
  const gBranches = svgEl("g", { class: "branches" });
  const gNodes = svgEl("g", { class: "nodes" });
  const gExtras = svgEl("g", { class: "extras" });
  svg.appendChild(gBranches);
  svg.appendChild(gNodes);
  svg.appendChild(gExtras);

  // branches
  const isModel4 = modelId === "4";
  TREE.branches.forEach(b => {
    const a = TREE.nodes[b.from], c = TREE.nodes[b.to];
    let d;
    if (isModel4 && Math.abs(a.x - c.x) > 0.5 && Math.abs(a.y - c.y) > 0.5) {
      // right-angle (L-shaped) connector: drop vertically from parent, then
      // run horizontally to the child — matches the compact PCB-style layout.
      d = `M${a.x},${a.y} L${a.x},${c.y} L${c.x},${c.y}`;
    } else {
      d = `M${a.x},${a.y} L${c.x},${c.y}`;
    }
    const ln = svgEl("path", {
      class: "branch", "data-to": b.to, d,
    });
    gBranches.appendChild(ln);
  });

  // root: small triangle/antenna stub
  const root = TREE.nodes[""];
  gNodes.appendChild(svgEl("line", {
    class: "root-mast", x1: root.x, y1: root.y - 16, x2: root.x, y2: root.y + 4,
  }));
  const tri = svgEl("polygon", {
    class: "root-core",
    points: `${root.x-8},${root.y-2} ${root.x+8},${root.y-2} ${root.x},${root.y-16}`,
  });
  gNodes.appendChild(tri);
  gNodes.appendChild(svgEl("circle", { class: "root-core", cx: root.x, cy: root.y + 6, r: 3 }));

  // LED size per level — shrink for deep levels (used by Model 2)
  function ledSizeFor(code) {
    const scale = +getComputedStyle(document.documentElement)
      .getPropertyValue("--led-scale") || 1;
    const apply = (sz) => ({
      r: sz.r * scale, s: sz.s * scale, rx: sz.rx
    });
    const len = code.length;
    if (modelId === "2") {
      if (len <= 4) return apply({ r: 21, s: 38, rx: 5 });
      if (len === 5) return apply({ r: 15, s: 28, rx: 4 });     // numbers
      return        apply({ r: 11, s: 22, rx: 3 });             // punctuation
    }
    if (modelId === "4") return apply({ r: 21, s: 38, rx: 5 });
    return apply({ r: 21, s: 38, rx: 5 });
  }

  // all nodes (letters and, for Model 2, numbers + punctuation)
  Object.keys(TREE.nodes).forEach(code => {
    if (code === "") return;
    const n = TREE.nodes[code];
    if (!n.label) return;
    const isDot = code.slice(-1) === ".";
    const sz = ledSizeFor(code);
    const g = svgEl("g", { class: "led-g", "data-code": code, transform: `translate(${n.x},${n.y})` });
    if (NUMBERS.includes(n.label)) g.classList.add("led-num");
    if (PUNCT.includes(n.label))   g.classList.add("led-punct");
    let led;
    if (isDot) {
      led = svgEl("circle", { class: "led", cx: 0, cy: 0, r: sz.r });
    } else {
      led = svgEl("rect", { class: "led", x: -sz.s/2, y: -sz.s/2, width: sz.s, height: sz.s, rx: sz.rx });
    }
    g.appendChild(led);
    const txt = svgEl("text", { class: "led-glyph", x: 0, y: 1, "text-anchor": "middle" });
    txt.textContent = n.label;
    g.appendChild(txt);
    gNodes.appendChild(g);
  });

  // optional chip rows below the tree
  let bottomY = 0;
  Object.values(TREE.nodes).forEach(n => { if (n.y > bottomY) bottomY = n.y; });

  if (model.showNumPunctAsChips) {
    const scale = +getComputedStyle(document.documentElement)
      .getPropertyValue("--led-scale") || 1;
    const numY = bottomY + 80;
    const numSpan = 880;
    NUMBERS.forEach((d, i) => {
      const m = MORSE[d];
      const x = 500 + ((i - (NUMBERS.length-1)/2) / (NUMBERS.length-1)) * numSpan;
      const g = svgEl("g", { class: "chip-g", "data-chip": d, transform: `translate(${x},${numY})` });
      const w = 64 * scale, h = 50 * scale;
      g.appendChild(svgEl("rect", { class: "chip-box", x: -w/2, y: -h/2, width: w, height: h, rx: 9 }));
      const t = svgEl("text", { class: "chip-letter", x: 0, y: -7, "text-anchor": "middle" });
      t.textContent = d;
      g.appendChild(t);
      const mt = svgEl("text", { class: "chip-code", x: 0, y: 14, "text-anchor": "middle" });
      mt.textContent = m.replace(/\./g, "·").replace(/-/g, "—");
      g.appendChild(mt);
      gExtras.appendChild(g);
    });

    const punY = numY + 78;
    const punSpan = 840;
    PUNCT.forEach((sym, i) => {
      const m = MORSE[sym];
      const x = 500 + ((i - (PUNCT.length-1)/2) / (PUNCT.length-1)) * punSpan;
      const g = svgEl("g", { class: "chip-g", "data-chip": sym, transform: `translate(${x},${punY})` });
      const w = 124 * scale, h = 48 * scale;
      g.appendChild(svgEl("rect", { class: "chip-box", x: -w/2, y: -h/2, width: w, height: h, rx: 9 }));
      const t = svgEl("text", { class: "chip-letter", x: -34, y: 0, "text-anchor": "middle" });
      t.textContent = sym;
      g.appendChild(t);
      const mt = svgEl("text", { class: "chip-code", x: 14, y: 0, "text-anchor": "middle" });
      mt.textContent = m.replace(/\./g, "·").replace(/-/g, "—");
      g.appendChild(mt);
      gExtras.appendChild(g);
    });

    bottomY = punY + 30;
  } else {
    bottomY += 40;
  }

  svg.setAttribute("viewBox", `0 0 1000 ${bottomY}`);
}

/* ---------- light up helpers ---------- */
function clearLights() {
  svg.querySelectorAll(".branch.lit").forEach(n => { n.classList.remove("lit"); n.style.removeProperty("--step-pos"); });
  svg.querySelectorAll(".led-g.lit, .led-g.final").forEach(n => { n.classList.remove("lit", "final"); n.style.removeProperty("--step-pos"); });
  svg.querySelectorAll(".chip-g.lit, .chip-g.final").forEach(n => { n.classList.remove("lit", "final"); n.style.removeProperty("--step-pos"); });
}
function litLED(code, opts={}) {
  const ledg = svg.querySelector(`.led-g[data-code="${cssEsc(code)}"]`);
  if (ledg) {
    ledg.classList.remove("lit", "final");
    void ledg.getBoundingClientRect();
    ledg.classList.add(opts.final ? "final" : "lit");
    if (opts.stepPos != null) ledg.style.setProperty("--step-pos", opts.stepPos);
  }
  const br = svg.querySelector(`.branch[data-to="${cssEsc(code)}"]`);
  if (br) {
    br.classList.add("lit");
    if (opts.stepPos != null) br.style.setProperty("--step-pos", opts.stepPos);
  }
}
function litChip(sym, opts={}) {
  const ch = svg.querySelector(`.chip-g[data-chip="${cssEsc(sym)}"]`);
  if (!ch) return;
  ch.classList.remove("lit", "final");
  void ch.getBoundingClientRect();
  ch.classList.add(opts.final ? "final" : "lit");
}
function unlitChips() {
  svg.querySelectorAll(".chip-g").forEach(ch => ch.classList.remove("lit", "final"));
}
function cssEsc(s){ return s.replace(/[\\"]/g, "\\$&"); }

/* ---------- decoded letter spotlight ---------- */
const letterSpot = document.getElementById("letter-spot");
function showSpotlight(letter, code) {
  letterSpot.querySelector(".ls-glyph").textContent = letter;
  letterSpot.querySelector(".ls-morse").textContent = code.replace(/\./g, "·").replace(/-/g, "—");
  letterSpot.classList.add("show");
  clearTimeout(showSpotlight._t);
  showSpotlight._t = setTimeout(() => letterSpot.classList.remove("show"), 700);
}

/* ---------- transmit animation for a full letter ---------- */
async function transmitLetter(letter) {
  letter = letter.toUpperCase();
  if (letter === " ") {
    appendDecoded(" ");
    State.morseOut += "/ ";
    updateReadout();
    await sleep(unit() * 4);
    return;
  }
  const code = MORSE[letter];
  if (!code) return;
  clearLights();
  unlitChips();
  setTransmitting(true);

  // light each step
  for (let i = 1; i <= code.length; i++) {
    if (State.abortPlay) break;
    const prefix = code.slice(0, i);
    const isFinal = i === code.length;
    const isInTree = TREE.nodes[prefix] && TREE.nodes[prefix].label;
    const sym = prefix.slice(-1);
    const dur = sym === "." ? unit() : unit() * 3;
    const stepPos = code.length === 1 ? 1 : i / code.length;
    const isNumOrPunct = NUMBERS.includes(letter) || PUNCT.includes(letter);

    if (isInTree) {
      litLED(prefix, { final: isFinal, stepPos });
    } else if (isFinal && isNumOrPunct) {
      // final chip lit after the loop
    } else if (i < code.length) {
      const br = svg.querySelector(`.branch[data-to="${cssEsc(prefix)}"]`);
      if (br) { br.classList.add("lit"); br.style.setProperty("--step-pos", stepPos); }
    }
    Beeper.beep(dur, State.tone);
    await sleep(dur);
    if (i < code.length) await sleep(unit());
  }
  if ((NUMBERS.includes(letter) || PUNCT.includes(letter)) && !(TREE.nodes[code] && TREE.nodes[code].label)) {
    litChip(letter, { final: true });
  }
  if (!State.abortPlay) {
    showSpotlight(letter, code);
    appendDecoded(letter);
    State.morseOut += code + " ";
    updateReadout();
  }
  await sleep(unit() * 1.5);
  // avoid READY→TX flicker if more letters are queued behind this one
  if (txPending <= 1 && !State.playing) setTransmitting(false);
}
async function transmitText(text) {
  State.playing = true;
  State.abortPlay = false;
  const playBtn = document.querySelector('[data-action="play-t2m"]');
  if (playBtn) playBtn.disabled = true;
  for (const ch of text) {
    if (State.abortPlay) break;
    if (ch === " ") {
      appendDecoded(" "); State.morseOut += "/ "; updateReadout();
      await sleep(unit() * 7);
      continue;
    }
    const u = ch.toUpperCase();
    if (!MORSE[u]) continue;
    await transmitLetter(u);
    await sleep(unit() * 3); // inter-letter gap
  }
  State.playing = false;
  if (playBtn) playBtn.disabled = false;
  setTimeout(() => { clearLights(); unlitChips(); }, 600);
}
function stopTransmit() {
  State.abortPlay = true;
  Beeper.killAll();
  setTransmitting(false);
}
function setTransmitting(on) {
  document.body.classList.toggle("transmitting", !!on);
  document.getElementById("status-text").textContent = on ? "TX…" : "READY";
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* serialize standalone letter transmissions (live-type, ref clicks) */
let txQueue = Promise.resolve();
let txPending = 0;
function enqueueLetter(ch) {
  // Don't interleave live-typed letters with a Text→Morse playback in progress
  if (State.playing) return txQueue;
  txPending += 1;
  txQueue = txQueue
    .then(() => transmitLetter(ch))
    .then(() => sleep(unit() * 2))
    .finally(() => {
      txPending -= 1;
      if (txPending === 0 && !State.playing) setTransmitting(false);
    });
  return txQueue;
}

/* ---------- READOUT ---------- */
const readoutMarks = document.getElementById("readout-marks");
const decodedText = document.getElementById("decoded-text");
const dcFill = document.getElementById("dc-fill");
function updateReadout() {
  decodedText.textContent = State.decoded;
}
function appendDecoded(ch) {
  State.decoded += ch;
  // push to history (skip plain spaces — they're word separators)
  if (ch && ch !== " ") pushHistory(ch);
  else if (ch === " ") pushHistory(" ");
}
function setBufferDisplay() {
  if (!State.buffer) {
    readoutMarks.innerHTML = '<span class="rm-placeholder">— tap to send —</span>';
    return;
  }
  const display = State.buffer.split("").map(s =>
    s === "." ? "·" : "—"
  ).join(" ");
  readoutMarks.textContent = display;
}

/* ---------- HISTORY TAPE ---------- */
const historyTape = document.getElementById("history-tape");
const HISTORY = []; // [{ ch, code }] — newest last
const HISTORY_MAX = 60;
function pushHistory(ch) {
  if (ch === " ") {
    // drop leading spaces; collapse consecutive ones
    if (!HISTORY.length) return;
    if (HISTORY[HISTORY.length-1].ch === " ") return;
    HISTORY.push({ ch: " ", code: "" });
  } else {
    HISTORY.push({ ch, code: MORSE[ch] || "?" });
  }
  while (HISTORY.length > HISTORY_MAX) HISTORY.shift();
  renderHistory();
}
function renderHistory() {
  if (!HISTORY.length) {
    historyTape.textContent = "";
    historyTape.setAttribute("data-state", "empty");
    return;
  }
  historyTape.removeAttribute("data-state");
  historyTape.innerHTML = "";
  HISTORY.forEach((item, i) => {
    if (item.ch === " ") {
      const sep = document.createElement("span");
      sep.className = "ht-sep";
      sep.title = "word break";
      historyTape.appendChild(sep);
      return;
    }
    const chip = document.createElement("button");
    chip.className = "ht-chip";
    chip.type = "button";
    chip.title = `Replay ${item.ch}`;
    chip.innerHTML =
      `<span class="ht-ch">${item.ch}</span>` +
      `<span class="ht-code">${item.code.replace(/\./g,"·").replace(/-/g,"—")}</span>`;
    chip.addEventListener("click", () => {
      if (State.playing) return;
      enqueueLetter(item.ch);
    });
    if (i === HISTORY.length - 1) chip.classList.add("fresh");
    historyTape.appendChild(chip);
  });
  // auto-scroll to the right edge
  historyTape.scrollLeft = historyTape.scrollWidth;
}
function clearHistory() {
  HISTORY.length = 0;
  renderHistory();
}

/* ---------- DECODER STATE ---------- */
let decodeTimer = null;
let countdownRAF = null;
function pushSymbol(sym) {
  Beeper.ensure();
  State.buffer += sym;
  setBufferDisplay();
  // animate tree path so user sees progress
  paintBufferOnTree();
  // play beep
  const dur = sym === "." ? unit() : unit() * 3;
  Beeper.beep(dur, State.tone);
  scheduleDecode();
}
function paintBufferOnTree() {
  clearLights(); unlitChips();
  if (!State.buffer) {
    // buffer fully erased — clear TX state
    if (!State.playing && txPending === 0) setTransmitting(false);
    return;
  }
  const L = State.buffer.length;
  for (let i = 1; i <= L; i++) {
    const p = State.buffer.slice(0, i);
    const stepPos = L === 1 ? 1 : i / L;
    if (TREE.nodes[p] && TREE.nodes[p].label) litLED(p, { stepPos });
    else {
      const br = svg.querySelector(`.branch[data-to="${cssEsc(p)}"]`);
      if (br) { br.classList.add("lit"); br.style.setProperty("--step-pos", stepPos); }
    }
  }
  setTransmitting(true);
}
function scheduleDecode() {
  if (decodeTimer) clearTimeout(decodeTimer);
  if (countdownRAF) cancelAnimationFrame(countdownRAF);
  const start = performance.now();
  const dur = pauseMs();
  const tick = () => {
    const t = performance.now() - start;
    const pct = Math.min(100, (t / dur) * 100);
    dcFill.style.width = pct + "%";
    if (t < dur) countdownRAF = requestAnimationFrame(tick);
  };
  tick();
  decodeTimer = setTimeout(commitLetter, dur);
}
function commitLetter() {
  dcFill.style.width = "0%";
  if (!State.buffer) return;
  const letter = FROM_MORSE[State.buffer];
  if (letter) {
    appendDecoded(letter);
    State.morseOut += State.buffer + " ";
    showSpotlight(letter, State.buffer);
    // turn last LED green / chip
    if (NUMBERS.includes(letter) || PUNCT.includes(letter)) {
      litChip(letter, { final: true });
    } else {
      litLED(State.buffer, { final: true });
    }
  } else {
    // unknown: flash decoded? show "?"
    appendDecoded("?");
    State.morseOut += "? ";
    showSpotlight("?", State.buffer);
  }
  updateReadout();
  State.buffer = "";
  setBufferDisplay();
  setTimeout(() => {
    if (!State.buffer && !State.playing) { clearLights(); unlitChips(); setTransmitting(false); }
  }, 600);
}

/* ---------- INPUTS ---------- */

/* Spacebar: tap=dot, hold=dash (threshold relative to WPM) */
let spaceDownT = 0, spaceHeld = false, spaceTimer = null;
window.addEventListener("keydown", e => {
  if (e.target.matches("textarea, input")) return;
  if (e.code === "Space") {
    e.preventDefault();
    Beeper.ensure();
    if (!spaceHeld) {
      spaceDownT = performance.now();
      spaceHeld = true;
      keypadEl.classList.add("pressed");
      keypadSymbol.textContent = "·";
      const threshold = Math.max(180, unit() * 1.6);
      spaceTimer = setTimeout(() => { keypadSymbol.textContent = "—"; }, threshold);
    }
  } else if (/^Key[A-Z]$|^Digit[0-9]$/.test(e.code) && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
    const ch = e.key.toUpperCase();
    if (MORSE[ch] && !State.playing) {
      // resume AudioContext inside the gesture so the first key plays sound
      Beeper.ensure();
      enqueueLetter(ch);
    }
  } else if (e.key === "Backspace" && !e.target.matches("textarea, input")) {
    e.preventDefault();
    State.decoded = State.decoded.slice(0, -1);
    State.morseOut = State.morseOut.replace(/[^\s/]+\s$/, "");
    updateReadout();
  }
});
window.addEventListener("keyup", e => {
  if (e.code === "Space") {
    if (!spaceHeld) return;
    const t = performance.now() - spaceDownT;
    const threshold = Math.max(120, unit() * 1.6);
    pushSymbol(t > threshold ? "-" : ".");
    spaceHeld = false;
    keypadEl.classList.remove("pressed");
    keypadSymbol.textContent = "·";
    clearTimeout(spaceTimer);
  }
});

/* Keypad: tap = dot, hold = dash; mouse left/right too */
const keypadEl = document.getElementById("keypad");
const keypadSymbol = document.getElementById("keypad-symbol");
let kpDownT = 0, kpTimer = null;
function kpDown() {
  kpDownT = performance.now();
  keypadEl.classList.add("pressed");
  keypadSymbol.textContent = "·";
  // visual upgrade to dash after threshold
  const threshold = Math.max(180, unit() * 1.6);
  kpTimer = setTimeout(() => { keypadSymbol.textContent = "—"; }, threshold);
}
function kpUp(forceDash) {
  if (!kpDownT) return;
  const t = performance.now() - kpDownT;
  const threshold = Math.max(180, unit() * 1.6);
  pushSymbol(forceDash || t > threshold ? "-" : ".");
  kpDownT = 0;
  keypadEl.classList.remove("pressed");
  keypadSymbol.textContent = "·";
  clearTimeout(kpTimer);
}
function kpCancel() {
  kpDownT = 0;
  keypadEl.classList.remove("pressed");
  keypadSymbol.textContent = "·";
  clearTimeout(kpTimer);
}
keypadEl.addEventListener("pointerdown", e => {
  e.preventDefault();
  keypadEl.setPointerCapture(e.pointerId);
  Beeper.ensure();
  // right-click = dash directly on pointerup (no hold needed)
  if (e.button === 2) {
    pushSymbol("-"); return;
  }
  kpDown();
});
keypadEl.addEventListener("pointerup", e => {
  if (e.button === 2) return;
  kpUp();
});
keypadEl.addEventListener("pointercancel", kpCancel);
keypadEl.addEventListener("pointerleave", () => { if (kpDownT) kpUp(); });
keypadEl.addEventListener("contextmenu", e => e.preventDefault());

/* dot/dash/space/backspace buttons */
document.querySelector('[data-action="dot"]').addEventListener("click", () => pushSymbol("."));
document.querySelector('[data-action="dash"]').addEventListener("click", () => pushSymbol("-"));
document.querySelector('[data-action="space"]').addEventListener("click", () => {
  if (decodeTimer) clearTimeout(decodeTimer);
  if (State.buffer) commitLetter();
  appendDecoded(" ");
  State.morseOut += "/ ";
  updateReadout();
});
document.querySelector('[data-action="backspace"]').addEventListener("click", () => {
  if (State.buffer) {
    State.buffer = State.buffer.slice(0, -1);
    setBufferDisplay();
    paintBufferOnTree();
    scheduleDecode();
  } else {
    State.decoded = State.decoded.slice(0, -1);
    State.morseOut = State.morseOut.replace(/[^\s/]+\s$/, "");
    updateReadout();
  }
});

/* ---------- TEXT → MORSE ---------- */
const t2mInput = document.getElementById("t2m-input");
const t2mPreview = document.getElementById("t2m-preview");
function refreshT2M() {
  const text = t2mInput.value.trim();
  if (!text) { t2mPreview.textContent = ""; return; }
  t2mPreview.textContent = text.toUpperCase().split("").map(ch =>
    ch === " " ? "/" : (MORSE[ch] || "?")
  ).join(" ").replace(/\./g, "·").replace(/-/g, "—");
}
t2mInput.addEventListener("input", refreshT2M);
document.querySelector('[data-action="play-t2m"]').addEventListener("click", () => {
  if (State.playing) return;
  Beeper.ensure();
  State.decoded = "";
  State.morseOut = "";
  updateReadout();
  const txt = t2mInput.value;
  if (txt.trim()) transmitText(txt);
});
document.querySelector('[data-action="stop-t2m"]').addEventListener("click", stopTransmit);
document.querySelector('[data-action="share-t2m"]').addEventListener("click", () => {
  const txt = t2mInput.value.trim();
  if (!txt) return;
  const morse = txt.toUpperCase().split("").map(ch =>
    ch === " " ? "/" : (MORSE[ch] || "")
  ).join(" ");
  const url = new URL(location.href);
  url.searchParams.set("m", morse.replace(/ /g, "_"));
  navigator.clipboard.writeText(url.toString()).catch(()=>{});
  toast("Share link copied");
});

/* ---------- MORSE → TEXT ---------- */
const m2tInput = document.getElementById("m2t-input");
const m2tPreview = document.getElementById("m2t-preview");
function refreshM2T() {
  const raw = m2tInput.value.replace(/[·•]/g, ".").replace(/[—–]/g, "-");
  const words = raw.split(/\s*\/\s*|\s{3,}/);
  m2tPreview.textContent = words.map(w =>
    w.trim().split(/\s+/).map(s => FROM_MORSE[s] || (s ? "?" : "")).join("")
  ).join(" ");
}
m2tInput.addEventListener("input", refreshM2T);
function m2tInsert(s) { m2tInput.value += s; refreshM2T(); m2tInput.focus(); }
document.querySelector('[data-action="m2t-dot"]').addEventListener("click", () => m2tInsert("."));
document.querySelector('[data-action="m2t-dash"]').addEventListener("click", () => m2tInsert("-"));
document.querySelector('[data-action="m2t-slash"]').addEventListener("click", () => m2tInsert(" / "));
document.querySelector('[data-action="m2t-clear"]').addEventListener("click", () => { m2tInput.value = ""; refreshM2T(); });
document.querySelector('[data-action="play-m2t"]').addEventListener("click", () => {
  if (State.playing) return;
  Beeper.ensure();
  // decode the morse to plain text, then route through the same playback pipeline
  const raw = m2tInput.value.replace(/[·•]/g, ".").replace(/[—–]/g, "-");
  const words = raw.split(/\s*\/\s*|\s{3,}/);
  const text = words.map(w =>
    w.trim().split(/\s+/).map(s => FROM_MORSE[s] || "").join("")
  ).join(" ").trim();
  if (!text) return;
  State.decoded = ""; State.morseOut = "";
  updateReadout();
  transmitText(text);
});
document.querySelector('[data-action="stop-m2t"]').addEventListener("click", stopTransmit);

/* ---------- COPY / CLEAR ---------- */
function copyBtn(action, getter) {
  const btn = document.querySelector(`[data-action="${action}"]`);
  btn.addEventListener("click", async () => {
    const v = getter().trim();
    if (!v) return;
    try { await navigator.clipboard.writeText(v); } catch(_) {}
    btn.classList.add("copied");
    setTimeout(() => btn.classList.remove("copied"), 900);
  });
}
copyBtn("copy-text",  () => State.decoded);
copyBtn("copy-morse", () => State.morseOut);
document.querySelector('[data-action="clear"]').addEventListener("click", () => {
  State.decoded = ""; State.morseOut = ""; State.buffer = "";
  updateReadout(); setBufferDisplay();
  clearLights(); unlitChips();
});
document.querySelector('[data-action="clear-history"]').addEventListener("click", clearHistory);

/* ---------- SOS ---------- */
document.querySelector('[data-action="sos"]').addEventListener("click", () => {
  if (State.playing) return;
  Beeper.ensure();
  State.decoded = ""; State.morseOut = "";
  updateReadout();
  transmitText("SOS");
});

/* ---------- TABS ---------- */
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => {
      const isActive = x === t;
      x.classList.toggle("active", isActive);
      x.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    document.querySelectorAll(".tabpanel").forEach(p => p.hidden = p.dataset.panel !== t.dataset.tab);
    if (t.dataset.tab === "drill") Drill.start();
  });
});

/* ---------- DRILL (practice mode) ---------- */
const Drill = (() => {
  const pools = {
    letters: LETTERS.slice(),
    alnum:   LETTERS.concat(NUMBERS),
    all:     LETTERS.concat(NUMBERS).concat(PUNCT),
  };
  const state = { pool: "letters", current: null, correct: 0, total: 0, streak: 0, locked: false, mode: "blind" };
  let advanceTimer = null;
  const morseEl = document.getElementById("drill-morse");
  const choicesEl = document.getElementById("drill-choices");
  const feedbackEl = document.getElementById("drill-feedback");
  const scoreEl = document.getElementById("drill-score");
  const streakEl = document.getElementById("drill-streak");

  function pickAnswer() {
    const pool = pools[state.pool];
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function pickDistractors(answer) {
    const pool = pools[state.pool].filter(c => c !== answer);
    // shuffle and pick 3
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }
  function renderScore() {
    scoreEl.textContent = `${state.correct} / ${state.total}`;
    if (state.streak >= 3) {
      streakEl.textContent = `${state.streak}× streak`;
      streakEl.style.opacity = 1;
    } else {
      streakEl.textContent = "";
      streakEl.style.opacity = 0;
    }
  }
  async function newRound({ silent } = {}) {
    state.locked = false;
    feedbackEl.textContent = "";
    feedbackEl.removeAttribute("data-result");
    state.current = pickAnswer();
    const opts = [state.current, ...pickDistractors(state.current)];
    // shuffle
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    // render choices
    choicesEl.innerHTML = "";
    opts.forEach(c => {
      const b = document.createElement("button");
      b.className = "drill-choice";
      b.type = "button";
      b.textContent = c;
      b.dataset.val = c;
      b.addEventListener("click", () => answer(c, b));
      choicesEl.appendChild(b);
    });
    morseEl.textContent = MORSE[state.current].replace(/\./g, "·").replace(/-/g, "—");
    if (state.mode === "visible") {
      morseEl.classList.remove("hidden");
    } else {
      // blind mode: show placeholder until answered
      morseEl.textContent = "— — —";
      morseEl.classList.add("hidden");
    }
    if (!silent) await playCurrent();
  }
  async function playCurrent() {
    if (!state.current) return;
    // play through tree + audio; don't touch decoded text or history
    Beeper.ensure();
    const code = MORSE[state.current];
    clearLights(); unlitChips();
    setTransmitting(true);
    for (let i = 1; i <= code.length; i++) {
      const prefix = code.slice(0, i);
      const sym = prefix.slice(-1);
      const dur = sym === "." ? unit() : unit() * 3;
      const inTree = TREE.nodes[prefix] && TREE.nodes[prefix].label;
      if (inTree) {
        litLED(prefix, { final: false });
      } else {
        const br = svg.querySelector(`.branch[data-to="${cssEsc(prefix)}"]`);
        if (br) br.classList.add("lit");
      }
      Beeper.beep(dur, State.tone);
      await sleep(dur);
      if (i < code.length) await sleep(unit());
    }
    if (NUMBERS.includes(state.current) || PUNCT.includes(state.current)) {
      litChip(state.current);
    }
    await sleep(unit() * 1.5);
    setTransmitting(false);
  }
  function answer(choice, btnEl) {
    if (state.locked) return;
    state.locked = true;
    state.total += 1;
    morseEl.textContent = MORSE[state.current].replace(/\./g, "·").replace(/-/g, "—");
    morseEl.classList.remove("hidden");
    const right = choice === state.current;
    if (right) {
      state.correct += 1;
      state.streak += 1;
      btnEl.classList.add("correct");
      feedbackEl.dataset.result = "right";
      feedbackEl.textContent = `✓  ${state.current}`;
      // green-light final on tree
      if (NUMBERS.includes(state.current) || PUNCT.includes(state.current)) {
        litChip(state.current, { final: true });
      } else {
        litLED(MORSE[state.current], { final: true });
      }
      showSpotlight(state.current, MORSE[state.current]);
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(() => newRound(), 900);
    } else {
      state.streak = 0;
      btnEl.classList.add("wrong");
      // also reveal correct
      const correctBtn = [...choicesEl.children].find(c => c.dataset.val === state.current);
      if (correctBtn) correctBtn.classList.add("reveal");
      feedbackEl.dataset.result = "wrong";
      feedbackEl.textContent = `✗  was ${state.current}`;
    }
    renderScore();
  }
  function next() {
    clearTimeout(advanceTimer);
    // skipping unanswered counts as a miss
    if (state.current && !state.locked) {
      state.total += 1;
      state.streak = 0;
      renderScore();
    }
    newRound();
  }
  function reset() {
    clearTimeout(advanceTimer);
    state.correct = 0; state.total = 0; state.streak = 0;
    renderScore();
    newRound();
  }
  function setPool(p) { state.pool = p; newRound(); }
  function applyMode(mode) {
    if (mode !== "blind" && mode !== "visible") return;
    state.mode = mode;
    // sync visibility for any unanswered round already on screen
    if (state.current && !state.locked) {
      if (mode === "visible") {
        morseEl.textContent = MORSE[state.current].replace(/\./g, "·").replace(/-/g, "—");
        morseEl.classList.remove("hidden");
      } else {
        morseEl.textContent = "— — —";
        morseEl.classList.add("hidden");
      }
    }
  }
  function start() {
    renderScore();
    if (!state.current) newRound({ silent: true });
  }
  return { start, next, reset, setPool, applyMode, playCurrent, get state(){ return state; } };
})();

document.querySelector('[data-action="drill-next"]').addEventListener("click", () => Drill.next());
document.querySelector('[data-action="drill-reset"]').addEventListener("click", () => Drill.reset());
document.querySelector('[data-action="drill-replay"]').addEventListener("click", () => Drill.playCurrent());
document.querySelector('[data-tweak-local="drill-pool"]').addEventListener("click", e => {
  const b = e.target.closest("[data-val]");
  if (!b) return;
  document.querySelectorAll('[data-tweak-local="drill-pool"] .seg-btn').forEach(x => x.classList.toggle("active", x === b));
  Drill.setPool(b.dataset.val);
});


const scrim = document.getElementById("scrim");
function openDrawer(id) {
  const d = document.getElementById(id);
  d.hidden = false;
  scrim.hidden = false;
}
function closeDrawer(id) {
  const d = document.getElementById(id);
  d.hidden = true;
  if (document.querySelectorAll(".drawer:not([hidden])").length === 0) scrim.hidden = true;
}
function toggleDrawer(id) {
  const d = document.getElementById(id);
  if (d.hidden) openDrawer(id); else closeDrawer(id);
}
document.querySelectorAll('[data-action="toggle-ref"]').forEach(b => b.addEventListener("click", () => toggleDrawer("ref-drawer")));
document.querySelectorAll('[data-action="toggle-help"]').forEach(b => b.addEventListener("click", () => toggleDrawer("help-drawer")));
document.querySelectorAll('[data-action="toggle-tweaks"]').forEach(b => b.addEventListener("click", () => toggleDrawer("tweaks-drawer")));
document.querySelectorAll('[data-action="toggle-about"]').forEach(b => b.addEventListener("click", () => toggleDrawer("about-drawer")));
scrim.addEventListener("click", () => {
  document.querySelectorAll(".drawer").forEach(d => d.hidden = true);
  scrim.hidden = true;
});

function toast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.style.cssText = `
      position: fixed; left: 50%; bottom: 30px; transform: translateX(-50%);
      background: var(--panel); color: var(--ink);
      border: 1px solid var(--panel-edge); border-radius: 999px;
      padding: 10px 18px; font: 700 11px/1 var(--f-mono); letter-spacing: .14em;
      z-index: 200; box-shadow: 0 10px 30px rgba(0,0,0,.4);
      opacity: 0; transition: opacity .2s, transform .2s;`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.opacity = 1; t.style.transform = "translateX(-50%) translateY(0)"; });
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.style.opacity = 0; t.style.transform = "translateX(-50%) translateY(8px)"; }, 1600);
}

/* ---------- REFERENCE PANEL ---------- */
function buildRef() {
  const make = (chars, host) => {
    if (!host) return;
    chars.forEach(c => {
      const code = MORSE[c];
      const b = document.createElement("button");
      b.className = "ref-cell";
      b.innerHTML = `<span class="rc-letter">${c}</span><span class="rc-code">${code.replace(/\./g,"·").replace(/-/g,"—")}</span>`;
      b.addEventListener("click", () => {
        if (State.playing) return;
        enqueueLetter(c);
      });
      host.appendChild(b);
    });
  };
  make(LETTERS, document.getElementById("ref-letters"));
  make(NUMBERS, document.getElementById("ref-numbers"));
  make(PUNCT,   document.getElementById("ref-punct"));
}

/* ---------- THEME / TWEAKS ---------- */
const Prefs = (() => {
  const KEY = "morse.prefs.v1";
  const defaults = {
    theme: "dark", finish: "matte", font: "mono", glow: "amber",
    ledScale: 1, tone: "sine", wpm: 15, treeModel: "1",
    drillMode: "blind",
  };
  let p = { ...defaults };
  try { p = { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) }; } catch(_) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch(_){} }
  function apply() {
    document.body.dataset.theme = p.theme;
    document.body.dataset.finish = p.finish;
    document.body.dataset.font = p.font;
    document.body.dataset.glow = p.glow;
    const prevScale = document.documentElement.style.getPropertyValue("--led-scale");
    document.documentElement.style.setProperty("--led-scale", p.ledScale);
    document.getElementById("led-scale").value = p.ledScale;
    document.getElementById("led-scale-val").textContent = (+p.ledScale).toFixed(2).replace(/0$/,"") + "×";
    State.tone = p.tone;
    State.wpm = p.wpm;
    document.getElementById("wpm").value = p.wpm;
    document.getElementById("wpm-val").textContent = p.wpm;

    // rebuild + re-render the tree when model or LED scale changes
    const modelChanged = !TREE || TREE.modelId !== p.treeModel;
    const scaleChanged = prevScale && parseFloat(prevScale) !== +p.ledScale;
    if (modelChanged) TREE = buildTree(p.treeModel);
    if ((modelChanged || scaleChanged) && svg.firstChild) renderTree();

    if (typeof Drill !== "undefined" && Drill.applyMode) Drill.applyMode(p.drillMode);

    document.querySelectorAll('[data-tweak]').forEach(seg => {
      const key = seg.dataset.tweak;
      if (!key) return;
      const val = key === "tree-model" ? p.treeModel : p[key];
      seg.querySelectorAll("[data-val]").forEach(btn => btn.classList.toggle("active", btn.dataset.val === val));
    });
    document.querySelectorAll('.swatches[data-tweak="glow"] .sw').forEach(b => b.classList.toggle("active", b.dataset.val === p.glow));
  }
  function set(k, v) { p[k] = v; save(); apply(); }
  function reset() { p = { ...defaults }; save(); apply(); }
  return { get: () => p, set, reset, apply };
})();

document.querySelectorAll('[data-tweak]').forEach(group => {
  group.addEventListener("click", e => {
    const btn = e.target.closest("[data-val]");
    if (!btn) return;
    const key = group.dataset.tweak;
    const v = btn.dataset.val;
    if (key === "tree-model") Prefs.set("treeModel", v);
    else Prefs.set(key, v);
  });
});
document.getElementById("led-scale").addEventListener("input", e => {
  Prefs.set("ledScale", +e.target.value);
});
document.getElementById("wpm").addEventListener("input", e => {
  Prefs.set("wpm", +e.target.value);
});
document.querySelector('[data-action="toggle-theme"]').addEventListener("click", () => {
  Prefs.set("theme", Prefs.get().theme === "dark" ? "light" : "dark");
});
document.querySelector('[data-action="reset-defaults"]').addEventListener("click", () => {
  Prefs.reset();
  toast("Settings reset to defaults");
});
document.getElementById("audiotoggle").addEventListener("click", e => {
  const btn = e.currentTarget;
  const next = btn.getAttribute("aria-pressed") !== "true";
  btn.setAttribute("aria-pressed", next ? "true" : "false");
  Beeper.setMuted(!next);
});

/* ---------- SHARE LINK ---------- */
function handleShared() {
  const params = new URLSearchParams(location.search);
  const raw = params.get("m");
  if (!raw) return;
  const morse = raw.replace(/_/g, " ").replace(/[·•]/g, ".").replace(/[—–]/g, "-");
  // decode for preview
  const words = morse.split(/\s*\/\s*|\s{3,}/);
  const text = words.map(w =>
    w.trim().split(/\s+/).map(s => FROM_MORSE[s] || "?").join("")
  ).join(" ");
  document.getElementById("sb-preview").textContent = text || morse;
  document.getElementById("share-banner").hidden = false;
  document.querySelector('[data-action="play-shared"]').addEventListener("click", () => {
    document.getElementById("share-banner").hidden = true;
    State.decoded = ""; State.morseOut = ""; updateReadout();
    transmitText(text);
  });
  document.querySelector('[data-action="dismiss-shared"]').addEventListener("click", () => {
    document.getElementById("share-banner").hidden = true;
  });
}

/* ---------- BOOT ---------- */
function boot() {
  renderTree();
  buildRef();
  setBufferDisplay();
  updateReadout();
  renderHistory();
  Prefs.apply();
  handleShared();

  // Some safety: when document hidden, stop playback
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopTransmit();
  });
}
boot();
