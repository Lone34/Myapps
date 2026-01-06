// app/addresses.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import client from '../src/api/client';
import AppHeader from '../src/components/AppHeader';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Address = {
  id: number;
  address: string;
  village?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  phone_number?: string;
};

type AddressFormState = {
  address: string;
  village: string;
  city: string;
  postal_code: string;
  country: string;
  phone_number: string;
};

const emptyForm: AddressFormState = {
  address: '',
  village: '',
  city: '',
  postal_code: '',
  country: '',
  phone_number: '',
};

export default function AddressesScreen() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AddressFormState>(emptyForm);

  const [formError, setFormError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AddressFormState, string>>>({});

  const scrollRef = useRef<ScrollView | null>(null);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const { data } = await client.get<Address[]>('/api/addresses/');
      setAddresses(data || []);
    } catch (e: any) {
      Alert.alert('Error', 'Unable to load addresses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAddresses(); }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setFormError('');
    setFieldErrors({});
  };

  const openAddForm = () => {
    LayoutAnimation.easeInEaseOut();
    resetForm();
    setShowForm(true);
    setTimeout(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, 150);
  };

  const openEditForm = (addr: Address) => {
    LayoutAnimation.easeInEaseOut();
    setForm({
      address: addr.address || '',
      village: addr.village || '',
      city: addr.city || '',
      postal_code: addr.postal_code || '',
      country: addr.country || '',
      phone_number: addr.phone_number || '',
    });
    setEditingId(addr.id);
    setFormError('');
    setFieldErrors({});
    setShowForm(true);
    setTimeout(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, 150);
  };

  const closeForm = () => {
    LayoutAnimation.easeInEaseOut();
    resetForm();
    setShowForm(false);
  };

  const handleDelete = async (id: number) => {
    Alert.alert('Remove Address', 'Are you sure you want to delete this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/api/addresses/${id}/`);
            await loadAddresses();
          } catch (e: any) {
            Alert.alert('Error', 'Could not delete address.');
          }
        },
      },
    ]);
  };

  const handlePostalBlur = async () => {
    const pin = (form.postal_code || '').trim();
    if (!pin) {
        setFieldErrors(prev => ({ ...prev, postal_code: 'Postal code is required.' }));
        return;
    }
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
        setFieldErrors(prev => ({ ...prev, postal_code: 'Invalid PIN code.' }));
        return;
    }
    setFieldErrors(prev => ({ ...prev, postal_code: undefined }));

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      const info = json?.[0];
      if (info?.Status === 'Success' && Array.isArray(info.PostOffice) && info.PostOffice.length > 0) {
        const po = info.PostOffice[0];
        setForm(f => ({ ...f, village: f.village || po.Name || '', city: f.city || po.District || '', country: f.country || 'India' }));
      } else {
        setFieldErrors(prev => ({ ...prev, postal_code: 'PIN not found.' }));
      }
    } catch (err) {
      setFieldErrors(prev => ({ ...prev, postal_code: 'Verification failed.' }));
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFieldErrors({});

    const payload = {
      address: form.address.trim(),
      village: form.village.trim(),
      city: form.city.trim(),
      postal_code: form.postal_code.trim(),
      country: form.country.trim() || 'India',
      phone_number: form.phone_number.trim(),
    };

    if (!payload.address || !payload.city || !payload.postal_code || !payload.country) {
      setSaving(false);
      setFormError('Please fill in all required fields.');
      return;
    }

    if (!payload.phone_number) {
      setSaving(false);
      setFormError('Phone number is required.');
      return;
    }

    try {
      if (editingId) {
        await client.patch(`/api/addresses/${editingId}/`, payload);
      } else {
        await client.post('/api/addresses/', payload);
      }
      await loadAddresses();
      closeForm();
    } catch (e: any) {
      setFormError(e?.response?.data?.detail || 'Failed to save address.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
  
      {/* Global header */}
      <AppHeader placeholder="Search products, brands, shops..." />
  
      {/* Screen toolbar (back + title) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Addresses</Text>
        <View style={{ width: 32 }} />
      </View>
  
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#D4AF37" /></View>
            ) : addresses.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="location-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyText}>No addresses saved yet.</Text>
                </View>
            ) : (
                addresses.map((item) => (
                    <View key={item.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="home" size={20} color="#D4AF37" style={{marginRight: 10}} />
                            <Text style={styles.addressTitle}>Address #{item.id}</Text>
                        </View>

                        <Text style={styles.addressText}>
                            {item.address}, {item.village ? `${item.village}, ` : ''}{item.city}
                            {item.postal_code ? ` - ${item.postal_code}` : ''}
                        </Text>
                        <Text style={styles.phoneText}>Phone: {item.phone_number}</Text>

                        <View style={styles.divider} />

                        <View style={styles.cardActions}>
                            <TouchableOpacity onPress={() => openEditForm(item)} style={styles.actionBtn}>
                                <Ionicons name="create-outline" size={18} color="#D4AF37" />
                                <Text style={styles.actionTextEdit}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                                <Ionicons name="trash-outline" size={18} color="#E04F5F" />
                                <Text style={styles.actionTextDelete}>Remove</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))
            )}

            {!showForm && (
                <TouchableOpacity style={styles.addButton} onPress={openAddForm}>
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.addButtonText}>Add New Address</Text>
                </TouchableOpacity>
            )}

            {/* Form */}
            {showForm && (
                <View style={styles.formContainer}>
                    <Text style={styles.formTitle}>{editingId ? 'Edit Address' : 'New Address'}</Text>
                    {formError ? <Text style={styles.errorBox}>{formError}</Text> : null}

                    <FormInput label="Address Line" value={form.address} onChangeText={t => setForm(f => ({...f, address: t}))} error={fieldErrors.address} />
                    <View style={styles.rowInputs}>
                        <View style={{flex:1, marginRight: 8}}>
                            <FormInput label="City" value={form.city} onChangeText={t => setForm(f => ({...f, city: t}))} error={fieldErrors.city} />
                        </View>
                        <View style={{flex:1}}>
                            <FormInput label="Postal Code" value={form.postal_code} onChangeText={t => setForm(f => ({...f, postal_code: t}))} keyboardType="numeric" onBlur={handlePostalBlur} error={fieldErrors.postal_code} />
                        </View>
                    </View>
                    <FormInput label="Village / Area" value={form.village} onChangeText={t => setForm(f => ({...f, village: t}))} />
                    <FormInput label="Country" value={form.country} onChangeText={t => setForm(f => ({...f, country: t}))} />
                    <FormInput label="Phone Number" value={form.phone_number} onChangeText={t => setForm(f => ({...f, phone_number: t}))} keyboardType="phone-pad" error={fieldErrors.phone_number} />

                    <View style={styles.formActions}>
                        <TouchableOpacity onPress={closeForm} style={styles.cancelBtn} disabled={saving}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Address</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const FormInput = ({ label, value, onChangeText, keyboardType = 'default', error, onBlur }: any) => (
    <View style={styles.inputGroup}>
        <Text style={styles.label}>{label}</Text>
        <TextInput 
            style={[styles.input, error && styles.inputError]} 
            value={value} 
            onChangeText={onChangeText} 
            placeholder={label} 
            placeholderTextColor="#999"
            keyboardType={keyboardType}
            onBlur={onBlur}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F6FF' },
  
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#eee', elevation: 2
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },

  scrollContent: { padding: 16, paddingBottom: 40 },
  center: { alignItems: 'center', marginVertical: 40 },
  emptyText: { color: '#888', marginTop: 10, fontSize: 14 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  addressTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  addressText: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 4 },
  phoneText: { fontSize: 13, color: '#666' },
  
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
  
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center' },
  actionTextEdit: { marginLeft: 6, color: '#D4AF37', fontWeight: '600', fontSize: 13 },
  actionTextDelete: { marginLeft: 6, color: '#E04F5F', fontWeight: '600', fontSize: 13 },

  // Add Button
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#D4AF37', paddingVertical: 12, borderRadius: 8,
    shadowColor: "#D4AF37", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 5, elevation: 4
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 },

  // Form
  formContainer: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginTop: 16, elevation: 2 },
  formTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: '#333' },
  errorBox: { color: '#E04F5F', marginBottom: 12, backgroundColor: '#FFF0F0', padding: 8, borderRadius: 4 },
  
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 4 },
  input: { 
    backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EEE', 
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, 
    fontSize: 14, color: '#333' 
  },
  inputError: { borderColor: '#E04F5F' },
  errorText: { color: '#E04F5F', fontSize: 11, marginTop: 2 },
  
  rowInputs: { flexDirection: 'row' },

  formActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelText: { color: '#666', fontWeight: '600' },
  saveBtn: { backgroundColor: '#D4AF37', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  saveText: { color: '#fff', fontWeight: '700' },
});
