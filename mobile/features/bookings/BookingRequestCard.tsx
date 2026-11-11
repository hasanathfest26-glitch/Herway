import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  HerwayColors,
  HerwayRadii,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { formatBookingWindow } from '@/utils/dateFormat';
import {
  ExpandableToggleRow,
  PrimaryButton,
  SecondaryButton,
  SmallButton,
  StandardCard,
  StatusBadge,
} from '@/components/ui';

export interface BookingCardRecord {
  id: string;
  activitySummary: string;
  status: string;
  startAt: string;
  endAt?: string;
  meetingPointName?: string | null;
  meetingPointAddress?: string | null;
  travellerConfirmed?: boolean;
  buddyConfirmed?: boolean;
  cancellationReason?: string | null;
  disputeStatus?: string | null;
  disputeNotes?: string | null;
  travellerId: string;
  buddyId: string;
  traveller: { fullName: string; homeCity?: string | null; avatarUrl?: string | null };
  buddy: { fullName: string; homeCity?: string | null; avatarUrl?: string | null };
  reviews?: Array<{ id: string; rating: number; safetyScore?: number; comment?: string | null }>;
}

function getStatusTone(status: string): 'safe' | 'warn' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'CONFIRMED':
    case 'IN_PROGRESS':
    case 'COMPLETED':
      return 'safe';
    case 'ACCEPTED':
      return 'info';
    case 'CANCELLED':
    case 'REJECTED':
      return 'danger';
    case 'REQUESTED':
    default:
      return 'warn';
  }
}

export const BookingRequestCard = React.memo(function BookingRequestCard({
  booking,
  currentUserId,
  busyAction,
  compact = false,
  onOpenChat,
  onRespond,
  onConfirmSpot,
  onChangeSpot,
  onComplete,
  onNoShow,
  onCancel,
  onLeaveReview,
}: {
  booking: BookingCardRecord;
  currentUserId: string;
  busyAction?: string;
  compact?: boolean;
  onOpenChat: (bookingId: string) => void;
  onRespond?: (bookingId: string, decision: 'ACCEPTED' | 'REJECTED') => void;
  onConfirmSpot?: (booking: BookingCardRecord) => void;
  onChangeSpot?: (booking: BookingCardRecord) => void;
  onComplete?: (bookingId: string) => void;
  onNoShow?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
  onLeaveReview?: (booking: BookingCardRecord) => void;
}) {
  const layout = useResponsiveLayout();
  const [expanded, setExpanded] = useState(false);

  const isBuddyView = booking.buddyId === currentUserId;
  const isTravellerView = booking.travellerId === currentUserId;
  const counterpartLabel = isBuddyView
    ? `Traveller: ${booking.traveller.fullName}`
    : `Buddy: ${booking.buddy.fullName}`;
  const scheduleLabel = formatBookingWindow(booking.startAt, booking.endAt);
  const hasExpandableDetails = Boolean(
    booking.activitySummary.length > 48 ||
      booking.meetingPointAddress ||
      booking.cancellationReason ||
      booking.disputeNotes ||
      (booking.reviews && booking.reviews.length > 0) ||
      booking.traveller.fullName.length > 26 ||
      booking.buddy.fullName.length > 26,
  );

  return (
    <StandardCard
      compact={compact}
      tone={booking.status === 'REQUESTED' && isBuddyView ? 'subtle' : 'default'}
      style={styles.cardStretch}
    >
      <View style={styles.bodyCol}>
        <View style={styles.headerRow}>
          <Text
            style={[layout.type.cardHeading, styles.title]}
            numberOfLines={expanded ? undefined : 2}
          >
            {booking.activitySummary}
          </Text>
          <View style={styles.badgeWrap}>
            <StatusBadge label={booking.status} tone={getStatusTone(booking.status)} />
          </View>
        </View>

        <Text style={styles.primaryMeta} numberOfLines={expanded ? undefined : 1}>
          {counterpartLabel}
          {isBuddyView && booking.traveller.homeCity ? ` (${booking.traveller.homeCity})` : ''}
        </Text>

        <Text style={styles.meta} numberOfLines={1}>
          {scheduleLabel}
        </Text>

        {booking.meetingPointName ? (
          <Text style={styles.meta} numberOfLines={expanded ? undefined : 1}>
            Meeting spot: {booking.meetingPointName}
          </Text>
        ) : (
          <Text style={styles.metaMuted} numberOfLines={1}>
            Meeting spot: Pending mutual confirmation
          </Text>
        )}

        {expanded && (
          <View style={styles.detailsBox}>
            <Text style={styles.detailLine}>
              Traveller: {booking.traveller.fullName}
              {booking.traveller.homeCity ? ` · ${booking.traveller.homeCity}` : ''}
            </Text>
            <Text style={styles.detailLine}>
              Travel Buddy: {booking.buddy.fullName}
              {booking.buddy.homeCity ? ` · ${booking.buddy.homeCity}` : ''}
            </Text>
            {booking.meetingPointAddress ? (
              <Text style={styles.detailLine}>Address: {booking.meetingPointAddress}</Text>
            ) : null}
            <Text style={styles.detailLine}>
              Confirmations: Traveller {booking.travellerConfirmed ? '✓' : 'Pending'} · Buddy{' '}
              {booking.buddyConfirmed ? '✓' : 'Pending'}
            </Text>
            {booking.cancellationReason ? (
              <Text style={styles.detailWarn}>
                Cancellation note: {booking.cancellationReason}
              </Text>
            ) : null}
            {booking.disputeNotes ? (
              <Text style={styles.detailWarn}>
                Dispute ({booking.disputeStatus || 'OPEN'}): {booking.disputeNotes}
              </Text>
            ) : null}
            {booking.reviews && booking.reviews.length > 0 ? (
              <Text style={styles.detailLine}>
                Rating: ★ {booking.reviews[0].rating}/5
                {booking.reviews[0].comment ? ` — "${booking.reviews[0].comment}"` : ''}
              </Text>
            ) : null}
          </View>
        )}

        {(hasExpandableDetails || expanded) && (
          <ExpandableToggleRow
            expanded={expanded}
            onToggle={() => setExpanded((v) => !v)}
            expandLabel="Request details"
            collapseLabel="Hide details"
          />
        )}
      </View>

      <View style={styles.actionsRow}>
        <PrimaryButton
          label="Chat"
          onPress={() => onOpenChat(booking.id)}
          style={styles.chatBtn}
        />

        {booking.status === 'REQUESTED' && isBuddyView && onRespond && (
          <>
            <SmallButton
              label={busyAction === 'ACCEPT' ? 'Accepting...' : 'Accept'}
              tone="dark"
              loading={busyAction === 'ACCEPT'}
              disabled={Boolean(busyAction)}
              onPress={() => onRespond(booking.id, 'ACCEPTED')}
            />
            <SecondaryButton
              label={busyAction === 'REJECT' ? 'Declining...' : 'Reject'}
              tone="danger"
              disabled={Boolean(busyAction)}
              onPress={() => onRespond(booking.id, 'REJECTED')}
              style={styles.compactSecondary}
            />
          </>
        )}

        {booking.status === 'ACCEPTED' && (
          <>
            {onConfirmSpot && (
              <SmallButton
                label={busyAction === 'CONFIRM' ? 'Confirming...' : 'Confirm Public Spot'}
                tone="dark"
                loading={busyAction === 'CONFIRM'}
                disabled={Boolean(busyAction)}
                onPress={() => onConfirmSpot(booking)}
              />
            )}
            {onChangeSpot && (
              <SecondaryButton
                label="Change Spot"
                tone="tealSoft"
                disabled={Boolean(busyAction)}
                onPress={() => onChangeSpot(booking)}
                style={styles.compactSecondary}
              />
            )}
          </>
        )}

        {booking.status === 'CONFIRMED' && (
          <>
            {onChangeSpot && (
              <SecondaryButton
                label="Change Spot"
                tone="tealSoft"
                disabled={Boolean(busyAction)}
                onPress={() => onChangeSpot(booking)}
                style={styles.compactSecondary}
              />
            )}
            {onComplete && (
              <SmallButton
                label={busyAction === 'COMPLETE' ? 'Completing...' : 'Complete'}
                tone="dark"
                loading={busyAction === 'COMPLETE'}
                disabled={Boolean(busyAction)}
                onPress={() => onComplete(booking.id)}
              />
            )}
            {onNoShow && (
              <SecondaryButton
                label={busyAction === 'NOSHOW' ? 'Logging...' : 'No-Show'}
                disabled={Boolean(busyAction)}
                onPress={() => onNoShow(booking.id)}
                style={styles.compactSecondary}
              />
            )}
          </>
        )}

        {booking.status === 'COMPLETED' &&
          isTravellerView &&
          (!booking.reviews || booking.reviews.length === 0) &&
          onLeaveReview && (
            <SmallButton
              label="Leave Review"
              tone="dark"
              onPress={() => onLeaveReview(booking)}
            />
          )}

        {booking.status !== 'CANCELLED' &&
          booking.status !== 'COMPLETED' &&
          booking.status !== 'REJECTED' &&
          onCancel && (
            <SecondaryButton
              label={busyAction === 'CANCEL' ? 'Cancelling...' : 'Cancel'}
              tone="danger"
              disabled={Boolean(busyAction)}
              onPress={() => onCancel(booking.id)}
              style={styles.compactSecondary}
            />
          )}
      </View>
    </StandardCard>
  );
});

const styles = StyleSheet.create({
  cardStretch: {
    flex: 1,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  bodyCol: {
    gap: HerwaySpacing.xs,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: HerwaySpacing.sm,
  },
  title: {
    color: HerwayColors.ink,
    flex: 1,
    minWidth: 0,
  },
  badgeWrap: {
    flexShrink: 0,
  },
  primaryMeta: {
    fontSize: 14,
    fontWeight: '600',
    color: HerwayColors.ink,
    lineHeight: 20,
  },
  meta: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.muted,
    lineHeight: 19,
  },
  metaMuted: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.placeholder,
    lineHeight: 19,
  },
  detailsBox: {
    marginTop: HerwaySpacing.xs,
    padding: HerwaySpacing.md,
    borderRadius: HerwayRadii.input,
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.borderSubtle,
    gap: HerwaySpacing.xs,
  },
  detailLine: {
    fontSize: 12,
    fontWeight: '500',
    color: HerwayColors.ink,
    lineHeight: 18,
  },
  detailWarn: {
    fontSize: 12,
    fontWeight: '600',
    color: HerwayColors.dangerText,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    marginTop: HerwaySpacing.sm,
  },
  chatBtn: {
    minWidth: 90,
    flexGrow: 1,
  },
  compactSecondary: {
    minHeight: HerwaySizes.buttonSmall,
    paddingVertical: 6,
    paddingHorizontal: HerwaySpacing.md,
  },
});
