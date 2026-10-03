import { TERMS_OF_USE_EFFECTIVE_DATE, TERMS_OF_USE_VERSION } from "@/contracts/legal";
import type { Bilingual, LegalDocument } from "./document";

/**
 * The Privacy Notice (Personal Data Protection Act 2010), accepted with the
 * Terms of Use and versioned with them. It names no company or person
 * (decision of 2026-10-03); requests go through the in-app form on the
 * profile. Retention periods come from `context/architecture.md`; the 7-year
 * period for financial and audit records was set on 2026-10-03.
 *
 * Keep the providers here in step with the services the code actually calls.
 */
export const PRIVACY_NOTICE: Bilingual<LegalDocument> = {
  en: {
    title: "Privacy Notice",
    lede: "What VAULTIX collects about you, why, who receives it, how long it is kept, and how to see, correct or delete it.",
    status: `Version ${TERMS_OF_USE_VERSION} · Effective ${TERMS_OF_USE_EFFECTIVE_DATE}`,
    sections: [
      {
        heading: "What we collect",
        points: [
          "Your account: email address, display name and password. Your password is held by our sign-in provider; VAULTIX never sees it. If you sign in with Google, the link to your Google profile photo.",
          "Your profile: picture or drawn character, bio and the date you joined.",
          "Institution verification: your university email domain, or the evidence you upload for a Sheriff to check.",
          "Payment details: your mobile number, bank, account holder name and account number, for refunds and payouts.",
          "Payments: the amount, the bill reference and its status from the payment provider. Your card and online banking details stay with the payment provider.",
          "What you post: Wanted requests, replies, claim files, reports, appeals and privacy requests.",
          "Records of your agreement to these terms, including that you confirmed you are 18 or older.",
          "Technical records: security and error logs (time, page and a request reference). Logs never contain your files, bank details or password.",
        ],
      },
      {
        heading: "Why we use it",
        points: [
          "To run your account and show your public profile.",
          "To check that you study at the institution you name, before you post, fund, claim or download.",
          "To take payments, hold bounties, and pay payouts and refunds to the right bank account.",
          "To review claims, handle reports and appeals, and keep VAULTIX safe.",
          "To send you messages about your account and activity, in the app and by email.",
          "To keep the records the law requires, such as payment records.",
        ],
        paragraphs: [
          "We do not sell your data, show advertising, or use tracking or analytics cookies.",
        ],
      },
      {
        heading: "What others can see",
        points: [
          "Anyone who can browse sees your display name, picture, bio, joined date, badges and the requests you posted.",
          "Your email address, verification evidence, bank details, claims and what you funded are never shown publicly.",
          "Sheriffs see what they need to review claims, reports and verification. Only the Owner sees a full bank account number, and only to pay a payout or refund.",
        ],
      },
      {
        heading: "Who receives it",
        paragraphs: [
          "These services run parts of VAULTIX for us and receive only what that part needs. Some are outside Malaysia, so your data is transferred to them for that purpose.",
        ],
        points: [
          "Clerk: sign-in and account security (United States).",
          "Supabase: the database and private file storage (Singapore).",
          "Vercel: hosting the website (United States, with servers worldwide).",
          "HitPay: taking payments (Singapore).",
          "Brevo: sending email (France, European Union).",
          "Google: only if you choose to sign in with Google.",
        ],
      },
      {
        heading: "How long we keep it",
        points: [
          "Account and profile: while your account exists. When you delete your account, your name, picture, bio and bank details are removed straight away.",
          "Institution verification evidence: deleted 30 days after the decision and any appeal.",
          "Claim files: a rejected claim's file is deleted 30 days after the final decision; a quarantined file after 90 days or when its investigation closes, whichever is later; an approved resource is kept while someone has access to it.",
          "Replies on missing-item and discussion requests: deleted 7 days after the thread closes, unless a bounty, review or appeal still needs them.",
          "Payment, payout, refund, moderation and audit records, agreements to these terms and privacy requests: 7 years. After you delete your account they are kept without your name.",
        ],
      },
      {
        heading: "Your rights",
        points: [
          "See and correct your data: most of it is on your profile, where you can change it yourself.",
          "Ask for a copy of your data, a correction or a deletion: use “Privacy requests” on your profile. Only the Owner reads these requests, and the answer appears on your profile, normally within 21 days.",
          "Delete your account from your profile, from 30 days after you created it, once no payment, payout, refund or claim of yours is in progress.",
          "If you do not give the details a feature needs (for example bank details to receive a payout), that feature is not available to you.",
        ],
      },
      {
        heading: "Security",
        points: [
          "Files and verification evidence are stored privately, and every access is checked on our servers and in the database.",
          "Your account number is shown back to you masked to its last four digits.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "When this notice changes, you are asked to accept the new version on your next visit, together with the Terms of Use.",
        ],
      },
    ],
  },
  ms: {
    title: "Notis Privasi",
    lede: "Apa yang VAULTIX kumpul tentang anda, mengapa, siapa yang menerimanya, berapa lama ia disimpan, dan cara melihat, membetulkan atau memadamnya.",
    status: `Versi ${TERMS_OF_USE_VERSION} · Berkuat kuasa 3 Oktober 2026`,
    sections: [
      {
        heading: "Apa yang kami kumpul",
        points: [
          "Akaun anda: alamat e-mel, nama paparan dan kata laluan. Kata laluan anda disimpan oleh penyedia log masuk kami; VAULTIX tidak sekali-kali melihatnya. Jika anda log masuk dengan Google, pautan ke foto profil Google anda.",
          "Profil anda: gambar atau watak lukisan, bio dan tarikh anda menyertai.",
          "Pengesahan institusi: domain e-mel universiti anda, atau bukti yang anda muat naik untuk disemak oleh Sheriff.",
          "Butiran pembayaran: nombor telefon bimbit, bank, nama pemegang akaun dan nombor akaun anda, untuk bayaran balik dan pembayaran keluar.",
          "Pembayaran: jumlah, rujukan bil dan statusnya daripada penyedia pembayaran. Butiran kad dan perbankan dalam talian anda kekal dengan penyedia pembayaran.",
          "Apa yang anda siarkan: permintaan Wanted, balasan, fail tuntutan, laporan, rayuan dan permintaan privasi.",
          "Rekod persetujuan anda terhadap terma ini, termasuk pengesahan bahawa anda berumur 18 tahun ke atas.",
          "Rekod teknikal: log keselamatan dan ralat (masa, halaman dan rujukan permintaan). Log tidak sekali-kali mengandungi fail, butiran bank atau kata laluan anda.",
        ],
      },
      {
        heading: "Mengapa kami menggunakannya",
        points: [
          "Untuk mengendalikan akaun anda dan menunjukkan profil awam anda.",
          "Untuk menyemak bahawa anda belajar di institusi yang anda namakan, sebelum anda menyiarkan, membiayai, menuntut atau memuat turun.",
          "Untuk menerima pembayaran, menyimpan ganjaran, dan membuat pembayaran keluar serta bayaran balik ke akaun bank yang betul.",
          "Untuk menyemak tuntutan, mengendalikan laporan dan rayuan, dan memastikan VAULTIX selamat.",
          "Untuk menghantar mesej kepada anda tentang akaun dan aktiviti anda, dalam aplikasi dan melalui e-mel.",
          "Untuk menyimpan rekod yang dikehendaki oleh undang-undang, seperti rekod pembayaran.",
        ],
        paragraphs: [
          "Kami tidak menjual data anda, memaparkan iklan, atau menggunakan kuki penjejakan atau analitik.",
        ],
      },
      {
        heading: "Apa yang orang lain boleh lihat",
        points: [
          "Sesiapa yang boleh melayari melihat nama paparan, gambar, bio, tarikh menyertai, lencana dan permintaan yang anda siarkan.",
          "Alamat e-mel, bukti pengesahan, butiran bank, tuntutan anda dan apa yang anda biayai tidak sekali-kali ditunjukkan secara awam.",
          "Sheriff melihat apa yang mereka perlukan untuk menyemak tuntutan, laporan dan pengesahan. Hanya Owner melihat nombor akaun bank penuh, dan hanya untuk membuat pembayaran keluar atau bayaran balik.",
        ],
      },
      {
        heading: "Siapa yang menerimanya",
        paragraphs: [
          "Perkhidmatan ini mengendalikan sebahagian VAULTIX bagi pihak kami dan hanya menerima apa yang diperlukan oleh bahagian itu. Sebahagiannya berada di luar Malaysia, jadi data anda dipindahkan kepada mereka untuk tujuan tersebut.",
        ],
        points: [
          "Clerk: log masuk dan keselamatan akaun (Amerika Syarikat).",
          "Supabase: pangkalan data dan storan fail sulit (Singapura).",
          "Vercel: pengehosan laman web (Amerika Syarikat, dengan pelayan di seluruh dunia).",
          "HitPay: menerima pembayaran (Singapura).",
          "Brevo: menghantar e-mel (Perancis, Kesatuan Eropah).",
          "Google: hanya jika anda memilih untuk log masuk dengan Google.",
        ],
      },
      {
        heading: "Berapa lama kami menyimpannya",
        points: [
          "Akaun dan profil: selagi akaun anda wujud. Apabila anda memadam akaun anda, nama, gambar, bio dan butiran bank anda dibuang serta-merta.",
          "Bukti pengesahan institusi: dipadam 30 hari selepas keputusan dan sebarang rayuan.",
          "Fail tuntutan: fail tuntutan yang ditolak dipadam 30 hari selepas keputusan muktamad; fail yang dikuarantin selepas 90 hari atau apabila siasatannya ditutup, mengikut mana yang lebih lewat; sumber yang diluluskan disimpan selagi seseorang mempunyai akses kepadanya.",
          "Balasan pada permintaan barang hilang dan perbincangan: dipadam 7 hari selepas bebenang ditutup, melainkan ganjaran, semakan atau rayuan masih memerlukannya.",
          "Rekod pembayaran, pembayaran keluar, bayaran balik, moderasi dan audit, persetujuan terhadap terma ini dan permintaan privasi: 7 tahun. Selepas anda memadam akaun anda, rekod ini disimpan tanpa nama anda.",
        ],
      },
      {
        heading: "Hak anda",
        points: [
          "Melihat dan membetulkan data anda: kebanyakannya terdapat pada profil anda, di mana anda boleh mengubahnya sendiri.",
          "Meminta salinan data anda, pembetulan atau pemadaman: gunakan bahagian “Privacy requests” pada profil anda. Hanya Owner membaca permintaan ini, dan jawapannya dipaparkan pada profil anda, biasanya dalam tempoh 21 hari.",
          "Memadam akaun anda daripada profil anda, mulai 30 hari selepas anda menciptanya, apabila tiada pembayaran, pembayaran keluar, bayaran balik atau tuntutan anda yang masih dalam proses.",
          "Jika anda tidak memberikan butiran yang diperlukan oleh sesuatu ciri (contohnya butiran bank untuk menerima pembayaran keluar), ciri itu tidak tersedia untuk anda.",
        ],
      },
      {
        heading: "Keselamatan",
        points: [
          "Fail dan bukti pengesahan disimpan secara sulit, dan setiap akses diperiksa pada pelayan kami dan dalam pangkalan data.",
          "Nombor akaun anda ditunjukkan semula kepada anda dengan hanya empat digit terakhir kelihatan.",
        ],
      },
      {
        heading: "Perubahan",
        paragraphs: [
          "Apabila notis ini berubah, anda diminta menerima versi baharu pada lawatan anda yang seterusnya, bersama dengan Terma Penggunaan.",
        ],
      },
    ],
  },
};
