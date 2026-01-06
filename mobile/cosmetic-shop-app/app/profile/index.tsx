// app/profile/index.tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import { Image } from 'expo-image'; 

// --- Custom Components ---
import AppHeader from '../../src/components/AppHeader';
import AnimatedBackground from '../../src/components/AnimatedBackground';
import { useNavBar } from '../../src/context/NavBarContext';

import {
  fetchProfile,
  normalizeProfile,
  deleteProfileFromBackend,
} from '../../src/api/profile';
import client from '../../src/api/client';
import { logout } from '../../src/redux/actions/userActions';
import { USER_LOGIN_SUCCESS } from '../../src/redux/constants/userConstants';

// 🔧 FIX: Replace with your actual backend URL if needed (for relative paths)
const BASE_URL = 'https://kashmircart.online'; 

const ProfileScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { handleScroll } = useNavBar();

  const userLogin = useSelector((state: any) => state.userLogin || {});
  const { userInfo } = userLogin;

  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [profile, setProfile] = useState<ReturnType<typeof normalizeProfile> | null>(null);
  const [error, setError] = useState<string>('');
  
  // 🔧 FIX: State to force image refresh after upload
  const [imageHash, setImageHash] = useState(Date.now());

  // --- Load Profile Data ---
  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      let currentUser = userInfo;
      if (!currentUser) {
        const stored = await AsyncStorage.getItem('userInfo');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.token || parsed.access)) {
            currentUser = parsed;
            dispatch({ type: USER_LOGIN_SUCCESS, payload: parsed });
          }
        }
      }

      const token = currentUser?.token || currentUser?.access;
      if (!currentUser || !token) {
        setProfile(null);
        setError('You are not logged in.');
        setLoading(false);
        return;
      }

      client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const data = await fetchProfile();

      const normalized = normalizeProfile(data, currentUser);
      setProfile(normalized);
    } catch (err: any) {
      const message = err?.response?.data?.detail || err?.message || 'Failed to load profile.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [userInfo])
  );

  // --- Image Upload Handler ---
  const handleImageUpload = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Access to photos is needed to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6, // Reduced quality for faster upload
    });

    if (result.canceled) return;

    const localUri = result.assets[0].uri;
    const filename = localUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename || '');
    const type = match ? `image/${match[1]}` : `image`;

    const formData = new FormData();
    formData.append('avatar', { uri: localUri, name: filename, type } as any);

    setUploading(true);

    try {
      // 1. Upload to backend
      const res = await client.put('/api/users/profile/update/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      console.log("Upload Response:", res.data);

      // 2. Refresh Profile Data
      await loadProfile();
      
      // 🔧 FIX: Update hash to force Image component to reload
      setImageHash(Date.now());
      
      Alert.alert("Success", "Profile picture updated!");
    } catch (err) {
      console.log("Upload error:", err);
      Alert.alert("Upload Failed", "Could not update profile picture. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onEdit = () => router.push('/profile/edit');

  const onDelete = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfileFromBackend();
              dispatch(logout());
              await AsyncStorage.removeItem('userInfo');
              router.replace('/login');
            } catch (err: any) {
              Alert.alert('Error', 'Could not delete account.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    dispatch(logout());
    await AsyncStorage.removeItem('userInfo');
    router.replace('/login');
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  if (error === 'You are not logged in.' && !profile) {
    return (
      <SafeAreaView style={styles.screen}>
         <AnimatedBackground />
         <AppHeader />
         <View style={styles.centerBox}>
            <Ionicons name="person-circle-outline" size={80} color="rgba(255,255,255,0.5)" />
            <Text style={styles.notLoggedText}>Please login to view your profile</Text>
            <TouchableOpacity style={styles.goldBtn} onPress={() => router.replace('/login')}>
              <Text style={styles.goldBtnText}>Login Now</Text>
            </TouchableOpacity>
         </View>
      </SafeAreaView>
    );
  }

  // --- 🔧 HELPER: Resolve Full Image URL ---
    const { fullName, email, phone, age, pan, aadhaar, avatar } = profile || {};
    
    let finalAvatarUri = null;
    if (avatar) {
        // 1. If it's already a valid public HTTPS url, use it
        if (avatar.startsWith('https://kashmircart.online')) {
            finalAvatarUri = avatar;
        } 
        // 2. If it's a local/internal URL (localhost/127.0.0.1), replace with real domain
        else if (avatar.includes('127.0.0.1') || avatar.includes('localhost')) {
            // Extract the /media/ part
            const relativePath = avatar.split('/media/')[1];
            finalAvatarUri = `${BASE_URL}/media/${relativePath}`;
        }
        // 3. If it's a relative path (starts with /), prepend domain
        else if (avatar.startsWith('/')) {
            finalAvatarUri = `${BASE_URL}${avatar}`;
        }
        // 4. Fallback for clean relative paths
        else {
            finalAvatarUri = `${BASE_URL}/${avatar}`;
        }
        
        // Append cache buster
        finalAvatarUri = `${finalAvatarUri}?t=${imageHash}`;
    }

  const avatarLetter = (fullName && fullName.trim()[0]) || (email && email.trim()[0]) || '?';

  return (
    <SafeAreaView style={styles.screen}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <AppHeader />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>My Profile</Text>

        {/* --- HERO SECTION --- */}
        <View style={styles.heroSection}>
           <TouchableOpacity 
              style={styles.avatarContainer} 
              onPress={handleImageUpload} 
              disabled={uploading}
              activeOpacity={0.8}
           >
              {finalAvatarUri ? (
                <Image 
                    source={{ uri: finalAvatarUri }} 
                    style={styles.avatarImg} 
                    contentFit="cover"
                    transition={500}
                    // Debugging onError
                    onError={(e) => console.log("Image Load Error:", e.error, finalAvatarUri)}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                   <Text style={styles.avatarLetter}>{avatarLetter.toUpperCase()}</Text>
                </View>
              )}
              
              {/* Camera Icon */}
              <View style={styles.cameraIconBadge}>
                 {uploading ? <ActivityIndicator size="small" color="#000" /> : <Ionicons name="camera" size={14} color="#000" />}
              </View>
           </TouchableOpacity>

           <Text style={styles.heroName}>{fullName || 'Guest User'}</Text>
           <Text style={styles.heroEmail}>{email}</Text>
           <View style={styles.editBtnWrap}>
              <TouchableOpacity style={styles.smallOutlineBtn} onPress={onEdit}>
                 <Text style={styles.smallOutlineBtnText}>Edit Profile</Text>
              </TouchableOpacity>
           </View>
        </View>

        {/* --- DETAILS CARDS --- */}
        <View style={styles.card}>
           <View style={styles.cardHeader}>
              <Ionicons name="information-circle" size={20} color="#D4AF37" />
              <Text style={styles.cardTitle}>Personal Details</Text>
           </View>
           
           <View style={styles.row}>
              <View style={styles.col}>
                 <Text style={styles.label}>Phone</Text>
                 <Text style={styles.value}>{phone || 'Not set'}</Text>
              </View>
              <View style={styles.col}>
                 <Text style={styles.label}>Age</Text>
                 <Text style={styles.value}>{age || 'Not set'}</Text>
              </View>
           </View>
        </View>

        <View style={styles.card}>
           <View style={styles.cardHeader}>
              <Ionicons name="card" size={20} color="#D4AF37" />
              <Text style={styles.cardTitle}>KYC Documents</Text>
           </View>
           
           <View style={styles.row}>
              <View style={styles.col}>
                 <Text style={styles.label}>PAN Card</Text>
                 <Text style={styles.value}>{pan || 'Not set'}</Text>
              </View>
              <View style={styles.col}>
                 <Text style={styles.label}>Aadhaar</Text>
                 <Text style={styles.value}>{aadhaar || 'Not set'}</Text>
              </View>
           </View>
        </View>

        {/* --- ACTIONS --- */}
        <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
           <View style={[styles.iconBox, {backgroundColor: 'rgba(212, 175, 55, 0.15)'}]}>
              <Ionicons name="log-out-outline" size={20} color="#D4AF37" />
           </View>
           <Text style={styles.actionText}>Log Out</Text>
           <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={onDelete}>
           <View style={[styles.iconBox, {backgroundColor: 'rgba(239, 68, 68, 0.15)'}]}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
           </View>
           <Text style={[styles.actionText, {color: '#ef4444'}]}>Delete Account</Text>
        </TouchableOpacity>

        <View style={{height: 100}} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#001A33' },
  loadingContainer: { flex: 1, backgroundColor: '#001A33', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  
  pageTitle: { 
    fontSize: 24, fontWeight: '800', color: '#D4AF37', 
    marginHorizontal: 20, marginTop: 10, marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textTransform: 'uppercase', letterSpacing: 1
  },

  // Hero Section
  heroSection: { alignItems: 'center', marginBottom: 30 },
  avatarContainer: { position: 'relative', marginBottom: 16 },
  avatarImg: { 
    width: 110, height: 110, borderRadius: 55, 
    borderWidth: 2, borderColor: '#D4AF37' 
  },
  avatarPlaceholder: { 
    width: 110, height: 110, borderRadius: 55, 
    backgroundColor: '#111', borderWidth: 2, borderColor: '#D4AF37',
    justifyContent: 'center', alignItems: 'center' 
  },
  avatarLetter: { fontSize: 40, color: '#D4AF37', fontWeight: 'bold' },
  
  cameraIconBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#D4AF37', width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#001A33'
  },
  
  heroName: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  heroEmail: { fontSize: 14, color: '#aaa', marginBottom: 16 },
  
  editBtnWrap: { flexDirection: 'row' },
  smallOutlineBtn: { 
    borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.5)', 
    paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 
  },
  smallOutlineBtnText: { color: '#D4AF37', fontSize: 12, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)'
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { flex: 1 },
  label: { color: '#666', fontSize: 12, marginBottom: 4, textTransform: 'uppercase' },
  value: { color: '#eee', fontSize: 15, fontWeight: '500' },

  // Actions
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 16, marginBottom: 10,
    padding: 12, borderRadius: 12
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  actionText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '500' },

  // Empty State
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  notLoggedText: { color: '#aaa', marginTop: 16, fontSize: 16, marginBottom: 20 },
  goldBtn: { backgroundColor: '#D4AF37', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
  goldBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
});
