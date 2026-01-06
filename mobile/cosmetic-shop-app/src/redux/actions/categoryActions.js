import axios from 'axios';
import client from '../../api/client';
import {
    CATEGORY_LIST_REQUEST,
    CATEGORY_LIST_SUCCESS,
    CATEGORY_LIST_FAIL,
    CATEGORY_CREATE_REQUEST,
    CATEGORY_CREATE_SUCCESS,
    CATEGORY_CREATE_FAIL,
} from '../constants/categoryConstants';
export const listCategories = () => async (dispatch) => {
  try {
    dispatch({ type: CATEGORY_LIST_REQUEST });

    // Use your Django endpoint.
    // Option 1: featured/top-level only (like website home):
    // const { data } = await client.get('/api/categories/');

    // Option 2 (recommended for the Categories tab): full structured list:
    const { data } = await client.get('/api/categories/all/');

    dispatch({ type: CATEGORY_LIST_SUCCESS, payload: data });
  } catch (error) {
    dispatch({
      type: CATEGORY_LIST_FAIL,
      payload:
        error?.response?.data?.detail ||
        error?.message ||
        'Could not fetch categories.',
    });
  }
};

export const createCategory = (categoryData) => async (dispatch, getState) => {
    try {
        dispatch({ type: CATEGORY_CREATE_REQUEST });

        const { userLogin: { userInfo } } = getState();
        const config = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userInfo.token}`,
            },
        };

        const { data } = await axios.post(
            `/api/categories/create/`,
            categoryData, // Should contain { name: '...', parent: '...' (optional ID) }
            config
        );

        dispatch({
            type: CATEGORY_CREATE_SUCCESS,
            payload: data,
        });

        // Optional: Dispatch listCategories again to refresh lists?
        // dispatch(listCategories());

    } catch (error) {
        dispatch({
            type: CATEGORY_CREATE_FAIL,
            payload: error.response && error.response.data.detail
                ? error.response.data.detail
                : error.message,
        });
    }
};
