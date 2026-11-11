import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { createIdempotencyKey, mobileApi } from '@/services/apiClient';
import { showFeedback } from '@/services/feedback';
import { formatTimeShort } from '@/utils/dateFormat';
import {
  getRealtimeSocket,
  joinBookingRoom,
  leaveBookingRoom,
  SocketConnectionState,
  subscribeSocketState,
} from '@/services/realtimeSocket';
import {
  EmptyState,
  IconButton,
  LiveUpdatePill,
  LoadingState,
  PrimaryButton,
  SmallButton,
  StatusBadge,
} from '@/components/ui';

type MessageDeliveryStatus = 'sending' | 'sent' | 'failed';

interface ChatMsg {
  id: string;
  clientMessageId?: string | null;
  senderId: string;
  body: string;
  maskedPhoneNotice: boolean;
  createdAt?: string;
  sender: { id: string; fullName: string };
  deliveryStatus?: MessageDeliveryStatus;
}

function mergeOrderedMessages(existing: ChatMsg[], incoming: ChatMsg[]): ChatMsg[] {
  const byKey = new Map<string, ChatMsg>();
  for (const msg of existing) {
    const key = msg.clientMessageId || msg.id;
    byKey.set(key, msg);
  }
  for (const msg of incoming) {
    if (msg.clientMessageId && byKey.has(msg.clientMessageId)) {
      byKey.delete(msg.clientMessageId);
    }
    byKey.set(msg.id, { ...msg, deliveryStatus: 'sent' });
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : Number.MAX_SAFE_INTEGER;
    const tb = b.createdAt ? Date.parse(b.createdAt) : Number.MAX_SAFE_INTEGER;
    return ta - tb;
  });
}

const ChatBubble = React.memo(function ChatBubble({
  message,
  mine,
  isWide,
  onRetry,
}: {
  message: ChatMsg;
  mine: boolean;
  isWide: boolean;
  onRetry: (msg: ChatMsg) => void;
}) {
  const status = message.deliveryStatus ?? 'sent';
  const timeLabel = formatTimeShort(message.createdAt);

  return (
    <View
      style={[
        styles.bubble,
        mine ? styles.mine : styles.theirs,
        { maxWidth: isWide ? 560 : '84%' },
      ]}
    >
      <Text style={[styles.sender, mine && styles.senderMine]} numberOfLines={1}>
        {message.sender.fullName}
      </Text>

      <Text style={[styles.body, mine && styles.bodyMine]} selectable>
        {message.body}
      </Text>

      {message.maskedPhoneNotice && (
        <View style={[styles.noticeBadge, mine && styles.noticeBadgeMine]}>
          <MaterialIcons
            name="shield"
            size={12}
            color={mine ? HerwayColors.white : HerwayColors.tealDark}
          />
          <Text style={[styles.noticeText, mine && styles.noticeTextMine]}>
            Phone number automatically masked
          </Text>
        </View>
      )}

      <View style={styles.metaFooter}>
        {timeLabel ? (
          <Text style={[styles.timeText, mine && styles.timeTextMine]}>{timeLabel}</Text>
        ) : null}

        {mine && (
          <Pressable
            onPress={status === 'failed' ? () => onRetry(message) : undefined}
            disabled={status !== 'failed'}
            hitSlop={6}
          >
            <Text style={[styles.statusText, status === 'failed' && styles.statusFailed]}>
              {status === 'sending'
                ? 'Sending...'
                : status === 'failed'
                  ? 'Failed – Tap to Retry'
                  : 'Sent ✓'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
});

export default function BookingChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { user, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [socketState, setSocketState] = useState<SocketConnectionState>('connecting');
  const [unreadIncomingCount, setUnreadIncomingCount] = useState(0);

  const listRef = useRef<FlatList<ChatMsg> | null>(null);
  const isNearBottomRef = useRef(true);
  const hasScrolledInitialRef = useRef(false);
  const loadingOlderRef = useRef(false);

  const loadMessages = useCallback(
    async (beforeIso?: string) => {
      if (!bookingId || !user) return;
      try {
        const qs = beforeIso
          ? `?limit=60&before=${encodeURIComponent(beforeIso)}`
          : '?limit=60';
        const history = await mobileApi<ChatMsg[]>(`/bookings/${bookingId}/messages${qs}`);
        setHasMoreHistory(history.length >= 60);
        setMessages((prev) =>
          beforeIso
            ? mergeOrderedMessages(history, prev)
            : mergeOrderedMessages(
                prev.filter((m) => m.deliveryStatus !== 'sent'),
                history,
              ),
        );
      } catch (err) {
        if (!beforeIso) {
          showFeedback({ tone: 'error', title: 'Chat Unavailable', message: (err as Error).message });
        }
      } finally {
        setLoadingInitial(false);
        setLoadingOlder(false);
        loadingOlderRef.current = false;
      }
    },
    [bookingId, user],
  );

  useEffect(() => {
    void loadMessages();
    if (!bookingId || !token) return;

    const unsubState = subscribeSocketState((state) => {
      setSocketState(state);
      if (state === 'connected') {
        void loadMessages();
      }
    });

    const socket = getRealtimeSocket(token);
    joinBookingRoom(bookingId);

    const onNewMessage = (msg: ChatMsg) => {
      setMessages((prev) => mergeOrderedMessages(prev, [msg]));
      if (isNearBottomRef.current || msg.senderId === user?.id) {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);
      } else {
        setUnreadIncomingCount((c) => c + 1);
      }
    };
    socket.on('booking:new_message', onNewMessage);

    return () => {
      leaveBookingRoom(bookingId);
      socket.off('booking:new_message', onNewMessage);
      unsubState();
    };
  }, [bookingId, token, loadMessages, user?.id]);

  const dispatchMessage = useCallback(
    async (bodyText: string, clientMessageId: string) => {
      if (!bookingId || !user) return;
      try {
        const sent = await mobileApi<ChatMsg>(`/bookings/${bookingId}/messages`, {
          method: 'POST',
          idempotencyKey: clientMessageId,
          body: JSON.stringify({ body: bodyText, clientMessageId }),
        });
        setMessages((prev) => mergeOrderedMessages(prev, [sent]));
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMessageId === clientMessageId || m.id === clientMessageId
              ? { ...m, deliveryStatus: 'failed' }
              : m,
          ),
        );
        showFeedback({
          tone: 'error',
          title: 'Message Failed',
          message: 'Tap "Failed – Tap to Retry" on your message bubble to resend safely.',
        });
      }
    },
    [bookingId, user],
  );

  function send() {
    const clean = draft.trim();
    if (!clean || !bookingId || !user) return;
    const clientMessageId = createIdempotencyKey('msg');
    const optimisticMsg: ChatMsg = {
      id: clientMessageId,
      clientMessageId,
      senderId: user.id,
      body: clean,
      maskedPhoneNotice: false,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, fullName: user.fullName || 'You' },
      deliveryStatus: 'sending',
    };

    setDraft('');
    isNearBottomRef.current = true;
    setUnreadIncomingCount(0);
    setMessages((prev) => [...prev, optimisticMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 40);
    void dispatchMessage(clean, clientMessageId);
  }

  const retryMessage = useCallback(
    (msg: ChatMsg) => {
      const clientMessageId = msg.clientMessageId || msg.id;
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, deliveryStatus: 'sending' } : m)),
      );
      void dispatchMessage(msg.body, clientMessageId);
    },
    [dispatchMessage],
  );

  function loadOlder() {
    if (loadingOlder || messages.length === 0) return;
    const earliest = messages[0]?.createdAt;
    if (!earliest) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    void loadMessages(earliest);
  }

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const nearBottom = distanceFromBottom <= 120;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setUnreadIncomingCount(0);
    }
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 76 : 0}
    >
      <View style={styles.banner}>
        <View
          style={[
            styles.bannerInner,
            { maxWidth: layout.isWideLayout ? 920 : '100%', paddingHorizontal: layout.pageGutter },
          ]}
        >
          <View style={styles.bannerLeft}>
            <IconButton
              icon="arrow-back"
              size="small"
              tone="surface"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/bookings'))}
              accessibilityLabel="Back to bookings"
            />
            <Text style={styles.bannerText} numberOfLines={2}>
              Private Booking Chat — Phone numbers masked automatically.
            </Text>
          </View>
          <StatusBadge
            label={
              socketState === 'connected'
                ? 'Live'
                : socketState === 'reconnecting'
                  ? 'Reconnecting'
                  : 'Connecting'
            }
            tone={socketState === 'connected' ? 'safe' : 'warn'}
          />
        </View>
      </View>

      <View
        style={[
          styles.chatFrame,
          { maxWidth: layout.isWideLayout ? 920 : '100%' },
        ]}
      >
        {loadingInitial ? (
          <View style={styles.loadingWrap}>
            <LoadingState label="Loading conversation..." />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            onScroll={handleScroll}
            scrollEventThrottle={120}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            initialNumToRender={24}
            maxToRenderPerBatch={16}
            windowSize={10}
            removeClippedSubviews={Platform.OS !== 'web'}
            contentContainerStyle={[styles.list, { paddingHorizontal: layout.pageGutter }]}
            ListHeaderComponent={
              hasMoreHistory ? (
                <View style={styles.olderWrap}>
                  <SmallButton
                    label={loadingOlder ? 'Loading earlier...' : 'Load earlier messages'}
                    tone="tealSoft"
                    loading={loadingOlder}
                    onPress={loadOlder}
                  />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="chat-bubble-outline"
                title="No messages yet"
                description="Start coordinating your public meeting point below."
              />
            }
            renderItem={({ item: m }) => (
              <ChatBubble
                message={m}
                mine={m.senderId === user?.id}
                isWide={layout.isWideLayout}
                onRetry={retryMessage}
              />
            )}
            onContentSizeChange={() => {
              if (!hasScrolledInitialRef.current && messages.length > 0) {
                hasScrolledInitialRef.current = true;
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
          />
        )}

        {unreadIncomingCount > 0 && (
          <View style={styles.jumpBottomWrap} pointerEvents="box-none">
            <LiveUpdatePill
              label={`${unreadIncomingCount} new message${unreadIncomingCount > 1 ? 's' : ''}`}
              icon="arrow-downward"
              onPress={() => {
                setUnreadIncomingCount(0);
                isNearBottomRef.current = true;
                listRef.current?.scrollToEnd({ animated: true });
              }}
            />
          </View>
        )}

        <View
          style={[
            styles.inputRow,
            {
              paddingHorizontal: layout.pageGutter,
              paddingBottom: Math.max(insets.bottom + HerwaySpacing.sm, HerwaySpacing.md),
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={1500}
            placeholder="Message without sharing phone numbers..."
            placeholderTextColor={HerwayColors.placeholder}
            style={styles.input}
            onKeyPress={(e) => {
              const nativeEvt = e.nativeEvent as { key?: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && nativeEvt.key === 'Enter' && !nativeEvt.shiftKey) {
                e.preventDefault?.();
                send();
              }
            }}
          />
          <PrimaryButton
            label="Send"
            disabled={!draft.trim()}
            onPress={send}
            style={styles.sendBtn}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HerwayColors.creamBg },
  banner: {
    backgroundColor: HerwayColors.ink,
    paddingVertical: HerwaySpacing.sm,
  },
  bannerInner: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.sm,
  },
  bannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    minWidth: 200,
  },
  bannerText: {
    fontSize: 12,
    color: HerwayColors.white,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  chatFrame: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    position: 'relative',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: HerwaySpacing.xl,
  },
  list: {
    paddingVertical: HerwaySpacing.lg,
    gap: HerwaySpacing.md,
    flexGrow: 1,
  },
  olderWrap: {
    alignItems: 'center',
    marginBottom: HerwaySpacing.sm,
  },
  bubble: {
    padding: HerwaySpacing.md,
    borderRadius: HerwayRadii.card,
    borderWidth: HerwaySizes.borderWidth,
    minWidth: 112,
    gap: HerwaySpacing.xs,
    overflow: 'hidden',
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: HerwayColors.tealDark,
    borderColor: HerwayColors.tealDark,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: HerwayColors.white,
    borderColor: HerwayColors.border,
    ...HerwayShadows.card,
  },
  sender: {
    fontSize: 12,
    fontWeight: '700',
    color: HerwayColors.muted,
  },
  senderMine: {
    color: 'rgba(255,255,255,0.88)',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: HerwayColors.ink,
    flexShrink: 1,
  },
  bodyMine: {
    color: HerwayColors.white,
  },
  noticeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: HerwaySpacing.sm,
    paddingVertical: 3,
    borderRadius: HerwayRadii.sm,
    backgroundColor: HerwayColors.tealSoft,
    alignSelf: 'flex-start',
  },
  noticeBadgeMine: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  noticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: HerwayColors.tealDark,
  },
  noticeTextMine: {
    color: HerwayColors.white,
  },
  metaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: HerwaySpacing.sm,
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    color: HerwayColors.muted,
  },
  timeTextMine: {
    color: 'rgba(255,255,255,0.78)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
  },
  statusFailed: {
    color: HerwayColors.dangerSoft,
    fontWeight: '700',
  },
  jumpBottomWrap: {
    position: 'absolute',
    bottom: 84,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: HerwaySpacing.sm,
    paddingTop: HerwaySpacing.md,
    backgroundColor: HerwayColors.white,
    borderTopWidth: HerwaySizes.borderWidth,
    borderTopColor: HerwayColors.border,
  },
  input: {
    flex: 1,
    minHeight: HerwaySizes.inputHeight,
    maxHeight: 112,
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    borderRadius: HerwayRadii.input,
    paddingHorizontal: HerwaySpacing.lg,
    paddingVertical: HerwaySpacing.sm,
    fontSize: 15,
    color: HerwayColors.ink,
  },
  sendBtn: {
    minWidth: 84,
    paddingHorizontal: HerwaySpacing.lg,
  },
});
