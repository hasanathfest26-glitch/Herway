import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/features/auth/AuthContext';
import { HerwayStateProvider } from '@/features/app/HerwayStateContext';
import { FeedbackToast } from '@/components/FeedbackToast';
import { HerwayColors } from '@/constants/theme';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (document.getElementById('herway-web-motion-css')) return;
    const style = document.createElement('style');
    style.id = 'herway-web-motion-css';
    style.textContent = `
      :root {
        --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
        --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
        --dur-fast: 150ms;
        --dur-base: 260ms;
        --dur-reveal: 420ms;
      }
      ::selection { background: #C5EFF2; color: #131A20; }
      *:focus-visible { outline: 2px solid #00B6C7; outline-offset: 2px; border-radius: 8px; }
      input:focus-visible, textarea:focus-visible { outline: none; }
      button, [role="button"], [tabindex="0"]:not(input):not(textarea):not(select) {
        cursor: pointer;
        user-select: none;
        transition: transform 110ms var(--ease-out-expo), opacity 110ms ease, filter 110ms ease;
      }
      button:not(:disabled):active, [role="button"]:not([aria-disabled="true"]):active, [tabindex="0"]:not(input):not(textarea):not(select):not([aria-disabled="true"]):active {
        transform: scale3d(0.965, 0.965, 1) !important;
        opacity: 0.86 !important;
      }
      button:disabled, [aria-disabled="true"] {
        cursor: not-allowed !important;
      }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: #FAF9F4; }
      ::-webkit-scrollbar-thumb { background: #CFD8DC; border-radius: 999px; }
      ::-webkit-scrollbar-thumb:hover { background: #00B6C7; }
      .herway-mask { overflow: hidden; }
      .herway-reveal {
        opacity: 0;
        transform: translate3d(0, 14px, 0);
        transition: transform var(--dur-reveal) var(--ease-out-expo), opacity var(--dur-reveal) var(--ease-out-expo);
      }
      .herway-reveal[data-visible="true"] {
        opacity: 1;
        transform: translate3d(0, 0, 0);
      }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
        .herway-reveal {
          opacity: 1 !important;
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <AuthProvider>
      <HerwayStateProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: HerwayColors.creamBg },
            headerTintColor: HerwayColors.ink,
            headerTitleStyle: { fontWeight: '700', color: HerwayColors.ink },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)/language" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)/verify-account" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)/create-profile" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)/select-role" options={{ headerShown: false }} />
          <Stack.Screen name="(onboarding)/pending-buddy" options={{ headerShown: false }} />
          <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
          <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="details/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="sos"
            options={{ headerShown: true, title: 'SOS Emergency Support', presentation: 'modal' }}
          />
          <Stack.Screen
            name="chat/[bookingId]"
            options={{ headerShown: true, title: 'Private Booking Chat' }}
          />
          <Stack.Screen
            name="modals/offline-pack"
            options={{ headerShown: true, title: 'Offline Safety Pack', presentation: 'modal' }}
          />
        </Stack>
        <FeedbackToast />
      </HerwayStateProvider>
    </AuthProvider>
  );
}
