import { createAuthService } from "@/modules/identity/services/create-auth-service";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const service = await createAuthService();
  const result = await service.signOut();
  return Response.json(result, {
    headers: { "Cache-Control": "private, no-store" },
    status: result.ok ? 200 : 503,
  });
}
