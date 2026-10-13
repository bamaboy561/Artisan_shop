// Одинаковые детали проекта взаимозаменяемы: у них одна этикетка, а на
// макете подсвечиваются все места, куда такая деталь подходит.
type GroupablePanel = {
  name: string;
  thickness: number;
  length: number;
  width: number;
  edgedLengthSides?: number;
  edgedWidthSides?: number;
};

export function getPartGroupKey(
  panel: GroupablePanel & { material: string | number },
) {
  return JSON.stringify([
    panel.name,
    panel.material,
    panel.thickness,
    panel.length,
    panel.width,
    panel.edgedLengthSides ?? 0,
    panel.edgedWidthSides ?? 0,
  ]);
}

// Номера всех деталей, одинаковых с деталью index (включая её саму).
export function findSameParts<
  T extends GroupablePanel & { material: string | number },
>(panels: T[], index: number) {
  const target = panels[index];

  if (!target) {
    return [];
  }

  const key = getPartGroupKey(target);

  return panels.flatMap((panel, panelIndex) =>
    getPartGroupKey(panel) === key ? [panelIndex] : [],
  );
}

export function describeEdgedSides(lengthSides: number, widthSides: number) {
  const parts = [
    lengthSides > 0 ? `по длине ${lengthSides}` : "",
    widthSides > 0 ? `по ширине ${widthSides}` : "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "нет";
}
