import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Redis } from "@upstash/redis";
const kv = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });

// POST /api/sync — extension uploads data here
// GET  /api/sync — webapp fetches data here

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  
  // Also allow token-based auth from extension
  const authHeader = req.headers.get("authorization");
  let userId: string | null = null;

  if (session?.user?.id) {
    userId = session.user.id;
  } else if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    // Token is just the user's Google sub stored at login
    const stored = await kv.get(`token:${token}`);
    if (stored) userId = stored as string;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { data, syncedAt } = body;

  if (!data) {
    return NextResponse.json({ error: "No data" }, { status: 400 });
  }

  // Store in Vercel KV — key is user's Google ID
  // Data expires after 7 days (604800 seconds)
  await kv.set(`data:${userId}`, JSON.stringify({ data, syncedAt }), { ex: 604800 });

  return NextResponse.json({ ok: true, syncedAt });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stored = await kv.get(`data:${session.user.id}`);
  if (!stored) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json(JSON.parse(stored as string));
}
