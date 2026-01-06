// app/profile/edit.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';

import {
  fetchProfile,
  normalizeProfile,
  saveProfileToBackend,
  extractProfileErrors,
} from '../../src/api/profile';
import { logout } from '../../src/redux/actions/userActions';

const ProfileEditScreen = () => {
  const router = useRouter();
  const dispatch = useDispatch();

  const userLogin = useSelector((state: any) => state.userLogin || {});
  const { userInfo } = userLogin;

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [age, setAge] = useState<string>('');
  const [pan, setPan] = useState('');
  const [aadhaar, setAadhaar] = useState('');

  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userInfo || !userInfo.token) { router.replace('/login'); return; }
    const load = async () => {
      try {
        const data = await fetchProfile();
        const normalized = normalizeProfile(data, userInfo);
        setName(normalized.fullName || '');
        setPhoneNumber(normalized.phone || '');
        setAge(normalized.age ? String(normalized.age) : '');
        setPan(normalized.pan || '');
        setAadhaar(normalized.aadhaar || '');
      } catch (err: any) {
        setFormError(err?.message || 'Failed to load profile.');
        if (err?.response?.status === 401) { dispatch(logout()); router.replace('/login'); }
      } finally { setLoading(false); }
    };
    load();
  }, [userInfo]);

  const handleSave = async () => {
    if (!userInfo || !userInfo.token) { router.replace('/login'); return; }
    setSaving(true); setFormError(''); setFieldErrors({});

    const payload: any = {
      name: name?.trim() || '',
      phone_number: phoneNumber?.trim() || '',
      pan_card: pan?.trim() || '',
      aadhaar: aadhaar?.trim() || '',
    };
    if (age && age.trim() !== '') payload.age = age.trim();

    try {
      await saveProfileToBackend(payload);
      router.replace('/profile');
    } catch (err: any) {
      const { fieldErrors: fe, formError: feMsg } = extractProfileErrors(err);
      setFieldErrors(fe);
      setFormError(feMsg || 'Failed to update profile.');
      if (err?.response?.status === 401) { dispatch(logout()); router.replace('/login'); }
    } finally { setSaving(false); }
  };

  const showFieldError = (field: string) =>
    fieldErrors[field] ? <Text style={styles.fieldError}>{fieldErrors[field]}</Text> : null;

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#D4AF37" /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
        
        <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={{padding: 4}}>
                <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={[styles.saveText, saving && {color: '#ccc'}]}>Save</Text>
            </TouchableOpacity>
        </View>

    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your Name" autoCapitalize="words" />
            {showFieldError('name')}
        </View>

        <View style={styles.formGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput style={styles.input} value={phoneNumber} onChangeText={setPhoneNumber} placeholder="Your Phone" keyboardType="phone-pad" />
            {showFieldError('phone_number')}
        </View>

        <View style={styles.formGroup}>
            <Text style={styles.label}>Age</Text>
            <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="Your Age" keyboardType="numeric" />
            {showFieldError('age')}
        </View>

        <Text style={[styles.sectionTitle, {marginTop: 20}]}>KYC Documents</Text>

        <View style={styles.formGroup}>
            <Text style={styles.label}>PAN Card</Text>
            <TextInput style={styles.input} value={pan} onChangeText={setPan} autoCapitalize="characters" placeholder="ABCDE1234F" />
            {showFieldError('pan_card')}
        </View>

        <View style={styles.formGroup}>
            <Text style={styles.label}>Aadhaar Number</Text>
            <TextInput style={styles.input} value={aadhaar} onChangeText={setAadhaar} keyboardType="number-pad" placeholder="12-digit Aadhaar" />
            {showFieldError('aadhaar')}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ProfileEditScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  saveText: { fontSize: 16, fontWeight: '700', color: '#D4AF37' },

  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 12, textTransform: 'uppercase' },

  formError: { color: '#E04F5F', marginBottom: 12, backgroundColor: '#FFF0F0', padding: 10, borderRadius: 8 },
  
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 6 },
  input: { 
    backgroundColor: '#fff', 
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10, 
    paddingHorizontal: 14, paddingVertical: 12, 
    fontSize: 16, color: '#333' 
  },
  fieldError: { color: '#E04F5F', fontSize: 12, marginTop: 4 },
});
