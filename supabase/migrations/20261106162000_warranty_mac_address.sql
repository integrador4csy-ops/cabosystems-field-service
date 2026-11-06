alter table public.warranty_cases
  add column mac_address text
  check (mac_address is null or length(btrim(mac_address)) between 1 and 64);

comment on column public.warranty_cases.mac_address is
  'Optional device MAC address recorded for the warranty case.';
