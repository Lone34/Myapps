// app/(tabs)/wishlist.tsx
import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  listMyWishlist,
  toggleWishlist,
} from '../../src/redux/actions/productActions';
import AppHeader from '../../src/components/AppHeader';
import { useNavBar } from '../../src/context/NavBarContext';
import AnimatedBackground from '../../src/components/AnimatedBackground';

export default function WishlistTab() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar();
  const { userInfo } = useSelector((state: any) => state.userLogin || {});
  const myWishlist = useSelector((state: any) => state.myWishlist || {});
  const { loading, error, products = [] } = myWishlist;

  // 1. Initial Load on Focus
  useFocusEffect(
    useCallback(() => {
      if (userInfo) {
        dispatch<any>(listMyWishlist());
      }
    }, [dispatch, userInfo])
  );

  // 2. Handle Remove Logic (Toggle + Refresh)
  const handleRemove = async (productId: any) => {
    try {
      await dispatch<any>(toggleWishlist(productId));
      dispatch<any>(listMyWishlist());
    } catch (e) {
      console.log('Error removing item', e);
    }
  };

  // ---------------- NOT LOGGED IN ----------------
  if (!userInfo) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wishlist</Text>
        </View>
        <View style={styles.center}>
          <Ionicons
            name="heart-circle-outline"
            size={80}
            color="#E5E7EB"
          />
          <Text style={styles.subtle}>
            Login to view and manage your wishlist.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/login')}
            style={styles.primaryBtn}
          >
            <Text style={styles.btnText}>Login / Register</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------- LOADING ----------------
  if (loading && !products.length) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#D4AF37" />
        </View>
      </SafeAreaView>
    );
  }

  // ---------------- ERROR ----------------
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={60}
            color="#FF8A80"
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------- EMPTY ----------------
  if (!products.length && !loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AnimatedBackground />
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
        />

        {/* Global KashmirCart header */}
        <AppHeader placeholder="Search products, brands..." />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wishlist</Text>
        </View>

        <View style={styles.center}>
          <Ionicons name="heart-outline" size={80} color="#E5E7EB" />
          <Text style={styles.subtle}>Your wishlist is empty.</Text>
          <TouchableOpacity
            onPress={() => router.push('/')}
            style={styles.primaryBtn}
          >
            <Text style={styles.btnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------- LIST VIEW ----------------
  const renderItem = ({ item }: any) => {
    const imageUrl =
      item.image ||
      'https://via.placeholder.com/400x400.png?text=Product';
    const price = Number(item.price || 0);
    const mrp = Number(item.mrp || 0);
    const hasDiscount = mrp > price && price > 0;
    const discountPercent = hasDiscount
      ? Math.round(((mrp - price) / mrp) * 100)
      : 0;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        onPress={() => router.push(`/product/${item.id}`)}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>

        <View style={styles.infoContainer}>
          <Text numberOfLines={2} style={styles.name}>
            {item.name}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{price.toFixed(0)}</Text>
            {hasDiscount && (
              <Text style={styles.mrp}>₹{mrp.toFixed(0)}</Text>
            )}
            {hasDiscount && (
              <Text style={styles.discount}>{discountPercent}% OFF</Text>
            )}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => router.push(`/product/${item.id}`)}
              style={styles.viewBtn}
            >
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleRemove(item.id)}
              style={styles.removeBtn}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color="#FF8A80"
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Global header – same logo + search as Home */}
      <AppHeader placeholder="Search your wishlist..." />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          My Wishlist ({products.length})
        </Text>
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={() => dispatch<any>(listMyWishlist())}
        onScroll={handleNavScroll}
        scrollEventThrottle={16}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#001A33' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },

  listContent: { padding: 16 },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    marginBottom: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  imageContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  image: { width: '100%', height: '100%', borderRadius: 8 },

  infoContainer: { flex: 1, justifyContent: 'space-between' },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F9FAFB',
    lineHeight: 18,
  },

  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
  mrp: {
    fontSize: 12,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discount: {
    fontSize: 12,
    color: '#4ADE80',
    fontWeight: '700',
  },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  viewBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#D4AF37',
    borderRadius: 20,
    marginRight: 12,
  },
  viewBtnText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  removeBtn: {
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.6)',
  },

  // Empty & Error States
  subtle: {
    color: '#E5E7EB',
    fontSize: 14,
    marginVertical: 12,
    textAlign: 'center',
  },
  errorText: { color: '#FFB4B4', fontSize: 14, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
    elevation: 2,
  },
  btnText: { color: '#111827', fontWeight: '700' },
});
