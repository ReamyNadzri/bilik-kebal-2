-- Description floor lowered from 20 to 10 characters (user, 2 October 2026).
alter table public.wanted_requests drop constraint wanted_requests_description_check;
alter table public.wanted_requests add constraint wanted_requests_description_check check (
  char_length(description) between 10 and 2000 and description = trim(description)
);
