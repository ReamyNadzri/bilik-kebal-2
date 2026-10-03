import { TERMS_OF_USE_EFFECTIVE_DATE, TERMS_OF_USE_VERSION } from "@/contracts/legal";
import type { Bilingual, LegalDocument, LegalSection } from "./document";
import { POSTING_TERMS, POSTING_TERMS_MS, TERMS_VERSION } from "./terms";

/**
 * The Terms of Use every member accepts at sign-up (with the 18+
 * confirmation), followed by the posting terms a poster also accepts on each
 * Wanted. Written in plain English from the accepted product rules; it names
 * no company or person (decision of 2026-10-03). Legal review stays open in
 * `context/progress-tracker.md`.
 */
const GENERAL_EN: readonly LegalSection[] = [
  {
    heading: "About these terms",
    paragraphs: [
      "VAULTIX is a place for Malaysian university students to ask for study resources, offer bounties for them, report missing items and hold discussions. By creating an account or using VAULTIX you agree to these Terms of Use and to the Privacy Notice.",
      `The rules for posting, money and claims further down are part of these terms. A poster also accepts them on each Wanted, and the version in force then (now ${TERMS_VERSION}) is saved with it.`,
    ],
  },
  {
    heading: "Who may use VAULTIX",
    points: [
      "You must be 18 or older. Accounts of people under 18 are not allowed and may be restricted.",
      "Give true details when you sign up and when you verify your institution.",
      "Keep your sign-in details to yourself. You are responsible for what is done with your account.",
    ],
  },
  {
    heading: "How you may use it",
    points: [
      "Use VAULTIX lawfully and follow your university's rules.",
      "Do not harass anyone, post hateful or sexual content, spam, impersonate someone, or share another person's personal details.",
      "Do not try to get around a restriction, a limit, a review or a security check, or to reach data that is not yours.",
    ],
  },
  {
    heading: "What you upload",
    points: [
      "You keep ownership of what you post and upload. You allow VAULTIX to store it, show it to the Sheriffs who review it, and give access to it as these terms describe.",
      "Upload only material you have the right to share. Material that infringes someone's copyright, or breaks these terms, is removed, and the account may be restricted.",
      "Resources are made by students. A Sheriff checks that a claim meets the request, not that every answer in it is correct.",
    ],
  },
  {
    heading: "Money",
    points: [
      "Bounties, fees, payouts and refunds follow the rules below and the Refund Policy.",
      "Payments are taken by our payment provider. VAULTIX never sees your card or online banking details.",
    ],
  },
  {
    heading: "Moderation",
    points: [
      "Sheriffs and the Owner may hide replies, switch off tags, reject claims, remove Wanteds and restrict accounts that break these terms. Each such decision is recorded.",
      "A rejected claim may be appealed once within 7 days, and a restriction can be appealed.",
    ],
  },
  {
    heading: "Changes and ending",
    points: [
      "When these terms change, you are asked to accept the new version on your next visit before you continue.",
      "You may delete your account as described under “Your account and your data” below.",
    ],
  },
];

const GENERAL_MS: readonly LegalSection[] = [
  {
    heading: "Tentang terma ini",
    paragraphs: [
      "VAULTIX ialah tempat untuk pelajar universiti di Malaysia meminta sumber pembelajaran, menawarkan ganjaran untuknya, melaporkan barang hilang dan mengadakan perbincangan. Dengan mencipta akaun atau menggunakan VAULTIX, anda bersetuju dengan Terma Penggunaan ini dan dengan Notis Privasi.",
      `Peraturan untuk menyiarkan, wang dan tuntutan di bawah adalah sebahagian daripada terma ini. Penyiar juga menerimanya bagi setiap Wanted, dan versi yang berkuat kuasa pada masa itu (kini ${TERMS_VERSION}) disimpan bersamanya.`,
    ],
  },
  {
    heading: "Siapa yang boleh menggunakan VAULTIX",
    points: [
      "Anda mesti berumur 18 tahun ke atas. Akaun orang yang berumur bawah 18 tahun tidak dibenarkan dan boleh dihadkan.",
      "Berikan butiran yang benar semasa mendaftar dan semasa mengesahkan institusi anda.",
      "Simpan butiran log masuk anda untuk diri sendiri. Anda bertanggungjawab atas apa yang dilakukan dengan akaun anda.",
    ],
  },
  {
    heading: "Cara anda boleh menggunakannya",
    points: [
      "Gunakan VAULTIX secara sah dan ikut peraturan universiti anda.",
      "Jangan mengganggu sesiapa, menyiarkan kandungan kebencian atau seksual, menghantar spam, menyamar sebagai orang lain, atau berkongsi butiran peribadi orang lain.",
      "Jangan cuba mengelak sekatan, had, semakan atau pemeriksaan keselamatan, atau mencapai data yang bukan milik anda.",
    ],
  },
  {
    heading: "Apa yang anda muat naik",
    points: [
      "Anda kekal memiliki apa yang anda siarkan dan muat naik. Anda membenarkan VAULTIX menyimpannya, menunjukkannya kepada Sheriff yang menyemaknya, dan memberi akses kepadanya seperti yang diterangkan dalam terma ini.",
      "Muat naik hanya bahan yang anda berhak kongsi. Bahan yang melanggar hak cipta seseorang, atau melanggar terma ini, dibuang, dan akaun itu boleh dihadkan.",
      "Sumber dihasilkan oleh pelajar. Sheriff menyemak bahawa tuntutan memenuhi permintaan, bukan bahawa setiap jawapan di dalamnya betul.",
    ],
  },
  {
    heading: "Wang",
    points: [
      "Ganjaran, yuran, pembayaran keluar dan bayaran balik mengikut peraturan di bawah dan Polisi Bayaran Balik.",
      "Pembayaran diterima oleh penyedia pembayaran kami. VAULTIX tidak sekali-kali melihat butiran kad atau perbankan dalam talian anda.",
    ],
  },
  {
    heading: "Moderasi",
    points: [
      "Sheriff dan Owner boleh menyembunyikan balasan, mematikan tag, menolak tuntutan, membuang Wanted dan mengehadkan akaun yang melanggar terma ini. Setiap keputusan sedemikian direkodkan.",
      "Tuntutan yang ditolak boleh dirayu sekali dalam tempoh 7 hari, dan sekatan boleh dirayu.",
    ],
  },
  {
    heading: "Perubahan dan penamatan",
    points: [
      "Apabila terma ini berubah, anda diminta menerima versi baharu pada lawatan anda yang seterusnya sebelum anda meneruskan.",
      "Anda boleh memadam akaun anda seperti yang diterangkan di bawah “Akaun anda dan data anda”.",
    ],
  },
];

export const TERMS_OF_USE: Bilingual<LegalDocument> = {
  en: {
    title: "Terms of Use",
    lede: "The rules for using VAULTIX: who may join, how to behave, and how posting, money and claims work.",
    status: `Version ${TERMS_OF_USE_VERSION} · Effective ${TERMS_OF_USE_EFFECTIVE_DATE}`,
    sections: [...GENERAL_EN, ...POSTING_TERMS],
  },
  ms: {
    title: "Terma Penggunaan",
    lede: "Peraturan menggunakan VAULTIX: siapa yang boleh menyertai, cara berkelakuan, dan cara penyiaran, wang serta tuntutan berfungsi.",
    status: `Versi ${TERMS_OF_USE_VERSION} · Berkuat kuasa 3 Oktober 2026`,
    sections: [...GENERAL_MS, ...POSTING_TERMS_MS],
  },
};
