import { EMOJI_CATALOG } from './emojiCatalog';
import { FLUENT_EMOJI_FILES } from './fluentEmojiAssets';
import { emojiToCode } from './emoji';

// Unicode evolves faster than the bundled artwork. Never offer broken glyphs
// or split ZWJ sequences in the picker; keep original message text untouched.
export const EMOJI_PICKER_CATALOG = EMOJI_CATALOG.filter(([emoji]) => FLUENT_EMOJI_FILES.has(emojiToCode(emoji)));
