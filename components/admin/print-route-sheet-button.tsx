"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintRouteSheetButton() {
  return (
    <Button type="button" variant="accent" onClick={() => window.print()}>
      <Printer className="size-4" />
      Печать
    </Button>
  );
}
