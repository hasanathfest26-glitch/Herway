import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable as RNPressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { IconButton } from './Buttons';

interface OverlayProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
  cardStyle?: StyleProp<ViewStyle>;
}

/**
 * Centered accessible Modal (20px radius, 24px padding, 44px close target).
 */
export function AppModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 500,
  cardStyle,
}: OverlayProps) {
  const layout = useResponsiveLayout();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <RNPressable style={styles.modalBackdrop} onPress={onClose}>
          <RNPressable
            style={[
              styles.modalCard,
              { maxWidth, padding: layout.cardPadding },
              cardStyle,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {title ? (
              <View style={styles.headerRow}>
                <View style={styles.headerTextCol}>
                  <Text style={[layout.type.cardHeading, styles.title]} numberOfLines={2}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={[layout.type.secondary, styles.subtitle]} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <IconButton
                  icon="close"
                  onPress={onClose}
                  accessibilityLabel="Close modal"
                  tone="subtle"
                />
              </View>
            ) : null}

            <ScrollView
              style={styles.bodyScrollView}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.bodyScroll}
            >
              {children}
            </ScrollView>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </RNPressable>
        </RNPressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Responsive BottomSheet: bottom-anchored sheet on mobile (<768px) and centered modal on tablet/desktop.
 */
export function AppBottomSheet(props: OverlayProps) {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  if (layout.isWideLayout) {
    return <AppModal {...props} />;
  }

  const { visible, onClose, title, subtitle, children, footer, cardStyle } = props;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <RNPressable style={styles.sheetBackdrop} onPress={onClose}>
          <RNPressable
            style={[
              styles.sheetCard,
              { paddingBottom: Math.max(insets.bottom + HerwaySpacing.lg, HerwaySpacing.xl) },
              cardStyle,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.dragHandle} />
            {title ? (
              <View style={styles.headerRow}>
                <View style={styles.headerTextCol}>
                  <Text style={[layout.type.cardHeading, styles.title]} numberOfLines={2}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={[layout.type.secondary, styles.subtitle]} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <IconButton
                  icon="close"
                  onPress={onClose}
                  accessibilityLabel="Close sheet"
                  tone="subtle"
                />
              </View>
            ) : null}

            <ScrollView
              style={styles.bodyScrollView}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.bodyScroll}
            >
              {children}
            </ScrollView>

            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </RNPressable>
        </RNPressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: HerwayColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: HerwaySpacing.lg,
  },
  modalCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: HerwayColors.surface,
    borderRadius: HerwayRadii.modal,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    gap: HerwaySpacing.md,
    overflow: 'hidden',
    ...HerwayShadows.card,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: HerwayColors.overlay,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: HerwayColors.surface,
    borderTopLeftRadius: HerwayRadii.sheet,
    borderTopRightRadius: HerwayRadii.sheet,
    borderTopWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    paddingHorizontal: HerwaySpacing.lg,
    paddingTop: HerwaySpacing.md,
    gap: HerwaySpacing.md,
    overflow: 'hidden',
    ...HerwayShadows.card,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: HerwayRadii.pill,
    backgroundColor: HerwayColors.borderStrong,
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
    flexShrink: 0,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    color: HerwayColors.ink,
  },
  subtitle: {
    color: HerwayColors.muted,
  },
  bodyScrollView: {
    flexShrink: 1,
  },
  bodyScroll: {
    gap: HerwaySpacing.md,
    paddingBottom: HerwaySpacing.xs,
  },
  footer: {
    flexShrink: 0,
    paddingTop: HerwaySpacing.sm,
    borderTopWidth: HerwaySizes.borderWidth,
    borderTopColor: HerwayColors.borderSubtle,
  },
});
