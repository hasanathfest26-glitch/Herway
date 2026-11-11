import React, { forwardRef, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable as RNPressable,
  PressableProps as RNPressableProps,
  PressableStateCallbackType,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';

export interface InteractivePressableProps extends RNPressableProps {
  /** Minimum cooldown (ms) between synchronous clicks on this button to block accidental double-clicks. Set 0 to disable. */
  cooldownMs?: number;
  /** Disable built-in pressed scale/opacity animation if a component handles its own pressed animation. */
  disablePressFeedback?: boolean;
  /** Custom style applied while actively pressed. */
  pressedStyle?: StyleProp<ViewStyle>;
}

function isPromiseLike(val: unknown): val is Promise<unknown> {
  return Boolean(val) && typeof (val as Promise<unknown>).then === 'function';
}

/**
 * Drop-in replacement for React Native's `Pressable` that provides:
 * 1. Immediate visual click/tap feedback (`scale: 0.965` + subtle opacity dip)
 * 2. Automatic single-flight lock while async `onPress` Promises are running
 * 3. Rapid double-click cooldown (`320ms` default) for synchronous clicks/navigation
 */
export const Pressable = forwardRef<View, InteractivePressableProps>(
  function InteractivePressable(
    {
      onPress,
      disabled,
      cooldownMs = 320,
      disablePressFeedback = false,
      pressedStyle,
      style,
      accessibilityState,
      ...rest
    },
    ref,
  ) {
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

    const handlePress: NonNullable<RNPressableProps['onPress']> = (event) => {
      if (effectiveDisabled || inFlightRef.current) return;

      const now = Date.now();
      if (cooldownMs > 0 && now - lastPressAtRef.current < cooldownMs) {
        return;
      }
      lastPressAtRef.current = now;

      if (!onPress) return;
      const result = onPress(event) as unknown;

      if (isPromiseLike(result)) {
        inFlightRef.current = true;
        if (mountedRef.current) setAutoBusy(true);
        void result.finally(() => {
          inFlightRef.current = false;
          if (mountedRef.current) setAutoBusy(false);
        });
      }
    };

    const webCursor =
      Platform.OS === 'web'
        ? ({ cursor: effectiveDisabled ? 'not-allowed' : 'pointer' } as unknown as ViewStyle)
        : undefined;

    return (
      <RNPressable
        {...rest}
        ref={ref}
        disabled={effectiveDisabled}
        onPress={onPress ? handlePress : undefined}
        accessibilityState={{
          ...accessibilityState,
          disabled: effectiveDisabled,
          busy: Boolean(accessibilityState?.busy || autoBusy),
        }}
        style={(state: PressableStateCallbackType) => {
          const resolvedStyle = typeof style === 'function' ? style(state) : style;
          const feedback: ViewStyle | undefined =
            !disablePressFeedback && state.pressed && !effectiveDisabled
              ? { opacity: 0.84, transform: [{ scale: 0.965 }] }
              : autoBusy
                ? { opacity: 0.72 }
                : undefined;

          return [
            webCursor,
            resolvedStyle,
            feedback,
            state.pressed && !effectiveDisabled ? pressedStyle : undefined,
          ];
        }}
      />
    );
  },
);
