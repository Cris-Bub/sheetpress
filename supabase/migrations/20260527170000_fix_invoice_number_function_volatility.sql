-- Supabase db lint correctly flags `to_char(date, text)` as STABLE, not
-- IMMUTABLE. The formatter is deterministic for our purposes, but Postgres
-- should not be told it is stronger than its constituent functions.

create or replace function public.format_invoice_number(
  p_format text,
  p_counter int,
  p_when date default current_date
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out text := p_format;
  v_hash_match text;
  v_hash_len int;
begin
  v_out := replace(v_out, '{YYYY}', to_char(p_when, 'YYYY'));
  v_out := replace(v_out, '{YY}', to_char(p_when, 'YY'));
  v_out := replace(v_out, '{MM}', to_char(p_when, 'MM'));
  v_hash_match := substring(v_out from '\{(#+)\}');
  if v_hash_match is not null then
    v_hash_len := length(v_hash_match);
    v_out := regexp_replace(v_out, '\{#+\}', lpad(p_counter::text, v_hash_len, '0'), 'g');
  end if;
  return v_out;
end;
$$;
revoke all on function public.format_invoice_number(text, int, date) from public;
grant execute on function public.format_invoice_number(text, int, date) to authenticated;
