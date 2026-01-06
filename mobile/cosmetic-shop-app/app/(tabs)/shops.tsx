// app/(tabs)/shops.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import client from '../../src/api/client';
import AppHeader from '../../src/components/AppHeader';
import { useNavBar } from '../../src/context/NavBarContext';
import AnimatedBackground from '../../src/components/AnimatedBackground';

type ShopCategory = {
  id: number;
  name: string;
  slug: string;
  image_url?: string | null;
  shops_count?: number;
  position?: number;
};

const ShopsTabScreen: React.FC = () => {
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar();

  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const loadCategories = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError('');
      const { data } = await client.get<ShopCategory[]>('/api/shop-categories/');
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      setError('Failed to load shop categories. Please try again.');
      setCategories([]);
    } finally {
      if (isRefresh) setRefreshing(false);
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCategories(false);
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadCategories(true);
  };

  const goToCategory = (cat: ShopCategory) => {
    router.push(`/shops/category/${cat.slug}`);
  };

  const initial = (name?: string) =>
    name && name.trim().length > 0 ? name.trim()[0].toUpperCase() : 'C';

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />

      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <AppHeader placeholder="Search shops, products..." />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#D4AF37"
          />
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleNavScroll}
        scrollEventThrottle={16}
      >
        {loading && !categories.length ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#D4AF37" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>

            <TouchableOpacity
              style={styles.allBtn}
              onPress={() => router.push('/shops/all')}
              activeOpacity={0.9}
            >
              <Text style={styles.allBtnText}>Browse All Shops</Text>
            </TouchableOpacity>
          </View>
        ) : categories.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No categories found.</Text>

            <TouchableOpacity
              style={styles.allBtn}
              onPress={() => router.push('/shops/all')}
              activeOpacity={0.9}
            >
              <Text style={styles.allBtnText}>Browse All Shops</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.card}
                  onPress={() => goToCategory(c)}
                  activeOpacity={0.92}
                >
                  {c.image_url ? (
                    <Image
                      source={{ uri: c.image_url }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.initialWrapper}>
                      <Text style={styles.initialText}>{initial(c.name)}</Text>
                    </View>
                  )}

                  <View style={styles.overlay} />

                  <View style={styles.cardBody}>
                    <Text style={styles.catName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.catMeta} numberOfLines={1}>
                      {typeof c.shops_count === 'number'
                        ? `${c.shops_count} shops`
                        : 'Tap to view shops'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.allBtn}
              onPress={() => router.push('/shops/all')}
              activeOpacity={0.9}
            >
              <Text style={styles.allBtnText}>Browse All Shops</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ShopsTabScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#001A33' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  countBadge: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  countText: { color: '#FFE082', fontSize: 11, fontWeight: '700' },

  scrollContent: { padding: 12, paddingBottom: 40 },

  center: { paddingVertical: 50, alignItems: 'center' },
  emptyText: { color: '#CCCCCC', fontSize: 14 },
  errorText: { color: '#FFCDD2', fontSize: 14, textAlign: 'center' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  card: {
    width: '48%',
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#0B1220',
  },
  initialWrapper: {
    width: '100%',
    height: 140,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: { fontSize: 34, fontWeight: '800', color: '#D4AF37'},

  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  cardBody: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },
  catName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  catMeta: { color: '#fff', fontSize: 11, marginTop: 2 },

  allBtn: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(212,175,55,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  allBtnText: {
    color: '#FFE082',
    fontWeight: '800',
    fontSize: 14,
  },
});
