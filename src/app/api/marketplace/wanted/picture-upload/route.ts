import { marketplaceResponse } from "@/modules/wanted/delivery/marketplace-http";
import { prepareWantedPictureUpload } from "@/modules/wanted-pictures/loaders/wanted-picture-operations";

export const dynamic = "force-dynamic";

/** A one-time upload slot for a pixelated Wanted picture in the caller's own folder. */
export async function POST(): Promise<Response> {
  return marketplaceResponse(await prepareWantedPictureUpload());
}
