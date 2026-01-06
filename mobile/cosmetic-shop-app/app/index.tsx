// app/index.tsx
import React from 'react';
import { Redirect } from 'expo-router';

// Always send to tabs (Home). We will ask for login only when user tries
// to add to cart / buy / wishlist etc.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
