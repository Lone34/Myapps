// ✅ All imports must be at the very top (ESLint rule)
import axios from 'axios';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import { composeWithDevTools } from '@redux-devtools/extension';
import { categoryListReducer, categoryCreateReducer } from './reducers/categoryReducers';

// --- Reducer Imports ---
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

// ✅ Move axios configuration *after* all imports — ESLint-safe
axios.defaults.baseURL = window.location.origin;

// --- Combine All Reducers ---
const reducer = combineReducers({
    // Products
    productList: productListReducer,
    productDetails: productDetailsReducer,
    productCreateReview: productCreateReviewReducer,
    productWishlistToggle: productWishlistToggleReducer,
    myWishlist: myWishlistReducer,
    productTopRated: productTopRatedReducer,
    productDelete: productDeleteReducer,
    productCreate: productCreateReducer,
    productUpdate: productUpdateReducer,
    categoryList: categoryListReducer,
    categoryCreate: categoryCreateReducer,
    productVariationCreate: productVariationCreateReducer,
    productVariationUpdate: productVariationUpdateReducer,
    productVariationDelete: productVariationDeleteReducer,

    // Cart
    cart: cartReducer,

    // Users
    userLogin: userLoginReducer,
    userRegister: userRegisterReducer,
    userDetails: userDetailsReducer,
    userUpdateProfile: userUpdateProfileReducer,
    userList: userListReducer,
    userDelete: userDeleteReducer,
    userUpdate: userUpdateReducer,

    // Orders
    orderCreate: orderCreateReducer,
    orderDetails: orderDetailsReducer,
    orderListMy: orderListMyReducer,
    checkout: checkoutReducer,
    orderList: orderListReducer,
    orderDeliver: orderDeliverReducer,

    // Addresses
    addressList: addressListReducer,
    addressCreate: addressCreateReducer,
    addressDelete: addressDeleteReducer,
});

// --- Set Initial State ---
const userInfoFromStorage = localStorage.getItem('userInfo')
    ? JSON.parse(localStorage.getItem('userInfo'))
    : null;

const initialState = {
    cart: {
        cartItems: [],
        shippingAddress: {},
    },
    userLogin: { userInfo: userInfoFromStorage },
};

const middleware = [thunk];

const store = createStore(
    reducer,
    initialState,
    composeWithDevTools(applyMiddleware(...middleware))
);

export default store;
