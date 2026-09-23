import { notificationHttp } from "@/modules/notifications/delivery/notification-http";

export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<Response> {
  return notificationHttp(request, "list");
}
export async function PATCH(request: Request): Promise<Response> {
  return notificationHttp(request, "read");
}
