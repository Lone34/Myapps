// src/redux/actions/addressActions.js
import axios from 'axios';
import {
  ADDRESS_LIST_REQUEST,
  ADDRESS_LIST_SUCCESS,
  ADDRESS_LIST_FAIL,

  ADDRESS_CREATE_REQUEST,
  ADDRESS_CREATE_SUCCESS,
  ADDRESS_CREATE_FAIL,

  ADDRESS_DELETE_REQUEST,
  ADDRESS_DELETE_SUCCESS,
  ADDRESS_DELETE_FAIL,
} from '../constants/addressConstants';

// ──────────────────────────────────────────────────────────────
// Helper – get token (works even if Redux is cleared)
const getUserInfo = (getState) => {
  const { userLogin } = getState();
  const reduxUser = userLogin?.userInfo;
  if (reduxUser) return reduxUser;

  try {
    const stored = localStorage.getItem('userInfo');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

// ──────────────────────────────────────────────────────────────
// 1. LIST
export const listAddresses = () => async (dispatch, getState) => {
  try {
    dispatch({ type: ADDRESS_LIST_REQUEST });

    const userInfo = getUserInfo(getState);
    if (!userInfo) {
      dispatch({ type: ADDRESS_LIST_SUCCESS, payload: [] });
      return;
    }

    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userInfo.token}`,
      },
    };

    const { data } = await axios.get('/api/addresses/', config);
    dispatch({ type: ADDRESS_LIST_SUCCESS, payload: data });
  } catch (error) {
    dispatch({
      type: ADDRESS_LIST_FAIL,
      payload: error.response?.data?.detail || error.message,
    });
  }
};

// ──────────────────────────────────────────────────────────────
// 2. CREATE
export const createAddress = (addressData) => async (dispatch, getState) => {
  try {
    dispatch({ type: ADDRESS_CREATE_REQUEST });

    const userInfo = getUserInfo(getState);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userInfo.token}`,
      },
    };

    const { data } = await axios.post('/api/addresses/', addressData, config);

    dispatch({ type: ADDRESS_CREATE_SUCCESS, payload: data });
    dispatch(listAddresses()); // Refresh list
  } catch (error) {
    dispatch({
      type: ADDRESS_CREATE_FAIL,
      payload: error.response?.data?.detail || error.message,
    });
  }
};

// DELETE
export const deleteAddress = (id) => async (dispatch, getState) => {
  try {
    dispatch({ type: ADDRESS_DELETE_REQUEST });

    const userInfo = getUserInfo(getState);
    const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };

    await axios.delete(`/api/addresses/${id}/`, config);
    dispatch({ type: ADDRESS_DELETE_SUCCESS, payload: id });
  } catch (error) {
    dispatch({
      type: ADDRESS_DELETE_FAIL,
      payload: error.response?.data?.detail || error.message,
    });
  }
};
