import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChatPalette as P } from '@/constants/Theme';

// Feed cells display static posters; only opening a video allocates a decoder.
export const ChatVideoPreview = memo(function ChatVideoPreview({ thumbnailUrl }: {
  url: string; thumbnailUrl?: string | null;
}) {
  return thumbnailUrl ? (
    <Image source={{ uri: thumbnailUrl }} style={StyleSheet.absoluteFill}
      contentFit="cover" cachePolicy="memory-disk" recyclingKey={thumbnailUrl} />
  ) : <View style={[StyleSheet.absoluteFill, { backgroundColor: P.slate }]} />;
});
