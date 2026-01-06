// src/components/BottomNavMobile.tsx
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useNavBar } from '../context/NavBarContext';

// ---- CONFIG ----
const NAV_ITEMS = [
  { key: 'home', label: 'Home', icon: 'home-outline', activeIcon: 'home', route: '/(tabs)' },
  { key: 'categories', label: 'Category', icon: 'grid-outline', activeIcon: 'grid', route: '/(tabs)/categories' },
  { key: 'shops', label: 'Shops', icon: 'storefront-outline', activeIcon: 'storefront', route: '/(tabs)/shops' },
  { key: 'cart', label: 'Cart', icon: 'cart-outline', activeIcon: 'cart', route: '/(tabs)/cart' },
  { key: 'wishlist', label: 'Wishlist', icon: 'heart-outline', activeIcon: 'heart', route: '/(tabs)/wishlist' },
  { key: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings', route: '/(tabs)/settings' },
];

type NavItemProps = {
  item: typeof NAV_ITEMS[0];
  active: boolean;
  badge?: number;
  onPress: () => void;
};

// --- Single Icon Component with Bubble & Label ---
const NavItem: React.FC<NavItemProps> = ({ item, active, badge = 0, onPress }) => {
  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bubbleScale = useRef(new Animated.Value(0)).current; // For the bubble effect
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      // 🟢 FAST Expand Bubble
      Animated.parallel([
        Animated.timing(bubbleScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.circle),
        }),
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Collapse Bubble
      Animated.parallel([
        Animated.timing(bubbleScale, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleOpacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [active]);

  const handlePressIn = () => {
    // Instant feedback shrink
    Animated.timing(scaleAnim, {
      toValue: 0.9,
      duration: 50,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    // Snap back
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
    onPress();
  };

  return (
    <Pressable
      style={styles.itemContainer}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.itemInner, { transform: [{ scale: scaleAnim }] }]}>
        
        {/* 🟡 THE GOLD BUBBLE ANIMATION */}
        <Animated.View 
          style={[
            styles.bubble, 
            { 
              transform: [{ scale: bubbleScale }],
              opacity: bubbleOpacity
            }
          ]} 
        />

        <View style={styles.iconWrapper}>
          <Ionicons 
            name={active ? (item.activeIcon as any) : (item.icon as any)} 
            size={22} 
            color={active ? '#FFD700' : '#CCCCCC'} 
          />
          
          {badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badge > 99 ? '99+' : badge}
              </Text>
            </View>
          )}
        </View>

        {/* LABEL (Always visible now) */}
        <Text style={[styles.label, active && styles.labelActive]}>
          {item.label}
        </Text>

      </Animated.View>
    </Pressable>
  );
};

const BottomNavMobile: React.FC = () => {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { visible } = useNavBar();

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 🚀 Super fast slide animation (150ms)
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 120,
      duration: 150, 
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // ---- Active tab detection ----
  const currentSeg = (segments[1] || 'index') as string;
  let activeKey: string = 'home';
  if (currentSeg === 'categories') activeKey = 'categories';
  else if (currentSeg === 'shops') activeKey = 'shops';
  else if (currentSeg === 'cart') activeKey = 'cart';
  else if (currentSeg === 'wishlist') activeKey = 'wishlist';
  else if (currentSeg === 'settings') activeKey = 'settings';

  // ---- Cart count ----
  const cartState = useSelector((state: any) => state.cart || {});
  const cartItems = cartState.cartItems || [];
  const cartCount = cartItems.reduce(
    (sum: number, it: any) => sum + Number(it.quantity || 0),
    0
  );

  const handlePressRoute = (route: string) => {
    if (route === '/(tabs)') router.push('/(tabs)');
    else router.push(route as any);
  };

  const bottomMargin = insets.bottom > 0 ? insets.bottom : 16;

  // Use BlurView on iOS, simple View on Android for performance
  const ContainerComponent = Platform.OS === 'ios' ? BlurView : View;
  const containerProps = Platform.OS === 'ios' 
    ? { intensity: 60, tint: "dark", style: styles.glassContainer }
    : { style: [styles.glassContainer, styles.androidGlass] };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          bottom: bottomMargin, 
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <ContainerComponent {...(containerProps as any)}>
        <View style={styles.navBar}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              active={activeKey === item.key}
              badge={item.key === 'cart' ? cartCount : 0}
              onPress={() => handlePressRoute(item.route)}
            />
          ))}
        </View>
      </ContainerComponent>
    </Animated.View>
  );
};

export default BottomNavMobile;

// ---- Styles ----
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    zIndex: 9999,
  },
  glassContainer: {
    width: '100%',
    borderRadius: 30, 
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  // Android doesn't handle BlurView well for lag, so we use a solid semi-transparent dark bg
  androidGlass: {
    backgroundColor: 'rgba(15, 15, 20, 0.96)', 
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    // iOS gets blur, but we still need a base color tint
    backgroundColor: Platform.OS === 'ios' ? 'rgba(10, 10, 10, 0.65)' : 'transparent',
  },
  itemContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  // 🟡 The Bubble Style
  bubble: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(212, 175, 55, 0.15)', // Soft Gold Background
    zIndex: -1, // Behind the icon
  },
  iconWrapper: {
    marginBottom: 3,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: '#888',
    marginTop: 2,
  },
  labelActive: {
    color: '#FFD700', // Gold text when active
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 2,
    borderRadius: 8,
    backgroundColor: '#FF007F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
});
