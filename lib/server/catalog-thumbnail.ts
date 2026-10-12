import "server-only";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { lookup } from "node:dns/promises";
import { get, type RequestOptions } from "node:https";
import { BlockList } from "node:net";
import sharp from "sharp";
import { canUseNextImageOptimization } from "@/lib/image-optimization";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["192.0.0.0", 24],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(address, prefix, "ipv4");
blocked.addSubnet("::", 96, "ipv6");
// BlockList also checks IPv4 through mapped IPv6 addresses; blocking
// ::ffff:0:0/96 would therefore reject every public IPv4 address too.
blocked.addSubnet("fc00::", 7, "ipv6");
blocked.addSubnet("fe80::", 10, "ipv6");
blocked.addSubnet("ff00::", 8, "ipv6");

export function isAllowedCatalogImage(src: string) {
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      canUseNextImageOptimization(src)
    );
  } catch {
    return src.startsWith("/") && !src.startsWith("//") && !src.includes("\\");
  }
}

async function remoteImage(url: URL): Promise<Buffer> {
  // Pin a validated public DNS result; never follow redirects to private hosts.
  const addresses = await lookup(url.hostname, { all: true });
  const address = addresses.find(
    (entry) =>
      !blocked.check(entry.address, entry.family === 6 ? "ipv6" : "ipv4"),
  );
  if (
    !address ||
    addresses.some((entry) =>
      blocked.check(entry.address, entry.family === 6 ? "ipv6" : "ipv4"),
    )
  )
    throw new Error("Unsafe image host");
  // The pinned lookup returns one address. Node's automatic family selection
  // otherwise asks for an address array and rejects this callback's result.
  const options: RequestOptions & { autoSelectFamily: boolean } = {
    autoSelectFamily: false,
    family: address.family,
    lookup: (_host, _options, callback) =>
      callback(null, address.address, address.family),
    headers: { "User-Agent": "ArtisanCatalog/1.0" },
  };
  return new Promise((resolve, reject) => {
    const request = get(
      url,
      options,
      (response) => {
        if (
          response.statusCode !== 200 ||
          !response.headers["content-type"]?.startsWith("image/")
        ) {
          response.resume();
          reject(new Error("Image unavailable"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 8 * 1024 * 1024)
            request.destroy(new Error("Image too large"));
          else chunks.push(chunk);
        });
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => request.destroy(new Error("Image timed out")),
      6000,
    );
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
  });
}

export async function catalogThumbnail(
  src: string | null,
): Promise<Buffer | null> {
  if (!src || !isAllowedCatalogImage(src)) return null;
  try {
    let bytes: Buffer;
    if (src.startsWith("/")) {
      const root = await realpath(path.resolve(process.cwd(), "public"));
      const file = path.resolve(
        root,
        `.${decodeURIComponent(src.split("?")[0])}`,
      );
      if (!file.startsWith(root + path.sep)) return null;
      const resolved = await realpath(file);
      if (!resolved.startsWith(root + path.sep)) return null;
      if ((await stat(resolved)).size > 8 * 1024 * 1024) return null;
      bytes = await readFile(resolved);
      if (bytes.length > 8 * 1024 * 1024) return null;
    } else bytes = await remoteImage(new URL(src));
    return await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(240, 180, {
        fit: "contain",
        background: "white",
        withoutEnlargement: true,
      })
      .flatten({ background: "white" })
      .jpeg({ quality: 75 })
      .toBuffer();
  } catch {
    return null;
  }
}
