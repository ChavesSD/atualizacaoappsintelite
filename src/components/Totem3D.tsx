"use client";
import { useEffect, useRef, useState } from "react";
import { HeroArt } from "./HeroArt";

type Three = typeof import("three");

/**
 * Totem de autoatendimento da Intelite em 3D (three.js), na abertura. É um modelo procedural baseado nas fotos do equipamento
 * real: aço preto fosco (pintura em pó), coluna reta com janela de saída da senha e a logo da Intelite em branco, cabeça
 * inclinada para trás com a tela, caixa de aço atrás da coluna (com aletas de ventilação) e base larga e baixa, para trás.
 * A tela mostra /totem-tela.png (captura do layout real do aplicativo no totem): para mostrar o app real, troque esse arquivo por uma
 * captura do totem na proporção 1080×1740. O cliente pode arrastar para girar; sem movimento quando o sistema pede menos
 * animação. Sem WebGL, cai no desenho em SVG.
 */
export function Totem3D() {
  const box = useRef<HTMLDivElement>(null);
  const handle = useRef<{ print: () => void } | null>(null);
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
        const built = await build(THREE, RoomEnvironment, RoundedBoxGeometry, box.current);
        stop = built.stop; handle.current = built;
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
    <>
      <div className={`totem3d ${mode}`} role="img" aria-label="Totem de autoatendimento da Intelite, modelo 3D. Arraste para girar.">
        <div ref={box} className="totem3d-canvas" aria-hidden />
        <span className="totem3d-hint" aria-hidden>Arraste para girar · toque na tela para tirar uma senha</span>
      </div>
      <button type="button" className="visually-hidden" onClick={() => handle.current?.print()}>Tirar uma senha no totem (brincadeira)</button>
    </>
  );
}

type RoundedBox = new (w: number, h: number, d: number, segments: number, radius: number) => import("three").BufferGeometry;
type RoomEnv = new () => import("three").Scene;

async function build(THREE: Three, RoomEnvironment: RoomEnv, RoundedBoxGeometry: RoundedBox, host: HTMLDivElement): Promise<{ stop: () => void; print: () => void }> {
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
  const [screenTex, logoImg, printTex] = await Promise.all([
    loadTex("/totem-tela.png"),
    new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = "/logo-intelite.webp"; }),
    loadTex("/totem-impressao.png"),
  ]);
  if (printTex) { printTex.colorSpace = THREE.SRGBColorSpace; printTex.anisotropy = renderer.capabilities.getMaxAnisotropy(); track(printTex); }
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
  const COL_W = 0.36, COL_D = 0.1, COL_H = 0.8, BASE_Y = 0.05, COL_TOP = BASE_Y + COL_H, FRONT_Z = COL_D / 2;
  const ALPHA = 0.58; // inclinação da cabeça para trás (~33°)
  const HL = 0.66, HW = COL_W, HT = COL_D; // base, tronco e cabeça: mesma largura (frente) e tronco com a mesma espessura da cabeça (lateral)

  // corpo em peça única: o perfil lateral (base + tronco + cabeça inclinada) é extrudado na largura, com cantos suavizados,
  // sem emendas entre base, tronco e tela
  const BASE_L = 0.56, ZB = FRONT_Z - BASE_L, sa = Math.sin(ALPHA), ca = Math.cos(ALPHA);
  const K: [number, number] = [FRONT_Z, COL_TOP];
  const P2: [number, number] = [K[0] - HL * sa, K[1] + HL * ca];            // topo da face da tela
  const P3: [number, number] = [P2[0] - HT * ca, P2[1] - HT * sa];          // topo do verso da cabeça
  const sBack = (-COL_D / 2 - P3[0]) / sa;                                   // onde o verso da cabeça encontra o verso do tronco
  const J: [number, number] = [-COL_D / 2, P3[1] - sBack * ca];
  const prof = new THREE.Shape();
  prof.moveTo(ZB, 0); prof.lineTo(FRONT_Z, 0); prof.lineTo(K[0], K[1]); prof.lineTo(P2[0], P2[1]); prof.lineTo(P3[0], P3[1]);
  prof.lineTo(J[0], J[1]); prof.lineTo(-COL_D / 2, BASE_Y); prof.lineTo(ZB, BASE_Y); prof.closePath();
  const BEV = 0.007;
  const bodyGeo = track(new THREE.ExtrudeGeometry(prof, { depth: COL_W - BEV * 2, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelOffset: -BEV, bevelSegments: 4, curveSegments: 4 }));
  bodyGeo.translate(0, 0, -(COL_W - BEV * 2) / 2);
  bodyGeo.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(bodyGeo, metal);
  bodyMesh.rotation.y = -Math.PI / 2; // o perfil (x = profundidade, y = altura) passa a ficar no plano z–y, extrudado em x
  totem.add(bodyMesh);
  // quatro pezinhos de borracha sob a base
  for (const sx of [-0.14, 0.14]) for (const z of [FRONT_Z - 0.05, ZB + 0.05]) {
    const f = new THREE.Mesh(track(new THREE.CylinderGeometry(0.016, 0.016, 0.022, 14)), rubber); f.position.set(sx, -0.011, z); totem.add(f);
  }

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
  const head = new THREE.Group(); head.position.set(0, COL_TOP, FRONT_Z); head.rotation.x = -ALPHA; totem.add(head);
  // abertura da tela: moldura rebaixada, vidro e a imagem
  const SW = 0.27, SH = 0.481, SC = 0.345; // proporção da imagem da tela (996×1775)
  head.add(rbox(SW + 0.018, SH + 0.018, 0.004, 0.004, lip, 0, SC, 0.0012));
  // a tela emite luz própria: cores fiéis à imagem, sem passar pela iluminação nem pelo tone mapping (sem brilho nem contraste exagerados)
  const screenMat = track(new THREE.MeshBasicMaterial({ map: screenTex ?? null, color: screenTex ? 0xf2f2f2 : 0x14295c, toneMapped: false }));
  const screenPlane = plane(SW, SH, screenMat, 0, SC, 0.0042);
  head.add(screenPlane);
  // tela de impressão da senha: aparece por cima da tela do app quando alguém toca na tela do totem
  const printMat = track(new THREE.MeshBasicMaterial({ map: printTex ?? null, color: 0xf2f2f2, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
  const printPlane = plane(SW, SH, printMat, 0, SC, 0.0047);
  printPlane.visible = false;
  head.add(printPlane);
  head.add(plane(SW, SH, track(new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.012, roughness: 0.2, metalness: 0, clearcoat: 0.2, clearcoatRoughness: 0.3, envMapIntensity: 0.15 })), 0, SC, 0.0052));
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

  // ── senhas: tocar na tela imprime uma senha (no modelo real do totem) pela janela; o papel sai, flutua até a frente da câmera
  // e cresce para dar para ler; depois sobe e some. Um papel por vez: tocar de novo dispensa o atual e imprime a próxima ──
  type Ticket = { g: import("three").Group; mesh: import("three").Mesh; mat: import("three").MeshBasicMaterial; tex: import("three").Texture;
    state: "print" | "float" | "hold" | "leave"; t: number; p0: import("three").Vector3; q0: import("three").Quaternion; s0: number };
  const tickets: Ticket[] = [];
  const PW = 0.078, PH = 0.088, SLOT_Y = 0.695;
  let counter = 1, queued = 0;                              // a tela de impressão mostra D2: a primeira senha emitida é a D2
  const paperGeo = track(new THREE.PlaneGeometry(PW, PH)); paperGeo.translate(0, -PH / 2, 0); // a origem é a borda de cima (a que sai da janela)
  let QR: ((text: string) => { n: number; dark: (r: number, c: number) => boolean }) | null = null;
  import("qrcode-generator").then((m) => {
    const make = (m.default ?? m) as unknown as (t: number, l: string) => { addData: (d: string) => void; make: () => void; getModuleCount: () => number; isDark: (r: number, c: number) => boolean };
    QR = (text: string) => { const q = make(0, "M"); q.addData(text); q.make(); return { n: q.getModuleCount(), dark: (r, c) => q.isDark(r, c) }; };
  }).catch(() => { /* sem QR, o resto da senha continua igual */ });

  /** Senha no modelo real: logo, dados da empresa, tipo de atendimento, número, data/hora, QR code e endereço de acompanhamento. */
  const makePaperTexture = (n: number) => {
    const W = 600, H = 680;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fdfdfc"; g.fillRect(0, 0, W, H);
    const ink = "#14171f";
    if (logoImg) {                                         // logo branca → escura (papel branco)
      const lw = 190, lh = lw * logoImg.naturalHeight / logoImg.naturalWidth;
      const t = document.createElement("canvas"); t.width = Math.round(lw * 2); t.height = Math.round(lh * 2);
      const tg = t.getContext("2d")!; tg.drawImage(logoImg, 0, 0, t.width, t.height);
      tg.globalCompositeOperation = "source-in"; tg.fillStyle = "#1c2a4a"; tg.fillRect(0, 0, t.width, t.height);
      g.drawImage(t, (W - lw) / 2, 16, lw, lh);
    }
    g.fillStyle = ink; g.textAlign = "center";
    const now = new Date();
    const line = (txt: string, y: number, font: string) => { g.font = font; g.fillText(txt, W / 2, y); };
    const sans = "system-ui, 'Segoe UI', Arial, sans-serif";
    line("CNPJ: 31.953.393/0001-81", 142, `500 25px ${sans}`);
    line("INTELITE", 172, `500 25px ${sans}`);
    line("R. CARTEIRO OLIVIO PONTES 575", 202, `500 25px ${sans}`);
    line("Telefones: (83) 3512 5222", 232, `500 25px ${sans}`);
    line("ATENDIMENTO MÉDICO", 292, `800 33px ${sans}`);
    line(`D${n}`, 382, `800 96px ${sans}`);
    const dd = now.toLocaleDateString("pt-BR"), hh = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    line(`Emitida em ${dd} às ${hh}`, 426, `500 24px ${sans}`);
    if (QR) {                                              // QR code real, apontando para o acompanhamento da senha
      const q = QR("https://www.atendimentointeligente.com.br");
      const size = 150, cell = size / (q.n + 2), x0 = (W - size) / 2, y0 = 442;
      g.fillStyle = "#fff"; g.fillRect(x0, y0, size, size); g.fillStyle = "#000";
      for (let r = 0; r < q.n; r++) for (let cc = 0; cc < q.n; cc++) if (q.dark(r, cc)) g.fillRect(x0 + (cc + 1) * cell, y0 + (r + 1) * cell, cell + 0.4, cell + 0.4);
    }
    g.fillStyle = ink;
    line("Escaneie para acompanhar sua senha", 624, `500 23px ${sans}`);
    line("www.atendimentointeligente.com.br", 654, `500 23px ${sans}`);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
  };
  const print = () => {
    if (reduce) return;
    const active = tickets.filter((o) => o.state !== "leave");
    if (active.length) { queued = 1; active.forEach(dismiss); return; }
    if (tickets.length) { queued = 1; return; }           // o anterior ainda está saindo: imprime logo depois
    emit();
  };
  const dismiss = (k: Ticket) => { if (k.state === "leave") return; k.state = "leave"; k.t = 0; if (!k.g.parent || k.g.parent === totem) scene.attach(k.g); k.p0.copy(k.g.position); k.s0 = k.g.scale.x; };
  const emit = () => {
    counter += 1;
    const tex = makePaperTexture(counter);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, toneMapped: false });
    const mesh = new THREE.Mesh(paperGeo, mat);
    const g = new THREE.Group(); g.rotation.order = "YXZ"; g.add(mesh);
    g.position.set(0, SLOT_Y - 0.018, FRONT_Z + 0.004); g.rotation.x = -1.3; mesh.scale.y = 0.06;
    totem.add(g);
    tickets.push({ g, mesh, mat, tex, state: "print", t: 0, p0: new THREE.Vector3(), q0: new THREE.Quaternion(), s0: 1 });
  };
  const camDir = new THREE.Vector3(), camUp = new THREE.Vector3(), tgt = new THREE.Vector3();
  const FLOAT_S = 5.0, HOLD_DIST = 2.2;                    // tamanho final (5x) e distância da câmera
  /** Posição (borda de cima do papel) para o papel ficar centrado, de frente para a câmera. */
  const holdPos = (bob: number, out: import("three").Vector3) => {
    camera.getWorldDirection(camDir); camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    return out.copy(camera.position).addScaledVector(camDir, HOLD_DIST).addScaledVector(camUp, PH * FLOAT_S / 2 + bob);
  };
  const stepTickets = (dt: number) => {
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);
    const inout = (x: number) => x * x * (3 - 2 * x);
    for (let i = tickets.length - 1; i >= 0; i--) {
      const k = tickets[i]; k.t += dt;
      if (k.state === "print") {                       // sai pela janela e se solta para baixo
        const p = Math.min(1, k.t / 0.9);
        k.mesh.scale.y = 0.06 + 0.94 * ease(p);
        k.g.rotation.x = -1.3 + 1.15 * ease(p);
        if (p >= 1) {
          k.state = "float"; k.t = 0;
          scene.attach(k.g);                           // passa para o espaço do mundo (para ir até a câmera)
          k.p0.copy(k.g.position); k.q0.copy(k.g.quaternion); k.s0 = k.g.scale.x;
        }
      } else if (k.state === "float") {                // flutua até a frente da câmera, girando para ficar de frente e crescendo
        const p = inout(Math.min(1, k.t / 1.5));
        holdPos(0, tgt);
        k.g.position.lerpVectors(k.p0, tgt, p);
        k.g.quaternion.slerpQuaternions(k.q0, camera.quaternion, p);
        k.g.scale.setScalar(k.s0 + (FLOAT_S - k.s0) * p);
        if (p >= 1) { k.state = "hold"; k.t = 0; }
      } else if (k.state === "hold") {                 // fica flutuando suavemente, legível
        holdPos(Math.sin(k.t * 1.8) * 0.012, tgt);
        k.g.position.copy(tgt);
        k.g.quaternion.copy(camera.quaternion);
        k.g.rotateY(Math.sin(k.t * 1.1) * 0.05); k.g.rotateX(Math.sin(k.t * 0.9 + 1) * 0.02);
        if (k.t > 4.5) dismiss(k);
      } else if (k.state === "leave") {                // sobe e some
        const p = Math.min(1, k.t / 0.7);
        k.mat.opacity = 1 - inout(p);
        k.g.position.y = k.p0.y + 0.25 * ease(p);
        k.g.scale.setScalar(k.s0 * (1 + 0.06 * p));
        if (p >= 1) { scene.remove(k.g); k.mat.dispose(); k.tex.dispose(); tickets.splice(i, 1); }
      }
    }
    if (queued > 0 && tickets.length === 0) { queued = 0; emit(); }
  };

  // ── movimento e interação ──
  const YAW0 = 0.62;
  let yaw = YAW0, vel = 0, dragging = false, lastX = 0, idleSince = performance.now(), pitch = 0, pitchTarget = 0;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const LIM = 3.2;
  const dom = renderer.domElement;
  const raycaster = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const overScreen = (e: PointerEvent) => {
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(screenPlane, false).length > 0;
  };
  let tapStart = { x: 0, y: 0, t: 0 };
  const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; vel = 0; tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; dom.setPointerCapture(e.pointerId); dom.style.cursor = "grabbing"; };
  const move = (e: PointerEvent) => {
    const r = dom.getBoundingClientRect();
    pitchTarget = clamp(((e.clientY - r.top) / r.height - 0.5) * -0.08, -0.05, 0.05);
    if (!dragging) { if (!reduce) dom.style.cursor = overScreen(e) ? "pointer" : "grab"; return; }
    const dx = e.clientX - lastX; lastX = e.clientX;
    yaw = clamp(yaw + dx * 0.009, -LIM, LIM); vel = dx * 0.009;
    if (reduce) renderOnce();
  };
  const up = (e: PointerEvent) => {
    if (!dragging) return;
    if (!reduce && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 6 && performance.now() - tapStart.t < 450 && overScreen(e)) print(); // toque na tela
    dragging = false; idleSince = performance.now(); try { dom.releasePointerCapture(e.pointerId); } catch { /* já liberado */ } dom.style.cursor = "grab";
  };
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
  let prevNow = performance.now();
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - prevNow) / 1000); prevNow = now;
    if (!visible || document.hidden) return;
    stepTickets(dt);
    if (printTex) {                                    // transição suave entre a tela do app e a tela de impressão
      const want = tickets.length > 0 ? 1 : 0;
      printMat.opacity += (want - printMat.opacity) * Math.min(1, dt * 9);
      printPlane.visible = printMat.opacity > 0.01;
    }
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

  const stop = () => {
    cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
    tickets.forEach((k) => { k.mat.dispose(); k.tex.dispose(); });
    dom.removeEventListener("pointerdown", down); dom.removeEventListener("pointermove", move); dom.removeEventListener("pointerup", up); dom.removeEventListener("pointercancel", up);
    disposables.forEach((d) => d.dispose());
    env.dispose(); pmrem.dispose(); renderer.dispose();
    host.removeChild(renderer.domElement);
  };
  return { stop, print };
}
