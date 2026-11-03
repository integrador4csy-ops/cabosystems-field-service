import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Video, Camera, Image as ImageIcon, FileText } from 'lucide-react-native';
import { Colors } from '@/constants/Theme';
import { CHAT_COPY } from '@/lib/chatCopy';
import { useTranslation } from '@/lib/i18n';

export interface ChatAttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onRecordVideo: () => void;
  onPickMedia: () => void;
  onPickDocument: () => void;
  bottomOffset?: number;
}

export const ChatAttachmentMenu = React.memo(function ChatAttachmentMenu({
  visible,
  onClose,
  onTakePhoto,
  onRecordVideo,
  onPickMedia,
  onPickDocument,
  bottomOffset = 64,
}: ChatAttachmentMenuProps) {
  const { language } = useTranslation();
  const c = CHAT_COPY[language];
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = withSpring(1, { damping: 20, stiffness: 280, mass: 0.8 });
    } else {
      progress.value = withTiming(0, { duration: 150 });
    }
  }, [visible, progress]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 16 },
      { scale: 0.9 + 0.1 * progress.value },
    ],
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop táctil para cerrar */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={c.close}
          accessibilityRole="button"
        />

        {/* Menú anclado que emerge desde el icono hacia arriba */}
        <Animated.View
          style={[
            styles.card,
            { bottom: bottomOffset, left: 14 },
            cardAnimatedStyle,
          ]}
          accessibilityRole="menu"
        >
          {/* Opción 1: Grabar Video */}
          <Pressable
            accessibilityRole="menuitem"
            accessibilityLabel={`${c.recordVideo}, ${c.recordVideoDesc}`}
            onPress={() => {
              onClose();
              onRecordVideo();
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <View style={[styles.iconBadge, { backgroundColor: Colors.primary }]}>
              <Video size={19} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>{c.recordVideo}</Text>
              <Text style={styles.itemSubtitle}>{c.recordVideoDesc}</Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          {/* Opción 2: Tomar Foto */}
          <Pressable
            accessibilityRole="menuitem"
            accessibilityLabel={`${c.takePhoto}, ${c.takePhotoDesc}`}
            onPress={() => {
              onClose();
              onTakePhoto();
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <View style={[styles.iconBadge, { backgroundColor: Colors.success }]}>
              <Camera size={19} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>{c.takePhoto}</Text>
              <Text style={styles.itemSubtitle}>{c.takePhotoDesc}</Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          {/* Opción 3: Fotos y Videos de la Galería */}
          <Pressable
            accessibilityRole="menuitem"
            accessibilityLabel={`${c.galleryMedia}, ${c.galleryMediaDesc}`}
            onPress={() => {
              onClose();
              onPickMedia();
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <View style={[styles.iconBadge, { backgroundColor: Colors.info }]}>
              <ImageIcon size={19} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>{c.galleryMedia}</Text>
              <Text style={styles.itemSubtitle}>{c.galleryMediaDesc}</Text>
            </View>
          </Pressable>

          <View style={styles.divider} />

          {/* Opción 4: Documento */}
          <Pressable
            accessibilityRole="menuitem"
            accessibilityLabel={`${c.document}, ${c.documentDesc}`}
            onPress={() => {
              onClose();
              onPickDocument();
            }}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <View style={[styles.iconBadge, { backgroundColor: Colors.textSecondary }]}>
              <FileText size={19} color="#FFFFFF" strokeWidth={2.4} />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>{c.document}</Text>
              <Text style={styles.itemSubtitle}>{c.documentDesc}</Text>
            </View>
          </Pressable>

          {/* Indicador flecha/caret hacia el icono del clip */}
          <View style={styles.pointerArrow} />
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  card: {
    position: 'absolute',
    width: 258,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
      },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
      },
    }),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    minHeight: 52,
  },
  itemPressed: {
    backgroundColor: 'rgba(247, 140, 38, 0.08)',
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemTextContainer: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#1D2939',
    letterSpacing: -0.2,
  },
  itemSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: '#667085',
  },
  divider: {
    height: 1,
    backgroundColor: '#F2F4F7',
    marginHorizontal: 8,
  },
  pointerArrow: {
    position: 'absolute',
    bottom: -6,
    left: 28,
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E4E7EC',
  },
});
