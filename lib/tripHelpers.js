// lib/tripHelpers.js




/** Haversine distance in metres between two {lat,lng} points */
export function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Interpolate a position along an array of {latitude,longitude} coords */
export function interpolateRoute(coords, fraction) {
  if (!coords?.length) return null;
  if (fraction <= 0) return coords[0];
  if (fraction >= 1) return coords[coords.length - 1];
  const maxIdx = coords.length - 1;
  const idx = Math.min(Math.floor(fraction * maxIdx), maxIdx - 1);
  const t = fraction * maxIdx - idx;
  return {
    latitude:  coords[idx].latitude  + t * (coords[idx + 1].latitude  - coords[idx].latitude),
    longitude: coords[idx].longitude + t * (coords[idx + 1].longitude - coords[idx].longitude),
  };
}

/**
 * Map a raw API stop object → normalised Redux stop shape.
 * Works with both getDriverTrips and getCurrentTrip response shapes.
 */
export function mapStop(st, i, total) {
  const store    = st.store ?? {};
  const lat      = parseFloat(store.latitude  ?? st.latitude  ?? 0);
  const lng      = parseFloat(store.longitude ?? st.longitude ?? 0);
  const radius   = parseInt(store.geofence_radius ?? st.geofence_radius ?? 200, 10);

  // Status: backend sends "arrived" / "confirmed" / "pending"
  let status = st.status ?? "pending";
  if (status === "confirmed") status = "completed";

  return {
    id:             st.stop_id ?? st.id,
    store_id:       st.store_id ?? store.id,
    order:          i + 1,
    name:           store.name ?? st.store_name ?? `Stop ${i + 1}`,
    address:        store.address ?? st.address ?? "",
    city:           store.city ?? "",
    latitude:       lat,
    longitude:      lng,
    eta:            st.eta ?? null,
    etaTime:        st.eta
      ? new Date(st.eta).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "—",
    arrived_at:     st.arrived_at ?? null,
    confirmed_at:   st.confirmed_at ?? null,
    status,
    geofenceRadius: isNaN(radius) ? 200 : radius,
    milestonePct:   Math.round(((i + 1) / (total + 1)) * 100),
    storeCode:      store.store_code ?? "",
    storeManager:   store.store_manager ?? null,
  };
}


