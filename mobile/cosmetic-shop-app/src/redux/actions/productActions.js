import axios from 'axios';
import {
    PRODUCT_LIST_REQUEST,
    PRODUCT_LIST_SUCCESS,
    PRODUCT_LIST_FAIL,
    PRODUCT_DETAILS_REQUEST,
    PRODUCT_DETAILS_SUCCESS,
    PRODUCT_DETAILS_FAIL,
    PRODUCT_CREATE_REVIEW_REQUEST,
    PRODUCT_CREATE_REVIEW_SUCCESS,
    PRODUCT_CREATE_REVIEW_FAIL,
    PRODUCT_WISHLIST_TOGGLE_REQUEST,
    PRODUCT_WISHLIST_TOGGLE_SUCCESS,
    PRODUCT_WISHLIST_TOGGLE_FAIL,
    MY_WISHLIST_LIST_REQUEST,
    MY_WISHLIST_LIST_SUCCESS,
    MY_WISHLIST_LIST_FAIL,
    PRODUCT_TOP_REQUEST,
    PRODUCT_TOP_SUCCESS,
    PRODUCT_TOP_FAIL,
    PRODUCT_DELETE_REQUEST,
    PRODUCT_DELETE_SUCCESS,
    PRODUCT_DELETE_FAIL,
    PRODUCT_CREATE_REQUEST, 
    PRODUCT_CREATE_SUCCESS, 
    PRODUCT_CREATE_FAIL,
    PRODUCT_UPDATE_REQUEST, 
    PRODUCT_UPDATE_SUCCESS, 
    PRODUCT_UPDATE_FAIL,
    PRODUCT_VARIATION_CREATE_REQUEST,
    PRODUCT_VARIATION_CREATE_SUCCESS,
    PRODUCT_VARIATION_CREATE_FAIL,
    PRODUCT_VARIATION_UPDATE_REQUEST,
    PRODUCT_VARIATION_UPDATE_SUCCESS,
    PRODUCT_VARIATION_UPDATE_FAIL,
    PRODUCT_VARIATION_DELETE_REQUEST,
    PRODUCT_VARIATION_DELETE_SUCCESS,
    PRODUCT_VARIATION_DELETE_FAIL,
} from '../constants/productConstants';
import client from '../../api/client';

const getConfig = (getState) => {
    const {
        userLogin: { userInfo },
    } = getState();
    
    if (!userInfo) {
        throw new Error("Not authorized, no token");
    }

    return {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userInfo.token}`,
        },
    };
};

export const listProducts = (query = '') => async (dispatch) => {
    try {
        dispatch({ type: PRODUCT_LIST_REQUEST });
        
        // --- THIS IS THE FIX ---
        // Added a '/' before the query string
        // It's now /api/products/ + ?category=Cosmetic
        const { data } = await axios.get(`/api/products/${query}`);
        // --- END OF FIX ---
        
        dispatch({ type: PRODUCT_LIST_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: PRODUCT_LIST_FAIL,
            payload: error.response && error.response.data.detail ? error.response.data.detail : error.message,
        });
    }
};

export const listProductDetails = (id) => async (dispatch) => {
    try {
        dispatch({ type: PRODUCT_DETAILS_REQUEST });
        const { data } = await axios.get(`/api/products/${id}/`);
        dispatch({ type: PRODUCT_DETAILS_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: PRODUCT_DETAILS_FAIL,
            payload: error.response && error.response.data.detail ? error.response.data.detail : error.message,
        });
    }
};

export const createProductReview = (productId, reviewData) => async (dispatch, getState) => {
    try {
        dispatch({ type: PRODUCT_CREATE_REVIEW_REQUEST });

        const { userLogin: { userInfo } } = getState();

        // --- THIS IS THE FIX ---
        // The config MUST be 'multipart/form-data' now
        // The 'reviewData' will be a FormData object
        const config = {
            headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${userInfo.token}`,
            },
        };

        // 'reviewData' is now FormData, not JSON
        await axios.post(`/api/products/${productId}/reviews/`, reviewData, config); 
        // --- END OF FIX ---

        dispatch({ type: PRODUCT_CREATE_REVIEW_SUCCESS });
    } catch (error) {
        dispatch({
            type: PRODUCT_CREATE_REVIEW_FAIL,
            payload: error.response && error.response.data.detail ? error.response.data.detail : error.message,
        });
    }
};

// Toggle wishlist for a product (same as website)
export const toggleWishlist = (productId) => async (dispatch) => {
  try {
    dispatch({ type: PRODUCT_WISHLIST_TOGGLE_REQUEST });

    // Uses shared axios client with baseURL + Authorization interceptor
    const { data } = await client.post(`/api/products/${productId}/wishlist/`);

    dispatch({
      type: PRODUCT_WISHLIST_TOGGLE_SUCCESS,
      payload: data, // e.g. {detail: "..."}
    });
  } catch (error) {
    dispatch({
      type: PRODUCT_WISHLIST_TOGGLE_FAIL,
      payload:
        error?.response?.data?.detail ||
        error?.message ||
        'Could not update wishlist.',
    });
  }
};

// Load current user's wishlist (same endpoint as website)
export const listMyWishlist = () => async (dispatch) => {
  try {
    dispatch({ type: MY_WISHLIST_LIST_REQUEST });

    const { data } = await client.get('/api/users/wishlist/');

    dispatch({
      type: MY_WISHLIST_LIST_SUCCESS,
      payload: data, // should be array of products
    });
  } catch (error) {
    dispatch({
      type: MY_WISHLIST_LIST_FAIL,
      payload:
        error?.response?.data?.detail ||
        error?.message ||
        'Unable to load wishlist.',
    });
  }
};



export const listTopProducts = () => async (dispatch) => {
    try {
        dispatch({ type: PRODUCT_TOP_REQUEST });
        const { data } = await axios.get(`/api/products/top/`);
        dispatch({ type: PRODUCT_TOP_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: PRODUCT_TOP_FAIL,
            payload: error.response && error.response.data.detail ? error.response.data.detail : error.message,
        });
    }
};
export const deleteProduct = (id) => async (dispatch, getState) => {
    try {
        dispatch({ type: PRODUCT_DELETE_REQUEST });
        const { userLogin: { userInfo } } = getState();
        const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
        
        await axios.delete(`/api/products/delete/${id}/`, config);
        
        dispatch({ type: PRODUCT_DELETE_SUCCESS });
    } catch (error) {
        dispatch({
            type: PRODUCT_DELETE_FAIL,
            payload: error.response && error.response.data.detail ? error.response.data.detail : error.message,
        });
    }
};

export const createProduct = () => async (dispatch, getState) => {
    try {
        dispatch({ type: PRODUCT_CREATE_REQUEST });
        const { userLogin: { userInfo } } = getState();
        const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
        
        // This hits the backend to create a blank sample product
        const { data } = await axios.post(`/api/products/create/`, {}, config);
        
        dispatch({ type: PRODUCT_CREATE_SUCCESS, payload: data });
    } catch (error) {
        dispatch({
            type: PRODUCT_CREATE_FAIL,
            payload: error.response && error.response.data.detail ? error.response.data.detail : error.message,
        });
    }
};

export const updateProduct = (productData) => async (dispatch, getState) => {
    try {
        dispatch({ type: PRODUCT_UPDATE_REQUEST });

        const { userLogin: { userInfo } } = getState();

        // The config is now plain JSON, not multipart-form-data
        const config = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userInfo.token}`,
            },
        };
        
        // We get the ID from the productData object
        const { id } = productData;
        
        const { data } = await axios.put(
            `/api/products/update/${id}/`,
            productData, // Send the object directly
            config
        );

        dispatch({
            type: PRODUCT_UPDATE_SUCCESS,
            payload: data,
        });

        // Also update the product details state so the page reflects the change
        dispatch({
            type: PRODUCT_DETAILS_SUCCESS,
            payload: data,
        });

    } catch (error) {
        dispatch({
            type: PRODUCT_UPDATE_FAIL,
            payload: error.response && error.response.data.detail
                ? error.response.data.detail
                : error.message,
        });
    }
};
export const createProductVariation = (productId, variationData) => async (dispatch, getState) => {
    try {
        dispatch({ type: PRODUCT_VARIATION_CREATE_REQUEST });

        const { userLogin: { userInfo } } = getState();
        const config = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userInfo.token}`,
            },
        };

        // This hits /api/products/create-variation/<product_id>/
        const { data } = await axios.post(
            `/api/products/create-variation/${productId}/`,
            variationData,
            config
        );

        dispatch({
            type: PRODUCT_VARIATION_CREATE_SUCCESS,
            payload: data,
        });

    } catch (error) {
        dispatch({
            type: PRODUCT_VARIATION_CREATE_FAIL,
            payload: error.response && error.response.data.detail
                ? error.response.data.detail
                : error.message,
        });
    }
};

export const updateProductVariation = (variationId, variationData) => async (dispatch, getState) => {
    try {
        dispatch({ type: PRODUCT_VARIATION_UPDATE_REQUEST });

        const { userLogin: { userInfo } } = getState();
        const config = {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${userInfo.token}`,
            },
        };

        // This hits /api/products/update-variation/<variation_id>/
        const { data } = await axios.put(
            `/api/products/update-variation/${variationId}/`,
            variationData,
            config
        );

        dispatch({
            type: PRODUCT_VARIATION_UPDATE_SUCCESS,
            payload: data,
        });

    } catch (error) {
        dispatch({
            type: PRODUCT_VARIATION_UPDATE_FAIL,
            payload: error.response && error.response.data.detail
                ? error.response.data.detail
                : error.message,
        });
    }
};

export const deleteProductVariation = (variationId) => async (dispatch, getState) => {
    try {
        dispatch({ type: PRODUCT_VARIATION_DELETE_REQUEST });

        const { userLogin: { userInfo } } = getState();
        const config = {
            headers: {
                Authorization: `Bearer ${userInfo.token}`,
            },
        };

        // This hits /api/products/delete-variation/<variation_id>/
        await axios.delete(
            `/api/products/delete-variation/${variationId}/`,
            config
        );

        dispatch({ type: PRODUCT_VARIATION_DELETE_SUCCESS });

    } catch (error) {
        dispatch({
            type: PRODUCT_VARIATION_DELETE_FAIL,
            payload: error.response && error.response.data.detail
                ? error.response.data.detail
                : error.message,
        });
    }
};
