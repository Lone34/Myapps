// src/context/NavBarContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

type NavBarContextType = {
  visible: boolean;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  show: () => void;
  hide: () => void;
};

const NavBarContext = createContext<NavBarContextType | undefined>(
  undefined
);

export function NavBarProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const lastOffsetRef = useRef(0);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentOffset = event.nativeEvent.contentOffset.y;
      const diff = currentOffset - lastOffsetRef.current;

      if (Math.abs(diff) < 4) return;

      if (currentOffset <= 0) {
        setVisible(true);
      } else if (diff > 0) {
        setVisible(false);
      } else {
        setVisible(true);
      }

      lastOffsetRef.current = currentOffset;
    },
    []
  );

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  return (
    <NavBarContext.Provider
      value={{
        visible,
        handleScroll,
        show,
        hide,
      }}
    >
      {children}
    </NavBarContext.Provider>
  );
}

export function useNavBar() {
  const ctx = useContext(NavBarContext);
  if (!ctx) {
    throw new Error('useNavBar must be used within NavBarProvider');
  }
  return ctx;
}
