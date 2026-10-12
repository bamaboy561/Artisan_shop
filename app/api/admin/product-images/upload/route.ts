import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getOptionalSession } from "@/lib/auth/dal";
import { canAccessGeneralAdmin } from "@/lib/auth/roles";

const allowedProductImageTypes = [
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export async function POST(request: Request) {
  const session = await getOptionalSession();

  if (!session?.userId || !canAccessGeneralAdmin(session.roleCode)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid upload request" },
      { status: 400 },
    );
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("products/")) {
          throw new Error("Invalid upload path");
        }

        return {
          allowedContentTypes: [...allowedProductImageTypes],
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
