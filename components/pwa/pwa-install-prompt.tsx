"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Share2, X } from "lucide-react";
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
const visitCountStorageKey = "artisan-visit-count";
const orderedStorageKey = "artisan-has-ordered";
const sessionCountedKey = "artisan-visit-counted";
const dismissalDurationMs = 30 * 24 * 60 * 60 * 1000;
const revealDelayMs = 6000;

// Страницы, где клиент занят заказом: полоску там не показываем.
const quietPathPrefixes = ["/admin", "/cart", "/checkout", "/login", "/register"];

type StorageKind = "localStorage" | "sessionStorage";

// Само обращение к window.localStorage может бросить SecurityError
// (запрет cookies / приватный режим), поэтому берём его внутри try.
function readStorage(kind: StorageKind, key: string) {
  try {
    return window[kind].getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(kind: StorageKind, key: string, value: string) {
  try {
    window[kind].setItem(key, value);
  } catch {
    // Без хранилища полоска просто покажется снова в следующий раз.
  }
}

function wasDismissedRecently() {
  const dismissedAt = Number(readStorage("localStorage", dismissalStorageKey));

  return Number.isFinite(dismissedAt) && dismissedAt > 0
    ? Date.now() - dismissedAt < dismissalDurationMs
    : false;
}

/** Считает визиты: один раз за сессию браузера. Возвращает номер визита. */
function countVisit() {
  const previous = Number(readStorage("localStorage", visitCountStorageKey)) || 0;

  if (readStorage("sessionStorage", sessionCountedKey)) {
    return previous;
  }

  const next = previous + 1;
  writeStorage("localStorage", visitCountStorageKey, String(next));
  writeStorage("sessionStorage", sessionCountedKey, "1");
  return next;
}

export function PwaInstallPrompt() {
  const pathname = usePathname() || "/";
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const isQuietPage = quietPathPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  useEffect(() => {
    if (pathname.startsWith("/checkout/success")) {
      writeStorage("localStorage", orderedStorageKey, "1");
    }
  }, [pathname]);

  useEffect(() => {
    if (isQuietPage) {
      return;
    }

    const navigatorWithStandalone = navigator as NavigatorWithStandalone;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;
    const isMobileViewport = window.matchMedia("(max-width: 1023px)").matches;
    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const visits = countVisit();
    const hasOrdered = readStorage("localStorage", orderedStorageKey) === "1";

    // Первый визит не трогаем: клиент сначала должен увидеть сайт.
    if (
      isStandalone ||
      !isMobileViewport ||
      wasDismissedRecently() ||
      (visits < 2 && !hasOrdered)
    ) {
      return;
    }

    let revealTimer: ReturnType<typeof setTimeout> | undefined;

    const reveal = (showIosInstructions = false) => {
      if (revealTimer) clearTimeout(revealTimer);
      revealTimer = setTimeout(() => {
        setIsIos(showIosInstructions);
        setIsVisible(true);
      }, revealDelayMs);
    };
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      reveal();
    };
    const handleInstalled = () => {
      setIsVisible(false);
      setInstallPrompt(null);
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
  }, [isQuietPage]);

  function dismiss() {
    writeStorage("localStorage", dismissalStorageKey, String(Date.now()));
    setIsVisible(false);
  }

  async function install() {
    if (isIos || !installPrompt) {
      setShowHelp((value) => !value);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "dismissed") {
      dismiss();
    }

    setInstallPrompt(null);
    setIsVisible(false);
  }

  if (isQuietPage || !isVisible || (!isIos && !installPrompt)) {
    return null;
  }

  return (
    <aside
      aria-labelledby="pwa-install-title"
      className="fixed inset-x-3 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-md rounded-[16px] bg-[#1f2b25] px-3 py-2.5 text-white shadow-[0_12px_32px_rgba(17,17,17,0.28)] lg:hidden"
    >
      <div className="flex items-center gap-2.5">
        <Image
          src="/pwa-icon-192.png"
          alt=""
          width={34}
          height={34}
          className="size-[34px] shrink-0 rounded-[9px]"
        />
        <div className="min-w-0 flex-1 leading-tight">
          <p id="pwa-install-title" className="text-[13px] font-semibold">
            Artisan на экран телефона
          </p>
          <p className="mt-0.5 text-[12px] text-white/70">
            Заказы и распил в одно касание
          </p>
        </div>
        <button
          type="button"
          onClick={() => void install()}
          className="h-8 shrink-0 rounded-full bg-[#c4532b] px-3.5 text-[13px] font-semibold hover:bg-[#a94730]"
        >
          {isIos ? "Как?" : "Добавить"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Закрыть"
        >
          <X className="size-4" />
        </button>
      </div>

      {showHelp ? (
        <div className="mt-2.5 flex items-center gap-2.5 border-t border-white/10 pt-2.5 text-[12px] leading-5 text-white/80">
          <Share2 className="size-4 shrink-0 text-[#f09a78]" />
          <p>В Safari нажмите «Поделиться», затем «На экран Домой».</p>
        </div>
      ) : null}
    </aside>
  );
}
