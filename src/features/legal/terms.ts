import { CURRENT_POLICY_VERSION } from "@/contracts/marketplace";

/**
 * The Terms a member accepts when posting a Wanted.
 *
 * Final, effective 2 October 2026 (made final at the user's request,
 * 2026-10-02). Written in plain English from the accepted product rules in
 * `context/project-overview.md` and `context/architecture.md` and the
 * decisions recorded in `context/progress-tracker.md`. The version is
 * snapshotted on every published Wanted (`policy_version_snapshot`), so a
 * later revision never rewrites what an earlier poster agreed to; the
 * forfeiture rule applies only to Wanteds published under this version or a
 * later one.
 */
export const TERMS_VERSION = CURRENT_POLICY_VERSION;
export const TERMS_EFFECTIVE_DATE = "2 October 2026";
export const TERMS_STATUS = `Effective ${TERMS_EFFECTIVE_DATE}`;

export interface TermsSection {
  readonly heading: string;
  readonly points: readonly string[];
}

export const POSTING_TERMS: readonly TermsSection[] = [
  {
    heading: "What you may ask for",
    points: [
      "Ask only for material a student is allowed to share: your own notes, summaries, worked answers and similar work.",
      "Do not ask for publisher textbooks, paid tutorial material, leaked or unreleased exam papers, or documents your institution restricts.",
      "Missing-item requests describe something you lost. Do not post other people's personal details, and arrange any handover in a safe, public place.",
      "Discussions must stay respectful and on topic. Sheriffs may hide replies that break these terms.",
      "Tags are open: you may add any tag that describes your request. A Sheriff may switch off a tag that is offensive or misleading.",
      "Any verified member may report a request that breaks these terms. Reports go privately to the Sheriffs and the Owner.",
    ],
  },
  {
    heading: "Bounties and money",
    points: [
      "A bounty is optional. Any request may be posted free; a free request has no payment, no fee and no payout.",
      "Every member may post 3 free requests in total. A reward code adds more; each code can be redeemed once per member.",
      "On a missing item or discussion with a bounty, you release it by naming the member who helped. A Sheriff approves the release before anyone is paid.",
      "Each contribution to a bounty is RM1 to RM50. A platform fee (currently 10% of the contribution, rounded down to the sen) is paid on top of it and does not go into the bounty. The rate is fixed when the request is published and does not change afterwards.",
      "A bounty changes only after the payment provider confirms the payment directly to VAULTIX. A redirect back to the site is not a confirmation.",
      "The platform fee is never taken out of the bounty: the winning Hunter, or the member named on a released bounty, receives the whole bounty.",
      "If a request with a bounty expires without an approved claim, or is withdrawn, every confirmed contribution and the fee paid with it are refunded in full.",
      "Refunds and payouts are paid by bank transfer to the account on your profile. Add your phone number and bank account before you pay or claim a bounty.",
      "If a request breaks these terms, the Owner may remove it even when it holds a bounty. You then forfeit the money you put into it, platform fee included; every other Backer is refunded in full. The Owner records the reason.",
    ],
  },
  {
    heading: "Claims, review and access",
    points: [
      "Only a human Sheriff can approve a claim. Automated checks are evidence for the Sheriff, never a decision.",
      "One claim wins each request. The winning Hunter receives the whole bounty.",
      "Contributors to a bounty get access to the approved resource. On a free request, the person who posted it gets access.",
      "A resource becomes free for everyone 48 hours after approval only if the Hunter opted in and a Sheriff confirmed the sharing rights.",
      "A rejected claim may be appealed once within 7 days. A different Sheriff decides the appeal, and the request's expiry and refunds pause meanwhile.",
    ],
  },
  {
    heading: "Your account and your data",
    points: [
      "Posting, funding and claiming need institution verification. Email verification alone lets you browse.",
      "Your public profile shows your display name, picture, bio, joined date, verification badges and the requests you posted. It never shows your email, your verification evidence, your claims or what you funded.",
      "Files submitted as claims stay private and quarantined until a Sheriff decides.",
      "Your display name can be changed twice. A name change code adds more changes.",
      "You may delete your account from 30 days after you created it, once no payment, payout, refund or claim of yours is still in progress. Deleting removes your name, picture, bio and bank details for good. Payment and audit records are kept, without your name, as the law requires.",
      "Accounts that break these terms may be restricted. Restrictions are recorded and can be appealed.",
    ],
  },
];

/**
 * The same posting terms in Malay, point for point. Change both together: a
 * point added to one and not the other is a different agreement.
 */
export const POSTING_TERMS_MS: readonly TermsSection[] = [
  {
    heading: "Apa yang boleh anda minta",
    points: [
      "Minta hanya bahan yang dibenarkan untuk dikongsi oleh pelajar: nota anda sendiri, ringkasan, jawapan yang dihuraikan dan hasil kerja yang serupa.",
      "Jangan minta buku teks penerbit, bahan tutorial berbayar, kertas peperiksaan yang bocor atau belum dikeluarkan, atau dokumen yang dihadkan oleh institusi anda.",
      "Permintaan barang hilang menerangkan sesuatu yang anda hilang. Jangan siarkan butiran peribadi orang lain, dan aturkan sebarang penyerahan di tempat awam yang selamat.",
      "Perbincangan mesti sopan dan berkaitan dengan topik. Sheriff boleh menyembunyikan balasan yang melanggar terma ini.",
      "Tag adalah terbuka: anda boleh menambah sebarang tag yang menerangkan permintaan anda. Sheriff boleh mematikan tag yang menyinggung atau mengelirukan.",
      "Mana-mana ahli yang disahkan boleh melaporkan permintaan yang melanggar terma ini. Laporan dihantar secara sulit kepada Sheriff dan Owner.",
    ],
  },
  {
    heading: "Ganjaran dan wang",
    points: [
      "Ganjaran (bounty) adalah pilihan. Sebarang permintaan boleh disiarkan secara percuma; permintaan percuma tiada bayaran, tiada yuran dan tiada pembayaran keluar.",
      "Setiap ahli boleh menyiarkan 3 permintaan percuma kesemuanya. Kod ganjaran menambah lagi; setiap kod boleh ditebus sekali bagi setiap ahli.",
      "Bagi barang hilang atau perbincangan yang mempunyai ganjaran, anda melepaskannya dengan menamakan ahli yang membantu. Sheriff meluluskan pelepasan itu sebelum sesiapa dibayar.",
      "Setiap sumbangan kepada ganjaran ialah RM1 hingga RM50. Yuran platform (kini 10% daripada sumbangan, dibundarkan ke bawah kepada sen) dibayar di atas sumbangan itu dan tidak masuk ke dalam ganjaran. Kadarnya ditetapkan apabila permintaan disiarkan dan tidak berubah selepas itu.",
      "Ganjaran berubah hanya selepas penyedia pembayaran mengesahkan pembayaran terus kepada VAULTIX. Halaan semula kembali ke laman ini bukan pengesahan.",
      "Yuran platform tidak pernah diambil daripada ganjaran: Hunter yang menang, atau ahli yang dinamakan pada ganjaran yang dilepaskan, menerima keseluruhan ganjaran.",
      "Jika permintaan yang mempunyai ganjaran tamat tempoh tanpa tuntutan yang diluluskan, atau ditarik balik, setiap sumbangan yang disahkan dan yuran yang dibayar bersamanya dipulangkan sepenuhnya.",
      "Bayaran balik dan pembayaran keluar dibuat melalui pindahan bank ke akaun dalam profil anda. Tambah nombor telefon dan akaun bank anda sebelum anda membayar atau menuntut ganjaran.",
      "Jika sesuatu permintaan melanggar terma ini, Owner boleh membuangnya walaupun ia mempunyai ganjaran. Anda kemudiannya kehilangan wang yang anda masukkan ke dalamnya, termasuk yuran platform; setiap Backer lain dipulangkan sepenuhnya. Owner merekodkan sebabnya.",
    ],
  },
  {
    heading: "Tuntutan, semakan dan akses",
    points: [
      "Hanya Sheriff manusia boleh meluluskan tuntutan. Semakan automatik ialah bukti untuk Sheriff, bukan keputusan.",
      "Satu tuntutan memenangi setiap permintaan. Hunter yang menang menerima keseluruhan ganjaran.",
      "Penyumbang kepada ganjaran mendapat akses kepada sumber yang diluluskan. Bagi permintaan percuma, orang yang menyiarkannya mendapat akses.",
      "Sumber menjadi percuma untuk semua 48 jam selepas kelulusan hanya jika Hunter memilih untuk berbuat demikian dan Sheriff mengesahkan hak perkongsian.",
      "Tuntutan yang ditolak boleh dirayu sekali dalam tempoh 7 hari. Sheriff yang lain memutuskan rayuan itu, dan tarikh tamat serta bayaran balik permintaan itu ditangguhkan sementara itu.",
    ],
  },
  {
    heading: "Akaun anda dan data anda",
    points: [
      "Menyiarkan, membiayai dan menuntut memerlukan pengesahan institusi. Pengesahan e-mel sahaja membolehkan anda melayari.",
      "Profil awam anda menunjukkan nama paparan, gambar, bio, tarikh menyertai, lencana pengesahan dan permintaan yang anda siarkan. Ia tidak sekali-kali menunjukkan e-mel anda, bukti pengesahan anda, tuntutan anda atau apa yang anda biayai.",
      "Fail yang dihantar sebagai tuntutan kekal sulit dan dikuarantin sehingga Sheriff membuat keputusan.",
      "Nama paparan anda boleh ditukar dua kali. Kod pertukaran nama menambah lagi pertukaran.",
      "Anda boleh memadam akaun anda mulai 30 hari selepas anda menciptanya, apabila tiada pembayaran, pembayaran keluar, bayaran balik atau tuntutan anda yang masih dalam proses. Pemadaman membuang nama, gambar, bio dan butiran bank anda secara kekal. Rekod pembayaran dan audit disimpan, tanpa nama anda, seperti yang dikehendaki oleh undang-undang.",
      "Akaun yang melanggar terma ini boleh dihadkan. Sekatan direkodkan dan boleh dirayu.",
    ],
  },
];
