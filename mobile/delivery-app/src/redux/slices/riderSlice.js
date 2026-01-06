import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import client from "../../api/client";

// ============ FETCH ACTIVE ORDERS ============
export const fetchOrders = createAsyncThunk(
  "rider/fetchOrders",
  async (_, { rejectWithValue }) => {
    try {
      const res = await client.get("/api/delivery/active-orders/");
      return res.data;
    } catch (e) {
      return rejectWithValue(
        e.response?.data?.detail || e.message || "Failed to fetch orders"
      );
    }
  }
);

// ============ FETCH RIDER STATS ============
export const fetchStats = createAsyncThunk(
  "rider/fetchStats",
  async (_, { rejectWithValue }) => {
    try {
      const res = await client.get("/api/delivery/rider-stats/");
      return res.data;
    } catch (e) {
      return rejectWithValue(
        e.response?.data?.detail || e.message || "Failed to fetch stats"
      );
    }
  }
);

const riderSlice = createSlice({
  name: "rider",
  initialState: {
    orders: [],
    stats: {
      delivered: 0,
      rejected: 0,
      failed: 0,
      cod_total: 0,
    },
    loading: false,
    error: null,
  },

  reducers: {},

  extraReducers: (builder) => {
    builder

      // ---- ORDERS ----
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.orders = action.payload;
        state.loading = false;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      })

      // ---- STATS ----
      .addCase(fetchStats.fulfilled, (state, action) => {
        state.stats = action.payload;
      })
      .addCase(fetchStats.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export default riderSlice.reducer;
