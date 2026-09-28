import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { MapPin, X, ChevronDown, Check } from 'lucide-react-native';
import { Colors, BorderRadius } from '@/constants/Theme';
import { useProjects } from '@/lib/projects';
import type { Project } from '@/types/database';

interface HeaderProps {
  projects?: Project[];
  selectedProjectId?: string;
  onSelectProject?: (project: Project) => void;
}

const LOGO_URL = 'https://csy.mx/wp-content/uploads/2024/03/Logo-CSY-Cabo-Systems-White-Hz.svg';

const ORANGE = Colors.primary;
const DARK_BG = 'rgba(0, 0, 0, 0.65)';
const DARK_BORDER = 'rgba(255, 255, 255, 0.08)';

export const HEADER_BASE_HEIGHT = 68;

export function useHeaderHeight() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const baseHeight = width >= 768 ? 70 : 64;
  return insets.top + baseHeight;
}

export function HeaderCaboSystems({
  projects: propProjects,
  selectedProjectId: propSelectedProjectId,
  onSelectProject: propOnSelectProject,
}: HeaderProps = {}) {
  const context = useProjects();
  const projects = propProjects ?? context.projects;
  const selectedProjectId = propSelectedProjectId ?? context.selectedProjectId;
  const onSelectProject = propOnSelectProject ?? context.setSelectedProject;

  const [visible, setVisible] = useState(false);
  const [isSelectorHovered, setIsSelectorHovered] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const grouped = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const project of projects) {
      const key = project.desarrollo;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(project);
    }
    return Array.from(map.entries());
  }, [projects]);

  const selected = projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const displayCode = selected?.villa || selected?.unidad || 'Sin villa';

  return (
    <View style={styles.headerWrapper}>
      <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
      <View style={styles.overlayBackground} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.container, isTablet && styles.containerTablet]}>
          <View style={styles.logoGroup}>
            <Image
              source={{ uri: LOGO_URL }}
              style={[styles.logo, isTablet && styles.logoTablet]}
              contentFit="contain"
              priority="high"
            />
            <Text style={[styles.logoSubtext, isTablet && styles.logoSubtextTablet]}>Field Service</Text>
          </View>

          {projects.length > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.selector,
                isTablet && styles.selectorTablet,
                isSelectorHovered && styles.selectorHovered,
                pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
              ]}
              onHoverIn={() => setIsSelectorHovered(true)}
              onHoverOut={() => setIsSelectorHovered(false)}
              onPress={() => setVisible(true)}
            >
              <MapPin color={ORANGE} size={isTablet ? 16 : 16} strokeWidth={2.5} />
              <Text style={[styles.selectorText, isTablet && styles.selectorTextTablet]} numberOfLines={1}>
                {displayCode}
              </Text>
              <ChevronDown color="#FFFFFF" size={isTablet ? 14 : 14} strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar villa</Text>
              <Pressable onPress={() => setVisible(false)} style={styles.modalClose}>
                <X color="#343e48" size={20} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {grouped.map(([desarrollo, units]) => (
                <View key={desarrollo} style={styles.devSection}>
                  <Text style={styles.devName}>{desarrollo}</Text>
                  {units.map((unit) => {
                    const isSelected = unit.id === selected?.id;
                    const unitName = unit.villa || unit.unidad;
                    return (
                      <Pressable
                        key={unit.id}
                        style={({ pressed }) => [
                          styles.unitRow,
                          isSelected && styles.unitRowSelected,
                          pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => {
                          onSelectProject?.(unit);
                          setVisible(false);
                        }}
                      >
                        <Text style={[styles.unitCode, isSelected && styles.unitCodeSelected]}>
                          {unitName}
                        </Text>
                        {isSelected && <Check color={ORANGE} size={16} strokeWidth={2.5} />}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    borderBottomWidth: 1,
    borderBottomColor: DARK_BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  overlayBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: DARK_BG,
  },
  safeArea: {
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 64,
    minHeight: 64,
  },
  containerTablet: {
    paddingHorizontal: 24,
    height: 70,
    minHeight: 70,
  },
  logoGroup: {
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 30,
  },
  logoTablet: {
    width: 140,
    height: 32,
  },
  logoSubtext: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 9,
    color: '#FFFFFF',
    letterSpacing: 3,
    marginTop: 2,
  },
  logoSubtextTablet: {
    fontSize: 9,
    letterSpacing: 3,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  selectorTablet: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  selectorHovered: {
    backgroundColor: 'rgba(247, 140, 38, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(247, 140, 38, 0.4)',
    transform: [{ scale: 1.02 }],
  },
  selectorText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  selectorTextTablet: {
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxHeight: '60%',
    backgroundColor: '#111111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DARK_BORDER,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: DARK_BORDER,
  },
  modalTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  modalClose: {
    padding: 4,
  },
  devSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  devName: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  unitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  unitRowSelected: {
    backgroundColor: 'rgba(247, 140, 38, 0.15)',
    borderWidth: 1,
    borderColor: ORANGE,
  },
  unitCode: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  unitCodeSelected: {
    color: ORANGE,
  },
});
