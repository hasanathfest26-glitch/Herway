import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, Redirect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { useHerwayState } from '@/features/app/HerwayStateContext';
import { mobileApi } from '@/services/apiClient';
import { supabase } from '@/services/supabaseClient';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import {
  ErrorState,
  PrimaryButton,
  SmallButton,
  StandardCard,
  StandardInput,
} from '@/components/ui';

const PRESENTATION_BYPASS_OTP = true;

export default function VerifyAccountScreen() {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { user, refreshProfile, exchangeSupabaseToken } = useAuth();
  const { setAccountVerified } = useHerwayState();

  useEffect(() => {
    if (PRESENTATION_BYPASS_OTP) {
      setAccountVerified(true);
    }
  }, [setAccountVerified]);

  const [channel, setChannel] = useState<'email' | 'phone'>('email');
  const [phoneInput, setPhoneInput] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !supabase) return;
    const hasMagicLinkParams =
      window.location.hash.includes('access_token=') ||
      window.location.search.includes('code=');
    if (!hasMagicLinkParams) return;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.access_token) return;
      try {
        await exchangeSupabaseToken(data.session.access_token);
        setAccountVerified(true);
        setStatusMsg('Email verified via link!');
        router.replace('/(onboarding)/create-profile' as Href);
      } catch (err) {
        setErrorMsg((err as Error).message || 'Could not complete email link verification.');
      }
    });
  }, []);

  const alreadyVerified =
    channel === 'email'
      ? Boolean(user?.emailVerifiedAt)
      : Boolean(user?.phoneVerifiedAt);

  async function handleSendCode() {
    setErrorMsg(null);
    setStatusMsg(null);
    setSending(true);
    try {
      if (channel === 'phone') {
        if (!phoneInput.trim()) {
          setErrorMsg('Please enter your mobile number first.');
          return;
        }
        await mobileApi('/auth/request-phone-otp', {
          method: 'POST',
          body: JSON.stringify({ phone: phoneInput.trim() }),
        });
        setStatusMsg(`SMS verification code sent to ${phoneInput.trim()}.`);
      } else {
        if (!user?.email) {
          setErrorMsg('Please sign in with an email address first.');
          return;
        }
        await mobileApi('/auth/resend-verification', {
          method: 'POST',
          body: JSON.stringify({ email: user.email }),
        });
        setStatusMsg(`Verification code sent to ${user.email}. Please check your inbox.`);
      }
    } catch (err) {
      setErrorMsg((err as Error).message || 'Could not send verification code.');
    } finally {
      setSending(false);
    }
  }

  async function handleVerifyAndContinue() {
    setErrorMsg(null);
    setStatusMsg(null);
    if (alreadyVerified) {
      setAccountVerified(true);
      router.push('/(onboarding)/create-profile' as Href);
      return;
    }

    const cleanCode = code.trim();
    if (!cleanCode) {
      setErrorMsg('Please enter the verification code sent to your account.');
      return;
    }

    if (channel === 'email' && !user?.email) {
      setErrorMsg('Please sign in with an email address first.');
      return;
    }

    setSubmitting(true);
    try {
      await mobileApi(
        channel === 'email' ? '/auth/verify-email' : '/auth/verify-phone',
        {
          method: 'POST',
          body: JSON.stringify(
            channel === 'email'
              ? { email: user?.email, code: cleanCode }
              : { otp: cleanCode, phone: phoneInput.trim() },
          ),
        },
      );
      await refreshProfile();
      setAccountVerified(true);
      router.push('/(onboarding)/create-profile' as Href);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Verification failed. Please check the code.');
    } finally {
      setSubmitting(false);
    }
  }

  if (PRESENTATION_BYPASS_OTP) {
    return <Redirect href={'/(onboarding)/create-profile' as Href} />;
  }

  return (
    <OnboardingLayout
      currentStep={4}
      onBack={() => router.back()}
      desktopHeading="Verify your Herway account"
      desktopSubheading="Account verification ensures trusted contacts, check-in alerts, and companion bookings stay authentic."
      desktopIllustrationSlide={2}
    >
      <Text style={[layout.type.pageHeading, styles.title]}>Verify the account</Text>
      <Text style={[layout.type.secondary, styles.subtitle]}>
        {channel === 'email'
          ? `Enter the verification code sent to ${user?.email || 'your account email'}.`
          : 'Enter your mobile number and verify with an SMS code.'}
      </Text>

      <View style={styles.segmentWrap}>
        <Pressable
          onPress={() => {
            setChannel('email');
            setErrorMsg(null);
          }}
          style={[styles.segmentPill, channel === 'email' && styles.segmentPillActive]}
        >
          <Text style={[styles.segmentText, channel === 'email' && styles.segmentTextActive]}>
            Email Verification
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setChannel('phone');
            setErrorMsg(null);
          }}
          style={[styles.segmentPill, channel === 'phone' && styles.segmentPillActive]}
        >
          <Text style={[styles.segmentText, channel === 'phone' && styles.segmentTextActive]}>
            Phone OTP
          </Text>
        </Pressable>
      </View>

      {errorMsg ? (
        <View style={styles.bannerWrap}>
          <ErrorState inline message={errorMsg} />
        </View>
      ) : null}

      {statusMsg ? (
        <StandardCard tone="mint" compact style={styles.bannerWrap}>
          <View style={styles.bannerRow}>
            <MaterialIcons name="mark-email-read" size={18} color={HerwayColors.safe} />
            <Text style={styles.successText}>{statusMsg}</Text>
          </View>
        </StandardCard>
      ) : null}

      {alreadyVerified ? (
        <StandardCard tone="mint" compact style={styles.bannerWrap}>
          <View style={styles.bannerRow}>
            <MaterialIcons name="verified" size={22} color={HerwayColors.safe} />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifiedTitle}>
                {channel === 'email' ? 'Email already verified' : 'Phone already verified'}
              </Text>
              <Text style={styles.verifiedSub}>
                You can proceed directly to create your profile.
              </Text>
            </View>
          </View>
        </StandardCard>
      ) : (
        <View style={styles.formStack}>
          {channel === 'phone' && (
            <StandardInput
              label="Phone number"
              value={phoneInput}
              onChangeText={setPhoneInput}
              placeholder="+91 98470 00000"
              keyboardType="phone-pad"
              rightSlot={
                <SmallButton
                  label={sending ? 'Sending...' : 'Send OTP'}
                  loading={sending}
                  disabled={sending}
                  onPress={handleSendCode}
                />
              }
            />
          )}

          <StandardInput
            label="Verification code / token"
            leftIcon="verified-user"
            value={code}
            onChangeText={setCode}
            placeholder="Enter verification code"
            autoCapitalize="none"
          />

          <Pressable onPress={handleSendCode} disabled={sending} style={styles.resendBtn}>
            <Text style={styles.linkText}>
              {sending ? 'Sending verification code...' : 'Resend verification code'}
            </Text>
          </Pressable>
        </View>
      )}

      <StandardCard tone="mint" compact style={styles.infoCard}>
        <View style={styles.bannerRow}>
          <MaterialIcons name="lock" size={18} color={HerwayColors.tealDark} />
          <Text style={styles.infoText}>
            Your phone number and email stay private and are never exposed to other travellers or buddies.
          </Text>
        </View>
      </StandardCard>

      <PrimaryButton
        label={
          submitting
            ? 'Verifying...'
            : alreadyVerified
              ? 'Continue'
              : 'Verify & Continue'
        }
        loading={submitting}
        disabled={submitting}
        onPress={handleVerifyAndContinue}
        fullWidth
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  title: { color: HerwayColors.ink },
  subtitle: {
    marginTop: HerwaySpacing.sm,
    color: HerwayColors.muted,
    marginBottom: HerwaySpacing.lg,
  },
  segmentWrap: {
    flexDirection: 'row',
    backgroundColor: HerwayColors.white,
    borderRadius: HerwayRadii.button,
    padding: HerwaySpacing.xs,
    height: HerwaySizes.inputHeight,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    marginBottom: HerwaySpacing.lg,
    ...HerwayShadows.card,
  },
  segmentPill: {
    flex: 1,
    borderRadius: HerwayRadii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillActive: {
    backgroundColor: HerwayColors.teal,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: HerwayColors.ink,
  },
  segmentTextActive: {
    color: HerwayColors.white,
    fontWeight: '700',
  },
  bannerWrap: {
    marginBottom: HerwaySpacing.lg,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.successText,
  },
  verifiedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: HerwayColors.successText,
  },
  verifiedSub: {
    fontSize: 13,
    color: HerwayColors.ink,
    marginTop: 2,
  },
  formStack: {
    gap: HerwaySpacing.lg,
    marginBottom: HerwaySpacing.lg,
  },
  resendBtn: {
    minHeight: HerwaySizes.buttonSmall,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: HerwayColors.tealDark,
  },
  infoCard: {
    marginBottom: HerwaySpacing.xl,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: HerwayColors.ink,
  },
});
