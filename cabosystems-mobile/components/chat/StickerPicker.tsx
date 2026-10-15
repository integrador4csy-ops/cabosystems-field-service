import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { FolderDown, Search } from 'lucide-react-native';
import { ChatPalette as P } from '@/constants/Theme';
import { useTranslation } from '@/lib/i18n';
import { CHAT_COPY } from '@/lib/chatCopy';
import { uploadSticker } from '@/lib/chatApi';
import { stickerLibrary, useStickerLibrary } from '@/lib/stickerLibrary';
import { pickDocumentSafe } from '@/lib/mediaPicker';
import type { ChatSticker } from '@/types/database';

const keyExtractor = (item: ChatSticker) => item.id;
export default function StickerPicker({ userId, onSelect, disabled = false }: { userId: string; onSelect: (url: string) => void; disabled?: boolean }) {
  const { language } = useTranslation(); const c = CHAT_COPY[language];
  const library = useStickerLibrary(userId);
  const stickers = library.items || [];
  const loading = library.items === null && !library.error;
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(false);
  const filtered = useMemo(() => stickers.filter((item) => `${item.nombre || ''} ${item.pack_name}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [stickers, query]);
  const importSticker = async () => {
    if (importing) return;
    setImporting(true); setError(false);
    try {
      const file = await pickDocumentSafe({ type: ['image/webp', 'image/png'] });
      if (file) { const item = await uploadSticker(userId, file.uri, file.name); await stickerLibrary.add(userId, item); }
    } catch { setError(true); }
    finally { setImporting(false); }
  };
  const renderSticker = useCallback(({ item }: { item: ChatSticker }) => <Pressable accessibilityRole="button" accessibilityLabel={item.nombre || c.sticker} disabled={disabled || importing} onPress={() => onSelect(item.url)} style={styles.cell}><Image source={{ uri: item.url }} style={styles.image} contentFit="contain" cachePolicy="memory-disk" recyclingKey={item.id} /></Pressable>, [c.sticker, disabled, importing, onSelect]);
  return <View style={styles.container}>
    <View style={styles.search}><Search size={18} color={P.muted} /><TextInput accessibilityLabel={c.searchStickers} placeholder={c.searchStickers} placeholderTextColor={P.muted} value={query} onChangeText={setQuery} style={styles.input} /></View>
    <Pressable accessibilityRole="button" onPress={() => void importSticker()} disabled={importing || disabled} style={styles.import}>
      {importing ? <ActivityIndicator size="small" color={P.slate} /> : <FolderDown size={18} color={P.slate} />}<Text style={styles.label}>{c.importSticker}</Text>
    </Pressable>
    {error || (library.error && library.items === null) ? <Text accessibilityRole="alert" style={styles.empty}>{c.failed}</Text> : null}
    {loading ? <ActivityIndicator style={styles.loading} color={P.accent} /> : <FlashList data={filtered} keyExtractor={keyExtractor} renderItem={renderSticker} numColumns={4} keyboardShouldPersistTaps="handled" ListEmptyComponent={<Text style={styles.empty}>{query ? c.noStickersFound : c.noStickers}</Text>} />}
  </View>;
}
const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 }, search: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: P.line, borderRadius: 8, gap: 8, paddingHorizontal: 10 }, input: { flex: 1, minHeight: 42, fontFamily: 'Outfit_400Regular', fontSize: 14, color: P.ink }, import: { minHeight: 44, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, label: { fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 12 },
  cell: { flex: 1, height: 78, alignItems: 'center', justifyContent: 'center' }, image: { width: 66, height: 66 }, empty: { fontFamily: 'Outfit_400Regular', color: P.muted, textAlign: 'center', lineHeight: 20, padding: 16, fontSize: 13 }, loading: { flex: 1 },
});
