import { TERMS_OF_USE_EFFECTIVE_DATE, TERMS_OF_USE_VERSION } from "@/contracts/legal";
import type { Bilingual, LegalDocument } from "./document";

/** Refunds are paid by hand within this many days of being queued (decision of 2026-10-03). */
export const REFUND_DAYS_MIN = 1;
export const REFUND_DAYS_MAX = 3;

/**
 * The Refund Policy: the refund rules of the posting terms, gathered in one
 * place a payer can read before paying, plus the payout time. It promises the
 * contribution and the platform fee back, as the terms do; whether the payment
 * provider's own charge is refunded is an open question
 * (`context/progress-tracker.md`).
 */
export const REFUND_POLICY: Bilingual<LegalDocument> = {
  en: {
    title: "Refund Policy",
    lede: "When money put into a bounty comes back to you, how it is paid, and how long it takes.",
    status: `Version ${TERMS_OF_USE_VERSION} · Effective ${TERMS_OF_USE_EFFECTIVE_DATE}`,
    sections: [
      {
        heading: "When you are refunded in full",
        paragraphs: ["A full refund is your contribution and the platform fee you paid with it."],
        points: [
          "The Wanted expires without an approved claim.",
          "The poster withdraws the Wanted. The poster's own contributions are refunded too.",
          "The Owner removes the Wanted for breaking the terms: every Backer except the poster is refunded.",
        ],
      },
      {
        heading: "When you are not refunded",
        points: [
          "A Sheriff approves a claim, or a released bounty is approved: the whole bounty goes to the winning Hunter or the member named, and the platform fee is kept.",
          "The Owner removes your own Wanted for breaking the terms: you forfeit what you put into it, platform fee included.",
          "A free request has no payment, so there is nothing to refund.",
        ],
      },
      {
        heading: "How and when you are paid",
        points: [
          `Refunds are paid by bank transfer to the account on your profile, within ${REFUND_DAYS_MIN} to ${REFUND_DAYS_MAX} days of the refund being queued.`,
          "A refund is queued when the Wanted expires, is withdrawn or is removed. While an appeal on the Wanted is open, its expiry and refunds wait for the decision.",
          "Keep the bank details on your profile up to date.",
        ],
      },
      {
        heading: "Following a refund",
        points: [
          "You are told in your inbox when your refund is queued.",
          "“Wanteds you backed” on your profile shows each refund as pending, then refunded with the amount.",
        ],
      },
    ],
  },
  ms: {
    title: "Polisi Bayaran Balik",
    lede: "Bila wang yang dimasukkan ke dalam ganjaran kembali kepada anda, cara ia dibayar, dan berapa lama masa yang diambil.",
    status: `Versi ${TERMS_OF_USE_VERSION} · Berkuat kuasa 3 Oktober 2026`,
    sections: [
      {
        heading: "Bila anda dipulangkan sepenuhnya",
        paragraphs: [
          "Bayaran balik penuh ialah sumbangan anda dan yuran platform yang anda bayar bersamanya.",
        ],
        points: [
          "Wanted itu tamat tempoh tanpa tuntutan yang diluluskan.",
          "Penyiar menarik balik Wanted itu. Sumbangan penyiar sendiri juga dipulangkan.",
          "Owner membuang Wanted itu kerana melanggar terma: setiap Backer kecuali penyiar dipulangkan.",
        ],
      },
      {
        heading: "Bila anda tidak dipulangkan",
        points: [
          "Sheriff meluluskan tuntutan, atau ganjaran yang dilepaskan diluluskan: keseluruhan ganjaran diberikan kepada Hunter yang menang atau ahli yang dinamakan, dan yuran platform disimpan.",
          "Owner membuang Wanted anda sendiri kerana melanggar terma: anda kehilangan apa yang anda masukkan ke dalamnya, termasuk yuran platform.",
          "Permintaan percuma tiada bayaran, jadi tiada apa yang perlu dipulangkan.",
        ],
      },
      {
        heading: "Cara dan bila anda dibayar",
        points: [
          `Bayaran balik dibuat melalui pindahan bank ke akaun dalam profil anda, dalam tempoh ${REFUND_DAYS_MIN} hingga ${REFUND_DAYS_MAX} hari selepas bayaran balik dibuat giliran.`,
          "Bayaran balik dibuat giliran apabila Wanted tamat tempoh, ditarik balik atau dibuang. Semasa rayuan terhadap Wanted itu masih dibuka, tarikh tamat dan bayaran baliknya menunggu keputusan.",
          "Pastikan butiran bank dalam profil anda terkini.",
        ],
      },
      {
        heading: "Mengikuti bayaran balik",
        points: [
          "Anda dimaklumkan dalam peti masuk anda apabila bayaran balik anda dibuat giliran.",
          "Bahagian “Wanteds you backed” dalam profil anda menunjukkan setiap bayaran balik sebagai belum selesai, kemudian telah dipulangkan bersama jumlahnya.",
        ],
      },
    ],
  },
};
