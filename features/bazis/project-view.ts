import type { BazisPartInfo } from "@/components/bazis/bazis-viewer";
import { describeEdgedSides } from "@/features/bazis/part-groups";
import type { BazisDrilling, BazisHole, BazisProject } from "@/lib/bazis-b3d";

// Проект Базиса в том виде, в каком его получает страница просмотра.
// Детали идут по одной (для объёмного макета), строки списка собираются
// уже в браузере, чтобы их можно было править.
export type BazisViewPanel = {
  name: string;
  position: string;
  material: number;
  thickness: number;
  length: number;
  width: number;
  edgedLengthSides: number;
  edgedWidthSides: number;
  edgeMaterial: string;
  complexContour: boolean;
  textured: boolean;
  block: string;
  blockId?: string;
  // Отверстия присадки на детали. В проектах, сохранённых в браузере
  // раньше, поля нет.
  drillHoles?: BazisHole[];
  box: {
    x: number;
    y: number;
    sizeX: number;
    sizeY: number;
    lengthAlongX: boolean;
    matrix: number[];
  };
};

export type BazisViewProject = {
  orderName: string;
  materials: string[];
  panels: BazisViewPanel[];
  hardware: Array<{ name: string; quantity: number }>;
  // В проектах, сохранённых в браузере до появления присадки, поля нет.
  drilling?: BazisDrilling;
  // Пары деталей, скреплённых одной фурнитурой (см. BazisProject.joints).
  joints?: number[][];
};

export type BazisViewResponse =
  | { ok: true; project: BazisViewProject }
  | { ok: false; error: string };

export function toBazisViewProject(project: BazisProject): BazisViewProject {
  const materials = [...new Set(project.panels.map((panel) => panel.material))];

  return {
    orderName: project.orderName || project.modelName,
    materials,
    hardware: project.hardware,
    drilling: project.drilling,
    joints: project.joints,
    panels: project.panels.map((panel) => ({
      name: panel.name,
      position: panel.position,
      material: materials.indexOf(panel.material),
      thickness: panel.thickness,
      length: panel.length,
      width: panel.width,
      edgedLengthSides: panel.edges.filter((edge) => edge.side === "length")
        .length,
      edgedWidthSides: panel.edges.filter((edge) => edge.side === "width")
        .length,
      edgeMaterial: [
        ...new Set(panel.edges.map((edge) => edge.material).filter(Boolean)),
      ].join(", "),
      complexContour: panel.complexContour,
      textured: panel.textured,
      block: panel.block,
      blockId: panel.blockId,
      drillHoles: panel.drillHoles,
      box: panel.box,
    })),
  };
}

// Подпись детали для карточки, которая открывается по нажатию на макете.
export function toBazisPartInfo(
  panel: BazisViewPanel,
  materials: string[],
): BazisPartInfo {
  return {
    name: panel.name,
    position: panel.position,
    material: materials[panel.material],
    length: panel.length,
    width: panel.width,
    thickness: panel.thickness,
    edges: describeEdgedSides(panel.edgedLengthSides, panel.edgedWidthSides),
    edgeMaterial: panel.edgeMaterial,
    block: panel.block,
    blockId: panel.blockId,
    textured: panel.textured,
    complexContour: panel.complexContour,
    holes: panel.drillHoles?.length,
    drillHoles: panel.drillHoles,
  };
}

// Ключ черновика калькулятора распила: тот же, что в
// features/services/cut-calculator.tsx. Через него список деталей
// передаётся в калькулятор.
export const CALCULATOR_DRAFT_KEY = "artisan:cut-calculator:draft:v1";

// Плита из каталога, выбранная на странице проекта: калькулятор распила
// читает её один раз при открытии и подставляет в выбор материала.
export const CALCULATOR_PRESET_HANDOFF_KEY =
  "artisan:cut-calculator:preset-handoff:v1";

// Открытый проект с правками клиента. Хранится только в его браузере.
export const BAZIS_WORKSPACE_KEY = "artisan:bazis-workspace:v1";
