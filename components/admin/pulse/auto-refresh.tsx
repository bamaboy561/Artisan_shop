"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Пульт обновляется сам раз в минуту, пока вкладка открыта.
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [router, seconds]);
  return null;
}
