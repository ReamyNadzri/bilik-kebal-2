import type { WantedDetail } from "@/contracts/marketplace";
import { toSen } from "@/features/marketplace/money";
import { aWanted } from "@/features/marketplace/test-support/wanted";
import { chatShareUrl, shareWantedContent } from "./share-wanted";

function aDetail(overrides: Partial<WantedDetail> = {}): WantedDetail {
  return {
    ...aWanted({ id: "11111111-1111-4111-8111-111111111111", grossBountySen: toSen(25) }),
    description: "Complete notes covering every chapter, with worked examples.",
    faculty: "Faculty of Computing",
    programme: "Bachelor of Computer Science",
    language: "English",
    tags: [],
    commissioner: {
      publicId: "22222222-2222-4222-8222-222222222222",
      avatarUrl: null,
      joinedAt: null,
      displayName: "Aisyah Rahman",
      emailVerified: true,
      institutionVerified: true,
    },
    feeRateBasisPoints: 1000,
    policyVersion: "2026-09-15.1",
    activity: [],
    similarIds: [],
    ...overrides,
  };
}

describe("shareWantedContent", () => {
  it("captions a paid Wanted with its reward and link", () => {
    const content = shareWantedContent(aDetail(), "https://vaultix.example/");
    expect(content.url).toBe("https://vaultix.example/wanted/11111111-1111-4111-8111-111111111111");
    expect(content.rewardLabel).toBe("REWARD");
    expect(content.caption).toContain("Reward: RM");
    expect(content.caption).toContain(content.url);
  });

  it("says a free request has no bounty", () => {
    const content = shareWantedContent(
      aDetail({ isFree: true, grossBountySen: toSen(0) }),
      "https://v.example",
    );
    expect(content.reward).toBe("Free request");
    expect(content.caption).toContain("Free request, no bounty");
  });

  it("never names the poster", () => {
    const content = shareWantedContent(aDetail(), "https://v.example");
    expect(JSON.stringify(content)).not.toContain("Aisyah");
  });
});

describe("chatShareUrl", () => {
  const content = shareWantedContent(aDetail(), "https://v.example");

  it("fills WhatsApp's text with the whole caption", () => {
    const url = new URL(chatShareUrl("whatsapp", content));
    expect(url.origin).toBe("https://wa.me");
    expect(url.searchParams.get("text")).toBe(content.caption);
  });

  it("gives Telegram the link separately, without repeating it in the text", () => {
    const url = new URL(chatShareUrl("telegram", content));
    expect(url.origin).toBe("https://t.me");
    expect(url.searchParams.get("url")).toBe(content.url);
    expect(url.searchParams.get("text")).not.toContain(content.url);
  });
});
