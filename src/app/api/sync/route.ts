import { getDataVersion } from "@/lib/data/sync";
import { getCurrentUser } from "@/lib/session";

/** Current data version for the signed-in user; polled by open tabs. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(
    { version: await getDataVersion(user.id) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
