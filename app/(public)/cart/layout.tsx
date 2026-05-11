import type { Metadata } from "next";
import type { ReactNode } from "react";

import { noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Корзина",
  robots: noIndexRobots,
};

export default function CartLayout({ children }: { children: ReactNode }) {
  return children;
}
