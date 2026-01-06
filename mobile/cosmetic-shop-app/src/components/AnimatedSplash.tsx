// src/components/AnimatedSplash.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

const EMOJIS = ['💄', '🧴', '🍪', '🥗', '🥑', '👗', '🛒'];

export default function AnimatedSplash() {
  const animValues = useRef(
    EMOJIS.map(() => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = animValues.map((val, i) =>
      Animated.sequence([
        Animated.delay(i * 200), // stagger entry
        Animated.spring(val, {
          toValue: 1,
          useNativeDriver: true,
          speed: 2,
          bounciness: 12,
        }),
      ])
    );

    Animated.stagger(150, animations).start();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.emojiRow}>
        {EMOJIS.map((emoji, i) => (
          <Animated.View
            key={i}
            style={[
              styles.emojiBubble,
              {
                opacity: animValues[i],
                transform: [
                  {
                    scale: animValues[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Animated.View>
        ))}
      </View>

      <Text style={styles.tagline}>
        Everything you need, delivered in minutes
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19', // match your night theme
    alignItems: 'center',
    justifyContent: 'center',
  },

  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '80%',
    marginBottom: 20,
  },

  emojiBubble: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.07)',
    margin: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emoji: {
    fontSize: 34,
  },

  tagline: {
    color: '#E5E7EB',
    marginTop: 10,
    fontSize: 14,
  },
});
