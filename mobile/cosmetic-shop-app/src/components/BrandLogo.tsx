// src/components/BrandLogo.tsx
import React from "react";
import { Text, StyleSheet } from "react-native";

// 👉 Edit this to change the brand text everywhere in the app
export const BRAND_NAME = "KASHMIRCART";

type Props = {
  // Extra styles from screens (like animated color) can be passed in
  style?: any;
};

export default function BrandLogo({ style }: Props) {
  return <Text style={[styles.logoBase, style]}>{BRAND_NAME}</Text>;
}

const styles = StyleSheet.create({
  logoBase: {
    textAlign: "center",
    fontSize: 42,         // change size here
    fontWeight: "900",
    letterSpacing: 4,
    textShadowColor: "#FFFFFF",
    textShadowRadius: 15,
    marginBottom: 35,
    // fontFamily: "Poppins_700Bold", // if you later add custom fonts
  },
});
