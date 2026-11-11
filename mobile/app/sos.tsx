import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HerwayColors, HerwaySpacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { PageHeader, ResponsiveContainer } from '@/components/ui';
import { SosEmergencyPanel } from '@/features/safety/SosEmergencyPanel';

export default function SosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: layout.isWideLayout
            ? HerwaySpacing.xl
            : Math.max(insets.top + HerwaySpacing.md, HerwaySpacing.xl),
          paddingBottom: Math.max(insets.bottom + HerwaySpacing.xxl, HerwaySpacing.section),
        }}
      >
        <ResponsiveContainer maxWidth={860}>
          <PageHeader
            title="SOS Emergency Support"
            subtitle="Alert trusted contacts with live location and access 1-tap India emergency dialing"
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          />
          <SosEmergencyPanel />
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HerwayColors.creamBg,
  },
});
