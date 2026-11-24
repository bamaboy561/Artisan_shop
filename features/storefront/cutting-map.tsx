import s from "./storefront.module.css";

// Пример карты раскроя: лист 2800×2070 мм, детали шкафа. Координаты в мм.
const parts = [
  { name: "Бок", w: 2000, h: 560, x: 10, y: 10 },
  { name: "Бок", w: 2000, h: 560, x: 10, y: 574 },
  { name: "Полка", w: 760, h: 540, x: 2014, y: 10 },
  { name: "Полка", w: 760, h: 540, x: 2014, y: 554 },
  { name: "Полка", w: 760, h: 540, x: 2014, y: 1098 },
  { name: "Крыша", w: 900, h: 560, x: 10, y: 1138 },
  { name: "Дно", w: 900, h: 560, x: 914, y: 1138 },
  { name: "Цоколь", w: 900, h: 100, x: 10, y: 1702 },
  { name: "Цоколь", w: 900, h: 100, x: 914, y: 1702 },
  { name: "Фасад ящика", w: 760, h: 180, x: 2014, y: 1642 },
  { name: "Фасад ящика", w: 760, h: 180, x: 2014, y: 1826 },
];

export function CuttingMap() {
  return (
    <figure className={s.cutMap}>
      <svg
        viewBox="-60 -60 2920 2190"
        role="img"
        aria-label="Пример карты раскроя листа ЛДСП 2800 на 2070 миллиметров"
      >
        <defs>
          <pattern
            id="offcut"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="40" className={s.cutHatch} />
          </pattern>
        </defs>
        <rect width="2800" height="2070" className={s.cutSheet} />
        <rect width="2800" height="2070" fill="url(#offcut)" />
        {parts.map((part, index) => (
          <g
            key={index}
            className={s.cutPart}
            style={{ animationDelay: `${180 + index * 70}ms` }}
          >
            <rect x={part.x} y={part.y} width={part.w} height={part.h} />
            {part.h >= 180 ? (
              <>
                <text x={part.x + 36} y={part.y + 84} className={s.cutName}>
                  {part.name}
                </text>
                <text x={part.x + 36} y={part.y + 150} className={s.cutSize}>
                  {part.w}×{part.h}
                </text>
              </>
            ) : (
              <text x={part.x + 36} y={part.y + 70} className={s.cutSize}>
                {part.w}×{part.h}
              </text>
            )}
          </g>
        ))}
        <text x="0" y="-18" className={s.cutDim}>
          2800
        </text>
        <text
          x="-18"
          y="2070"
          transform="rotate(-90 -18 2070)"
          className={s.cutDim}
        >
          2070
        </text>
      </svg>
      <figcaption>
        Пример карты раскроя: лист 2800×2070×16, 11 деталей шкафа
      </figcaption>
    </figure>
  );
}
