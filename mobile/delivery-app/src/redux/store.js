import { configureStore } from "@reduxjs/toolkit";
import riderReducer from "./slices/riderSlice";

const store = configureStore({
  reducer: {
    rider: riderReducer,
  },
});

export default store;
