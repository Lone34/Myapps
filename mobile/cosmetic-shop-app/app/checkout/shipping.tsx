// app/checkout/shipping.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import client from '../../src/api/client';
import AppHeader from '../../src/components/AppHeader';
import AnimatedBackground from '../../src/components/AnimatedBackground'; 
import { useNavBar } from '../../src/context/NavBarContext';

import {
  saveShippingAddressLocal,
  loadShippingAddressLocal,
} from '../../src/utils/checkout';

const ShippingScreen = () => {
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar();
  const userInfo = useSelector(
    (s: any) => s.userLogin?.userInfo || s.user?.userInfo
  );

  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // manual form
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');
  const [phone, setPhone] = useState('');
  
  const [pincodeError, setPincodeError] = useState('');

  // GPS state
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    const init = async () => {
      if (!userInfo) {
        router.replace('/login?redirect=/checkout/shipping');
        return;
      }

      try {
        setLoading(true);

        // Load saved shipping from local (if any)
        const saved = await loadShippingAddressLocal();
        if (saved) {
          setAddress(saved.address || '');
          setCity(saved.city || '');
          setPostalCode(
            saved.postalCode ||
              saved.pincode ||
              saved.zipcode ||
              ''
          );
          setCountry(saved.country || 'India');
          setPhone(
            saved.phone ||
              saved.phone_number ||
              ''
          );

          // restore GPS if present
          if (saved.latitude != null || saved.lat != null) {
            setLatitude(saved.latitude ?? saved.lat ?? null);
          }
          if (saved.longitude != null || saved.lng != null) {
            setLongitude(saved.longitude ?? saved.lng ?? null);
          }

          if (saved.id) {
            setSelectedId(saved.id);
          }
        }

        // Fetch saved addresses from backend
        const { data } = await client.get('/api/addresses/');
        const list = data || [];
        setAddresses(list);
      } catch (e: any) {
        Alert.alert(
          'Shipping',
          e?.response?.data?.detail ||
            e?.message ||
            'Failed to load addresses.'
        );
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [userInfo]);

  const onSelectAddress = (addr: any) => {
    setSelectedId(addr.id);
    setAddress(addr.address || '');
    setCity(addr.city || '');
    setPostalCode(
      addr.postalCode ||
        addr.pincode ||
        addr.postal_code ||
        addr.zipcode ||
        ''
    );
    setCountry(addr.country || 'India');
    setPhone(
      addr.phone_number ||
        addr.phone ||
        ''
    );

    // pick GPS from backend address if available
    setLatitude(
      addr.latitude ??
        addr.lat ??
        null
    );
    setLongitude(
      addr.longitude ??
        addr.lng ??
        null
    );

    setPincodeError('');
    setLocationError('');
  };

  const handlePincodeBlur = async () => {
    const pin = (postalCode || '').trim();

    if (!pin) {
      setPincodeError('Pincode is required.');
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      setPincodeError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    setPincodeError('');

    try {
      const res = await fetch(
        `https://api.postalpincode.in/pincode/${pin}`
      );
      const json = await res.json();
      const info = json?.[0];

      if (
        info?.Status === 'Success' &&
        Array.isArray(info.PostOffice) &&
        info.PostOffice.length > 0
      ) {
        const po = info.PostOffice[0];
        setCity(city || po.District || '');
        setCountry('India');
      } else {
        setPincodeError('PIN code not found. Please check again.');
      }
    } catch (err) {
      console.log('Pincode lookup failed', err);
      // Don't block user if API fails
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLocLoading(true);
      setLocationError('');
  
      const { status } = await Location.requestForegroundPermissionsAsync();
  
      if (status !== 'granted') {
        setLocationError(
          'Location permission denied. Enable GPS in phone settings for live tracking.'
        );
        Alert.alert(
          'Location Required',
          'We need your GPS location to deliver your order accurately.'
        );
        return;
      }
  
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
  
      if (!pos.coords?.latitude || !pos.coords?.longitude) {
        setLocationError('Location not detected. Move to an open area and try again.');
        return;
      }
  
      setLatitude(pos.coords.latitude);
      setLongitude(pos.coords.longitude);
  
      Alert.alert('Location Captured', 'Your live location has been saved.');
    } catch (err) {
      console.log('Location error', err);
      setLocationError('Location failed. Please try again near an open area.');
    } finally {
      setLocLoading(false);
    }
  };
  

  const onContinue = async () => {
    if (!userInfo) {
      router.push('/login?redirect=/checkout/shipping');
      return;
    }
    if (latitude === null || longitude === null) {
      Alert.alert(
        'Live Location Required',
        'Please tap "Use Current Location" so we can deliver accurately.'
      );
      return;
    }
    
    if (!address.trim() || !city.trim() || !postalCode.trim()) {
      Alert.alert(
        'Shipping',
        'Please fill address, city and pincode.'
      );
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(postalCode.trim())) {
      Alert.alert(
        'Shipping',
        'Please enter a valid 6-digit Indian PIN code.'
      );
      return;
    }

    if (!phone.trim()) {
      Alert.alert(
        'Shipping',
        'Please enter a phone number for delivery.'
      );
      return;
    }

    const payload = {
      id: selectedId || undefined,
      address: address.trim(),
      city: city.trim(),
      postalCode: postalCode.trim(),
      country: (country || 'India').trim(),
      phone: phone.trim(),
      latitude,
      longitude,
    };

    try {
      await saveShippingAddressLocal(payload);
      router.push('/checkout/payment');
    } catch (e: any) {
      Alert.alert(
        'Shipping',
        e?.message ||
          'Failed to save shipping address.'
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D4AF37" />
        </View>
      </SafeAreaView>
    );
  }

  if (!userInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <View style={styles.center}>
          <Text style={styles.text}>Please login to continue.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
  
      {/* Global header */}
      <AppHeader placeholder="Search products, brands, shops..." />
  
      {/* Glass Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#F9FAFB" />
        </TouchableOpacity>
        <Text style={styles.toolbarTitle}>Shipping Details</Text>
      </View>
  
      <ScrollView
        style={styles.screen}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }} // Extra padding so button clears navbar
        onScroll={handleNavScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.title}>Delivery Address</Text>
        </View>

        {/* Saved addresses */}
        {addresses.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.subTitle}>
              Saved Addresses
            </Text>
            {addresses.map((addr: any) => {
              const pin =
                addr.postalCode ||
                addr.pincode ||
                addr.postal_code ||
                addr.zipcode ||
                '';

              const selected = selectedId === addr.id;

              return (
                <TouchableOpacity
                  key={addr.id}
                  style={[
                    styles.addrItem,
                    selected && styles.addrItemSelected,
                  ]}
                  onPress={() => onSelectAddress(addr)}
                  activeOpacity={0.7}
                >
                  <View style={styles.addrRow}>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? '#D4AF37' : '#94A3B8'}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.addrText, selected && { color: '#F9FAFB' }]}>
                        {addr.address}, {addr.city}
                        {pin ? ` - ${pin}` : ''}
                      </Text>
                      <Text style={styles.addrSubText}>
                        {addr.country || 'India'}
                        {addr.phone_number ? ` • ${addr.phone_number}` : ''}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Manual address form */}
        <View style={styles.card}>
          <Text style={styles.subTitle}>
            {addresses.length > 0 ? 'Or Enter New Address' : 'Enter New Address'}
          </Text>

          {/* Use current location */}
          <View style={styles.locationContainer}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.locationHint}>
                Use location to track realtime delivery partner
              </Text>
              {latitude != null && longitude != null && (
                <Text style={styles.locationSuccess}>
                  Location captured ✓
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={handleUseCurrentLocation}
              disabled={locLoading}
              style={styles.locationBtn}
            >
              <Ionicons
                name="locate-outline"
                size={16}
                color="#fff"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.locationBtnText}>
                {locLoading ? 'Getting...' : 'Use Current'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Address (Street, House No, Landmark)*</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. H.No 12, Main Street, Near Mosque"
              placeholderTextColor="#64748B"
              value={address}
              onChangeText={setAddress}
              multiline
            />
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.inputLabel}>City*</Text>
              <TextInput
                style={styles.input}
                placeholder="City"
                placeholderTextColor="#64748B"
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Pincode*</Text>
              <TextInput
                style={styles.input}
                placeholder="Pincode"
                placeholderTextColor="#64748B"
                value={postalCode}
                onChangeText={setPostalCode}
                onBlur={handlePincodeBlur}
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
          </View>

          {pincodeError ? (
            <Text style={styles.errorText}>{pincodeError}</Text>
          ) : null}

          {locationError ? (
            <Text style={styles.errorText}>{locationError}</Text>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Country</Text>
            <TextInput
              style={[styles.input, { color: '#94A3B8' }]}
              placeholder="Country"
              placeholderTextColor="#64748B"
              value={country}
              onChangeText={setCountry}
              editable={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number (Mandatory)*</Text>
            <TextInput
              style={styles.input}
              placeholder="10-digit mobile number"
              placeholderTextColor="#64748B"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* ✅ Button moved INSIDE ScrollView to avoid navbar overlap */}
        <TouchableOpacity style={styles.inlineContinueBtn} onPress={onContinue}>
            <Text style={styles.continueText}>Proceed to Payment</Text>
            <Ionicons name="arrow-forward" size={20} color="#000" />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
};

export default ShippingScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#001A33' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#001A33' },
  screen: { flex: 1, paddingHorizontal: 16 },

  // Glass Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  toolbarTitle: { fontSize: 18, fontWeight: '700', color: '#F9FAFB' },

  sectionTitleContainer: { marginTop: 20, marginBottom: 15 },
  title: { color: '#F9FAFB', fontSize: 22, fontWeight: '700' },
  text: { color: '#F9FAFB' },

  // Cards (Glass)
  card: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  subTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
  },

  // Address Item
  addrItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addrItemSelected: {
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  addrRow: { flexDirection: 'row', alignItems: 'center' },
  addrText: { color: '#CBD5E1', fontSize: 14, fontWeight: '500' },
  addrSubText: { color: '#94A3B8', fontSize: 12, marginTop: 2 },

  // Location UI
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 10,
  },
  locationHint: { fontSize: 13, color: '#CBD5E1' },
  locationSuccess: { fontSize: 11, color: '#4ADE80', marginTop: 4, fontWeight: '700' },
  locationBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#020617',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  locationBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Form
  inputGroup: { marginBottom: 14 },
  rowInputs: { flexDirection: 'row' },
  inputLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ✅ New Inline Button Styles (No Fixed Bottom Bar)
  inlineContinueBtn: {
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 10,
    marginBottom: 40, // Extra margin to ensure visibility
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  continueText: { color: '#020617', fontWeight: '800', fontSize: 16, marginRight: 8 },
});
