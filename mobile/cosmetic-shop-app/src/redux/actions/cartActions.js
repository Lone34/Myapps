// src/redux/actions/cartActions.js
import client from '../../api/client';
import {
  CART_STATE_REQUEST,
  CART_STATE_SUCCESS,
  CART_STATE_FAIL,
  CART_SAVE_SHIPPING_ADDRESS,
  CART_SAVE_PAYMENT_METHOD,
  CART_RESET,
} from '../constants/cartConstants';

// Get auth header from mobile Redux state
const getAuthConfig = (getState) => {
  const {
    userLogin: { userInfo },
  } = getState();

  if (!userInfo || !userInfo.token) {
    throw new Error('Not logged in');
  }

  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userInfo.token}`,
    },
  };
};

// Normalize server payload so reducer always sees cartItems[]
const normalizeCartPayload = (serverData = {}) => {
  const items =
    serverData.items ||
    serverData.cart_items ||
    serverData.data?.items ||
    [];

  const cartItems = items.map((i) => ({
    ...i,
    // Flatten common fields for stable UI math
    price: Number(
      i.price ??
        i.variation?.price ??
        i.product?.price ??
        0
    ),
    mrp: Number(
      i.mrp ??
        i.product?.mrp ??
        i.variation?.price ??
        i.price ??
        0
    ),
    quantity: Number(i.quantity || 1),
    variation_id:
      i.variation_id ||
      i.variation?.id ||
      i.id,
  }));

  return { cartItems };
};

// ---------- FETCH CART ----------
export const fetchCart = () => async (dispatch, getState) => {
  try {
    dispatch({ type: CART_STATE_REQUEST });
    const config = getAuthConfig(getState);
    const { data } = await client.get('/api/cart/', config);
    dispatch({
      type: CART_STATE_SUCCESS,
      payload: normalizeCartPayload(data),
    });
  } catch (error) {
    dispatch({
      type: CART_STATE_FAIL,
      payload:
        error.response?.data?.detail || error.message || 'Failed to load cart',
    });
  }
};

// ---------- ADD / UPDATE ----------
export const addToCart =
  (variationId, qty = 1, replace = false) =>
  async (dispatch, getState) => {
    try {
      const config = getAuthConfig(getState);
      const { data } = await client.post(
        '/api/cart/add/',
        { variation_id: variationId, quantity: qty, replace },
        config
      );
      dispatch({
        type: CART_STATE_SUCCESS,
        payload: normalizeCartPayload(data),
      });
      return data;
    } catch (error) {
      dispatch({
        type: CART_STATE_FAIL,
        payload:
          error.response?.data?.detail || error.message || 'Failed to update cart',
      });
      throw error;
    }
  };

// ---------- REMOVE ----------
export const removeFromCart =
  (variationId) => async (dispatch, getState) => {
    try {
      const config = getAuthConfig(getState);
      const { data } = await client.delete(
        `/api/cart/remove/${variationId}/`,
        config
      );
      dispatch({
        type: CART_STATE_SUCCESS,
        payload: normalizeCartPayload(data),
      });
      return data;
    } catch (error) {
      dispatch({
        type: CART_STATE_FAIL,
        payload:
          error.response?.data?.detail || error.message || 'Failed to remove item',
      });
      throw error;
    }
  };

// ---------- LOCAL: SHIPPING ADDRESS ----------
export const saveShippingAddress = (data) => (dispatch) => {
  const fullAddress = {
    address: data.address,
    village: data.village || '',
    city: data.city,
    postalCode: data.postalCode,
    district: data.district || '',
    stateName: data.stateName || '',
    country: data.country || 'India',
    savedAt: new Date().toISOString(),
  };

  dispatch({
    type: CART_SAVE_SHIPPING_ADDRESS,
    payload: fullAddress,
  });
};

// ---------- LOCAL: PAYMENT METHOD ----------
export const savePaymentMethod = (method) => (dispatch) => {
  dispatch({
    type: CART_SAVE_PAYMENT_METHOD,
    payload: method,
  });
};

// ---------- RESET (on logout / order success) ----------
export const resetCart = () => (dispatch) => {
  dispatch({ type: CART_RESET });
};
