export const productReviewCreateReducer = (state = {}, action) => {
    switch (action.type) {
        case 'PRODUCT_CREATE_REVIEW_REQUEST':
            return { loading: true };
        case 'PRODUCT_CREATE_REVIEW_SUCCESS':
            return { loading: false, success: true };
        case 'PRODUCT_CREATE_REVIEW_FAIL':
            return { loading: false, error: action.payload };
        case 'PRODUCT_CREATE_REVIEW_RESET':
            return {};
        default:
            return state;
    }
};
export const productListAllReducer = (state = { products: [] }, action) => {
    switch (action.type) {
        case 'PRODUCT_LIST_ALL_REQUEST':
            return { loading: true, products: [] };
        case 'PRODUCT_LIST_ALL_SUCCESS':
            // Store products, page, and pages separately
            return { 
                loading: false, 
                products: action.payload.results, 
                pages: action.payload.pages, 
                page: action.payload.page 
            };
        case 'PRODUCT_LIST_ALL_FAIL':
            return { loading: false, error: action.payload };
        default:
            return state;
    }
};

export const productDeleteReducer = (state = {}, action) => {
    switch (action.type) {
        case 'PRODUCT_DELETE_REQUEST':
            return { loading: true };
        case 'PRODUCT_DELETE_SUCCESS':
            return { loading: false, success: true };
        case 'PRODUCT_DELETE_FAIL':
            return { loading: false, error: action.payload };
        default:
            return state;
    }
};
export const productCreateReducer = (state = {}, action) => {
    switch (action.type) {
        case 'PRODUCT_CREATE_REQUEST':
            return { loading: true };
        case 'PRODUCT_CREATE_SUCCESS':
            return { loading: false, success: true, product: action.payload };
        case 'PRODUCT_CREATE_FAIL':
            return { loading: false, error: action.payload };
        case 'PRODUCT_CREATE_RESET':
            return {};
        default:
            return state;
    }
};
export const productUpdateReducer = (state = { product: {} }, action) => {
    switch (action.type) {
        case 'PRODUCT_UPDATE_REQUEST':
            return { loading: true };
        case 'PRODUCT_UPDATE_SUCCESS':
            return { loading: false, success: true, product: action.payload };
        case 'PRODUCT_UPDATE_FAIL':
            return { loading: false, error: action.payload };
        case 'PRODUCT_UPDATE_RESET':
            return { product: {} };
        default:
            return state;
    }
};

export const wishlistToggleReducer = (state = {}, action) => {
    switch (action.type) {
        case 'WISHLIST_TOGGLE_REQUEST': return { loading: true };
        case 'WISHLIST_TOGGLE_SUCCESS': return { loading: false, success: true, message: action.payload };
        case 'WISHLIST_TOGGLE_FAIL': return { loading: false, error: action.payload };
        default: return state;
    }
};

export const wishlistListReducer = (state = { products: [] }, action) => {
    switch (action.type) {
        case 'WISHLIST_LIST_REQUEST': return { loading: true, products: [] };
        case 'WISHLIST_LIST_SUCCESS': return { loading: false, products: action.payload };
        case 'WISHLIST_LIST_FAIL': return { loading: false, error: action.payload };
        case 'USER_LOGOUT': return { products: [] };
        default: return state;
    }
};
