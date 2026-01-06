import React, { useEffect } from 'react';
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
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { listCategories } from '../../src/redux/actions/categoryActions';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../src/components/AppHeader';
import { useNavBar } from '../../src/context/NavBarContext';
import AnimatedBackground from '../../src/components/AnimatedBackground';

const { width } = Dimensions.get('window');

// 3 columns layout
const COLUMN_COUNT = 3;
// Calculate width based on screen size minus padding and gaps
const ITEM_WIDTH = (width - 48) / COLUMN_COUNT; 

export default function CategoriesTab() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { handleScroll: handleNavScroll } = useNavBar();
  const { loading, error, categories } = useSelector(
    (state: any) => state.categoryList || {}
  );

  useEffect(() => {
    dispatch<any>(listCategories());
  }, [dispatch]);

  const renderItem = ({ item }: any) => {
    const imageUri = item.image || null;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.categoryItem}
        onPress={() =>
          router.push({
            pathname: '/category/[slug]',
            params: { slug: String(item.slug) },
          })
        }
      >
        {/* IMAGE CONTAINER (PORTRAIT RECTANGLE) */}
        <View style={styles.imageWrapper}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>
                {item.name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* TEXT BELOW IMAGE - NO BACKGROUND */}
        <Text numberOfLines={2} style={styles.categoryName}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <AppHeader placeholder="Search categories..." />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Categories</Text>
      </View>

      {!categories || categories.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="grid-outline" size={64} color="#888" />
          <Text style={styles.subtle}>No categories found.</Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          key={`grid-${COLUMN_COUNT}`} 
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          onScroll={handleNavScroll}
          scrollEventThrottle={16}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#001A33',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#D4AF37',
    letterSpacing: 0.5,
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 8,
  },
  categoryItem: {
    width: ITEM_WIDTH,
    marginHorizontal: 4,
    marginBottom: 20, // Increased margin for text space below
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: ITEM_WIDTH * 1.35, // Portrait rectangle
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    // Minimal shadow for depth
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 8, // Space between image and text below
  },
  image: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    lineHeight: 14,
    width: '95%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#D4AF37',
  },
  subtle: {
    marginTop: 8,
    color: '#CCCCCC',
    fontSize: 16,
  },
  errorText: {
    color: '#FFCDD2',
    fontSize: 14,
    textAlign: 'center',
  },
});
