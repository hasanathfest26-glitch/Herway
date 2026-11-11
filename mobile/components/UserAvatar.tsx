import React from 'react';
import { Image, ImageStyle, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HerwayColors } from '@/constants/theme';

interface UserAvatarProps {
  uri?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

/**
 * Renders the user's uploaded profile photo when set,
 * or a neutral icon silhouette placeholder (never a stock template photo).
 */
export function UserAvatar({ uri, size, style, imageStyle }: UserAvatarProps) {
  const cleanUri = uri?.trim();
  const radius = size / 2;

  if (cleanUri) {
    return (
      <Image
        source={{ uri: cleanUri }}
        style={[{ width: size, height: size, borderRadius: radius }, imageStyle]}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
    >
      <MaterialIcons
        name="person"
        size={Math.max(16, Math.round(size * 0.56))}
        color={HerwayColors.tealDark}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: HerwayColors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
