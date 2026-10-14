"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Деталь для объёмного просмотра: прямоугольник контура (x, y, sizeX, sizeY)
// в плоскости детали, толщина по оси Z, матрица 3×4 в координаты модели и
// номер материала для цвета.
export type BazisViewerBox = {
  x: number;
  y: number;
  sizeX: number;
  sizeY: number;
  thickness: number;
  matrix: number[];
  tone: number;
};

type Face = {
  points: number[][];
  normal: number[];
  tone: number;
  box: number;
  // Середина детали: при показе деталь «дышит», увеличиваясь от неё.
  pivot: number[];
};

// Показ детали после сканирования QR-кода: камера облетает изделие,
// деталь дважды выдвигается из своего места и возвращается, всё это время
// мигая. Потом остаётся просто выделенной.
const INTRO_MS = 1300;
const PULSE_MS = 1300;
const PULSES = 2;
const ANIMATION_MS = INTRO_MS + PULSE_MS * PULSES;
const MARK_COLOR = [201, 104, 78];
const FLASH_COLOR = [255, 176, 72];

// После показа камера остаётся приближенной к детали, а от неё несколько
// раз расходится кольцо, как от маяка: на длинном изделии деталь иначе
// теряется на экране телефона.
const BEACON_MS = 2200;
const BEACON_WAVES = 6;
const FOCUS_MAX_ZOOM = 2.6;

const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

const palette = [
  [214, 190, 160],
  [236, 232, 224],
  [168, 142, 116],
  [196, 205, 208],
  [222, 170, 140],
];

const cornerIndexes = [
  [0, 1, 2, 3],
  [5, 4, 7, 6],
  [4, 0, 3, 7],
  [1, 5, 6, 2],
  [3, 2, 6, 7],
  [4, 5, 1, 0],
];

const views = [
  { label: "Общий вид", yaw: -0.5, pitch: 0.3 },
  { label: "Спереди", yaw: 0, pitch: 0 },
  { label: "Сверху", yaw: 0, pitch: Math.PI / 2 },
  { label: "Сбоку", yaw: -Math.PI / 2, pitch: 0 },
];

function toWorld(matrix: number[], x: number, y: number, z: number) {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z + matrix[3],
    matrix[4] * x + matrix[5] * y + matrix[6] * z + matrix[7],
    matrix[8] * x + matrix[9] * y + matrix[10] * z + matrix[11],
  ];
}

function buildScene(boxes: BazisViewerBox[]) {
  const faces: Face[] = [];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const boxCorners = boxes.map((box) =>
    [0, 1].flatMap((layer) =>
      [
        [box.x, box.y],
        [box.x + box.sizeX, box.y],
        [box.x + box.sizeX, box.y + box.sizeY],
        [box.x, box.y + box.sizeY],
      ].map(([x, y]) => toWorld(box.matrix, x, y, layer * box.thickness)),
    ),
  );

  for (const corners of boxCorners) {
    for (const corner of corners) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], corner[axis]);
        max[axis] = Math.max(max[axis], corner[axis]);
      }
    }
  }

  for (const [boxIndex, box] of boxes.entries()) {
    const corners = boxCorners[boxIndex];
    const boxCenter = [0, 1, 2].map(
      (axis) =>
        corners.reduce((sum, corner) => sum + corner[axis], 0) / corners.length,
    );

    for (const indexes of cornerIndexes) {
      const points = indexes.map((index) => corners[index]);
      const a = points[0];
      const b = points[1];
      const c = points[2];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const normal = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;

      faces.push({
        points,
        normal: normal.map((value) => value / length),
        tone: box.tone,
        box: boxIndex,
        pivot: boxCenter,
      });
    }
  }

  const center = min.map((value, axis) => (value + max[axis]) / 2);
  const radius =
    Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;

  return { faces, center, radius, boxCorners };
}

export function BazisViewer({
  boxes,
  highlightTone = null,
  toneColors,
  heightClassName = "h-[60vh] min-h-72",
  highlightBoxes,
  animationKey,
}: {
  boxes: BazisViewerBox[];
  // Если задан, выделенные детали показываются с анимацией. Новое значение
  // запускает показ заново.
  animationKey?: number;
  // Номера деталей в boxes, которые нужно выделить: остальные бледнеют.
  // Так показываем, где в изделии стоит конкретная деталь.
  highlightBoxes?: number[];
  // Высота окна макета: в формах оно ниже, чем на отдельной странице.
  heightClassName?: string;
  // Цвет материала по его номеру (красный, зелёный, синий). Если цвета нет,
  // берём условный из палитры.
  toneColors?: Array<number[] | null>;
  // Номер материала, который нужно выделить: остальные детали бледнеют.
  highlightTone?: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState({ yaw: -0.5, pitch: 0.3, zoom: 1 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const scene = useMemo(() => buildScene(boxes), [boxes]);
  const markedBoxes = useMemo(
    () => (highlightBoxes ? new Set(highlightBoxes) : null),
    [highlightBoxes],
  );
  // Сколько миллисекунд идёт показ; null — показа нет.
  const [elapsed, setElapsed] = useState<number | null>(null);
  const frameRef = useRef(0);
  // Камера наведена на выделенные детали; кнопки видов возвращают весь макет.
  const [focused, setFocused] = useState(true);
  // Сколько миллисекунд идёт «маяк» после показа; null — кольца нет.
  const [beacon, setBeacon] = useState<number | null>(null);
  const showing = animationKey !== undefined && (markedBoxes?.size ?? 0) > 0;
  // Куда и насколько приблизить камеру, чтобы выделенные детали были крупно,
  // но вокруг оставалась часть изделия и было понятно, где они стоят.
  const focusTarget = useMemo(() => {
    if (!showing || !highlightBoxes) {
      return null;
    }

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];

    for (const box of highlightBoxes) {
      for (const corner of scene.boxCorners[box] ?? []) {
        for (let axis = 0; axis < 3; axis += 1) {
          min[axis] = Math.min(min[axis], corner[axis]);
          max[axis] = Math.max(max[axis], corner[axis]);
        }
      }
    }

    if (!Number.isFinite(min[0])) {
      return null;
    }

    const radius =
      Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;

    return {
      center: min.map((value, axis) => (value + max[axis]) / 2),
      zoom: Math.min(
        FOCUS_MAX_ZOOM,
        Math.max(1, (scene.radius * 0.4) / radius),
      ),
    };
  }, [highlightBoxes, scene, showing]);

  function stopAnimation() {
    cancelAnimationFrame(frameRef.current);
    setElapsed(null);
  }

  useEffect(() => {
    if (
      animationKey === undefined ||
      !markedBoxes ||
      markedBoxes.size === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const passed = now - start;

      if (passed >= ANIMATION_MS) {
        setElapsed(null);
        return;
      }

      setElapsed(passed);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame((now) => {
      // Показ заканчивается в обычном общем виде.
      setView({ yaw: -0.5, pitch: 0.3, zoom: 1 });
      setFocused(true);
      tick(now);
    });

    return () => cancelAnimationFrame(frameRef.current);
  }, [animationKey, markedBoxes]);

  useEffect(() => {
    if (
      !showing ||
      !focused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frame = 0;
    const start = performance.now() + ANIMATION_MS;
    const tick = (now: number) => {
      const passed = now - start;

      if (passed >= BEACON_MS * BEACON_WAVES) {
        setBeacon(null);
        return;
      }

      setBeacon(passed >= 0 ? passed : null);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      setBeacon(null);
    };
  }, [animationKey, focused, showing]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setSize({ width: canvas.clientWidth, height: canvas.clientHeight });
    });

    observer.observe(canvas);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context || size.width === 0) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    // Первые мгновения показа камера подлетает к изделию сбоку и сверху.
    const intro =
      elapsed !== null && elapsed < INTRO_MS
        ? easeOutCubic(elapsed / INTRO_MS)
        : 1;
    // Камера наезжает на деталь во время первого «вдоха».
    const focus =
      focusTarget && focused
        ? elapsed === null
          ? 1
          : easeOutCubic(
              Math.min(1, Math.max(0, (elapsed - INTRO_MS) / PULSE_MS)),
            )
        : 0;
    const center = focusTarget
      ? scene.center.map((value, axis) =>
          mix(value, focusTarget.center[axis], focus),
        )
      : scene.center;
    const shown = {
      yaw: mix(view.yaw - 1.2, view.yaw, intro),
      pitch: mix(0.75, view.pitch, intro),
      zoom:
        mix(0.6, view.zoom, intro) *
        (focusTarget ? mix(1, focusTarget.zoom, focus) : 1),
    };
    // Деталь дважды плавно увеличивается и возвращается к своему размеру,
    // оставаясь на своём месте в изделии.
    const pulse =
      elapsed !== null && elapsed >= INTRO_MS
        ? Math.sin((((elapsed - INTRO_MS) % PULSE_MS) / PULSE_MS) * Math.PI) **
          2
        : 0;
    const grow = 1 + 0.22 * pulse;
    // Мигание цветом во время показа.
    const flash =
      elapsed !== null ? 0.5 + 0.5 * Math.sin((elapsed / 330) * Math.PI) : 0;
    const markColor = MARK_COLOR.map((value, index) =>
      mix(value, FLASH_COLOR[index], flash),
    );
    const cosYaw = Math.cos(shown.yaw);
    const sinYaw = Math.sin(shown.yaw);
    const cosPitch = Math.cos(shown.pitch);
    const sinPitch = Math.sin(shown.pitch);
    // Поворот вокруг вертикали (Y), затем наклон вокруг горизонтали (X).
    const rotate = (point: number[]) => {
      const x = point[0] * cosYaw + point[2] * sinYaw;
      const z = -point[0] * sinYaw + point[2] * cosYaw;

      return [
        x,
        point[1] * cosPitch - z * sinPitch,
        point[1] * sinPitch + z * cosPitch,
      ];
    };
    const scale =
      (Math.min(size.width, size.height) / (scene.radius * 2.05)) * shown.zoom;
    const light = [0.35, 0.55, 0.76];
    const drawn = scene.faces
      .map((face) => {
        const normal = rotate(face.normal);

        // Грань смотрит от зрителя: не рисуем.
        if (normal[2] <= 0.001) {
          return null;
        }

        const marked = markedBoxes?.has(face.box) ?? false;
        const factor = marked ? grow : 1;
        const points = face.points.map((point) =>
          rotate(
            point.map(
              (value, axis) =>
                face.pivot[axis] +
                (value - face.pivot[axis]) * factor -
                center[axis],
            ),
          ),
        );
        const depth =
          points.reduce((sum, point) => sum + point[2], 0) / points.length;
        const shade =
          0.55 +
          0.45 *
            Math.max(
              0,
              normal[0] * light[0] +
                normal[1] * light[1] +
                normal[2] * light[2],
            );

        return {
          points,
          depth,
          shade,
          tone: face.tone,
          box: face.box,
          marked,
        };
      })
      .filter((face) => face !== null)
      // Выделенные детали рисуем последними, чтобы их было видно сквозь
      // остальные.
      .sort(
        (left, right) =>
          Number(left.marked) - Number(right.marked) ||
          left.depth - right.depth,
      );

    context.lineJoin = "round";
    context.lineWidth = 0.6;
    context.strokeStyle = "rgba(60, 48, 38, 0.55)";

    // Границы выделенных деталей на экране: вокруг них рисуем кольцо.
    const markedBounds = new Map<number, number[]>();

    for (const face of drawn) {
      const selecting = markedBoxes !== null || highlightTone !== null;
      const muted = markedBoxes
        ? !face.marked
        : highlightTone !== null && face.tone !== highlightTone;
      const color = muted
        ? [226, 224, 220]
        : face.marked
          ? markColor
          : selecting
            ? MARK_COLOR
            : (toneColors?.[face.tone] ?? palette[face.tone % palette.length]);

      context.globalAlpha = muted ? (markedBoxes ? 0.22 : 0.45) : 1;
      // У выделенной детали контур темнее и толще.
      context.lineWidth = face.marked ? 1.4 : 0.6;
      context.strokeStyle = face.marked
        ? "rgba(110, 38, 18, 0.9)"
        : "rgba(60, 48, 38, 0.55)";

      context.beginPath();
      face.points.forEach((point, index) => {
        const x = size.width / 2 + point[0] * scale;
        const y = size.height / 2 - point[1] * scale;

        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.closePath();
      context.fillStyle = `rgb(${color
        .map((value) => Math.round(value * face.shade))
        .join(",")})`;
      context.fill();
      context.stroke();

      if (face.marked) {
        const bounds = markedBounds.get(face.box) ?? [
          Infinity,
          Infinity,
          -Infinity,
          -Infinity,
        ];

        for (const point of face.points) {
          const x = size.width / 2 + point[0] * scale;
          const y = size.height / 2 - point[1] * scale;

          bounds[0] = Math.min(bounds[0], x);
          bounds[1] = Math.min(bounds[1], y);
          bounds[2] = Math.max(bounds[2], x);
          bounds[3] = Math.max(bounds[3], y);
        }

        markedBounds.set(face.box, bounds);
      }
    }
    context.globalAlpha = 1;

    if (beacon !== null && elapsed === null) {
      const wave = (beacon % BEACON_MS) / BEACON_MS;
      // Соседние детали обводим одним кольцом, чтобы кольца не путались.
      const circles = [...markedBounds.values()].map(
        ([minX, minY, maxX, maxY]) => ({
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2,
          r: Math.max(14, Math.hypot(maxX - minX, maxY - minY) / 2 + 8),
        }),
      );

      for (let merged = true; merged; ) {
        merged = false;

        for (let i = 0; i < circles.length && !merged; i += 1) {
          for (let j = i + 1; j < circles.length && !merged; j += 1) {
            const a = circles[i];
            const b = circles[j];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);

            if (distance < a.r + b.r) {
              const r = Math.max(a.r, b.r, (distance + a.r + b.r) / 2);
              const shift = distance > 0 ? (r - a.r) / distance : 0;

              circles[i] = {
                x: a.x + (b.x - a.x) * shift,
                y: a.y + (b.y - a.y) * shift,
                r,
              };
              circles.splice(j, 1);
              merged = true;
            }
          }
        }
      }

      context.lineWidth = 2.5;
      context.strokeStyle = `rgba(232, 104, 40, ${0.75 * (1 - wave)})`;

      for (const { x, y, r } of circles) {
        context.beginPath();
        context.arc(x, y, r + wave * 36, 0, Math.PI * 2);
        context.stroke();
      }
    }
  }, [
    beacon,
    elapsed,
    focusTarget,
    focused,
    highlightTone,
    markedBoxes,
    scene,
    size,
    toneColors,
    view,
  ]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {views.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              stopAnimation();
              setFocused(false);
              setView({ yaw: item.yaw, pitch: item.pitch, zoom: 1 });
            }}
            className="border border-[#cbc7bf] bg-white px-3 py-1.5 text-xs font-medium text-[#171714] transition hover:border-[#171714]"
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            setView((current) => ({ ...current, zoom: current.zoom * 1.3 }))
          }
          aria-label="Приблизить"
          className="border border-[#cbc7bf] bg-white px-3 py-1.5 text-xs font-medium text-[#171714] transition hover:border-[#171714]"
        >
          +
        </button>
        <button
          type="button"
          onClick={() =>
            setView((current) => ({
              ...current,
              zoom: Math.max(0.3, current.zoom / 1.3),
            }))
          }
          aria-label="Отдалить"
          className="border border-[#cbc7bf] bg-white px-3 py-1.5 text-xs font-medium text-[#171714] transition hover:border-[#171714]"
        >
          −
        </button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Объёмный вид проекта. Поворачивайте мышью или пальцем."
        className={`${heightClassName} w-full cursor-grab touch-none border border-[#d7d4ce] bg-[#f6f4f0] active:cursor-grabbing`}
        onPointerDown={(event) => {
          stopAnimation();
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
        }}
        onPointerMove={(event) => {
          const previous = pointers.current.get(event.pointerId);

          if (!previous) {
            return;
          }

          const next = { x: event.clientX, y: event.clientY };

          if (pointers.current.size === 2) {
            // Два пальца: меняем масштаб по изменению расстояния.
            const other = [...pointers.current.entries()].find(
              ([id]) => id !== event.pointerId,
            )?.[1];

            if (other) {
              const before = Math.hypot(
                previous.x - other.x,
                previous.y - other.y,
              );
              const after = Math.hypot(next.x - other.x, next.y - other.y);

              if (before > 0) {
                setView((current) => ({
                  ...current,
                  zoom: Math.min(
                    40,
                    Math.max(0.3, current.zoom * (after / before)),
                  ),
                }));
              }
            }
          } else {
            setView((current) => ({
              ...current,
              yaw: current.yaw + (next.x - previous.x) * 0.008,
              pitch: Math.min(
                Math.PI / 2,
                Math.max(
                  -Math.PI / 2,
                  current.pitch + (next.y - previous.y) * 0.008,
                ),
              ),
            }));
          }

          pointers.current.set(event.pointerId, next);
        }}
        onPointerUp={(event) => pointers.current.delete(event.pointerId)}
        onPointerCancel={(event) => pointers.current.delete(event.pointerId)}
        onWheel={(event) => {
          stopAnimation();
          const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;

          setView((current) => ({
            ...current,
            zoom: Math.min(40, Math.max(0.3, current.zoom * factor)),
          }));
        }}
      />
      <p className="text-xs text-[#77736c]">
        Поворачивайте мышью или пальцем, приближайте колесом или двумя пальцами.
        Показаны детали из плитных материалов; фурнитура и профили не рисуются.
      </p>
    </div>
  );
}
