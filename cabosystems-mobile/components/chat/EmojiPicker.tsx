import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as SecureStore from 'expo-secure-store';
import { Clock, Smile, Hand, Leaf, Coffee, Car, Volleyball, Lightbulb, Hash, Flag, Search } from 'lucide-react-native';
import { ChatPalette as P } from '@/constants/Theme';
import { useTranslation } from '@/lib/i18n';
import { CHAT_COPY } from '@/lib/chatCopy';
import { EMOJI_CATALOG, type EmojiCategory } from '@/lib/emojiCatalog';
import { emojiToCode } from '@/lib/chatEmoji';
import { FluentEmoji } from './FluentEmoji';

type Entry = typeof EMOJI_CATALOG[number];
const categories = [ ['recent', Clock], ['smileys', Smile], ['people', Hand], ['nature', Leaf], ['food', Coffee], ['travel', Car], ['activities', Volleyball], ['objects', Lightbulb], ['symbols', Hash], ['flags', Flag] ] as const;
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const indexed = EMOJI_CATALOG.map((entry) => ({ entry, search: normalize(entry.slice(0, 4).join(' ')) }));
const byCode = new Map(EMOJI_CATALOG.map((entry) => [emojiToCode(entry[0]), entry]));
const recentKey = 'csy_recent_emoji_v1';
const keyExtractor = (entry: Entry) => entry[0];

export default function EmojiPicker({ onSelect, height = 380, categoriesPlacement = 'bottom', disabled = false }: { onSelect: (emoji: string) => void; height?: number; categoriesPlacement?: 'top' | 'bottom'; disabled?: boolean }) {
  const { language } = useTranslation();
  const c = CHAT_COPY[language];
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EmojiCategory | 'recent'>('smileys');
  const [recent, setRecent] = useState<string[]>([]);
  const list = useRef<FlashListRef<Entry>>(null);
  useEffect(() => {
    let active = true;
    const read = async () => {
      try {
        const stored = Platform.OS === 'web' ? localStorage.getItem(recentKey) : await SecureStore.getItemAsync(recentKey);
        const parsed: unknown = JSON.parse(stored || '[]');
        if (active && Array.isArray(parsed)) setRecent(parsed.filter((value): value is string => typeof value === 'string' && byCode.has(value)).slice(0, 16));
      } catch { /* Emoji selection works even with unavailable local storage. */ }
    };
    void read();
    return () => { active = false; };
  }, []);
  const entries = useMemo(() => {
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (terms.length) return indexed.filter(({ search }) => terms.every((term) => search.includes(term))).map(({ entry }) => entry);
    if (category === 'recent') return recent.flatMap((code) => { const entry = byCode.get(code); return entry ? [entry] : []; });
    return EMOJI_CATALOG.filter((entry) => entry[4] === category);
  }, [query, category, recent]);
  const choose = useCallback((emoji: string) => {
    const code = emojiToCode(emoji);
    const codes = [code, ...recent.filter((value) => value !== code)].slice(0, 16);
    setRecent(codes);
    const save = async () => {
      try {
        if (Platform.OS === 'web') localStorage.setItem(recentKey, JSON.stringify(codes));
        else await SecureStore.setItemAsync(recentKey, JSON.stringify(codes));
      } catch { /* A storage failure must never prevent insertion. */ }
    };
    if (!disabled) { void save(); onSelect(emoji); }
  }, [recent, onSelect, disabled]);
  const renderEmoji = useCallback(({ item }: { item: Entry }) => <EmojiCell emoji={item[0]} label={language === 'es' ? item[1] : item[2]} onSelect={choose} disabled={disabled} />, [language, choose, disabled]);
  const categoryBar = <View style={[styles.categories, categoriesPlacement === 'bottom' && styles.categoriesBottom]} accessibilityLabel={c.picker}>
      {categories.map(([key, Icon]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={c[key]} accessibilityState={{ selected: !query && key === category }}
        style={[styles.category, !query && key === category && styles.selected]} onPress={() => { setCategory(key); setQuery(''); list.current?.scrollToOffset({ offset: 0, animated: false }); }}>
        <Icon size={19} color={!query && key === category ? P.accent : P.muted} />
      </Pressable>)}
    </View>;
  return <View style={[styles.picker, { height }]}>
    {categoriesPlacement === 'top' ? categoryBar : null}
    <View style={styles.search}><Search size={18} color={P.muted} /><TextInput accessibilityLabel={c.search} placeholder={c.search} placeholderTextColor={P.muted} value={query}
      onChangeText={(value) => { setQuery(value); list.current?.scrollToOffset({ offset: 0, animated: false }); }} autoCorrect={false} style={styles.searchInput} /></View>
    <View style={styles.section}><Text style={styles.sectionText}>{query ? c.results : c[category]}</Text><Text style={styles.count}>{entries.length}</Text></View>
    <FlashList ref={list} data={entries} numColumns={8} renderItem={renderEmoji} keyExtractor={keyExtractor} extraData={language} keyboardShouldPersistTaps="handled"
      ListEmptyComponent={<Text style={styles.empty}>{category === 'recent' && !query ? c.recentEmpty : c.empty}</Text>} />
    {categoriesPlacement === 'bottom' ? categoryBar : null}
  </View>;
}
const EmojiCell = memo(function EmojiCell({ emoji, label, onSelect, disabled }: { emoji: string; label: string; onSelect: (emoji: string) => void; disabled: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} style={({ pressed }) => [styles.cell, pressed && styles.pressed]} onPress={() => onSelect(emoji)}><FluentEmoji emoji={emoji} size={30} /></Pressable>;
});
const styles = StyleSheet.create({
  categoriesBottom: { marginBottom: 0, marginTop: 8, borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: P.line },
  picker: { height: 380, flexShrink: 1 }, categories: { flexDirection: 'row', borderBottomWidth: 1, borderColor: P.line, marginBottom: 12 }, category: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' }, selected: { borderBottomColor: P.accent },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: P.line, borderRadius: 8, paddingHorizontal: 12 }, searchInput: { flex: 1, minHeight: 44, fontFamily: 'Outfit_400Regular', fontSize: 14, color: P.ink },
  section: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }, sectionText: { fontFamily: 'Outfit_600SemiBold', color: P.slate, fontSize: 12 }, count: { color: P.muted, fontFamily: 'Outfit_400Regular', fontSize: 12 }, cell: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, pressed: { backgroundColor: P.wash }, empty: { color: P.muted, textAlign: 'center', paddingVertical: 32, fontFamily: 'Outfit_400Regular' },
});
