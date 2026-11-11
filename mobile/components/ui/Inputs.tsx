import React, { useState } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
  HerwayStates,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { IconButton } from './Buttons';

interface StandardInputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null;
  helperText?: string;
  leftIcon?: keyof typeof MaterialIcons.glyphMap;
  rightSlot?: React.ReactNode;
  surface?: 'subtle' | 'white';
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
}

/**
 * Unified input field (50px height, 12px radius, 1px border, accessible focus & error states).
 */
export function StandardInput({
  label,
  error,
  helperText,
  leftIcon,
  rightSlot,
  surface = 'subtle',
  multiline = false,
  editable = true,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  ...rest
}: StandardInputProps) {
  const layout = useResponsiveLayout();
  const [focused, setFocused] = useState(false);
  const isDisabled = editable === false;

  const bg = isDisabled
    ? HerwayColors.borderSubtle
    : surface === 'white'
      ? HerwayColors.surface
      : HerwayColors.surfaceSubtle;
  const borderColor = error
    ? HerwayColors.danger
    : focused
      ? HerwayColors.teal
      : HerwayColors.inputBorder;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={[layout.type.label, styles.label]}>{label}</Text> : null}
      <View
        style={[
          styles.fieldBox,
          multiline && styles.multilineBox,
          {
            backgroundColor: bg,
            borderColor,
            borderWidth: focused || error ? 1.5 : HerwaySizes.borderWidth,
            opacity: isDisabled ? HerwayStates.disabledOpacity : 1,
          },
        ]}
      >
        {leftIcon ? (
          <MaterialIcons
            name={leftIcon}
            size={18}
            color={error ? HerwayColors.danger : focused ? HerwayColors.tealDark : HerwayColors.muted}
          />
        ) : null}
        <TextInput
          placeholderTextColor={HerwayColors.placeholder}
          multiline={multiline}
          editable={editable}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            inputStyle,
          ]}
          {...rest}
        />
        {rightSlot}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

interface SearchInputProps extends Omit<StandardInputProps, 'leftIcon' | 'rightSlot'> {
  onClear?: () => void;
}

/**
 * Standardized search bar (48-50px height, 12px radius, clear action).
 */
export function SearchInput({ value, onClear, onChangeText, ...rest }: SearchInputProps) {
  const hasValue = Boolean(value && value.length > 0);

  return (
    <StandardInput
      leftIcon="search"
      value={value}
      onChangeText={onChangeText}
      rightSlot={
        hasValue ? (
          <IconButton
            icon="close"
            size="small"
            tone="surface"
            accessibilityLabel="Clear search"
            onPress={() => {
              if (onClear) onClear();
              else onChangeText?.('');
            }}
          />
        ) : null
      }
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: HerwaySpacing.xs,
    width: '100%',
  },
  label: {
    color: HerwayColors.ink,
    marginLeft: HerwaySpacing.xs,
  },
  fieldBox: {
    minHeight: HerwaySizes.inputHeight,
    borderRadius: HerwayRadii.input,
    paddingHorizontal: HerwaySpacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  multilineBox: {
    minHeight: 96,
    alignItems: 'flex-start',
    paddingVertical: HerwaySpacing.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '500',
    color: HerwayColors.ink,
    paddingVertical: HerwaySpacing.sm,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as object) : {}),
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.danger,
    marginLeft: HerwaySpacing.xs,
  },
  helperText: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.muted,
    marginLeft: HerwaySpacing.xs,
  },
});
