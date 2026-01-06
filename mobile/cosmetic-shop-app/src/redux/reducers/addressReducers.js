// src/redux/reducers/addressReducers.js
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

// 1. LIST REDUCER
export const addressListReducer = (state = { addresses: [] }, action) => {
  switch (action.type) {
    case ADDRESS_LIST_REQUEST:
      return { ...state, loading: true };
    case ADDRESS_LIST_SUCCESS:
      return { ...state, loading: false, addresses: action.payload };
    case ADDRESS_LIST_FAIL:
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

// 2. CREATE REDUCER
export const addressCreateReducer = (state = {}, action) => {
  switch (action.type) {
    case ADDRESS_CREATE_REQUEST:
      return { loading: true };
    case ADDRESS_CREATE_SUCCESS:
      return { loading: false, success: true, address: action.payload };
    case ADDRESS_CREATE_FAIL:
      return { loading: false, error: action.payload };
    default:
      return state;
  }
};

// 3. DELETE REDUCER
export const addressDeleteReducer = (state = {}, action) => {
  switch (action.type) {
    case ADDRESS_DELETE_REQUEST:
      return { loading: true };
    case ADDRESS_DELETE_SUCCESS:
      return { loading: false, success: true };
    case ADDRESS_DELETE_FAIL:
      return { loading: false, error: action.payload };
    default:
      return state;
  }
};
