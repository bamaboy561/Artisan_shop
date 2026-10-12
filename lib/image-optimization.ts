const NEXT_IMAGE_REMOTE_HOSTS = new Set([
  "amix-tk.ru",
  "avatars.mds.yandex.net",
  "emaks.com.tr",
  "extravert.ru",
  "hru-site-media.storage.yandexcloud.net",
  "i.pinimg.com",
  "images.unsplash.com",
  "img.edilportale.com",
  "kitchen.slotex.com",
  "mebelshik.biz",
  "nuomi-us.oss-us-west-1.aliyuncs.com",
  "nuomihome.com",
  "nuomishop.ru",
  "pan-invest.com",
  "princip96.ru",
  "sc04.alicdn.com",
  "shop.hettich.com",
  "smart812.ru",
  "swisskrono.ru",
  "tdmspb.ru",
  "th.bing.com",
  "tse1.explicit.bing.net",
  "tse3.mm.bing.net",
  "w230203-807.cdn.webasyst.cloud",
  "agtwood.ru",
  "cheapollo.ru",
  "italianaferramenta.it",
  "www.agtwood.com",
  "www.agtwood.ru",
  "www.cheapollo.ru",
  "www.italianaferramenta.it",
  "www.liamax.com",
  "www.nuomihome.com",
  "www.shkaffcity.ru",
  "www.tdserver.ru",
  "www.yapikatalogu.com",
]);

function isVercelBlobHost(hostname: string) {
  return hostname.endsWith(".public.blob.vercel-storage.com");
}

export function canUseNextImageOptimization(src?: string | null) {
  if (!src) {
    return false;
  }

  try {
    const url = new URL(src);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      (NEXT_IMAGE_REMOTE_HOSTS.has(hostname) || isVercelBlobHost(hostname))
    );
  } catch {
    return true;
  }
}

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
    const isHettichHost = hostname === "shop.hettich.com";

    if (isHettichHost) {
      return true;
    }

    const pathname = url.pathname.toLowerCase();
    const hasFileExtension = /\.[a-z0-9]+$/i.test(pathname);

    return (
      isAgtHost &&
      pathname.includes("/medium/") &&
      pathname.includes("/image/") &&
      !hasFileExtension
    );
  } catch {
    return false;
  }
}
