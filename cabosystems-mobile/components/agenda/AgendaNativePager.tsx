import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { agendaPagerPages } from '@/lib/agendaPagerPages';
import type { CompanyView } from '@/lib/companyAgenda';

type Page = ReturnType<typeof agendaPagerPages>[number];
const pageKey = (page: Page) => page.anchor;

/** Native paging keeps the next swipe independent of React's period/title update. */
export function AgendaNativePager({ anchor, pagePosition, view, enabled, renderPage, onMove, style }: {
  anchor: string; pagePosition: number; view: CompanyView; enabled: boolean; style?: StyleProp<ViewStyle>;
  renderPage: (anchor: string) => React.ReactElement;
  onMove: (direction: number, position: number, anchor: string) => void;
}) {
  // Parent changes this component's key only for an external date/view change.
  const base = useRef({ anchor, position: pagePosition }).current;
  const pages = useMemo(() => agendaPagerPages(base.anchor, view).map(page => ({ ...page, position: page.position + base.position })), [base, view]);
  const initialIndex = pages.findIndex(page => page.position === base.position);
  const selected = useRef(initialIndex);
  const alive = useRef(true);
  const list = useRef<FlatList<Page>>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const scrollIndex = useMemo(() => selected.current, [size.width]);
  const itemLayout = useCallback((_data: ArrayLike<Page> | null | undefined, index: number) => ({ length: size.width, offset: size.width * index, index }), [size.width]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!enabled && size.width) list.current?.scrollToIndex({ index: selected.current, animated: false });
  }, [enabled, size.width]);
  const renderItem = useCallback(({ item }: { item: Page }) => <View style={{ width: size.width, height: size.height }}>{renderPage(item.anchor)}</View>, [renderPage, size]);
  const settle = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!enabled || !alive.current || !size.width) return;
    const index = Math.max(0, Math.min(pages.length - 1, Math.round(event.nativeEvent.contentOffset.x / size.width)));
    if (index === selected.current) return;
    const previous = pages[selected.current].position;
    selected.current = index;
    onMove(pages[index].position - previous, pages[index].position, pages[index].anchor);
  }, [enabled, size.width, pages, onMove]);
  return <View testID="agenda-native-pager" style={[style, s.viewport]} onLayout={event => {
    const { width, height } = event.nativeEvent.layout;
    setSize(current => current.width === width && current.height === height ? current : { width, height });
  }}>
    {size.width > 0 && size.height > 0 ? <FlatList
      key={size.width} ref={list} testID="agenda-native-pages"
      horizontal pagingEnabled directionalLockEnabled nestedScrollEnabled
      scrollEnabled={enabled} showsHorizontalScrollIndicator={false}
      data={pages} keyExtractor={pageKey}
      initialScrollIndex={scrollIndex} getItemLayout={itemLayout}
      renderItem={renderItem} onMomentumScrollEnd={settle}
      initialNumToRender={3} maxToRenderPerBatch={1} windowSize={5}
      updateCellsBatchingPeriod={32} removeClippedSubviews={false}
    /> : null}
  </View>;
}

const s = StyleSheet.create({ viewport: { overflow: 'hidden' } });
