"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Download, Share2, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const dismissalStorageKey = "artisan-pwa-install-dismissed-at";
const dismissalDurationMs = 7 * 24 * 60 * 60 * 1000;

function wasDismissedRecently() {
  try {
    const dismissedAt = Number(
      window.localStorage.getItem(dismissalStorageKey),
    );

    return Number.isFinite(dismissedAt)
      ? Date.now() - dismissedAt < dismissalDurationMs
      : false;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(dismissalStorageKey, String(Date.now()));
  } catch {
    // Installation remains available through the browser menu.
  }
}

export function PwaInstallPrompt() {
  const pathname = usePathname() || "/";
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/admin")) {
      return;
    }

    const navigatorWithStandalone = navigator as NavigatorWithStandalone;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;
    const isMobileViewport = window.matchMedia("(max-width: 1023px)").matches;
    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);

    if (isStandalone || !isMobileViewport || wasDismissedRecently()) {
      return;
    }

    let revealTimer: ReturnType<typeof setTimeout> | undefined;

    const reveal = (showIosInstructions = false) => {
      revealTimer = setTimeout(() => {
        setIsIos(showIosInstructions);
        setIsVisible(true);
      }, 1400);
    };
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      reveal();
    };
    const handleInstalled = () => {
      setIsVisible(false);
      setInstallPrompt(null);

      try {
        window.localStorage.removeItem(dismissalStorageKey);
      } catch {
        // The application is installed even when storage is unavailable.
      }
    };

    window.addEventListener("beforeinstallprompt", handleInstallAvailable);
    window.addEventListener("appinstalled", handleInstalled);

    if (iosDevice) {
      reveal(true);
    }

    return () => {
      if (revealTimer) {
        clearTimeout(revealTimer);
      }

      window.removeEventListener("beforeinstallprompt", handleInstallAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [pathname]);

  function dismiss() {
    rememberDismissal();
    setIsVisible(false);
  }

  async function install() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "dismissed") {
      rememberDismissal();
    }

    setInstallPrompt(null);
    setIsVisible(false);
  }

  if (
    pathname.startsWith("/admin") ||
    !isVisible ||
    (!isIos && !installPrompt)
  ) {
    return null;
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="pwa-install-title"
      className="fixed inset-x-3 bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-md overflow-hidden rounded-[18px] border border-white/10 bg-[#151513] p-4 text-white shadow-[0_24px_80px_rgba(17,17,17,0.34)] lg:hidden"
    >
      <div className="flex items-start gap-3">
        <Image
          src="/pwa-icon-192.png"
          alt=""
          width={52}
          height={52}
          className="size-[52px] shrink-0 rounded-[12px]"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--accent)] uppercase">
            Приложение Artisan
          </p>
          <h2 id="pwa-install-title" className="mt-1 text-base font-semibold">
            Добавить на телефон
          </h2>
          <p className="mt-1 text-xs leading-5 text-white/58">
            Открывайте Artisan с главного экрана.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Закрыть предложение установки"
        >
          <X className="size-4" />
        </button>
      </div>

      {isIos ? (
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4 text-xs leading-5 text-white/72">
          <Share2 className="size-5 shrink-0 text-[var(--accent)]" />
          <p>В Safari нажмите «Поделиться», затем «На экран Домой».</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void install()}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#c75f3b] px-4 font-mono text-[10px] font-semibold tracking-[0.14em] uppercase hover:bg-[#a94d2e]"
        >
          <Download className="size-4" />
          Установить
        </button>
      )}

      {isIos ? (
        <button
          type="button"
          onClick={dismiss}
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[12px] border border-white/12 px-4 font-mono text-[10px] font-semibold tracking-[0.14em] text-white/78 uppercase hover:bg-white/8 hover:text-white"
        >
          <Smartphone className="size-4" />
          Понятно
        </button>
      ) : null}
    </aside>
  );
}
