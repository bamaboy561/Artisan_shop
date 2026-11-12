// Фурнитура и инструкция сборки корпуса из конструктора. Всё считается
// по присадке деталей (cabinet-builder): сколько отверстий под шканты —
// столько шкантов, сколько эксцентриков — столько штоков и т. д.

import type { CabinetResult, CabinetSpec } from "../services/cabinet-builder";
import { hardwareHoles } from "../services/drilling-hardware";

export type FittingKey =
  | "minifix"
  | "minifixStem"
  | "dowel"
  | "confirmat"
  | "shelfPin"
  | "hinge"
  | "hingeScrew"
  | "handle"
  | "handleScrew"
  | "backNail"
  | "hanger";

export type FittingLine = {
  key: FittingKey;
  label: string;
  // Размер или уточнение: «8×30 мм».
  note: string;
  count: number;
  // Слова для поиска товара в каталоге фурнитуры.
  search: RegExp;
};

const BACK_NAIL_STEP = 150; // мм между гвоздями задней стенки

const FITTING_INFO: Record<
  FittingKey,
  { label: string; note: string; search: RegExp }
> = {
  minifix: {
    label: "Эксцентрик (минификс)",
    note: "корпус Ø15 мм",
    search: /минификс|эксцентрик|minifix/i,
  },
  minifixStem: {
    label: "Шток минификса",
    note: "под отверстие Ø5 мм",
    search: /шток.*(минификс|эксцентрик)|(минификс|эксцентрик).*шток|стяжк/i,
  },
  dowel: {
    label: "Шкант деревянный",
    note: "8×30 мм",
    search: /шкант/i,
  },
  confirmat: {
    label: "Евровинт (конфирмат)",
    note: "7×50 мм",
    search: /конфирмат|евровинт|евро-винт/i,
  },
  shelfPin: {
    label: "Полкодержатель",
    note: "Ø5 мм",
    search: /полкодерж/i,
  },
  hinge: {
    label: "Петля накладная с монтажной планкой",
    note: "чашка Ø35 мм",
    search: /петл/i,
  },
  hingeScrew: {
    label: "Саморез для петель и планок",
    note: "3,5×16 мм",
    search: /саморез/i,
  },
  handle: {
    label: "Ручка",
    note: "межосевое 128 мм",
    search: /ручк/i,
  },
  handleScrew: {
    label: "Винт для ручки",
    note: "М4×22 мм",
    search: /винт.*м4|м4.*винт/i,
  },
  backNail: {
    label: "Гвоздь или саморез для задней стенки",
    note: "2×20 мм",
    search: /гвозд|саморез/i,
  },
  hanger: {
    label: "Навес для навесного шкафа",
    note: "левый и правый",
    search: /навес|подвес/i,
  },
};

const isDoor = (title: string) => /: дверь/.test(title);

export function cabinetFittings(
  spec: CabinetSpec,
  result: CabinetResult,
  thickness: number,
): FittingLine[] {
  const counts = new Map<FittingKey, number>();
  const add = (key: FittingKey, count: number) => {
    if (count > 0) counts.set(key, (counts.get(key) ?? 0) + count);
  };

  for (const part of result.parts) {
    for (const item of part.hardware ?? []) {
      const holes = hardwareHoles(
        [item],
        part.length,
        part.width,
        thickness,
      ).length;
      const total = holes * part.quantity;
      switch (item.kind) {
        case "minifix":
          // У эксцентрика два отверстия: корпус в пласть и канал в торец.
          add("minifix", total / 2);
          add("minifixStem", total / 2);
          break;
        case "dowelEdge":
          add("dowel", total);
          break;
        case "confirmatEdge":
          add("confirmat", total);
          break;
        case "shelfPins":
          add("shelfPin", total);
          break;
        case "hinge":
          add("hinge", total);
          // Петля 2 самореза в чашку + планка 2 самореза.
          add("hingeScrew", total * 4);
          break;
      }
    }
    if (isDoor(part.title)) {
      add("handle", part.quantity);
      add("handleScrew", part.quantity * 2);
    }
  }

  if (result.back) {
    const perimeter = 2 * (result.back.length + result.back.width);
    add("backNail", Math.ceil(perimeter / BACK_NAIL_STEP));
  }
  if (spec.kind === "wall") add("hanger", 2);

  const order: FittingKey[] = [
    "confirmat",
    "minifix",
    "minifixStem",
    "dowel",
    "shelfPin",
    "hinge",
    "hingeScrew",
    "handle",
    "handleScrew",
    "hanger",
    "backNail",
  ];
  return order
    .filter((key) => counts.has(key))
    .map((key) => ({ key, ...FITTING_INFO[key], count: counts.get(key)! }));
}

export type AssemblyStep = {
  title: string;
  text: string;
  // Какие детали уже стоят на этом шаге и какие ставятся сейчас (по
  // названию детали без имени шкафа: «боковина левая», «полка»…).
  shown: string[];
  added: string[];
  fittings: Array<{ label: string; count: number }>;
  doorsOpen?: boolean;
};

export function partKind(title: string) {
  return title.replace(/^[^:]*: /, "");
}

export function cabinetAssembly(
  spec: CabinetSpec,
  result: CabinetResult,
  fittings: FittingLine[],
): AssemblyStep[] {
  const count = (key: FittingKey) =>
    fittings.find((line) => line.key === key)?.count ?? 0;
  const item = (key: FittingKey, value: number) =>
    value > 0 ? [{ label: FITTING_INFO[key].label, count: value }] : [];
  const has = (kind: string) =>
    result.parts.some((part) => partKind(part.title) === kind);
  const hasPlinth = has("цоколь");
  const shelves = result.parts.find((part) => partKind(part.title) === "полка");
  const doors = result.parts.filter((part) => isDoor(part.title));
  const steps: AssemblyStep[] = [];
  const body = ["боковина левая", "дно", "крыша"];

  const joint = spec.joint ?? "minifix";
  const dowelCount = count("dowel");
  const glue = dowelCount > 0 ? " Шканты лучше посадить на клей ПВА." : "";
  // Конфирматы цоколя: по одному с каждой стороны, остальные — корпус.
  const plinthScrews = hasPlinth ? 2 : 0;
  const bodyScrews = count("confirmat") - plinthScrews;
  const closed = [...body, ...(hasPlinth ? ["цоколь"] : []), "боковина правая"];

  if (joint === "minifix") {
    steps.push({
      title: "Подготовьте боковины",
      text: `Положите боковины внутренней стороной вверх. Вкрутите штоки минификса в отверстия Ø5 у верхнего и нижнего края${dowelCount > 0 ? " и вставьте шканты в отверстия Ø8" : ""}.${glue}`,
      shown: ["боковина левая"],
      added: ["боковина левая"],
      fittings: [
        ...item("minifixStem", count("minifixStem")),
        ...item("dowel", dowelCount),
      ],
    });
    steps.push({
      title: "Вставьте эксцентрики в крышу и дно",
      text: "Вставьте эксцентрики в отверстия Ø15 крыши и дна стрелкой к торцу. Поставьте крышу и дно на шканты и штоки левой боковины и поверните эксцентрики по часовой стрелке до упора.",
      shown: body,
      added: ["дно", "крыша"],
      fittings: item("minifix", count("minifix") / 2),
    });
  } else {
    if (dowelCount > 0) {
      steps.push({
        title: "Вставьте шканты",
        text: `Вставьте шканты в оба торца крыши и дна, в отверстия Ø8 между отверстиями под конфирматы.${glue}`,
        shown: ["дно", "крыша"],
        added: ["дно", "крыша"],
        fittings: item("dowel", dowelCount),
      });
    }
    steps.push({
      title: "Прикрутите крышу и дно к левой боковине",
      text: `Положите левую боковину внутренней стороной вверх, поставьте на неё крышу и дно${dowelCount > 0 ? " шкантами в отверстия Ø8" : ""}. Совместите сквозные отверстия Ø7 боковины с отверстиями Ø5 в торцах и закрутите конфирматы шестигранником 4 мм.`,
      shown: body,
      added: dowelCount > 0 ? ["боковина левая"] : body,
      fittings: item("confirmat", bodyScrews / 2),
    });
  }
  if (hasPlinth) {
    steps.push({
      title: "Прикрутите цоколь",
      text: "Поставьте цоколь под дно у переднего края и притяните его к левой боковине евровинтом через отверстие Ø7.",
      shown: [...body, "цоколь"],
      added: ["цоколь"],
      fittings: item("confirmat", plinthScrews / 2),
    });
  }
  steps.push({
    title: "Наденьте правую боковину",
    text:
      joint === "minifix"
        ? `Наденьте правую боковину на шканты и штоки, затяните эксцентрики${hasPlinth ? " и евровинт цоколя" : ""}.`
        : `Поставьте правую боковину${dowelCount > 0 ? " на шканты" : ""} и закрутите конфирматы в крышу и дно${hasPlinth ? " и евровинт цоколя" : ""}.`,
    shown: closed,
    added: ["боковина правая"],
    fittings: [
      ...(joint === "minifix" ? item("minifix", count("minifix") / 2) : []),
      ...item(
        "confirmat",
        (joint === "minifix" ? 0 : bodyScrews / 2) + plinthScrews / 2,
      ),
    ],
  });
  if (result.back) {
    steps.push({
      title: "Прибейте заднюю стенку",
      text: `Положите корпус на переднюю кромку и проверьте диагонали — они должны быть равны, тогда корпус ровный. Прибейте ХДФ ${result.back.length} × ${result.back.width} мм гладкой стороной внутрь, шаг ${BACK_NAIL_STEP} мм.`,
      shown: [...closed, "задняя стенка"],
      added: ["задняя стенка"],
      fittings: item("backNail", count("backNail")),
    });
  }
  const withBack = [...closed, ...(result.back ? ["задняя стенка"] : [])];
  if (shelves) {
    steps.push({
      title: "Поставьте полки",
      text: `Поставьте корпус. Вставьте полкодержатели в отверстия Ø5 — по 4 на полку — и уложите ${shelves.quantity} ${shelves.quantity === 1 ? "полку" : shelves.quantity < 5 ? "полки" : "полок"}.`,
      shown: [...withBack, "полка"],
      added: ["полка"],
      fittings: item("shelfPin", count("shelfPin")),
    });
  }
  const inside = [...withBack, ...(shelves ? ["полка"] : [])];
  if (doors.length > 0) {
    const doorKinds = doors.map((door) => partKind(door.title));
    steps.push({
      title: "Навесьте двери",
      text: "Прикрутите монтажные планки к боковинам по отверстиям Ø3, петли — в чашки Ø35 на дверях. Защёлкните петли на планки и отрегулируйте винтами петель зазор 3 мм между дверями и по краям.",
      shown: [...inside, ...doorKinds],
      added: doorKinds,
      fittings: [
        ...item("hinge", count("hinge")),
        ...item("hingeScrew", count("hingeScrew")),
      ],
      doorsOpen: true,
    });
    steps.push({
      title: "Поставьте ручки",
      text: "Разметьте отверстия под ручки по шаблону, просверлите Ø5 насквозь и прикрутите ручки винтами изнутри.",
      shown: [...inside, ...doorKinds],
      added: [],
      fittings: [
        ...item("handle", count("handle")),
        ...item("handleScrew", count("handleScrew")),
      ],
    });
  }
  if (spec.kind === "wall") {
    steps.push({
      title: "Повесьте шкаф",
      text: "Прикрутите навесы в верхних углах изнутри корпуса, закрепите на стене монтажную шину или крюки по уровню и повесьте шкаф. Отрегулируйте высоту и прижим винтами навесов.",
      shown: [...inside, ...doors.map((door) => partKind(door.title))],
      added: [],
      fittings: item("hanger", count("hanger")),
    });
  }
  return steps;
}
