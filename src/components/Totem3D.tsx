"use client";
import { useEffect, useRef, useState } from "react";
import { HeroArt } from "./HeroArt";

type Three = typeof import("three");

/**
 * Totem de autoatendimento da Intelite em 3D (three.js), no lugar da pré-visualização do vídeo na abertura.
 * Modelo procedural: corpo branco acetinado, tela inclinada, impressora de senha com a senha saindo e a logo da Intelite na
 * estrutura de baixo. A tela usa /totem-tela.png (imagem ilustrativa): para mostrar o aplicativo real, basta trocar esse arquivo
 * por uma captura de tela do totem na proporção 1080×1900.
 * O cliente pode arrastar para girar; sem movimento quando o sistema pede menos animação. Sem WebGL, cai no desenho em SVG.
 */
export function Totem3D() {
  const box = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "ready" | "fallback">("loading");

  useEffect(() => {
    let disposed = false;
    let stop: () => void = () => {};
    (async () => {
      try {
        const THREE = await import("three");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
        const { RoundedBoxGeometry } = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
        if (disposed || !box.current) return;
        stop = await build(THREE, RoomEnvironment, RoundedBoxGeometry, box.current);
        if (disposed) { stop(); return; }
        setMode("ready");
      } catch {
        if (!disposed) setMode("fallback");
      }
    })();
    return () => { disposed = true; stop(); };
  }, []);

  if (mode === "fallback") return <div className="totem-fallback"><HeroArt /></div>;
  return (
    <div className={`totem3d ${mode}`} role="img" aria-label="Totem de autoatendimento da Intelite, modelo 3D. Arraste para girar.">
      <div ref={box} className="totem3d-canvas" aria-hidden />
      <span className="totem3d-hint" aria-hidden>Arraste para girar</span>
    </div>
  );
}

type RoundedBox = new (w: number, h: number, d: number, segments: number, radius: number) => import("three").BufferGeometry;
type RoomEnv = new () => import("three").Scene;

async function build(THREE: Three, RoomEnvironment: RoomEnv, RoundedBoxGeometry: RoundedBox, host: HTMLDivElement): Promise<() => void> {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "pan-y"; // arrastar na horizontal gira; na vertical a página rola
  renderer.domElement.style.cursor = "grab";

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment() as never, 0.04).texture;
  scene.environment = env;

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50);
  camera.position.set(0, 1.1, 5.7);
  camera.lookAt(0, 0.93, 0);

  // luzes: principal suave, recorte azul da marca por trás e preenchimento
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(2.4, 3.2, 3.6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6aaeff, 1.6); rim.position.set(-3, 1.8, -2.4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };

  // ── materiais ──
  const white = track(new THREE.MeshPhysicalMaterial({ color: 0xf1f2f5, roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.28 }));
  const lightGrey = track(new THREE.MeshPhysicalMaterial({ color: 0xdadde3, roughness: 0.45, metalness: 0.05, clearcoat: 0.3 }));
  const dark = track(new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.55, metalness: 0.25 }));

  const texLoader = new THREE.TextureLoader();
  const loadTex = (src: string) => new Promise<import("three").Texture | null>((res) => texLoader.load(src, (t) => res(t), undefined, () => res(null)));
  const [screenTex, logoImg] = await Promise.all([
    loadTex("/totem-tela.png"),
    new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = "/logo-intelite.webp"; }),
  ]);
  if (screenTex) { screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy(); track(screenTex); }

  const box = (w: number, h: number, d: number, r: number, mat: import("three").Material, x = 0, y = 0, z = 0) => {
    const g = track(new RoundedBoxGeometry(w, h, d, 6, r));
    const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); return m;
  };

  const totem = new THREE.Group();
  scene.add(totem);

  // base, coluna e módulo da impressora
  totem.add(box(0.66, 0.04, 0.5, 0.016, lightGrey, 0, 0.02, 0.02));
  totem.add(box(0.33, 0.74, 0.2, 0.035, white, 0, 0.41, 0));
  const printer = box(0.46, 0.22, 0.28, 0.035, white, 0, 0.89, 0.01);
  totem.add(printer);
  // fenda da impressora e a senha saindo
  totem.add(box(0.3, 0.032, 0.03, 0.012, dark, 0, 0.925, 0.145));
  const ticketCanvas = document.createElement("canvas"); ticketCanvas.width = 256; ticketCanvas.height = 400;
  const tg = ticketCanvas.getContext("2d")!;
  tg.fillStyle = "#fbfcfe"; tg.fillRect(0, 0, 256, 400);
  tg.fillStyle = "#0f2a56"; tg.textAlign = "center"; tg.font = "700 44px system-ui, Arial"; tg.fillText("SENHA", 128, 70);
  tg.font = "800 110px system-ui, Arial"; tg.fillText("A047", 128, 190);
  tg.fillStyle = "#c5cbd8"; for (let i = 0; i < 4; i++) tg.fillRect(40, 235 + i * 26, i % 2 ? 150 : 176, 8);
  const ticketTex = track(new THREE.CanvasTexture(ticketCanvas)); ticketTex.colorSpace = THREE.SRGBColorSpace;
  const ticket = new THREE.Mesh(track(new THREE.PlaneGeometry(0.13, 0.2)), track(new THREE.MeshStandardMaterial({ map: ticketTex, roughness: 0.9 })));
  ticket.position.set(0.02, 0.83, 0.165); ticket.rotation.set(0.18, 0, -0.04);
  totem.add(ticket);

  // logo da Intelite na estrutura de baixo (a logo é branca: pinta de azul-marinho para aparecer no corpo branco)
  if (logoImg) {
    const lc = document.createElement("canvas"); lc.width = 900; lc.height = Math.round(900 * logoImg.naturalHeight / logoImg.naturalWidth);
    const lg = lc.getContext("2d")!;
    lg.drawImage(logoImg, 0, 0, lc.width, lc.height);
    lg.globalCompositeOperation = "source-in"; lg.fillStyle = "#12295a"; lg.fillRect(0, 0, lc.width, lc.height);
    const logoTex = track(new THREE.CanvasTexture(lc)); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
    const lw = 0.23;
    const logo = new THREE.Mesh(track(new THREE.PlaneGeometry(lw, lw * lc.height / lc.width)), track(new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false })));
    logo.position.set(0, 0.25, 0.1015);
    totem.add(logo);
    // filete azul discreto acima da logo
    const line = new THREE.Mesh(track(new THREE.PlaneGeometry(0.13, 0.006)), track(new THREE.MeshBasicMaterial({ color: 0x4c9bff, toneMapped: false })));
    line.position.set(0, 0.34, 0.1015);
    totem.add(line);
  }

  // cabeça: tela inclinada para trás
  const head = new THREE.Group(); head.position.set(0, 1.0, -0.01); head.rotation.x = -0.1; totem.add(head);
  head.add(box(0.54, 0.88, 0.14, 0.04, white, 0, 0.44, 0));
  head.add(box(0.488, 0.805, 0.02, 0.014, dark, 0, 0.44, 0.066));
  const screenMat = track(new THREE.MeshStandardMaterial({
    map: screenTex ?? null, emissiveMap: screenTex ?? null, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.85,
    color: screenTex ? 0xffffff : 0x14295c, roughness: 0.16, metalness: 0, envMapIntensity: 0.9,
  }));
  const screen = new THREE.Mesh(track(new THREE.PlaneGeometry(0.455, 0.775)), screenMat);
  screen.position.set(0, 0.44, 0.0772);
  head.add(screen);
  // reflexo suave do vidro
  const glass = new THREE.Mesh(track(new THREE.PlaneGeometry(0.455, 0.775)), track(new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 })));
  glass.position.set(0, 0.44, 0.0782);
  head.add(glass);

  // sombra de contato no chão
  const sc = document.createElement("canvas"); sc.width = sc.height = 256;
  const sg = sc.getContext("2d")!; const grd = sg.createRadialGradient(128, 128, 8, 128, 128, 126);
  grd.addColorStop(0, "rgba(0,0,0,.55)"); grd.addColorStop(0.55, "rgba(0,0,0,.2)"); grd.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = grd; sg.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(track(new THREE.PlaneGeometry(1.5, 1.1)), track(new THREE.MeshBasicMaterial({ map: track(new THREE.CanvasTexture(sc)), transparent: true, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, 0.002, 0.02);
  scene.add(shadow);

  // ── movimento e interação ──
  let yaw = 0.42, vel = 0, dragging = false, lastX = 0, idleSince = performance.now(), pitch = 0, pitchTarget = 0;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const dom = renderer.domElement;
  const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; vel = 0; dom.setPointerCapture(e.pointerId); dom.style.cursor = "grabbing"; };
  const move = (e: PointerEvent) => {
    const r = dom.getBoundingClientRect();
    pitchTarget = clamp(((e.clientY - r.top) / r.height - 0.5) * -0.08, -0.05, 0.05);
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    yaw = clamp(yaw + dx * 0.009, -1.1, 1.1); vel = dx * 0.009;
  };
  const up = (e: PointerEvent) => { if (!dragging) return; dragging = false; idleSince = performance.now(); try { dom.releasePointerCapture(e.pointerId); } catch { /* já liberado */ } dom.style.cursor = "grab"; };
  dom.addEventListener("pointerdown", down); dom.addEventListener("pointermove", move); dom.addEventListener("pointerup", up); dom.addEventListener("pointercancel", up);
  // teclado: setas giram (o elemento fica "dentro" de um role=img, então o foco fica no contêiner pai)
  const key2 = (e: KeyboardEvent) => { if (e.key === "ArrowLeft") yaw = clamp(yaw - 0.12, -1.1, 1.1); if (e.key === "ArrowRight") yaw = clamp(yaw + 0.12, -1.1, 1.1); idleSince = performance.now(); renderOnce(); };
  window.addEventListener("keydown", key2);

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false); dom.style.width = "100%"; dom.style.height = "100%";
    camera.aspect = w / h;
    // enquadra o totem inteiro mesmo em caixas mais largas ou mais estreitas
    camera.position.z = clamp(5.7 * (0.62 / Math.min(camera.aspect, 0.9)) ** 0.6, 5.0, 8.5);
    camera.lookAt(0, 0.93, 0);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(() => { resize(); renderOnce(); });
  ro.observe(host);
  resize();

  const apply = () => { totem.rotation.y = yaw; totem.rotation.x = pitch; shadow.rotation.z = -yaw * 0.2; renderer.render(scene, camera); };
  const renderOnce = () => apply();
  let raf = 0, visible = true;
  let t0 = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    const idle = now - idleSince;
    if (!dragging) {
      if (Math.abs(vel) > 0.0004) { yaw = clamp(yaw + vel, -1.1, 1.1); vel *= 0.92; }
      else if (!reduce && idle > 1800) { // volta a balançar devagar, retomando de onde parou
        const target = Math.sin((now - t0) / 2600) * 0.34 + 0.2;
        yaw += (target - yaw) * 0.015;
      }
    }
    pitch += (pitchTarget - pitch) * 0.06;
    apply();
  };
  const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; });
  io.observe(host);
  if (reduce) { renderOnce(); } else { raf = requestAnimationFrame(tick); }
  if (reduce) { dom.addEventListener("pointermove", () => { if (dragging) renderOnce(); }); }
  t0 = performance.now();

  return () => {
    cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
    window.removeEventListener("keydown", key2);
    dom.removeEventListener("pointerdown", down); dom.removeEventListener("pointermove", move); dom.removeEventListener("pointerup", up); dom.removeEventListener("pointercancel", up);
    disposables.forEach((d) => d.dispose());
    env.dispose(); pmrem.dispose(); renderer.dispose();
    host.removeChild(renderer.domElement);
  };
}
