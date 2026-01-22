// src/screens/HomeScreen.js
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Dimensions,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../api/client';
import { useGlobalLocation } from '../context/LocationContext';
import AppHeader from '../components/AppHeader';
import { useNavBar } from '../context/NavBarContext';
import CurvedCarousel from '../components/CurvedCarousel';
import AnimatedBackground from '../components/AnimatedBackground';
import AsyncStorage from '@react-native-async-storage/async-storage';

import FuturisticVoiceModal from '../components/FuturisticVoiceModal';

const AnimatedVideo = Animated.createAnimatedComponent(Video);
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ---------- Helpers ----------
const gifOf = (v) => v?.gif_url || v?.gif || null;
const srcOf = (v) => v?.mp4_url || v?.video_url || v?.file || v?.video || null;
const posterOf = (v) => v?.poster || v?.poster_url || v?.thumbnail || v?.image || v?.image_url || null;
const hrefOf = (v) => v?.cta_url || v?.target_url || v?.url || v?.link_url || null;
const headlineText = (h) => h?.text || h?.headline || h?.title || '';
const headlineUrl = (h) => h?.url || h?.target_url || null;

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(typeof value === 'string' ? value.replace(/[^0-9.-]/g, '') : value);
  return Number.isFinite(n) ? n : 0;
};

// --- Haversine Formula ---
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
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

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

const safeNavigate = (router, url, userLocation) => {
  if (!url || typeof url !== 'string') return;
  const locParams = userLocation ? { lat: userLocation.lat, lon: userLocation.lon } : {};

  if (url.startsWith('http://') || url.startsWith('https://')) {
    Linking.openURL(url);
    return;
  }

  const clean = url.trim().replace(/\/+$/, '') || '/';

  const productMatch = clean.match(/\/product\/(\d+)(?:-[^/]*)?$/i);
  if (productMatch) {
    const id = String(productMatch[1]);
    router.push({ pathname: '/product/[id]', params: { id, ...locParams } });
    return;
  }

  if (clean === '/cart') { router.push('/(tabs)/cart'); return; }
  if (clean === '/wishlist' || clean === '/my-wishlist') { router.push('/(tabs)/wishlist'); return; }

  const catMatch = clean.match(/^\/(?:category|categories)\/([^/?#]+)/i);
  if (catMatch) {
    router.push({ pathname: '/category/[slug]', params: { slug: catMatch[1] } });
    return;
  }

  const shopMatch = clean.match(/^\/shops?\/([^/?#]+)/i);
  if (shopMatch) {
    router.push({ pathname: '/shop/[slug]', params: { slug: shopMatch[1] } });
    return;
  }

  router.push({
    pathname: '/category',
    params: { from: 'home', url: encodeURIComponent(clean) },
  });
};

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
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
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

    Animated.parallel([
      createRipple(ripple1, 0),
      createRipple(ripple2, 600),
      createRipple(ripple3, 1200),
    ]).start();

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

  const renderRipple = (anim, color) => {
    const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 4] });
    const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] });
    return (
      <Animated.View style={[styles.loaderRipple, { borderColor: color, transform: [{ scale }], opacity }]} />
    );
  };

  return (
    <View style={styles.loadingContainer}>
      <View style={styles.loaderCenterWrapper}>
        {renderRipple(ripple1, '#D4AF37')}
        {renderRipple(ripple2, '#00F0FF')}
        {renderRipple(ripple3, '#FF007F')}
        <Animated.View style={[styles.loaderLogoCircle, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient colors={['#D4AF37', '#B8860B']} style={styles.loaderGradient}>
             <Text style={styles.loaderLogoText}>KC</Text>
          </LinearGradient>
        </Animated.View>
      </View>

      <View style={styles.loaderTextWrapper}>
        <Text style={styles.loaderBrandText}>KupwaraCart</Text>
        <Animated.Text style={[styles.loaderTagline, { opacity: taglineFade, fontSize: currentTagline.isUrdu ? 20 : 13, marginTop: currentTagline.isUrdu ? 4 : 8 }]}>
          {currentTagline.text}
        </Animated.Text>
      </View>
      
      <View style={{ position: 'absolute', bottom: 50 }}>
        <ActivityIndicator size="small" color="#00F0FF" />
      </View>
    </View>
  );
};

// ---------- Product Card Component (TRANSPARENT - NO CARD) ----------
const ProductCard = ({ item, router, userLocation, styleType = 'grid' }) => {
  const img = item?.images?.[0]?.image || item.image || null;
  const price = toNumber(item.price) ?? toNumber(item.mrp) ?? 0;
  const mrp = toNumber(item.mrp);
  const showDiscount = mrp > price;
  const discount = showDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;

  const isGrid3 = styleType === 'grid3';
  
  // Use transparent styles, remove 'glassCard'
  const containerStyle = isGrid3 ? styles.grid3Card : styles.gridCard;
  
  let distanceKm = item?.shop?.distance_km ?? item?.distance_km ?? null;
  let isDeliverable = false;
  let badgeLabel = null;

  if (distanceKm === null && userLocation && item.shop?.latitude && item.shop?.longitude) {
    distanceKm = getDistanceFromLatLonInKm(
      userLocation.lat,
      userLocation.lon,
      parseFloat(item.shop.latitude),
      parseFloat(item.shop.longitude)
    );
  }

  if (distanceKm !== null && distanceKm !== undefined) {
    const distVal = Number(distanceKm);
    const radius = item.shop?.delivery_radius || 15;
    
    if (distVal <= radius) {
      isDeliverable = true;
      badgeLabel = "Deliverable";
    } else {
      isDeliverable = false;
      badgeLabel = "No Delivery";
    }
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      activeOpacity={0.7}
      onPress={() =>
        router.push({
          pathname: '/product/[id]',
          params: { 
            id: String(item.id),
            lat: userLocation?.lat, 
            lon: userLocation?.lon 
          },
        })
      }
    >
      {/* NO BACKGROUND - JUST CONTENT */}
      <View style={styles.transparentCardContent}>
        <View style={isGrid3 ? styles.grid3ImgWrapper : styles.gridImgWrapper}>
          {img ? (
            <View style={{ flex: 1, backgroundColor: '#fff', padding: 6 }}>
              <Image
                source={{ uri: img }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"   // ✅ best for cosmetic products
                transition={300}
              />
            </View>
          ) : (
            <View style={styles.imgPlaceholder} />
          )}

          {showDiscount && discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>{discount}%</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          {/* Deliverable Badge */}
          {badgeLabel && (
             <View style={[styles.deliveryBadgeRow, { marginBottom: 2 }]}>
               <Ionicons 
                 name={badgeLabel === "Deliverable" ? "checkmark-circle" : "close-circle"} 
                 size={10} 
                 color={badgeLabel === "Deliverable" ? "#4ADE80" : "#F87171"} 
               />
               <Text style={[styles.badgeText, { color: badgeLabel === "Deliverable" ? "#4ADE80" : "#F87171", fontSize: 9 }]}>
                 {badgeLabel}
               </Text>
             </View>
          )}

          <Text numberOfLines={isGrid3 ? 1 : 2} style={[styles.productName, isGrid3 && { fontSize: 11, lineHeight: 14 }]}>
            {item.name}
          </Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={[styles.productPrice, isGrid3 && { fontSize: 13 }]}>₹{price.toFixed(0)}</Text>
                  {showDiscount && (
                    <Text style={[styles.productMrp, isGrid3 && { fontSize: 9 }]}>₹{mrp.toFixed(0)}</Text>
                  )}
              </View>
              {distanceKm !== null && (
                   <Text style={[styles.distanceText, isGrid3 && { fontSize: 9 }]}>
                      {Number(distanceKm).toFixed(1)} km
                   </Text>
              )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ---------- Todays Special Carousel (SMALLER) ----------
const TodaysSpecialCarousel = ({ items = [], router, onViewAll, userLocation }) => {
  if (!items || !items.length) return null;

  return (
    <View style={[styles.sectionContainer, { marginTop: 12 }]}>
      <SectionHeader title="Today's Special" onViewAll={onViewAll} icon="star" iconColor="#FFD700" />
    
      <View
        style={{
          marginTop: 6,
          marginBottom: 28,
          height: 150,
          overflow: 'hidden',
        }}
      >
        <CurvedCarousel
          data={items}
          cardWidth={120}
          itemSpacing={12}
          autoPlay
          autoPlayInterval={4500}
          renderItem={(item) => {
            const img = item?.images?.[0]?.image || item.image || null;
            const price = toNumber(item.price) ?? toNumber(item.mrp) ?? 0;
            const mrp = toNumber(item.mrp);
            
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.specialCard} // Adjusted style below
                onPress={() =>
                  router.push({
                    pathname: '/product/[id]',
                    params: { 
                      id: String(item.id),
                      lat: userLocation?.lat, 
                      lon: userLocation?.lon 
                    },
                  })
                }
              >
                <View style={styles.specialImgWrapper}>
                  <Image
                    source={{ uri: img }}
                    style={styles.specialImg}
                    contentFit="contain"   // 🔑 important
                    transition={500}
                  />
                </View>
                
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.specialOverlay}>
                  <Text numberOfLines={1} style={styles.specialTitle}>{item.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'nowrap' }}>
                    <Text style={styles.specialPrice}>₹{price.toFixed(0)}</Text>
                    {mrp > price && <Text style={styles.specialMrp}>₹{mrp.toFixed(0)}</Text>}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
};

// ---------- Most Loved Grid (WITH BACKGROUND) ----------
const MostLovedGrid = ({ items = [], router, userLocation }) => {
  const list = (items || []).slice(0, 8);
  if (!list.length) return null;

  return (
    <View style={styles.sectionContainer}>
      <SectionHeader title="Most Loved" subTitle="BESTSELLERS" icon="heart" iconColor="#FF007F" />
      
      {/* ✅ ADDED BACKGROUND CONTAINER */}
      <LinearGradient 
        colors={['#1B1A17', '#141311']}
        start={{x:0, y:0}} end={{x:1, y:1}}
        style={styles.mostLovedBackground}
      >
        <View style={styles.mostLovedGridContainer}>
          {list.map((p, index) => {
            const img = p?.images?.[0]?.image || p?.image || null;
            const price = toNumber(p.price) ?? 0;
            
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.7}
                style={styles.mostLovedItem}
                onPress={() => router.push({
                    pathname: '/product/[id]',
                    params: { 
                      id: String(p.id),
                      lat: userLocation?.lat, 
                      lon: userLocation?.lon 
                    },
                })}
              >
                <View style={styles.mostLovedImgBorder}>
                  <View style={styles.mostLovedImgInner}>
                    <Image
                      source={{ uri: img }}
                      style={styles.mostLovedThumb}
                      contentFit="contain"
                    />
                  </View>
                </View>
                <Text style={styles.mostLovedPriceTiny}>₹{price.toFixed(0)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
};

// ---------- Section Grid ----------
const SectionGrid = ({ title, items, onViewAll, router, userLocation, icon, iconColor }) => {
  if (!items || !items.length) return null;
  return (
    <View style={styles.sectionContainer}>
      <SectionHeader title={title} onViewAll={onViewAll} icon={icon} iconColor={iconColor} />
      <View style={styles.gridContainer}>
        {items.map((item, index) => (
          <ProductCard key={`${item.id || 'prod'}-${index}`} item={item} router={router} userLocation={userLocation} styleType="grid3" />
        ))}
      </View>
    </View>
  );
};

// ---------- Section Header ----------
const SectionHeader = ({ title, subTitle, onViewAll, icon, iconColor }) => (
  <View style={styles.sectionHeader}>
    <View style={{flexDirection: 'row', alignItems: 'center'}}>
        {icon && <Ionicons name={icon} size={18} color={iconColor || "#fff"} style={{marginRight: 8}} />}
        <View>
            <Text style={styles.sectionTitle}>{title}</Text>
            {subTitle && <Text style={styles.sectionSubtitle}>{subTitle}</Text>}
        </View>
    </View>
    {onViewAll && (
      <TouchableOpacity onPress={onViewAll} style={styles.viewAllBtn}>
        <Text style={styles.viewAllText}>VIEW ALL</Text>
        <Ionicons name="arrow-forward" size={12} color="#000" />
      </TouchableOpacity>
    )}
  </View>
);

// ---------- Headlines (SINGLE LINE) ----------
const HeadlinesMarquee = ({ items = [], router, userLocation }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const cleaned = (items || []).map((h, i) => ({ key: h.id || i, text: headlineText(h), url: headlineUrl(h) })).filter((x) => x.text && x.text.trim().length);

  useEffect(() => {
    if (!cleaned.length) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 30000, easing: Easing.linear, useNativeDriver: true }).start(() => { if (!cancelled) run(); });
    };
    run();
    return () => { cancelled = true; if (anim.stopAnimation) anim.stopAnimation(); };
  }, [anim, cleaned.length]);

  if (!cleaned.length) return null;
  const loop = [...cleaned, ...cleaned];
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -500] });

  return (
    <LinearGradient colors={['#240b36', '#c31432']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.marqueeContainer}>
      <View style={styles.marqueeBadge}><Text style={styles.marqueeBadgeText}>LIVE</Text></View>
      <View style={{ flex: 1, overflow: 'hidden', justifyContent: 'center' }}>
        <Animated.View style={{ flexDirection: 'row', transform: [{ translateX }] }}>
          {loop.map((h, i) => (
            <TouchableOpacity key={`${h.key}-${i}`} onPress={() => safeNavigate(router, h.url, userLocation)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 24 }}>
              {/* ✅ FORCE SINGLE LINE */}
              <Text style={styles.marqueeText} numberOfLines={1} ellipsizeMode='tail'>{h.text}</Text>
              <Ionicons name="flash" size={10} color="#FFD700" style={{marginLeft: 8}} />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>
    </LinearGradient>
  );
};

// ---------- Inline Banner ----------
const InlineBanner = ({ banner, router, userLocation }) => {
  if (!banner) return null;
  const video = srcOf(banner);
  const img = banner.image || posterOf(banner);
  const title = banner.title || banner.name || 'Offer';
  const subtitle = banner.subtitle || banner.text || banner.caption || '';
  const url = hrefOf(banner);

  return (
    <TouchableOpacity activeOpacity={0.9} style={styles.inlineBannerCard} onPress={() => url && safeNavigate(router, url, userLocation)}>
      {video ? (
        <Video source={{ uri: video }} posterSource={img ? { uri: img } : undefined} usePoster={!!img} style={styles.inlineBannerMedia} resizeMode="cover" isLooping shouldPlay isMuted />
      ) : img ? (
        <Image 
          source={{ uri: img }} 
          style={styles.inlineBannerMedia} 
          contentFit="cover" 
          transition={500}
        />
      ) : null}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.inlineBannerOverlay}>
        <Text style={styles.inlineBannerTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.inlineBannerSub} numberOfLines={2}>{subtitle}</Text> : null}
        {url ? <View style={styles.shopNowBtn}><Text style={styles.shopNowText}>Shop Now</Text></View> : null}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const HeroCarousel = ({ items = [], router, userLocation }) => {
  const list = items.filter((it) => srcOf(it) || gifOf(it) || posterOf(it));
  if (!list.length) return null;

  const openTarget = (hero) => {
    const t = hero.target_type;
    if (t === 'category' && hero.target_id) {
      router.push({ pathname: '/category/[slug]', params: { slug: String(hero.target_id) } });
    } else if (t === 'shop' && hero.target_id) {
      router.push({ pathname: '/shop/[slug]', params: { slug: hero.target_id } });
    } else if (t === 'products' && hero.products_data?.length) {
      router.push({ pathname: '/listing', params: { type: 'ad_products', title: hero.title || 'Featured Products', products: JSON.stringify(hero.products_data), lat: userLocation?.lat, lon: userLocation?.lon } });
    } else {
      const url = hrefOf(hero);
      if (url) safeNavigate(router, url, userLocation);
    }
  };

  return (
    <View style={{ marginBottom: 12, marginTop: 4 }}>
      <CurvedCarousel 
        data={list} 
        cardWidth={SCREEN_WIDTH * 0.94} 
        autoPlay 
        autoPlayInterval={4000} 
        renderItem={(hero) => {
          const gif = gifOf(hero);
          const video = srcOf(hero);
          const poster = posterOf(hero);

          return (
            <TouchableOpacity activeOpacity={0.9} style={styles.heroContainer} onPress={() => openTarget(hero)}>
              {gif ? (
                <Image source={{ uri: gif }} style={styles.heroMedia} contentFit="cover" transition={500} />
              ) : video ? (
                <Video source={{ uri: video }} posterSource={poster ? { uri: poster } : undefined} usePoster={!!poster} style={styles.heroMedia} resizeMode="cover" isLooping shouldPlay={false} isMuted />
              ) : poster ? (
                <Image source={{ uri: poster }} style={styles.heroMedia} contentFit="cover" transition={500} />
              ) : null}
              <LinearGradient colors={['rgba(255,255,255,0.1)', 'transparent']} style={StyleSheet.absoluteFill} />
            </TouchableOpacity>
          );
        }} 
      />
    </View>
  );
};

// ---------- Video Category Tile (IMPROVED LOOK) ----------
const VideoCatTile = ({ banner, index, onPress }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(anim, { toValue: 1, duration: 400, delay: index * 100, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start(); }, [anim, index]);
  
  const gif = gifOf(banner);
  const video = srcOf(banner);
  const poster = posterOf(banner);

  return (
    <Animated.View style={[styles.videoCatTileWrapper, { opacity: anim, transform: [{ scale: anim }] }]}>
      <TouchableOpacity activeOpacity={0.8} style={styles.videoCatTile} onPress={onPress}>
        {gif ? (
           <Image source={{ uri: gif }} style={styles.videoCatMedia} contentFit="cover" transition={500} />
        ) : video ? (
           <Video source={{ uri: video }} posterSource={poster ? { uri: poster } : undefined} usePoster={!!poster} style={styles.videoCatMedia} resizeMode="cover" isLooping shouldPlay isMuted />
        ) : poster ? (
           <Image source={{ uri: poster }} style={styles.videoCatMedia} contentFit="cover" transition={500} />
        ) : null}
        {/* Border Overlay */}
        <View style={styles.videoCatBorderOverlay} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const VideoCategoryGrid = ({ items = [], router, userLocation }) => {
  if (!items.length) return null;
  const openTarget = (banner) => {
    const t = banner.target_type;
    const loc = userLocation ? { lat: userLocation.lat, lon: userLocation.lon } : {};
    if (t === 'category' && banner.target_id) router.push({ pathname: '/category/[slug]', params: { slug: String(banner.target_id) } });
    else if (t === 'shop' && banner.target_id) router.push({ pathname: '/shop/[slug]', params: { slug: String(banner.target_id) } });
    else if (t === 'products' && banner.products_data?.length) router.push({ pathname: '/listing', params: { type: 'ad_products', title: banner.title || 'Featured Products', products: JSON.stringify(banner.products_data), ...loc } });
    else { const url = hrefOf(banner); if (url) safeNavigate(router, url, userLocation); }
  };
  return <View style={styles.videoCatSection}><View style={styles.videoCatGrid}>{items.map((b, idx) => <VideoCatTile key={b.id || idx} banner={b} index={idx} onPress={() => openTarget(b)} />)}</View></View>;
};

const CollectionsRow = ({ items, router, userLocation }) => {
  if (!items || !items.length) return null;
  return (
    <View style={styles.collectionSection}>
      <Text style={[styles.sectionTitle, { paddingHorizontal: 16, marginBottom: 12 }]}>Collections</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionScroll}>
        {items.map((c, i) => {
          const img = c.image || c.poster || c.poster_url || c.image_url || null;
          const label = c.name || c.title || c.tag || 'Collection';
          const link = hrefOf(c);
          return (
            <TouchableOpacity key={c.id || i} style={styles.collectionCircleWrap} onPress={() => link && safeNavigate(router, link, userLocation)}>
              <View style={styles.collectionCircle}>
                <Image source={{ uri: img }} style={styles.collectionImg} contentFit="cover" transition={500} />
              </View>
              <Text style={styles.collectionText} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ---------- PREMIUM FOOTER COMPONENT ----------
const FooterGreetings = () => {
    // Helper to open links
    const openLink = (url) => {
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    return (
        <View style={styles.footerContainer}>
            
            {/* 1. Brand & Logo */}
            <LinearGradient 
                colors={['#D4AF37', '#F7E98E', '#D4AF37']} 
                style={styles.footerLogoCircle}
            >
                 <Text style={styles.footerLogoText}>KC</Text>
            </LinearGradient>
            
            <Text style={styles.footerBrand}>KupwaraCart</Text>
            <Text style={styles.footerTagline}>Premium Shopping. Local Heart.</Text>

            {/* 2. Social Media Row */}
            <View style={styles.footerSocialRow}>
                <TouchableOpacity onPress={() => openLink('https://instagram.com')} style={styles.socialBtn}>
                    <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openLink('https://whatsapp.com')} style={styles.socialBtn}>
                    <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openLink('https://telegram.org')} style={styles.socialBtn}>
                    <Ionicons name="navigate-circle" size={20} color="#0088cc" />
                </TouchableOpacity>
            </View>

            {/* 3. Quick Links Grid */}
            <View style={styles.footerLinksContainer}>
                <TouchableOpacity style={styles.footerLinkItem}>
                    <Text style={styles.footerLinkText}>About Us</Text>
                </TouchableOpacity>
                <View style={styles.footerDivider} />
                <TouchableOpacity style={styles.footerLinkItem}>
                    <Text style={styles.footerLinkText}>Privacy Policy</Text>
                </TouchableOpacity>
                <View style={styles.footerDivider} />
                <TouchableOpacity style={styles.footerLinkItem}>
                    <Text style={styles.footerLinkText}>Help Center</Text>
                </TouchableOpacity>
            </View>

            {/* 4. Trust Badges (Text based for performance) */}
            <View style={styles.trustRow}>
                <View style={styles.trustItem}>
                    <Ionicons name="shield-checkmark-outline" size={14} color="#D4AF37" />
                    <Text style={styles.trustText}>100% Authentic</Text>
                </View>
                <View style={styles.trustItem}>
                    <Ionicons name="lock-closed-outline" size={14} color="#D4AF37" />
                    <Text style={styles.trustText}>Secure Pay</Text>
                </View>
            </View>

            {/* 5. Copyright & Love */}
            <View style={styles.copyrightSection}>
                <Text style={styles.footerSmall}>© 2025 KupwaraCart. All rights reserved.</Text>
                <Text style={styles.madeWithLove}>
                    Made with <Ionicons name="heart" size={10} color="red" /> in Kashmir
                </Text>
            </View>

        </View>
    );
};

// ---------- Main Screen ----------
const FEED_INITIAL = 10;
const FEED_MAX = 60;
const FEED_BANNER_INTERVAL = 18;

export default function HomeScreen() {
  const router = useRouter();
  const [homeData, setHomeData] = useState(null);
  const { handleScroll: handleNavScroll } = useNavBar();
  const [voiceVisible, setVoiceVisible] = useState(false);

  const [recoData, setRecoData] = useState([]);
  const [feedVisibleCount, setFeedVisibleCount] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [nearbyProducts, setNearbyProducts] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const nearbyCoordsRef = useRef(null);

  const { location: userLocation, error: locError, permissionStatus, refreshLocation } = useGlobalLocation();
  const locationDenied = permissionStatus === 'denied';

  useEffect(() => {
    if (locError) setNearbyError('Location access failed.');
    else if (userLocation) setNearbyError('');
  }, [locError, userLocation]);

    // 1. IMPROVED FETCH FUNCTION (Cache First)
    const fetchHome = useCallback(async (isRefresh = false) => {
        try {
          if (isRefresh && !homeData) setLoading(true);
          setError('');
    
          const networkPromise = api.get(`/home/`).then(async (res) => {
            setHomeData(res.data);
            await AsyncStorage.setItem('home_data_cache', JSON.stringify(res.data));
            setLoading(false);
            setRefreshing(false);
          });
    
          if (isRefresh) await networkPromise;
    
        } catch (err) {
          console.log('Fetch error:', err);
          if (!homeData) setError('Network Error. Pull to retry.');
          setLoading(false);
          setRefreshing(false);
        }
      }, [homeData]);
    
      // 2. LOAD CACHE ON MOUNT
      useEffect(() => {
        const loadCache = async () => {
          try {
            const cached = await AsyncStorage.getItem('home_data_cache');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (!homeData) {
                setHomeData(parsed);
                setLoading(false);
              }
            }
          } catch (e) {
            console.log('Cache load error', e);
          }
        };
        loadCache();
        fetchHome(false); 
      }, []);

    useFocusEffect(useCallback(() => {
      if (!recoData || !recoData.length) fetchReco();
    }, [fetchReco, recoData]));
  
    const onRefresh = () => {
      setRefreshing(true);
      fetchHome(true); 
      refreshLocation(); 
    };

  const fetchNearbyProducts = useCallback(async (lat, lon) => {
    try {
      setNearbyError('');
      setNearbyLoading(true);
      const { data } = await api.get('/api/recommendations/nearby-products/', {
        params: { lat, lon, limit: 12, _t: Date.now() }, 
        timeout: 15000,
      });
      const list = Array.isArray(data) ? data : data?.results || data?.products || [];
      setNearbyProducts(list || []);
    } catch (err) {
      setNearbyProducts([]);
      setNearbyError('Network Error. Tap retry to try again.');
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  const fetchReco = useCallback(async () => {
    try {
      const params = {
        context: 'home',
        type: 'behavioral',
        limit: FEED_MAX,
        _t: Date.now(),
      };
      if (nearbyCoordsRef.current) {
        params.lat = nearbyCoordsRef.current.lat;
        params.lon = nearbyCoordsRef.current.lon;
      }

      const { data } = await api.get('/api/recommendations/', { params });
      const list = Array.isArray(data) ? data : data.results || data.products || [];
      const finalList = list || [];
      setRecoData(finalList);
      const initial = Math.min(FEED_INITIAL, finalList.length);
      setFeedVisibleCount(initial);
      setFeedHasMore(finalList.length > initial);
    } catch (e) {
      console.log('Reco fetch error', e);
    }
  }, []);

  useEffect(() => {
    if (userLocation) {
        nearbyCoordsRef.current = userLocation;
        fetchNearbyProducts(userLocation.lat, userLocation.lon);
        fetchReco();
    }
  }, [userLocation, fetchNearbyProducts, fetchReco]);

  const ensureLocationAndNearby = useCallback(() => {
      refreshLocation(); 
      if (userLocation) {
        fetchNearbyProducts(userLocation.lat, userLocation.lon);
        fetchReco();
      }
  }, [refreshLocation, userLocation, fetchNearbyProducts, fetchReco]);

  useFocusEffect(useCallback(() => {
    if (!homeData) fetchHome();
    if (!recoData || !recoData.length) fetchReco();
  }, [fetchHome, fetchReco, homeData, recoData]));

  const handleScroll = (event) => {
    handleNavScroll(event);
    if (!feedHasMore || feedLoadingMore || !recoData.length) return;
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (contentSize.height - (layoutMeasurement.height + contentOffset.y) < 300) {
      setFeedLoadingMore(true);
      setFeedVisibleCount((prev) => Math.min(prev + 8, recoData.length || prev));
    }
  };

  const videoAds = homeData?.video_ads || [];
  const heroAds = videoAds.filter(ad => !ad.position || ad.position === 'hero');
  const midAds = videoAds.filter(ad => ad.position === 'mid');
  const footerAds = videoAds.filter(ad => ad.position === 'footer');

  const headlines = homeData?.headlines || [];
  const todaysSpecial = homeData?.todays_special || [];
  const hotDeals = homeData?.hot_deals || [];
  const newArrivals = homeData?.new_arrivals || [];
  const mostLoved = homeData?.most_loved_products || [];
  const videoCategoryBanners = homeData?.video_category_banners || [];
  const collections = homeData?.banners || [];

  const inlineBanners = useMemo(() => (collections || []).filter((b) => srcOf(b) || posterOf(b) || b.image || b.image_url || b.banner), [collections]);

  // --- LOGIC: Split Recommendations into 3 Smart Sections ---
  // 1. Top 9 for the clean 3x3 Grid
  const recoGrid = useMemo(() => recoData.slice(0, 9), [recoData]);

  // 2. Next 3 for the "Hero Layout" (1 Big Left, 2 Small Right)
  const recoHero = useMemo(() => recoData.slice(9, 12), [recoData]);

  // 3. The Rest for "Hidden Gems" Horizontal Scroll
  const recoScroll = useMemo(() => recoData.slice(12, 20), [recoData]); 

  if (loading && !homeData) return <ElegantLoadingScreen />;

  return (
    <View style={styles.safeArea}>
      <AnimatedBackground />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <AppHeader onMicPress={() => setVoiceVisible(true)} />
      <FuturisticVoiceModal visible={voiceVisible} onClose={() => setVoiceVisible(false)} />

      {!loading && !error && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />} onScroll={handleScroll} scrollEventThrottle={16}>
          
          <HeadlinesMarquee items={headlines} router={router} userLocation={userLocation} />
          {heroAds.length > 0 && <HeroCarousel items={heroAds} router={router} userLocation={userLocation} />}
          {collections.length > 0 && <CollectionsRow items={collections} router={router} userLocation={userLocation} />}
          <VideoCategoryGrid items={videoCategoryBanners} router={router} userLocation={userLocation} />

          {mostLoved.length > 0 && (
             <MostLovedGrid items={mostLoved} router={router} userLocation={userLocation} />
          )}

          <TodaysSpecialCarousel
            items={todaysSpecial}
            router={router}
            userLocation={userLocation}
            onViewAll={() => router.push({ pathname: '/listing', params: { type: 'section', key: 'todays_special', title: "Today's Special", lat: userLocation?.lat, lon: userLocation?.lon } })}
          />

          {nearbyLoading && !nearbyProducts.length && !locationDenied && (
            <View style={styles.nearbyCard}>
              <ActivityIndicator size="small" color="#00F0FF" />
              <Text style={styles.nearbyHintText}>Locating nearby treasures...</Text>
            </View>
          )}
          {!nearbyLoading && nearbyError && !locationDenied && !nearbyProducts.length && (
            <View style={styles.nearbyCard}>
              <Text style={styles.nearbyErrorText}>{nearbyError}</Text>
              <TouchableOpacity style={styles.nearbyRetryBtn} onPress={() => ensureLocationAndNearby()}>
                <Text style={styles.nearbyRetryText}>RETRY</Text>
              </TouchableOpacity>
            </View>
          )}
          {nearbyProducts && nearbyProducts.length > 0 && (
            <SectionGrid
              title="Nearby Products"
              items={nearbyProducts.slice(0, 9)} 
              router={router}
              userLocation={userLocation}
              icon="navigate-circle"
              iconColor="#00F0FF"
              onViewAll={() => router.push({ pathname: '/listing', params: { type: 'nearby', title: 'Shop Products Near You', lat: String(userLocation?.lat), lon: String(userLocation?.lon) } })}
            />
          )}

          {midAds.length > 0 && (
            <View style={{ marginTop: 24 }}>
               <View style={[styles.sectionHeader, {paddingHorizontal: 16}]}>
                 <Text style={styles.sectionTitle}>Featured Brands</Text>
               </View>
               <HeroCarousel items={midAds} router={router} userLocation={userLocation} />
            </View>
          )}

          <SectionGrid
            title="Hot Deals"
            items={hotDeals.slice(0, 9)} 
            router={router}
            userLocation={userLocation}
            icon="flame"
            iconColor="#FF4D4D"
            onViewAll={() => router.push({ pathname: '/listing', params: { type: 'section', key: 'hot_deals', title: 'Hot Deals', lat: userLocation?.lat, lon: userLocation?.lon } })}
          />

          <SectionGrid
            title="New Arrivals"
            items={newArrivals.slice(0, 9)} 
            router={router}
            userLocation={userLocation}
            icon="sparkles"
            iconColor="#D4AF37"
            onViewAll={() => router.push({ pathname: '/listing', params: { type: 'section', key: 'new_arrivals', title: 'New Arrivals', lat: userLocation?.lat, lon: userLocation?.lon } })}
          />

           {footerAds.length > 0 && (
             <View style={{ marginTop: 10 }}>
                <HeroCarousel items={footerAds} router={router} userLocation={userLocation} />
             </View>
          )}

          {/* SECTION 1: QUICK PICKS (3x3 Grid) */}
          {recoGrid.length > 0 && (
            <SectionGrid
              title="Recommended For You"
              items={recoGrid}
              router={router}
              userLocation={userLocation}
              icon="thumbs-up"
              iconColor="#8A2BE2"
            />
          )}

          {/* SECTION 2: TRENDING HERO (Unique Layout) */}
          {recoHero.length === 3 && (
            <View style={styles.sectionContainer}>
              <SectionHeader title="Trending Now" icon="flash" iconColor="#FF007F" />
              <View style={styles.heroLayoutContainer}>
                
                {/* BIG LEFT CARD */}
                <TouchableOpacity 
                  activeOpacity={0.9}
                  style={styles.heroBigCard}
                  onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(recoHero[0].id) } })}
                >
                  <Image source={{ uri: recoHero[0].image }} style={styles.heroBigImg} contentFit="cover" transition={500} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.heroOverlay}>
                    <Text style={styles.heroBigTitle} numberOfLines={1}>{recoHero[0].name}</Text>
                    <Text style={styles.heroBigPrice}>₹{toNumber(recoHero[0].price).toFixed(0)}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* TWO SMALL RIGHT CARDS */}
                <View style={styles.heroRightColumn}>
                  {recoHero.slice(1).map((item, i) => (
                    <TouchableOpacity 
                      key={i}
                      activeOpacity={0.9}
                      style={styles.heroSmallCard}
                      onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(item.id) } })}
                    >
                      <Image source={{ uri: item.image }} style={styles.heroSmallImg} contentFit="cover" transition={500} />
                      <View style={styles.heroSmallInfo}>
                         <Text style={styles.heroSmallTitle} numberOfLines={1}>{item.name}</Text>
                         <Text style={styles.heroSmallPrice}>₹{toNumber(item.price).toFixed(0)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* SECTION 3: HIDDEN GEMS (Horizontal Glass Scroll) */}
          {recoScroll.length > 0 && (
            <View style={styles.sectionContainer}>
              <SectionHeader title="Hidden Gems" subTitle="EXPLORE MORE" icon="diamond" iconColor="#00F0FF" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
                {recoScroll.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.8}
                    style={styles.gemCard}
                    onPress={() => router.push({ pathname: '/product/[id]', params: { id: String(item.id) } })}
                  >
                    <View style={styles.gemImgWrapper}>
                        <Image source={{ uri: item.image }} style={styles.gemImg} contentFit="cover" />
                    </View>
                    <Text style={styles.gemTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.gemPrice}>₹{toNumber(item.price).toFixed(0)}</Text>
                  </TouchableOpacity>
                ))}
                {/* 'See All' Card at the end */}
                <TouchableOpacity style={styles.seeAllCard} onPress={() => router.push('/listing')}>
                    <Ionicons name="arrow-forward-circle" size={32} color="#D4AF37" />
                    <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          <FooterGreetings />
          
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
      {error ? <View style={styles.centerFill}><Text style={{ color: '#FF4D4D' }}>{error}</Text></View> : null}
    </View>
  );
}

// ================= STYLES =================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#020617' },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617' },
  scrollContent: { paddingBottom: 20 },

  // --- MARQUEE ---
  marqueeContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, marginBottom: 10 },
  marqueeBadge: { backgroundColor: '#000', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2, marginRight: 12, borderWidth:1, borderColor:'#FFD700' },
  marqueeBadgeText: { color: '#FFD700', fontSize: 9, fontWeight: '900' },
  // ✅ Single line forced
  marqueeText: { fontSize: 13, color: '#fff', fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2, flexShrink: 1 },

  // --- HERO & ADS ---
  heroContainer: { height: 190, marginHorizontal: 12, marginTop: 8, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  heroMedia: { width: '100%', height: '100%' },

  // --- CATEGORY TILES (Enhanced) ---
  videoCatSection: { paddingHorizontal: 12, marginTop: 24 },
  videoCatGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  videoCatTileWrapper: { width: '48%', marginBottom: 16 },
  videoCatTile: { height: 120, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#00F0FF', backgroundColor:'#000' }, // Neon Border
  videoCatMedia: { width: '100%', height: '100%' },
  videoCatBorderOverlay: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16 },

  // --- COLLECTIONS ---
  collectionSection: { marginTop: 24 },
  collectionScroll: { paddingHorizontal: 16 },
  collectionCircleWrap: { alignItems: 'center', marginRight: 20, width: 72 },
  collectionCircle: { width: 68, height: 68, borderRadius: 34, overflow: 'hidden', marginBottom: 8, borderWidth: 1.5, borderColor: '#FF007F' },
  collectionImg: { width: '100%', height: '100%' },
  collectionText: { fontSize: 11, color: '#E2E8F0', fontWeight: '600', textAlign: 'center' },

  // --- HEADERS ---
  sectionContainer: { marginTop: 8, paddingHorizontal: 12, marginBottom: 8},
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#F8FAFC', letterSpacing: 0.5, marginBottom: 6},
  sectionSubtitle: { fontSize: 10, color: '#94A3B8', fontWeight: '700', letterSpacing: 1 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D4AF37', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  viewAllText: { fontSize: 10, fontWeight: '800', color: '#000', marginRight: 4 },

  // --- PRODUCT CARDS (TRANSPARENT) ---
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  
  // 3-Column Styles
  grid3Card: { width: '33.33%', padding: 4 },
  // 3-column grid
  grid3ImgWrapper: {
    height: 105,
    width: '100%',
    marginBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF', // ✅ FORCE WHITE
  },  
  // Standard Styles
  gridCard: { width: '50%', padding: 6 },
  // 2-column grid
  gridImgWrapper: {
    height: 160,
    width: '100%',
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF', // ✅ FORCE WHITE
  },
  
  // Wrapper for transparent content
  transparentCardContent: { padding: 4 },

  productImg: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  
  imgPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  
  
  productName: { fontSize: 12, fontWeight: '600', color: '#E2E8F0', marginBottom: 2, lineHeight: 16 },
  productPrice: { fontSize: 13, fontWeight: '700', color: '#FFD700', marginRight: 6 },
  productMrp: { fontSize: 10, color: '#94A3B8', textDecorationLine: 'line-through' },
  
  discountBadge: { position: 'absolute', top: 0, left: 0, paddingHorizontal: 6, paddingVertical: 2, borderBottomRightRadius: 8, backgroundColor: '#FF007F' },
  discountBadgeText: { color: 'white', fontSize: 9, fontWeight: '800' },
  
  distanceText: { fontSize: 9, color: '#38BDF8', fontWeight: '500' },
  
  deliveryBadgeRow: { flexDirection: 'row', alignItems: 'center' },
  badgeText: { fontWeight: '700', marginLeft: 3 },

  // --- TODAYS SPECIAL (SMALLER) ---
  specialCard: { alignItems: 'center', marginHorizontal: 6, borderRadius: 12, overflow: 'hidden', width: 120, height: 145, borderWidth: 1, borderColor: '#FFD700' },
  specialImg: { width: '100%', height: '100%' },
  specialOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6, paddingTop: 12 },
  specialTitle: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  specialPrice: { color: '#FFD700', fontSize: 12, fontWeight: '800', marginRight: 4 },
  specialMrp: { color: '#ccc', fontSize: 9, textDecorationLine: 'line-through' },
  specialImgWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF', // ✅ force white
  },
  

  // --- MOST LOVED (WITH BACKGROUND) ---
  mostLovedBackground: { borderRadius: 20, padding: 12, borderWidth: 1, borderColor: '#FFF' },
  mostLovedGridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  mostLovedItem: { width: '25%', alignItems: 'center', marginBottom: 12 },
  mostLovedImgBorder: { width: 64, height: 64, borderRadius: 32, padding: 2, borderWidth: 1.5, borderColor: '#D6C28A', marginBottom: 6 },
  mostLovedThumb: { width: '100%', height: '100%', borderRadius: 32 },
  mostLovedPriceTiny: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  mostLovedImgInner: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    backgroundColor: '#FFFFFF', // ✅ force white
    justifyContent: 'center',
    alignItems: 'center',
  },
  

  // --- INLINE BANNER ---
  inlineBannerCard: { width: '100%', marginTop: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  inlineBannerMedia: { width: '100%', height: 180 },
  inlineBannerOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingTop: 40 },
  inlineBannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  inlineBannerSub: { color: '#cbd5e1', fontSize: 12, marginBottom: 10 },
  shopNowBtn: { backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  shopNowText: { color: '#000', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  // --- NEARBY ---
  nearbyCard: { marginTop: 24, marginHorizontal: 12, paddingVertical: 20, borderRadius: 16, backgroundColor: 'rgba(30, 41, 59, 0.6)', alignItems: 'center', borderWidth: 1, borderColor: '#38BDF8' },
  nearbyHintText: { marginTop: 10, fontSize: 12, color: '#38BDF8', fontWeight: '500' },
  nearbyErrorText: { color: '#F87171', marginBottom: 8 },
  nearbyRetryBtn: { backgroundColor: '#38BDF8', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  nearbyRetryText: { color: '#000', fontWeight: '700', fontSize: 12 },

  // --- LOADER ---
  loadingContainer: { flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' },
  loaderCenterWrapper: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  loaderLogoCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', zIndex: 10, elevation: 10 },
  loaderGradient: { width: '100%', height: '100%', borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  loaderLogoText: { fontSize: 32, fontWeight: '900', color: '#FFF', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  loaderRipple: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 1.5, zIndex: 1 },
  loaderTextWrapper: { alignItems: 'center', zIndex: 11 },
  loaderBrandText: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', letterSpacing: 4, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', textTransform: 'uppercase' },
  loaderTagline: { color: '#D4AF37', letterSpacing: 1, fontWeight: '500' },

  // --- PREMIUM FOOTER STYLES ---
  footerContainer: {
      alignItems: 'center',
      paddingTop: 40,
      paddingBottom: 100, // Extra padding for scrolling past bottom nav
      marginTop: 30,
      backgroundColor: 'transparent',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerLogoCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
      shadowColor: '#D4AF37',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 10,
  },
  footerLogoText: {
      color: '#000',
      fontWeight: '900',
      fontSize: 22,
      fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif'
  },
  footerBrand: {
      color: '#fff',
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 2
  },
  footerTagline: {
      color: '#888',
      fontSize: 12,
      marginBottom: 20,
      fontStyle: 'italic'
  },
  footerSocialRow: {
      flexDirection: 'row',
      marginBottom: 24,
      gap: 20,
  },
  socialBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.05)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
  },
  footerLinksContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
  },
  footerLinkItem: {
      paddingHorizontal: 10,
  },
  footerLinkText: {
      color: '#ccc',
      fontSize: 12,
      fontWeight: '500',
  },
  footerDivider: {
      width: 1,
      height: 12,
      backgroundColor: '#444',
  },
  trustRow: {
      flexDirection: 'row',
      marginBottom: 30,
      gap: 15,
  },
  trustItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(212, 175, 55, 0.1)',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  trustText: {
      color: '#D4AF37',
      fontSize: 10,
      fontWeight: '600',
      marginLeft: 6,
  },
  copyrightSection: {
      alignItems: 'center',
  },
  footerSmall: {
      color: '#555',
      fontSize: 10,
      marginBottom: 4,
  },
  madeWithLove: {
      color: '#666',
      fontSize: 10,
      fontWeight: '600',
  },

  // --- HERO LAYOUT (1 Big, 2 Small) ---
  heroLayoutContainer: {
    flexDirection: 'row',
    height: 280,
    marginTop: 10,
  },
  heroBigCard: {
    flex: 1.8, 
    marginRight: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  heroBigImg: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 12,
    paddingTop: 40,
  },
  heroBigTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroBigPrice: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '800',
  },
  heroRightColumn: {
    flex: 1, 
    justifyContent: 'space-between',
  },
  heroSmallCard: {
    height: '48%', 
    borderRadius: 12,
    backgroundColor: '#FFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  heroSmallImg: {
    width: '100%',
    height: '100%',
    opacity: 0.8,
  },
  heroSmallInfo: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 6,
  },
  heroSmallTitle: {
    color: '#ccc',
    fontSize: 10,
    fontWeight: '600',
  },
  heroSmallPrice: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '700',
  },

  // --- HIDDEN GEMS (Horizontal Scroll) ---
  gemCard: {
    width: 130,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', 
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  gemImgWrapper: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#FFF',
  },
  gemImg: {
    width: '100%',
    height: '100%',
  },
  gemTitle: {
    color: '#eee',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  gemPrice: {
    color: '#00F0FF', 
    fontSize: 14,
    fontWeight: '700',
  },
  
  // --- SEE ALL CARD ---
  seeAllCard: {
    width: 100,
    height: 160, 
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4AF37',
    borderStyle: 'dashed',
  },
  seeAllText: {
    color: '#D4AF37',
    fontWeight: '700',
    marginTop: 8,
    fontSize: 12,
  }
});
