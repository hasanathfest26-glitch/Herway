import React, { createContext, useContext, useState } from 'react';
import { PILOT_CITIES } from '@/data/herwayCatalog';

export type PilotCity = (typeof PILOT_CITIES)[number];
export type RoleChoice = 'TRAVELLER' | 'TRAVEL_BUDDY' | 'BOTH';
export type VerificationState = 'NONE' | 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface OnboardingProfileDraft {
  fullName: string;
  homeCity: string;
  dateOfBirth: string;
  occupation: string;
  gender: 'FEMALE' | 'MALE';
  bio: string;
  avatarUri: string | null;
  interests: string[];
}

interface HerwayStateValue {
  selectedCity: PilotCity;
  setSelectedCity: (city: PilotCity) => void;
  cycleCity: () => void;
  favourites: Record<string, boolean>;
  toggleFavourite: (id: string) => void;
  hasOnboarded: boolean;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  accountVerified: boolean;
  setAccountVerified: (verified: boolean) => void;
  profileDraft: OnboardingProfileDraft;
  updateProfileDraft: (patch: Partial<OnboardingProfileDraft>) => void;
  selectedRoleChoice: RoleChoice;
  setSelectedRoleChoice: (role: RoleChoice) => void;
  buddyVerificationStatus: VerificationState;
  setBuddyVerificationStatus: (status: VerificationState) => void;
}

const HerwayStateContext = createContext<HerwayStateValue | null>(null);

export function HerwayStateProvider({ children }: { children: React.ReactNode }) {
  const [selectedCity, setSelectedCity] = useState<PilotCity>('Kochi');
  const [favourites, setFavourites] = useState<Record<string, boolean>>({});
  const [hasOnboarded, setHasOnboarded] = useState(false);

  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [accountVerified, setAccountVerified] = useState(false);
  const [profileDraft, setProfileDraft] = useState<OnboardingProfileDraft>({
    fullName: '',
    homeCity: '',
    dateOfBirth: '',
    occupation: '',
    gender: 'FEMALE',
    bio: '',
    avatarUri: null,
    interests: [],
  });
  const [selectedRoleChoice, setSelectedRoleChoice] = useState<RoleChoice>('TRAVELLER');
  const [buddyVerificationStatus, setBuddyVerificationStatus] =
    useState<VerificationState>('NONE');

  function cycleCity() {
    const idx = PILOT_CITIES.indexOf(selectedCity);
    const next = PILOT_CITIES[(idx + 1) % PILOT_CITIES.length];
    setSelectedCity(next);
  }

  function toggleFavourite(id: string) {
    setFavourites((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function completeOnboarding() {
    setHasOnboarded(true);
  }

  function resetOnboarding() {
    setHasOnboarded(false);
    setAccountVerified(false);
    setBuddyVerificationStatus('NONE');
    setProfileDraft({
      fullName: '',
      homeCity: '',
      dateOfBirth: '',
      occupation: '',
      gender: 'FEMALE',
      bio: '',
      avatarUri: null,
      interests: [],
    });
  }

  function updateProfileDraft(patch: Partial<OnboardingProfileDraft>) {
    setProfileDraft((prev) => ({ ...prev, ...patch }));
  }

  return (
    <HerwayStateContext.Provider
      value={{
        selectedCity,
        setSelectedCity,
        cycleCity,
        favourites,
        toggleFavourite,
        hasOnboarded,
        completeOnboarding,
        resetOnboarding,
        selectedLanguage,
        setSelectedLanguage,
        accountVerified,
        setAccountVerified,
        profileDraft,
        updateProfileDraft,
        selectedRoleChoice,
        setSelectedRoleChoice,
        buddyVerificationStatus,
        setBuddyVerificationStatus,
      }}
    >
      {children}
    </HerwayStateContext.Provider>
  );
}

export function useHerwayState(): HerwayStateValue {
  const ctx = useContext(HerwayStateContext);
  if (!ctx) throw new Error('useHerwayState must be used inside HerwayStateProvider');
  return ctx;
}
