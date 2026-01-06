// src/context/VoiceSearchContext.js
import React, { createContext, useState, useContext, useCallback } from 'react';
import { useRouter } from 'expo-router';
import FuturisticVoiceModal from '../components/FuturisticVoiceModal';

const VoiceSearchContext = createContext();

export const VoiceSearchProvider = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  const openVoiceSearch = () => setVisible(true);
  const closeVoiceSearch = () => setVisible(false);

  // Handle what happens when the AI gives results
  const handleVoiceResults = useCallback((data) => {
    setVisible(false); // Close modal first
    
    // Navigate to listing page with results
    router.push({
      pathname: '/listing',
      params: { 
        type: 'ad_products', 
        title: `Search: "${data.understood_query}"`,
        products: JSON.stringify(data.products) 
      }
    });
  }, [router]);

  return (
    <VoiceSearchContext.Provider value={{ openVoiceSearch, closeVoiceSearch }}>
      {children}
      
      {/* GLOBAL MODAL: It lives here, so it works on every screen */}
      <FuturisticVoiceModal 
        visible={visible} 
        onClose={closeVoiceSearch}
        onResults={handleVoiceResults}
      />
    </VoiceSearchContext.Provider>
  );
};

export const useVoiceSearch = () => useContext(VoiceSearchContext);
