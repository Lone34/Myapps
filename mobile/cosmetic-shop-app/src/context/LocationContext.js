// src/context/LocationContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import * as Location from 'expo-location';

const LocationContext = createContext();

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null); // Stores { lat, lon }
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState(null);

  const fetchLocation = async () => {
    try {
      setLoading(true);
      
      // 1. Check/Request Permissions
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const res = await Location.requestForegroundPermissionsAsync();
        status = res.status;
      }
      setPermissionStatus(status);

      if (status !== 'granted') {
        setError('Permission to access location was denied');
        setLoading(false);
        return;
      }

      // 2. Get Current Position (Balanced accuracy is faster)
      const pos = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Balanced, 
        timeout: 15000 
      });

      if (pos && pos.coords) {
        // Store just what we need
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setError(null);
      }
    } catch (err) {
      setError('Could not fetch location');
    } finally {
      setLoading(false);
    }
  };

  // Run automatically when the app starts
  useEffect(() => {
    fetchLocation();
  }, []);

  return (
    <LocationContext.Provider 
      value={{ 
        location, 
        loading, 
        error, 
        permissionStatus, 
        refreshLocation: fetchLocation // Expose this if user wants to retry manually
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

// Custom Hook for easy access
export const useGlobalLocation = () => useContext(LocationContext);
