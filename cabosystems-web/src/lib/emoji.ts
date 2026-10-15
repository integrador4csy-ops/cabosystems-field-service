export interface EmojiPart {
  type: 'emoji' | 'text';
  value: string;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const emojiSequence = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*|\u{1F3F4}[\u{E0020}-\u{E007E}]+\u{E007F})$/u;

export function isEmojiGrapheme(value: string): boolean {
  // A text-presentation selector and bare copyright/trademark symbols are ordinary text.
  return !value.includes('\uFE0E') && !/^[©®™]$/.test(value) && emojiSequence.test(value);
}

export function emojiToCode(value: string): string {
  return Array.from(value).filter((character) => character !== '\uFE0F')
    .map((character) => character.codePointAt(0)!.toString(16)).join('-');
}

export function splitEmojiText(text: string): EmojiPart[] {
  const parts: EmojiPart[] = [];
  for (const { segment } of graphemes.segment(text)) {
    const type = isEmojiGrapheme(segment) ? 'emoji' : 'text';
    const previous = parts.at(-1);
    if (type === 'text' && previous?.type === 'text') previous.value += segment;
    else parts.push({ type, value: segment });
  }
  return parts;
}

export function getEmojiOnlyCount(text: string): number {
  const parts = splitEmojiText(text);
  if (parts.some((part) => part.type === 'text' && part.value.trim())) return 0;
  return parts.filter((part) => part.type === 'emoji').length;
}

export function getEmojiMessageSize(count: number): number {
  if (count === 1) return 72;
  if (count <= 3) return 52;
  if (count <= 6) return 36;
  return 24;
}
