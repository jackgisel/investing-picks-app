import { auth, ensureMigrations } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const { GET: _GET, POST: _POST } = toNextJsHandler(auth);

export async function GET(req: Request) {
  await ensureMigrations();
  return _GET(req);
}

export async function POST(req: Request) {
  await ensureMigrations();
  return _POST(req);
}
