import { notificationEmailDispatchHttp } from "@/modules/notifications/delivery/email-dispatch-http";
import { createEmailDeliveryService } from "@/modules/notifications/services/create-email-delivery-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return notificationEmailDispatchHttp(request, {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    dispatch: async () => createEmailDeliveryService().dispatchBatch(),
  });
}
