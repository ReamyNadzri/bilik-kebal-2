import { failure, success } from "@/contracts/operation-result";
import type { ListTaxonomyResult, MarketplaceTaxonomy } from "@/contracts/marketplace";

export interface TaxonomyViewer {
  authenticated: boolean;
  emailVerified: boolean;
  institutionId: string | null;
}

export interface TaxonomyReader {
  listActive(institutionId: string | null): Promise<MarketplaceTaxonomy>;
}

export class TaxonomyService {
  constructor(private readonly reader: TaxonomyReader) {}

  async list(viewer: TaxonomyViewer): Promise<ListTaxonomyResult> {
    if (!viewer.authenticated) {
      return failure("AUTH_REQUIRED", "Sign in to browse marketplace taxonomy.");
    }

    if (!viewer.emailVerified) {
      return failure("EMAIL_NOT_VERIFIED", "Verify your email to browse marketplace taxonomy.");
    }

    try {
      return success(await this.reader.listActive(viewer.institutionId));
    } catch {
      return failure(
        "MARKETPLACE_UNAVAILABLE",
        "The marketplace taxonomy is temporarily unavailable.",
      );
    }
  }
}
