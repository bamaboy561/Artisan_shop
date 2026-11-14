// Фурнитура и инструкция сборки корпуса из конструктора. Всё считается
// по присадке деталей (cabinet-builder): сколько отверстий под шканты —
// столько шкантов, сколько эксцентриков — столько штоков и т. д.

import {
  KUPE_TRAY_BOX,
  sectionSuffix,
  type CabinetResult,
  type CabinetSpec,
} from "../services/cabinet-builder";
import { hardwareHoles } from "../services/drilling-hardware";
import { kitchenLegs, type KitchenResult } from "../services/kitchen-builder";

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
  | "hanger"
  | "ledProfile"
  | "ledStrip"
  | "slide"
  | "slideScrew"
  | "frontScrew"
  | "topTrack"
  | "bottomTrack"
  | "kupeRoller"
  | "rod"
  | "rodHolder"
  | "rodScrew"
  | "spacerScrew"
  | "trousers"
  | "kitchenLeg"
  | "plinthClip"
  | "lift"
  | "dishDryer"
  | "cargo"
  | "worktopPlinth"
  | "worktopJoint"
  | "worktopEnd"
  | "wallRail";

export type FittingLine = {
  key: FittingKey;
  label: string;
  // Размер или уточнение: «8×30 мм».
  note: string;
  count: number;
  // Единица: штуки или метры (профиль и лента).
  unit?: "м";
  // Слова для поиска товара в каталоге фурнитуры.
  search: RegExp;
};

const BACK_NAIL_STEP = 150; // мм между гвоздями задней стенки

const FITTING_INFO: Record<
  FittingKey,
  { label: string; note: string; search: RegExp; unit?: "м" }
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
  slide: {
    label: "Направляющие шариковые",
    note: "полного выдвижения, пара на ящик",
    search: /направляющ/i,
  },
  slideScrew: {
    label: "Саморез для направляющих",
    note: "3,5×16 мм",
    search: /саморез/i,
  },
  frontScrew: {
    label: "Саморез для фасада ящика",
    note: "4×30 мм",
    search: /саморез.*4[×x*х]\s?[34]\d|4[×x*х][34]\d.*саморез/i,
  },
  topTrack: {
    label: "Верхний профиль TopLine L, двойной",
    note: "по ширине шкафа",
    search: /top\s?line.*верх|верх.*top\s?line/i,
  },
  bottomTrack: {
    label: "Нижний профиль TopLine L, двойной",
    note: "по ширине шкафа",
    search: /top\s?line.*ниж|ниж.*top\s?line/i,
  },
  kupeRoller: {
    label: "Комплект роликов TopLine L на дверь",
    note: "верхние и нижние, со стопорами",
    search: /top\s?line.*(ролик|комплект)|(ролик|комплект).*top\s?line/i,
  },
  rod: {
    label: "Штанга для одежды",
    note: "Ø25 мм",
    search: /штанга/i,
  },
  rodHolder: {
    label: "Штангодержатель",
    note: "Ø25 мм, пара на штангу",
    search: /штангодерж|держател\S* штанг/i,
  },
  spacerScrew: {
    label: "Саморез для проставок",
    note: "4×30 мм",
    search: /саморез.*4[×x*х]\s?[34]\d|4[×x*х][34]\d.*саморез/i,
  },
  trousers: {
    label: "Брючница выдвижная",
    note: "на направляющих, под полку",
    search: /брючн/i,
  },
  kitchenLeg: {
    label: "Ножка кухонная регулируемая",
    note: "100 мм, под цоколь",
    search: /ножк|опора/i,
  },
  plinthClip: {
    label: "Клипса цоколя",
    note: "крепит цоколь к ножке",
    search: /клипс|цокол/i,
  },
  lift: {
    label: "Подъёмный механизм двери",
    note: "газлифт, пара на дверь",
    search: /газлифт|подъ[её]мн|подъемник|aventos/i,
  },
  dishDryer: {
    label: "Сушка для посуды",
    note: "в навесной шкаф",
    search: /сушк/i,
  },
  worktopPlinth: {
    label: "Плинтус для столешницы",
    note: "вдоль стен, с заглушками и уголками",
    search: /плинтус.*столешн|столешн.*плинтус/i,
    unit: "м",
  },
  worktopJoint: {
    label: "Планка соединительная для столешницы",
    note: "на стык в углу",
    search: /планк.*(соедин|стыков)|(соедин|стыков).*планк/i,
  },
  worktopEnd: {
    label: "Планка торцевая для столешницы",
    note: "на концы, которые не упираются в стену",
    search: /планк.*торц|торц.*планк/i,
  },
  wallRail: {
    label: "Шина монтажная для навесных шкафов",
    note: "под регулируемые навесы",
    search: /шина.*(монтаж|навес)|(монтаж|навес).*шина/i,
    unit: "м",
  },
  cargo: {
    label: "Карго (бутылочница)",
    note: "выдвижное, в узкую тумбу",
    search: /карго|бутылочн/i,
  },
  rodScrew: {
    label: "Саморез для штангодержателей",
    note: "3,5×16 мм",
    search: /саморез/i,
  },
  ledProfile: {
    label: "Профиль для LED-ленты",
    note: "врезной 10×10 мм, с рассеивателем",
    search: /профил\S*.*(led|светодиод)|(led|светодиод).*профил/i,
    unit: "м",
  },
  ledStrip: {
    label: "Светодиодная лента",
    note: "шириной до 8 мм, плюс блок питания",
    search: /(лент\S*.*(led|светодиод))|((led|светодиод).*лент)/i,
    unit: "м",
  },
};

// Распашные двери: на петлях и с ручкой. Двери-купе — отдельно.
const isDoor = (title: string) => /: дверь(?! купе)/.test(title);
const isPartition = (title: string) => /: перегородка/.test(title);
// Вид детали без секции купе: «полка, секция 2» → «полка».
export const baseKind = (kind: string) => kind.replace(/, секция \d+$/, "");
const drawerBottoms = (result: CabinetResult) =>
  result.drawers
    ? (result.drawers.bottoms ?? [
        { ...result.drawers.bottom, count: result.drawers.count },
      ])
    : [];
const bottomNails = (result: CabinetResult) =>
  drawerBottoms(result).reduce(
    (sum, bottom) =>
      sum +
      bottom.count *
        Math.ceil((2 * (bottom.length + bottom.width)) / BACK_NAIL_STEP),
    0,
  );
const isDrawerFront = (title: string) => /: фасад ящика/.test(title);

const FITTING_ORDER: FittingKey[] = [
  "confirmat",
  "minifix",
  "minifixStem",
  "dowel",
  "shelfPin",
  "hinge",
  "hingeScrew",
  "slide",
  "slideScrew",
  "spacerScrew",
  "frontScrew",
  "handle",
  "handleScrew",
  "topTrack",
  "bottomTrack",
  "kupeRoller",
  "rod",
  "rodHolder",
  "rodScrew",
  "trousers",
  "hanger",
  "backNail",
  "ledProfile",
  "ledStrip",
  "kitchenLeg",
  "plinthClip",
  "lift",
  "dishDryer",
  "cargo",
  "wallRail",
  "worktopPlinth",
  "worktopJoint",
  "worktopEnd",
];

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
          // Полкодержатели считаем по полкам ниже: в перегородке купе одно
          // сквозное отверстие держит полки с обеих сторон.
          break;
        case "hinge":
          add("hinge", total);
          // Петля 2 самореза в чашку + планка 2 самореза.
          add("hingeScrew", total * 4);
          break;
      }
    }
    if (isDoor(part.title) || isDrawerFront(part.title)) {
      add("handle", part.quantity);
      add("handleScrew", part.quantity * 2);
    }
  }

  // Ящики: пара направляющих (по 6 саморезов на каждую половину, 4
  // половины на пару), фасад на 4 самореза изнутри, дно ХДФ на гвоздях.
  if (result.drawers && result.drawers.slide > 0) {
    const { count: drawers } = result.drawers;
    add("slide", drawers);
    add("slideScrew", drawers * 12);
    add("frontScrew", drawers * 4);
    add("backNail", bottomNails(result));
    // Выдвижные полки купе на тех же направляющих.
    const trays = result.drawers.trays ?? 0;
    add("slide", trays);
    add("slideScrew", trays * 12);
  }

  if (result.back) {
    const perimeter = 2 * (result.back.length + result.back.width);
    add("backNail", Math.ceil(perimeter / BACK_NAIL_STEP));
  }
  if (spec.kind === "wall") add("hanger", 2);

  // По 4 полкодержателя на каждую съёмную полку.
  for (const part of result.parts) {
    const kind = baseKind(partKind(part.title));
    if (kind.startsWith("полка")) {
      add("shelfPin", part.quantity * 4);
    }
    // Проставка ящиков: 4 самореза к стенке секции.
    if (kind.startsWith("проставка")) {
      add("spacerScrew", part.quantity * 4);
    }
  }

  // Купе: двойные профили по ширине шкафа, ролики на каждую дверь,
  // штанга с парой держателей (по 2 самореза) в секциях со штангой.
  const kupe = result.kupe;
  if (kupe) {
    add("topTrack", 1);
    add("bottomTrack", 1);
    add("kupeRoller", kupe.doors.count);
    const rods = kupe.sections.reduce(
      (sum, section) => sum + section.rods.length,
      0,
    );
    add("rod", rods);
    add("rodHolder", rods * 2);
    add("rodScrew", rods * 4);
    add(
      "trousers",
      kupe.sections.reduce((sum, section) => sum + section.trousers.length, 0),
    );
  }

  // Подсветка: длина пазов под профиль, с запасом до целого метра.
  let ledLength = 0;
  for (const part of result.parts) {
    for (const groove of part.milling?.grooves ?? []) {
      const along =
        groove.side === "top" || groove.side === "bottom"
          ? part.length
          : part.width;
      ledLength += along * part.quantity;
    }
  }
  if (ledLength > 0) {
    const meters = Math.ceil(ledLength / 1000);
    add("ledProfile", meters);
    add("ledStrip", meters);
  }

  const slideNote = result.drawers
    ? `${result.drawers.slide} мм, полного выдвижения, пара на ящик`
    : "";
  const notes: Partial<Record<FittingKey, string>> = {
    ...(slideNote ? { slide: slideNote } : {}),
    ...(kupe
      ? {
          topTrack: `${spec.width} мм`,
          bottomTrack: `${spec.width} мм`,
          rod: `Ø25 мм, отрезать: ${kupe.sections
            .flatMap((section) => section.rods.map(() => section.width - 4))
            .map((length) => `${Math.round(length)}`)
            .join(", ")} мм`,
          trousers: `под секцию ${kupe.sections
            .flatMap((section) =>
              section.trousers.map(() => Math.round(section.width)),
            )
            .join(", ")} мм, крепится под полку`,
        }
      : {}),
  };
  return FITTING_ORDER.filter((key) => counts.has(key)).map((key) => ({
    key,
    ...FITTING_INFO[key],
    ...(notes[key] ? { note: notes[key] } : {}),
    count: counts.get(key)!,
  }));
}

export type AssemblyStep = {
  title: string;
  text: string;
  // Какие детали уже стоят на этом шаге и какие ставятся сейчас (по
  // названию детали без имени шкафа: «боковина левая», «полка»…).
  shown: string[];
  added: string[];
  fittings: Array<{ label: string; count: number; unit?: "м" }>;
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
    value > 0
      ? [
          {
            label: FITTING_INFO[key].label,
            count: value,
            ...(FITTING_INFO[key].unit ? { unit: FITTING_INFO[key].unit } : {}),
          },
        ]
      : [];
  const has = (kind: string) =>
    result.parts.some((part) => baseKind(partKind(part.title)) === kind);
  // Все виды деталей (с секциями купе), чей вид без секции подходит.
  const kindsWhere = (test: (kind: string) => boolean) => [
    ...new Set(
      result.parts
        .map((part) => partKind(part.title))
        .filter((kind) => test(baseKind(kind))),
    ),
  ];
  const hasPlinth = has("цоколь");
  const doors = result.parts.filter((part) => isDoor(part.title));
  const steps: AssemblyStep[] = [];
  const body = ["боковина левая", "дно", "крыша"];

  const joint = spec.joint ?? "minifix";
  const dowelCount = count("dowel");
  const glue = dowelCount > 0 ? " Шканты лучше посадить на клей ПВА." : "";
  // Конфирматы цоколя: по одному с каждой стороны, остальные — корпус.
  const plinthScrews = hasPlinth ? 2 : 0;
  // Конфирматы коробов ящиков: по 2 на каждый из 4 углов.
  const drawerScrews = result.parts
    .filter((part) =>
      ["ящик стенка", "выдвижная полка стенка"].includes(
        baseKind(partKind(part.title)),
      ),
    )
    .reduce((sum, part) => sum + part.quantity * 4, 0);
  const drawerNails = drawerScrews > 0 ? bottomNails(result) : 0;
  // Перегородки купе: конфирматы через крышу и дно.
  const partitions = result.parts.filter((part) => isPartition(part.title));
  const partitionKinds = partitions.map((part) => partKind(part.title));
  const partitionScrews = partitions.reduce(
    (sum, part) =>
      sum +
      hardwareHoles(
        part.hardware?.filter((entry) => entry.kind === "confirmatEdge"),
        part.length,
        part.width,
        16,
      ).length,
    0,
  );
  // Конфирматы стоек колонок и бортиков выдвижных полок.
  const edgeScrews = (test: (kind: string) => boolean) =>
    result.parts
      .filter((part) => test(baseKind(partKind(part.title))))
      .reduce(
        (sum, part) =>
          sum +
          hardwareHoles(
            part.hardware?.filter((entry) => entry.kind === "confirmatEdge"),
            part.length,
            part.width,
            16,
          ).length *
            part.quantity,
        0,
      );
  const standScrews = edgeScrews((kind) => kind.startsWith("стойка"));
  const trayScrews = edgeScrews((kind) => kind === "выдвижная полка");
  const bodyScrews =
    count("confirmat") -
    plinthScrews -
    drawerScrews -
    partitionScrews -
    standScrews -
    trayScrews;
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
  if (partitions.length > 0) {
    steps.push({
      title:
        partitions.length === 1
          ? "Поставьте перегородку"
          : "Поставьте перегородки",
      text: `Положите корпус на заднюю кромку. Вставьте ${partitions.length === 1 ? "перегородку" : "перегородки"} между дном и крышей по отверстиям Ø7 и закрутите конфирматы через крышу и дно. Проверьте, что ${partitions.length === 1 ? "перегородка стоит" : "перегородки стоят"} ровно по передней кромке.`,
      shown: [...closed, ...partitionKinds],
      added: partitionKinds,
      fittings: item("confirmat", partitionScrews),
    });
  }
  const framed = [...closed, ...partitionKinds];
  if (result.back) {
    steps.push({
      title: "Прибейте заднюю стенку",
      text: `Положите корпус на переднюю кромку и проверьте диагонали — они должны быть равны, тогда корпус ровный. Прибейте ХДФ ${result.back.length} × ${result.back.width} мм гладкой стороной внутрь, шаг ${BACK_NAIL_STEP} мм.`,
      shown: [...framed, "задняя стенка"],
      added: ["задняя стенка"],
      fittings: item("backNail", count("backNail") - drawerNails),
    });
  }
  const withBack = [...framed, ...(result.back ? ["задняя стенка"] : [])];
  const shelfParts = result.parts.filter((part) =>
    baseKind(partKind(part.title)).startsWith("полка"),
  );
  const shelfKinds = kindsWhere((kind) => kind.startsWith("полка"));
  const fixedShelf = has("полка над ящиками");
  const kupe = result.kupe;
  if (shelfKinds.length > 0) {
    const total = shelfParts.reduce((sum, part) => sum + part.quantity, 0);
    const grooved = shelfParts.some((part) => part.milling?.grooves?.length);
    steps.push({
      title: "Поставьте полки",
      text: `Поставьте корпус. Вставьте полкодержатели в отверстия Ø5 — по 4 на полку — и уложите ${total} ${total === 1 ? "полку" : total < 5 ? "полки" : "полок"}${grooved ? " пазом вниз" : ""}.${fixedShelf ? (kupe ? " Полка над ящиками закрывает их сверху." : " Нижняя полка отделяет ящики от отделения за дверями.") : ""}${has("полка антресоли") ? " Полки антресоли отделяют верх секций." : ""}`,
      shown: [...withBack, ...shelfKinds],
      added: shelfKinds,
      fittings: item("shelfPin", count("shelfPin")),
    });
  }
  const standKinds = kindsWhere((kind) => kind.startsWith("стойка"));
  if (standKinds.length > 0) {
    steps.push({
      title: standKinds.length === 1 ? "Поставьте стойку" : "Поставьте стойки",
      text: "Стойка делит секцию на две колонки. Поставьте её между полками со стойкой по отверстиям Ø7 и закрутите конфирматы через полки сверху и снизу (через крышу или дно, если стойка у них). Полки колонок ставятся на полкодержатели в стенке секции и в стойке.",
      shown: [...withBack, ...shelfKinds, ...standKinds],
      added: standKinds,
      fittings: item("confirmat", standScrews),
    });
  }
  const rodKinds = kupe
    ? kupe.sections
        .filter((section) => section.rods.length > 0)
        .map((section) => `штанга${sectionSuffix(section.index)}`)
    : [];
  if (kupe && rodKinds.length > 0) {
    const heights = [
      ...new Set(
        kupe.sections.flatMap((section) =>
          section.rods.map((at) => Math.round(at)),
        ),
      ),
    ].sort((a, b) => b - a);
    steps.push({
      title: count("rod") === 1 ? "Повесьте штангу" : "Повесьте штанги",
      text: `Прикрутите штангодержатели к стенкам секции под полкой, по 2 самореза: ось штанги на ${heights.join(", ")} мм от пола. Отрежьте штангу по ширине секции минус 4 мм и вставьте в держатели.`,
      shown: [...withBack, ...shelfKinds, ...standKinds, ...rodKinds],
      added: rodKinds,
      fittings: [
        ...item("rod", count("rod")),
        ...item("rodHolder", count("rodHolder")),
        ...item("rodScrew", count("rodScrew")),
      ],
    });
  }
  const trouserKinds = kupe
    ? kupe.sections
        .filter((section) => section.trousers.length > 0)
        .map((section) => `брючница${sectionSuffix(section.index)}`)
    : [];
  if (trouserKinds.length > 0) {
    steps.push({
      title: "Поставьте брючницу",
      text: "Прикрутите направляющие брючницы снизу к полке над ней по инструкции к брючнице, вставьте рамку до щелчка. Брюки висят под ней.",
      shown: [
        ...withBack,
        ...shelfKinds,
        ...standKinds,
        ...rodKinds,
        ...trouserKinds,
      ],
      added: trouserKinds,
      fittings: item("trousers", count("trousers")),
    });
  }
  const withRod = [...rodKinds, ...trouserKinds];
  const spacerKinds = kindsWhere((kind) => kind.startsWith("проставка"));
  const drawers = result.drawers;
  const trays = drawers?.trays ?? 0;
  const boxSideKinds = kindsWhere(
    (kind) => kind === "ящик боковина" || kind === "выдвижная полка боковина",
  );
  const boxKinds = [
    ...boxSideKinds,
    ...kindsWhere(
      (kind) => kind === "ящик стенка" || kind === "выдвижная полка стенка",
    ),
    ...boxSideKinds.map((kind) =>
      kind.replace(/(ящик|выдвижная полка) боковина/, (_, what: string) =>
        what === "ящик" ? "дно ящика" : "дно выдвижной полки",
      ),
    ),
  ];
  const frontKinds = kindsWhere((kind) => kind === "фасад ящика");
  const drawerKinds = [...boxKinds, ...frontKinds];
  const withShelves = [...withBack, ...shelfKinds, ...standKinds, ...withRod];
  if (drawers && drawers.slide > 0 && boxSideKinds.length > 0) {
    const bottoms = drawerBottoms(result)
      .map(
        (bottom) =>
          `${Math.round(bottom.length)} × ${Math.round(bottom.width)} мм${drawerBottoms(result).length > 1 ? ` (${bottom.count} шт.)` : ""}`,
      )
      .join(", ");
    const boxes = drawers.count + trays;
    steps.push({
      title: "Соберите короба ящиков",
      text: `Соберите ${boxes} ${boxes === 1 ? "короб" : boxes < 5 ? "короба" : "коробов"}: стенки между боковинами на конфирматах через отверстия Ø7. Проверьте диагонали и прибейте снизу дно ХДФ ${bottoms}.${trays > 0 ? ` Низкие короба по ${KUPE_TRAY_BOX} мм — выдвижные полки без фасада.` : ""}`,
      shown: boxKinds,
      added: boxKinds,
      fittings: [
        ...item("confirmat", drawerScrews),
        ...item("backNail", drawerNails),
      ],
    });
    if (spacerKinds.length > 0) {
      steps.push({
        title: "Прикрутите проставки",
        text: "Ящики должны выходить в проём между дверями-купе, не задевая их. Прикрутите проставки к стенкам секций со стороны перехлёста дверей, по высоте блока ящиков или выдвижных полок, по 4 самореза.",
        shown: [...withShelves, ...spacerKinds],
        added: spacerKinds,
        fittings: item("spacerScrew", count("spacerScrew")),
      });
    }
    const centers = kupe
      ? kupe.sections.flatMap((section) => [
          ...(section.drawer?.boxesAt ?? []).map(
            (at) => at + drawers.boxHeight / 2,
          ),
          ...(section.drawer?.traysAt ?? []).map(
            (at) => at + KUPE_TRAY_BOX / 2,
          ),
        ])
      : drawers.boxesAt.map((at) => at + drawers.boxHeight / 2);
    steps.push({
      title: "Поставьте ящики на направляющие",
      text: `Разделите направляющие ${drawers.slide} мм на половины. Узкие прикрутите к боковинам коробов по центру высоты, широкие — к ${kupe ? "стенкам секции (или проставкам)" : "боковинам корпуса"} по разметке, центр направляющей от пола: ${[
        ...new Set(centers.map((at) => Math.round(at))),
      ]
        .sort((a, b) => a - b)
        .join(", ")} мм (снизу вверх). Вставьте короба до щелчка.`,
      shown: [...withShelves, ...spacerKinds, ...boxKinds],
      added: boxKinds,
      fittings: [
        ...item("slide", count("slide")),
        ...item("slideScrew", count("slideScrew")),
      ],
    });
    if (frontKinds.length > 0) {
      steps.push({
        title: "Прикрутите фасады ящиков",
        text: `${drawers.inset ? "Фасады вкладные: приложите фасад внутри секции с зазором 2 мм до стенок и 3 мм между фасадами" : "Приложите фасад к коробу с зазором 3 мм между фасадами"}, прикрутите изнутри короба четырьмя саморезами. Поставьте ручки: разметьте по шаблону, просверлите Ø5 насквозь и прикрутите винтами изнутри.`,
        shown: [...withShelves, ...spacerKinds, ...drawerKinds],
        added: frontKinds,
        fittings: [
          ...item("frontScrew", count("frontScrew")),
          ...item("handle", drawers.count),
          ...item("handleScrew", drawers.count * 2),
        ],
      });
    }
  }
  const led = spec.led ?? "none";
  const hasLed = count("ledProfile") > 0;
  const inside = [
    ...withShelves,
    ...(drawers ? [...spacerKinds, ...drawerKinds] : []),
    ...(hasLed ? ["подсветка"] : []),
  ];
  if (hasLed) {
    steps.push({
      title: "Поставьте подсветку",
      text:
        led === "shelves"
          ? "Нарежьте профиль по длине полок, вклейте ленту и вставьте профиль в паз 10×10 у переднего края. Полки ставятся пазом вниз. Провода выведите назад к блоку питания."
          : "Нарежьте профиль по высоте между дном и крышей, вклейте ленту и вставьте профиль в пазы 10×10 на боковинах. Провода выведите вверх к блоку питания.",
      shown: inside,
      added: ["подсветка"],
      fittings: [
        ...item("ledProfile", count("ledProfile")),
        ...item("ledStrip", count("ledStrip")),
      ],
    });
  }
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
        ...item("handle", doors.length),
        ...item("handleScrew", doors.length * 2),
      ],
    });
  }
  if (kupe) {
    const door = result.parts.find(
      (part) => partKind(part.title) === "дверь купе",
    );
    steps.push({
      title: "Поставьте двери-купе",
      text: `Прикрутите верхний профиль TopLine L под крышу или к потолку, нижний — к полу или к дну по передней кромке, оба на ${spec.width} мм. Прикрутите ролики к дверям по инструкции к комплекту. Поставьте ${kupe.doors.count} двери ${door ? `${door.length} × ${door.width} мм` : ""}: ${kupe.doors.count === 2 ? "левую в заднюю дорожку, правую в переднюю" : kupe.doors.count === 3 ? "крайние в заднюю дорожку, среднюю в переднюю" : "1-ю и 3-ю в заднюю дорожку, 2-ю и 4-ю в переднюю"}. Отрегулируйте ролики, чтобы двери закрывались без щели, перехлёст ${kupe.doors.overlap} мм.`,
      shown: [...inside, "дверь купе"],
      added: ["дверь купе"],
      fittings: [
        ...item("topTrack", count("topTrack")),
        ...item("bottomTrack", count("bottomTrack")),
        ...item("kupeRoller", count("kupeRoller")),
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

// Фурнитура всей кухни: сумма по модулям плюс ножки, клипсы цоколя,
// подъёмники, сушка, карго и ручка на фасад посудомойки.
export function kitchenFittings(
  result: KitchenResult,
  thickness: number,
): FittingLine[] {
  const counts = new Map<FittingKey, number>();
  const notes = new Map<FittingKey, Map<string, number>>();
  const add = (key: FittingKey, count: number, note?: string) => {
    if (count <= 0) return;
    counts.set(key, (counts.get(key) ?? 0) + count);
    if (note) {
      const byNote = notes.get(key) ?? new Map<string, number>();
      byNote.set(note, (byNote.get(note) ?? 0) + count);
      notes.set(key, byNote);
    }
  };
  for (const item of result.modules) {
    if (item.spec && item.result) {
      for (const line of cabinetFittings(item.spec, item.result, thickness)) {
        add(
          line.key,
          line.count,
          line.key === "slide" && item.result.drawers
            ? `${item.result.drawers.slide} мм`
            : undefined,
        );
      }
    }
    if (item.type === "lift" && item.row === "top") add("lift", 1);
    if (item.type === "dryer" && item.row === "top") add("dishDryer", 1);
    if (item.type === "bottle" && item.row === "base") add("cargo", 1);
    if (item.facade) {
      add("handle", 1);
      add("handleScrew", 2);
    }
  }
  // Столешница: плинтус вдоль стен, планки на стыки в углах и на
  // свободные концы. Шина под навесные — по длине навесных рядов.
  const worktop = result.countertops.reduce(
    (sum, piece) => sum + piece.to - piece.from,
    0,
  );
  const joints = result.countertops.filter(
    (piece) =>
      piece.wall > 0 && piece.from < (result.starts[piece.wall]?.base ?? 0),
  ).length;
  if (worktop > 0) {
    add("worktopPlinth", Math.ceil(worktop / 1000));
    add("worktopJoint", joints);
    add("worktopEnd", result.countertops.length * 2 - joints * 2);
  }
  const hanging = result.modules
    .filter((item) => item.row === "top" && item.spec)
    .reduce((sum, item) => sum + item.width, 0);
  add("wallRail", Math.ceil(hanging / 1000));
  if (result.legs > 0) {
    const { legs, clips } = kitchenLegs(result);
    add("kitchenLeg", legs);
    add("plinthClip", clips);
  }
  const noteFor = (key: FittingKey) => {
    const byNote = notes.get(key);
    if (!byNote) return null;
    if (key === "slide") {
      const lengths = [...byNote];
      return lengths.length === 1
        ? `${lengths[0][0]}, полного выдвижения, пара на ящик`
        : `полного выдвижения, пара на ящик: ${lengths
            .map(([length, count]) => `${length} — ${count}`)
            .join(", ")}`;
    }
    return null;
  };
  return FITTING_ORDER.filter((key) => counts.has(key)).map((key) => ({
    key,
    ...FITTING_INFO[key],
    ...(key === "kitchenLeg"
      ? { note: `${result.legs} мм, под цоколь` }
      : noteFor(key)
        ? { note: noteFor(key)! }
        : {}),
    count: counts.get(key)!,
  }));
}
