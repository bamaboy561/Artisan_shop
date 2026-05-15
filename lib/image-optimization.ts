export function shouldBypassNextImageOptimization(src?: string | null) {
  if (!src) {
    return false;
  }

  try {
    const url = new URL(src);
    const hostname = url.hostname.toLowerCase();
    const isAgtHost =
      hostname === "www.agtwood.com" ||
      hostname === "agtwood.com" ||
      hostname === "www.agtwood.ru" ||
      hostname === "agtwood.ru";

    if (!isAgtHost) {
      return false;
    }

    const pathname = url.pathname.toLowerCase();
    const hasFileExtension = /\.[a-z0-9]+$/i.test(pathname);

    return pathname.includes("/medium/") && pathname.includes("/image/") && !hasFileExtension;
  } catch {
    return false;
  }
}
