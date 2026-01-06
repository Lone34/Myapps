// src/utils/checkout.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';

export const CHECKOUT_ITEMS_KEY = 'checkoutItems';
export const SHIPPING_ADDRESS_KEY = 'shippingAddress';

export type CheckoutItem = {
  variation_id: number;
  qty: number;
  meta?: any; // same idea as web: store product/variation snapshot for UI
};

// -------- BUY NOW: SAVE SINGLE ITEM --------
export const setBuyNowCheckoutItems = async (item: CheckoutItem) => {
  await AsyncStorage.setItem(
    CHECKOUT_ITEMS_KEY,
    JSON.stringify([item])
  );
};

// -------- CLEAR BUY NOW (USE CART INSTEAD) --------
export const clearCheckoutItems = async () => {
  await AsyncStorage.removeItem(CHECKOUT_ITEMS_KEY);
};

// -------- LOAD BUY NOW ITEMS --------
export const loadCheckoutItems = async (): Promise<CheckoutItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(CHECKOUT_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// -------- SHIPPING ADDRESS (LIKE WEB LOCALSTORAGE) --------
export const saveShippingAddressLocal = async (addr: any) => {
  await AsyncStorage.setItem(
    SHIPPING_ADDRESS_KEY,
    JSON.stringify(addr)
  );
};

export const loadShippingAddressLocal = async () => {
  try {
    const raw = await AsyncStorage.getItem(SHIPPING_ADDRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// -------- FETCH CART FROM BACKEND --------
export const fetchCartFromBackend = async () => {
  const { data } = await client.get('/api/cart/');
  return data; // CartSerializer
};

// price helpers similar to website PaymentPage
export const unitPriceOf = (it: any, usingBuyNow: boolean) => {
  if (it?.meta?.variation?.price != null)
    return Number(it.meta.variation.price);

  if (usingBuyNow) {
    // our BuyNow items: trust meta or backend snapshot
    return Number(
      it.price ??
        it.meta?.product?.price ??
        it.meta?.variation?.price ??
        0
    );
  }

  // cart item shape from backend
  if (it.variation?.price != null)
    return Number(it.variation.price);
  if (it.price != null) return Number(it.price);
  if (it.product?.price != null)
    return Number(it.product.price);
  return 0;
};

export const qtyOf = (it: any, usingBuyNow: boolean) =>
  Number((usingBuyNow ? it.qty : it.quantity) || 1);

// same rules as your web PaymentPage :contentReference[oaicite:1]{index=1}
export const calcShipping = (itemsPrice: number) => {
  if (itemsPrice < 100) return 20;
  if (itemsPrice < 200) return 10;
  return 0;
};
