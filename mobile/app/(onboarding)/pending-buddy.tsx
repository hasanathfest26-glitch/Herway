import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useHerwayState } from '@/features/app/HerwayStateContext';

export default function PendingBuddyBypassScreen() {
  const { setBuddyVerificationStatus, completeOnboarding } = useHerwayState();

  useEffect(() => {
    setBuddyVerificationStatus('APPROVED');
    completeOnboarding();
  }, [setBuddyVerificationStatus, completeOnboarding]);

  return <Redirect href="/(tabs)" />;
}
