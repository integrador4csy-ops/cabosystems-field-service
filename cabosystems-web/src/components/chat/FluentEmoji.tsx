import { Fragment, useState } from 'react';
import { splitEmojiText } from '../../lib/emoji';
import { getFluentEmojiSource, isEmojiPrepared } from '../../lib/emojiPreload';
import './FluentEmoji.css';

export { getFluentEmojiSource } from '../../lib/emojiPreload';

export function FluentEmoji({ emoji, size = 20, nativeFallback = true }: { emoji: string; size?: number; nativeFallback?: boolean }) {
  const source = getFluentEmojiSource(emoji);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  if (!source || source === failedSource) {
    if (!nativeFallback) return <span className="fluent-emoji fluent-emoji-placeholder" style={{ width: size, height: size }} aria-label={emoji} />;
    return <span className="fluent-emoji fluent-emoji-fallback" style={{ fontSize: size }}>{emoji}</span>;
  }
  return (
    <span className="fluent-emoji fluent-emoji-frame" style={{ width: size, height: size, fontSize: size }}>
    {loadedSource !== source && !isEmojiPrepared(source) && <span aria-hidden="true" className="fluent-emoji-placeholder" style={{ width: size, height: size }} />}
    <img
      src={source}
      alt={emoji}
      width={size}
      height={size}
      className="fluent-emoji"
      draggable={false}
      loading="eager"
      decoding="async"
      style={{ opacity: loadedSource === source || isEmojiPrepared(source) ? 1 : 0 }}
      onLoad={() => setLoadedSource(source)}
      onError={() => setFailedSource(source)}
    />
    </span>
  );
}

export function EmojiText({ text, size = 20 }: { text: string; size?: number }) {
  return splitEmojiText(text).map((part, index) => part.type === 'emoji'
    ? <FluentEmoji key={`${index}-${part.value}`} emoji={part.value} size={size} />
    : <Fragment key={index}>{part.value}</Fragment>);
}
