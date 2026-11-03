-- Keep all existing chat permissions; extend only the accepted message types.
ALTER TABLE public.chat_mensajes DROP CONSTRAINT chat_mensajes_tipo_check;
ALTER TABLE public.chat_mensajes ADD CONSTRAINT chat_mensajes_tipo_check
  CHECK (tipo IN ('texto', 'imagen', 'video', 'sticker', 'archivo', 'audio'));
