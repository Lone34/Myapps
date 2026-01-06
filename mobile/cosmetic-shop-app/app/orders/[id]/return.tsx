// app/orders/[id]/return.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import client from '../../../src/api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';   
import { useNavBar } from '../../../src/context/NavBarContext';       

export default function OrderReturnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();                       
  const { handleScroll: handleNavScroll } = useNavBar();    
  const [reason, setReason] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) {
      Alert.alert('Required', 'Please enter a reason for return.');
      return;
    }
    try {
      setSaving(true);
      await client.post(`/api/orders/${id}/return/`, {
        reason,
        bank_account_name: bankName,
        bank_account_number: bankAccount,
        ifsc,
        upi_id: upi,
        phone,
      });
      Alert.alert('Success', 'Your return request has been submitted.', [
        { text: 'OK', onPress: () => router.replace('/my-returns') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Could not submit return request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={{padding: 4}}>
            <Ionicons name="arrow-back" size={24} color="#000" />
         </TouchableOpacity>
         <Text style={styles.headerTitle}>Request Return</Text>
         <View style={{width: 32}} />
      </View>

      <ScrollView
              style={styles.screen}
              contentContainerStyle={{
                padding: 20,
                paddingBottom: 120 + insets.bottom,  // 👈 leaves space above navbar
              }}
              showsVerticalScrollIndicator={false}
              onScroll={handleNavScroll}             // 👈 hide/show navbar when scrolling
              scrollEventThrottle={16}
            >
        
        <View style={styles.infoBox}>
            <Text style={styles.orderRef}>Order #{id}</Text>
            <Text style={styles.note}>
                Please fill in the details below to process your return.
            </Text>
        </View>

        {/* Reason */}
        <Text style={styles.label}>Reason for Return <Text style={{color:'red'}}>*</Text></Text>
        <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={reason}
            onChangeText={setReason}
            placeholder="Describe the issue with the product..."
            placeholderTextColor="#999"
        />

        <Text style={styles.sectionTitle}>Refund Details</Text>
        <Text style={styles.sectionSub}>Provide bank or UPI details for refund</Text>

        <View style={styles.formGroup}>
            <TextInput
                style={styles.input}
                value={bankName}
                onChangeText={setBankName}
                placeholder="Account Holder Name"
                placeholderTextColor="#999"
            />
            <TextInput
                style={styles.input}
                value={bankAccount}
                onChangeText={setBankAccount}
                placeholder="Bank Account Number"
                placeholderTextColor="#999"
                keyboardType="number-pad"
            />
            <TextInput
                style={styles.input}
                value={ifsc}
                onChangeText={setIfsc}
                placeholder="IFSC Code"
                placeholderTextColor="#999"
                autoCapitalize="characters"
            />
            
            <View style={styles.divider}><Text style={styles.dividerText}>OR</Text></View>

            <TextInput
                style={styles.input}
                value={upi}
                onChangeText={setUpi}
                placeholder="UPI ID (e.g. name@okhdfcbank)"
                placeholderTextColor="#999"
            />
        </View>

        <Text style={styles.label}>Contact Phone</Text>
        <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone Number"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
        />

        <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={submit}
            disabled={saving}
        >
            <Text style={styles.buttonText}>{saving ? 'Submitting...' : 'Submit Request'}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F9FA' },
  screen: { flex: 1 },
  
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },

  infoBox: { marginBottom: 20 },
  orderRef: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 4 },
  note: { color: '#666', fontSize: 13 },

  label: { color: '#333', fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 10 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#333',
    marginBottom: 12,
    fontSize: 14
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginTop: 20 },
  sectionSub: { fontSize: 12, color: '#888', marginBottom: 12 },
  
  formGroup: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#eee', marginBottom: 10 },
  
  divider: { alignItems: 'center', marginVertical: 10 },
  dividerText: { color: '#aaa', fontSize: 12, fontWeight: '700' },

  button: {
    marginTop: 30,
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: "#D4AF37", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 5, elevation: 5
  },
  buttonDisabled: { backgroundColor: '#ddd', shadowOpacity: 0 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
