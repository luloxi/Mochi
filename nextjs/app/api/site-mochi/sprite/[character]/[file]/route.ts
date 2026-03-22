import { NextResponse } from "next/server";
import { readRuntimeCoreSiteMochiSprite } from "@/lib/site-mochi-runtime-core";

export const runtime = "nodejs";

type Params = {
  params: Promise<{
    character: string;
    file: string;
  }>;
};

export async function GET(_request: Request, context: Params) {
  try {
    const { character, file } = await context.params;
    const bytes = await readRuntimeCoreSiteMochiSprite(character, file);
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
