import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';

interface InterestsSelectorFieldProps {
  label?: string;
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  variant?: 'pill' | 'box';
}

export function InterestsSelectorField({
  label = 'Travel interests',
  options,
  selected,
  onChange,
  variant = 'box',
}: InterestsSelectorFieldProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  const customTags = useMemo(
    () =>
      selected.filter(
        (tag) => !options.some((opt) => opt.toLowerCase() === tag.toLowerCase()),
      ),
    [selected, options],
  );

  function toggleInterest(tag: string) {
    const exists = selected.some((s) => s.toLowerCase() === tag.toLowerCase());
    if (exists) {
      onChange(selected.filter((s) => s.toLowerCase() !== tag.toLowerCase()));
    } else {
      onChange([...selected, tag]);
    }
  }

  function addCustomInterest() {
    const clean = customDraft.trim().replace(/\s+/g, ' ');
    if (!clean) return;
    const exists = selected.some((s) => s.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      onChange([...selected, clean]);
    }
    setCustomDraft('');
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.chipsRow}>
        {options.map((tag) => {
          const active = selected.some((s) => s.toLowerCase() === tag.toLowerCase());
          return (
            <Pressable
              key={tag}
              onPress={() => toggleInterest(tag)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{tag}</Text>
            </Pressable>
          );
        })}

        {customTags.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => toggleInterest(tag)}
            style={[styles.chip, styles.chipActive, styles.customChip]}
          >
            <Text style={[styles.chipText, styles.chipTextActive]}>{tag}</Text>
            <MaterialIcons name="close" size={14} color={HerwayColors.tealDark} />
          </Pressable>
        ))}

        <Pressable
          onPress={() => setShowCustomInput((v) => !v)}
          accessibilityLabel="Add custom interest"
          style={[styles.chip, styles.otherChip, showCustomInput && styles.chipActive]}
        >
          <MaterialIcons
            name={showCustomInput ? 'remove' : 'add'}
            size={15}
            color={HerwayColors.tealDark}
          />
          <Text style={[styles.chipText, { color: HerwayColors.tealDark, fontWeight: '700' }]}>
            Other
          </Text>
        </Pressable>
      </View>

      {showCustomInput && (
        <View style={styles.customRow}>
          <View
            style={[
              styles.customInputBox,
              variant === 'pill' && { backgroundColor: HerwayColors.inputBg },
            ]}
          >
            <TextInput
              value={customDraft}
              onChangeText={setCustomDraft}
              onSubmitEditing={addCustomInterest}
              placeholder="Type custom interest (e.g. Tea Estates)"
              placeholderTextColor={HerwayColors.placeholder}
              maxLength={40}
              autoFocus
              style={styles.customInput}
            />
          </View>
          <Pressable
            onPress={addCustomInterest}
            disabled={!customDraft.trim()}
            style={({ pressed }) => [
              styles.addBtn,
              !customDraft.trim() && styles.addBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: HerwaySpacing.sm, width: '100%' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.ink,
    marginLeft: HerwaySpacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.sm,
  },
  chip: {
    minHeight: HerwaySizes.buttonSmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
    borderRadius: HerwayRadii.pill,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    backgroundColor: HerwayColors.white,
  },
  chipActive: {
    backgroundColor: HerwayColors.tealSoft,
    borderColor: HerwayColors.teal,
  },
  customChip: {
    paddingRight: HerwaySpacing.sm,
  },
  otherChip: {
    borderStyle: 'dashed',
    borderColor: HerwayColors.teal,
    backgroundColor: HerwayColors.mintMid,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.muted,
  },
  chipTextActive: {
    color: HerwayColors.tealDark,
    fontWeight: '700',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    marginTop: HerwaySpacing.xs,
  },
  customInputBox: {
    flex: 1,
    height: HerwaySizes.inputMinHeight,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.white,
    borderWidth: 1.5,
    borderColor: HerwayColors.teal,
    paddingHorizontal: HerwaySpacing.md,
    justifyContent: 'center',
  },
  customInput: {
    fontSize: 14,
    color: HerwayColors.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : {}),
  },
  addBtn: {
    height: HerwaySizes.inputMinHeight,
    paddingHorizontal: HerwaySpacing.lg,
    borderRadius: HerwayRadii.button,
    backgroundColor: HerwayColors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: HerwayColors.white,
  },
});
