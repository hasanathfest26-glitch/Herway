import React from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Pressable } from '@/components/InteractivePressable';
import { Tabs, usePathname, useRouter } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PersistentSosButton } from '@/components/PersistentSosButton';
import { UserAvatar } from '@/components/UserAvatar';
import {
  HerwayColors,
  HerwayRadii,
  HerwayShadows,
  HerwaySizes,
  HerwaySpacing,
} from '@/constants/theme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { HerwayWordmark } from '@/components/onboarding/IntroIllustrations';
import { LivePulseDot, MagneticInteractive } from '@/components/motion/HerwayMotion';
import { useAuth } from '@/features/auth/AuthContext';
import { useHerwayState } from '@/features/app/HerwayStateContext';

const TAB_ITEMS: Array<{
  route: string;
  label: string;
  shortLabel: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}> = [
  { route: 'index', label: 'Overview', shortLabel: 'Home', icon: 'dashboard' },
  { route: 'explore', label: 'Safe Network', shortLabel: 'Havens', icon: 'verified-user' },
  { route: 'people', label: 'Companions', shortLabel: 'People', icon: 'groups' },
  { route: 'bookings', label: 'Bookings', shortLabel: 'Bookings', icon: 'event-note' },
  { route: 'profile', label: 'Safety & Profile', shortLabel: 'Profile', icon: 'tune' },
];

const MOBILE_ICON_MAP: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  index: 'home',
  bookings: 'date-range',
  explore: 'search',
  people: 'favorite',
  profile: 'settings',
};

function DesktopTopNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { user } = useAuth();
  const { selectedCity, cycleCity } = useHerwayState();

  const isCompactTablet = layout.isTablet; // 768 - 1023px

  function isRouteActive(route: string) {
    if (route === 'index') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname.startsWith(`/${route}`);
  }

  function showAlerts() {
    Alert.alert(
      'Herway Safety Updates',
      '• Scheduled Check-In reminders active\n• Verified Safe Havens & India 112 cached offline',
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Open Offline Pack', onPress: () => router.push('/modals/offline-pack') },
      ],
    );
  }

  const webGlassBar =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(14px)',
          backgroundColor: 'rgba(255,255,255,0.92)',
        } as unknown as ViewStyle)
      : undefined;

  return (
    <View style={[styles.desktopBarOuter, webGlassBar]}>
      <View
        style={[
          styles.desktopBarInner,
          {
            maxWidth: layout.maxContentWidth,
            paddingHorizontal: layout.pageGutter,
          },
        ]}
      >
        {/* Left: Brand + Pilot City Pill */}
        <View style={styles.desktopLeft}>
          <Pressable
            onPress={() => router.push('/(tabs)')}
            accessibilityRole="button"
            accessibilityLabel="Herway Home"
            style={styles.brandPress}
          >
            <HerwayWordmark size={isCompactTablet ? 21 : 26} />
          </Pressable>
          {!isCompactTablet && (
            <MagneticInteractive
              onPress={cycleCity}
              magnetStrength={3}
              hoverScale={1.02}
              hoverLiftY={-1}
              style={styles.cityPill}
              accessibilityLabel="Switch pilot city"
            >
              <MaterialIcons name="location-on" size={16} color={HerwayColors.tealDark} />
              <Text style={styles.cityText} numberOfLines={1}>
                {user?.homeCity || `${selectedCity}, Kerala`}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={16} color={HerwayColors.muted} />
            </MagneticInteractive>
          )}
        </View>

        {/* Center: Horizontal Navigation Links */}
        <View style={[styles.desktopNavRow, isCompactTablet && { gap: 2 }]}>
          {TAB_ITEMS.map((item) => {
            const active = isRouteActive(item.route);
            return (
              <MagneticInteractive
                key={item.route}
                onPress={() =>
                  router.push(item.route === 'index' ? '/(tabs)' : (`/(tabs)/${item.route}` as any))
                }
                magnetStrength={2}
                hoverScale={1.02}
                hoverLiftY={-1}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={[
                  styles.desktopNavLink,
                  isCompactTablet && styles.desktopNavLinkCompact,
                  active && styles.desktopNavLinkActive,
                ]}
              >
                <MaterialIcons
                  name={item.icon}
                  size={isCompactTablet ? 16 : 18}
                  color={active ? HerwayColors.tealDark : HerwayColors.muted}
                />
                <Text
                  style={[
                    styles.desktopNavLabel,
                    isCompactTablet && { fontSize: 12 },
                    active && styles.desktopNavLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {isCompactTablet ? item.shortLabel : item.label}
                </Text>
              </MagneticInteractive>
            );
          })}
        </View>

        {/* Right: Utility Controls + SOS Pill + Profile */}
        <View style={[styles.desktopRight, isCompactTablet && { gap: HerwaySpacing.xs }]}>
          <MagneticInteractive
            onPress={() => router.push('/modals/offline-pack')}
            magnetStrength={2}
            hoverScale={1.02}
            hoverLiftY={-1}
            style={[styles.utilityPill, isCompactTablet && styles.utilityIconOnly]}
            accessibilityLabel="Open Offline Safety Pack"
          >
            <MaterialIcons name="offline-pin" size={18} color={HerwayColors.ink} />
            {!isCompactTablet && <Text style={styles.utilityText}>Offline Pack</Text>}
          </MagneticInteractive>

          <MagneticInteractive
            onPress={showAlerts}
            magnetStrength={2}
            hoverScale={1.03}
            hoverLiftY={-1}
            style={styles.bellBtn}
            accessibilityLabel="Safety alerts"
          >
            <MaterialIcons name="notifications-none" size={20} color={HerwayColors.ink} />
            <View style={styles.bellDot}>
              <LivePulseDot color={HerwayColors.teal} size={7} />
            </View>
          </MagneticInteractive>

          <MagneticInteractive
            onPress={() => router.push('/sos')}
            enableMagnet
            magnetStrength={3}
            hoverScale={1.03}
            hoverLiftY={-1}
            style={styles.desktopSosBtn}
            accessibilityRole="button"
            accessibilityLabel="Open SOS Emergency Support"
          >
            <MaterialIcons name="warning" size={16} color={HerwayColors.white} />
            <Text style={styles.desktopSosText}>SOS</Text>
          </MagneticInteractive>

          <MagneticInteractive
            onPress={() => router.push(user ? '/edit-profile' : '/(auth)/login')}
            magnetStrength={2}
            hoverScale={1.02}
            hoverLiftY={-1}
            style={[styles.profilePill, isCompactTablet && styles.profilePillCompact]}
            accessibilityLabel="Open editable profile"
          >
            <UserAvatar uri={user?.avatarUrl} size={28} />
            {!isCompactTablet && (
              <Text style={styles.profileName} numberOfLines={1}>
                {user ? user.fullName.split(' ')[0] : 'Sign In'}
              </Text>
            )}
          </MagneticInteractive>
        </View>
      </View>
    </View>
  );
}

function MobileBottomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, HerwaySpacing.md);

  return (
    <View style={[styles.mobileTabBarWrap, { paddingBottom: bottomPad, height: 76 + bottomPad }]}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const { options } = descriptors[route.key];
        const iconName = MOBILE_ICON_MAP[route.name] ?? 'circle';
        const isCenterSearch = route.name === 'explore';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        if (isCenterSearch) {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel={options.title ?? 'Explore Safe Havens'}
              style={({ pressed }) => [
                styles.centerCircle,
                isFocused && styles.centerCircleActive,
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
            >
              <MaterialIcons
                name="search"
                size={24}
                color={isFocused ? HerwayColors.tealDark : HerwayColors.ink}
              />
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={options.title ?? route.name}
            style={styles.tabItem}
          >
            <MaterialIcons
              name={iconName}
              size={24}
              color={isFocused ? HerwayColors.white : '#8A97A4'}
            />
            {isFocused ? (
              <View style={styles.activeIndicator} />
            ) : (
              <View style={styles.inactiveSpacer} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const layout = useResponsiveLayout();
  const isWide = layout.isWideLayout; // >= 768px

  return (
    <View style={{ flex: 1, backgroundColor: HerwayColors.creamBg }}>
      {isWide && <DesktopTopNavbar />}
      <Tabs
        tabBar={(props) => (isWide ? null : <MobileBottomTabBar {...props} />)}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
        <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
        <Tabs.Screen name="people" options={{ title: 'People' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
      {!isWide && <PersistentSosButton />}
    </View>
  );
}

const styles = StyleSheet.create({
  desktopBarOuter: {
    backgroundColor: HerwayColors.white,
    borderBottomWidth: HerwaySizes.borderWidth,
    borderBottomColor: HerwayColors.border,
    zIndex: 40,
  },
  desktopBarInner: {
    width: '100%',
    alignSelf: 'center',
    height: HerwaySizes.navbarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: HerwaySpacing.md,
  },
  desktopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.md,
    flexShrink: 0,
  },
  brandPress: {
    minHeight: HerwaySizes.touchTargetMin,
    justifyContent: 'center',
  },
  cityPill: {
    minHeight: HerwaySizes.buttonSmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    backgroundColor: HerwayColors.inputBg,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.inputBorder,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
  },
  cityText: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.ink,
  },
  desktopNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    flexShrink: 1,
  },
  desktopNavLink: {
    minHeight: HerwaySizes.buttonSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    paddingHorizontal: HerwaySpacing.md,
    paddingVertical: HerwaySpacing.sm,
    borderRadius: HerwayRadii.button,
  },
  desktopNavLinkCompact: {
    paddingHorizontal: HerwaySpacing.sm,
    gap: HerwaySpacing.xs,
  },
  desktopNavLinkActive: {
    backgroundColor: HerwayColors.tealSoft,
  },
  desktopNavLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.textSecondary,
  },
  desktopNavLabelActive: {
    color: HerwayColors.tealDark,
    fontWeight: '700',
  },
  desktopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    flexShrink: 0,
  },
  utilityPill: {
    minHeight: HerwaySizes.buttonSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    paddingHorizontal: HerwaySpacing.md,
    borderRadius: HerwayRadii.button,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    backgroundColor: HerwayColors.white,
  },
  utilityIconOnly: {
    width: HerwaySizes.touchTargetMin,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  utilityText: {
    fontSize: 13,
    fontWeight: '600',
    color: HerwayColors.ink,
  },
  bellBtn: {
    width: HerwaySizes.touchTargetMin,
    height: HerwaySizes.touchTargetMin,
    borderRadius: HerwayRadii.button,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    backgroundColor: HerwayColors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
  },
  desktopSosBtn: {
    minHeight: HerwaySizes.buttonSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.xs,
    backgroundColor: HerwayColors.danger,
    paddingHorizontal: HerwaySpacing.md,
    borderRadius: HerwayRadii.button,
  },
  desktopSosText: {
    fontSize: 13,
    fontWeight: '800',
    color: HerwayColors.white,
    letterSpacing: 0.4,
  },
  profilePill: {
    minHeight: HerwaySizes.buttonSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: HerwaySpacing.sm,
    paddingLeft: HerwaySpacing.xs,
    paddingRight: HerwaySpacing.md,
    borderRadius: HerwayRadii.pill,
    borderWidth: HerwaySizes.borderWidth,
    borderColor: HerwayColors.border,
    backgroundColor: HerwayColors.inputBg,
  },
  profilePillCompact: {
    paddingRight: HerwaySpacing.xs,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '700',
    color: HerwayColors.ink,
    maxWidth: 96,
  },
  mobileTabBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: HerwayColors.ink,
    borderTopLeftRadius: HerwayRadii.sheet,
    borderTopRightRadius: HerwayRadii.sheet,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: HerwaySpacing.lg,
    paddingTop: HerwaySpacing.md,
  },
  tabItem: {
    width: HerwaySizes.buttonPrimary,
    height: HerwaySizes.buttonPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    marginTop: HerwaySpacing.sm,
    width: HerwaySpacing.xxl,
    height: HerwaySpacing.xs,
    borderRadius: HerwayRadii.pill,
    backgroundColor: HerwayColors.teal,
  },
  inactiveSpacer: {
    marginTop: HerwaySpacing.sm,
    height: HerwaySpacing.xs,
  },
  centerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: HerwayColors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...HerwayShadows.card,
  },
  centerCircleActive: {
    borderWidth: 2,
    borderColor: HerwayColors.teal,
  },
});
