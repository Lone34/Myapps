 import {
    PRODUCT_LIST_REQUEST,
    PRODUCT_LIST_SUCCESS,
    PRODUCT_LIST_FAIL,
    PRODUCT_LIST_RESET,
    PRODUCT_DETAILS_REQUEST,
    PRODUCT_DETAILS_SUCCESS,
    PRODUCT_DETAILS_FAIL,
    PRODUCT_DELETE_REQUEST,
    PRODUCT_DELETE_SUCCESS,
    PRODUCT_DELETE_FAIL,
    PRODUCT_CREATE_REQUEST,
    PRODUCT_CREATE_SUCCESS,
    PRODUCT_CREATE_FAIL,
    PRODUCT_CREATE_RESET,
    PRODUCT_UPDATE_REQUEST,
    PRODUCT_UPDATE_SUCCESS,
    PRODUCT_UPDATE_FAIL,
    PRODUCT_UPDATE_RESET,
    PRODUCT_CREATE_REVIEW_REQUEST,
    PRODUCT_CREATE_REVIEW_SUCCESS,
    PRODUCT_CREATE_REVIEW_FAIL,
    PRODUCT_CREATE_REVIEW_RESET,
    PRODUCT_WISHLIST_TOGGLE_REQUEST,
    PRODUCT_WISHLIST_TOGGLE_SUCCESS,
    PRODUCT_WISHLIST_TOGGLE_FAIL,
    MY_WISHLIST_LIST_REQUEST,
    MY_WISHLIST_LIST_SUCCESS,
    MY_WISHLIST_LIST_FAIL,
    PRODUCT_TOP_REQUEST,
    PRODUCT_TOP_SUCCESS,
    PRODUCT_TOP_FAIL,
    PRODUCT_DETAILS_RESET,
    PRODUCT_VARIATION_CREATE_REQUEST,
    PRODUCT_VARIATION_CREATE_SUCCESS,
    PRODUCT_VARIATION_CREATE_FAIL,
    PRODUCT_VARIATION_CREATE_RESET,
    PRODUCT_VARIATION_UPDATE_REQUEST,
    PRODUCT_VARIATION_UPDATE_SUCCESS,
    PRODUCT_VARIATION_UPDATE_FAIL,
    PRODUCT_VARIATION_UPDATE_RESET,
    PRODUCT_VARIATION_DELETE_REQUEST,
    PRODUCT_VARIATION_DELETE_SUCCESS,
    PRODUCT_VARIATION_DELETE_FAIL,
} from '../constants/productConstants';

export const productListReducer = (state = { products: [] }, action) => {
    switch (action.type) {
        case PRODUCT_LIST_REQUEST:
            return { loading: true, products: [] };
        case PRODUCT_LIST_SUCCESS:
            return {
                loading: false,
                products: action.payload.products,
                pages: action.payload.pages,
                page: action.payload.page,
                count: action.payload.count
            };
        case PRODUCT_LIST_FAIL:
            return { loading: false, error: action.payload };

        case PRODUCT_LIST_RESET: // <-- This line will now work
            return { products: [] }; 
            
        default:
            return state;
    }
};

export const productDetailsReducer = (
    // Check this initial state. It MUST include 'product'.
    state = { product: { reviews: [], images: [], variations: [] } },
    action
) => {
    switch (action.type) {
        case PRODUCT_DETAILS_REQUEST:
            return { ...state, loading: true };
        case PRODUCT_DETAILS_SUCCESS:
            return { loading: false, product: action.payload };
        case PRODUCT_DETAILS_FAIL:
            return { loading: false, error: action.payload };
        case PRODUCT_DETAILS_RESET:
             // Reset state MUST also include 'product'
            return { product: { reviews: [], images: [], variations: [] } };
        default:
            return state;
    }
};

export const productDeleteReducer = (state = {}, action) => {
    switch (action.type) {
        case PRODUCT_DELETE_REQUEST:
            return { loading: true };
        case PRODUCT_DELETE_SUCCESS:
            return { loading: false, success: true };
        case PRODUCT_DELETE_FAIL:
            return { loading: false, error: action.payload };
        default:
            return state;
    }
};

export const productCreateReducer = (state = {}, action) => {
    switch (action.type) {
        case PRODUCT_CREATE_REQUEST:
            return { loading: true };
        case PRODUCT_CREATE_SUCCESS:
            return { loading: false, success: true, product: action.payload };
        case PRODUCT_CREATE_FAIL:
            return { loading: false, error: action.payload };
        case PRODUCT_CREATE_RESET:
            return {};
        default:
            return state;
    }
};

export const productUpdateReducer = (state = { product: {} }, action) => {
    switch (action.type) {
        case PRODUCT_UPDATE_REQUEST:
            return { loading: true };
        case PRODUCT_UPDATE_SUCCESS:
            return { loading: false, success: true, product: action.payload };
        case PRODUCT_UPDATE_FAIL:
            return { loading: false, error: action.payload };
        case PRODUCT_UPDATE_RESET:
            return { product: {} };
        default:
            return state;
    }
};

export const productCreateReviewReducer = (state = {}, action) => {
    switch (action.type) {
        case PRODUCT_CREATE_REVIEW_REQUEST:
            return { loading: true };
        case PRODUCT_CREATE_REVIEW_SUCCESS:
            return { loading: false, success: true };
        case PRODUCT_CREATE_REVIEW_FAIL:
            return { loading: false, error: action.payload };
        case PRODUCT_CREATE_REVIEW_RESET:
            return {};
        default:
            return state;
    }
};
export const productWishlistToggleReducer = (state = {}, action) => {
    switch (action.type) {
        case PRODUCT_WISHLIST_TOGGLE_REQUEST:
            return { loading: true };
        case PRODUCT_WISHLIST_TOGGLE_SUCCESS:
            return { loading: false, success: true, message: action.payload };
        case PRODUCT_WISHLIST_TOGGLE_FAIL:
            return { loading: false, error: action.payload };
        default:
            return state;
    }
};

export const myWishlistReducer = (
  state = { loading: false, products: [] },
  action
) => {
  switch (action.type) {
    case MY_WISHLIST_LIST_REQUEST:
      return { ...state, loading: true, error: null };
    case MY_WISHLIST_LIST_SUCCESS:
      return { loading: false, products: action.payload };
    case MY_WISHLIST_LIST_FAIL:
      return { loading: false, error: action.payload, products: [] };
    default:
      return state;
  }
};

export const productTopRatedReducer = (state = { products: [] }, action) => {
    switch (action.type) {
        case PRODUCT_TOP_REQUEST:
            return { loading: true, products: [] };
        case PRODUCT_TOP_SUCCESS:
            return { loading: false, products: action.payload };
        case PRODUCT_TOP_FAIL:
            return { loading: false, error: action.payload };
        default:
            return state;
    }
};
export const productVariationCreateReducer = (state = {}, action) => {
    switch (action.type) {
        case PRODUCT_VARIATION_CREATE_REQUEST:
            return { loading: true };
        case PRODUCT_VARIATION_CREATE_SUCCESS:
            return { loading: false, success: true, variation: action.payload };
        case PRODUCT_VARIATION_CREATE_FAIL:
            return { loading: false, error: action.payload };
        case PRODUCT_VARIATION_CREATE_RESET:
            return {};
        default:
            return state;
    }
};

export const productVariationUpdateReducer = (state = { variation: {} }, action) => {
    switch (action.type) {
        case PRODUCT_VARIATION_UPDATE_REQUEST:
            return { loading: true };
        case PRODUCT_VARIATION_UPDATE_SUCCESS:
            return { loading: false, success: true, variation: action.payload };
        case PRODUCT_VARIATION_UPDATE_FAIL:
            return { loading: false, error: action.payload };
        case PRODUCT_VARIATION_UPDATE_RESET:
            return { variation: {} };
        default:
            return state;
    }
};

export const productVariationDeleteReducer = (state = {}, action) => {
    switch (action.type) {
        case PRODUCT_VARIATION_DELETE_REQUEST:
            return { loading: true };
        case PRODUCT_VARIATION_DELETE_SUCCESS:
            return { loading: false, success: true };
        case PRODUCT_VARIATION_DELETE_FAIL:
            return { loading: false, error: action.payload };
        default:
            return state;
    }
};


