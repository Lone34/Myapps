export const categoryListReducer = (state = { categories: [] }, action) => {
    switch (action.type) {
        case 'CATEGORY_LIST_REQUEST': return { loading: true, categories: [] };
        case 'CATEGORY_LIST_SUCCESS': return { loading: false, categories: action.payload };
        case 'CATEGORY_LIST_FAIL': return { loading: false, error: action.payload };
        default: return state;
    }
};

export const categoryCreateReducer = (state = {}, action) => {
    switch (action.type) {
        case 'CATEGORY_CREATE_REQUEST': return { loading: true };
        case 'CATEGORY_CREATE_SUCCESS': return { loading: false, success: true };
        case 'CATEGORY_CREATE_FAIL': return { loading: false, error: action.payload };
        case 'CATEGORY_CREATE_RESET': return {};
        default: return state;
    }
};
