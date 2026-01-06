// src/redux/actions/userActions.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import client from '../../api/client';
import {
  USER_LOGIN_REQUEST,
  USER_LOGIN_SUCCESS,
  USER_LOGIN_FAIL,
  USER_LOGOUT,
  USER_REGISTER_REQUEST,
  USER_REGISTER_SUCCESS,
  USER_REGISTER_FAIL,
  USER_DETAILS_REQUEST,
  USER_DETAILS_SUCCESS,
  USER_DETAILS_FAIL,
  USER_DETAILS_RESET,
  USER_UPDATE_PROFILE_REQUEST,
  USER_UPDATE_PROFILE_SUCCESS,
  USER_UPDATE_PROFILE_FAIL,
} from '../constants/userConstants';
import { ORDER_LIST_MY_RESET } from '../constants/orderConstants';
import { CART_RESET } from '../constants/cartConstants';
import { fetchCart, resetCart } from './cartActions';
import { listMyWishlist } from './productActions';

// Save user to storage
const saveUser = async (data) => {
  await AsyncStorage.setItem('userInfo', JSON.stringify(data));
};

// Clear user
const clearUser = async () => {
  await AsyncStorage.removeItem('userInfo');
};

// ========== LOGIN ==========
export const login = (email, password) => async (dispatch) => {
  try {
    dispatch({ type: USER_LOGIN_REQUEST });

    const { data } = await client.post('users/login/', {
      username: email,
      password,
    });

    dispatch({ type: USER_LOGIN_SUCCESS, payload: data });
    await saveUser(data);

    dispatch(fetchCart());
    dispatch(listMyWishlist());
  } catch (error) {
    dispatch({
      type: USER_LOGIN_FAIL,
      payload:
        error?.response?.data?.detail ||
        error?.message ||
        'Login failed',
    });
  }
};

// ========== REGISTER ==========
export const register = (name, email, password) => async (dispatch) => {
  try {
    dispatch({ type: USER_REGISTER_REQUEST });

    const { data } = await client.post('users/register/', {
      name,
      email,
      password,
    });

    dispatch({ type: USER_REGISTER_SUCCESS, payload: data });
    dispatch({ type: USER_LOGIN_SUCCESS, payload: data });
    await saveUser(data);

    dispatch(fetchCart());
    dispatch(listMyWishlist());
  } catch (error) {
    dispatch({
      type: USER_REGISTER_FAIL,
      payload:
        error?.response?.data?.detail ||
        error?.message ||
        'Registration failed',
    });
  }
};

// ========== REHYDRATE USER ==========
export const rehydrateUser = () => async (dispatch) => {
  try {
    const raw = await AsyncStorage.getItem('userInfo');
    if (!raw) return;

    const data = JSON.parse(raw);
    if (!data?.token) return;

    dispatch({ type: USER_LOGIN_SUCCESS, payload: data });
    dispatch(fetchCart());
    dispatch(listMyWishlist());
  } catch {}
};

// ========== USER DETAILS ==========
export const getUserDetails = () => async (dispatch) => {
  try {
    dispatch({ type: USER_DETAILS_REQUEST });

    const { data } = await client.get('users/profile/');

    dispatch({ type: USER_DETAILS_SUCCESS, payload: data });
  } catch (error) {
    dispatch({
      type: USER_DETAILS_FAIL,
      payload:
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to load profile',
    });
  }
};

// ========== UPDATE PROFILE ==========
export const updateUserProfile = (payload) => async (dispatch) => {
  try {
    dispatch({ type: USER_UPDATE_PROFILE_REQUEST });

    const { data } = await client.put('users/profile/update/', payload);

    dispatch({ type: USER_UPDATE_PROFILE_SUCCESS, payload: data });
    dispatch({ type: USER_LOGIN_SUCCESS, payload: data });
    await saveUser(data);
  } catch (error) {
    dispatch({
      type: USER_UPDATE_PROFILE_FAIL,
      payload:
        error?.response?.data?.detail ||
        error?.message ||
        'Failed to update profile',
    });
  }
};

// ========== LOGOUT ==========
export const logout = () => async (dispatch) => {
  await clearUser();
  dispatch({ type: USER_LOGOUT });
  dispatch({ type: USER_DETAILS_RESET });
  dispatch({ type: ORDER_LIST_MY_RESET });
  dispatch({ type: CART_RESET });
  dispatch(resetCart());
};
