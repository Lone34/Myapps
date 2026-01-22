// src/components/AnimatedBackground.js
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_FLAKES = 55;

function createFlakes() {
  return new Array(NUM_FLAKES).fill(null).map(() => {
    const size = 2 + Math.random() * 6;
    return {
      fall: new Animated.Value(Math.random()),
      size,
      startX: Math.random() * SCREEN_WIDTH,
      drift: (Math.random() - 0.5) * 60,
      duration: 7000 + Math.random() * 5000,
      delay: Math.random() * 4000,
    };
  });
}

const AnimatedBackground = () => {
  const flakesRef = useRef(createFlakes());

  useEffect(() => {
    const flakes = flakesRef.current;
    const animateFlake = (flake) => {
      flake.fall.setValue(0);
      Animated.sequence([
        Animated.delay(flake.delay),
        Animated.timing(flake.fall, {
          toValue: 1,
          duration: flake.duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start(() => {
        flake.startX = Math.random() * SCREEN_WIDTH;
        flake.drift = (Math.random() - 0.5) * 60;
        flake.duration = 7000 + Math.random() * 5000;
        flake.delay = Math.random() * 4000;
        animateFlake(flake);
      });
    };
    flakes.forEach(animateFlake);
  }, []);

  return (
    <LinearGradient
      // Changed bottom colors from #020617 to #111827 (lighter dark)
      colors={['#2874e0', '#111825', '#678']}
      // Blue stops at 15% down, rest is the new lighter dark color
      locations={[0, 0.15, 1]}
      style={styles.container}
      pointerEvents="none"
    >
      {flakesRef.current.map((flake, index) => {
        const translateY = flake.fall.interpolate({
          inputRange: [0, 1],
          outputRange: [-50, SCREEN_HEIGHT + 50],
        });
        const translateX = flake.fall.interpolate({
          inputRange: [0, 1],
          outputRange: [flake.startX, flake.startX + flake.drift],
        });
        const opacity = flake.fall.interpolate({
          inputRange: [0, 0.2, 0.8, 1],
          outputRange: [0, 0.9, 0.9, 0],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.flake,
              {
                width: flake.size,
                height: flake.size,
                borderRadius: flake.size / 2,
                opacity,
                transform: [{ translateX }, { translateY }],
              },
            ]}
          />
        );
      })}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  flake: {
    position: 'absolute',
    backgroundColor: 'white', // snow color
  },
});

export default AnimatedBackground;
