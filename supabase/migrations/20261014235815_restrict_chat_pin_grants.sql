-- Remove broad default grants; the client only needs these three operations.
revoke all on public.chat_pins from public, anon, authenticated;
grant select, insert, delete on public.chat_pins to authenticated;
