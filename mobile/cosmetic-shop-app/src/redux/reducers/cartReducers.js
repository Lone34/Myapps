// src/redux/reducers/cartReducers.js
import {
  CART_STATE_REQUEST,
  CART_STATE_SUCCESS,
  CART_STATE_FAIL,
  CART_SAVE_SHIPPING_ADDRESS,
  CART_SAVE_PAYMENT_METHOD,
  CART_RESET,
} from '../constants/cartConstants';

const computeTotals = (cartItems = []) => {
  const itemsTotal = cartItems.reduce((sum, item) => {
    const unit =
      Number(item.price) ||
      Number(item.variation?.price) ||
      Number(item.product?.price) ||
      0;
    const qty = Number(item.quantity || 1);
    return sum + unit * qty;
  }, 0);

  let shipping = 0;
  if (itemsTotal < 100 && itemsTotal > 0) shipping = 20;
  else if (itemsTotal < 200) shipping = 10;
  else shipping = 0;

  const tax = 0;
  const total = itemsTotal + shipping + tax;

  const mrpTotal = cartItems.reduce((sum, item) => {
    const mrp =
      Number(item.mrp) ||
      Number(item.product?.mrp) ||
      Number(item.price) ||
      0;
    const qty = Number(item.quantity || 1);
    return sum + mrp * qty;
  }, 0);

  const totalSavings = mrpTotal > total ? mrpTotal - total : 0;

  return {
    itemsPrice: +itemsTotal.toFixed(2),
    shippingPrice: +shipping.toFixed(2),
    taxPrice: +tax.toFixed(2),
    totalPrice: +total.toFixed(2),
    totalSavings: +totalSavings.toFixed(2),
  };
};

const initialState = {
  loading: false,
  cartItems: [],
  itemsPrice: 0,
  shippingPrice: 0,
  taxPrice: 0,
  totalPrice: 0,
  totalSavings: 0,
  shippingAddress: {},
  paymentMethod: null,
  error: null,
};

export const cartReducer = (state = initialState, action) => {
  switch (action.type) {
    case CART_STATE_REQUEST:
      return { ...state, loading: true, error: null };

    case CART_STATE_SUCCESS: {
      const cartItems = action.payload?.cartItems || [];
      const totals = computeTotals(cartItems);
      return {
        ...state,
        loading: false,
        error: null,
        cartItems,
        ...totals,
      };
    }

    case CART_STATE_FAIL:
      return { ...state, loading: false, error: action.payload || 'Cart error' };

    case CART_SAVE_SHIPPING_ADDRESS:
      return { ...state, shippingAddress: action.payload };

    case CART_SAVE_PAYMENT_METHOD:
      return { ...state, paymentMethod: action.payload };

    case CART_RESET:
      return { ...initialState };

    default:
      return state;
  }
};
