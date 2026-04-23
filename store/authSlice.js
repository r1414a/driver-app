import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";

export const restoreAuth = createAsyncThunk("auth/restore", async () => {
  const token = await SecureStore.getItemAsync("driver_token");
  const rawDriver = await SecureStore.getItemAsync("driver_data");
  return {
    token,
    driver: rawDriver ? JSON.parse(rawDriver) : null,
  };
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    token: null,
    driver: null,
    isLoading: true,
    lang: "en",
  },
  reducers: {
    setAuth: (state, action) => {
      state.token = action.payload.token;
      state.driver = action.payload.driver;
      SecureStore.setItemAsync("driver_token", action.payload.token);
      SecureStore.setItemAsync("driver_data", JSON.stringify(action.payload.driver));
    },
    clearAuth: (state) => {
      state.token = null;
      state.driver = null;
      SecureStore.deleteItemAsync("driver_token");
      SecureStore.deleteItemAsync("driver_data");
    },
    setLang: (state, action) => {
      state.lang = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(restoreAuth.pending, (s) => { s.isLoading = true; })
      .addCase(restoreAuth.fulfilled, (s, a) => {
        s.token = a.payload.token;
        s.driver = a.payload.driver;
        s.isLoading = false;
      })
      .addCase(restoreAuth.rejected, (s) => { s.isLoading = false; });
  },
});

export const { setAuth, clearAuth, setLang } = authSlice.actions;
export default authSlice.reducer;
