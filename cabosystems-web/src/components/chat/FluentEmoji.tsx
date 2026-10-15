import { Fragment, useState } from 'react';
import { FLUENT_EMOJI_FILES } from '../../lib/fluentEmojiAssets';
import { emojiToCode, splitEmojiText } from '../../lib/emoji';
import './FluentEmoji.css';

export function getFluentEmojiSource(emoji: string): string | null {
  const code = FLUENT_EMOJI_FILES.get(emojiToCode(emoji));
  return code ? `${import.meta.env.BASE_URL}emoji/fluent-3d/${code}.webp` : null;
}

export function FluentEmoji({ emoji, size = 20 }: { emoji: string; size?: number }) {
  const source = getFluentEmojiSource(emoji);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!source || source === failedSource) {
    return <span className="fluent-emoji fluent-emoji-fallback" style={{ fontSize: size }}>{emoji}</span>;
  }
  return (
    <img
      src={source}
      alt={emoji}
      width={size}
      height={size}
      className="fluent-emoji"
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSource(source)}
    />
  );
}

export function EmojiText({ text, size = 20 }: { text: string; size?: number }) {
  return splitEmojiText(text).map((part, index) => part.type === 'emoji'
    ? <FluentEmoji key={`${index}-${part.value}`} emoji={part.value} size={size} />
    : <Fragment key={index}>{part.value}</Fragment>);
}
