export interface EmojiPart { type: 'emoji' | 'text'; value: string }

// Hermes-safe tokenizer: does not require Intl.Segmenter on older devices.
const sequences = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\u{1F3F4}[\u{E0020}-\u{E007E}]+\u{E007F}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*|\p{Emoji_Modifier})/gu;

export function emojiToCode(value: string): string {
  return Array.from(value).filter((char) => char !== '\uFE0F').map((char) => char.codePointAt(0)!.toString(16)).join('-');
}

export function splitEmojiText(text: string): EmojiPart[] {
  const parts: EmojiPart[] = [];
  let cursor = 0;
  const appendText = (value: string) => {
    if (!value) return;
    const previous = parts[parts.length - 1];
    if (previous?.type === 'text') previous.value += value;
    else parts.push({ type: 'text', value });
  };
  for (const match of text.matchAll(sequences)) {
    const index = match.index!;
    const emoji = match[0];
    appendText(text.slice(cursor, index));
    if (/^[©®™]$/.test(emoji) || text[index + emoji.length] === '\uFE0E') appendText(emoji);
    else parts.push({ type: 'emoji', value: emoji });
    cursor = index + emoji.length;
  }
  appendText(text.slice(cursor));
  return parts;
}

export function getEmojiOnlyCount(text: string): number {
  const parts = splitEmojiText(text);
  return parts.some((part) => part.type === 'text' && part.value.trim()) ? 0 : parts.filter((part) => part.type === 'emoji').length;
}
export function getEmojiMessageSize(count: number): number { return count === 1 ? 72 : count <= 3 ? 52 : count <= 6 ? 36 : 24; }
export function insertEmoji(text: string, emoji: string, selection: { start: number; end: number }) {
  const start = Math.max(0, Math.min(text.length, selection.start));
  const end = Math.max(start, Math.min(text.length, selection.end));
  return { text: text.slice(0, start) + emoji + text.slice(end), cursor: start + emoji.length };
}
