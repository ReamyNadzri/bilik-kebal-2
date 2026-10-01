-- Migration: 202610190006_claim_upload_storage.sql
--
-- Claim uploads never worked with PUBLIC_UPLOADS_ENABLED=true (report,
-- 2026-10-02: "already switched to true but appear same error").
--
--   1. The private `quarantine` bucket had no storage policy at all, so the
--      server could not sign an upload URL with the member's own session
--      (every other upload bucket has an insert-own policy). The failure came
--      back as UPLOAD_UNAVAILABLE, which the claim form words as "Uploads are
--      switched off". Members may now insert exactly the object their own open
--      upload session names, and nothing else: no read, update or delete, so
--      unreviewed files stay unreadable to members (context/architecture.md).
--   2. The failed attempt left its claim in 'uploading'. Claims are unique per
--      Wanted and file checksum, so trying the same file again failed on that
--      leftover row. A new upload session now withdraws the member's own
--      abandoned 'uploading' claim of the same file on the same Wanted: it has
--      no file, no screening and no review, and is kept, not deleted.

create function private.claim_upload_slot_is_open(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.claim_upload_sessions s
    join public.claims c on c.id = s.claim_id
    where s.object_key = object_name
      and s.completed_at is null
      and s.expires_at > now()
      and c.status = 'uploading'
      and c.hunter_user_id = private.current_user_id()
  );
$$;
revoke all on function private.claim_upload_slot_is_open(text) from public, anon;
grant execute on function private.claim_upload_slot_is_open(text) to authenticated;

create policy quarantine_insert_own_upload_slot on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'quarantine'
    and private.claim_upload_slot_is_open(name)
  );

create function private.release_abandoned_claim_upload()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.claims
  set status = 'withdrawn'
  where wanted_request_id = new.wanted_request_id
    and hunter_user_id = new.hunter_user_id
    and sha256 = new.sha256
    and status = 'uploading'
    and id <> new.id;
  return new;
end;
$$;
revoke all on function private.release_abandoned_claim_upload() from public, anon, authenticated;

create trigger claims_release_abandoned_upload
before insert on public.claims
for each row execute function private.release_abandoned_claim_upload();
