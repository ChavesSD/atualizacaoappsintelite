"use client";
import { useEffect, useRef, useState } from "react";
import { HeroArt } from "./HeroArt";

type Three = typeof import("three");

/**
 * Totem de autoatendimento da Intelite em 3D (three.js), na abertura. É um modelo procedural baseado nas fotos do equipamento
 * real: aço preto fosco (pintura em pó), coluna reta com janela de saída da senha e a logo da Intelite em branco, cabeça
 * inclinada para trás com a tela, caixa de aço atrás da coluna (com aletas de ventilação) e base larga e baixa, para trás.
 * A tela mostra /totem-tela.png (imagem ilustrativa do aplicativo): para mostrar o app real, troque esse arquivo por uma
 * captura do totem na proporção 1080×1740. O cliente pode arrastar para girar; sem movimento quando o sistema pede menos
 * animação. Sem WebGL, cai no desenho em SVG.
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
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "pan-y"; // arrastar na horizontal gira; na vertical a página rola
  renderer.domElement.style.cursor = "grab";

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment() as never, 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 1.25;

  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 50);
  camera.position.set(0, 1.0, 4.9);
  camera.lookAt(0, 0.64, 0);

  // preto sobre preto precisa de luz de contorno: principal suave, recortes azul (marca) e frio, e luz de chão
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(-2.6, 3.4, 3.2); scene.add(key);
  const rimBlue = new THREE.DirectionalLight(0x5aa2ff, 2.6); rimBlue.position.set(3.2, 1.8, -2.6); scene.add(rimBlue);
  const rimCool = new THREE.DirectionalLight(0xbfd8ff, 1.6); rimCool.position.set(-3.4, 1.2, -2.2); scene.add(rimCool);
  const fill = new THREE.DirectionalLight(0xffffff, 0.9); fill.position.set(2.2, 0.6, 3.4); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T) => { disposables.push(o); return o; };

  // ── pintura em pó preta e fosca: textura fina de "areia" em relevo ──
  const grain = document.createElement("canvas"); grain.width = grain.height = 256;
  const gg = grain.getContext("2d")!; const gd = gg.createImageData(256, 256);
  for (let i = 0; i < gd.data.length; i += 4) { const v = 90 + Math.random() * 120; gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = v; gd.data[i + 3] = 255; }
  gg.putImageData(gd, 0, 0);
  const grainTex = track(new THREE.CanvasTexture(grain)); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.repeat.set(10, 10);
  const metal = track(new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, roughness: 0.5, metalness: 0.4, clearcoat: 0.28, clearcoatRoughness: 0.5, bumpMap: grainTex, bumpScale: 0.35 }));
  const metalBox = track(new THREE.MeshPhysicalMaterial({ color: 0x08090b, roughness: 0.44, metalness: 0.5, clearcoat: 0.2, bumpMap: grainTex, bumpScale: 0.25 }));
  const lip = track(new THREE.MeshStandardMaterial({ color: 0x1b1c21, roughness: 0.4, metalness: 0.6 }));
  const glossBlack = track(new THREE.MeshPhysicalMaterial({ color: 0x030304, roughness: 0.18, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const rubber = track(new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9, metalness: 0 }));

  const texLoader = new THREE.TextureLoader();
  const loadTex = (src: string) => new Promise<import("three").Texture | null>((res) => texLoader.load(src, (t) => res(t), undefined, () => res(null)));
  const [screenTex, logoImg] = await Promise.all([
    loadTex("/totem-tela.png"),
    new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = "/logo-intelite.webp"; }),
  ]);
  if (screenTex) { screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy(); track(screenTex); }

  const rbox = (w: number, h: number, d: number, r: number, mat: import("three").Material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(track(new RoundedBoxGeometry(w, h, d, 4, r)), mat); m.position.set(x, y, z); return m;
  };
  const plane = (w: number, h: number, mat: import("three").Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), mat); m.position.set(x, y, z); return m;
  };

  const totem = new THREE.Group();
  totem.position.y = 0.022; // pezinhos de borracha sob a base
  scene.add(totem);

  // ── medidas (em metros, a partir das fotos): coluna à frente, base larga e baixa para trás ──
  const COL_W = 0.36, COL_D = 0.23, COL_H = 0.8, BASE_Y = 0.05, COL_TOP = BASE_Y + COL_H, FRONT_Z = COL_D / 2;

  // base (pintura preta), com a frente alinhada à coluna, e quatro pezinhos
  totem.add(rbox(COL_W, BASE_Y, 0.56, 0.006, metal, 0, BASE_Y / 2, FRONT_Z - 0.28));
  for (const sx of [-0.14, 0.14]) for (const z of [FRONT_Z - 0.05, FRONT_Z - 0.51]) {
    const f = new THREE.Mesh(track(new THREE.CylinderGeometry(0.016, 0.016, 0.022, 14)), rubber); f.position.set(sx, -0.011, z); totem.add(f);
  }

  // coluna
  totem.add(rbox(COL_W, COL_H, COL_D, 0.007, metal, 0, BASE_Y + COL_H / 2, 0));
  // frestas da porta de manutenção (lado direito e fundo)
  const seamMat = track(new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const sideSeam = plane(0.003, COL_H - 0.12, seamMat, COL_W / 2 + 0.0006, BASE_Y + COL_H / 2 - 0.02, -0.02); sideSeam.rotation.y = Math.PI / 2; totem.add(sideSeam);
  const seam2 = plane(COL_W - 0.06, 0.003, seamMat, 0, BASE_Y + 0.17, FRONT_Z + 0.0006); totem.add(seam2);

  // janela de saída da senha (retângulo escuro, com moldura levemente mais clara)
  totem.add(rbox(0.098, 0.064, 0.006, 0.004, lip, 0, 0.695, FRONT_Z));
  totem.add(rbox(0.082, 0.048, 0.008, 0.003, glossBlack, 0, 0.695, FRONT_Z + 0.0005));

  // logo da Intelite em branco, empilhada (ícone acima, nome abaixo), como na pintura da coluna
  if (logoImg) {
    const w = 1000, ih = logoImg.naturalHeight, iw = logoImg.naturalWidth;
    const k = iw / 2000; // fatores a partir do arquivo 2000×738
    const lc = document.createElement("canvas"); lc.width = w; lc.height = 800;
    const lg = lc.getContext("2d")!;
    const ic = 560 * k * 1; // lado do ícone no original
    lg.drawImage(logoImg, 0, 60 * k, ic, ic, 270, 0, 460, 460);
    const tw = 1150 * k, th = 370 * k;
    lg.drawImage(logoImg, 640 * k, 190 * k, tw, th, 0, 480, 1000, 1000 * th / tw);
    void ih;
    const logoTex = track(new THREE.CanvasTexture(lc)); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;
    const lw = 0.21;
    totem.add(plane(lw, lw * 0.8, track(new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, color: 0xf2f2f2, toneMapped: false })), 0, 0.43, FRONT_Z + 0.0008));
  }

  // caixa de aço atrás da coluna (computador e impressora), com aletas de ventilação e etiqueta
  const back = new THREE.Group(); back.position.set(0, 0.47, -COL_D / 2 - 0.055); totem.add(back);
  back.add(rbox(0.2, 0.38, 0.11, 0.004, metalBox, 0, 0, 0));
  const slotMat = track(new THREE.MeshBasicMaterial({ color: 0x000000 }));
  for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) {
    const v = plane(0.0035, 0.07, slotMat, sx * (0.1 + 0.0007), -0.05, (i - 4) * 0.0105); v.rotation.y = (sx * Math.PI) / 2; back.add(v);
  }
  const label = plane(0.052, 0.066, track(new THREE.MeshStandardMaterial({ color: 0xaeb3bd, roughness: 0.8 })), 0.0, -0.085, -0.0555); label.rotation.y = Math.PI; back.add(label);
  const emblem = plane(0.03, 0.03, track(new THREE.MeshBasicMaterial({ color: 0x1b1c21 })), 0, 0.06, -0.0555); emblem.rotation.y = Math.PI; back.add(emblem);

  // cabeça: placa inclinada para trás, apoiada no alto da coluna
  const ALPHA = 0.58; // ~33° para trás
  const HL = 0.66, HW = COL_W, HT = 0.07; // tudo na mesma largura do tronco; só o tronco é mais espesso na lateral
  const head = new THREE.Group(); head.position.set(0, COL_TOP, FRONT_Z); head.rotation.x = -ALPHA; totem.add(head);
  head.add(rbox(HW, HL, HT, 0.008, metal, 0, HL / 2, -HT / 2));
  // abas laterais e borda superior (dobras da chapa)
  head.add(rbox(0.012, HL, HT + 0.012, 0.004, metal, HW / 2 - 0.004, HL / 2, -HT / 2 + 0.001));
  head.add(rbox(0.012, HL, HT + 0.012, 0.004, metal, -HW / 2 + 0.004, HL / 2, -HT / 2 + 0.001));
  // abertura da tela: moldura rebaixada, vidro e a imagem
  const SW = 0.27, SH = 0.45, SC = 0.345;
  head.add(rbox(SW + 0.018, SH + 0.018, 0.004, 0.004, lip, 0, SC, 0.0012));
  const screenMat = track(new THREE.MeshStandardMaterial({
    map: screenTex ?? null, emissiveMap: screenTex ?? null, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.78,
    color: screenTex ? 0xffffff : 0x14295c, roughness: 0.2, metalness: 0, envMapIntensity: 0.8,
  }));
  head.add(plane(SW, SH, screenMat, 0, SC, 0.0042));
  head.add(plane(SW, SH, track(new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.045, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02 })), 0, SC, 0.0052));
  // ventilação no verso da cabeça
  for (const gx of [-1, 1]) for (let i = 0; i < 12; i++) {
    const v = plane(0.0035, 0.085, slotMat, gx * 0.1 + (i - 5.5) * 0.011, 0.26, -HT - 0.0004); v.rotation.y = Math.PI; head.add(v);
  }

  // luz de piso e sombra de contato
  const gc = document.createElement("canvas"); gc.width = gc.height = 256;
  const gx = gc.getContext("2d")!; const gr = gx.createRadialGradient(128, 128, 6, 128, 128, 126);
  gr.addColorStop(0, "rgba(120,170,255,.30)"); gr.addColorStop(0.45, "rgba(76,155,255,.09)"); gr.addColorStop(1, "rgba(76,155,255,0)");
  gx.fillStyle = gr; gx.fillRect(0, 0, 256, 256);
  const pool = plane(1.7, 1.3, track(new THREE.MeshBasicMaterial({ map: track(new THREE.CanvasTexture(gc)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), 0, 0.001, -0.1);
  pool.rotation.x = -Math.PI / 2; scene.add(pool);
  const sc = document.createElement("canvas"); sc.width = sc.height = 256;
  const sg = sc.getContext("2d")!; const sgr = sg.createRadialGradient(128, 128, 10, 128, 128, 126);
  sgr.addColorStop(0, "rgba(0,0,0,.85)"); sgr.addColorStop(0.6, "rgba(0,0,0,.35)"); sgr.addColorStop(1, "rgba(0,0,0,0)");
  sg.fillStyle = sgr; sg.fillRect(0, 0, 256, 256);
  const shadow = plane(1.15, 1.35, track(new THREE.MeshBasicMaterial({ map: track(new THREE.CanvasTexture(sc)), transparent: true, depthWrite: false })), 0, 0.0025, -0.12);
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

  // ── movimento e interação ──
  const YAW0 = 0.62;
  let yaw = YAW0, vel = 0, dragging = false, lastX = 0, idleSince = performance.now(), pitch = 0, pitchTarget = 0;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const LIM = 3.2;
  const dom = renderer.domElement;
  const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; vel = 0; dom.setPointerCapture(e.pointerId); dom.style.cursor = "grabbing"; };
  const move = (e: PointerEvent) => {
    const r = dom.getBoundingClientRect();
    pitchTarget = clamp(((e.clientY - r.top) / r.height - 0.5) * -0.08, -0.05, 0.05);
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    yaw = clamp(yaw + dx * 0.009, -LIM, LIM); vel = dx * 0.009;
    if (reduce) renderOnce();
  };
  const up = (e: PointerEvent) => { if (!dragging) return; dragging = false; idleSince = performance.now(); try { dom.releasePointerCapture(e.pointerId); } catch { /* já liberado */ } dom.style.cursor = "grab"; };
  dom.addEventListener("pointerdown", down); dom.addEventListener("pointermove", move); dom.addEventListener("pointerup", up); dom.addEventListener("pointercancel", up);

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false); dom.style.width = "100%"; dom.style.height = "100%";
    camera.aspect = w / h;
    camera.position.z = clamp(4.9 * (0.72 / Math.min(camera.aspect, 1)) ** 0.7, 4.4, 8);
    camera.lookAt(0, 0.64, 0);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(() => { resize(); renderOnce(); });
  ro.observe(host);
  resize();

  // o ponto de apoio da rotação é o centro da base/coluna
  const pivot = new THREE.Group(); scene.add(pivot); pivot.add(totem); totem.position.z = 0.1;
  const apply = () => { pivot.rotation.y = yaw; pivot.rotation.x = pitch; shadow.rotation.z = -yaw * 0.1; renderer.render(scene, camera); };
  const renderOnce = () => apply();
  let raf = 0, visible = true;
  const t0 = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    if (!dragging) {
      if (Math.abs(vel) > 0.0004) { yaw = clamp(yaw + vel, -LIM, LIM); vel *= 0.93; }
      else if (!reduce && now - idleSince > 1800) { // volta a balançar devagar, retomando de onde parou
        const target = YAW0 + Math.sin((now - t0) / 2400) * 0.5;
        yaw += (target - yaw) * 0.012;
      }
    }
    pitch += (pitchTarget - pitch) * 0.06;
    apply();
  };
  const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; });
  io.observe(host);
  if (reduce) renderOnce(); else raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
    dom.removeEventListener("pointerdown", down); dom.removeEventListener("pointermove", move); dom.removeEventListener("pointerup", up); dom.removeEventListener("pointercancel", up);
    disposables.forEach((d) => d.dispose());
    env.dispose(); pmrem.dispose(); renderer.dispose();
    host.removeChild(renderer.domElement);
  };
}
