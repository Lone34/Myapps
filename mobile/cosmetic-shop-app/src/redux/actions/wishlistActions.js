import axios from 'axios';
import {
    WISHLIST_STATE_REQUEST,
    WISHLIST_STATE_SUCCESS,
    WISHLIST_STATE_FAIL
} from '../constants/wishlistConstants';

// --- Helper: Gets Auth Config ---
const getConfig = (getState) => {
    const { userLogin: { userInfo } } = getState();

    if (!userInfo || !userInfo.token) {
        throw new Error('Not authorized. No token found.');
    }

    return {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userInfo.token}`,
        },
    };
};

// --- Helper: Gets Error Message ---
const getError = (error) => {
     return error.response && error.response.data.detail
        ? error.response.data.detail
        : error.message;
};
// --- End Helper Functions ---


// ACTION: Fetches the user's current wishlist
export const fetchWishlist = () => async (dispatch, getState) => {
    try {
        dispatch({ type: WISHLIST_STATE_REQUEST });
        const config = getConfig(getState);
        
        // This endpoint should return the full wishlist object
        const { data } = await axios.get('/api/wishlist/', config);
        
        dispatch({ type: WISHLIST_STATE_SUCCESS, payload: data });
    } catch (error) {
        dispatch({ type: WISHLIST_STATE_FAIL, payload: getError(error) });
    }
};

// ACTION: Adds an item to the wishlist
export const addToWishlist = (productId) => async (dispatch, getState) => {
    try {
        dispatch({ type: WISHLIST_STATE_REQUEST });
        const config = getConfig(getState);

        // This endpoint should add the item and return the *new* full wishlist
        const { data } = await axios.post(
            '/api/wishlist/add/',
            { product_id: productId },
            config
        );

        dispatch({ type: WISHLIST_STATE_SUCCESS, payload: data });
    } catch (error) {
        dispatch({ type: WISHLIST_STATE_FAIL, payload: getError(error) });
    }
};

// ACTION: Removes an item from the wishlist
export const removeFromWishlist = (wishlistItemId) => async (dispatch, getState) => {
    try {
        dispatch({ type: WISHLIST_STATE_REQUEST });
        const config = getConfig(getState);

        // This endpoint should remove the item and return the *new* full wishlist
        const { data } = await axios.delete(`/api/wishlist/remove/${wishlistItemId}/`, config);

        dispatch({ type: WISHLIST_STATE_SUCCESS, payload: data });
    } catch (error) {
        dispatch({ type: WISHLIST_STATE_FAIL, payload: getError(error) });
    }
};
