ALTER TABLE public.user_push_tokens
  ADD COLUMN IF NOT EXISTS chat_notification_version smallint NOT NULL DEFAULT 0
  CHECK (chat_notification_version >= 0);

COMMENT ON COLUMN public.user_push_tokens.chat_notification_version IS
  'Native Android chat notification renderer capability. Zero keeps legacy text pushes; one enables data-only MessagingStyle delivery.';
