// Always answer from the live server so a new deployment is seen immediately.
export const dynamic = "force-dynamic";

/** The build this server is running; tabs compare it with their own build. */
export function GET() {
  return Response.json(
    { buildId: process.env.APP_BUILD_ID, version: process.env.APP_VERSION },
    { headers: { "Cache-Control": "no-store" } },
  );
}
