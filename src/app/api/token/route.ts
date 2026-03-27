import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Redis } from "@upstash/redis";
const kv = new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
import { randomBytes } from "crypto";

// GET /api/token — returns a token the extension can use for uploads
// User must be logged in on the webapp first
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  // Generate a random token, store mapping token → userId
  const token = randomBytes(32).toString("hex");
  await kv.set(`token:${token}`, session.user.id, { ex: 2592000 }); // 30 days

  return NextResponse.json({ token, userId: session.user.id });
}
