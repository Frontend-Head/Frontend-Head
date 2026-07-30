#!/usr/bin/env node

// Baut die Terminal-Animation für den README-Header: assets/terminal-dark.svg
// und assets/terminal-light.svg. Aufruf:
//
//   node scripts/build-terminal-svg.mjs
//
// Läuft ohne Dependencies und ohne Workflow - die Ausgabe ändert sich nur, wenn
// SESSION hier unten geändert wird. Danach neu bauen und beide SVGs committen.
//
// Warum so und nicht anders:
//
// * GitHub proxyt Bilder, lässt SMIL-Animationen darin aber laufen (dieselbe
//   Grundlage, auf der die Snake im README funktioniert). CSS-Animationen und
//   JavaScript sind dagegen keine Option.
// * Getippt wird über einen clipPath, dessen Rechteck zeichenweise breiter
//   wird - calcMode="discrete" macht daraus einen Anschlag pro Zeichen statt
//   eines weichen Aufziehens.
// * Alle Zeiten sind absolut ausgerechnet. Verkettung über begin="x.end" wäre
//   kürzer, hängt aber an Event-Semantik, die zwischen Renderern abweicht.
// * Jede Textzeile bekommt textLength - dadurch stimmt die Breite exakt mit
//   CHAR_W überein, egal welche Monospace-Schrift der Betrachter auflöst. Ohne
//   das würde der clipPath je nach Schrift mitten im Zeichen schneiden.
// * Die Sequenz läuft einmal und bleibt stehen. Ein dauerhaft tippendes README
//   liest sich schlecht, und ein SMIL-Neustart der ganzen Kette ist unzuverlässig.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROMPT = "philipp@github:~$ ";

const SESSION = [
  { cmd: "whoami" },
  { out: "Philipp — Web- & Fullstack-Entwickler" },
  { cmd: "cat stack.txt" },
  { out: "TypeScript · React · Next.js · Node.js" },
  { cmd: "ls projekte/" },
  { out: "devspace/   misc-encoder/", accent: true },
  { idle: true },
];

const FONT =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
const FONT_SIZE = 15;
const CHAR_W = 9; // per textLength erzwungen, siehe oben
const LINE_H = 23;
const BLOCK_GAP = 9; // Luft vor jedem neuen Prompt
const PAD_X = 20;
const PAD_BOTTOM = 20;
const HEAD_H = 40; // Titelleiste mit den drei Punkten

const START_DELAY = 0.5;
const PER_CHAR = 0.055;
const AFTER_CMD = 0.35; // Pause zwischen Kommando und Ausgabe
const AFTER_OUT = 0.45; // Pause zwischen Ausgabe und nächstem Prompt
const BLINK = 1.06;

const THEMES = {
  dark: {
    bg: "#0d1117",
    border: "#30363d",
    separator: "#21262d",
    prompt: "#7ee787",
    cmd: "#e6edf3",
    out: "#8b949e",
    accent: "#79c0ff",
    cursor: "#58a6ff",
  },
  light: {
    bg: "#ffffff",
    border: "#d0d7de",
    separator: "#eaeef2",
    prompt: "#1a7f37",
    cmd: "#1f2328",
    out: "#656d76",
    accent: "#0969da",
    cursor: "#0969da",
  },
};

const DOTS = ["#ff5f57", "#febc2e", "#28c840"];

const escapeXml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const round = (n) => Number(n.toFixed(3));

// Layout und Zeitplan in einem Durchgang: beides hängt an derselben Reihenfolge.
function plan() {
  const steps = [];
  let y = HEAD_H + 22;
  let t = START_DELAY;
  let maxChars = 0;

  SESSION.forEach((entry, index) => {
    if ((entry.cmd || entry.idle) && index > 0) y += BLOCK_GAP;

    if (entry.cmd) {
      const dur = entry.cmd.length * PER_CHAR;
      steps.push({ kind: "cmd", text: entry.cmd, y, begin: t, dur });
      maxChars = Math.max(maxChars, PROMPT.length + entry.cmd.length);
      t += dur + AFTER_CMD;
    } else if (entry.out) {
      steps.push({ kind: "out", text: entry.out, y, begin: t, accent: entry.accent });
      maxChars = Math.max(maxChars, entry.out.length);
      t += AFTER_OUT;
    } else {
      steps.push({ kind: "idle", y, begin: t });
      maxChars = Math.max(maxChars, PROMPT.length + 1);
    }

    y += LINE_H;
  });

  return {
    steps,
    width: Math.round(PAD_X * 2 + maxChars * CHAR_W),
    height: y - LINE_H + PAD_BOTTOM,
  };
}

function textEl({ x, y, text, fill, extra = "" }) {
  return (
    `<text x="${x}" y="${y}" fill="${fill}" font-family="${FONT}" ` +
    `font-size="${FONT_SIZE}" textLength="${text.length * CHAR_W}" ` +
    `lengthAdjust="spacing" xml:space="preserve"${extra}>${escapeXml(text)}</text>`
  );
}

function render(theme, layout) {
  const c = THEMES[theme];
  const { steps, width, height } = layout;
  const promptW = PROMPT.length * CHAR_W;
  const body = [];
  const clips = [];

  steps.forEach((step, i) => {
    if (step.kind === "out") {
      // Ausgabe erscheint als Block, nicht getippt - so verhält sich ein
      // Terminal auch.
      body.push(
        `<g opacity="0">` +
          `<set attributeName="opacity" to="1" begin="${round(step.begin)}s" fill="freeze" />` +
          textEl({
            x: PAD_X,
            y: step.y,
            text: step.text,
            fill: step.accent ? c.accent : c.out,
          }) +
          `</g>`
      );
      return;
    }

    // Prompt erscheint sofort, das Kommando wird darunter durchgetippt.
    const parts = [
      `<set attributeName="opacity" to="1" begin="${round(step.begin)}s" fill="freeze" />`,
      textEl({ x: PAD_X, y: step.y, text: PROMPT, fill: c.prompt }),
    ];

    if (step.kind === "cmd") {
      const n = step.text.length;
      const widths = [];
      const positions = [];
      for (let k = 0; k <= n; k++) {
        widths.push(k * CHAR_W);
        positions.push(PAD_X + promptW + k * CHAR_W);
      }

      clips.push(
        `<clipPath id="type-${i}">` +
          `<rect x="${PAD_X + promptW}" y="${step.y - FONT_SIZE}" ` +
          `width="0" height="${FONT_SIZE + 6}">` +
          `<animate attributeName="width" begin="${round(step.begin)}s" ` +
          `dur="${round(step.dur)}s" calcMode="discrete" ` +
          `values="${widths.join(";")}" fill="freeze" />` +
          `</rect>` +
          `</clipPath>`
      );

      parts.push(
        textEl({
          x: PAD_X + promptW,
          y: step.y,
          text: step.text,
          fill: c.cmd,
          extra: ` clip-path="url(#type-${i})"`,
        })
      );

      // Cursor wandert mit dem Anschlag mit und verschwindet danach: das <set>
      // hat eine Dauer und kein fill, die Deckkraft fällt am Ende zurück auf 0.
      parts.push(
        `<rect y="${step.y - FONT_SIZE + 1}" width="${CHAR_W - 1}" ` +
          `height="${FONT_SIZE + 2}" fill="${c.cursor}" opacity="0" ` +
          `x="${PAD_X + promptW}">` +
          `<set attributeName="opacity" to="1" begin="${round(step.begin)}s" ` +
          `dur="${round(step.dur)}s" />` +
          `<animate attributeName="x" begin="${round(step.begin)}s" ` +
          `dur="${round(step.dur)}s" calcMode="discrete" ` +
          `values="${positions.join(";")}" fill="freeze" />` +
          `</rect>`
      );
    } else {
      // Endzustand: Cursor bleibt am Prompt stehen und blinkt weiter. Vor
      // begin greift das opacity-Attribut, der Cursor ist also unsichtbar.
      parts.push(
        `<rect x="${PAD_X + promptW}" y="${step.y - FONT_SIZE + 1}" ` +
          `width="${CHAR_W - 1}" height="${FONT_SIZE + 2}" fill="${c.cursor}" ` +
          `opacity="0">` +
          `<animate attributeName="opacity" begin="${round(step.begin)}s" ` +
          `dur="${BLINK}s" values="1;1;0;0" repeatCount="indefinite" />` +
          `</rect>`
      );
    }

    body.push(`<g opacity="0">${parts.join("")}</g>`);
  });

  const dots = DOTS.map(
    (fill, i) => `<circle cx="${20 + i * 18}" cy="20" r="5.5" fill="${fill}" />`
  ).join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img">\n` +
    `<title>Terminal-Sitzung: whoami, cat stack.txt, ls projekte/</title>\n` +
    `<defs>${clips.join("")}</defs>\n` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" ` +
    `fill="${c.bg}" stroke="${c.border}" />\n` +
    `<line x1="1" y1="${HEAD_H}" x2="${width - 1}" y2="${HEAD_H}" ` +
    `stroke="${c.separator}" shape-rendering="crispEdges" />\n` +
    dots +
    `\n` +
    body.join("\n") +
    `\n</svg>\n`
  );
}

const assets = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const layout = plan();

for (const theme of Object.keys(THEMES)) {
  const file = join(assets, `terminal-${theme}.svg`);
  writeFileSync(file, render(theme, layout), "utf8");
  console.log(`${file}  ${layout.width}x${layout.height}`);
}
