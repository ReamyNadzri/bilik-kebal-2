"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar } from "./avatar";
import { UiStatus } from "./ui-status";
import type { CommunityPayoutRequestView } from "@/contracts/marketplace";
import { TAXONOMY_CATEGORY_LABEL, type TaxonomyRequestView } from "@/contracts/taxonomy-requests";
import { callOperation } from "@/features/presentation/call-operation";
import { formatRinggit } from "@/features/marketplace/money";

type Decision = { readonly approve: boolean; readonly note: string; readonly openRegion: boolean };

const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Two Sheriff queues on one tab: members asking for a new list entry, and
 * posters asking to release a bounty on a missing item or discussion. Each
 * decision is re-authorised in the database, which also refuses a Sheriff who
 * is a party to a release. A viewer's own requests stay listed and labelled,
 * with their decisions switched off, so nothing seems to vanish.
 */
export function ConsoleRequests({
  entries,
  releases,
}: {
  readonly entries: readonly TaxonomyRequestView[] | null;
  readonly releases: readonly CommunityPayoutRequestView[] | null;
}) {
  const [doneEntries, setDoneEntries] = useState<ReadonlySet<string>>(new Set());
  const [doneReleases, setDoneReleases] = useState<ReadonlySet<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Decision>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const draft = (id: string): Decision =>
    drafts[id] ?? { approve: true, note: "", openRegion: false };
  const patch = (id: string, next: Partial<Decision>) =>
    setDrafts((current) => ({ ...current, [id]: { ...draft(id), ...next } }));

  async function decideEntry(item: TaxonomyRequestView, approve: boolean) {
    setBusy(item.id);
    setNotice(null);
    const d = draft(item.id);
    const result = await callOperation<{ state: string }, string>(
      `/api/sheriff/taxonomy-requests/${item.id}`,
      {
        approve,
        note: d.note,
        ...(item.category === "campus" ? { openRegion: d.openRegion } : {}),
      },
      "TAXONOMY_REQUESTS_UNAVAILABLE",
    );
    setBusy(null);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.message || "The decision could not be saved." });
      return;
    }
    setDoneEntries((current) => new Set(current).add(item.id));
    setNotice({
      kind: "ok",
      text: approve
        ? `Added “${item.label}”. The member has been notified.`
        : `Declined “${item.label}”. The member has been notified.`,
    });
  }

  async function decideRelease(item: CommunityPayoutRequestView, approve: boolean) {
    setBusy(item.id);
    setNotice(null);
    const result = await callOperation<{ state: string }, string>(
      `/api/sheriff/community-payouts/${item.id}`,
      { approve, note: draft(item.id).note },
      "MARKETPLACE_UNAVAILABLE",
    );
    setBusy(null);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.message || "The decision could not be saved." });
      return;
    }
    setDoneReleases((current) => new Set(current).add(item.id));
    setNotice({
      kind: "ok",
      text: approve
        ? "Release approved. A payout task is waiting for the Owner in Payouts & refunds."
        : "Release declined. The poster has been notified.",
    });
  }

  const openEntries = entries?.filter((item) => !doneEntries.has(item.id)) ?? null;
  const openReleases = releases?.filter((item) => !doneReleases.has(item.id)) ?? null;

  return (
    <div className="stack">
      {notice ? (
        <p
          className={`ops-alert ${notice.kind === "ok" ? "ops-alert--success" : "ops-alert--error"}`}
          role={notice.kind === "ok" ? "status" : "alert"}
        >
          {notice.text}
        </p>
      ) : null}

      <section className="panel" aria-labelledby="entry-requests-heading">
        <h2 id="entry-requests-heading">New list entries</h2>
        <p className="page-head__lede">
          Members ask for a campus, faculty, programme, course, session, resource type or tag that
          is not listed. Approving adds it for everyone; either way the member is told in the app
          and by email.
        </p>
        {openEntries === null ? (
          <UiStatus kind="offline" heading="Entry requests could not be loaded" />
        ) : openEntries.length === 0 ? (
          <UiStatus kind="empty" heading="No entry requests waiting" />
        ) : (
          <ul className="appeal-list">
            {openEntries.map((item) => {
              const d = draft(item.id);
              return (
                <li className="locker-card appeal-card" key={item.id}>
                  <p className="pixel-label">{TAXONOMY_CATEGORY_LABEL[item.category]}</p>
                  {item.ownRequest ? (
                    <p className="ops-alert ops-alert--info" id={`entry-own-${item.id}`}>
                      You asked for this. Another Sheriff or the Owner decides it.
                    </p>
                  ) : null}
                  <h3 className="ops-panel__title">
                    {item.courseCode ? `${item.courseCode} ` : ""}
                    {item.label}
                  </h3>
                  <dl className="index-grid">
                    {item.parentName ? (
                      <>
                        <dt>Belongs to</dt>
                        <dd>{item.parentName}</dd>
                      </>
                    ) : null}
                    <dt>Asked by</dt>
                    <dd>{item.requesterName ?? "VAULTIX member"}</dd>
                    <dt>Asked on</dt>
                    <dd>{DATE.format(new Date(item.createdAt))}</dd>
                    {item.note ? (
                      <>
                        <dt>Note</dt>
                        <dd>{item.note}</dd>
                      </>
                    ) : null}
                  </dl>
                  {item.category === "campus" ? (
                    <label className="draft-form__choice">
                      <input
                        type="checkbox"
                        checked={d.openRegion}
                        onChange={(event) => patch(item.id, { openRegion: event.target.checked })}
                      />
                      Open this campus for requests now (otherwise it is added as coming soon)
                    </label>
                  ) : null}
                  <div className="form-field">
                    <label className="form-field__label" htmlFor={`entry-note-${item.id}`}>
                      Note to the member <span className="form-field__required">(optional)</span>
                    </label>
                    <textarea
                      className="form-field__input"
                      id={`entry-note-${item.id}`}
                      rows={2}
                      maxLength={500}
                      value={d.note}
                      onChange={(event) => patch(item.id, { note: event.target.value })}
                    />
                  </div>
                  <div className="locker-card__actions">
                    <button
                      type="button"
                      className="button button--primary button--compact"
                      disabled={busy !== null || item.ownRequest === true}
                      aria-describedby={item.ownRequest ? `entry-own-${item.id}` : undefined}
                      onClick={() => void decideEntry(item, true)}
                    >
                      Add to the list
                    </button>
                    <button
                      type="button"
                      className="button button--danger-outline button--compact"
                      disabled={busy !== null || item.ownRequest === true}
                      aria-describedby={item.ownRequest ? `entry-own-${item.id}` : undefined}
                      onClick={() => void decideEntry(item, false)}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="bounty-releases-heading">
        <h2 id="bounty-releases-heading">Bounty releases</h2>
        <p className="page-head__lede">
          The poster of a paid missing item or discussion names the member who helped. Approving
          creates a payout task for the Owner; no money moves until the Owner records the payout.
        </p>
        {openReleases === null ? (
          <UiStatus kind="offline" heading="Bounty releases could not be loaded" />
        ) : openReleases.length === 0 ? (
          <UiStatus kind="empty" heading="No bounty releases waiting" />
        ) : (
          <ul className="appeal-list">
            {openReleases.map((item) => (
              <li className="locker-card appeal-card" key={item.id}>
                <p className="pixel-label">
                  {item.wanted.kind === "missing_item" ? "Missing item" : "Discussion"}
                </p>
                {item.viewerIsParty ? (
                  <p className="ops-alert ops-alert--info" id={`release-party-${item.id}`}>
                    You are the poster or the named helper, so another Sheriff or the Owner decides
                    this release.
                  </p>
                ) : null}
                <h3 className="ops-panel__title">
                  <Link href={`/wanted/${item.wanted.id}`}>{item.wanted.title}</Link>
                </h3>
                <dl className="index-grid">
                  <dt>Bounty</dt>
                  <dd className="numeric">{formatRinggit(item.bountySen)}</dd>
                  <dt>Poster</dt>
                  <dd className="cluster">
                    <Avatar src={item.requester.avatarUrl} size={24} />
                    <Link href={`/u/${item.requester.publicId}`}>{item.requester.displayName}</Link>
                  </dd>
                  <dt>Named as helper</dt>
                  <dd className="cluster">
                    <Avatar src={item.finder.avatarUrl} size={24} />
                    <Link href={`/u/${item.finder.publicId}`}>{item.finder.displayName}</Link>
                  </dd>
                  {item.note ? (
                    <>
                      <dt>Poster&rsquo;s note</dt>
                      <dd>{item.note}</dd>
                    </>
                  ) : null}
                </dl>
                <div className="form-field">
                  <label className="form-field__label" htmlFor={`release-note-${item.id}`}>
                    Decision note <span className="form-field__required">(optional)</span>
                  </label>
                  <textarea
                    className="form-field__input"
                    id={`release-note-${item.id}`}
                    rows={2}
                    maxLength={500}
                    value={draft(item.id).note}
                    onChange={(event) => patch(item.id, { note: event.target.value })}
                  />
                </div>
                <div className="locker-card__actions">
                  <button
                    type="button"
                    className="button button--primary button--compact"
                    disabled={busy !== null || item.viewerIsParty}
                    aria-describedby={item.viewerIsParty ? `release-party-${item.id}` : undefined}
                    onClick={() => void decideRelease(item, true)}
                  >
                    Approve release
                  </button>
                  <button
                    type="button"
                    className="button button--danger-outline button--compact"
                    disabled={busy !== null || item.viewerIsParty}
                    aria-describedby={item.viewerIsParty ? `release-party-${item.id}` : undefined}
                    onClick={() => void decideRelease(item, false)}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
