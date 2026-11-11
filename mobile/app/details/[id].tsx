import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { HerwayColors, HerwaySpacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { PrimaryButton, ResponsiveContainer, StandardCard } from '@/components/ui';

export default function DetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const layout = useResponsiveLayout();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ResponsiveContainer maxWidth={480}>
        <StandardCard style={styles.card}>
          <View style={styles.iconCircle}>
            <MaterialIcons name="info-outline" size={28} color={HerwayColors.tealDark} />
          </View>
          <Text style={[layout.type.sectionHeading, styles.title]}>Listing Details</Text>
          <Text style={[layout.type.secondary, styles.sub]}>
            Browse verified Safe Havens and Travel Buddies from the Safe Network or Companions tab ({id}).
          </Text>
          <PrimaryButton
            label="Go Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            fullWidth
          />
        </StandardCard>
      </ResponsiveContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HerwayColors.creamBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: HerwayColors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: HerwayColors.ink, textAlign: 'center' },
  sub: { color: HerwayColors.muted, textAlign: 'center' },
});
