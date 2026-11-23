// Установочные версии программы раскроя: последний выпуск приватного репозитория raspil через GitHub API.
// Токен только на чтение (GITHUB_RELEASES_TOKEN), список выпуска кешируется на 10 минут.

const API = "https://api.github.com";
const TTL_MS = 10 * 60 * 1000;

export type ReleaseAsset = { name: string; url: string; size: number };
type Release = { tag: string; assets: ReleaseAsset[] };

let cache: { at: number; release: Release } | null = null;

export function releasesRepo() {
  return process.env.RASKROY_RELEASES_REPO || "bamaboy561/raspil";
}

function headers(accept: string): HeadersInit {
  const token = process.env.GITHUB_RELEASES_TOKEN;
  return {
    Accept: accept,
    "User-Agent": "artisan-shop",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Последний обычный выпуск (не черновик и не предварительный). */
export async function latestRelease(): Promise<Release> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.release;
  const res = await fetch(`${API}/repos/${releasesRepo()}/releases/latest`, {
    headers: headers("application/vnd.github+json"),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub releases/latest: ${res.status}`);
  const data = (await res.json()) as {
    tag_name: string;
    assets: { name: string; url: string; size: number }[];
  };
  const release = {
    tag: data.tag_name,
    assets: data.assets.map((a) => ({ name: a.name, url: a.url, size: a.size })),
  };
  cache = { at: Date.now(), release };
  return release;
}

/** Файл выпуска потоком. GitHub отвечает переадресацией на временную ссылку, fetch идёт по ней сам
 *  и не передаёт туда токен (другой сервер). */
export async function fetchAsset(asset: ReleaseAsset) {
  const res = await fetch(asset.url, {
    headers: headers("application/octet-stream"),
    cache: "no-store",
  });
  if (!res.ok || !res.body) throw new Error(`GitHub asset ${asset.name}: ${res.status}`);
  return res;
}

export function contentTypeOf(name: string) {
  if (name.endsWith(".apk")) return "application/vnd.android.package-archive";
  if (name.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

/** Сброс кеша — для тестов. */
export function resetReleaseCache() {
  cache = null;
}
