import { FLUENT_EMOJI_FILES } from './fluentEmojiAssets';
import { emojiToCode } from './emoji';

// Retain only the opening grid, recent emojis and reactions. The rest belongs
// in the browser's HTTP cache, not a permanent collection of decoded bitmaps.
const prepared = new Map<string, HTMLImageElement>();
const MAX_PREPARED_IMAGES = 144;
const MAX_PREPARED_BYTES = 12 * 1024 * 1024;
let preparedBytes = 0;
let preparation: Promise<void> | undefined;

export function getFluentEmojiSource(emoji: string): string | null {
  const code = FLUENT_EMOJI_FILES.get(emojiToCode(emoji));
  return code ? `${import.meta.env.BASE_URL}emoji/fluent-3d/${code}.webp` : null;
}

export function isEmojiPrepared(source: string): boolean {
  return prepared.has(source);
}

export function prepareChatEmojis(): Promise<void> {
  return preparation ??= (async () => {
    const { EMOJI_CATALOG } = await import('./emojiCatalog');
    let recent: string[] = [];
    try {
      const stored: unknown = JSON.parse(localStorage.getItem('csy_recent_emoji_v1') || '[]');
      if (Array.isArray(stored)) recent = stored.filter((value): value is string => typeof value === 'string').slice(0, 32);
    } catch { /* Storage may be unavailable. */ }
    const priority = [...new Set([
      ...recent, '👍', '❤️', '😂', '😮', '😢', '🙏',
      ...EMOJI_CATALOG.filter((entry) => entry[4] === 'smileys').slice(0, 96).map((entry) => entry[0]),
    ].map(getFluentEmojiSource).filter((source): source is string => source !== null))];
    const prioritySources = new Set(priority);
    const sources = [...new Set([
      ...priority,
      ...EMOJI_CATALOG.map(([emoji]) => getFluentEmojiSource(emoji)).filter((source): source is string => source !== null),
    ])];
    let next = 0;
    // Bound background work instead of issuing thousands of requests at once.
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < sources.length) {
        const source = sources[next++];
        const image = new Image();
        image.decoding = 'async';
        image.fetchPriority = 'low';
        try {
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('Emoji unavailable'));
            image.src = source;
          });
          if (prioritySources.has(source)) {
            await image.decode();
            const bytes = image.naturalWidth * image.naturalHeight * 4;
            if (prepared.size < MAX_PREPARED_IMAGES && preparedBytes + bytes <= MAX_PREPARED_BYTES) {
              prepared.set(source, image);
              preparedBytes += bytes;
            }
          }
        } catch { /* A missing image keeps its native Unicode presentation. */ }
        finally { image.onload = null; image.onerror = null; }
      }
    }));
  })();
}
