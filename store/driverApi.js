import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import * as SecureStore from "expo-secure-store";
 
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.224.170.232:5000";
 
export const driverApi = createApi({
  reducerPath: "driverApi",
  baseQuery: fetchBaseQuery({
    baseUrl: API_URL,
    prepareHeaders: async (headers, { getState }) => {
      const token =
        getState().auth.token ??
        (await SecureStore.getItemAsync("driver_token"));
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set("Content-Type", "application/json");
      return headers;
    },
  }),
  tagTypes: ["Trips", "Alerts"],
  endpoints: (builder) => ({
 
    // POST /api/v1/auth/driver/login  { phone, pin }
    login: builder.mutation({
      query: (body) => ({ url: "/api/v1/auth/driver/login", method: "POST", body }),
    }),
 
    // GET /api/v1/driverapp/trips/:driverId
    // Returns: [ { trip_type: "past", trips: [] }, { trip_type: "upcoming", trips: [] } ]
    getAllTrips: builder.query({
      query: (driverId) => `/api/v1/driverapp/trips/${driverId}`,
      providesTags: ["Trips"],
      // Transform into a flat, easy-to-use shape
      transformResponse: (response) => {
        const raw = response?.data ?? response ?? [];
        const pastGroup     = raw.find((g) => g.trip_type === "past");
        const upcomingGroup = raw.find((g) => g.trip_type === "upcoming");
        return {
          past:     pastGroup?.trips     ?? [],
          upcoming: upcomingGroup?.trips ?? [],
        };
      },
    }),
 
    // POST /api/v1/driver/accept-trip  { trip_id }
    acceptTrip: builder.mutation({
      query: (body) => ({ url: "/api/v1/driver/accept-trip", method: "POST", body }),
      invalidatesTags: ["Trips"],
    }),
 
    // POST /api/v1/driver/confirm-stop  { stop_id, trip_id }
    confirmStop: builder.mutation({
      query: (body) => ({ url: "/api/v1/driver/confirm-stop", method: "POST", body }),
      invalidatesTags: ["Trips"],
    }),
 
    // POST /api/v1/driver/end-trip  { trip_id }
    endTrip: builder.mutation({
      query: (body) => ({ url: "/api/v1/driver/end-trip", method: "POST", body }),
      invalidatesTags: ["Trips"],
    }),
 
    // POST /api/v1/driver/emergency  { trip_id, lat, lng }
    sendEmergency: builder.mutation({
      query: (body) => ({ url: "/api/v1/driver/emergency", method: "POST", body }),
    }),
 
    // POST /api/v1/driver/report  { trip_id, issue_type, note }
    reportIssue: builder.mutation({
      query: (body) => ({ url: "/api/v1/driver/report", method: "POST", body }),
    }),
  }),
});
 
export const {
  useLoginMutation,
  useGetAllTripsQuery,
  useAcceptTripMutation,
  useConfirmStopMutation,
  useEndTripMutation,
  useSendEmergencyMutation,
  useReportIssueMutation,
} = driverApi;