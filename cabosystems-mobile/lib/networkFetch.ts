/** Bound stalled requests and preserve caller cancellation, including uploads. */
export const networkFetch: typeof fetch = async (input, options) => {
  const controller = new AbortController();
  const signal = options?.signal || (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 60_000);
  try { return await fetch(input, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
};
