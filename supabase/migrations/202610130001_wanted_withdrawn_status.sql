-- Migration: 202610130001_wanted_withdrawn_status.sql
-- A Wanted its poster withdrew in the first hour after publication.
--
-- On its own because a new enum value cannot be used in the transaction that
-- adds it; 202610130002 uses it in a check constraint and in functions.
alter type public.wanted_status add value if not exists 'withdrawn';
