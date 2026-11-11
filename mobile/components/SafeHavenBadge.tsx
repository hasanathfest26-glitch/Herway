import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HerwayColors, HerwayRadii, HerwaySizes, HerwaySpacing } from '@/constants/theme';

interface SafeHavenBadgeProps {
  verified: boolean;
  isDemo?: boolean;
  approvalStatus?: string;
}

export function SafeHavenBadge({
  verified,
  isDemo = false,
  approvalStatus,
}: SafeHavenBadgeProps) {
  const isOfficialVerified =
    verified && !isDemo && (approvalStatus === undefined || approvalStatus === 'APPROVED');

  if (isDemo || approvalStatus === 'PENDING') {
    return (
      <View style={styles.demoBadge}>
        <MaterialIcons name="info-outline" size={14} color={HerwayColors.warningText} />
        <Text style={styles.demoText} numberOfLines={1}>
          DEMO DATA ({approvalStatus || 'PENDING'})
        </Text>
      </View>
    );
  }

  if (!isOfficialVerified) {
    return (
      <View style={styles.unverified}>
        <MaterialIcons name="place" size={14} color={HerwayColors.textSecondary} />
        <Text style={styles.unverifiedText} numberOfLines={1}>
          Public Map Place (Unverified)
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.verified}>
      <MaterialIcons name="verified-user" size={14} color={HerwayColors.white} />
      <Text style={styles.verifiedText} numberOfLines={1}>
        Verified Safe Haven
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    backgroundColor: HerwayColors.safe,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  verifiedText: {
    color: HerwayColors.white,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  demoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    backgroundColor: HerwayColors.warningSoft,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.warningBorder,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  demoText: {
    color: HerwayColors.warningText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  unverified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    backgroundColor: HerwayColors.surfaceSubtle,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  unverifiedText: {
    color: HerwayColors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
