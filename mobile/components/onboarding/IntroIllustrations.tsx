import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Ellipse,
  G,
  Path,
  Rect,
} from 'react-native-svg';
import { HerwayColors } from '@/constants/theme';

export function HerwayWordmark({ size = 34 }: { size?: number }) {
  return (
    <View style={styles.wordmarkWrap}>
      <Text style={[styles.wordmark, { fontSize: size, lineHeight: size * 1.15 }]}>
        herway
      </Text>
    </View>
  );
}

export function GoogleLogoSvg({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#EA4335"
        d="M12 5.04c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.77 14.97 1 12 1 7.39 1 3.41 3.63 1.49 7.46l3.7 2.87C6.07 7.67 8.79 5.04 12 5.04z"
      />
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-1.99 3.72-4.93 3.72-8.69z"
      />
      <Path
        fill="#FBBC05"
        d="M5.19 14.67A6.96 6.96 0 0 1 4.82 12c0-.93.16-1.82.37-2.67l-3.7-2.87A11.96 11.96 0 0 0 0 12c0 1.93.46 3.76 1.49 5.54l3.7-2.87z"
      />
      <Path
        fill="#34A853"
        d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.08.72-2.45 1.16-4.23 1.16-3.21 0-5.93-2.63-6.81-6.29l-3.7 2.87C3.41 20.37 7.39 23 12 23z"
      />
    </Svg>
  );
}

export function AppleLogoSvg({ size = 18, color = '#131A20' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
      />
    </Svg>
  );
}

/**
 * Flat vector travel-safety illustrations matching Image 1's cyan-oval + floating-objects style.
 */
export function IntroSlideIllustration({ slideIndex, size = 290 }: { slideIndex: number; size?: number }) {
  if (slideIndex === 1) {
    // Slide 2: Companions & Verified Buddies
    return (
      <Svg width={size} height={size} viewBox="0 0 300 280">
        <Ellipse cx="150" cy="242" rx="116" ry="20" fill="#44CDD2" opacity={0.85} />
        {/* Floating chat bubble */}
        <G transform="translate(176, 36)">
          <Rect x="0" y="0" width="76" height="44" rx="14" fill="#FFFFFF" />
          <Circle cx="22" cy="22" r="4.5" fill="#00B6C7" />
          <Circle cx="38" cy="22" r="4.5" fill="#00B6C7" />
          <Circle cx="54" cy="22" r="4.5" fill="#00B6C7" />
        </G>
        {/* Floating Shield */}
        <G transform="translate(54, 46)">
          <Path d="M24 2L44 10V26C44 39 35 49 24 54C13 49 4 39 4 26V10L24 2Z" fill="#00B6C7" />
          <Path d="M16 28L22 34L33 21" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
        {/* Left Companion Card */}
        <Rect x="62" y="106" width="84" height="122" rx="22" fill="#FFFFFF" />
        <Circle cx="104" cy="144" r="22" fill="#FBBF24" />
        <Circle cx="104" cy="140" r="14" fill="#FDE68A" />
        <Path d="M78 206C78 188 90 176 104 176C118 176 130 188 130 206Z" fill="#00B6C7" />
        <Rect x="82" y="212" width="44" height="8" rx="4" fill="#E5E7EB" />
        {/* Right Companion Card */}
        <Rect x="154" y="94" width="88" height="136" rx="22" fill="#0B182B" />
        <Circle cx="198" cy="136" r="23" fill="#00B6C7" />
        <Circle cx="198" cy="132" r="14" fill="#FDE68A" />
        <Path d="M170 202C170 183 182 170 198 170C214 170 226 183 226 202Z" fill="#33C6D4" />
        <Circle cx="222" cy="110" r="10" fill="#10B981" />
        <Path d="M217 110L220.5 113.5L227 106.5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    );
  }

  if (slideIndex === 2) {
    // Slide 3: Live Location, Safe Haven & Check-ins
    return (
      <Svg width={size} height={size} viewBox="0 0 300 280">
        <Ellipse cx="150" cy="242" rx="116" ry="20" fill="#44CDD2" opacity={0.85} />
        {/* Map card */}
        <Rect x="58" y="88" width="184" height="142" rx="24" fill="#FFFFFF" />
        <Rect x="72" y="102" width="156" height="114" rx="16" fill="#E6F8F9" />
        {/* Route line */}
        <Path
          d="M90 190C115 160 140 185 162 150C178 126 196 136 210 118"
          stroke="#00B6C7"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="10 10"
          fill="none"
        />
        {/* Location pin */}
        <G transform="translate(132, 34)">
          <Path
            d="M28 4C15.8 4 6 13.8 6 26C6 42.5 28 64 28 64C28 64 50 42.5 50 26C50 13.8 40.2 4 28 4Z"
            fill="#00B6C7"
          />
          <Circle cx="28" cy="26" r="10" fill="#FFFFFF" />
        </G>
        {/* Floating SOS / Safe Haven Pill */}
        <G transform="translate(180, 152)">
          <Rect x="0" y="0" width="74" height="44" rx="14" fill="#0B182B" />
          <Circle cx="22" cy="22" r="10" fill="#EF4444" />
          <Rect x="38" y="16" width="24" height="5" rx="2.5" fill="#FFFFFF" />
          <Rect x="38" y="25" width="16" height="4" rx="2" fill="#A3B4CC" />
        </G>
        {/* Floating Safe Check-In Badge */}
        <G transform="translate(42, 134)">
          <Rect x="0" y="0" width="66" height="40" rx="12" fill="#10B981" />
          <Path d="M22 20L29 27L44 13" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      </Svg>
    );
  }

  // Slide 1 (default): Travel bag & floating safety essentials (mirrors Image 1's composition)
  return (
    <Svg width={size} height={size} viewBox="0 0 300 280">
      {/* Teal oval floor shadow matching Image 1 */}
      <Ellipse cx="150" cy="242" rx="116" ry="20" fill="#44CDD2" opacity={0.85} />

      {/* Floating items above travel bag (matching floating objects aesthetic) */}
      {/* Compass */}
      <Circle cx="92" cy="68" r="18" fill="#F59E0B" />
      <Circle cx="92" cy="68" r="12" fill="#FEF3C7" />
      <Path d="M92 60L96 68L92 76L88 68Z" fill="#00B6C7" />

      {/* Boarding Pass / Ticket */}
      <G transform="translate(128, 28) rotate(-10)">
        <Rect x="0" y="0" width="38" height="54" rx="8" fill="#FFFFFF" />
        <Rect x="6" y="8" width="26" height="6" rx="3" fill="#00B6C7" />
        <Rect x="6" y="20" width="20" height="4" rx="2" fill="#CBD5E1" />
        <Rect x="6" y="28" width="24" height="4" rx="2" fill="#CBD5E1" />
        <Rect x="6" y="38" width="16" height="8" rx="2" fill="#F59E0B" />
      </G>

      {/* Safe Pin */}
      <G transform="translate(194, 42) rotate(12)">
        <Path
          d="M18 2C9.2 2 2 9.2 2 18C2 30 18 44 18 44C18 44 34 30 34 18C34 9.2 26.8 2 18 2Z"
          fill="#EF4444"
        />
        <Circle cx="18" cy="18" r="6" fill="#FFFFFF" />
      </G>

      {/* Passport */}
      <G transform="translate(64, 108) rotate(-14)">
        <Rect x="0" y="0" width="34" height="44" rx="6" fill="#1D4ED8" />
        <Circle cx="17" cy="20" r="7" stroke="#FBBF24" strokeWidth="2" fill="none" />
        <Rect x="9" y="32" width="16" height="3" rx="1.5" fill="#FBBF24" />
      </G>

      {/* Safety Shield */}
      <G transform="translate(206, 102) rotate(8)">
        <Path d="M20 2L38 9V22C38 33 30 41 20 46C10 41 2 33 2 22V9L20 2Z" fill="#10B981" />
        <Path d="M13 24L18 29L27 18" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>

      {/* Center Travel Suitcase / Cart-inspired bright hero carrier */}
      <Rect x="132" y="100" width="36" height="22" rx="6" stroke="#334155" strokeWidth="6" fill="none" />
      <Rect x="84" y="118" width="132" height="106" rx="22" fill="#FFFFFF" />
      <Rect x="94" y="128" width="112" height="86" rx="16" fill="#00B6C7" />
      {/* Accent straps & badge */}
      <Rect x="116" y="128" width="14" height="86" fill="#F59E0B" />
      <Rect x="170" y="128" width="14" height="86" fill="#F59E0B" />
      <Rect x="134" y="156" width="32" height="26" rx="8" fill="#FFFFFF" />
      <Path d="M144 169L148 173L157 164" stroke="#00B6C7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Wheels */}
      <Circle cx="108" cy="232" r="10" fill="#1E293B" />
      <Circle cx="108" cy="232" r="4" fill="#F59E0B" />
      <Circle cx="192" cy="232" r="10" fill="#1E293B" />
      <Circle cx="192" cy="232" r="4" fill="#F59E0B" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wordmarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1.4,
    color: HerwayColors.tealWordmark,
  },
});
