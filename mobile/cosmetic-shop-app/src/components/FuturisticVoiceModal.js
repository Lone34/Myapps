// src/components/FuturisticVoiceModal.js
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../api/client'; 

const SCREEN_WIDTH = Dimensions.get('window').width;

const HINTS = [
  "Try saying: 'Basmati Rice under 500'",
  "Try saying: 'Kashmiri Apples'",
  "Try saying: 'Best chips for kids'",
  "Try saying: 'Show me spices'",
  "Try saying: 'Cheapest chocolate'"
];

// --- 🎵 SUB-COMPONENT: Animated Waveform (The Visualizer) ---
const Waveform = ({ isRecording }) => {
  // Create 5 bars
  const animations = useRef([...Array(5)].map(() => new Animated.Value(10))).current;

  useEffect(() => {
    if (isRecording) {
      const loopAnim = (anim, delay) => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 40 + 15, // Random height between 15 and 55
              duration: 150 + Math.random() * 100, // Random speed
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 10,
              duration: 150 + Math.random() * 100,
              useNativeDriver: false,
            }),
          ])
        ).start();
      };

      animations.forEach((anim, i) => loopAnim(anim, i * 100));
    } else {
      // Reset bars when not recording
      animations.forEach(anim => anim.setValue(10));
    }
  }, [isRecording]);

  return (
    <View style={styles.waveformContainer}>
      {animations.map((anim, index) => (
        <Animated.View 
          key={index} 
          style={[styles.waveBar, { height: anim }]} 
        />
      ))}
    </View>
  );
};

// --- ⌨️ SUB-COMPONENT: Typewriter Text Effect ---
const TypewriterText = ({ text, style }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) clearInterval(interval);
    }, 40); // Speed of typing
    return () => clearInterval(interval);
  }, [text]);

  return <Text style={style}>{displayedText}<Text style={{color: '#D4AF37'}}>|</Text></Text>;
};

// --- 🚀 MAIN COMPONENT ---
export default function FuturisticVoiceModal({ visible, onClose, onResults }) {
  const [recording, setRecording] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | recording | processing
  const [timeLeft, setTimeLeft] = useState(10);
  
  // Rotating Hints
  const [hintIndex, setHintIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Modal Animation
  const slideUpAnim = useRef(new Animated.Value(200)).current;

  // --- 1. Start/Stop Logic ---
  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); // 📳 Heavy entry vibration
      
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.2)),
      }).start();

      startRecording();
    } else {
      setTimeLeft(10);
      setStatus('idle');
      slideUpAnim.setValue(200);
      if (recording) stopAndUpload();
    }
  }, [visible]);

  // --- 2. Hints Rotator ---
  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(100),
      ]).start(() => {
        setHintIndex((prev) => (prev + 1) % HINTS.length);
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [visible]);

  // --- 3. Timer ---
  useEffect(() => {
    let timer;
    if (visible && status === 'recording' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && status === 'recording') {
      stopAndUpload();
    }
    return () => clearInterval(timer);
  }, [visible, status, timeLeft]);

  // --- 4. Recording Logic ---
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone access is required.');
        onClose();
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(recording);
      setStatus('recording');
    } catch (err) {
      onClose();
    }
  };

  const stopAndUpload = async () => {
    if (!recording) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // 📳 Tap feeling
    setStatus('processing');

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI(); 
      setRecording(null); 

      const formData = new FormData();
      formData.append('audio', { uri, name: 'voice_search.m4a', type: 'audio/m4a' });

      const res = await api.post('/voice-search-ai/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.status === 'no_speech') {
         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); // 📳 Warning buzz
         Alert.alert("🤔", "I didn't hear anything. Try again!");
         onClose();
         return;
      }

      if (res.data?.products) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // 📳 Success buzz
        onResults(res.data); 
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", "We couldn't understand that.");
        onClose();
      }

    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Check your internet connection.");
      onClose();
    } finally {
      setStatus('idle');
    }
  };

  const handleClose = async () => {
    if (recording) { try { await recording.stopAndUnloadAsync(); } catch (e) {} }
    setRecording(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        
        {/* Living Gradient Background */}
        <LinearGradient
          colors={['rgba(2, 6, 23, 0.85)', 'rgba(15, 23, 42, 0.95)', '#0F172A']}
          style={StyleSheet.absoluteFill}
        />
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

        <Animated.View style={[styles.modalContent, { transform: [{ translateY: slideUpAnim }] }]}>
          
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#64748B" />
          </TouchableOpacity>

          {/* Typewriter Greeting */}
          <View style={{height: 40, marginBottom: 5}}>
            {visible && <TypewriterText text="Asalamu Alaykum! I'm listening..." style={styles.greetingText} />}
          </View>
          
          {/* Rotating Hints */}
          <Animated.Text style={[styles.subText, { opacity: fadeAnim }]}>
             {status === 'processing' ? "Analyzing voice data..." : HINTS[hintIndex]}
          </Animated.Text>

          {/* Visualizer (Waveform) */}
          <View style={styles.visualizerContainer}>
             {status === 'recording' ? (
                <Waveform isRecording={true} />
             ) : (
                <View style={styles.processingCircle}>
                  <Ionicons name="hourglass-outline" size={40} color="#D4AF37" />
                </View>
             )}
          </View>

          {/* Timer */}
          {status === 'recording' && (
             <Text style={styles.timerText}>Auto-search in {timeLeft}s</Text>
          )}

          {/* Futuristic Button */}
          <TouchableOpacity 
            style={[styles.doneButton, status === 'processing' && styles.doneButtonProcessing]} 
            onPress={stopAndUpload}
            disabled={status !== 'recording'}
          >
            <Text style={styles.doneButtonText}>
              {status === 'processing' ? "PROCESSING" : "TAP TO SEARCH"}
            </Text>
            {status !== 'processing' && <Ionicons name="arrow-forward" size={18} color="#fff" style={{marginLeft:8}} />}
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#0F172A', // Dark Slate
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingVertical: 40,
    paddingHorizontal: 25,
    alignItems: 'center',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)', // Gold Border
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  closeButton: { position: 'absolute', top: 20, right: 20, padding: 10 },
  greetingText: { fontSize: 26, fontWeight: '800', color: '#D4AF37', letterSpacing: 0.5 },
  subText: { fontSize: 14, color: '#94A3B8', marginBottom: 30, textAlign: 'center' },
  
  // Visualizer Styles
  visualizerContainer: { height: 80, justifyContent: 'center', alignItems: 'center', marginBottom: 20, width: '100%' },
  waveformContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 60, gap: 8 },
  waveBar: { width: 8, backgroundColor: '#D4AF37', borderRadius: 4 },
  processingCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: '#D4AF37', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed' },
  
  timerText: { color: '#64748B', fontSize: 12, marginBottom: 20, fontWeight: '600' },
  
  doneButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#D4AF37', 
    paddingVertical: 16, 
    paddingHorizontal: 60, 
    borderRadius: 50, 
    shadowColor: '#D4AF37', 
    shadowOffset: { width: 0, height: 5 }, 
    shadowOpacity: 0.4, 
    shadowRadius: 10,
    elevation: 10
  },
  doneButtonProcessing: { backgroundColor: '#334155' },
  doneButtonText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
