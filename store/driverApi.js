import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import * as SecureStore from "expo-secure-store";

// const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.0.163:5000";
//https://iravya-software-hcwu.vercel.app/health
const API_URL = "https://iravya-software-backend.onrender.com";
// const API_URL = "http://10.224.170.232:5000";

// export const driverApi = createApi({
//   reducerPath: "driverApi",
//   baseQuery: fetchBaseQuery({
//     baseUrl: API_URL,
//     prepareHeaders: async (headers, { getState }) => {
//       const token =
//         getState().auth.token ??
//         (await SecureStore.getItemAsync("driver_token"));
//       if (token) headers.set("Authorization", `Bearer ${token}`);
//       headers.set("Content-Type", "application/json");
//       return headers;
//     },
//   }),
//   tagTypes: ["Trips", "Alerts"],
//   endpoints: (builder) => ({

//     // POST /api/v1/auth/driver/login  { phone, pin }
//     login: builder.mutation({
//       query: (body) => ({ url: "/api/v1/auth/driver/login", method: "POST", body }),
//     }),

//     // GET /api/v1/driverapp/trips/:driverId
//     // Returns: [ { trip_type: "past", trips: [] }, { trip_type: "upcoming", trips: [] } ]
//     getAllTrips: builder.query({
//       query: (driverId) => `/api/v1/driverapp/trips/${driverId}`,
//       providesTags: ["Trips"],
//       // Transform into a flat, easy-to-use shape
//       transformResponse: (response) => {
//         const raw = response?.data ?? response ?? [];
//         const pastGroup = raw.find((g) => g.trip_type === "past");
//         const upcomingGroup = raw.find((g) => g.trip_type === "upcoming");
//         return {
//           past: pastGroup?.trips ?? [],
//           upcoming: upcomingGroup?.trips ?? [],
//         };
//       },
//     }),

//     // POST /api/v1/driver/accept-trip  { trip_id }
//     acceptTrip: builder.mutation({
//       query: (body) => ({ url: "/api/v1/driver/accept-trip", method: "POST", body }),
//       invalidatesTags: ["Trips"],
//     }),

//     // POST /api/v1/driver/confirm-stop  { stop_id, trip_id }
//     confirmStop: builder.mutation({
//       query: (body) => ({ url: "/api/v1/driver/confirm-stop", method: "POST", body }),
//       invalidatesTags: ["Trips"],
//     }),

//     // POST /api/v1/driver/end-trip  { trip_id }
//     endTrip: builder.mutation({
//       query: (body) => ({ url: "/api/v1/driver/end-trip", method: "POST", body }),
//       invalidatesTags: ["Trips"],
//     }),

//     // POST /api/v1/driver/emergency  { trip_id, lat, lng }
//     sendEmergency: builder.mutation({
//       query: (body) => ({ url: "/api/v1/driver/emergency", method: "POST", body }),
//     }),

//     // POST /api/v1/driver/report  { trip_id, issue_type, note }
//     reportIssue: builder.mutation({
//       query: (body) => ({ url: "/api/v1/driver/report", method: "POST", body }),
//     }),
//   }),
// });

// export const {
//   useLoginMutation,
//   useGetAllTripsQuery,
//   useAcceptTripMutation,
//   useConfirmStopMutation,
//   useEndTripMutation,
//   useSendEmergencyMutation,
//   useReportIssueMutation,
// } = driverApi;

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
  tagTypes: ["Trips", "ActiveTrip"],
  endpoints: (builder) => ({

    // POST /api/v1/auth/driver/login  { phone, pin }
    login: builder.mutation({
      query: (body) => ({ url: "/api/v1/auth/driver/login", method: "POST", body }),
    }),

    // GET /trips/:id  — returns { past: [], upcoming: [] }
    getAllTrips: builder.query({
      query: (driverId) => `/api/v1/driverapp/trips/${driverId}`,
      transformResponse: (response) => {
        // API returns [{ trip_type: "past"|"upcoming", trips: [...] }]
        const data = response?.data ?? response ?? [];
        const result = { past: [], upcoming: [] };
        if (Array.isArray(data)) {
          data.forEach((group) => {
            if (group.trip_type === "past") result.past = group.trips ?? [];
            else if (group.trip_type === "upcoming") result.upcoming = group.trips ?? [];
          });
        }
        return result;
      },
      providesTags: ["Trips"],
    }),

    // POST /api/v1/driver/end-trip  { trip_id }
    endTrip: builder.mutation({
      query: (body) => ({ url: "/api/v1/driver/end-trip", method: "POST", body }),
      invalidatesTags: ["Trips"],
    }),

    // GET /trip/:id  — returns active in_transit trip for driver
    getActiveTrip: builder.query({
      query: (driverId) => `/api/v1/driverapp/trip/${driverId}`,
      transformResponse: (response) => {
        const data = response?.data ?? response ?? [];
        return Array.isArray(data) ? data[0] ?? null : data ?? null;
      },
      providesTags: ["ActiveTrip"],
    }),

    // POST /accept/:trip_id
    acceptTrip: builder.mutation({
      query: ({ trip_id }) => ({
        url: `/api/v1/driverapp/accept/${trip_id}`,
        method: "POST",
      }),
      invalidatesTags: ["Trips", "ActiveTrip"],
    }),

    // POST /confirmdelivery/:stop_id/:trip_id
    confirmStop: builder.mutation({
      query: ({ stop_id, trip_id }) => ({
        url: `/api/v1/driverapp/confirmdelivery/${stop_id}/${trip_id}`,
        method: "POST",
      }),
      invalidatesTags: ["ActiveTrip"],
    }),

    // POST /emergency  (add this endpoint on your backend if needed)
    sendEmergency: builder.mutation({
      query: ({ trip_id, lat, lng }) => ({
        url: `/emergency`,
        method: "POST",
        body: { trip_id, lat, lng },
      }),
    }),

    // POST /endtrip/:trip_id  (add on backend)
    endTrip: builder.mutation({
      query: ({ trip_id }) => ({
        url: `/endtrip/${trip_id}`,
        method: "POST",
      }),
      invalidatesTags: ["Trips", "ActiveTrip"],
    }),
  }),
});

export const {
  useGetAllTripsQuery,
  useGetActiveTripQuery,
  useAcceptTripMutation,
  useConfirmStopMutation,
  useSendEmergencyMutation,
  useEndTripMutation,
} = driverApi;
