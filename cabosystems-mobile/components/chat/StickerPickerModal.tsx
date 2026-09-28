import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { pickDocumentSafe } from '@/lib/mediaPicker';
import { X, Sparkles, FolderDown } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { getMyStickers, uploadSticker } from '@/lib/chatApi';
import type { ChatSticker } from '@/types/database';

interface StickerPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSticker: (stickerUrl: string) => void;
  userId: string;
}

export default function StickerPickerModal({
  visible,
  onClose,
  onSelectSticker,
  userId,
}: StickerPickerModalProps) {
  const [stickers, setStickers] = useState<ChatSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (visible && userId) {
      loadStickers();
    }
  }, [visible, userId]);

  const loadStickers = async () => {
    try {
      setLoading(true);
      const data = await getMyStickers(userId);
      setStickers(data);
    } catch (err) {
      console.error('Error loading stickers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportWhatsAppSticker = async () => {
    try {
      setImporting(true);
      const file = await pickDocumentSafe({
        type: ['image/webp', 'image/png'],
      });

      if (!file) {
        setImporting(false);
        return;
      }

      const newSticker = await uploadSticker(userId, file.uri, file.name);
      setStickers((prev) => [newSticker, ...prev]);
      Alert.alert('¡Sticker importado!', 'El sticker de WhatsApp se ha guardado en tu colección.');
    } catch (err: any) {
      console.error('Error importing sticker:', err);
      Alert.alert('Error', 'No se pudo importar el sticker. Asegúrate de que sea formato .webp.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sparkles size={18} color={Colors.primary} />
              <Text style={styles.title}>Stickers de WhatsApp</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <X size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {/* Action to import from WhatsApp */}
          <Pressable
            style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.85 }]}
            onPress={handleImportWhatsAppSticker}
            disabled={importing}
          >
            {importing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <FolderDown size={18} color="#ffffff" />
                <Text style={styles.importBtnText}>Importar Sticker de WhatsApp (.webp)</Text>
              </>
            )}
          </Pressable>

          {/* Stickers Grid */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Cargando colección...</Text>
            </View>
          ) : stickers.length === 0 ? (
            <View style={styles.emptyBox}>
              <Sparkles size={36} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Sin stickers guardados</Text>
              <Text style={styles.emptySubtitle}>
                Importa tus stickers favoritos de WhatsApp (archivos .webp) para usarlos en el chat de CaboSystems.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {stickers.map((st) => (
                <Pressable
                  key={st.id}
                  style={({ pressed }) => [
                    styles.stickerCell,
                    pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                  ]}
                  onPress={() => {
                    onSelectSticker(st.url);
                    onClose();
                  }}
                >
                  <Image source={{ uri: st.url }} style={styles.stickerImg} contentFit="contain" />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl + 20,
    maxHeight: '65%',
    minHeight: 380,
    borderTopWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    gap: 8,
    marginBottom: Spacing.md,
  },
  importBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: '#ffffff',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 20,
  },
  stickerCell: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: Colors.backgroundAlt,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
  },
  stickerImg: {
    width: '80%',
    height: '80%',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 10,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 30,
  },
  emptyTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: Colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
