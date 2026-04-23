import { createSlice } from "@reduxjs/toolkit";
 
const tripSlice = createSlice({
  name: "trip",
  initialState: {
    activeTrip:  null,   // full trip object from API (in_transit)
    stops:       [],     // normalised stops with status
    alerts:      [],     // socket + local alerts
    truckPos:    null,   // { lat, lng }
    speed:       0,
    gpsOk:       false,
    nearStopId:  null,
  },
  reducers: {
    setActiveTrip: (s, a) => {
      s.activeTrip = a.payload;
    },
    setStops: (s, a) => {
      s.stops = a.payload;
    },
    // Optimistic update for a single stop status from socket / local confirm
    updateStopStatus: (s, a) => {
      // payload: { stop_id, status }
      const stop = s.stops.find(st => st.id === a.payload.stop_id || st.store_id === a.payload.stop_id);
      if (stop) stop.status = a.payload.status;
    },
    confirmStop: (s, a) => {
      // payload: stop id (from nearStop banner)
      const stop = s.stops.find(st => st.id === a.payload);
      if (stop) stop.status = "completed";
    },
    setTruckPos: (s, a) => {
      s.truckPos = a.payload;
    },
    setSpeed: (s, a) => {
      s.speed = a.payload;
    },
    setGpsOk: (s, a) => {
      s.gpsOk = a.payload;
    },
    setNearStop: (s, a) => {
      s.nearStopId = a.payload;
    },
    pushAlert: (s, a) => {
      // Deduplicate by message + type within last 30 seconds
      const now = Date.now();
      const isDuplicate = s.alerts.some(
        ex => ex.message === a.payload.message && ex.type === a.payload.type && now - ex._ts < 30000
      );
      if (!isDuplicate) {
        s.alerts = [
          { ...a.payload, id: `a-${now}`, unread: true, _ts: now },
          ...s.alerts,
        ].slice(0, 100);
      }
    },
    markAlertsRead: (s) => {
      s.alerts = s.alerts.map(a => ({ ...a, unread: false }));
    },
    clearTrip: (s) => {
      s.activeTrip = null;
      s.stops      = [];
      s.truckPos   = null;
      s.speed      = 0;
      s.nearStopId = null;
    },
  },
});
 
export const {
  setActiveTrip, setStops, confirmStop, updateStopStatus,
  setTruckPos, setSpeed, setGpsOk, setNearStop,
  pushAlert, markAlertsRead, clearTrip,
} = tripSlice.actions;
 
export default tripSlice.reducer;