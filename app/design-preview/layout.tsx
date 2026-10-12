import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewShell } from "@/features/design-preview/shell";

export const metadata: Metadata = {
  title: { absolute: "Artisan | Предпросмотр дизайна" },
  robots: { index: false, follow: false },
  alternates: { canonical: "/design-preview" },
};

export default function DesignPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The experiment must never replace, or become a public entry to, the shop.
  if (process.env.NODE_ENV !== "development") notFound();
  return <PreviewShell>{children}</PreviewShell>;
}
