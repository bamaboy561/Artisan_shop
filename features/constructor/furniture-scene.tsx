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
};

export type HandlePlacement = "top" | "middle" | "bottom";

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
    placement === "top"
      ? box.sizeY - HANDLE_FROM_END - HANDLE_LENGTH / 2
      : placement === "bottom"
        ? HANDLE_FROM_END + HANDLE_LENGTH / 2
        : Math.min(box.sizeY / 2, 1000);
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
}: {
  boxes: BazisViewerBox[];
  tones: SceneTone[];
  // Номер материала дверей: на них ставим ручки. null — без ручек.
  handleTone: number | null;
  handlePlacement: HandlePlacement;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
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

    let frame = 0;
    const render = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const moving = controls.update();
        renderer.render(scene, camera);
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
        material.emissive?.setHex(0x000000);
      }
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
      const key = `${box.tone}|${tone.imageUrl ?? ""}|${tone.color.join(",")}|${tone.metal ? 1 : 0}`;
      let material = state.materials.get(key);
      if (material) return material.clone();
      material = new THREE.MeshStandardMaterial({
        color: rgb(tone.color),
        roughness: tone.metal ? 0.3 : 0.62,
        metalness: tone.metal ? 0.9 : 0,
      });
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
      if (handleTone !== null && box.tone === handleTone) {
        const handle = handles[handleIndex];
        handleIndex += 1;
        if (handle) {
          handle.matrix.copy(handleMatrix(box, handlePlacement));
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
      const fitKey = `${size.x.toFixed(2)}|${size.y.toFixed(2)}`;
      if (fitKey !== state.fitted && !signature.includes("NaN")) {
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = size.length() / 2;
        const distance =
          radius / Math.sin((state.camera.fov * Math.PI) / 360) + 0.2;
        const direction = state.fitted
          ? state.camera.position.clone().sub(state.controls.target).normalize()
          : new THREE.Vector3(0.55, 0.32, 1).normalize();
        state.controls.target.copy(center);
        state.camera.position.copy(
          center.clone().add(direction.multiplyScalar(distance)),
        );
        state.fitted = fitKey;
        state.controls.update();
      }
    }
    state.render();
  }, [boxes, tones, handleTone, handlePlacement]);

  const view = (direction: "front" | "angle") => {
    const state = stateRef.current;
    if (!state) return;
    const distance = state.camera.position.distanceTo(state.controls.target);
    const vector =
      direction === "front"
        ? new THREE.Vector3(0, 0.08, 1)
        : new THREE.Vector3(0.55, 0.32, 1);
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
          Крутите пальцем или мышью · нажмите на деталь
        </p>
      )}
    </div>
  );
}
