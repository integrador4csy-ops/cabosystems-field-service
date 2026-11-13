import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, useWindowDimensions, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapPin, X, ChevronDown, Check } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { useProjects } from '@/lib/projects';
import type { Project } from '@/types/database';
import { ProfileNavButton } from './ProfileNavButton';
import { NotificationCenter } from './NotificationCenter';

interface HeaderProps {
  seamless?: boolean;
  selectorOnly?: boolean;
  showProjectSelector?: boolean;
  showNotificationCenter?: boolean;
  showProfileButton?: boolean;
  rightAccessory?: React.ReactNode;
  accountAccessory?: React.ReactNode;
  projects?: Project[];
  selectedProjectId?: string;
  onSelectProject?: (project: Project) => void;
  allProjectsSelected?: boolean;
  onSelectAllProjects?: () => void;
}

const LOGO_DARK = require('@/assets/images/Logo-CaboSystems-Field-Service-Dark.png');

export const HEADER_BASE_HEIGHT = 72;

export function useHeaderHeight() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const baseHeight = width >= 768 ? 78 : 72;
  return insets.top + baseHeight;
}

export const CaboSystemsHeaderLogo = React.memo(function CaboSystemsHeaderLogo({
  isTablet = false,
}: {
  isTablet?: boolean;
}) {
  return (
    <View style={styles.logoContainer}>
      {/*
        defaultSource resuelve el recurso del APK de forma síncrona en Android:
        el logo aparece en el primer frame de cada pestaña. Con expo-image la
        escenarecién visible mostraba el hueco del logo durante el primer render.
      */}
      <Image
        source={LOGO_DARK}
        defaultSource={LOGO_DARK}
        style={[styles.logo, isTablet && styles.logoTablet]}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
});

export const HeaderCaboSystems = React.memo(function HeaderCaboSystems({
  seamless = false,
  selectorOnly = false,
  showProjectSelector = true,
  showNotificationCenter = true,
  showProfileButton = true,
  rightAccessory,
  accountAccessory,
  projects: propProjects,
  selectedProjectId: propSelectedProjectId,
  onSelectProject: propOnSelectProject,
  allProjectsSelected = false,
  onSelectAllProjects,
}: HeaderProps = {}) {
  const { t: tr } = useInterfaceTranslation();
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

  const selected = allProjectsSelected ? undefined : projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const displayCode = allProjectsSelected ? tr("Todas las villas") : selected?.villa || selected?.unidad || tr("Sin villa");

  return (
    <View style={selectorOnly ? styles.selectorOnlyWrapper : [styles.headerWrapper, seamless && styles.headerSeamless]}>
      <SafeAreaView edges={selectorOnly ? [] : ['top']} style={selectorOnly ? styles.selectorOnlySafeArea : styles.safeArea}>
        <View style={[styles.container, isTablet && styles.containerTablet, selectorOnly && styles.selectorOnlyContainer]}>
          {/* Logo Minimalista CSY en Modo Claro */}
          {!selectorOnly && <CaboSystemsHeaderLogo isTablet={isTablet} />}

          {/* Selector de Villa Minimalista */}
          {showProjectSelector && projects.length > 0 && (
            <Pressable
              style={({ pressed }) => [
                styles.selector,
                allProjectsSelected && styles.selectorAll,
                isTablet && styles.selectorTablet,
                selected && styles.selectorActive,
                selectorOnly && styles.selectorOnlyButton,
                pressed && (selected ? styles.selectorActivePressed : styles.selectorPressed),
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={tr('Filtrar por villa: {value0}', {value0: displayCode})}
              accessibilityState={{ expanded: visible }}
              onPress={() => setVisible(true)}
            >
              {!selectorOnly && <View style={[styles.selectorPinBox, selected && styles.selectorPinBoxActive]}>
                <MapPin color={Colors.brandSlate} size={14} strokeWidth={2.5} />
              </View>}
              <Text
                style={[
                  styles.selectorText,
                  isTablet && styles.selectorTextTablet,
                  selected && styles.selectorTextActive,
                  selectorOnly && styles.selectorOnlyText,
                ]}
                numberOfLines={selectorOnly ? 1 : allProjectsSelected ? 2 : 1}
                adjustsFontSizeToFit={selectorOnly}
                minimumFontScale={0.8}
              >
                {displayCode}
              </Text>
              <ChevronDown color={Colors.primary} size={14} strokeWidth={2.2} />
            </Pressable>
          )}
          {!selectorOnly && (
            <View style={styles.accountActions}>
              {rightAccessory}
              {accountAccessory ? accountAccessory : showNotificationCenter ? <NotificationCenter /> : null}
              {showProfileButton ? <ProfileNavButton /> : null}
            </View>
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
                <Text style={styles.modalTitle}>{tr("Ubicación Activa")}</Text>
                <Text style={styles.modalSubtitle}>{tr("Selecciona el desarrollo o villa a operar")}</Text>
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
              {onSelectAllProjects ? <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: allProjectsSelected }}
                style={[styles.unitRow, allProjectsSelected && styles.unitRowSelected]}
                onPress={() => { onSelectAllProjects(); setVisible(false); }}
              >
                <Text style={[styles.unitCode, allProjectsSelected && styles.unitCodeSelected]}>{tr("Todas las villas")}</Text>
                {allProjectsSelected ? <Check color="#FFFFFF" size={16} /> : null}
              </Pressable> : null}
              {grouped.map(([desarrollo, units]) => (
                <View key={desarrollo} style={styles.devSection}>
                  <Text style={styles.devName}>{desarrollo}</Text>
                  {units.map((unit) => {
                    const isSelected = unit.id === selected?.id;
                    const unitName = unit.villa || unit.unidad;
                    return (
                      <Pressable
                        key={unit.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
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
});

const styles = StyleSheet.create({
  selectorOnlyWrapper: { flex: 1, minWidth: 0 },
  selectorOnlySafeArea: { backgroundColor: 'transparent' },
  selectorOnlyContainer: { height: 44, minHeight: 44, paddingLeft: 0, paddingRight: 0 },
  selectorOnlyButton: { flex: 1, width: '100%', maxWidth: '100%', minHeight: 44, paddingHorizontal: 8, borderRadius: 10, gap: 4 },
  selectorOnlyText: { flex: 1, maxWidth: '100%', fontFamily: 'Outfit_500Medium', fontSize: 12 },
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
  headerSeamless: {
    borderBottomWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    boxShadow: 'none',
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
    width: 162,
    height: 54,
    justifyContent: 'center',
    alignItems: 'flex-start',
    transform: [{ translateY: -3 }],
  },
  logo: {
    width: 162,
    height: 54,
  },
  logoTablet: {
    width: 180,
    height: 60,
  },
  selector: {
    flexShrink: 1,
    maxWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.xs,
  },
  selectorTablet: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  selectorAll: {
    width: '48%',
    minHeight: 44,
  },
  selectorPressed: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderColor: Colors.brandSlate,
    opacity: 0.9,
  },
  selectorActive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(0,0,0,0.12)',
    ...Shadow.xs,
  },
  selectorActivePressed: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderColor: Colors.brandSlate,
    opacity: 0.9,
  },
  selectorPinBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectorPinBoxActive: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  selectorText: {
    flexShrink: 1,
    fontFamily: 'Outfit_700Bold',
    fontSize: 13.5,
    color: Colors.text,
    letterSpacing: 0.2,
    maxWidth: 140,
  },
  selectorTextActive: {
    color: Colors.brandSlate,
  },
  selectorTextTablet: {
    fontSize: 14,
    maxWidth: 220,
  },
  accountActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
