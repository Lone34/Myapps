// app/product/[id].tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
  ScrollView as RNScrollView,
  Animated,
  Easing,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import client from '../../src/api/client';
import { setBuyNowCheckoutItems } from '../../src/utils/checkout';
// import * as Location from 'expo-location'; // ❌ REMOVED
import { useGlobalLocation } from '../../src/context/LocationContext'; // ✅ ADDED
import AppHeader from '../../src/components/AppHeader';
import { useNavBar } from '../../src/context/NavBarContext';
import AnimatedBackground from '../../src/components/AnimatedBackground';

type Product = any;
type ProductImageItem = {
  src: string;
  colorName?: string | null;
  id?: string | number;
  isPrimary?: boolean;
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const toNumber = (value: any, fallback = 0): number => {
  const n = Number(
    typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value
  );
  return Number.isFinite(n) ? n : fallback;
};

const buildUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (client.defaults.baseURL || '').replace(/\/+$/, '');
  const cleanBase = base.endsWith('/api') ? base.slice(0, -4) : base;
  if (!cleanBase) return '';
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${cleanBase}/${cleanPath}`;
};

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// ---------- NEW: Elegant Ripple Loading Screen ----------
const ElegantLoadingScreen = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;
  
  const taglineFade = useRef(new Animated.Value(1)).current;
  const [taglineIndex, setTaglineIndex] = useState(0);

  const TAGLINES = [
    { text: "Delivery In Minutes", isUrdu: false },
    { text: "کپواہ کاٹ آپ کی خدمت میں", isUrdu: true},
  ];

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    const createRipple = (anim, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true })
        ])
      );
    };

    Animated.parallel([createRipple(ripple1, 0), createRipple(ripple2, 600), createRipple(ripple3, 1200)]).start();

    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(taglineFade, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.delay(100),
      ]).start(() => {
        setTaglineIndex((prev) => (prev + 1) % TAGLINES.length);
        Animated.timing(taglineFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const currentTagline = TAGLINES[taglineIndex];

  const renderRipple = (anim) => {
    const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 4] });
    const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] });
    return <Animated.View style={[styles.loaderRipple, { transform: [{ scale }], opacity }]} />;
  };

  return (
    <View style={styles.loadingContainer}>
      <View style={styles.loaderCenterWrapper}>
        {renderRipple(ripple1)}
        {renderRipple(ripple2)}
        {renderRipple(ripple3)}
        <Animated.View style={[styles.loaderLogoCircle, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.loaderLogoText}>KC</Text>
        </Animated.View>
      </View>
      <View style={styles.loaderTextWrapper}>
        <Text style={styles.loaderBrandText}>KupwaraCart</Text>
        <Animated.Text style={[styles.loaderTagline, { opacity: taglineFade, fontSize: currentTagline.isUrdu ? 20 : 13, marginTop: currentTagline.isUrdu ? 4 : 8 }]}>
          {currentTagline.text}
        </Animated.Text>
      </View>
      <View style={{ position: 'absolute', bottom: 50 }}><ActivityIndicator size="small" color="#D4AF37" /></View>
    </View>
  );
};

export default function ProductScreen() {
  const { id, shop, lat, lon } = useLocalSearchParams<{ 
    id: string; 
    shop?: string;
    lat?: string;
    lon?: string; 
  }>();
  
  const productId = String(id);
  const shopParam = shop ? String(shop) : undefined;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handleScroll: handleNavScroll } = useNavBar();

  const userInfo = useSelector(
    (state: any) => state.userLogin?.userInfo || state.user?.userInfo
  );

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  // Recommendations
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [discountProducts, setDiscountProducts] = useState<Product[]>([]);
  const [exploreProducts, setExploreProducts] = useState<Product[]>([]);
  const [nearbyProducts, setNearbyProducts] = useState<Product[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  // ✅ GLOBAL LOCATION INTEGRATION
  const { location: globalLocation, refreshLocation, permissionStatus } = useGlobalLocation();
  
  // Computed User Location: Use Global first, fallback to params
  const userLocation = useMemo(() => {
    if (globalLocation) return globalLocation;
    if (lat && lon) {
      const parsedLat = parseFloat(lat);
      const parsedLon = parseFloat(lon);
      if (!isNaN(parsedLat) && !isNaN(parsedLon)) return { lat: parsedLat, lon: parsedLon };
    }
    return null;
  }, [globalLocation, lat, lon]);

  // Derived state from global permissions
  const locationDenied = permissionStatus === 'denied';

  // Media & UI States
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const lightboxRef = useRef<FlatList<ProductImageItem> | null>(null);
  const [wishlisted, setWishlisted] = useState(false);

  // Review States
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [reviewMedia, setReviewMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Review Media Viewer States
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [activeMediaList, setActiveMediaList] = useState<any[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // ✅ SINGLE SELECTION STATES (GENERIC)
  const [selectedOption, setSelectedOption] = useState<string | null>(null); 
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  
  const galleryScrollRef = useRef<RNScrollView | null>(null);

  // --- Load Data ---
  const loadProduct = async () => {
    try {
      setLoading(true);
      setErr(null);
      const { data } = await client.get(`/api/products/${productId}/`, {
        params: shopParam ? { shop: shopParam } : undefined,
      });
      setProduct(data);
      
      // Reset selections on new product load
      setSelectedOption(null);
      setSelectedSize(null);
      setQty(1);
      
      if (data?.wishlist && userInfo?.id) {
        const wl = data.wishlist;
        const isIn = Array.isArray(wl) && wl.some((uid: any) => uid === userInfo.id);
        setWishlisted(!!isIn);
      } else {
        setWishlisted(false);
      }
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  // Helper for Recos
  const filterUniqueProducts = (list: any[]) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    return list.filter((item) => {
      if (String(item.id) === String(productId)) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  // ✅ Updated to use `userLocation` (from global or params)
  const loadRecommendations = async () => {
    try {
      const locParams = userLocation ? { lat: userLocation.lat, lon: userLocation.lon } : {};
      const [similarRes, discountRes, exploreRes] = await Promise.all([
        client.get('/api/recommendations/', { params: { context: 'product', type: 'same_category', for_products: productId, limit: 6, ...locParams } }),
        client.get('/api/recommendations/', { params: { context: 'product', type: 'discounts', for_products: productId, limit: 6, ...locParams } }),
        client.get('/api/recommendations/', { params: { context: 'product', type: 'behavioral', for_products: productId, limit: 6, ...locParams } }),
      ]);
      setSimilarProducts(filterUniqueProducts(similarRes.data || []));
      setDiscountProducts(filterUniqueProducts(discountRes.data || []));
      setExploreProducts(filterUniqueProducts(exploreRes.data || []));
    } catch (e) { console.log('Reco error', e); }
  };

  const fetchNearbyProducts = async (latVal: number, lonVal: number) => {
    try {
      setNearbyLoading(true);
      const { data } = await client.get('/api/recommendations/nearby-products/', { params: { lat: latVal, lon: lonVal, limit: 18 }, timeout: 15000 });
      const list = Array.isArray(data) ? data : data?.results || data?.products || [];
      setNearbyProducts(filterUniqueProducts(list || []));
    } catch (e: any) { setNearbyProducts([]); } finally { setNearbyLoading(false); }
  };

  // ✅ UPDATED: Triggered on mount to ensure we have location
  const ensureLocationAndNearby = async () => {
     refreshLocation(); // Uses Global Context to trigger update
     // Note: we don't fetch here, we rely on the useEffect below
  };

  useEffect(() => {
    if (!productId) return;
    loadProduct();
    // loadRecommendations called below via userLocation change or here initially
    loadRecommendations();
  }, [productId]); 

  useEffect(() => { ensureLocationAndNearby(); }, []);

  // ✅ NEW EFFECT: Fetch nearby when userLocation becomes available
  useEffect(() => {
    if (userLocation) {
        if (!nearbyProducts.length) {
            fetchNearbyProducts(userLocation.lat, userLocation.lon);
        }
        // Optionally reload recos to get accurate distance info
        loadRecommendations();
    }
  }, [userLocation]);

  // ==============================================================
  // 🌟 NEW: GENERIC GROUPING LOGIC (Replacing Color Logic)
  // ==============================================================

  const { uniqueOptions, variationsByOption, hasOptions, simpleVariations } = useMemo(() => {
    if (!product?.variations?.length) {
      return { uniqueOptions: [], variationsByOption: {}, hasOptions: false, simpleVariations: [] };
    }

    const map: Record<string, any[]> = {};
    const uniqueOptSet = new Set<string>();
    const simpleList: any[] = [];
    let foundOptionData = false;

    product.variations.forEach((v: any) => {
      // 1. Try to find the "Grouping" key (formerly color_name, or extra attrs)
      let optionVal = v.color_name; 
      
      if (!optionVal && v.extra_attrs) {
        // Check for common grouping keys like 'Pack', 'Option', 'Material', 'Color'
        optionVal = v.extra_attrs.Option || v.extra_attrs.Pack || v.extra_attrs.Color || v.extra_attrs.Colour || v.extra_attrs.Material;
      }
      
      if (optionVal) {
        foundOptionData = true;
        uniqueOptSet.add(optionVal);
        if (!map[optionVal]) map[optionVal] = [];
        map[optionVal].push(v);
      } else {
        // These variations don't have a secondary group (just Size/Value)
        simpleList.push(v);
      }
    });

    return {
      uniqueOptions: Array.from(uniqueOptSet),
      variationsByOption: map,
      hasOptions: foundOptionData,
      simpleVariations: simpleList
    };
  }, [product]);

  // Images logic
  const productImages: ProductImageItem[] = useMemo(() => {
    if (!product) return [];
    const list: ProductImageItem[] = [];
    
    if (Array.isArray(product.images)) {
      product.images.forEach((img: any) => {
        const src = buildUrl(img.image);
        if (!src) return;
        // img.color_name now generic (could be "Pack of 1", "Red", etc.)
        list.push({ src, colorName: img.color_name || null, id: img.id ?? src });
      });
    }
    
    // Add main image if missing
    if (product.image) {
        const mainSrc = buildUrl(product.image);
        if (!list.some(i => i.src === mainSrc)) {
             list.unshift({ src: mainSrc, colorName: null, isPrimary: true, id: `primary-${product.id}` });
        } else if (list.length === 0) {
             list.push({ src: mainSrc, colorName: null, isPrimary: true, id: `primary-${product.id}` });
        }
    }
    return list;
  }, [product]);

  // Auto-Select First Option
  useEffect(() => {
    if (hasOptions && uniqueOptions.length > 0 && !selectedOption) {
      handleOptionSelect(uniqueOptions[0]);
    } 
  }, [hasOptions, uniqueOptions]);

  // Handle Option Selection (Resets Size/Sub-variant)
  const handleOptionSelect = (optVal: string) => {
    setSelectedOption(optVal);
    setSelectedSize(null); // ✅ THIS RESETS THE PREVIOUS SELECTION

    // Sync Image
    const idx = productImages.findIndex(
      img => img.colorName && img.colorName.toLowerCase() === optVal.toLowerCase()
    );
    if (idx >= 0) {
      setSelectedImageIndex(idx);
    }
  };

  // Get Selected Variation Object
  const currentVariation = useMemo(() => {
    if (hasOptions) {
      if (!selectedOption || !selectedSize) return null;
      const vars = variationsByOption[selectedOption];
      return vars?.find((v: any) => v.value === selectedSize) || null;
    } else {
      if (!selectedSize) return null;
      return simpleVariations.find((v: any) => v.value === selectedSize) || null;
    }
  }, [hasOptions, selectedOption, selectedSize, variationsByOption, simpleVariations]);

  // ==============================================================
  // 💰 PRICES & STOCK (with specific variation MRP logic)
  // ==============================================================
  const displayPrice = useMemo(() => {
    if (currentVariation?.price != null) return toNumber(currentVariation.price);
    if (product?.price != null) return toNumber(product.price);
    return 0;
  }, [currentVariation, product]);

  const displayMrp = useMemo(() => {
    // 1. Check if specific variation has MRP (and it's valid)
    if (currentVariation?.mrp != null) {
       const vMrp = toNumber(currentVariation.mrp);
       if (vMrp > 0) return vMrp;
    }
    // 2. Fallback to product MRP
    if (product?.mrp != null) return toNumber(product.mrp);
    
    return displayPrice; // Fallback to price if no MRP
  }, [currentVariation, product, displayPrice]);

  const showDiscount = displayMrp > displayPrice;
  const discountPct = showDiscount ? Math.round(((displayMrp - displayPrice) / displayMrp) * 100) : null;

  let stockLabel = 'In Stock';
  let stockColor = '#27ae60';
  let isOutOfStock = false;

  if (product?.variations?.length > 0) {
      if (!currentVariation) {
          stockLabel = 'Select Options'; 
          stockColor = '#f39c12';
      } else {
          if (currentVariation.stock <= 0) {
              stockLabel = 'Out of Stock'; 
              stockColor = '#e74c3c';
              isOutOfStock = true;
          } else if (currentVariation.stock <= 10) {
              stockLabel = `Low Stock: ${currentVariation.stock} left`; 
              stockColor = '#d97706';
          }
      }
  } else {
      if (!product?.available) {
          stockLabel = 'Unavailable';
          stockColor = '#e74c3c';
          isOutOfStock = true;
      }
  }

  // Image Scroll Sync
  useEffect(() => {
    if (!galleryScrollRef.current) return;
    const width = SCREEN_WIDTH - 40;
    if (width <= 0) return;
    galleryScrollRef.current.scrollTo({ x: width * selectedImageIndex, animated: true });
  }, [selectedImageIndex]);

  const handleThumbnailClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  // --- Actions ---
  const ensureLoggedIn = (msg: string) => {
    if (!userInfo) {
      Alert.alert('Login Required', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Login', onPress: () => router.push('/login') }]);
      return false;
    }
    return true;
  };

  // ======================================================
  // 🔒 UPDATED: HANDLE ADD TO CART WITH SHOP CONFLICT
  // ======================================================
  const handleAddToCart = async (forceNewBasket = false) => {
    if (!ensureLoggedIn('Please login to shop.')) return;
    
    // Check if user needs to select something
    if ((hasOptions || simpleVariations.length > 0) && !currentVariation) {
        Alert.alert('Select Options', 'Please select your options to continue.');
        return;
    }
    
    if (currentVariation && currentVariation.stock <= 0) {
        Alert.alert('Out of Stock', 'This option is currently out of stock.');
        return;
    }
    
    try {
      // Pass force_new_basket param to backend
      await client.post('/api/cart/add/', { 
          variation_id: currentVariation ? Number(currentVariation.id) : null,
          quantity: qty, 
          color_name: selectedOption, // Pass generic grouping value here
          replace: false,
          force_new_basket: forceNewBasket
      });

      Alert.alert('Added to Cart', 'Successfully added.', [
        { text: 'Go to Cart', onPress: () => router.push('/(tabs)/cart') }, 
        { text: 'Stay Here', style: 'cancel' }
      ]);

    } catch (e: any) { 
        // 🔒 CHECK FOR SHOP MISMATCH ERROR
        if (e?.response?.status === 409 && e?.response?.data?.detail === 'SHOP_MISMATCH') {
            const { existing_shop_name } = e.response.data;
            
            Alert.alert(
                'Different Shop Detected',
                `Your cart contains items from "${existing_shop_name}".\n\nYou can only order from one shop at a time.`,
                [
                    { 
                        text: 'Cancel', 
                        style: 'cancel' 
                    },
                    { 
                        text: 'Buy Now Instead', 
                        onPress: handleBuyNow // Directs them to checkout immediately
                    },
                    { 
                        text: 'Clear Cart & Add', 
                        style: 'destructive',
                        onPress: () => handleAddToCart(true) // Recursively call with force=true
                    }
                ]
            );
            return;
        }

        Alert.alert('Error', e?.response?.data?.detail || 'Could not add to cart'); 
    }
  };

  const handleBuyNow = async () => {
    if (!ensureLoggedIn('Please login to buy.')) return;
    if ((hasOptions || simpleVariations.length > 0) && !currentVariation) {
        Alert.alert('Select Options', 'Please select your options to continue.');
        return;
    }
    if (currentVariation && currentVariation.stock <= 0) {
        Alert.alert('Out of Stock', 'This option is currently out of stock.');
        return;
    }
    
    try {
      await setBuyNowCheckoutItems({
        variation_id: currentVariation ? Number(currentVariation.id) : undefined,
        qty,
        color_name: selectedOption,
        meta: {
          product: { id: product.id, name: product.name, image: product.image, mrp: product.mrp, price: currentVariation?.price ?? product.price, cod_available: product.cod_available },
          variation: currentVariation ? { id: Number(currentVariation.id), value: currentVariation.value || '', price: currentVariation.price ?? product.price } : undefined,
        },
      });
      router.push('/checkout/summary');
    } catch (e: any) { Alert.alert('Error', 'Could not proceed to checkout'); }
  };

  // --- Rendering Helpers ---
  const renderStars = (val: number, size = 14, color = '#FFC107') => (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= val ? 'star' : 'star-outline'} size={size} color={color} />
      ))}
    </View>
  );

  const pickMedia = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.5, videoMaxDuration: 60,
    });
    if (result.canceled) return;
    setReviewMedia([...reviewMedia, ...result.assets]);
  };

  const submitReview = async () => {
    if (!ensureLoggedIn('Login to write a review.')) return;
    if (userRating === 0) { Alert.alert('Rating Required', 'Please select a star rating.'); return; }
    try {
      setSubmittingReview(true);
      const formData = new FormData();
      formData.append('rating', String(userRating));
      formData.append('comment', userComment);
      reviewMedia.forEach((asset, index) => {
        const isVideo = asset.type === 'video';
        const file = {
          uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
          type: isVideo ? 'video/mp4' : 'image/jpeg',
          name: `media_${Date.now()}_${index}.${isVideo ? 'mp4' : 'jpg'}`,
        } as any;
        // @ts-ignore
        formData.append('media', file);
      });
      await client.post(`/api/products/${productId}/reviews/`, formData, {
        headers: { Accept: 'application/json', 'Content-Type': 'multipart/form-data' },
      });
      setReviewModalVisible(false);
      setReviewMedia([]); setUserComment(''); setUserRating(5);
      Alert.alert('Success', 'Review submitted successfully');
      loadProduct();
    } catch (e) { Alert.alert('Error', 'Failed to submit review.'); }
    finally { setSubmittingReview(false); }
  };

  const buildReviewMediaUrl = (path?: string | null) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = (client.defaults.baseURL || '').replace(/\/$/, '');
    return `${base}${path}`;
  };

  const openMediaViewer = (mediaList: any[], index: number) => {
    const formatted = mediaList.map(m => {
        const url = typeof m === 'string' ? m : (m.file || m.image);
        return { 
            url: buildReviewMediaUrl(url), 
            type: (m.file && m.file.endsWith('.mp4')) || (typeof m === 'string' && m.endsWith('.mp4')) ? 'video' : 'image' 
        };
    });
    setActiveMediaList(formatted);
    setActiveMediaIndex(index);
    setMediaViewerVisible(true);
  };

  // Delivery check logic
  let distanceKm: number | null = null;
  let isDeliverable = false;
  if (product?.shop && userLocation) {
      const sLat = toNumber(product.shop.latitude);
      const sLon = toNumber(product.shop.longitude);
      if (sLat && sLon) distanceKm = getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, sLat, sLon);
      const radius = product.shop.delivery_radius || 15;
      isDeliverable = distanceKm !== null && distanceKm <= radius;
  }

  // Reco Rendering
  const renderNearbySection = () => {
    if (locationDenied) return (<View style={styles.recoContainer}><Text style={{paddingHorizontal: 20, color:'#9CA3AF'}}>Turn on location to see nearby products.</Text></View>);
    if (nearbyLoading && !nearbyProducts.length) return (<View style={styles.recoContainer}><ActivityIndicator size="small" color="#D4AF37" /></View>);
    if (!nearbyProducts.length) return null;
    return renderGrid(nearbyProducts, "Shop Products Near You", true);
  };

  const renderRecoSection = (title: string, data: Product[], typeKey: string) => {
    if (!data || !data.length) return null;
    return renderGrid(data, title, false, typeKey);
  };

  const renderGrid = (data: Product[], title: string, isNearby: boolean, typeKey?: string) => (
    <View style={styles.recoContainer}>
      <View style={styles.recoHeader}>
        <Text style={styles.recoTitle}>{title}</Text>
        <TouchableOpacity onPress={() => router.push({ pathname: '/listing', params: { type: isNearby ? 'nearby' : 'reco', title, key: typeKey, baseProductId: productId, lat: String(userLocation?.lat), lon: String(userLocation?.lon) } })}>
          <Text style={styles.viewAllText}>VIEW ALL</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.grid}>
        {data.slice(0, 6).map((item) => {
            const img = buildUrl(item.image);
            const price = Number(item.price);
            const mrp = Number(item.mrp);
            const hasDiscount = mrp > price;
            const discount = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
            const shop = item.shop || {};
            const dist = shop.distance_km || item.distance_km;
            const radius = shop.delivery_radius || 15;
            let badgeLabel = null; let badgeStyle = {}; let badgeTextStyle = {};
            if (dist !== null && dist !== undefined) {
                const distVal = Number(dist);
                if (distVal <= radius) { badgeLabel = "Deliverable"; badgeStyle = styles.badgeGreen; badgeTextStyle = styles.badgeTextGreen; }
                else { badgeLabel = "Not Deliverable"; badgeStyle = styles.badgeRed; badgeTextStyle = styles.badgeTextRed; }
            }
            return (
              <TouchableOpacity key={item.id} style={styles.gridCard} activeOpacity={0.9} onPress={() => router.push({ pathname: '/product/[id]', params: { id: item.id, lat: String(userLocation?.lat), lon: String(userLocation?.lon) } })}>
                <View style={styles.gridImgWrapper}>{img ? <Image source={{ uri: img }} style={styles.gridImg} resizeMode="cover" /> : <View style={styles.gridPlaceholder} />}</View>
                {badgeLabel && (<View style={[styles.deliveryBadge, badgeStyle, {marginBottom: 4, alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 6}]}><Ionicons name={badgeLabel === "Deliverable" ? "checkmark-circle" : "close-circle"} size={10} color={badgeLabel === "Deliverable" ? "#86efac" : "#fecaca"} style={{marginRight: 3}} /><Text style={[badgeTextStyle, {fontSize: 9}]}>{badgeLabel}</Text></View>)}
                <Text numberOfLines={2} style={styles.gridName}>{item.name}</Text>
                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2}}>
                  <View style={{flexDirection: 'row', alignItems: 'baseline'}}><Text style={styles.gridPrice}>₹{price.toFixed(0)}</Text>{hasDiscount && <Text style={styles.gridDiscountText}>{discount}% OFF</Text>}</View>
                  {dist !== undefined && dist !== null && (<Text style={{fontSize: 9, color: '#9CA3AF'}}>{Number(dist).toFixed(1)} km</Text>)}
                </View>
              </TouchableOpacity>
            );
        })}
      </View>
    </View>
  );

  if (loading) return <ElegantLoadingScreen />;
  if (err || !product) return <View style={styles.center}><Text style={{ color: '#E5E7EB' }}>Product not found</Text></View>;

  const reviews = product.reviews || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <AppHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} onScroll={handleNavScroll} scrollEventThrottle={16}>
        {/* --- Image Gallery --- */}
        <View style={styles.galleryContainer}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => productImages.length && setLightboxVisible(true)} style={styles.mainImageWrapper}>
            <RNScrollView ref={galleryScrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setSelectedImageIndex(Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 40)))}>
              {productImages.map((img, i) => (<View key={img.id ?? i} style={{ width: SCREEN_WIDTH - 40, height: '100%', justifyContent: 'center', alignItems: 'center' }}><Image source={{ uri: img.src }} style={styles.mainImage} resizeMode="contain" /></View>))}
            </RNScrollView>
          </TouchableOpacity>
          {productImages.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailScroll}>
              {productImages.map((img, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleThumbnailClick(i)}
                  style={[styles.thumbnailItem, i === selectedImageIndex && styles.thumbnailItemActive]}
                >
                  <Image source={{ uri: img.src }} style={styles.thumbnailImg} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.brandNameText}>{product.brand}</Text>
          <Text style={styles.productName}>{product.name}</Text>
          {product.shop && (
            <View style={styles.shopMetaRow}>
               <Text style={styles.shopNameText}>🏪 {product.shop.name}</Text>
               {userLocation ? (distanceKm !== null && (<View style={[styles.deliveryBadge, isDeliverable ? styles.badgeGreen : styles.badgeRed]}><Ionicons name={isDeliverable ? "checkmark-circle" : "close-circle"} size={12} color={isDeliverable ? "#86efac" : "#fecaca"} style={{marginRight: 4}} /><Text style={isDeliverable ? styles.badgeTextGreen : styles.badgeTextRed}>{isDeliverable ? "Deliverable" : "No Delivery"} ({distanceKm.toFixed(1)} km)</Text></View>)) : (<Text style={{fontSize: 12, color: '#6B7280', fontStyle:'italic'}}>Checking delivery...</Text>)}
            </View>
          )}
          <View style={styles.ratingRow}>{renderStars(product.rating || 0)}<Text style={styles.reviewCount}>({product.numReviews || 0} reviews)</Text></View>
          
          {/* Price Block with correct MRP check */}
          <View style={styles.priceBlock}>
              <Text style={styles.finalPrice}>₹{displayPrice.toFixed(0)}</Text>
              {showDiscount && (
                  <>
                    <Text style={styles.strikePrice}>MRP ₹{displayMrp.toFixed(0)}</Text>
                    <Text style={styles.discountTag}>{discountPct}% OFF</Text>
                  </>
              )}
          </View>
          
          {/* Stock Badge */}
          <View style={[styles.stockBadge, { backgroundColor: stockColor + '20' }]}>
              <Text style={[styles.stockText, { color: stockColor }]}>{stockLabel}</Text>
          </View>
        </View>

        <View style={[styles.returnPolicyRow, product?.is_returnable === false ? styles.returnPolicyPillRed : styles.returnPolicyPillGreen]}><Ionicons name={product?.is_returnable === false ? "close-circle-outline" : "refresh-circle"} size={16} color={product?.is_returnable === false ? "#D32F2F" : "#2E7D32"} style={{ marginRight: 4 }} /><Text style={product?.is_returnable === false ? styles.returnPolicyTextRed : styles.returnPolicyTextGreen}>{product?.is_returnable === false ? "No returns" : "Return Available"}</Text></View>
        <View style={[styles.returnPolicyRow, product?.cod_available === false ? styles.returnPolicyPillRed : styles.returnPolicyPillGreen]}><Ionicons name="cash-outline" size={16} color={product?.cod_available === false ? "#D32F2F" : "#2E7D32"} style={{ marginRight: 4 }} /><Text style={product?.cod_available === false ? styles.returnPolicyTextRed : styles.returnPolicyTextGreen}>{product?.cod_available === false ? "COD Not Available" : "COD Available"}</Text></View>
        <View style={styles.divider} />

        {/* ================================================= */}
        {/* 🌈 FIXED: GENERIC OPTION SELECTION */}
        {/* ================================================= */}

        {/* 1. Generic Option Selection (formerly Colors) */}
        {hasOptions && (
          <View style={styles.section}>
            <Text style={styles.varLabel}>Select Option: <Text style={{fontWeight:'700', color: '#fff'}}>{selectedOption}</Text></Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight: 20}}>
              {uniqueOptions.map((opt) => {
                 const matchingImg = productImages.find(img => img.colorName && img.colorName.toLowerCase() === opt.toLowerCase());
                 const imgSource = matchingImg ? { uri: matchingImg.src } : null;

                 return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => handleOptionSelect(opt)}
                      style={[
                        styles.colorChip,
                        selectedOption === opt && styles.colorChipActive
                      ]}
                    >
                      {imgSource && <Image source={imgSource} style={styles.colorChipImg} />}
                      <Text style={[styles.colorChipText, selectedOption === opt && styles.colorChipTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                 );
              })}
            </ScrollView>
          </View>
        )}

        {/* 2. Sub-Selection (Sizes) Dependent on First Option */}
        {hasOptions && selectedOption && variationsByOption[selectedOption] ? (
           <View style={[styles.section, { paddingTop: 0 }]}>
              <Text style={styles.varLabel}>Select Variant: <Text style={{fontWeight:'700', color: '#fff'}}>{selectedSize}</Text></Text>
              <View style={styles.wrapRow}>
                 {variationsByOption[selectedOption].map((v: any) => {
                    const isOutOfStock = v.stock <= 0;
                    const isSelected = selectedSize === v.value; // ✅ EXACT MATCH ONLY
                    const isLowStock = v.stock > 0 && v.stock <= 5;

                    return (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => setSelectedSize(v.value)} // ✅ SINGLE SETTER
                        disabled={isOutOfStock}
                        style={[
                          styles.chip,
                          isSelected && styles.chipActive, // Only active if exact match
                          isOutOfStock && styles.chipDisabled,
                          isLowStock && !isSelected && styles.chipLowStock
                        ]}
                      >
                        <Text style={[
                           styles.chipText,
                           isSelected && styles.chipTextActive,
                           isOutOfStock && styles.chipTextDisabled,
                           isLowStock && !isSelected && styles.chipTextLowStock
                        ]}>
                           {v.value} {isLowStock ? `(${v.stock} left)` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                 })}
              </View>
           </View>
        ) : (!hasOptions && simpleVariations.length > 0) && (
           // Fallback for simple variations (no grouping, just sizes/weights)
           <View style={styles.section}>
              <Text style={styles.varLabel}>Select Option: <Text style={{fontWeight:'700', color: '#fff'}}>{selectedSize}</Text></Text>
              <View style={styles.wrapRow}>
                 {simpleVariations.map((v: any) => {
                    const isOutOfStock = v.stock <= 0;
                    const isSelected = selectedSize === v.value; // ✅ SINGLE MATCH
                    return (
                      <TouchableOpacity
                        key={v.id}
                        onPress={() => setSelectedSize(v.value)} // ✅ SINGLE SETTER
                        disabled={isOutOfStock}
                        style={[
                          styles.chip,
                          isSelected && styles.chipActive,
                          isOutOfStock && styles.chipDisabled
                        ]}
                      >
                        <Text style={[
                           styles.chipText,
                           isSelected && styles.chipTextActive,
                           isOutOfStock && styles.chipTextDisabled
                        ]}>
                           {v.value}
                        </Text>
                      </TouchableOpacity>
                    );
                 })}
              </View>
           </View>
        )}

        <View style={[styles.qtyAndCartRow, { paddingHorizontal: 20, marginTop: 12 }]}>
          <View style={styles.qtyContainerMoved}>
            <TouchableOpacity onPress={() => setQty(Math.max(1, qty - 1))} style={styles.qtyBtnMoved}><Text style={styles.qtySignMoved}>-</Text></TouchableOpacity>
            <Text style={styles.qtyNumMoved}>{qty}</Text>
            <TouchableOpacity onPress={() => setQty(qty + 1)} style={styles.qtyBtnMoved}><Text style={styles.qtySignMoved}>+</Text></TouchableOpacity>
          </View>
          <View style={styles.cartButtonsRow}>
            <TouchableOpacity 
                style={[
                    styles.addToCartBtnMoved, 
                    { marginLeft: 0 },
                    isOutOfStock && { opacity: 0.5, backgroundColor: '#555' }
                ]} 
                onPress={() => handleAddToCart(false)}
                disabled={isOutOfStock}
            >
                <Ionicons name="cart-outline" size={18} color={isOutOfStock ? '#aaa' : '#000'} />
                <Text style={[styles.addToCartTextMoved, isOutOfStock && { color: '#aaa' }]}>
                    {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
                style={[
                    styles.buyNowBtnInline,
                    isOutOfStock && { opacity: 0.5, backgroundColor: '#555' }
                ]} 
                onPress={handleBuyNow}
                disabled={isOutOfStock}
            >
                <Text style={[styles.buyNowBtnText, isOutOfStock && { color: '#aaa' }]}>Buy Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {product.description ? (<View style={styles.section}><Text style={styles.heading}>Description</Text><Text style={styles.bodyText}>{product.description}</Text></View>) : null}

        {renderNearbySection()}
        {renderRecoSection('Similar Products', similarProducts, 'same_category')}
        {renderRecoSection('Great Deals', discountProducts, 'discounts')}
        {renderRecoSection('You Might Like', exploreProducts, 'behavioral')}

        <View style={styles.section}>
          <View style={styles.reviewHeader}>
            <Text style={styles.heading}>Ratings & Reviews</Text>
            <TouchableOpacity onPress={() => { if (ensureLoggedIn('Login to rate this product.')) setReviewModalVisible(true); }} style={styles.writeReviewBtn}><Text style={styles.writeReviewText}>Rate Product</Text></TouchableOpacity>
          </View>
          {reviews.length === 0 ? (<Text style={styles.noReviewsText}>No reviews yet. Be the first to review!</Text>) : (
            reviews.map((rev: any, i: number) => (
              <View key={i} style={styles.reviewItem}>
                <View style={styles.reviewTop}>
                  <View style={styles.reviewStars}>{renderStars(rev.rating, 12)}</View>
                  <Text style={styles.reviewDate}>{rev.createdAt?.substring(0, 10)}</Text>
                </View>
                <Text style={styles.reviewUser}>{rev.name || 'User'}</Text>
                <Text style={styles.reviewComment}>{rev.comment}</Text>
                {rev.media && rev.media.length > 0 && (
                   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop: 8}}>
                      {rev.media.map((m: any, mIdx: number) => {
                          const url = buildReviewMediaUrl(m.file || m.image);
                          const isVideo = (m.file && m.file.endsWith('.mp4')) || (typeof m === 'string' && m.endsWith('.mp4'));
                          return (
                              <TouchableOpacity key={mIdx} onPress={() => openMediaViewer(rev.media, mIdx)}>
                                  {isVideo ? (
                                     <View style={styles.reviewThumbContainer}>
                                        <Video source={{uri: url}} style={styles.reviewThumb} resizeMode={ResizeMode.COVER} shouldPlay={false} />
                                        <View style={styles.playIconOverlay}><Ionicons name="play-circle" size={24} color="#fff" /></View>
                                     </View>
                                  ) : (
                                     <Image source={{uri: url}} style={[styles.reviewThumb, {marginRight: 8}]} />
                                  )}
                              </TouchableOpacity>
                          );
                      })}
                   </ScrollView>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Lightbox & Modals */}
      <Modal visible={lightboxVisible} transparent onRequestClose={() => setLightboxVisible(false)}>
        <View style={styles.lbContainer}>
          <TouchableOpacity style={styles.lbClose} onPress={() => setLightboxVisible(false)}><Ionicons name="close" size={30} color="#fff" /></TouchableOpacity>
          <FlatList ref={lightboxRef} data={productImages} keyExtractor={(item, index) => String(item.id ?? index)} horizontal pagingEnabled showsHorizontalScrollIndicator={false} renderItem={({ item }) => (<View style={styles.lbImageSlide}><Image source={{ uri: item.src }} style={styles.lbImg} resizeMode="contain" /></View>)} />
        </View>
      </Modal>

      <Modal visible={mediaViewerVisible} transparent onRequestClose={() => setMediaViewerVisible(false)}>
         <View style={styles.lbContainer}>
            <TouchableOpacity style={styles.lbClose} onPress={() => setMediaViewerVisible(false)}><Ionicons name="close" size={30} color="#fff" /></TouchableOpacity>
            <FlatList
               data={activeMediaList}
               keyExtractor={(_, i) => String(i)}
               horizontal
               pagingEnabled
               initialScrollIndex={activeMediaIndex}
               getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
               renderItem={({item}) => (
                   <View style={styles.lbImageSlide}>
                       {item.type === 'video' ? (
                           <Video source={{uri: item.url}} style={styles.lbImg} resizeMode={ResizeMode.CONTAIN} useNativeControls shouldPlay isLooping />
                       ) : (
                           <Image source={{uri: item.url}} style={styles.lbImg} resizeMode="contain" />
                       )}
                   </View>
               )}
            />
         </View>
      </Modal>

      <Modal visible={reviewModalVisible} transparent animationType="slide" onRequestClose={() => setReviewModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Write a Review</Text>
            <View style={styles.starInputRow}>{[1,2,3,4,5].map(i => <TouchableOpacity key={i} onPress={() => setUserRating(i)}><Ionicons name={i <= userRating ? 'star' : 'star-outline'} size={32} color="#FFC107" /></TouchableOpacity>)}</View>
            <TextInput style={styles.reviewInput} multiline placeholder="Share your experience..." placeholderTextColor="#9CA3AF" value={userComment} onChangeText={setUserComment} />
            <TouchableOpacity onPress={pickMedia} style={styles.addMediaBtn}>
                <Ionicons name="camera-outline" size={20} color="#D4AF37" />
                <Text style={styles.addMediaText}>Add Photos/Videos</Text>
            </TouchableOpacity>
            {reviewMedia.length > 0 && (
                <ScrollView horizontal style={styles.mediaPreviewScroll}>
                    {reviewMedia.map((asset, i) => (
                        <View key={i} style={{marginRight: 8}}>
                            <Image source={{uri: asset.uri}} style={styles.mediaPreviewThumb} />
                            <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setReviewMedia(prev => prev.filter((_, idx) => idx !== i))}>
                                <Ionicons name="close-circle" size={20} color="#ef4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)} style={styles.modalCancel}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={submitReview} style={styles.modalSubmit} disabled={submittingReview}>{submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSubmitText}>Submit</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617' },
  loadingContainer: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' },
  loadingLogoBox: { width: 60, height: 60, borderWidth: 2, borderColor: '#D4AF37', justifyContent: 'center', alignItems: 'center', marginBottom: 20, transform: [{ rotate: '45deg' }] },
  loadingLogoLetter: { fontSize: 32, fontWeight: '900', color: '#D4AF37', transform: [{ rotate: '-45deg' }], fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  loadingBrandText: { fontSize: 25, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', textTransform: 'uppercase' },
  loadingTagline: { color: '#D4AF37', textTransform: 'uppercase' },

  galleryContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  mainImageWrapper: { width: SCREEN_WIDTH - 40, height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F7F6F3', marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  mainImage: { width: '100%', height: '100%' },
  
  thumbnailScroll: { marginTop: 8, paddingHorizontal: 20 },
  thumbnailItem: { width: 60, height: 60, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: '#333', overflow: 'hidden' },
  thumbnailItemActive: { borderColor: '#F5F5F5', borderWidth: 2 },
  thumbnailImg: { width: '100%', height: '100%' },

  carouselDotsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 4 },
  carouselDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4b5563', marginHorizontal: 3 },
  carouselDotActive: { backgroundColor: '#e5e7eb' },
  infoSection: { paddingHorizontal: 20, paddingBottom: 10, paddingTop: 4 },
  brandNameText: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 2 },
  productName: { fontSize: 20, fontWeight: '600', color: '#f9fafb', marginBottom: 8, lineHeight: 26 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reviewCount: { fontSize: 12, color: '#9CA3AF', marginLeft: 6 },
  priceBlock: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  finalPrice: { fontSize: 22, fontWeight: '700', color: '#f9fafb', marginRight: 8 },
  strikePrice: { fontSize: 14, color: '#9CA3AF', textDecorationLine: 'line-through', marginRight: 6 },
  discountTag: { fontSize: 13, color: '#4ade80', fontWeight: '700' },
  stockBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, marginTop: 2 },
  stockText: { fontSize: 11, fontWeight: '600' },
  divider: { height: 8, backgroundColor: '#020617', marginVertical: 10 },
  section: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  heading: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#e5e7eb' },
  bodyText: { fontSize: 14, lineHeight: 22, color: '#d1d5db' },
  
  varLabel: { fontSize: 14, fontWeight: '500', marginBottom: 10, color: '#9CA3AF' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap' },
  
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#1f2937', marginRight: 8, marginBottom: 10, backgroundColor: '#020617', minWidth: 60, alignItems: 'center' },
  chipActive: { backgroundColor: '#fde68a', borderColor: '#fde68a' },
  chipDisabled: { backgroundColor: '#1f2937', borderColor: '#333', opacity: 0.5 },
  chipLowStock: { borderColor: '#d97706', borderWidth: 1 },
  
  chipText: { fontSize: 13, color: '#e5e7eb' },
  chipTextActive: { color: '#000', fontWeight: '700' },
  chipTextDisabled: { color: '#6b7280', textDecorationLine: 'line-through' },
  chipTextLowStock: { color: '#d97706', fontSize: 11 },

  colorChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#1f2937', marginRight: 10, marginBottom: 10, backgroundColor: '#020617' },
  colorChipActive: { borderColor: '#fde68a', backgroundColor: '#333' },
  colorChipImg: { width: 26, height: 26, borderRadius: 13, marginRight: 6, backgroundColor: '#0f172a' },
  colorChipText: { fontSize: 13, color: '#e5e7eb' },
  colorChipTextActive: { color: '#fde68a', fontWeight: '700' },
  
  qtyAndCartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyContainerMoved: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#020617', borderRadius: 20, height: 40, paddingHorizontal: 4, borderWidth: 1, borderColor: '#1f2937' },
  qtyBtnMoved: { width: 32, alignItems: 'center', justifyContent: 'center' },
  qtySignMoved: { fontSize: 18, fontWeight: '600', color: '#e5e7eb' },
  qtyNumMoved: { fontSize: 14, fontWeight: '600', marginHorizontal: 8, color: '#e5e7eb' },
  cartButtonsRow: { flex: 1, flexDirection: 'row', marginLeft: 12 },
  addToCartBtnMoved: { flex: 1, height: 42, backgroundColor: '#fde68a', borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  addToCartTextMoved: { color: '#111827', fontWeight: '700', fontSize: 14, marginLeft: 6 },
  buyNowBtnInline: { flex: 1, height: 42, backgroundColor: '#fb923c', borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  buyNowBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  writeReviewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#D4AF37' },
  writeReviewText: { color: '#D4AF37', fontWeight: '700', fontSize: 12 },
  noReviewsText: { color: '#9CA3AF', fontStyle: 'italic', marginTop: 4 },
  reviewItem: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reviewStars: { flexDirection: 'row' },
  reviewDate: { fontSize: 11, color: '#9CA3AF' },
  reviewUser: { fontSize: 13, fontWeight: '700', marginBottom: 4, color: '#e5e7eb' },
  reviewComment: { fontSize: 13, color: '#d1d5db', lineHeight: 18 },
  
  reviewThumbContainer: { position: 'relative', width: 60, height: 60, marginRight: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: '#000' },
  reviewThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333' },
  playIconOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  addMediaBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, padding: 8 },
  addMediaText: { color: '#D4AF37', marginLeft: 8, fontWeight: '600' },
  mediaPreviewScroll: { marginBottom: 16 },
  mediaPreviewThumb: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#333' },
  removeMediaBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: '#020617', borderRadius: 10 },

  recoContainer: { marginTop: 20, paddingBottom: 10 },
  recoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  recoTitle: { fontSize: 17, fontWeight: '800', color: '#f9fafb' },
  viewAllText: { fontSize: 12, fontWeight: '700', color: '#D4AF37' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  gridCard: { width: '50%', paddingHorizontal: 6, paddingTop: 6, paddingBottom: 10, marginBottom: 4, backgroundColor: 'transparent' },
  gridImgWrapper: { height: 150, width: '100%', marginBottom: 6, backgroundColor: '#F7F6F3', borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#1e293b' },
  gridImg: { width: '100%', height: '100%' },
  gridPlaceholder: { width: '100%', height: '100%', backgroundColor: '#fffff' },
  gridName: { fontSize: 13, fontWeight: '600', color: '#e5e7eb', marginBottom: 2, lineHeight: 17 },
  gridPrice: { fontSize: 14, fontWeight: '700', color: '#f9fafb', marginRight: 6 },
  gridDiscountText: { fontSize: 10, color: '#4ade80', fontWeight: '700' },
  lbContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  lbClose: { position: 'absolute', top: 50, right: 20, zIndex: 9 },
  lbImageSlide: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  lbImg: { width: SCREEN_WIDTH, height: '80%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,15,25,0.9)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#020617', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1f2937' },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center', color: '#e5e7eb' },
  starInputRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  reviewInput: { backgroundColor: '#020617', height: 100, borderRadius: 10, padding: 12, textAlignVertical: 'top', marginBottom: 20, borderWidth: 1, borderColor: '#1f2937', color: '#e5e7eb' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  modalCancel: { flex: 1, alignItems: 'center', padding: 12 },
  modalCancelText: { color: '#9CA3AF', fontWeight: '600' },
  modalSubmit: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#D4AF37', borderRadius: 8 },
  modalSubmitText: { color: '#020617', fontWeight: '700' },
  returnPolicyRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, marginHorizontal: 20 },
  returnPolicyPillGreen: { backgroundColor: '#03221a', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  returnPolicyPillRed: { backgroundColor: '#3b0f14', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  returnPolicyTextGreen: { fontSize: 12, color: '#86efac', fontWeight: '500' },
  returnPolicyTextRed: { fontSize: 12, color: '#fecaca', fontWeight: '500' },
  shopMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'space-between' },
  shopNameText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  deliveryBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeGreen: { backgroundColor: '#03221a', borderColor: '#14532d' },
  badgeRed: { backgroundColor: '#3b0f14', borderColor: '#7f1d1d' },
  badgeTextGreen: { fontSize: 11, fontWeight: '700', color: '#86efac' },
  badgeTextRed: { fontSize: 11, fontWeight: '700', color: '#fecaca' },
  // NEW STYLES
  loaderCenterWrapper: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  loaderLogoCircle: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#020617', // Match BG
    borderWidth: 2, 
    borderColor: '#D4AF37', 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  loaderLogoText: { fontSize: 28, fontWeight: '900', color: '#D4AF37', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  loaderRipple: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1, 
    borderColor: 'rgba(212, 175, 55, 0.5)', 
    zIndex: 1,
  },
  loaderTextWrapper: { alignItems: 'center', zIndex: 11 },
  loaderBrandText: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: 4, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', textTransform: 'uppercase' },
  loaderTagline: { color: '#B08D55', letterSpacing: 1, fontWeight: '500' },
});
