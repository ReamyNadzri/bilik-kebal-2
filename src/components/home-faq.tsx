import Link from "next/link";

interface Question {
  readonly question: string;
  readonly answer: React.ReactNode;
}

/**
 * Plain-English answers to what new students ask first. Every answer restates
 * a rule the posting terms (src/features/legal/terms.ts) already give; nothing
 * here promises more than they do.
 */
const QUESTIONS: readonly Question[] = [
  {
    question: "What is VAULTIX?",
    answer:
      "A bounty board for academic resources. A student posts a Wanted for notes, summaries or worked answers, classmates can add money to its bounty, and a Hunter who has the resource submits it as a claim. A Sheriff reviews every claim before anyone gets access or is paid.",
  },
  {
    question: "Who can use it?",
    answer:
      "Anyone with a verified email can browse the Board. Posting, backing, claiming, commenting and downloading need institution verification: your student email, or evidence a Sheriff checks.",
  },
  {
    question: "Is it free?",
    answer: (
      <>
        Yes. Every member can post 3 free requests, with no bounty and no fee. A code from{" "}
        <Link href="/profile#reward-code">Redeem Code</Link> on your profile adds more.
      </>
    ),
  },
  {
    question: "How does a bounty work?",
    answer:
      "Each contribution is RM1 to RM50. A platform fee is paid on top of it, never taken from the bounty, so the winning Hunter receives the whole bounty. The fee rate is fixed when the Wanted is published.",
  },
  {
    question: "When do I get my money back?",
    answer:
      "If a Wanted with a bounty expires without an approved claim, or is withdrawn, every contribution is refunded in full, fee included, by bank transfer to the account on your profile.",
  },
  {
    question: "Who decides which claim wins?",
    answer:
      "A human Sheriff. Automated checks only help the Sheriff; they never approve a claim. One claim wins each Wanted, and a rejected claim can be appealed once within 7 days.",
  },
  {
    question: "What may I not ask for?",
    answer:
      "Publisher textbooks, paid tutorial material, leaked or unreleased exam papers, documents your institution restricts, and anyone's personal details. Use the flag on a Wanted to report one that breaks the rules.",
  },
  {
    question: "Can I delete my account?",
    answer:
      "Yes, from 30 days after you created it, once nothing of yours is still being paid, refunded or reviewed. Your name, picture, bio and bank details are removed for good.",
  },
];

/** The homepage's questions and answers. Native disclosure widgets: keyboard and screen-reader ready. */
export function HomeFaq() {
  return (
    <section className="panel home-faq" aria-labelledby="home-faq-title">
      <h2 id="home-faq-title">Questions, answered</h2>
      <div className="home-faq__list">
        {QUESTIONS.map((item) => (
          <details className="home-faq__item" key={item.question}>
            <summary className="home-faq__question">{item.question}</summary>
            <p className="home-faq__answer">{item.answer}</p>
          </details>
        ))}
      </div>
      <p className="panel__note">
        The full rules are in the posting terms, shown when you post a Wanted.
      </p>
    </section>
  );
}
