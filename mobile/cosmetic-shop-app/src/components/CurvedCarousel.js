// src/components/CurvedCarousel.js
import React, { useRef, useEffect } from 'react';
import { Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SPACING = 16;

export default function CurvedCarousel({
  data = [],
  renderItem,
  cardWidth = SCREEN_WIDTH * 0.65,
  autoPlay = true,
  autoPlayInterval = 4000,
}) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const indexRef = useRef(0);

  // ----- autoplay -----
  useEffect(() => {
    if (!autoPlay || !data.length) return;

    const id = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % data.length;
      if (listRef.current) {
        listRef.current.scrollToOffset({
          offset: indexRef.current * (cardWidth + SPACING),
          animated: true,
        });
      }
    }, autoPlayInterval);

    return () => clearInterval(id);
  }, [autoPlay, autoPlayInterval, data.length, cardWidth]);

  if (!data || !data.length) return null;

  const contentPad = (SCREEN_WIDTH - cardWidth) / 2;

  return (
    <Animated.FlatList
      ref={listRef}
      data={data}
      keyExtractor={(item, index) => String(item.id ?? index)}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + SPACING}
      decelerationRate="fast"
      bounces={false}
      scrollEventThrottle={16}
      contentContainerStyle={{
        paddingHorizontal: contentPad,
      }}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true }
      )}
      renderItem={({ item, index }) => {
        const inputRange = [
          (index - 2) * (cardWidth + SPACING),
          (index - 1) * (cardWidth + SPACING),
          index * (cardWidth + SPACING),
          (index + 1) * (cardWidth + SPACING),
          (index + 2) * (cardWidth + SPACING),
        ];

        const scale = scrollX.interpolate({
          inputRange,
          outputRange: [0.8, 0.9, 1.05, 0.9, 0.8],
          extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 0.7, 1, 0.7, 0.3],
          extrapolate: 'clamp',
        });

        const translateY = scrollX.interpolate({
          inputRange,
          outputRange: [10, 6, 0, 6, 10],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            style={{
              width: cardWidth,
              marginHorizontal: SPACING / 2,
              opacity,
              transform: [{ scale }, { translateY }],
            }}
          >
            {renderItem(item, index)}
          </Animated.View>
        );
      }}
    />
  );
}
