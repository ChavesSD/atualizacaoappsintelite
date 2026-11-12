"use client";
import { useEffect, useRef, useState } from "react";
import { LIP_LINE, LIP_X0 } from "./milly-lips";

/**
 * Milly, a guia do tutorial. É o avatar (imagem única) "vestido" por um pequeno esqueleto de animação:
 *  - boca desenhada por cima do rosto, aberta conforme o áudio do vídeo (linha do tempo gerada por video/lipsync.py);
 *  - piscar de olhos, respiração e balanço da cabeça; acenos de cabeça e inclinações nos instantes de ênfase da fala;
 *  - o texto do passo a passo ao lado faz o papel do balão de fala dela (a legenda e o texto não se repetem).
 * Tudo é guiado pelo relógio do <video> (currentTime), então a fala, a boca e os gestos ficam sempre juntos, inclusive ao avançar ou voltar.
 * Sem JavaScript de animação por quadro no React: os atributos do SVG são escritos direto (sem renderizar de novo a cada quadro).
 */

interface Timeline { fps: number; o: string; w: string; beats: number[]; pauses: number[] }

// ───────── geometria (coordenadas da imagem recortada: 940 × 1000) ─────────
const EYES = [{ x: 367, y: 336, hw: 52, top: 300, h: 74, plate: [290, 285, 150, 110] as const, id: "e" }, { x: 540, y: 334, hw: 58, top: 298, h: 74, plate: [455, 280, 170, 110] as const, id: "d" }];
const PIVOT = { x: 453, y: 580 };               // "pescoço": a cabeça gira em torno dele

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const f = (n: number) => n.toFixed(1);

// Boca: os lábios do próprio desenho (public/milly/labio-*.png) — o inferior desce em faixas verticais, acompanhando a curva do sorriso, e o vão
// é preenchido por dentro da boca (dentes e língua). Assim o acabamento 3D dos lábios (brilho, sombra) é o do original.
const STRIP = 2, STRIPS = Math.ceil(LIP_LINE.length / STRIP), HALF = LIP_LINE.length / 2, CX = LIP_X0 + HALF;
const lineAt = (x: number) => { const i = clamp((x - LIP_X0), 0, LIP_LINE.length - 1), a = Math.floor(i), b = Math.min(LIP_LINE.length - 1, a + 1); return LIP_LINE[a] + (LIP_LINE[b] - LIP_LINE[a]) * (i - a); };
const prof = (x: number) => Math.pow(Math.max(0, 1 - ((x - CX) / (HALF + 4)) ** 2), 0.7);
const STRIP_X = Array.from({ length: STRIPS }, (_, i) => LIP_X0 + i * STRIP);

/** Estado da boca para abertura `o` (0..1): descida de cada faixa do lábio inferior e contornos do vão, dos dentes e da língua. */
function mouth(o: number) {
  const dy = o * 30;
  const xs: number[] = [], top: number[] = [], bot: number[] = [], teeth: number[] = [];
  const tth = Math.min(dy * 0.5, 11);
  for (let i = 0; i <= LIP_LINE.length; i += 3) {
    const x = LIP_X0 + Math.min(i, LIP_LINE.length - 1);
    xs.push(x); top.push(lineAt(x) - 2); bot.push(lineAt(x) + dy * prof(x) + 2); teeth.push(lineAt(x) + tth * prof(x));
  }
  const poly = (a: number[], b: number[]) => `M${xs.map((x, i) => `${f(x)},${f(a[i])}`).join(" L")} L${xs.map((x, i) => `${f(x)},${f(b[i])}`).reverse().join(" L")} Z`;
  return {
    dys: STRIP_X.map((x) => dy * prof(x + STRIP / 2)),
    cavity: poly(top, bot), teeth: poly(top, teeth),
    tongueY: lineAt(CX) + dy * 0.9, tongueRy: Math.max(0.1, dy * 0.36),
    shade: poly(top, top.map((t, i) => t + Math.min(7, (bot[i] - t) * 0.5))),
  };
}

export function Milly({ video, mouth: mouthSrc, onStart }: { video: HTMLVideoElement | null; mouth: string | null; onStart: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const timeline = useRef<Timeline | null>(null);
  const videoRef = useRef(video); videoRef.current = video;

  useEffect(() => {
    let dead = false;
    if (mouthSrc) fetch(mouthSrc).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!dead && j) timeline.current = j; }).catch(() => {});
    return () => { dead = true; };
  }, [mouthSrc]);

  useEffect(() => {
    const s = svg.current; const box = root.current;
    if (!s || !box) return;
    const q = <T extends Element>(sel: string) => s.querySelector(sel) as T;
    const els = {
      body: q<SVGGElement>("#m-body"), head: q<SVGGElement>("#m-head"), mouth: q<SVGGElement>("#m-mouth"),
      cavity: q<SVGPathElement>("#m-cavity"), cavclip: q<SVGPathElement>("#m-cavclip-p"), teeth: q<SVGPathElement>("#m-teeth"), shade: q<SVGPathElement>("#m-shade"),
      tongue: q<SVGEllipseElement>("#m-tongue"), strips: Array.from(s.querySelectorAll<SVGImageElement>(".m-strip")), mouthScale: q<SVGGElement>("#m-mscale"),
      lids: EYES.map((e) => ({ g: q<SVGGElement>(`#m-lid-${e.id}`), clip: q<SVGRectElement>(`#m-clip-${e.id} rect`), lash: q<SVGPathElement>(`#m-lash-${e.id}`) })),
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, visible = true, last = performance.now() / 1000;
    let o = 0, w = 0.5;                                  // boca suavizada
    let ny = 0, nv = 0;                                  // aceno (mola)
    let tilt = 0, tiltV = 0, tiltTarget = 0;             // inclinação da cabeça
    let lean = 0, leanV = 0;                             // inclinação do corpo (ênfase maior)
    let blinkAt = last + 1.6, blinkStart = -9;
    let beatIdx = 0, beatCount = 0, pauseIdx = 0, prevT = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const now = performance.now() / 1000; const dt = Math.min(0.05, now - last); last = now;
      const v = videoRef.current; const tl = timeline.current;
      const playing = !!v && !v.paused && !v.ended && v.readyState > 2;
      const t = v ? v.currentTime : 0;

      // boca
      let to = 0, tw = 0.5;
      if (playing && tl) {
        const i = Math.min(tl.o.length - 1, Math.max(0, Math.floor((t + 0.02) * tl.fps)));
        to = (tl.o.charCodeAt(i) - 48) / 9; tw = (tl.w.charCodeAt(i) - 48) / 9;
        to = clamp(Math.pow(to, 1.35) * 0.95);
      }
      o += (to - o) * (1 - Math.exp(-dt * (to > o ? 38 : 22)));
      w += (tw - w) * (1 - Math.exp(-dt * 20));

      // gestos: ênfases e pausas da fala
      if (tl && (!playing || Math.abs(t - prevT) > 1)) {                // pulou no vídeo: reposiciona os ponteiros
        beatIdx = tl.beats.findIndex((b) => b > t); if (beatIdx < 0) beatIdx = tl.beats.length;
        pauseIdx = tl.pauses.findIndex((p) => p > t); if (pauseIdx < 0) pauseIdx = tl.pauses.length;
      }
      if (playing && tl) {
        while (beatIdx < tl.beats.length && tl.beats[beatIdx] <= t) {
          beatCount++; nv += (beatCount % 3 === 0 ? 70 : 38);
          if (beatCount % 3 === 0) leanV += (beatCount % 2 ? 5 : -5);
          beatIdx++;
        }
        while (pauseIdx < tl.pauses.length && tl.pauses[pauseIdx] <= t) { tiltTarget = tiltTarget > 0 ? -1.3 : 1.3; pauseIdx++; }
      } else tiltTarget = 0;
      prevT = t;
      const spring = (x: number, vel: number, k: number, c: number, target = 0): [number, number] => { vel += (-k * (x - target) - c * vel) * dt; return [x + vel * dt, vel]; };
      [ny, nv] = spring(ny, nv, 140, 15);
      [tilt, tiltV] = spring(tilt, tiltV, 40, 8, tiltTarget);
      [lean, leanV] = spring(lean, leanV, 30, 7);

      // piscar
      if (now >= blinkAt) { blinkStart = now; blinkAt = now + 2.2 + Math.random() * 3.6; if (Math.random() < 0.18) blinkAt = now + 0.45; }
      const bt = (now - blinkStart) / 0.18;
      const blink = bt < 0 || bt > 1 ? 0 : bt < 0.4 ? bt / 0.4 : 1 - (bt - 0.4) / 0.6;

      // movimento do corpo e da cabeça
      const m = reduce ? 0 : 1;
      const breathe = Math.sin(now * 1.7) * 1.6 * m;
      const sway = Math.sin(now * 0.9) * 0.45 * m;
      els.body.setAttribute("transform", `translate(470 1000) rotate(${f((lean * 0.12 + sway * 0.3) * m)}) scale(1 ${(1 + breathe * 0.0009).toFixed(4)}) translate(-470 -1000)`);
      els.head.setAttribute("transform", `translate(0 ${f(breathe * 0.5 + ny * 0.5 * m)}) rotate(${f((sway + tilt + ny * 0.06 + lean * 0.05) * m)} ${PIVOT.x} ${PIVOT.y})`);

      // boca
      const open = clamp((o - 0.03) / 0.07);
      els.mouth.setAttribute("opacity", open.toFixed(2));
      if (open > 0) {
        const g = mouth(o);
        els.cavity.setAttribute("d", g.cavity); els.cavclip.setAttribute("d", g.cavity); els.teeth.setAttribute("d", g.teeth); els.shade.setAttribute("d", g.shade);
        els.tongue.setAttribute("cy", f(g.tongueY)); els.tongue.setAttribute("ry", f(g.tongueRy));
        els.strips.forEach((im, i) => im.setAttribute("transform", `translate(0 ${g.dys[i].toFixed(2)})`));
        els.teeth.setAttribute("opacity", o > 0.12 ? "1" : "0");
        els.mouthScale.setAttribute("transform", `translate(${CX} 0) scale(${(0.9 + 0.14 * w - 0.05 * o).toFixed(3)} 1) translate(${-CX} 0)`);
      }
      // pálpebras
      EYES.forEach((e, i) => {
        const L = els.lids[i];
        L.g.setAttribute("opacity", blink > 0.02 ? "1" : "0");
        L.clip.setAttribute("height", f(e.h * blink));
        const y = e.top + e.h * blink;
        L.lash.setAttribute("d", `M${e.x - e.hw + 8},${f(y - 3 * blink)} Q${e.x},${f(y + 6 * blink)} ${e.x + e.hw - 8},${f(y - 3 * blink)}`);
        L.lash.setAttribute("opacity", blink > 0.35 ? "1" : "0");
      });

    };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(box);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  return (
    <div className="milly-wrap" ref={root}>
      <div className="milly">
        <button type="button" className="milly-avatar" onClick={onStart} aria-label="Ouvir a Milly explicar o passo a passo (iniciar o vídeo)">
          <svg ref={svg} viewBox="0 0 940 1000" aria-hidden focusable="false">
            <defs>
              <radialGradient id="m-fade" cx="0.5" cy="0.5" r="0.5"><stop offset="0.62" stopColor="#fff" /><stop offset="1" stopColor="#000" /></radialGradient>
              <mask id="m-headmask" maskUnits="userSpaceOnUse" x="0" y="0" width="940" height="1000">
                <rect width="940" height="1000" fill="#000" />
                <ellipse cx="455" cy="330" rx="335" ry="395" fill="url(#m-fade)" />
              </mask>
              <radialGradient id="m-eyefade" cx="0.5" cy="0.5" r="0.5"><stop offset="0.7" stopColor="#fff" /><stop offset="1" stopColor="#000" /></radialGradient>
              {EYES.map((e) => (
                <mask key={e.id} id={`m-eyemask-${e.id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="940" height="1000">
                  <ellipse cx={e.x} cy={e.y} rx={e.hw + 14} ry="46" fill="url(#m-eyefade)" />
                </mask>
              ))}
              {EYES.map((e) => <clipPath key={e.id} id={`m-clip-${e.id}`}><rect x={e.x - e.hw - 20} y={e.top - 14} width={e.hw * 2 + 40} height="0" /></clipPath>)}
              <clipPath id="m-cavclip"><path id="m-cavclip-p" d="" /></clipPath>
              <linearGradient id="m-cav" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a0a0d" /><stop offset="0.55" stopColor="#4a1418" /><stop offset="1" stopColor="#6e2226" /></linearGradient>
              <linearGradient id="m-tth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cfc2bb" /><stop offset="0.45" stopColor="#fbf4ef" /><stop offset="1" stopColor="#ecdfd7" /></linearGradient>
              <radialGradient id="m-tng" cx="0.5" cy="0.35" r="0.75"><stop offset="0" stopColor="#f09a93" /><stop offset="0.6" stopColor="#d4666a" /><stop offset="1" stopColor="#a8444a" /></radialGradient>
              {STRIP_X.map((x, i) => <clipPath key={i} id={`m-strip-${i}`}><rect x={x} y="400" width={STRIP + 0.4} height="190" /></clipPath>)}
            </defs>
            <g id="m-body"><image href="/milly/milly.webp" width="940" height="1000" /></g>
            <g id="m-head">
              <g mask="url(#m-headmask)"><image href="/milly/milly.webp" width="940" height="1000" /></g>
              {EYES.map((e) => (
                <g key={e.id} id={`m-lid-${e.id}`} opacity="0">
                  <g mask={`url(#m-eyemask-${e.id})`}><g clipPath={`url(#m-clip-${e.id})`}><image href={`/milly/olho-${e.id}.png`} x={e.plate[0]} y={e.plate[1]} width={e.plate[2]} height={e.plate[3]} /></g></g>
                  <path id={`m-lash-${e.id}`} d="" fill="none" stroke="#1d1210" strokeWidth="3.4" strokeLinecap="round" opacity="0" />
                </g>
              ))}
              <g id="m-mouth" opacity="0">
                <image href="/milly/boca.png" x="350" y="415" width="210" height="115" />
                <g id="m-mscale">
                  <path id="m-cavity" d="" fill="url(#m-cav)" />
                  <g clipPath="url(#m-cavclip)">
                    <ellipse id="m-tongue" cx={CX} cy="470" rx="30" ry="1" fill="url(#m-tng)" />
                    <path id="m-teeth" d="" fill="url(#m-tth)" opacity="0" />
                    <path id="m-shade" d="" fill="#1a0507" opacity="0.55" />
                  </g>
                  {Array.from({ length: STRIPS }, (_, i) => (
                    <g key={i} clipPath={`url(#m-strip-${i})`}><image className="m-strip" href="/milly/labio-inf.png" x="350" y="415" width="210" height="115" /></g>
                  ))}
                  <image href="/milly/labio-sup.png" x="350" y="415" width="210" height="115" />
                </g>
              </g>
            </g>
          </svg>
        </button>
      </div>
    </div>
  );
}
