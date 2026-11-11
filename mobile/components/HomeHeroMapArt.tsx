import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { HerwayColors } from '@/constants/theme';

interface HomeHeroMapArtProps {
  /** Minimal pin positions tailored slightly per city name hash so each destination feels alive */
  seed?: string;
}

const PIN_SETS: Array<Array<{ x: number; y: number; r?: number }>> = [
  [
    { x: 245, y: 54 },
    { x: 292, y: 84 },
    { x: 204, y: 98 },
    { x: 332, y: 112 },
  ],
  [
    { x: 218, y: 62 },
    { x: 278, y: 56 },
    { x: 312, y: 96 },
    { x: 248, y: 112 },
  ],
  [
    { x: 196, y: 74 },
    { x: 256, y: 48 },
    { x: 306, y: 78 },
    { x: 272, y: 116 },
  ],
];

export function HomeHeroMapArt({ seed = 'Kochi' }: HomeHeroMapArtProps) {
  const hash = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const pins = PIN_SETS[hash % PIN_SETS.length];

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 400 180"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="seaGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#E4F6F9" />
            <Stop offset="65%" stopColor="#CBEFF4" />
            <Stop offset="100%" stopColor="#E9F7F7" />
          </LinearGradient>
          <LinearGradient id="landGrad" x1="0.2" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#F2F7EE" />
            <Stop offset="100%" stopColor="#D7ECDA" />
          </LinearGradient>
          <LinearGradient id="titleWash" x1="0" y1="0" x2="0.65" y2="0.45">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
            <Stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.58" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Coastal water base */}
        <Rect x="0" y="0" width="400" height="180" fill="url(#seaGrad)" />

        {/* Kerala coastline & Western Ghats terrain silhouettes */}
        <Path
          d="M 135 0 C 148 32, 140 62, 162 94 C 180 120, 174 152, 202 180 L 400 180 L 400 0 Z"
          fill="url(#landGrad)"
        />
        <Path
          d="M 214 0 C 232 34, 224 72, 250 104 C 272 132, 270 156, 294 180 L 400 180 L 400 0 Z"
          fill="#C9E3CB"
          opacity={0.72}
        />
        <Path
          d="M 294 0 C 314 28, 308 66, 332 96 C 352 122, 344 152, 366 180 L 400 180 L 400 0 Z"
          fill="#B6D7BC"
          opacity={0.62}
        />

        {/* Soft road / backwater contour curves */}
        <Path
          d="M 164 26 Q 222 52, 256 96 T 330 162"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.75}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <Path
          d="M 192 142 Q 254 114, 308 118 T 386 84"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.55}
          strokeWidth={2}
          strokeLinecap="round"
        />

        {/* Subtle grid latitude lines */}
        <Path
          d="M 0 60 L 400 60 M 0 120 L 400 120 M 140 0 L 140 180 M 270 0 L 270 180"
          stroke={HerwayColors.tealDark}
          strokeOpacity={0.06}
          strokeWidth={1}
        />

        {/* Minimal verified destination markers */}
        {pins.map((pin, idx) => (
          <G key={idx} transform={`translate(${pin.x}, ${pin.y})`}>
            <Circle cx={0} cy={0} r={11} fill={HerwayColors.teal} fillOpacity={0.14} />
            <Path
              d="M 0 -13 C -5.5 -13, -9 -9, -9 -4 C -9 2.5, 0 10, 0 10 C 0 10, 9 2.5, 9 -4 C 9 -9, 5.5 -13, 0 -13 Z"
              fill={HerwayColors.tealDark}
              stroke="#FFFFFF"
              strokeWidth={1.6}
            />
            <Circle cx={0} cy={-4} r={2.8} fill="#FFFFFF" />
          </G>
        ))}

        {/* Readability wash behind top-left card headline */}
        <Rect x="0" y="0" width="400" height="180" fill="url(#titleWash)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
  },
});
