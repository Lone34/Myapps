import {
    WISHLIST_STATE_REQUEST,
    WISHLIST_STATE_SUCCESS,
    WISHLIST_STATE_FAIL
} from '../constants/wishlistConstants';

const initialState = {
    loading: false,
    items: [], // This will just be an array of wishlist items
    error: null
};

export const wishlistReducer = (state = initialState, action) => {
    switch (action.type) {
        
        // When we START any wishlist action
        case WISHLIST_STATE_REQUEST:
            return { 
                ...state, 
                loading: true, 
                error: null 
            };

        // When any wishlist action is SUCCESSFUL
        case WISHLIST_STATE_SUCCESS:
            // Payload should be the full wishlist object: { "wishlist_items": [...] }
            return {
                ...state,
                loading: false,
                // We save just the array of items
                items: action.payload.wishlist_items || [],
                error: null
            };
        
        // When any wishlist action FAILS
        case WISHLIST_STATE_FAIL:
            return { 
                ...state, 
                loading: false, 
                error: action.payload 
            };

        default:
            return state;
    }
};
