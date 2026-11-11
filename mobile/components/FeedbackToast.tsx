import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { MaterialIcons } from '@expo/vector-icons';
import { HerwayColors, HerwayShadows } from '@/constants/theme';
import { FeedbackEvent, subscribeFeedback } from '@/services/feedback';

export function FeedbackToast() {
  const [current, setCurrent] = useState<FeedbackEvent | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeFeedback((event) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrent(event);
      opacity.setValue(0);
      translateY.setValue(-16);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 160,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(translateY, {
            toValue: -12,
            duration: 160,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ]).start(() => setCurrent(null));
      }, 3600);
    });
  }, [opacity, translateY]);

  if (!current) return null;

  const isError = current.tone === 'error';
  const isSuccess = current.tone === 'success';
  const accent = isError
    ? HerwayColors.dangerText
    : isSuccess
      ? HerwayColors.successText
      : HerwayColors.tealDark;
  const iconColor = isError
    ? HerwayColors.danger
    : isSuccess
      ? HerwayColors.success
      : HerwayColors.tealDark;
  const bg = isError
    ? HerwayColors.dangerSoft
    : isSuccess
      ? HerwayColors.successSoft
      : HerwayColors.mintMid;
  const border = isError
    ? HerwayColors.dangerBorder
    : isSuccess
      ? HerwayColors.successBorder
      : HerwayColors.tealSoft;
  const iconName: keyof typeof MaterialIcons.glyphMap = isError
    ? 'error-outline'
    : isSuccess
      ? 'check-circle'
      : 'info-outline';

  return (
    <View style={styles.portal} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toastWrap,
          {
            backgroundColor: bg,
            borderColor: border,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Pressable
          onPress={() => setCurrent(null)}
          accessibilityRole="button"
          accessibilityLabel={`Dismiss notification: ${current.title}`}
          style={styles.toastPress}
        >
          <MaterialIcons name={iconName} size={20} color={iconColor} />
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: accent }]}>{current.title}</Text>
            {!!current.message && <Text style={styles.message}>{current.message}</Text>}
          </View>
          <MaterialIcons name="close" size={16} color={HerwayColors.muted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  portal: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 18 : 54,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastWrap: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 18,
    borderWidth: 1,
    ...HerwayShadows.card,
  },
  toastPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  message: {
    fontSize: 12,
    fontWeight: '500',
    color: HerwayColors.ink,
    lineHeight: 17,
  },
});
