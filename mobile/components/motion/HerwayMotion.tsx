import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  UIManager,
  View,
  ViewStyle,
} from 'react-native';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Respects OS & browser prefers-reduced-motion settings.
 */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((val) => {
        if (mounted) setReduced(Boolean(val));
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (val) => {
      if (mounted) setReduced(Boolean(val));
    });

    let mq: MediaQueryList | null = null;
    const onMqChange = (e: MediaQueryListEvent) => {
      if (mounted) setReduced(e.matches);
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduced(mq.matches);
      mq.addEventListener?.('change', onMqChange);
    }

    return () => {
      mounted = false;
      sub?.remove?.();
      mq?.removeEventListener?.('change', onMqChange);
    };
  }, []);

  return reduced;
}

/**
 * Layout-driven transition helper on native platforms.
 */
export function triggerSmoothLayout(reducedMotion = false): void {
  if (reducedMotion || Platform.OS === 'web') return;
  LayoutAnimation.configureNext({
    duration: 240,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: {
      type: LayoutAnimation.Types.spring,
      springDamping: 0.82,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

interface RevealMaskProps {
  children: React.ReactNode;
  triggerKey?: string | number;
  delay?: number;
  offsetX?: number;
  offsetY?: number;
  scrollTrigger?: boolean;
  mask?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hardware-accelerated reveal (transform + opacity only) inside an optional overflow:hidden mask,
 * with lightweight IntersectionObserver scroll triggering on web.
 */
export function RevealMask({
  children,
  triggerKey = 'default',
  delay = 0,
  offsetX = 0,
  offsetY = 14,
  scrollTrigger = true,
  mask = true,
  style,
}: RevealMaskProps) {
  const reduced = useReduceMotion();
  const containerRef = useRef<View | null>(null);
  const [inView, setInView] = useState(!scrollTrigger || Platform.OS !== 'web');

  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const translateX = useRef(new Animated.Value(reduced ? 0 : offsetX)).current;
  const translateY = useRef(new Animated.Value(reduced ? 0 : offsetY)).current;

  useEffect(() => {
    if (reduced) {
      setInView(true);
      return;
    }
    if (!scrollTrigger || Platform.OS !== 'web') {
      setInView(true);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const node = containerRef.current as unknown as Element | null;
    if (!node || typeof (node as Element).getBoundingClientRect !== 'function') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -16px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [scrollTrigger, reduced, triggerKey]);

  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      return;
    }

    if (!inView) {
      opacity.setValue(0);
      translateX.setValue(offsetX);
      translateY.setValue(offsetY);
      return;
    }

    opacity.setValue(0);
    translateX.setValue(offsetX);
    translateY.setValue(offsetY);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 340,
        delay,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 340,
        delay,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }, [inView, triggerKey, delay, offsetX, offsetY, reduced, opacity, translateX, translateY]);

  return (
    <View
      ref={containerRef}
      style={[mask && { overflow: 'hidden' }, style]}
    >
      <Animated.View
        style={{
          opacity,
          transform: [{ translateX }, { translateY }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

interface MagneticInteractiveProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  magnetStrength?: number;
  hoverScale?: number;
  hoverLiftY?: number;
  enableMagnet?: boolean;
  cooldownMs?: number;
}

/**
 * Hardware-accelerated (transform-only) hover lift, micro-bounce press,
 * optional cursor magnetism, and automatic double-click / async in-flight lock.
 */
export function MagneticInteractive({
  children,
  style,
  containerStyle,
  magnetStrength = 5,
  hoverScale = 1.02,
  hoverLiftY = -2,
  enableMagnet = false,
  cooldownMs = 340,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...rest
}: MagneticInteractiveProps) {
  const reduced = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const magX = useRef(new Animated.Value(0)).current;
  const magY = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);
  const [autoBusy, setAutoBusy] = useState(false);
  const inFlightRef = useRef(false);
  const lastPressAtRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const effectiveDisabled = Boolean(disabled) || autoBusy;

  const handleGuardedPress: NonNullable<PressableProps['onPress']> = (event) => {
    if (effectiveDisabled || inFlightRef.current) return;
    const now = Date.now();
    if (cooldownMs > 0 && now - lastPressAtRef.current < cooldownMs) return;
    lastPressAtRef.current = now;
    if (!onPress) return;
    const result = onPress(event) as unknown;
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      inFlightRef.current = true;
      if (mountedRef.current) setAutoBusy(true);
      void (result as Promise<unknown>).finally(() => {
        inFlightRef.current = false;
        if (mountedRef.current) setAutoBusy(false);
      });
    }
  };

  function animateScale(toValue: number, friction = 6, tension = 260) {
    if (reduced) return;
    Animated.spring(scale, {
      toValue,
      friction,
      tension,
      useNativeDriver: true,
    }).start();
  }

  function handleHoverIn() {
    setHovered(true);
    animateScale(hoverScale, 6, 240);
    if (!reduced && hoverLiftY !== 0) {
      Animated.spring(magY, {
        toValue: hoverLiftY,
        friction: 7,
        tension: 220,
        useNativeDriver: true,
      }).start();
    }
  }

  function handleHoverOut() {
    setHovered(false);
    animateScale(1, 6, 220);
    Animated.spring(magX, { toValue: 0, friction: 6, tension: 200, useNativeDriver: true }).start();
    Animated.spring(magY, { toValue: 0, friction: 6, tension: 200, useNativeDriver: true }).start();
  }

  function handlePointerMove(e: unknown) {
    if (reduced || !enableMagnet || Platform.OS !== 'web') return;
    const evt = e as {
      nativeEvent?: { pageX?: number; pageY?: number };
      currentTarget?: { getBoundingClientRect?: () => DOMRect };
      clientX?: number;
      clientY?: number;
    };
    const target = evt.currentTarget;
    if (!target || typeof target.getBoundingClientRect !== 'function') return;
    const rect = target.getBoundingClientRect();
    const clientX = evt.clientX ?? evt.nativeEvent?.pageX;
    const clientY = evt.clientY ?? evt.nativeEvent?.pageY;
    if (typeof clientX !== 'number' || typeof clientY !== 'number' || !rect.width || !rect.height) {
      return;
    }
    const relX = (clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const relY = (clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const clampedX = Math.max(-1, Math.min(1, relX)) * magnetStrength;
    const clampedY = Math.max(-1, Math.min(1, relY)) * magnetStrength + hoverLiftY;

    Animated.spring(magX, {
      toValue: clampedX,
      friction: 8,
      tension: 280,
      useNativeDriver: true,
    }).start();
    Animated.spring(magY, {
      toValue: clampedY,
      friction: 8,
      tension: 280,
      useNativeDriver: true,
    }).start();
  }

  const webProps =
    Platform.OS === 'web'
      ? ({
          onMouseEnter: handleHoverIn,
          onMouseLeave: handleHoverOut,
          onMouseMove: handlePointerMove,
        } as Record<string, unknown>)
      : {};

  const webCursorStyle =
    Platform.OS === 'web'
      ? ({ cursor: effectiveDisabled ? 'not-allowed' : 'pointer' } as unknown as ViewStyle)
      : undefined;

  const flatStyle = StyleSheet.flatten(style) || {};
  const pressableLayoutStyle: ViewStyle = {};
  if (flatStyle.flex !== undefined) pressableLayoutStyle.flex = flatStyle.flex;
  if (flatStyle.flexGrow !== undefined) pressableLayoutStyle.flexGrow = flatStyle.flexGrow;
  if (flatStyle.flexShrink !== undefined) pressableLayoutStyle.flexShrink = flatStyle.flexShrink;
  if (flatStyle.flexBasis !== undefined) pressableLayoutStyle.flexBasis = flatStyle.flexBasis;
  if (flatStyle.alignSelf !== undefined) pressableLayoutStyle.alignSelf = flatStyle.alignSelf;
  if (flatStyle.width !== undefined) pressableLayoutStyle.width = flatStyle.width;
  if (flatStyle.minWidth !== undefined) pressableLayoutStyle.minWidth = flatStyle.minWidth;
  if (flatStyle.maxWidth !== undefined) pressableLayoutStyle.maxWidth = flatStyle.maxWidth;

  return (
    <Pressable
      {...rest}
      {...webProps}
      disabled={effectiveDisabled}
      onPress={onPress ? handleGuardedPress : undefined}
      style={[pressableLayoutStyle, containerStyle]}
      onPressIn={(e) => {
        if (!effectiveDisabled) animateScale(0.96, 7, 320);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateScale(hovered && !effectiveDisabled ? hoverScale : 1, 5, 280);
        onPressOut?.(e);
      }}
    >
      <Animated.View
        style={[
          style,
          webCursorStyle,
          effectiveDisabled ? { opacity: 0.72 } : undefined,
          {
            transform: [{ translateX: magX }, { translateY: magY }, { scale }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Transform-only elastic micro-bounce triggered when `pulseKey` toggles.
 */
export function ElasticBounce({
  children,
  pulseKey,
  style,
}: {
  children: React.ReactNode;
  pulseKey: string | number | boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (reduced) return;
    scale.setValue(0.8);
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 280,
      useNativeDriver: true,
    }).start();
  }, [pulseKey, reduced, scale]);

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Hardware-accelerated live status pulse dot (transform scale only).
 */
export function LivePulseDot({ color, size = 7 }: { color: string; size?: number }) {
  const reduced = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.5,
          duration: 900,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, pulse]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ scale: pulse }],
      }}
    />
  );
}
