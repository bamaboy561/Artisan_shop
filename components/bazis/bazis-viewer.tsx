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
};

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

  for (const box of boxes) {
    const corners = [0, 1].flatMap((layer) =>
      [
        [box.x, box.y],
        [box.x + box.sizeX, box.y],
        [box.x + box.sizeX, box.y + box.sizeY],
        [box.x, box.y + box.sizeY],
      ].map(([x, y]) => toWorld(box.matrix, x, y, layer * box.thickness)),
    );

    for (const corner of corners) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], corner[axis]);
        max[axis] = Math.max(max[axis], corner[axis]);
      }
    }

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
      });
    }
  }

  const center = min.map((value, axis) => (value + max[axis]) / 2);
  const radius =
    Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 || 1;

  return { faces, center, radius };
}

export function BazisViewer({
  boxes,
  highlightTone = null,
  toneColors,
  heightClassName = "h-[60vh] min-h-72",
}: {
  boxes: BazisViewerBox[];
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

    const cosYaw = Math.cos(view.yaw);
    const sinYaw = Math.sin(view.yaw);
    const cosPitch = Math.cos(view.pitch);
    const sinPitch = Math.sin(view.pitch);
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
      (Math.min(size.width, size.height) / (scene.radius * 2.05)) * view.zoom;
    const light = [0.35, 0.55, 0.76];
    const drawn = scene.faces
      .map((face) => {
        const normal = rotate(face.normal);

        // Грань смотрит от зрителя: не рисуем.
        if (normal[2] <= 0.001) {
          return null;
        }

        const points = face.points.map((point) =>
          rotate(point.map((value, axis) => value - scene.center[axis])),
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

        return { points, depth, shade, tone: face.tone };
      })
      .filter((face) => face !== null)
      .sort((left, right) => left.depth - right.depth);

    context.lineJoin = "round";
    context.lineWidth = 0.6;
    context.strokeStyle = "rgba(60, 48, 38, 0.55)";

    for (const face of drawn) {
      const muted = highlightTone !== null && face.tone !== highlightTone;
      const color = muted
        ? [226, 224, 220]
        : highlightTone !== null
          ? [201, 104, 78]
          : (toneColors?.[face.tone] ?? palette[face.tone % palette.length]);

      context.globalAlpha = muted ? 0.45 : 1;

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
    }
    context.globalAlpha = 1;
  }, [highlightTone, scene, size, toneColors, view]);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {views.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() =>
              setView({ yaw: item.yaw, pitch: item.pitch, zoom: 1 })
            }
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
