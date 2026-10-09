import type { ReactNode } from "react";
import { StatusStamp } from "../status-stamp";

/**
 * Developer reference for the Android payment-notification app, drawn from
 * the DRAFT direct-payment design
 * (`docs/superpowers/specs/2026-10-09-vaultix-direct-payment-draft-design.md`
 * §6 and §7). Nothing it describes is implemented. Every rule the draft leaves
 * open (signing scheme, lifetimes, health field names, error codes) is listed
 * as open here rather than invented, and the page says plainly that an app
 * must not be built against it as final.
 */

interface FieldSpec {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly description: ReactNode;
}

const OBSERVATION_FIELDS: readonly FieldSpec[] = [
  {
    name: "schemaVersion",
    type: "integer, always 1",
    required: true,
    description: "Version of this body. Anything else is refused.",
  },
  {
    name: "eventId",
    type: "UUID string",
    required: true,
    description:
      "Made once on the phone for each observation and kept for every retry of it. The same eventId with a different body is refused as a conflict.",
  },
  {
    name: "sequence",
    type: "integer",
    required: true,
    description:
      "The phone's own running count of observations. Paydesk uses it to notice gaps; late or out-of-order delivery is still accepted.",
  },
  {
    name: "sourcePackage",
    type: "string",
    required: true,
    description: "Android package name of the app that posted the notification.",
  },
  {
    name: "sourceAppVersion",
    type: "string",
    required: true,
    description: "Version of that app, so a changed notification format can be spotted.",
  },
  {
    name: "parserVersion",
    type: "string",
    required: true,
    description: "Version of the phone app's notification reader that produced this body.",
  },
  {
    name: "notificationKeyDigest",
    type: "64 hexadecimal characters",
    required: true,
    description:
      "A digest of Android's notification key, never the key itself. It ties updates of one notification together.",
  },
  {
    name: "notificationRevision",
    type: "integer",
    required: true,
    description: "Starts at 1 and goes up each time the same notification is updated.",
  },
  {
    name: "observedAt",
    type: "UTC timestamp (ISO 8601)",
    required: true,
    description:
      "When the phone saw the notification, by the phone's clock. Paydesk records its own receipt time separately and never treats this as the payment time.",
  },
  {
    name: "category",
    type: '"incoming_payment" | "settlement" | "unknown"',
    required: true,
    description:
      "What kind of notification it is. Payer-debit, loyalty and unrelated notifications are dropped on the phone and never sent.",
  },
  {
    name: "amountSen",
    type: "integer (sen)",
    required: true,
    description: "The amount shown, in whole sen: RM 11.00 is 1100. Never a decimal.",
  },
  {
    name: "currency",
    type: '"MYR"',
    required: true,
    description: "Currency of the amount.",
  },
  {
    name: "sourceTransactionReference",
    type: "string or null",
    required: true,
    description:
      "The transaction reference if the notification shows one, otherwise null. A missing reference is still a valid observation.",
  },
];

const OBSERVATION_EXAMPLE = `{
  "schemaVersion": 1,
  "eventId": "00000000-0000-4000-8000-000000000001",
  "sequence": 12,
  "sourcePackage": "synthetic.payment.app",
  "sourceAppVersion": "synthetic-v1",
  "parserVersion": "fixture-v1",
  "notificationKeyDigest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "notificationRevision": 1,
  "observedAt": "2026-10-09T15:45:00Z",
  "category": "incoming_payment",
  "amountSen": 1100,
  "currency": "MYR",
  "sourceTransactionReference": null
}`;

const ACCEPTED_EXAMPLE = `{
  "ok": true,
  "data": { "observationId": "…", "accepted": true, "duplicate": false }
}`;

const DUPLICATE_EXAMPLE = `{
  "ok": true,
  "data": { "observationId": "…", "accepted": true, "duplicate": true }
}`;

const FAILURE_EXAMPLE = `{
  "ok": false,
  "code": "…",
  "message": "…"
}`;

const RESPONSES: readonly { status: string; meaning: string; action: string }[] = [
  {
    status: "202 Accepted",
    meaning: "First time this eventId was stored. The observation is saved, not a payment.",
    action: "Mark the event sent.",
  },
  {
    status: "200 OK",
    meaning: "This exact event was already stored; duplicate is true.",
    action: "Mark the event sent. Nothing changed on the server.",
  },
  {
    status: "400 Bad Request",
    meaning: "The body does not match the schema or is too large.",
    action: "Do not retry unchanged. Report it in health as a reader problem.",
  },
  {
    status: "401 Unauthorized",
    meaning: "Bad signature or credential.",
    action: "Refresh the credential with the device key, then retry with a new nonce.",
  },
  {
    status: "403 Forbidden",
    meaning: "The device is revoked or the credential lacks the scope.",
    action: "Stop sending. The Owner must enrol the device again.",
  },
  {
    status: "409 Conflict",
    meaning: "Same eventId with a different body, or a reused nonce.",
    action: "Do not retry. Keep the event for diagnosis.",
  },
  {
    status: "429 Too Many Requests",
    meaning: "Throttled.",
    action: "Back off and retry later with the same eventId.",
  },
  {
    status: "503 Service Unavailable",
    meaning: "Temporary storage failure.",
    action: "Retry later with the same eventId and body, and a new nonce and signature.",
  },
];

const SECTIONS = [
  ["overview", "What the app does"],
  ["boundaries", "What a device can and cannot do"],
  ["enrolment", "Enrolment and credentials"],
  ["signing", "Signing every request"],
  ["observations", "Send an observation"],
  ["health", "Report health"],
  ["privacy", "What never leaves the phone"],
  ["retries", "Retries, offline and ordering"],
  ["open", "Open decisions"],
] as const;

function Code({ children, label }: { readonly children: string; readonly label: string }) {
  return (
    <pre className="api-doc__code" tabIndex={0} aria-label={label}>
      <code>{children}</code>
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  readonly id: (typeof SECTIONS)[number][0];
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="api-doc__section" id={id} aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      {children}
    </section>
  );
}

function Endpoint({ method, path }: { readonly method: string; readonly path: string }) {
  return (
    <p className="api-doc__endpoint">
      <span className="api-doc__method">{method}</span> <code>{path}</code>
    </p>
  );
}

export function PaymentDeviceApiDoc() {
  return (
    <article className="api-doc" aria-labelledby="api-doc-heading">
      <header className="api-doc__head">
        <p className="api-doc__eyebrow">VAULTIX developer reference</p>
        <h1 id="api-doc-heading">Payment device API</h1>
        <StatusStamp
          presentation={{ label: "Draft v1, not live", tone: "warning", emphasis: "doubled" }}
          context="API"
        />
        <p className="lede">
          For the Android app that runs on the business recipient&rsquo;s own phone, reads incoming
          payment notifications with the owner&rsquo;s consent, and reports them to Paydesk,
          VAULTIX&rsquo;s payment app.
        </p>
      </header>

      <section className="ui-status ui-status--restricted" role="note" aria-label="Status">
        <p className="ui-status__label">Not live</p>
        <h2 className="ui-status__heading">Read it, do not ship against it</h2>
        <p className="ui-status__message">
          These endpoints are a proposal under review. They do not exist on the server yet, so any
          call fails. Field names, signing and lifetimes can still change. Build prototypes against
          synthetic data only, and never against a real wallet until this page says v1 is final.
        </p>
      </section>

      <nav className="api-doc__toc" aria-label="On this page">
        <h2>On this page</h2>
        <ol>
          {SECTIONS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`}>{title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="overview" title="What the app does">
        <p>
          A member pays the business account by DuitNow QR or Touch &rsquo;n Go, then sends a
          screenshot to their payment request on Paydesk, VAULTIX&rsquo;s separate payment app. The
          phone app watches the business account&rsquo;s own notifications and sends Paydesk a
          small, structured observation for each incoming payment or settlement it sees.
        </p>
        <p>
          <strong>Where to send:</strong> these endpoints are served by Paydesk, not by the VAULTIX
          site. The paths below are relative to Paydesk&rsquo;s address, which will be published
          here when it exists.
        </p>
        <p>
          <strong>An observation is evidence, never a confirmation.</strong> Paydesk stores it and
          shows it to the admin beside the matching request. In version 1 an admin approves every
          payment; observations approve nothing. A 202 from this API means &ldquo;stored&rdquo;, not
          &ldquo;paid&rdquo;. A missing observation is never a failed payment either.
        </p>
      </Section>

      <Section id="boundaries" title="What a device can and cannot do">
        <div className="api-doc__columns">
          <div>
            <h3>Can</h3>
            <ul>
              <li>Send observations (scope payment-observations:write).</li>
              <li>Send health reports (scope device-health:write).</li>
            </ul>
          </div>
          <div>
            <h3>Cannot</h3>
            <ul>
              <li>List payment requests, proofs or members, or read any email address.</li>
              <li>Confirm, approve or reject a payment, or touch the ledger.</li>
              <li>Write to the database directly.</li>
              <li>Hold a service-role key or any shared admin secret.</li>
              <li>Choose its own account or environment: the credential decides them.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section id="enrolment" title="Enrolment and credentials">
        <ol>
          <li>
            The app creates a private signing key in Android&rsquo;s protected key storage. The key
            never leaves the phone.
          </li>
          <li>
            A Paydesk owner admin, freshly signed in, approves a one-time enrolment that binds the
            app&rsquo;s public key to the business account and one environment.
          </li>
          <li>
            Paydesk issues short-lived, narrowly scoped credentials bound to that key. Refreshing
            them requires proof that the phone still holds the key and the enrolment is active.
          </li>
          <li>
            The Owner can revoke or rotate one device at any time. Revocation is checked on every
            request, including queued retries.
          </li>
        </ol>
        <p>
          Android notification access and Paydesk enrolment are separate. If the owner withdraws
          notification access, report it in health; it is a device problem, not a payment failure.
        </p>
        <p className="policy-note">
          Open: the enrolment endpoints, code and credential lifetimes, and the credential format
          are decided in security review and will be added here.
        </p>
      </Section>

      <Section id="signing" title="Signing every request">
        <p>Each request is signed with the device key over:</p>
        <ul>
          <li>the HTTP method and the exact path;</li>
          <li>a digest of the canonical body;</li>
          <li>the key id and the environment;</li>
          <li>the time it was issued;</li>
          <li>a unique nonce, never reused, including on retries.</li>
        </ul>
        <p className="policy-note">
          Open: the signature algorithm, header names, canonical body form and allowed clock skew
          are not decided yet.
        </p>
      </Section>

      <Section id="observations" title="Send an observation">
        <Endpoint method="POST" path="/api/payment-devices/v1/observations" />
        <p>One observation per request. Content type JSON. Unknown fields are refused.</p>

        <h3>Body fields</h3>
        <dl className="api-doc__fields">
          {OBSERVATION_FIELDS.map((field) => (
            <div key={field.name} className="api-doc__field">
              <dt>
                <code>{field.name}</code>
                <span className="api-doc__type">
                  {field.type}
                  {field.required ? ", required" : ", optional"}
                </span>
              </dt>
              <dd>{field.description}</dd>
            </div>
          ))}
        </dl>

        <h3>Example body</h3>
        <p>Synthetic values. This is not a real Touch &rsquo;n Go or DuitNow payload.</p>
        <Code label="Example observation body">{OBSERVATION_EXAMPLE}</Code>

        <h3>Responses</h3>
        <p>Every response body has the same envelope:</p>
        <Code label="Accepted response">{ACCEPTED_EXAMPLE}</Code>
        <Code label="Duplicate response">{DUPLICATE_EXAMPLE}</Code>
        <Code label="Failure response">{FAILURE_EXAMPLE}</Code>
        <p>
          No response ever says which member or request an observation matched. The failure codes
          will be published with the final contract.
        </p>

        <ul className="api-doc__responses">
          {RESPONSES.map((response) => (
            <li key={response.status} className="api-doc__response">
              <p className="api-doc__status">{response.status}</p>
              <p>{response.meaning}</p>
              <p className="api-doc__action">
                <strong>App should:</strong> {response.action}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="health" title="Report health">
        <Endpoint method="POST" path="/api/payment-devices/v1/health" />
        <p>Sent regularly so the Owner can see the phone is still watching. It reports:</p>
        <ul>
          <li>whether notification access is granted and the listener is running;</li>
          <li>the app version and reader (parser) version;</li>
          <li>the last sequence number it processed;</li>
          <li>how many observations are queued and waiting to send.</li>
        </ul>
        <p>
          Health never contains notification text and can never credit money. Its exact field names
          are open and will be added here.
        </p>
      </Section>

      <Section id="privacy" title="What never leaves the phone">
        <ul>
          <li>Full notification titles or bodies, or a dump of all notifications.</li>
          <li>Payer names or other people&rsquo;s names.</li>
          <li>Messages from any other app.</li>
          <li>Bank account details.</li>
          <li>Payer-debit, loyalty or promotional notifications.</li>
        </ul>
        <p>
          For a notification from an allowed app in a format the reader does not know, the app may
          send only minimal diagnostics, once that policy is approved. Until then, send nothing.
        </p>
      </Section>

      <Section id="retries" title="Retries, offline and ordering">
        <ul>
          <li>Queue observations on the phone while offline; send them when back online.</li>
          <li>
            On retry, keep the same eventId and body, and sign again with a new nonce and time.
          </li>
          <li>Sending the same event twice is harmless: the second answer has duplicate true.</li>
          <li>
            One payment can show as several notifications (incoming, then settlement, or an updated
            notification). Send each; Paydesk counts the payment once, never the notifications.
          </li>
          <li>Old observations are accepted, but they cannot bypass a request&rsquo;s deadline.</li>
        </ul>
      </Section>

      <Section id="open" title="Open decisions">
        <ul>
          <li>Signature scheme, header names, nonce rules and clock skew.</li>
          <li>Enrolment, code and credential lifetimes.</li>
          <li>Health field names, and the failure codes.</li>
          <li>
            Whether a name or reference must be collected at all, and how long observations are kept
            (D4).
          </li>
          <li>
            How a payment is proved and tied to one request (D7). Until that passes, observations
            are stored but cannot credit anything automatically.
          </li>
          <li>The real notification formats, tested on the actual phone with consent.</li>
        </ul>
        <p className="api-doc__source">
          Source: VAULTIX direct payment draft design, 9 October 2026, sections 6 and 7, and the
          Paydesk design, 10 October 2026
          (docs/superpowers/specs/2026-10-10-vaultix-paydesk-design.md).
        </p>
      </Section>
    </article>
  );
}
