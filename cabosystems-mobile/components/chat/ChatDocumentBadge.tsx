import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileImage,
  FileCode,
} from 'lucide-react-native';
import type { DocumentInfo } from '@/lib/chatDocumentTypes';

export const ChatDocumentBadge = memo(function ChatDocumentBadge({
  info,
  size = 42,
  outgoing = false,
}: {
  info: DocumentInfo;
  size?: number;
  outgoing?: boolean;
}) {
  const iconSize = Math.round(size * 0.44);

  const renderIcon = () => {
    switch (info.category) {
      case 'excel':
        return <FileSpreadsheet size={iconSize} color={info.primaryColor} />;
      case 'archive':
        return <FileArchive size={iconSize} color={info.primaryColor} />;
      case 'image':
        return <FileImage size={iconSize} color={info.primaryColor} />;
      case 'text':
        return <FileCode size={iconSize} color={info.primaryColor} />;
      case 'pdf':
      case 'word':
      case 'powerpoint':
      case 'generic':
      default:
        return <FileText size={iconSize} color={info.primaryColor} />;
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor: outgoing ? '#FFFFFF' : info.bgColor,
          borderColor: info.borderColor,
        },
      ]}
    >
      <View style={styles.iconWrapper}>
        {renderIcon()}
      </View>
      <View style={[styles.pill, { backgroundColor: info.primaryColor }]}>
        <Text style={styles.pillText} numberOfLines={1}>
          {info.badgeLabel}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 7.5,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
