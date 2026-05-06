import type { ReactNode } from "react";

import Link, { type LinkProps } from "next/link";
import { ArrowUpRight } from "lucide-react";

import { getButtonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const variantMap = {
  primary: "primary",
  secondary: "secondary",
  contrast: "accent",
  ghost: "ghost",
} as const;

type ButtonLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  variant?: keyof typeof variantMap;
  icon?: boolean;
  target?: string;
};

export function ButtonLink({
  children,
  className,
  variant = "primary",
  icon = false,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(getButtonClassName(variantMap[variant], "md"), className)}
      {...props}
    >
      <span>{children}</span>
      {icon ? <ArrowUpRight className="size-4" strokeWidth={1.8} /> : null}
    </Link>
  );
}
