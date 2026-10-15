import { Image, type ImageRef } from 'expo-image';
import { EMOJI_CATALOG } from './emojiCatalog';
import { FLUENT_EMOJI_ASSETS } from './fluentEmojiAssets';
import { emojiToCode } from './chatEmoji';
import type { ChatSticker } from '@/types/database';

// Keep only a small initial screen decoded; the rest stays virtualized.
const prepared = new Map<string, ImageRef>();
const jobs = new Map<string, Promise<void>>();
const stickerImages = new Set<string>();
export function getPreparedEmoji(emoji: string) { return prepared.get(emoji); }

export async function prepareChatEmojis() {
  const initial = [...new Set(['👍', '❤️', '😂', '😮', '😢', '🙏', ...EMOJI_CATALOG.filter((entry) => entry[4] === 'smileys').slice(0, 32).map((entry) => entry[0])])];
  let index = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < initial.length) {
      const emoji = initial[index++];
      const source = FLUENT_EMOJI_ASSETS[emojiToCode(emoji)];
      if (!source || prepared.has(emoji)) continue;
      let job = jobs.get(emoji);
      if (!job) {
        job = Image.loadAsync(source, { maxWidth: 128, maxHeight: 128 }).then((image) => { prepared.set(emoji, image); }).catch(() => {}).finally(() => { jobs.delete(emoji); });
        jobs.set(emoji, job);
      }
      await job;
    }
  }));
}

export function warmStickerImages(items: ChatSticker[]) {
  const first = items.slice(0, 24).map((item) => item.url).filter((url) => !stickerImages.has(url));
  first.forEach((url) => stickerImages.add(url));
  let index = 0;
  return Promise.all(Array.from({ length: 4 }, async () => {
    while (index < first.length) {
      const url = first[index++];
      try { if (!await Image.prefetch(url, 'memory-disk')) stickerImages.delete(url); }
      catch { stickerImages.delete(url); }
    }
  })).then(() => {});
}
