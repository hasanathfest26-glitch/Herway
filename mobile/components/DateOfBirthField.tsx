import React, { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { formatDobTyping, getMaxDobIso, validateDob } from '@/utils/dateOfBirth';

interface DateOfBirthFieldProps {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  format?: 'YYYY-MM-DD' | 'DD/MM/YYYY';
  variant?: 'pill' | 'box';
}

export function DateOfBirthField({
  label = 'Date of birth (optional)',
  value,
  onChange,
  format = 'YYYY-MM-DD',
  variant = 'box',
}: DateOfBirthFieldProps) {
  const [focused, setFocused] = useState(false);
  const [touched, setTouched] = useState(false);
  const webDateRef = useRef<HTMLInputElement | null>(null);

  const validation = useMemo(() => {
    if (!value.trim()) return { valid: true as const };
    return validateDob(value, format, false);
  }, [value, format]);

  const showInlineError =
    Boolean(value.trim()) && !validation.valid && (touched || value.length >= 10);

  function handleTextChange(raw: string) {
    if (format === 'YYYY-MM-DD' && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      onChange(raw.trim());
      return;
    }
    onChange(formatDobTyping(raw, format));
  }

  function openWebDatePicker() {
    if (Platform.OS !== 'web' || !webDateRef.current) return;
    if (validation.isoDate) {
      webDateRef.current.value = validation.isoDate;
    }
    if (typeof webDateRef.current.showPicker === 'function') {
      webDateRef.current.showPicker();
    } else {
      webDateRef.current.focus();
      webDateRef.current.click();
    }
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          variant === 'pill' ? styles.subtleWrap : styles.boxWrap,
          focused && styles.focusedWrap,
          showInlineError && styles.errorWrap,
        ]}
      >
        <MaterialIcons
          name="cake"
          size={18}
          color={showInlineError ? HerwayColors.danger : HerwayColors.muted}
        />

        <TextInput
          value={value}
          onChangeText={handleTextChange}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setTouched(true);
          }}
          keyboardType="number-pad"
          maxLength={10}
          placeholder={format}
          placeholderTextColor={HerwayColors.placeholder}
          accessibilityLabel={label}
          style={styles.input}
        />

        {Platform.OS === 'web' && (
          <View style={styles.webPickerAnchor}>
            <Pressable
              onPress={openWebDatePicker}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Open calendar date picker"
              style={styles.calendarBtn}
            >
              <MaterialIcons name="calendar-today" size={18} color={HerwayColors.tealDark} />
            </Pressable>
            <input
              ref={webDateRef}
              type="date"
              min="1900-01-01"
              max={getMaxDobIso(13)}
              onChange={(e) => {
                const picked = e.target.value;
                if (!picked) return;
                if (format === 'DD/MM/YYYY') {
                  const [y, m, d] = picked.split('-');
                  if (y && m && d) onChange(`${d}/${m}/${y}`);
                } else {
                  onChange(picked);
                }
                setTouched(true);
              }}
              aria-hidden="true"
              tabIndex={-1}
              style={{
                position: 'absolute',
                opacity: 0,
                width: 1,
                height: 1,
                pointerEvents: 'none',
              }}
            />
          </View>
        )}
      </View>

      {showInlineError && validation.error ? (
        <Text style={styles.errorText}>{validation.error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: HerwaySpacing.xs, width: '100%' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.ink,
    marginLeft: HerwaySpacing.xs,
  },
  subtleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    backgroundColor: HerwayColors.inputBg,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    paddingHorizontal: HerwaySpacing.lg,
    height: HerwaySizes.inputHeight,
  },
  boxWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.input,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    paddingHorizontal: HerwaySpacing.lg,
    height: HerwaySizes.inputHeight,
  },
  focusedWrap: {
    borderColor: HerwayColors.teal,
    borderWidth: 1.5,
  },
  errorWrap: {
    borderColor: HerwayColors.danger,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: HerwayColors.ink,
    height: '100%',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : {}),
  },
  webPickerAnchor: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarBtn: {
    width: HerwaySizes.buttonSmall,
    height: HerwaySizes.buttonSmall,
    borderRadius: HerwayRadii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.danger,
    marginLeft: HerwaySpacing.xs,
  },
});
