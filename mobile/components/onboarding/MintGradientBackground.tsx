import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { HerwayColors } from '@/constants/theme';

interface MintGradientBackgroundProps {
  variant?: 'soft' | 'hero';
}

export function MintGradientBackground({ variant = 'soft' }: MintGradientBackgroundProps) {
  const topColor = variant === 'hero' ? '#BCEBEC' : HerwayColors.mintTop;
  const midColor = variant === 'hero' ? '#E4F6F7' : HerwayColors.mintMid;
  const bottomColor = HerwayColors.creamBg;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`mintBg_${variant}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={topColor} stopOpacity="1" />
            <Stop offset="34%" stopColor={midColor} stopOpacity="1" />
            <Stop offset="72%" stopColor={bottomColor} stopOpacity="1" />
            <Stop offset="100%" stopColor={bottomColor} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#mintBg_${variant})`} />
      </Svg>
    </View>
  );
}
