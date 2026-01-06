// app/(tabs)/TabBarContext.tsx
import React, { createContext, useContext, useRef } from 'react';
import { Animated } from 'react-native';

type TabBarContextType = {
  translateY: Animated.Value;
  show: () => void;
  hide: () => void;
};

const TabBarVisibilityContext = createContext<TabBarContextType | null>(null);

export const TabBarProvider = ({ children }: { children: React.ReactNode }) => {
  const translateY = useRef(new Animated.Value(0)).current; // 0 = visible

  const show = () => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const hide = () => {
    // Slide the bar down by ~80px
    Animated.timing(translateY, {
      toValue: 80,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TabBarVisibilityContext.Provider value={{ translateY, show, hide }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
};

export const useTabBarVisibility = () => {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) {
    throw new Error('useTabBarVisibility must be used inside TabBarProvider');
  }
  return ctx;
};
