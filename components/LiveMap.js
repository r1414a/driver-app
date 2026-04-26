import Mapbox from "@rnmapbox/maps";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { THEME } from "../constants/theme";

 
// FIX: Call setAccessToken at module load time — before any component mounts.
// Calling it inside useEffect or component body causes a race condition on
// physical devices (emulators tolerate it because they're slower to render).
const MAPBOX_TOKEN = "public";
// const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_API;
if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN);
} else {
  console.warn("[LiveMap] EXPO_PUBLIC_MAPBOX_API is not set — map will not render");
}
 
// Split a route array into completed (up to truckIdx) and remaining portions
function splitRoute(coords, truckIdx) {
  if (!coords?.length) return { done: [], rest: [] };
  const idx = Math.max(0, Math.min(truckIdx, coords.length - 1));
  return {
    done: coords.slice(0, idx + 1),
    rest: coords.slice(idx),
  };
}
 
// Find index of route point closest to truck position
function closestIndex(coords, pos) {
  if (!coords?.length || !pos) return 0;
  let best = 0, bestD = Infinity;
  coords.forEach((c, i) => {
    const d = (c.latitude - pos.latitude) ** 2 + (c.longitude - pos.longitude) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}
 
// Mapbox needs coordinates as [longitude, latitude] arrays
function toMapbox(coords) {
  return coords.map((c) => [c.longitude, c.latitude]);
}
 
export default function LiveMap({ routeCoords, truckPosition, stops, dcCoords }) {
  const cameraRef = useRef(null);

  const lastIndexRef = useRef(0);

  useEffect(() => {
  lastIndexRef.current = 0;
}, [routeCoords]);

function getProgressIndex(coords, pos) {
  if (!coords?.length || !pos) return 0;

  let best = lastIndexRef.current;
  let bestD = Infinity;

  // small backward window to handle GPS jitter
  const start = Math.max(0, lastIndexRef.current - 10);

  for (let i = start; i < coords.length; i++) {
    const c = coords[i];
    const d =
      (c.latitude - pos.latitude) ** 2 +
      (c.longitude - pos.longitude) ** 2;

    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }

  lastIndexRef.current = best;
  return best;
}
 
  // Animate camera to follow truck whenever position updates
  useEffect(() => {
    if (!truckPosition || !cameraRef.current) return;
    cameraRef.current.setCamera({
      centerCoordinate: [truckPosition.longitude, truckPosition.latitude],
      zoomLevel: 14,
      animationDuration: 800,
      animationMode: "easeTo",
    });
  }, [truckPosition?.latitude, truckPosition?.longitude]);
 
  // Don't render map at all until we have a valid truck position
  // This prevents the black screen on physical devices
  if (!truckPosition || !dcCoords) {
    return (
      <View style={S.placeholder}>
        <Text style={S.placeholderEmoji}>📍</Text>
        <Text style={S.placeholderTxt}>Waiting for GPS fix…</Text>
      </View>
    );
  }
 
  const splitIdx = getProgressIndex(routeCoords, truckPosition);
  // const splitIdx = closestIndex(routeCoords, truckPosition);
  const { done, rest } = splitRoute(routeCoords, splitIdx);
  const safeDone =
  done.length === 1 ? [done[0], done[0]] : done;
 
  const truckCoord = [truckPosition.longitude, truckPosition.latitude];
  const dcCoord    = [dcCoords.longitude, dcCoords.latitude];
  const shapeKey = `${splitIdx}-${routeCoords.length}`;
 
  return (
    // FIX: explicit width + height, not just flex:1
    // On some physical Android devices flex:1 inside a View that has
    // position:absolute siblings collapses to 0 height
    <View style={S.container}>
      <Mapbox.MapView
        style={S.map}
        styleURL="mapbox://styles/mapbox/streets-v12"
        logoEnabled={false}
        compassEnabled={true}
        scaleBarEnabled={false}
        attributionEnabled={false}
      >
        {/* Camera — controlled imperatively via ref for smooth following */}
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={14}
          centerCoordinate={truckCoord}
          animationMode="easeTo"
          animationDuration={800}
        />
 
        {/* Completed route — green solid */}
        {done.length > 1 && (
          <Mapbox.ShapeSource
          key={`done-${shapeKey}`}
            id="doneRoute"
            shape={{
              type: "Feature",
              geometry: { type: "LineString", coordinates: toMapbox(safeDone) },
              properties: {},
            }}
          >
            <Mapbox.LineLayer
              id="doneLine"
              style={{
                lineColor: THEME.green600,
                lineWidth: 5,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </Mapbox.ShapeSource>
        )}
 
        {/* Remaining route — blue dashed */}
        {rest.length > 1 && (
          <Mapbox.ShapeSource
          key={`rest-${shapeKey}`}
            id="restRoute"
            shape={{
              type: "Feature",
              geometry: { type: "LineString", coordinates: toMapbox(rest) },
              properties: {},
            }}
          >
            <Mapbox.LineLayer
              id="restLine"
              style={{
                lineColor: THEME.blue500,
                lineWidth: 4,
                lineCap: "round",
                lineJoin: "round",
                lineDasharray: [2, 2],
              }}
            />
          </Mapbox.ShapeSource>
        )}
 
        {/* DC marker */}
        <Mapbox.PointAnnotation id="dc-marker" coordinate={dcCoord}>
          {/* FIX: PointAnnotation child MUST be a View with explicit size.
              Bare Text or emoji crashes silently on physical Android devices. */}
          <View style={S.markerDC}>
            <Text style={S.markerEmoji}>🏭</Text>
          </View>
        </Mapbox.PointAnnotation>
 
        {/* Store stop markers */}
        {(stops ?? []).map((stop, i) => {
          const lat = parseFloat(stop.store?.latitude ?? stop.latitude ?? 0);
          const lng = parseFloat(stop.store?.longitude ?? stop.longitude ?? 0);
          if (!lat || !lng) return null;
          const isDone = stop.status === "confirmed" || stop.status === "completed";
          return (
            <Mapbox.PointAnnotation
              key={`stop-${stop.stop_id ?? stop.id ?? i}`}
              id={`stop-${stop.stop_id ?? stop.id ?? i}`}
              coordinate={[lng, lat]}
            >
              {/* FIX: explicit sized View required for physical devices */}
              <View style={[S.markerStore, isDone && S.markerStoreDone]}>
                <Text style={S.markerEmoji}>{isDone ? "✅" : "🏪"}</Text>
              </View>
            </Mapbox.PointAnnotation>
          );
        })}
 
        {/* Truck marker — always rendered last (top layer) */}
        <Mapbox.PointAnnotation id="truck-marker" coordinate={truckCoord}>
          {/* FIX: explicit sized View required */}
          <View style={S.markerTruck}>
            <Text style={S.markerEmoji}>🚛</Text>
          </View>
        </Mapbox.PointAnnotation>
 
      </Mapbox.MapView>
    </View>
  );
}
 
const S = StyleSheet.create({
  // FIX: use absolute fill + explicit dimensions so it never collapses
  container:        { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  map:              { flex: 1 },
  // FIX: All marker Views MUST have explicit width + height
  // PointAnnotation measures its child — if size is 0 it renders nothing on device
  markerTruck:      { width: 44, height: 44, borderRadius: 22, backgroundColor: THEME.maroon, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", elevation: 8 },
  markerDC:         { width: 38, height: 38, borderRadius: 19, backgroundColor: "#1e3a8a",    alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: "#fff", elevation: 6 },
  markerStore:      { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.green700, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: "#fff", elevation: 4 },
  markerStoreDone:  { backgroundColor: THEME.green500, opacity: 0.85 },
  markerEmoji:      { fontSize: 18 },
  placeholder:      { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" },
  placeholderEmoji: { fontSize: 40, marginBottom: 12 },
  placeholderTxt:   { fontSize: 14, color: "#64748b", fontWeight: "600" },
});