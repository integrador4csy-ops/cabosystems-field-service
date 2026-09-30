import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MapPin, X, ChevronDown, Check } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { useProjects } from '@/lib/projects';
import type { Project } from '@/types/database';

interface HeaderProps {
  projects?: Project[];
  selectedProjectId?: string;
  onSelectProject?: (project: Project) => void;
}

const LOGO_DARK = require('@/assets/images/Logo-CaboSystems-Field-Service-Dark.png');

export const HEADER_BASE_HEIGHT = 72;

export function useHeaderHeight() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const baseHeight = width >= 768 ? 78 : 72;
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
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.container, isTablet && styles.containerTablet]}>
          {/* Logo Minimalista CSY en Modo Claro */}
          <View style={styles.logoContainer}>
            <Image
              source={LOGO_DARK}
              style={[styles.logo, isTablet && styles.logoTablet]}
              contentFit="contain"
              contentPosition="left center"
              priority="high"
            />
          </View>

          {/* Selector de Villa Minimalista */}
          {projects.length > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.selector,
                isTablet && styles.selectorTablet,
                selected && styles.selectorActive,
                pressed && (selected ? styles.selectorActivePressed : styles.selectorPressed),
              ]}
              hitSlop={8}
              onPress={() => setVisible(true)}
            >
              <View style={[styles.selectorPinBox, selected && styles.selectorPinBoxActive]}>
                <MapPin color={selected ? '#FFFFFF' : Colors.primary} size={14} strokeWidth={2.5} />
              </View>
              <Text
                style={[
                  styles.selectorText,
                  isTablet && styles.selectorTextTablet,
                  selected && styles.selectorTextActive,
                ]}
                numberOfLines={1}
              >
                {displayCode}
              </Text>
              <ChevronDown color={selected ? '#FFFFFF' : Colors.textSecondary} size={14} strokeWidth={2.2} />
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      {/* Modal TailAdmin Minimalista */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Ubicación Activa</Text>
                <Text style={styles.modalSubtitle}>Selecciona el desarrollo o villa a operar</Text>
              </View>
              <Pressable
                onPress={() => setVisible(false)}
                style={({ pressed }) => [styles.modalClose, pressed && { opacity: 0.7 }]}
                hitSlop={10}
              >
                <X color={Colors.textSecondary} size={18} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalList}>
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
                          pressed && { opacity: 0.8 },
                        ]}
                        onPress={() => {
                          onSelectProject?.(unit);
                          setVisible(false);
                        }}
                      >
                        <Text style={[styles.unitCode, isSelected && styles.unitCodeSelected]}>
                          {unitName}
                        </Text>
                        {isSelected && <Check color="#FFFFFF" size={16} strokeWidth={2.8} />}
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.xs,
  },
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 10,
    paddingRight: Spacing.md,
    height: 72,
    minHeight: 72,
  },
  containerTablet: {
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xl,
    height: 78,
    minHeight: 78,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    transform: [{ translateY: -3 }],
  },
  logo: {
    width: 220,
    height: 54,
  },
  logoTablet: {
    width: 250,
    height: 60,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    ...Shadow.xs,
  },
  selectorTablet: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  selectorPressed: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.borderBrand,
    opacity: 0.9,
  },
  selectorActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadow.xs,
  },
  selectorActivePressed: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
    opacity: 0.9,
  },
  selectorPinBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorPinBoxActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  selectorText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13.5,
    color: Colors.text,
    letterSpacing: 0.2,
    maxWidth: 140,
  },
  selectorTextActive: {
    color: '#FFFFFF',
  },
  selectorTextTablet: {
    fontSize: 14,
    maxWidth: 220,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '75%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  modalSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalList: {
    paddingVertical: Spacing.xs,
  },
  devSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  devName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  unitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  unitRowSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  unitCode: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  unitCodeSelected: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
  },
});
