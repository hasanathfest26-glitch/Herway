import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Href, useRouter } from 'expo-router';
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
import { supabase } from '@/services/supabaseClient';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import {
  AppleLogoSvg,
  GoogleLogoSvg,
  HerwayWordmark,
} from '@/components/onboarding/IntroIllustrations';
import {
  ErrorState,
  IconButton,
  PrimaryButton,
  StandardInput,
} from '@/components/ui';
import { ElasticBounce } from '@/components/motion/HerwayMotion';

export default function LoginScreen() {
  const { user, login, register, signInWithSupabaseOAuth, exchangeSupabaseToken } = useAuth();
  const { updateProfileDraft } = useHerwayState();
  const router = useRouter();
  const layout = useResponsiveLayout();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    updateProfileDraft({
      fullName: user.fullName || '',
      homeCity: user.homeCity || '',
      bio: user.bio || '',
      interests: user.interests || [],
    });
    router.replace('/(onboarding)/language' as Href);
  }, [user]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const oauthError =
      hashParams.get('error_description') ||
      searchParams.get('error_description') ||
      hashParams.get('error') ||
      searchParams.get('error');

    if (oauthError) {
      const decoded = decodeURIComponent(oauthError.replace(/\+/g, ' '));
      if (decoded.includes('Unable to exchange external code')) {
        setErrorMsg(
          'Google Sign-In failed: Supabase could not exchange the Google authorization code. Check that the Google Client Secret in Supabase Dashboard → Authentication → Providers → Google matches Google Cloud Console.',
        );
      } else {
        setErrorMsg(`Google Sign-In failed: ${decoded}`);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (!supabase) return;
    const hasOAuthParams =
      window.location.hash.includes('access_token=') ||
      window.location.search.includes('code=');
    if (!hasOAuthParams) return;

    setSubmitting(true);
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) {
          setErrorMsg(error.message || 'OAuth session retrieval failed.');
          return;
        }
        if (!data.session?.access_token) return;
        try {
          const authedUser = await exchangeSupabaseToken(data.session.access_token);
          window.history.replaceState({}, document.title, window.location.pathname);
          updateProfileDraft({
            fullName: authedUser.fullName || '',
            homeCity: authedUser.homeCity || '',
            bio: authedUser.bio || '',
            interests: authedUser.interests || [],
          });
          router.replace('/(onboarding)/language' as Href);
        } catch (err) {
          setErrorMsg((err as Error).message || 'OAuth session exchange failed.');
        }
      })
      .finally(() => {
        setSubmitting(false);
      });
  }, []);

  async function handlePrimarySubmit() {
    setErrorMsg(null);
    if (!agreed) {
      setErrorMsg('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const authedUser =
        tab === 'login'
          ? await login(cleanEmail, password)
          : await register({
              email: cleanEmail,
              password,
              fullName: cleanEmail.split('@')[0] || 'Herway User',
              homeCity: 'Kochi',
              consentAccepted: true,
            });

      updateProfileDraft({
        fullName: authedUser.fullName || '',
        homeCity: authedUser.homeCity || '',
        bio: authedUser.bio || '',
        interests: authedUser.interests || [],
      });
      router.push('/(onboarding)/language' as Href);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSocialPress(provider: 'Google' | 'Apple') {
    setErrorMsg(null);
    if (!agreed) {
      setErrorMsg('Please agree to the Terms and Privacy Policy to continue.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithSupabaseOAuth(provider === 'Google' ? 'google' : 'apple');
    } catch (err) {
      setErrorMsg((err as Error).message || `${provider} OAuth failed.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <OnboardingLayout
      currentStep={2}
      onBack={() => router.replace('/welcome')}
      desktopHeading="Welcome to your Herway safety account"
      desktopSubheading="Sign in or create a single account for Safe Havens, Travel Buddies, live tracking, and emergency coordination."
      desktopIllustrationSlide={1}
    >
      <View style={styles.wordmarkRow}>
        <HerwayWordmark size={36} />
      </View>

      <View style={styles.segmentWrap}>
        <Pressable
          onPress={() => {
            setTab('login');
            setErrorMsg(null);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'login' }}
          style={[styles.segmentPill, tab === 'login' && styles.segmentPillActive]}
        >
          <Text style={[styles.segmentText, tab === 'login' && styles.segmentTextActive]}>
            Log in
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setTab('signup');
            setErrorMsg(null);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: tab === 'signup' }}
          style={[styles.segmentPill, tab === 'signup' && styles.segmentPillActive]}
        >
          <Text style={[styles.segmentText, tab === 'signup' && styles.segmentTextActive]}>
            Sign up
          </Text>
        </Pressable>
      </View>

      {errorMsg ? (
        <View style={styles.errorWrap}>
          <ErrorState inline message={errorMsg} />
        </View>
      ) : null}

      <View style={styles.formStack}>
        <StandardInput
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <StandardInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry={!showPassword}
          rightSlot={
            <IconButton
              icon={showPassword ? 'visibility-off' : 'visibility'}
              size="small"
              tone="surface"
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            />
          }
        />
      </View>

      <Pressable onPress={() => setAgreed((v) => !v)} style={styles.agreeRow}>
        <ElasticBounce pulseKey={agreed}>
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <MaterialIcons name="check" size={14} color={HerwayColors.white} />}
          </View>
        </ElasticBounce>
        <Text style={styles.agreeText}>
          I agree with{' '}
          <Text
            onPress={(e) => {
              e.stopPropagation();
              Alert.alert(
                'Terms & Privacy Policy',
                'Herway follows DPDP privacy protection: phone numbers stay masked in buddy chat, live location links expire automatically, and documents stay private to you.',
              );
            }}
            style={styles.termsLink}
          >
            Terms &amp; Privacy Policy
          </Text>
        </Text>
      </Pressable>

      <PrimaryButton
        label={submitting ? 'Please wait...' : tab === 'login' ? 'Log in' : 'Sign up'}
        loading={submitting}
        disabled={submitting}
        onPress={handlePrimarySubmit}
        fullWidth
      />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={[styles.socialRow, layout.isSmallMobile && styles.socialColSmall]}>
        <Pressable
          onPress={() => handleSocialPress('Google')}
          style={[styles.socialBtn, !layout.isSmallMobile && { flex: 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
        >
          <GoogleLogoSvg size={20} />
          <Text style={styles.socialText}>Google</Text>
        </Pressable>

        <Pressable
          onPress={() => handleSocialPress('Apple')}
          style={[styles.socialBtn, !layout.isSmallMobile && { flex: 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Continue with Apple"
        >
          <AppleLogoSvg size={20} color={HerwayColors.ink} />
          <Text style={styles.socialText}>Apple</Text>
        </Pressable>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  wordmarkRow: {
    marginTop: HerwaySpacing.sm,
    marginBottom: HerwaySpacing.xl,
    alignItems: 'center',
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
  errorWrap: {
    marginBottom: HerwaySpacing.lg,
  },
  formStack: {
    gap: HerwaySpacing.lg,
  },
  agreeRow: {
    minHeight: HerwaySizes.touchTargetMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
    marginTop: HerwaySpacing.md,
    marginBottom: HerwaySpacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: HerwayColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HerwayColors.white,
  },
  checkboxChecked: {
    backgroundColor: HerwayColors.ink,
    borderColor: HerwayColors.ink,
  },
  agreeText: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.ink,
    flex: 1,
    lineHeight: 19,
  },
  termsLink: {
    color: HerwayColors.tealDark,
    fontWeight: '700',
  },
  dividerRow: {
    marginVertical: HerwaySpacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  dividerLine: {
    flex: 1,
    height: HerwaySizes.borderWidth,
    backgroundColor: HerwayColors.border,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
    color: HerwayColors.muted,
  },
  socialRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
  },
  socialColSmall: {
    flexDirection: 'column',
  },
  socialBtn: {
    width: '100%',
    minHeight: HerwaySizes.buttonSecondary,
    paddingHorizontal: HerwaySpacing.lg,
    borderRadius: HerwayRadii.button,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    backgroundColor: HerwayColors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: HerwaySpacing.sm,
    ...HerwayShadows.card,
  },
  socialText: {
    fontSize: 14,
    fontWeight: '600',
    color: HerwayColors.ink,
  },
});
