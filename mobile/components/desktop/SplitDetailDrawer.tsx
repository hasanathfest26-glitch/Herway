import React, { useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  FigmaImages,
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { HerwayCatalogItem } from '@/data/herwayCatalog';
import { useAuth } from '@/features/auth/AuthContext';
import { useHerwayState } from '@/features/app/HerwayStateContext';
import { mobileApi } from '@/services/apiClient';
import { showFeedback } from '@/services/feedback';
import { IconButton, PrimaryButton } from '@/components/ui/Buttons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { RevealMask } from '@/components/motion/HerwayMotion';

interface SplitDetailDrawerProps {
  item: HerwayCatalogItem;
  onClose: () => void;
}

function renderStars(rating: number) {
  const icons: Array<'star' | 'star-half' | 'star-border'> = [];
  for (let i = 1; i <= 5; i += 1) {
    if (rating >= i) icons.push('star');
    else if (rating >= i - 0.5) icons.push('star-half');
    else icons.push('star-border');
  }
  return icons;
}

export function SplitDetailDrawer({ item, onClose }: SplitDetailDrawerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { favourites, toggleFavourite } = useHerwayState();
  const [submitting, setSubmitting] = useState(false);
  const [bookingSent, setBookingSent] = useState(false);

  const liked = Boolean(favourites[item.id]);
  const stars = renderStars(item.rating);

  async function handlePrimaryAction() {
    if (item.kind === 'SAFE_HAVEN' || item.kind === 'MAP_PLACE') {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}&travelmode=driving`;
      Linking.openURL(url).catch(() =>
        showFeedback({
          tone: 'info',
          title: 'Directions',
          message: `Navigate to ${item.title} (${item.lat}, ${item.lng})`,
        }),
      );
      return;
    }

    if (!user) {
      showFeedback({
        tone: 'info',
        title: 'Sign In Required',
        message: 'Please sign in to book a verified Travel Buddy.',
      });
      router.push('/(auth)/login');
      return;
    }

    if (submitting || bookingSent) return;
    setSubmitting(true);
    try {
      await mobileApi('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          buddyId: item.id,
          startAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
          endAt: new Date(Date.now() + 27 * 3600_000).toISOString(),
          activitySummary: `${item.city} Companion Walk`,
          meetingPointName: 'Fort Kochi Water Metro Jetty (Public)',
        }),
      });
      setBookingSent(true);
      showFeedback({
        tone: 'success',
        title: 'Booking Request Sent!',
        message: `Sent request to ${item.title}. Open Bookings to confirm a public meeting point.`,
      });
    } catch (err) {
      showFeedback({ tone: 'error', title: 'Booking Failed', message: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RevealMask triggerKey={item.id} offsetX={16} offsetY={0} scrollTrigger={false} style={styles.drawer}>
      <View style={styles.headerRow}>
        <StatusBadge label={`${item.badgeText} VERIFIED`} tone="info" icon="verified-user" />
        <View style={styles.headerActions}>
          <IconButton
            icon={liked ? 'favorite' : 'favorite-border'}
            size="small"
            tone="subtle"
            iconColor={liked ? HerwayColors.teal : HerwayColors.muted}
            onPress={() => toggleFavourite(item.id)}
            accessibilityLabel="Toggle favourite"
          />
          <IconButton
            icon="open-in-new"
            size="small"
            tone="subtle"
            onPress={() => router.push(`/details/${item.id}` as Href)}
            accessibilityLabel="Open full details view"
          />
          <IconButton
            icon="close"
            size="small"
            tone="subtle"
            onPress={onClose}
            accessibilityLabel="Close detail drawer"
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.heroWrap}>
          <Image source={item.heroImage} style={styles.heroImg} resizeMode="cover" />
          <View style={styles.rateTag}>
            <Text style={styles.rateTagText}>
              <Text style={{ fontWeight: '700' }}>{item.priceOrStatusValue} </Text>
              {item.priceOrStatusUnit}
            </Text>
          </View>
        </View>

        <View style={styles.ratingRow}>
          <View style={styles.starsRow}>
            {stars.map((icon, i) => (
              <MaterialIcons key={i} name={icon} size={16} color={HerwayColors.teal} />
            ))}
          </View>
          <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          <Text style={styles.distanceText}>• {item.distanceLabel} away</Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>

        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={16} color={HerwayColors.teal} />
          <Text style={styles.locationText}>{item.locationLabel}</Text>
        </View>

        <View style={styles.chipsWrap}>
          {item.chips.map((chip) => (
            <View key={chip} style={styles.chip}>
              <Text style={styles.chipText}>{chip}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHeading}>Overview &amp; Safety Details</Text>
        <Text style={styles.desc}>{item.description}</Text>

        {item.phone && (
          <Pressable
            onPress={() => Linking.openURL(`tel:${item.phone}`).catch(() => {})}
            style={styles.phoneRow}
          >
            <MaterialIcons name="call" size={16} color={HerwayColors.tealDark} />
            <Text style={styles.phoneText}>24/7 Safe Desk: {item.phone}</Text>
          </Pressable>
        )}

        <View style={styles.communityRow}>
          <View style={styles.avatarCluster}>
            {FigmaImages.detailAvatars.map((src, idx) => (
              <Image
                key={idx}
                source={src}
                style={[styles.avatarImg, { marginLeft: idx === 0 ? 0 : -10 }]}
              />
            ))}
            <View style={[styles.extraCircle, { marginLeft: -10 }]}>
              <Text style={styles.extraText}>{item.extraCountLabel}</Text>
            </View>
          </View>
          <Text style={styles.communityNote}>Verified check-ins this month</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={submitting ? 'Sending...' : bookingSent ? 'Request Sent ✓' : item.ctaLabel}
          tone={bookingSent ? 'safe' : 'primary'}
          disabled={submitting || bookingSent}
          loading={submitting}
          onPress={handlePrimaryAction}
          fullWidth
        />
      </View>
    </RevealMask>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.card,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    overflow: 'hidden',
    maxHeight: 740,
    ...HerwayShadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HerwaySpacing.lg,
    paddingVertical: HerwaySpacing.md,
    borderBottomWidth: HerwaySizes.borderWidth,
    borderBottomColor: HerwayColors.borderSubtle,
    gap: HerwaySpacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
  },
  body: {
    padding: HerwaySpacing.xl,
    gap: HerwaySpacing.md,
  },
  heroWrap: {
    height: 192,
    borderRadius: HerwayRadii.input,
    overflow: 'hidden',
    backgroundColor: HerwayColors.borderSubtle,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  rateTag: {
    position: 'absolute',
    right: HerwaySpacing.md,
    bottom: HerwaySpacing.md,
    backgroundColor: HerwayColors.ink,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.sm,
  },
  rateTagText: {
    fontSize: 12,
    color: HerwayColors.white,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: HerwayColors.ink,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.muted,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: HerwayColors.ink,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: HerwayColors.tealDark,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.muted,
    flex: 1,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: HerwaySpacing.sm,
  },
  chip: {
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.sm,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: HerwayColors.ink,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: HerwayColors.ink,
  },
  desc: {
    fontSize: 14,
    lineHeight: 21,
    color: HerwayColors.muted,
  },
  phoneRow: {
    minHeight: HerwaySizes.buttonSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    backgroundColor: HerwayColors.mintMid,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.tealSoft,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
    borderRadius: HerwayRadii.input,
  },
  phoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: HerwayColors.tealDark,
  },
  communityRow: {
    paddingTop: HerwaySpacing.md,
    borderTopWidth: HerwaySizes.borderWidth,
    borderTopColor: HerwayColors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  avatarCluster: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: HerwayColors.white,
  },
  extraCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: HerwayColors.teal,
    borderWidth: 2,
    borderColor: HerwayColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraText: {
    fontSize: 11,
    fontWeight: '700',
    color: HerwayColors.white,
  },
  communityNote: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.muted,
    flex: 1,
  },
  footer: {
    padding: HerwaySpacing.lg,
    borderTopWidth: HerwaySizes.borderWidth,
    borderTopColor: HerwayColors.borderSubtle,
    backgroundColor: HerwayColors.white,
  },
});
