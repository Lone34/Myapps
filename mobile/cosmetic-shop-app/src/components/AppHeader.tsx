// src/components/AppHeader.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Platform,
  Animated,
  StatusBar,
  Easing,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVoiceSearch } from '../context/VoiceSearchContext'; // 👈 IMPORT THIS

// Define the words for both languages
const ENGLISH_WORDS = ['KUPWARA', 'CART'];
const URDU_WORDS = ['کارٹ' , 'کپوارہ' ];

// ... [Keep BilingualLogo Component EXACTLY AS IS] ...
const BilingualLogo = () => {
  const [isEnglish, setIsEnglish] = useState(true);
  const word1Anim = useRef(new Animated.Value(0)).current; 
  const word2Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    word1Anim.setValue(0);
    word2Anim.setValue(0);
    const animationSequence = Animated.sequence([
      Animated.delay(300),
      Animated.timing(word1Anim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.back(1.5)) }),
      Animated.timing(word2Anim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.back(1.5)) }),
      Animated.delay(2500),
      Animated.parallel([
        Animated.timing(word1Anim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(word2Anim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]);
    animationSequence.start(({ finished }) => { if (finished) setIsEnglish((prev) => !prev); });
    return () => animationSequence.stop();
  }, [isEnglish]);

  const translateY1 = word1Anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const translateY2 = word2Anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const currentWords = isEnglish ? ENGLISH_WORDS : URDU_WORDS;
  const currentFontStyle = isEnglish ? styles.brandTextEnglish : styles.brandTextUrdu;

  return (
    <View style={styles.logoContainer}>
      <Animated.Text style={[styles.baseBrandText, currentFontStyle, { opacity: word1Anim, transform: [{ translateY: translateY1 }], marginRight: 6 }]}>{currentWords[0]}</Animated.Text>
      <Animated.Text style={[styles.baseBrandText, currentFontStyle, { opacity: word2Anim, transform: [{ translateY: translateY2 }] }]}>{currentWords[1]}</Animated.Text>
    </View>
  );
};

type Props = {
  placeholder?: string;
  // onMicPress prop is removed because we handle it globally now
};

const AppHeader: React.FC<Props> = ({
  placeholder = 'Search for products, brands, shops...',
}) => {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  
  // ✅ USE THE GLOBAL HOOK
  const { openVoiceSearch } = useVoiceSearch(); 

  const handleSearch = (text?: string) => {
    const q = (text ?? keyword).trim();
    if (!q) return;
    router.push({ pathname: '/search', params: { q } });
  };

  return (
    <View style={styles.headerContainer}>
      <View style={styles.brandRow}>
        <BilingualLogo />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          value={keyword}
          onChangeText={setKeyword}
          placeholder={placeholder}
          placeholderTextColor="#999"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={() => handleSearch()}
        />

        {/* ✅ Global Open Function */}
        <TouchableOpacity onPress={openVoiceSearch}>
          <Ionicons name="mic" size={22} color="#D4AF37" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AppHeader;

const styles = StyleSheet.create({
  headerContainer: { backgroundColor: 'transparent', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 10 : 10, paddingBottom: 10, shadowColor: '#1E90FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6, zIndex: 100, marginBottom: 5 },
  brandRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, height: 50 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  baseBrandText: { color: '#fff', textShadowColor: 'rgba(212, 175, 55, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  brandTextEnglish: { fontSize: 28, fontWeight: '800', letterSpacing: 1.2, fontFamily: Platform.OS === 'ios' ? 'Baskerville-Italic' : 'serif' },
  brandTextUrdu: { fontSize: 30, fontWeight: '700', marginTop: -4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, marginHorizontal: 16, height: 44, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#fff' },
});
