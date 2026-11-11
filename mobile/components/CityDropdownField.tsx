import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable as RNPressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { PILOT_CITIES } from '@/data/herwayCatalog';
import { IconButton } from '@/components/ui/Buttons';

interface CityDropdownFieldProps {
  label?: string;
  value: string;
  onChange: (city: string) => void;
  cities?: readonly string[];
  placeholder?: string;
  customPlaceholder?: string;
  variant?: 'pill' | 'box';
}

export function CityDropdownField({
  label,
  value,
  onChange,
  cities = PILOT_CITIES,
  placeholder = 'Select city',
  customPlaceholder = 'Enter custom city name',
  variant = 'box',
}: CityDropdownFieldProps) {
  const matchedPreset = useMemo(
    () => cities.find((c) => c.toLowerCase() === value.trim().toLowerCase()),
    [cities, value],
  );

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [otherSelected, setOtherSelected] = useState(
    Boolean(value.trim()) && !matchedPreset,
  );

  const isCustomMode = otherSelected || (Boolean(value.trim()) && !matchedPreset);

  const filteredCities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.toLowerCase().includes(q));
  }, [cities, search]);

  function selectPreset(city: string) {
    setOtherSelected(false);
    onChange(city);
    setOpen(false);
    setSearch('');
  }

  function selectOther(initialText = '') {
    setOtherSelected(true);
    if (matchedPreset || !value.trim() || initialText) {
      onChange(initialText);
    }
    setOpen(false);
    setSearch('');
  }

  const displayValue = matchedPreset
    ? matchedPreset
    : isCustomMode
      ? value.trim()
        ? `Other: ${value.trim()}`
        : 'Other (custom city)'
      : placeholder;

  const hasSelection = Boolean(matchedPreset || isCustomMode);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} dropdown` : 'City dropdown'}
        style={({ pressed }) => [
          variant === 'pill' ? styles.triggerSubtle : styles.triggerBox,
          pressed && styles.triggerPressed,
        ]}
      >
        <MaterialIcons name="location-on" size={18} color={HerwayColors.tealDark} />
        <Text
          numberOfLines={1}
          style={[styles.triggerText, !hasSelection && styles.placeholderText]}
        >
          {displayValue}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={20} color={HerwayColors.muted} />
      </Pressable>

      {isCustomMode && (
        <View style={variant === 'pill' ? styles.customSubtle : styles.customBox}>
          <MaterialIcons name="edit-location-alt" size={18} color={HerwayColors.tealDark} />
          <TextInput
            value={matchedPreset ? '' : value}
            onChangeText={(txt) => {
              setOtherSelected(true);
              onChange(txt);
            }}
            placeholder={customPlaceholder}
            placeholderTextColor={HerwayColors.placeholder}
            autoFocus={!value.trim()}
            style={styles.customInput}
          />
          {Boolean(value) && (
            <IconButton
              icon="close"
              size="small"
              tone="surface"
              onPress={() => onChange('')}
              accessibilityLabel="Clear custom city"
            />
          )}
        </View>
      )}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <RNPressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <RNPressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label || 'Select city'}</Text>
              <IconButton
                icon="close"
                onPress={() => setOpen(false)}
                accessibilityLabel="Close city selector"
              />
            </View>

            <View style={styles.searchWrap}>
              <MaterialIcons name="search" size={18} color={HerwayColors.muted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search cities or type your own..."
                placeholderTextColor={HerwayColors.placeholder}
                style={styles.searchInput}
              />
            </View>

            <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
              {filteredCities.map((city) => {
                const active = matchedPreset === city && !otherSelected;
                return (
                  <Pressable
                    key={city}
                    onPress={() => selectPreset(city)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      active && styles.optionRowActive,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {city}
                    </Text>
                    {active && (
                      <MaterialIcons name="check" size={18} color={HerwayColors.tealDark} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable
              onPress={() => selectOther(filteredCities.length === 0 ? search.trim() : '')}
              style={({ pressed }) => [
                styles.optionRow,
                styles.otherOptionRow,
                isCustomMode && styles.optionRowActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.otherLabelWrap}>
                <MaterialIcons name="add-location-alt" size={18} color={HerwayColors.tealDark} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionText, { color: HerwayColors.tealDark, fontWeight: '700' }]}>
                    {filteredCities.length === 0 && search.trim()
                      ? `Other ("${search.trim()}")`
                      : 'Other (Type custom city)'}
                  </Text>
                  <Text style={styles.otherSub}>
                    Can&apos;t find your town or city? Enter it manually
                  </Text>
                </View>
              </View>
              {isCustomMode && (
                <MaterialIcons name="check" size={18} color={HerwayColors.tealDark} />
              )}
            </Pressable>
          </RNPressable>
        </RNPressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: HerwaySpacing.xs,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.ink,
    marginLeft: HerwaySpacing.xs,
  },
  triggerSubtle: {
    minHeight: HerwaySizes.inputHeight,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    paddingHorizontal: HerwaySpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  triggerBox: {
    minHeight: HerwaySizes.inputHeight,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.white,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    paddingHorizontal: HerwaySpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  triggerPressed: {
    opacity: 0.88,
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: HerwayColors.ink,
  },
  placeholderText: {
    color: HerwayColors.placeholder,
  },
  customSubtle: {
    minHeight: HerwaySizes.inputHeight,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.white,
    borderWidth: 1.5,
    borderColor: HerwayColors.teal,
    paddingHorizontal: HerwaySpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    marginTop: HerwaySpacing.xs,
  },
  customBox: {
    minHeight: HerwaySizes.inputHeight,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.white,
    borderWidth: 1.5,
    borderColor: HerwayColors.teal,
    paddingHorizontal: HerwaySpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    marginTop: HerwaySpacing.xs,
  },
  customInput: {
    flex: 1,
    fontSize: 15,
    color: HerwayColors.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : {}),
  },
  backdrop: {
    flex: 1,
    backgroundColor: HerwayColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: HerwaySpacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.modal,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    padding: HerwaySpacing.xl,
    gap: HerwaySpacing.md,
    ...HerwayShadows.card,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: HerwayColors.ink,
  },
  searchWrap: {
    height: HerwaySizes.inputMinHeight,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    paddingHorizontal: HerwaySpacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: HerwayColors.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : {}),
  },
  listScroll: {
    maxHeight: 260,
  },
  optionRow: {
    minHeight: HerwaySizes.touchTargetMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
    borderRadius: HerwayRadii.input,
  },
  optionRowActive: {
    backgroundColor: HerwayColors.mintMid,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: HerwayColors.ink,
  },
  optionTextActive: {
    fontWeight: '700',
    color: HerwayColors.tealDark,
  },
  otherOptionRow: {
    marginTop: HerwaySpacing.xs,
    borderTopWidth: HerwaySizes.borderWidth,
    borderTopColor: HerwayColors.borderSubtle,
    paddingTop: HerwaySpacing.md,
  },
  otherLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    flex: 1,
  },
  otherSub: {
    fontSize: 12,
    color: HerwayColors.muted,
    marginTop: 2,
  },
});
