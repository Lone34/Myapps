import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useRouter } from 'expo-router';
import { getUserDetails, logout } from '../redux/actions/userActions';

const AccountScreen = () => {
  const dispatch = useDispatch();
  const router = useRouter();

  const { userInfo } = useSelector((state) => state.userLogin || {});
  const userDetails = useSelector((state) => state.userDetails || {});
  const { user, loading } = userDetails;

  useEffect(() => {
    if (userInfo) {
      dispatch(getUserDetails());
    }
  }, [dispatch, userInfo]);

  if (!userInfo) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtle}>Login to view your profile and orders.</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.primaryText}>Login / Register</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Account</Text>

      <View style={styles.card}>
        <Text style={styles.name}>{user?.name || userInfo.name}</Text>
        <Text style={styles.email}>{user?.email || userInfo.email}</Text>
      </View>

      <Link href="/orders" asChild>
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowText}>My Orders</Text>
        </TouchableOpacity>
      </Link>

      <Link href="/addresses" asChild>
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowText}>My Addresses</Text>
        </TouchableOpacity>
      </Link>

      <Link href="/wishlist" asChild>
        <TouchableOpacity style={styles.row}>
          <Text style={styles.rowText}>My Wishlist</Text>
        </TouchableOpacity>
      </Link>

      <TouchableOpacity
        style={[styles.row, styles.logoutRow]}
        onPress={() => {
          dispatch(logout());
          router.replace('/'); // back to home
        }}
      >
        <Text style={[styles.rowText, { color: '#f97316' }]}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

export default AccountScreen;

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  center: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 14,
  },
  subtle: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  primaryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#e63946',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111',
    padding: 14,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  name: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  email: {
    color: '#9ca3af',
    marginTop: 4,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#222',
  },
  logoutRow: {
    marginTop: 10,
    borderBottomWidth: 0,
  },
  rowText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
