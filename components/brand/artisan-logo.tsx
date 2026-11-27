// Логотип Artisan (горизонт.pdf). Вектор, цвет берётся из CSS color.
// Те же рисунки лежат файлами в public/brand/*.svg — для писем и соцсетей.
import type { SVGProps } from "react";

import {
  artisanLogoLayout,
  type ArtisanLogoVariant,
} from "@/lib/brand/artisan-logo-paths";

export type { ArtisanLogoVariant };

export function ArtisanLogo({
  variant = "horizontal",
  title = "Artisan",
  ...props
}: { variant?: ArtisanLogoVariant; title?: string } & SVGProps<SVGSVGElement>) {
  const layout = artisanLogoLayout(variant);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${layout.width.toFixed(1)} ${layout.height.toFixed(1)}`}
      fill="currentColor"
      role="img"
      aria-label={title}
      {...props}
    >
      {layout.parts.map((part, index) => (
        <g
          key={index}
          transform={`translate(${part.x.toFixed(2)} ${part.y.toFixed(2)}) scale(${part.scale.toFixed(4)})`}
        >
          {part.paths.map((d, pathIndex) => (
            <path key={pathIndex} d={d} />
          ))}
        </g>
      ))}
    </svg>
  );
}
