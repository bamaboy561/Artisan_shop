import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Container({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1320px] px-4 sm:px-8 lg:px-10",
        className,
      )}
      {...props}
    />
  );
}
