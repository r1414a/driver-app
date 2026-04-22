import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import tripReducer from "./tripSlice";
import { driverApi } from "./driverApi";
 
export const store = configureStore({
  reducer: {
    auth: authReducer,
    trip: tripReducer,
    [driverApi.reducerPath]: driverApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(driverApi.middleware),
});