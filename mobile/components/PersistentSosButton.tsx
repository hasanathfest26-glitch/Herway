import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';

export function PersistentSosButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={() => router.push('/sos')}
      style={({ pressed }) => [
        styles.fab,
        { bottom: 92 + Math.max(insets.bottom, HerwaySpacing.md) },
        pressed && styles.fabPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Open SOS Emergency Assistance"
    >
      <View style={styles.inner}>
        <MaterialIcons name="warning" size={16} color={HerwayColors.white} />
        <Text style={styles.text}>SOS</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: HerwaySpacing.lg,
    zIndex: 50,
    minHeight: HerwaySizes.buttonSecondary,
    backgroundColor: HerwayColors.danger,
    borderRadius: HerwayRadii.pill,
    paddingHorizontal: HerwaySpacing.lg,
    paddingVertical: HerwaySpacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    ...HerwayShadows.card,
    borderWidth: 2,
    borderColor: HerwayColors.dangerBorder,
  },
  fabPressed: {
    transform: [{ scale: 0.96 }],
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
  },
  text: {
    color: HerwayColors.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
  },
});
