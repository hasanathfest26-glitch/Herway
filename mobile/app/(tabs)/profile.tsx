import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HerwayColors, HerwaySpacing } from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { ProfileRolesSection } from '@/features/profile/ProfileRolesSection';
import { BuddyVerificationCard } from '@/features/buddy/BuddyVerificationCard';
import { TrustedContactsManager } from '@/features/contacts/TrustedContactsManager';
import { TravelDocumentVault } from '@/features/documents/TravelDocumentVault';
import { ViewAllSwitch } from '@/components/ViewAllSwitch';
import { PageHeader, ResponsiveContainer } from '@/components/ui';

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const [viewAll, setViewAll] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          layout.isWideLayout
            ? styles.desktopScroll
            : { paddingTop: Math.max(insets.top + HerwaySpacing.lg, HerwaySpacing.section), paddingBottom: 140 },
        ]}
      >
        <ResponsiveContainer>
          <PageHeader
            title="Safety & Profile"
            subtitle="Manage account roles, trusted contacts, and your encrypted travel vault"
            rightSlot={<ViewAllSwitch value={viewAll} onValueChange={setViewAll} />}
          />

          {layout.isWideLayout ? (
            <View style={[styles.desktopColumns, { gap: layout.gridGap }]}>
              <View style={[styles.desktopCol, { gap: layout.gridGap }]}>
                <ProfileRolesSection />
                <BuddyVerificationCard />
              </View>
              {viewAll && (
                <View style={[styles.desktopCol, { gap: layout.gridGap }]}>
                  <TrustedContactsManager />
                  <TravelDocumentVault />
                </View>
              )}
            </View>
          ) : (
            <View style={{ gap: layout.gridGap }}>
              <ProfileRolesSection />
              <BuddyVerificationCard />
              {viewAll && (
                <>
                  <TrustedContactsManager />
                  <TravelDocumentVault />
                </>
              )}
            </View>
          )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HerwayColors.creamBg },
  desktopScroll: {
    paddingTop: HerwaySpacing.xl,
    paddingBottom: HerwaySpacing.section,
  },
  desktopColumns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  desktopCol: {
    flex: 1,
    minWidth: 0,
  },
});
