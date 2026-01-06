export const orderCreateReducer = (state = {}, action) => {
    switch (action.type) {
        case 'ORDER_CREATE_REQUEST': return { loading: true };
        case 'ORDER_CREATE_SUCCESS': return { loading: false, success: true, order: action.payload };
        case 'ORDER_CREATE_FAIL': return { loading: false, error: action.payload };
        default: return state;
    }
};

export const orderDetailsReducer = (state = { loading: true, order: null }, action) => {
    switch (action.type) {
        case 'ORDER_DETAILS_REQUEST': return { ...state, loading: true };
        case 'ORDER_DETAILS_SUCCESS': return { loading: false, order: action.payload };
        case 'ORDER_DETAILS_FAIL': return { loading: false, error: action.payload };
        default: return state;
    }
};

export const myOrdersListReducer = (state = { orders: [] }, action) => {
    switch (action.type) {
        case 'MY_ORDERS_LIST_REQUEST': return { loading: true };
        case 'MY_ORDERS_LIST_SUCCESS': return { loading: false, orders: action.payload };
        case 'MY_ORDERS_LIST_FAIL': return { loading: false, error: action.payload };
        case 'USER_LOGOUT': return { orders: [] };
        default: return state;
    }
};

// ADD THIS NEW REDUCER
export const orderListReducer = (state = { orders: [] }, action) => {
    switch (action.type) {
        case 'ORDER_LIST_REQUEST':
            return { loading: true };
        case 'ORDER_LIST_SUCCESS':
            return { loading: false, orders: action.payload };
        case 'ORDER_LIST_FAIL':
            return { loading: false, error: action.payload };
        default:
            return state;
    }
};

