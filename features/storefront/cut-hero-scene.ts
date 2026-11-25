// 3D-сцена первого экрана: лист ЛДСП распиливается на детали, детали
// получают кромку и собираются в шкаф. Всё ведёт одна величина —
// прогресс прокрутки от 0 до 1. Кадр рисуется только когда он изменился.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MM = 0.001;
const THICKNESS = 16;
const SHEET_W = 2800;
const SHEET_H = 2070;
const LIFT = 140;

type PartSpec = {
  // Лицевая сторона детали: a — по локальной X, b — по локальной Y, мм.
  a: number;
  b: number;
  // Левый верхний угол на листе и поворот на 90° при раскрое.
  at: [number, number];
  rotated?: boolean;
  // Место в шкафу (центр, мм) и поворот (радианы).
  pos: [number, number, number];
  rot: [number, number, number];
  order: number;
};

const QUARTER = Math.PI / 2;

// Шкаф 800 × 2000 × 560: боковины до пола, цоколь между ними, две полки
// и два ящика внизу. Раскрой укладывается в один лист 2800 × 2070.
const PARTS: PartSpec[] = [
  {
    a: 560,
    b: 2000,
    at: [10, 10],
    rotated: true,
    pos: [-392, 1000, 0],
    rot: [0, QUARTER, 0],
    order: 3,
  },
  {
    a: 560,
    b: 2000,
    at: [10, 580],
    rotated: true,
    pos: [392, 1000, 0],
    rot: [0, QUARTER, 0],
    order: 4,
  },
  {
    a: 768,
    b: 560,
    at: [10, 1150],
    pos: [0, 1992, 0],
    rot: [-QUARTER, 0, 0],
    order: 5,
  },
  {
    a: 768,
    b: 560,
    at: [788, 1150],
    pos: [0, 108, 0],
    rot: [-QUARTER, 0, 0],
    order: 2,
  },
  {
    a: 768,
    b: 540,
    at: [1566, 1170],
    pos: [0, 920, -10],
    rot: [-QUARTER, 0, 0],
    order: 6,
  },
  {
    a: 768,
    b: 540,
    at: [2020, 10],
    rotated: true,
    pos: [0, 1450, -10],
    rot: [-QUARTER, 0, 0],
    order: 7,
  },
  {
    a: 768,
    b: 180,
    at: [2020, 790],
    pos: [0, 208, 272],
    rot: [0, 0, 0],
    order: 8,
  },
  {
    a: 768,
    b: 180,
    at: [2020, 980],
    pos: [0, 392, 272],
    rot: [0, 0, 0],
    order: 9,
  },
  {
    a: 768,
    b: 100,
    at: [10, 1720],
    pos: [0, 50, 230],
    rot: [0, 0, 0],
    order: 0,
  },
  {
    a: 768,
    b: 100,
    at: [788, 1720],
    pos: [0, 50, -250],
    rot: [0, 0, 0],
    order: 1,
  },
];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (p: number, from: number, to: number) =>
  clamp01((p - from) / (to - from));
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

// Декор «Орех»: тёплый тёмный фон и волокна вдоль длинной стороны листа.
function walnutTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (!context) return texture;
  const random = seeded(11);
  context.fillStyle = "#6a4730";
  context.fillRect(0, 0, 1024, 1024);
  // Широкие мягкие полосы тона — рисунок ореха, сверху тонкие волокна.
  for (let band = 0; band < 34; band += 1) {
    const y = random() * 1024;
    const height = 14 + random() * 60;
    const light = random() > 0.5;
    const alpha = 0.12 + random() * 0.18;
    const gradient = context.createLinearGradient(0, y, 0, y + height);
    const color = light ? "138, 98, 66" : "58, 37, 24";
    gradient.addColorStop(0, `rgba(${color}, 0)`);
    gradient.addColorStop(0.5, `rgba(${color}, ${alpha})`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(0, y, 1024, height);
  }
  for (let line = 0; line < 900; line += 1) {
    const y = random() * 1024;
    const dark = random() > 0.25;
    context.strokeStyle = dark
      ? `rgba(44, 27, 16, ${0.05 + random() * 0.13})`
      : `rgba(160, 118, 80, ${0.05 + random() * 0.1})`;
    context.lineWidth = 0.4 + random() * 1.1;
    const start = random() * 300 - 200;
    const length = 500 + random() * 900;
    context.beginPath();
    context.moveTo(start, y);
    context.bezierCurveTo(
      start + length / 3,
      y + random() * 6 - 3,
      start + (length * 2) / 3,
      y + random() * 6 - 3,
      start + length,
      y + random() * 4 - 2,
    );
    context.stroke();
  }
  return texture;
}

function fitUv(
  geometry: THREE.BoxGeometry,
  a: number,
  b: number,
  rotated = false,
) {
  // Одна текстура на 2800 мм: волокно на детали той же плотности, что на
  // листе, и идёт вдоль длинной стороны листа, как при настоящем раскрое.
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  for (let index = 0; index < uv.count; index += 1) {
    const face = Math.floor(index / 4);
    if (face !== 4 && face !== 5) continue;
    const u = uv.getX(index);
    const v = uv.getY(index);
    if (rotated) uv.setXY(index, (v * b) / SHEET_W, (u * a) / SHEET_W);
    else uv.setXY(index, (u * a) / SHEET_W, (v * b) / SHEET_W);
  }
  uv.needsUpdate = true;
}

type Pose = { position: THREE.Vector3; quaternion: THREE.Quaternion };

type Part = {
  mesh: THREE.Mesh;
  edge: THREE.MeshStandardMaterial;
  sheet: Pose;
  spread: THREE.Vector3;
  cabinet: Pose;
  order: number;
  outline: THREE.Vector3[];
};

export type CutScene = {
  setProgress: (progress: number) => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
};

export function createCutScene(canvas: HTMLCanvasElement): CutScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);

  const sun = new THREE.DirectionalLight(0xfff3e2, 2.4);
  sun.position.set(-2.2, 4.2, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -2.4;
  sun.shadow.camera.right = 2.4;
  sun.shadow.camera.top = 2.4;
  sun.shadow.camera.bottom = -2.4;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 10;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xfff8ef, 0xcbb89c, 0.5));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.ShadowMaterial({ color: 0x3b2a1c, opacity: 0.2 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const walnut = walnutTexture();
  walnut.anisotropy = renderer.capabilities.getMaxAnisotropy();
  walnut.wrapS = THREE.RepeatWrapping;
  walnut.wrapT = THREE.RepeatWrapping;
  const face = new THREE.MeshStandardMaterial({
    map: walnut,
    roughness: 0.58,
    metalness: 0,
  });
  const raw = new THREE.Color("#d8c39a");
  const banded = new THREE.Color("#5a3c27");
  const glow = new THREE.Color("#ff8a3d");

  // Целый лист — пока его не распилили, и остаток после распила.
  const sheetMaterial = new THREE.MeshStandardMaterial({
    map: walnut,
    roughness: 0.58,
    transparent: true,
  });
  const sheetEdge = new THREE.MeshStandardMaterial({
    color: raw,
    roughness: 0.95,
    transparent: true,
  });
  const sheetGeometry = new THREE.BoxGeometry(
    SHEET_W * MM,
    SHEET_H * MM,
    (THICKNESS - 1) * MM,
  );
  fitUv(sheetGeometry, SHEET_W, SHEET_H);
  const sheet = new THREE.Mesh(sheetGeometry, [
    sheetEdge,
    sheetEdge,
    sheetEdge,
    sheetEdge,
    sheetMaterial,
    sheetMaterial,
  ]);
  sheet.rotation.x = -Math.PI / 2;
  sheet.position.y = ((THICKNESS - 1) / 2) * MM;
  sheet.receiveShadow = true;
  scene.add(sheet);

  const toWorld = (x: number, y: number) =>
    new THREE.Vector3((x - SHEET_W / 2) * MM, 0, (y - SHEET_H / 2) * MM);

  const lyingFlat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2, 0, 0),
  );
  const turned = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    .multiply(lyingFlat);

  const geometries: THREE.BufferGeometry[] = [sheetGeometry];
  const parts: Part[] = PARTS.map((spec) => {
    const geometry = new THREE.BoxGeometry(
      spec.a * MM,
      spec.b * MM,
      THICKNESS * MM,
    );
    fitUv(geometry, spec.a, spec.b, spec.rotated);
    geometries.push(geometry);
    const edge = new THREE.MeshStandardMaterial({
      color: raw.clone(),
      roughness: 0.9,
      emissive: glow,
      emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(geometry, [edge, edge, edge, edge, face, face]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const [fw, fh] = spec.rotated ? [spec.b, spec.a] : [spec.a, spec.b];
    const center = toWorld(spec.at[0] + fw / 2, spec.at[1] + fh / 2);
    center.y = (THICKNESS / 2) * MM;
    const [x0, y0] = spec.at;
    const outline = [
      toWorld(x0, y0),
      toWorld(x0 + fw, y0),
      toWorld(x0 + fw, y0 + fh),
      toWorld(x0, y0 + fh),
      toWorld(x0, y0),
    ];
    scene.add(mesh);
    return {
      mesh,
      edge,
      sheet: {
        position: center,
        quaternion: (spec.rotated ? turned : lyingFlat).clone(),
      },
      spread: new THREE.Vector3(center.x * 0.1, LIFT * MM, center.z * 0.14),
      cabinet: {
        position: new THREE.Vector3(...spec.pos).multiplyScalar(MM),
        quaternion: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(...spec.rot),
        ),
      },
      order: spec.order,
      outline,
    };
  });

  // Пропил: линии появляются деталь за деталью, впереди светится пила.
  const segments: [THREE.Vector3, THREE.Vector3][] = [];
  for (const part of parts) {
    for (let index = 0; index < part.outline.length - 1; index += 1) {
      segments.push([part.outline[index], part.outline[index + 1]]);
    }
  }
  const lengths = segments.map(([from, to]) => from.distanceTo(to));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  const kerfPositions = new Float32Array(segments.length * 6);
  const kerfGeometry = new THREE.BufferGeometry();
  kerfGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(kerfPositions, 3),
  );
  geometries.push(kerfGeometry);
  const kerfMaterial = new THREE.LineBasicMaterial({
    color: 0x2a1a10,
    transparent: true,
  });
  const kerf = new THREE.LineSegments(kerfGeometry, kerfMaterial);
  kerf.position.y = (THICKNESS + 0.6) * MM;
  kerf.renderOrder = 2;
  scene.add(kerf);
  const sawGeometry = new THREE.SphereGeometry(0.018, 16, 12);
  geometries.push(sawGeometry);
  const sawMaterial = new THREE.MeshBasicMaterial({
    color: 0xff7a2f,
    transparent: true,
  });
  const saw = new THREE.Mesh(sawGeometry, sawMaterial);
  saw.position.y = (THICKNESS + 2) * MM;
  scene.add(saw);
  const sawLight = new THREE.PointLight(0xff8a3d, 0, 0.6, 2);
  scene.add(sawLight);

  // Ручки на ящиках появляются, когда шкаф собран.
  const handleGeometry = new THREE.BoxGeometry(0.32, 0.012, 0.022);
  geometries.push(handleGeometry);
  const handleMaterial = new THREE.MeshStandardMaterial({
    color: 0x1d1d1f,
    metalness: 0.8,
    roughness: 0.32,
  });
  const handles = [208, 392].map((y) => {
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(0, (y + 60) * MM, (280 + 11) * MM);
    handle.castShadow = true;
    scene.add(handle);
    return handle;
  });

  const cameraFrom = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.3, 4.7, 3.7),
    new THREE.Vector3(1.9, 4.1, 4.3),
    new THREE.Vector3(3.5, 2.4, 3.9),
    new THREE.Vector3(2.8, 1.9, 4.1),
  ]);
  const cameraTo = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.1, 0, 0.15),
    new THREE.Vector3(0, 0.05, 0.05),
    new THREE.Vector3(0, 0.25, 0),
    new THREE.Vector3(0, 0.95, 0),
  ]);

  let width = 1;
  let height = 1;
  let progress = 0;
  let frame = 0;
  const target = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const lifted = new THREE.Vector3();
  const temp = new THREE.Vector3();

  function layout() {
    const p = progress;
    // 1. Пропил 0,04–0,3.
    const cut = range(p, 0.04, 0.3);
    let left = cut * total;
    let pointer = 0;
    let tip = segments[0][0];
    for (let index = 0; index < segments.length; index += 1) {
      const [from, to] = segments[index];
      const share = clamp01(left / lengths[index]);
      left -= lengths[index];
      const end = temp.copy(from).lerp(to, share);
      kerfPositions.set([from.x, 0, from.z, end.x, 0, end.z], pointer);
      pointer += 6;
      if (share > 0 && share < 1) tip = end.clone();
      if (share === 1 && index === segments.length - 1) tip = to;
    }
    kerfGeometry.getAttribute("position").needsUpdate = true;
    kerfGeometry.computeBoundingSphere();
    const separate = easeOut(range(p, 0.28, 0.4));
    kerfMaterial.opacity = 0.85 * (1 - separate);
    const sawing = cut > 0 && cut < 1;
    sawMaterial.opacity = sawing ? 1 : 0;
    saw.visible = sawing;
    saw.position.x = tip.x;
    saw.position.z = tip.z;
    sawLight.position.set(tip.x, 0.06, tip.z);
    sawLight.intensity = sawing ? 0.9 : 0;

    // 2. Детали поднимаются над листом, остаток уходит.
    sheet.visible = separate < 1;
    sheetMaterial.opacity = 1 - separate;
    sheetEdge.opacity = 1 - separate;
    sheetMaterial.depthWrite = separate < 0.5;
    for (const part of parts) part.mesh.visible = separate > 0 || cut >= 1;

    // 3. Кромка 0,4–0,56: деталь за деталью, со вспышкой клея.
    // 4. Сборка 0,56–0,97.
    for (const part of parts) {
      const band = range(
        p,
        0.4 + part.order * 0.012,
        0.47 + part.order * 0.012,
      );
      part.edge.color.copy(raw).lerp(banded, band);
      part.edge.roughness = 0.9 - band * 0.45;
      part.edge.emissiveIntensity = Math.sin(band * Math.PI) * 1.4;

      lifted.copy(part.sheet.position).addScaledVector(part.spread, separate);
      const fly = ease(
        range(p, 0.56 + part.order * 0.03, 0.71 + part.order * 0.03),
      );
      part.mesh.position.copy(lifted).lerp(part.cabinet.position, fly);
      part.mesh.position.y += Math.sin(fly * Math.PI) * 0.35;
      part.mesh.quaternion
        .copy(part.sheet.quaternion)
        .slerp(part.cabinet.quaternion, fly);
    }
    const done = easeOut(range(p, 0.93, 0.99));
    for (const handle of handles) {
      handle.visible = done > 0;
      handle.scale.set(Math.max(done, 0.001), 1, 1);
    }

    // Камера: с листа сверху — к шкафу в три четверти.
    const t = ease(p);
    cameraFrom.getPoint(t, eye);
    cameraTo.getPoint(t, target);
    const aspect = width / height;
    // На узком экране отходим дальше, чтобы лист и шкаф помещались.
    const reach = aspect < 1.25 ? Math.pow(1.25 / aspect, 0.7) : 1;
    eye.sub(target).multiplyScalar(reach).add(target);
    camera.position.copy(eye);
    camera.lookAt(target);
  }

  function render() {
    frame = 0;
    layout();
    renderer.render(scene, camera);
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  return {
    setProgress(next) {
      const value = clamp01(next);
      if (Math.abs(value - progress) < 0.0004 && frame === 0) return;
      progress = value;
      schedule();
    },
    resize(nextWidth, nextHeight) {
      width = Math.max(1, nextWidth);
      height = Math.max(1, nextHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Сцена сдвинута вправо на широком экране (слева текст) и вверх на
      // узком (текст снизу).
      if (width >= 900) {
        camera.setViewOffset(width, height, -width * 0.2, 0, width, height);
      } else {
        camera.setViewOffset(width, height, 0, height * 0.16, width, height);
      }
      camera.updateProjectionMatrix();
      schedule();
    },
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      for (const geometry of geometries) geometry.dispose();
      for (const part of parts) part.edge.dispose();
      [
        face,
        sheetMaterial,
        sheetEdge,
        kerfMaterial,
        sawMaterial,
        handleMaterial,
      ].forEach((material) => material.dispose());
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      walnut.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
