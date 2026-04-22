import { createSlice } from "@reduxjs/toolkit";
 
const tripSlice = createSlice({
  name: "trip",
  initialState: {
    activeTrip:  null,   // full trip object from API
    stops:       [],     // trip stops with status
    alerts:      [],     // alerts received via socket + API
    truckPos:    null,   // { lat, lng } — current truck position from socket
    speed:       0,
    gpsOk:       false,
    nearStopId:  null,
  },
  reducers: {
    setActiveTrip: (s, a) => { s.activeTrip = a.payload; },
    setStops: (s, a) => { s.stops = a.payload; },
    confirmStop: (s, a) => {
      const stop = s.stops.find(st => st.id === a.payload);
      if (stop) stop.status = "completed";
    },
    setTruckPos: (s, a) => { s.truckPos = a.payload; },
    setSpeed: (s, a) => { s.speed = a.payload; },
    setGpsOk: (s, a) => { s.gpsOk = a.payload; },
    setNearStop: (s, a) => { s.nearStopId = a.payload; },
    pushAlert: (s, a) => {
      s.alerts = [{ ...a.payload, id: `a-${Date.now()}`, unread: true }, ...s.alerts].slice(0, 50);
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
  setActiveTrip, setStops, confirmStop,
  setTruckPos, setSpeed, setGpsOk, setNearStop,
  pushAlert, markAlertsRead, clearTrip,
} = tripSlice.actions;
 
export default tripSlice.reducer;