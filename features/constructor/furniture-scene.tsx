"use client";

// Реалистичный 3D-макет для конструктора мебели на three.js: декор с фото
// из каталога, мягкий свет и тени на полу, ручки на дверях. Детали
// приходят тем же списком брусков, что и в BazisViewer (мм, матрица 3×4).

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Box, Maximize2, Minimize2, MoveHorizontal } from "lucide-react";

import type { BazisViewerBox } from "@/components/bazis/bazis-viewer";
import { cn } from "@/lib/utils";

export type SceneTone = {
  color: number[];
  imageUrl?: string | null;
  // Металл (ручки) или плита.
  metal?: boolean;
  // Светится сам (LED-лента в профиле).
  glow?: boolean;
};

const DEFAULT_VIEW: [number, number, number] = [0.55, 0.32, 1];

export type HandlePlacement = "top" | "middle" | "bottom";

// Снимок макета для печатной инструкции.
export type FurnitureSceneApi = { snapshot: () => string | null };

const HIGHLIGHT = 0xf0a070;

const MM = 0.001;
const BACKGROUND = 0xf3f0ea;
const HANDLE_LENGTH = 160;
const HANDLE_FROM_EDGE = 45;
const HANDLE_FROM_END = 90;

// Фото с другого сайта WebGL не возьмёт без CORS, поэтому идём через
// оптимизатор картинок Next на своём домене.
function textureUrl(url: string) {
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=640&q=80`;
}

function rgb(color: number[]) {
  return new THREE.Color(
    `rgb(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(color[2])})`,
  );
}

function boxMatrix(box: BazisViewerBox) {
  const m = box.matrix;
  const placement = new THREE.Matrix4().set(
    m[0],
    m[1],
    m[2],
    m[3] * MM,
    m[4],
    m[5],
    m[6],
    m[7] * MM,
    m[8],
    m[9],
    m[10],
    m[11] * MM,
    0,
    0,
    0,
    1,
  );
  const center = new THREE.Matrix4().makeTranslation(
    (box.x + box.sizeX / 2) * MM,
    (box.y + box.sizeY / 2) * MM,
    (box.thickness / 2) * MM,
  );
  return placement.multiply(center);
}

function handleMatrix(box: BazisViewerBox, placement: HandlePlacement) {
  // Ручка у края, противоположного петлям. Петли на x = 0 детали.
  const hingeAtStart = box.x >= 0;
  const x = hingeAtStart
    ? box.x + box.sizeX - HANDLE_FROM_EDGE
    : box.x + HANDLE_FROM_EDGE;
  const y =
    box.y +
    (placement === "top"
      ? box.sizeY - HANDLE_FROM_END - HANDLE_LENGTH / 2
      : placement === "bottom"
        ? HANDLE_FROM_END + HANDLE_LENGTH / 2
        : Math.min(box.sizeY / 2, 1000));
  // Фасад ящика (шире, чем выше): ручка лёжа по центру.
  const drawerFront = box.sizeX > box.sizeY * 1.2;
  const m = box.matrix;
  const placementMatrix = new THREE.Matrix4().set(
    m[0],
    m[1],
    m[2],
    m[3] * MM,
    m[4],
    m[5],
    m[6],
    m[7] * MM,
    m[8],
    m[9],
    m[10],
    m[11] * MM,
    0,
    0,
    0,
    1,
  );
  if (drawerFront) {
    return placementMatrix
      .multiply(
        new THREE.Matrix4().makeTranslation(
          (box.x + box.sizeX / 2) * MM,
          (box.y + box.sizeY / 2) * MM,
          box.thickness * MM,
        ),
      )
      .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  }
  return placementMatrix.multiply(
    new THREE.Matrix4().makeTranslation(x * MM, y * MM, box.thickness * MM),
  );
}

// Середина фото: по краям у снимков листа часто фон.
function applyTexture(
  material: THREE.MeshStandardMaterial,
  base: THREE.Texture,
) {
  const texture = base.clone();
  texture.needsUpdate = true;
  texture.repeat.set(0.6, 0.6);
  texture.offset.set(0.2, 0.2);
  material.map = texture;
  material.color.set(0xffffff);
  material.needsUpdate = true;
}

function makeHandle(material: THREE.Material) {
  const group = new THREE.Group();
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, HANDLE_LENGTH * MM, 16),
    material,
  );
  bar.position.z = 0.03;
  bar.castShadow = true;
  group.add(bar);
  for (const sign of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.03, 12),
      material,
    );
    leg.rotation.x = Math.PI / 2;
    leg.position.set(0, (sign * (HANDLE_LENGTH - 32) * MM) / 2, 0.015);
    leg.castShadow = true;
    group.add(leg);
  }
  group.matrixAutoUpdate = false;
  return group;
}

type Selected = { name: string; size: string; material?: string } | null;

export function FurnitureScene({
  boxes,
  tones,
  handleTone,
  handlePlacement,
  className,
  highlight,
  labels = false,
  apiRef,
  hint = "Крутите пальцем или мышью · нажмите на деталь",
  onBoxClick,
  viewDirection,
}: {
  // Откуда смотрит камера при первом показе (и когда направление
  // меняется): x — вправо, y — вверх, z — к зрителю.
  viewDirection?: [number, number, number];
  // Нажатие на деталь: номер детали в boxes (например, сдвинуть дверь).
  onBoxClick?: (index: number) => void;
  // Детали текущего шага сборки подсвечиваются.
  highlight?: boolean[];
  // Подписи деталей поверх макета.
  labels?: boolean;
  apiRef?: { current: FurnitureSceneApi | null };
  hint?: string;
  boxes: BazisViewerBox[];
  tones: SceneTone[];
  // Номер материала дверей: на них ставим ручки. null — без ручек.
  handleTone: number | null;
  // Где ручка на фасаде: одно место для всех или по фасаду (кухня:
  // у тумб сверху, у навесных снизу).
  handlePlacement: HandlePlacement | ((box: BazisViewerBox) => HandlePlacement);
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onBoxClickRef = useRef(onBoxClick);
  useEffect(() => {
    onBoxClickRef.current = onBoxClick;
  }, [onBoxClick]);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    furniture: THREE.Group;
    floor: THREE.Mesh;
    materials: Map<string, THREE.MeshStandardMaterial>;
    textures: Map<string, THREE.Texture | null>;
    handleMaterial: THREE.MeshStandardMaterial;
    meshes: THREE.Mesh[];
    signature: string;
    fitted: string;
    render: () => void;
    labelPoints: () => Array<{
      x: number;
      y: number;
      visible: boolean;
      text: string;
    }>;
  } | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Сцена создаётся один раз.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BACKGROUND);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
    camera.position.set(1.8, 1.4, 3.2);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfc2, 0.4);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff6ea, 1.9);
    sun.position.set(2.5, 4, 3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -3;
    sun.shadow.camera.right = 3;
    sun.shadow.camera.top = 3;
    sun.shadow.camera.bottom = -3;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 12;
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 4;
    scene.add(sun);

    // Пол только принимает тень: фон и пол одного цвета, как в студии.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ color: 0x3a2e22, opacity: 0.22 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const furniture = new THREE.Group();
    scene.add(furniture);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 0.3;
    controls.maxDistance = 12;

    // Подпись стоит в середине детали; у дверей — на лицевой стороне.
    const labelPoints = () => {
      const state = stateRef.current;
      if (!state) return [];
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      return state.meshes.map((mesh) => {
        const center = new THREE.Vector3().setFromMatrixPosition(
          mesh.matrixWorld,
        );
        // Подпись видна, только если деталь не закрыта другими: луч из
        // камеры к её середине первой встречает её саму.
        const direction = center.clone().sub(camera.position).normalize();
        ray.set(camera.position, direction);
        const first = ray.intersectObjects(state.meshes, false)[0];
        const point = center.clone().project(camera);
        return {
          x: ((point.x + 1) / 2) * rect.width,
          y: ((1 - point.y) / 2) * rect.height,
          visible: point.z < 1 && first?.object === mesh,
          text: String(mesh.userData.label ?? ""),
        };
      });
    };
    const placeLabels = () => {
      const layer = labelsRef.current;
      if (!layer) return;
      const points = labelPoints();
      Array.from(layer.children).forEach((child, index) => {
        const element = child as HTMLElement;
        const point = points[index];
        if (!point || !point.visible) {
          element.style.display = "none";
          return;
        }
        element.style.display = "";
        element.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
      });
    };

    let frame = 0;
    const render = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const moving = controls.update();
        renderer.render(scene, camera);
        placeLabels();
        if (moving) render();
      });
    };
    controls.addEventListener("change", render);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    // Нажатие на деталь показывает её название и размер.
    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY };
    };
    const onUp = (event: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      down = null;
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const state = stateRef.current;
      if (!state) return;
      const hit = raycaster.intersectObjects(state.meshes, false)[0];
      const info = hit?.object.userData.info as BazisViewerBox["info"];
      for (const mesh of state.meshes) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissive?.setHex(
          (material.userData.glow as number | undefined) ?? 0,
        );
      }
      const index = hit?.object.userData.index as number | undefined;
      if (index !== undefined) onBoxClickRef.current?.(index);
      if (hit && info) {
        const material = (hit.object as THREE.Mesh)
          .material as THREE.MeshStandardMaterial;
        material.emissive.setHex(0x1d3b52);
        setSelected({
          name: info.name,
          size: `${info.length} × ${info.width} × ${info.thickness} мм`,
          material: info.material,
        });
      } else {
        setSelected(null);
      }
      render();
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    stateRef.current = {
      renderer,
      scene,
      camera,
      controls,
      furniture,
      floor,
      materials: new Map(),
      textures: new Map(),
      handleMaterial: new THREE.MeshStandardMaterial({
        color: 0xb9bcc0,
        metalness: 0.9,
        roughness: 0.28,
      }),
      meshes: [],
      signature: "",
      fitted: "",
      render,
      labelPoints,
    };

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      stateRef.current?.textures.forEach((texture) => texture?.dispose());
      renderer.dispose();
      host.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  // Детали: при тех же размерах только двигаем (открывание дверей),
  // иначе собираем заново.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    // Новый декор или размеры — собираем детали заново; открывание дверей
    // только двигает их.
    const signature =
      boxes
        .map((box) => `${box.sizeX}|${box.sizeY}|${box.thickness}|${box.tone}`)
        .join(";") +
      JSON.stringify(tones) +
      String(handleTone);

    const materialFor = (box: BazisViewerBox) => {
      const tone = tones[box.tone] ?? { color: [200, 200, 200] };
      // У каждой детали своя копия материала: выделенная деталь
      // подсвечивается одна.
      const key = `${box.tone}|${tone.imageUrl ?? ""}|${tone.color.join(",")}|${tone.metal ? 1 : 0}|${tone.glow ? 1 : 0}`;
      let material = state.materials.get(key);
      if (material) return material.clone();
      material = new THREE.MeshStandardMaterial({
        color: rgb(tone.color),
        roughness: tone.metal ? 0.3 : 0.62,
        metalness: tone.metal ? 0.9 : 0,
      });
      if (tone.glow) {
        const glow = rgb(tone.color).getHex();
        material.emissive.setHex(glow);
        material.emissiveIntensity = 1.4;
        material.userData.glow = glow;
      }
      if (tone.imageUrl) {
        const url = textureUrl(tone.imageUrl);
        material.userData.textureUrl = url;
        const cached = state.textures.get(url);
        if (cached) applyTexture(material, cached);
        else if (cached === undefined) {
          state.textures.set(url, null);
          new THREE.TextureLoader().load(
            url,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.anisotropy = 8;
              state.textures.set(url, texture);
              // Все детали этого декора, созданные пока фото грузилось.
              const waiting = [
                ...state.materials.values(),
                ...state.meshes.map(
                  (mesh) => mesh.material as THREE.MeshStandardMaterial,
                ),
              ];
              for (const item of waiting) {
                if (item.userData.textureUrl === url) {
                  applyTexture(item, texture);
                }
              }
              state.render();
            },
            undefined,
            () => {
              // Фото не загрузилось: остаётся цвет декора.
            },
          );
        }
      }
      state.materials.set(key, material);
      return material.clone();
    };

    if (signature !== state.signature) {
      for (const child of [...state.furniture.children]) {
        state.furniture.remove(child);
        child.traverse((object) => {
          if (object instanceof THREE.Mesh && object.geometry) {
            object.geometry.dispose();
          }
        });
      }
      state.meshes = [];
      for (const box of boxes) {
        const geometry = new THREE.BoxGeometry(
          box.sizeX * MM,
          box.sizeY * MM,
          box.thickness * MM,
        );
        const mesh = new THREE.Mesh(geometry, materialFor(box));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        mesh.userData.info = box.info;
        mesh.userData.index = state.meshes.length;
        const kind = (box.info?.name ?? "").replace(/^[^:]*: /, "");
        mesh.userData.label = kind.charAt(0).toUpperCase() + kind.slice(1);
        state.furniture.add(mesh);
        state.meshes.push(mesh);

        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geometry),
          new THREE.LineBasicMaterial({
            color: 0x3c3026,
            transparent: true,
            opacity: 0.18,
          }),
        );
        mesh.add(edges);

        if (handleTone !== null && box.tone === handleTone) {
          const handle = makeHandle(state.handleMaterial);
          handle.userData.box = state.meshes.length - 1;
          state.furniture.add(handle);
        }
      }
      state.signature = signature;
      const layer = labelsRef.current;
      if (layer) {
        layer.replaceChildren(
          ...state.meshes.map((mesh) => {
            const element = document.createElement("span");
            element.textContent = String(mesh.userData.label ?? "");
            element.className =
              "absolute top-0 left-0 whitespace-nowrap rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[#2b241d] shadow-sm";
            return element;
          }),
        );
      }
    }

    // Положение деталей и ручек.
    let handleIndex = 0;
    const handles = state.furniture.children.filter(
      (child) => child instanceof THREE.Group,
    );
    boxes.forEach((box, index) => {
      const mesh = state.meshes[index];
      if (!mesh) return;
      mesh.matrix.copy(boxMatrix(box));
      mesh.matrixWorldNeedsUpdate = true;
      const material = mesh.material as THREE.MeshStandardMaterial;
      // Детали шага окрашиваем в тёплый оттенок: на белой плите подсветка
      // свечением почти не видна.
      const marked = Boolean(highlight?.[index]);
      mesh.userData.highlight = marked;
      if (!mesh.userData.baseColor) {
        mesh.userData.baseColor = material.color.getHex();
      }
      if (material.map) mesh.userData.baseColor = 0xffffff;
      material.color.setHex(
        marked ? HIGHLIGHT : (mesh.userData.baseColor as number),
      );
      if (handleTone !== null && box.tone === handleTone) {
        const handle = handles[handleIndex];
        handleIndex += 1;
        if (handle) {
          handle.matrix.copy(
            handleMatrix(
              box,
              typeof handlePlacement === "function"
                ? handlePlacement(box)
                : handlePlacement,
            ),
          );
          handle.matrixWorldNeedsUpdate = true;
        }
      }
    });

    // Камера наводится на изделие, когда меняются его размеры.
    const bounds = new THREE.Box3();
    for (const mesh of state.meshes) {
      mesh.updateMatrixWorld(true);
      bounds.expandByObject(mesh);
    }
    if (!bounds.isEmpty()) {
      // Изделие стоит на полу: нижняя точка — пол.
      state.floor.position.y = bounds.min.y - 0.0005;
      const size = bounds.getSize(new THREE.Vector3());
      const view = viewDirection ?? DEFAULT_VIEW;
      const viewKey = view.join(",");
      const fitKey = `${size.x.toFixed(2)}|${size.y.toFixed(2)}|${viewKey}`;
      const newView = !state.fitted.endsWith(`|${viewKey}`);
      if (fitKey !== state.fitted && !signature.includes("NaN")) {
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = size.length() / 2;
        const distance =
          radius / Math.sin((state.camera.fov * Math.PI) / 360) + 0.2;
        const direction = !newView
          ? state.camera.position.clone().sub(state.controls.target).normalize()
          : new THREE.Vector3(...view).normalize();
        state.controls.target.copy(center);
        state.camera.position.copy(
          center.clone().add(direction.multiplyScalar(distance)),
        );
        state.fitted = fitKey;
        state.controls.update();
      }
    }
    state.render();
  }, [boxes, tones, handleTone, handlePlacement, highlight, viewDirection]);

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      snapshot: () => {
        const state = stateRef.current;
        if (!state) return null;
        state.controls.update();
        state.renderer.render(state.scene, state.camera);
        const source = state.renderer.domElement;
        const canvas = document.createElement("canvas");
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext("2d");
        if (!context) return source.toDataURL("image/jpeg", 0.86);
        context.drawImage(source, 0, 0);
        // Подписи деталей рисуем прямо на картинке шага.
        const scale = source.width / source.getBoundingClientRect().width;
        context.font = `600 ${Math.round(17 * scale)}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        const seen = new Set<string>();
        for (const point of state.labelPoints()) {
          if (!point.visible || !point.text) continue;
          // Одинаковые полки подписываем один раз.
          const key = `${point.text}|${Math.round(point.x / 40)}|${Math.round(point.y / 40)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const x = point.x * scale;
          const y = point.y * scale;
          const width = context.measureText(point.text).width + 14 * scale;
          const height = 26 * scale;
          context.fillStyle = "rgba(255,255,255,0.92)";
          context.beginPath();
          context.roundRect(
            x - width / 2,
            y - height / 2,
            width,
            height,
            height / 2,
          );
          context.fill();
          context.fillStyle = "#2b241d";
          context.fillText(point.text, x, y);
        }
        return canvas.toDataURL("image/jpeg", 0.86);
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef]);

  const view = (direction: "front" | "angle") => {
    const state = stateRef.current;
    if (!state) return;
    const distance = state.camera.position.distanceTo(state.controls.target);
    const vector =
      direction === "front"
        ? new THREE.Vector3(0, 0.08, 1)
        : new THREE.Vector3(...(viewDirection ?? DEFAULT_VIEW));
    state.camera.position.copy(
      state.controls.target
        .clone()
        .add(vector.normalize().multiplyScalar(distance)),
    );
    state.controls.update();
    state.render();
  };

  return (
    <div
      className={cn(
        expanded
          ? "fixed inset-0 z-[85] bg-[#f3f0ea]"
          : "relative overflow-hidden",
        !expanded && className,
      )}
    >
      <div ref={hostRef} className="absolute inset-0" />
      <div
        ref={labelsRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden",
          !labels && "hidden",
        )}
      />
      {failed ? (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-[var(--muted)]">
          Браузер не показывает 3D. Размеры и детали ниже посчитаны верно.
        </p>
      ) : null}
      <div className="absolute top-3 left-3 flex gap-2">
        <button
          type="button"
          onClick={() => view("angle")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[13px] font-medium shadow-sm"
        >
          <Box className="size-4" /> 3D
        </button>
        <button
          type="button"
          onClick={() => view("front")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-[13px] font-medium shadow-sm"
        >
          <MoveHorizontal className="size-4" /> Спереди
        </button>
      </div>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-label={expanded ? "Свернуть" : "На весь экран"}
        className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-white/90 shadow-sm"
      >
        {expanded ? (
          <Minimize2 className="size-4" />
        ) : (
          <Maximize2 className="size-4" />
        )}
      </button>
      {selected ? (
        <div className="absolute right-3 bottom-3 left-3 rounded-xl bg-white/95 p-3 text-[13px] shadow-sm sm:right-auto sm:max-w-xs">
          <p className="font-semibold">{selected.name}</p>
          <p className="text-[var(--muted)]">{selected.size}</p>
          {selected.material ? (
            <p className="text-[var(--muted)]">{selected.material}</p>
          ) : null}
        </div>
      ) : (
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/80 px-3 py-1 text-[12px] text-[var(--muted)]">
          {hint}
        </p>
      )}
    </div>
  );
}
