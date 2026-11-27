import s from "./season.module.css";

// Новогоднее оформление витрины. Только вид: всё aria-hidden и без кликов,
// при «уменьшить движение» снег и мигание выключены.

const BULBS = 48;
const FLAKES = 34;

export function SeasonGarland() {
  return (
    <div className={s.garlandAnchor} aria-hidden="true">
      <div className={s.garland}>
        {Array.from({ length: BULBS }, (_, index) => (
          <i key={index} />
        ))}
      </div>
    </div>
  );
}

// Детерминированный «случайный» разброс, чтобы сервер и браузер рисовали
// одинаковые снежинки (без расхождения при гидрации).
function spread(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function SeasonSnow() {
  return (
    <div className={s.snow} aria-hidden="true">
      {Array.from({ length: FLAKES }, (_, index) => {
        const size = 6 + Math.round(spread(index, 1) * 7);
        return (
          <i
            key={index}
            style={{
              left: `${(spread(index, 2) * 100).toFixed(2)}%`,
              width: size,
              height: size,
              opacity: Number((0.55 + spread(index, 3) * 0.4).toFixed(2)),
              animationDuration: `${(14 + spread(index, 4) * 12).toFixed(1)}s, ${(4 + spread(index, 5) * 3).toFixed(1)}s`,
              animationDelay: `-${(spread(index, 6) * 26).toFixed(1)}s, -${(spread(index, 7) * 4).toFixed(1)}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export function SeasonHat() {
  return (
    <svg
      className={s.hat}
      viewBox="0 0 32 26"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 20 C7 9 15 2 25 4 C22 8 23 14 27 19 Z" fill="#c4574a" />
      <path
        d="M25 4 C28 5 30 9 29 13"
        stroke="#c4574a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <circle
        cx="29"
        cy="15"
        r="3"
        fill="#fbf3e6"
        stroke="#ead9c4"
        strokeWidth="0.8"
      />
      <rect
        x="2"
        y="18"
        width="27"
        height="6"
        rx="3"
        fill="#fbf3e6"
        stroke="#ead9c4"
        strokeWidth="0.8"
      />
    </svg>
  );
}
