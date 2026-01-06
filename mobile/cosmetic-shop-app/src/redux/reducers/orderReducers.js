import {
    ORDER_LIST_REQUEST, ORDER_LIST_SUCCESS, ORDER_LIST_FAIL,
    ORDER_DELIVER_REQUEST, ORDER_DELIVER_SUCCESS, ORDER_DELIVER_FAIL, ORDER_DELIVER_RESET
} from '../constants/orderConstants';
import {
    ORDER_CHECKOUT_SET_ITEMS,
    ORDER_CHECKOUT_SAVE_SHIPPING_ADDRESS,
    ORDER_CHECKOUT_SAVE_PAYMENT_METHOD,
    ORDER_CHECKOUT_RESET,
    ORDER_CREATE_REQUEST,
    ORDER_CREATE_SUCCESS,
    ORDER_CREATE_FAIL,
    ORDER_CREATE_RESET,
    ORDER_DETAILS_REQUEST,
    ORDER_DETAILS_SUCCESS,
    ORDER_DETAILS_FAIL,
    ORDER_LIST_MY_REQUEST,
    ORDER_LIST_MY_SUCCESS,
    ORDER_LIST_MY_FAIL,
    ORDER_LIST_MY_RESET,
    ORDER_RETURN_REQUEST_REQUEST,
    ORDER_RETURN_REQUEST_SUCCESS,
    ORDER_RETURN_REQUEST_FAIL,
    ORDER_RETURN_REQUEST_RESET,
    RETURN_LIST_MY_REQUEST,
    RETURN_LIST_MY_SUCCESS,
    RETURN_LIST_MY_FAIL,
} from '../constants/orderConstants';

// Helper function to calculate prices
const addDecimals = (num) => (Math.round(num * 100) / 100).toFixed(2);

const calculatePrices = (orderItems) => {
    const itemsPrice = addDecimals(orderItems.reduce((acc, item) => acc + item.price * item.qty, 0));
    const mrpPrice = addDecimals(orderItems.reduce((acc, item) => acc + (item.mrp || item.price) * item.qty, 0));
    const totalSavings = addDecimals(mrpPrice - itemsPrice);
    const shippingPrice = addDecimals(itemsPrice > 100 ? 0 : 10);
    const taxPrice = addDecimals(Number((0.15 * itemsPrice).toFixed(2)));
    const totalPrice = (Number(itemsPrice) + Number(shippingPrice) + Number(taxPrice)).toFixed(2);
    return { itemsPrice, shippingPrice, taxPrice, totalPrice, totalSavings };
};

// This is the separate state for the "Buy Now" or "Checkout" flow
const initialCheckoutState = {
  orderItems: [],
  shippingAddress: {},
  paymentMethod: '',
  itemsPrice: '0.00',
  shippingPrice: '0.00',
  taxPrice: '0.00',
  totalPrice: '0.00',
};
const initialOrderCheckoutState = {
  cartItems: [],
  itemsPrice: 0,
  shippingPrice: 0,
  taxPrice: 0,
};
export const orderCheckoutReducer = (state = initialOrderCheckoutState, action) => {
  switch (action.type) {
    case "ORDER_CHECKOUT_SET":
      return { ...state, ...action.payload };
    case "ORDER_CHECKOUT_CLEAR":
      return initialOrderCheckoutState;
    default:
      return state;
    case 'ORDER_CHECKOUT_SAVE_PAYMENT':
      return {
        ...state,
        paymentMethod: action.payload.paymentMethod,
      };
    case 'ORDER_CHECKOUT_SAVE_SHIPPING':
      return {
        ...state,
        shippingAddress: action.payload.shippingAddress,
      };
  }
};
export const checkoutReducer = (state = initialCheckoutState, action) => {
  switch (action.type) {
    case ORDER_CHECKOUT_SET_ITEMS:
      return {
        ...state,
        ...action.payload, // Already has prices from setOrderForCheckout
      };

    case ORDER_CHECKOUT_RESET:
      return initialCheckoutState;

    default:
      return state;
  }
};

export const orderCreateReducer = (state = {}, action) => {
    switch (action.type) {
        case ORDER_CREATE_REQUEST:
            return { loading: true };
        case ORDER_CREATE_SUCCESS:
            return { loading: false, success: true, order: action.payload };
        case ORDER_CREATE_FAIL:
            return { loading: false, error: action.payload };
        case ORDER_CREATE_RESET:
            return {};
        default:
            return state;
    }
};

export const orderDetailsReducer = (state = { loading: true, orderItems: [], shippingAddress: {} }, action) => {
    switch (action.type) {
        case ORDER_DETAILS_REQUEST:
            return { ...state, loading: true };
        case ORDER_DETAILS_SUCCESS:
            return { loading: false, order: action.payload };
        case ORDER_DETAILS_FAIL:
            return { loading: false, error: action.payload };
        default:
            return state;
    }
};

// --- THIS FUNCTION WAS MISSING ---
export const orderListMyReducer = (state = { orders: [] }, action) => {
    switch (action.type) {
        case ORDER_LIST_MY_REQUEST:
            return { loading: true };
        case ORDER_LIST_MY_SUCCESS:
            return { loading: false, orders: action.payload };
        case ORDER_LIST_MY_FAIL:
            return { loading: false, error: action.payload };
        case ORDER_LIST_MY_RESET:
            return { orders: [] };
        default:
            return state;
    }
};
export const orderListReducer = (state = { orders: [] }, action) => {
    switch (action.type) {
        case ORDER_LIST_REQUEST:
            return { loading: true };
        case ORDER_LIST_SUCCESS:
            return { loading: false, orders: action.payload };
        case ORDER_LIST_FAIL:
            return { loading: false, error: action.payload };
        default:
            return state;
    }
};

export const orderDeliverReducer = (state = {}, action) => {
    switch (action.type) {
        case ORDER_DELIVER_REQUEST:
            return { loading: true };
        case ORDER_DELIVER_SUCCESS:
            return { loading: false, success: true };
        case ORDER_DELIVER_FAIL:
            return { loading: false, error: action.payload };
        case ORDER_DELIVER_RESET:
            return {};
        default:
            return state;
    }
};
export const orderReturnRequestReducer = (state = {}, action) => {
  switch (action.type) {
    case ORDER_RETURN_REQUEST_REQUEST:
      return { loading: true };
    case ORDER_RETURN_REQUEST_SUCCESS:
      return { loading: false, success: true, returnRequest: action.payload };
    case ORDER_RETURN_REQUEST_FAIL:
      return { loading: false, error: action.payload };
    case ORDER_RETURN_REQUEST_RESET:
      return {};
    default:
      return state;
  }
};

export const returnListMyReducer = (state = { returns: [] }, action) => {
  switch (action.type) {
    case RETURN_LIST_MY_REQUEST:
      return { loading: true, returns: [] };
    case RETURN_LIST_MY_SUCCESS:
      return { loading: false, returns: action.payload };
    case RETURN_LIST_MY_FAIL:
      return { loading: false, error: action.payload, returns: [] };
    default:
      return state;
  }
};
