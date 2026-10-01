-- Migration: 202610190007_claim_file_name_rule.sql
--
-- Claim uploads still failed after 202610190006 (report, 2026-10-02: "The
-- upload could not start"). Postgres refused every claim whose file name
-- contained the digit 0 or the letter x: claims_file_name_check
-- (202609200001) was written as file_name !~ '[\\/\\x00]', which in a
-- standard-conforming string is the bracket expression [\\/\\x00] and so
-- forbids backslash, slash, "x" and "0" instead of backslash, slash and the
-- NUL character. "Screenshot 2025-04-29 121540.png" and every .docx/.xlsx
-- were refused.
--
-- The rule is now what was meant and what the app already checks
-- (claimSubmissionSchema): 1 to 255 characters, no slash, no backslash and no
-- control character. No stored file name is changed; every existing row
-- already satisfies the new rule, which is stricter only about control
-- characters.

alter table public.claims drop constraint claims_file_name_check;
-- No regex escapes this time: the slash and backslash are matched as plain
-- characters (chr(92) is the backslash), control characters by class.
alter table public.claims add constraint claims_file_name_check
  check (
    char_length(file_name) between 1 and 255
    and strpos(file_name, '/') = 0
    and strpos(file_name, chr(92)) = 0
    and file_name !~ '[[:cntrl:]]'
  );
