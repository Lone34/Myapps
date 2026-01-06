// src/context/UserLocationContext.tsx
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

type LocationType = {
  lat: number;
  lon: number;
} | null;

type LocationContextType = {
  location: LocationType;
  errorMsg: string | null;
  isLoading: boolean;
  refreshLocation: () => Promise<void>;
};

const UserLocationContext = createContext<LocationContextType>({
  location: null,
  errorMsg: null,
  isLoading: true,
  refreshLocation: async () => {},
});

export const UserLocationProvider = ({ children }: { children: React.ReactNode }) => {
  const [location, setLocation] = useState<LocationType>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const appState = useRef(AppState.currentState);

  const fetchLocation = async () => {
    // Only show loading spinner if we have absolutely NO data yet
    if (!location) setIsLoading(true);
    
    try {
      // 1. Check Permissions
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== 'granted') {
          setErrorMsg('Permission denied');
          setIsLoading(false);
          return;
        }
      }

      // 2. Get Last Known Position (Instant & Fast)
      let lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown) {
        setLocation({
          lat: lastKnown.coords.latitude,
          lon: lastKnown.coords.longitude,
        });
        // Clear error if we have at least this data
        setErrorMsg(null); 
      }

      // 3. Try High Accuracy (Background Update)
      // We wrap this in a separate try/catch so it doesn't break the app if it fails
      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, 
          timeInterval: 5000, // Don't spend more than 5s looking for satellites
        });

        // Update with better data if successful
        setLocation({
          lat: current.coords.latitude,
          lon: current.coords.longitude,
        });
      } catch (freshError) {
        // ✅ SILENT FAIL: If we already have 'lastKnown', ignore this error.
        // We only log/show error if we have NO location at all.
        if (!lastKnown && !location) {
            console.log("Could not get fresh location:", freshError);
            // Don't set errorMsg here yet, maybe the user just has GPS off momentarily
        }
      }

    } catch (error) {
       // Only show fatal error if we have NO location
       if (!location) setErrorMsg('Location Unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchLocation();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <UserLocationContext.Provider value={{ location, errorMsg, isLoading, refreshLocation: fetchLocation }}>
      {children}
    </UserLocationContext.Provider>
  );
};

export const useUserLocation = () => useContext(UserLocationContext);
