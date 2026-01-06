// src/redux/mobileStore.js
import { createStore, combineReducers, applyMiddleware } from 'redux';
import thunkDefault, { thunk as thunkNamed } from 'redux-thunk';
import { composeWithDevTools } from '@redux-devtools/extension';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../api/client';
import { categoryListReducer } from './reducers/categoryReducers';
import {
  productListReducer,
  productDetailsReducer,
  productCreateReviewReducer,
  productWishlistToggleReducer,
  myWishlistReducer,
  productTopRatedReducer,
  productDeleteReducer,
  productCreateReducer,
  productUpdateReducer,
  productVariationCreateReducer,
  productVariationUpdateReducer,
  productVariationDeleteReducer,
} from './reducers/productReducers';

import { cartReducer } from './reducers/cartReducers';

import {
  userLoginReducer,
  userRegisterReducer,
  userDetailsReducer,
  userUpdateProfileReducer,
  userListReducer,
  userDeleteReducer,
  userUpdateReducer,
} from './reducers/userReducers';

import {
  orderCreateReducer,
  orderDetailsReducer,
  orderListMyReducer,
  checkoutReducer,
  orderListReducer,
  orderDeliverReducer,
} from './reducers/orderReducers';

import {
  addressListReducer,
  addressCreateReducer,
  addressDeleteReducer,
} from './reducers/addressReducers';

import { USER_LOGIN_SUCCESS, USER_LOGOUT } from './constants/userConstants';
import {
  CART_SAVE_SHIPPING_ADDRESS,
  CART_SAVE_PAYMENT_METHOD,
  CART_RESET,
} from './constants/cartConstants';

// ---------- root reducer ----------
const rootReducer = combineReducers({
  productList: productListReducer,
  productDetails: productDetailsReducer,
  productCreateReview: productCreateReviewReducer,
  productWishlistToggle: productWishlistToggleReducer,
  myWishlist: myWishlistReducer,
  productTopRated: productTopRatedReducer,
  productDelete: productDeleteReducer,
  productCreate: productCreateReducer,
  productUpdate: productUpdateReducer,
  productVariationCreate: productVariationCreateReducer,
  productVariationUpdate: productVariationUpdateReducer,
  productVariationDelete: productVariationDeleteReducer,

  cart: cartReducer,

  userLogin: userLoginReducer,
  userRegister: userRegisterReducer,
  userDetails: userDetailsReducer,
  userUpdateProfile: userUpdateProfileReducer,
  userList: userListReducer,
  userDelete: userDeleteReducer,
  userUpdate: userUpdateReducer,

  orderCreate: orderCreateReducer,
  orderDetails: orderDetailsReducer,
  orderListMy: orderListMyReducer,
  checkout: checkoutReducer,
  orderList: orderListReducer,
  orderDeliver: orderDeliverReducer,

  addressList: addressListReducer,
  addressCreate: addressCreateReducer,
  addressDelete: addressDeleteReducer,

  categoryList: categoryListReducer,
  myWishlist: myWishlistReducer,
});

// ---------- thunk fix ----------
const effectiveThunk =
  typeof thunkDefault === 'function'
    ? thunkDefault
    : typeof thunkNamed === 'function'
    ? thunkNamed
    : null;

const middleware = effectiveThunk ? [effectiveThunk] : [];

// ---------- store ----------
const store = createStore(
  rootReducer,
  {},
  composeWithDevTools(applyMiddleware(...middleware))
);

// ---------- rehydrate ----------
export const rehydrateUser = async () => {
  try {
    const [userInfoRaw, shippingRaw, paymentRaw] = await Promise.all([
      AsyncStorage.getItem('userInfo'),
      AsyncStorage.getItem('shippingAddress'),
      AsyncStorage.getItem('paymentMethod'),
    ]);

    if (userInfoRaw) {
      const userInfo = JSON.parse(userInfoRaw);
      if (userInfo?.token) {
        store.dispatch({ type: USER_LOGIN_SUCCESS, payload: userInfo });
        client.defaults.headers.common.Authorization = `Bearer ${userInfo.token}`;
      }
    }

    if (shippingRaw) {
      store.dispatch({
        type: CART_SAVE_SHIPPING_ADDRESS,
        payload: JSON.parse(shippingRaw),
      });
    }

    if (paymentRaw) {
      store.dispatch({
        type: CART_SAVE_PAYMENT_METHOD,
        payload: paymentRaw,
      });
    }
  } catch (err) {
    await AsyncStorage.multiRemove(['userInfo', 'shippingAddress', 'paymentMethod']);
    delete client.defaults.headers.common.Authorization;
    store.dispatch({ type: USER_LOGOUT });
    store.dispatch({ type: CART_RESET });
  }
};

export default store;
