import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as KeepAwake from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import {
  setActiveTrip, setStops, setTruckPos,
  setNearStop, pushAlert, confirmStop as confirmStopAction,
} from "../../store/tripSlice";
import { clearAuth } from "../../store/authSlice";
import {
  useGetAllTripsQuery,
  useAcceptTripMutation,
  useSendEmergencyMutation,
  useEndTripMutation,
} from "../../store/driverApi";
import { getSocket } from "../../lib/socket";
import { THEME } from "../../constants/theme";
import { STRINGS } from "../../constants/i18n";
 
// ── Helpers ───────────────────────────────────────────────────────────────
function haversine(a, b) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
 
function interpolateRoute(coords, fraction) {
  if (!coords?.length) return null;
  if (fraction <= 0) return coords[0];
  if (fraction >= 1) return coords[coords.length - 1];
  const maxIdx = coords.length - 1;
  const idx = Math.min(Math.floor(fraction * maxIdx), maxIdx - 1);
  const t = fraction * maxIdx - idx;
  return {
    latitude:
      coords[idx].latitude + t * (coords[idx + 1].latitude - coords[idx].latitude),
    longitude:
      coords[idx].longitude + t * (coords[idx + 1].longitude - coords[idx].longitude),
  };
}
 
// Maps raw API stop → Redux stop shape
function mapStop(st, i, total) {
  return {
    id:             st.stop_id ?? st.id,
    order:          i + 1,
    name:           st.store?.name ?? st.store_name ?? `Stop ${i + 1}`,
    address:        st.store?.address ?? st.address ?? "",
    latitude:       parseFloat(st.store?.latitude  ?? st.latitude  ?? 0),
    longitude:      parseFloat(st.store?.longitude ?? st.longitude ?? 0),
    etaTime:        st.eta
      ? new Date(st.eta).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "—",
    status:         st.status === "confirmed" ? "completed" : st.status ?? "pending",
    geofenceRadius: parseInt(st.store?.geofence_radius ?? 200),
    milestonePct:   Math.round(((i + 1) / (total + 1)) * 100),
  };
}
 
// ── Animated truck marker ─────────────────────────────────────────────────
function AnimatedTruck({ position }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 1100, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 1100, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Marker coordinate={position} anchor={{ x: 0.5, y: 0.5 }}>
      <Animated.View style={[mS.truckMarker, { transform: [{ scale }] }]}>
        <Text style={{ fontSize: 22 }}>🚛</Text>
      </Animated.View>
    </Marker>
  );
}
 
// ── Past trips mini-card ──────────────────────────────────────────────────
function PastTripCard({ trip }) {
  const done = (trip.stops ?? []).filter((s) => s.status === "confirmed").length;
  return (
    <View style={ptS.card}>
      <View style={ptS.cardLeft}>
        <Text style={ptS.tripCode}>{trip.id.slice(0, 8).toUpperCase()}</Text>
        <Text style={ptS.tripDate}>
          {trip.departed_at
            ? new Date(trip.departed_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
            : "—"}
        </Text>
      </View>
      <View style={ptS.cardMid}>
        <Text style={ptS.stops}>{done}/{trip.stops?.length ?? 0} stops</Text>
        <Text style={ptS.addr} numberOfLines={1}>
          {trip.stops?.[0]?.store?.address ?? "—"}
        </Text>
      </View>
      <View style={[ptS.badge, { backgroundColor: trip.status === "in_transit" ? "#dbeafe" : "#f1f5f9" }]}>
        <Text style={[ptS.badgeTxt, { color: trip.status === "in_transit" ? THEME.blue600 : THEME.slate500 }]}>
          {trip.status}
        </Text>
      </View>
    </View>
  );
}
 
// ══════════════════════════════════════════════════════════════════════════
// MAIN HOME SCREEN
// ══════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const insets   = useSafeAreaInsets();
  const dispatch = useDispatch();
  const driver   = useSelector((s) => s.auth.driver);
  const token    = useSelector((s) => s.auth.token);
  const lang     = useSelector((s) => s.auth.lang ?? "en");
  const { stops, nearStopId } = useSelector((s) => s.trip);
  const s = STRINGS[lang];
 
  // ── RTK Query ─────────────────────────────────────────────────────────
  //  const driverId = driver?.id ?? "43f8fa9a-9985-48bc-84df-1a4428b747fc";
  const driverId = "43f8fa9a-9985-48bc-84df-1a4428b747fc"; // demo fallback
  const {
    data: tripsData,
    isLoading: tripsLoading,
    refetch,
  } = useGetAllTripsQuery(driverId, { pollingInterval: 30000 });

  console.log("tripData", tripsData);
  
 
  const [acceptTrip,    { isLoading: accepting }]  = useAcceptTripMutation();
  const [sendEmergency]                             = useSendEmergencyMutation();
  const [endTrip]                                   = useEndTripMutation();
 
  // ── Derive active / scheduled trip from API response ──────────────────
  // Active = upcoming in_transit (driver already accepted)
  const activeTripRaw = tripsData?.upcoming?.find((t) => t.status === "in_transit") ?? null;
  // Scheduled = upcoming scheduled (waiting for acceptance)
  const scheduledTrips = tripsData?.upcoming?.filter((t) => t.status === "scheduled") ?? [];
  const scheduledTrip  = scheduledTrips[0] ?? null;
  const pastTrips      = tripsData?.past ?? [];
 
  const trip    = activeTripRaw;
  const tripId  = trip?.id;
  const isOnTrip    = !!trip;
  const isScheduled = !trip && !!scheduledTrip;
 
  // ── Local state ───────────────────────────────────────────────────────
  const [userLoc,      setUserLoc]     = useState(null);
  const [gpsStatus,    setGpsStatus]   = useState("loading");
  const [fraction,     setFraction]    = useState(0.0);
  const [simSpeed,     setSimSpeed]    = useState(0);
  const [showEmergency, setShowEmg]    = useState(false);
  const [emergencySent, setEmgSent]    = useState(false);
  const [showEndTrip,   setShowEnd]    = useState(false);
  const [acceptingId,   setAcceptingId] = useState(null); // which trip is being accepted
 
  const locationIntervalRef = useRef(null);
  const animIntervalRef     = useRef(null);
  const socketRef           = useRef(null);
  const lastPosRef          = useRef(null);
  const firstPingRef        = useRef(true);
 
  // ── Keep screen awake ─────────────────────────────────────────────────
  useEffect(() => {
    KeepAwake.activateKeepAwakeAsync();
    return () => KeepAwake.deactivateKeepAwake();
  }, []);
 
  // ── Seed Redux stops from active trip ─────────────────────────────────
  useEffect(() => {
    if (!trip?.stops?.length) return;
    const mapped = trip.stops.map((st, i) => mapStop(st, i, trip.stops.length));
    dispatch(setStops(mapped));
    dispatch(setActiveTrip(trip));
  }, [trip?.id, trip?.stops?.length]);
 
  // ── GPS watcher ───────────────────────────────────────────────────────
  useEffect(() => {
    let sub = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setGpsStatus("error"); return; }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          lastPosRef.current = loc;
          setGpsStatus("ok");
        }
      );
    })();
    return () => { sub?.remove(); };
  }, []);
 
  // ── Socket + location streaming (only when on trip) ───────────────────
  useEffect(() => {
    if (!isOnTrip || !tripId || !token) return;
 
    const socket = getSocket(token);
    socketRef.current = socket;
 
    const onConnect = () => socket.emit("join-delivery", { deliveryId: tripId });
    const onLocationUpdate = ({ lat, lng }) => dispatch(setTruckPos({ lat, lng }));
    const onAlert = (data) => {
      dispatch(pushAlert({
        type:     "server_alert",
        severity: "high",
        message:  data.message ?? "Alert from server",
        time:     new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      }));
    };
 
    socket.on("connect",         onConnect);
    socket.on("location-update", onLocationUpdate);
    socket.on("Alert",           onAlert);
 
    // Send location every 10 seconds
    locationIntervalRef.current = setInterval(() => {
      const pos = lastPosRef.current;
      if (!pos) return;
 
      if (firstPingRef.current) {
        // First ping: sets trip status to in_transit on backend
        socket.emit("get-location", { deliveryId: tripId, lat: pos.lat, lng: pos.lng });
        firstPingRef.current = false;
      } else {
        socket.emit("get-updated-location", {
          deliveryId: tripId,
          lat:   pos.lat,
          lng:   pos.lng,
          speed: simSpeed,
        });
      }
 
      // Near-store check (client-side, backup to server geofence alerts)
      stops.filter((st) => st.status === "pending").forEach((stop) => {
        const dist = haversine(pos, { lat: stop.latitude, lng: stop.longitude });
        if (dist < (stop.geofenceRadius ?? 200)) {
          dispatch(setNearStop(stop.id));
        }
      });
    }, 10000);
 
    // Animate truck along route
    animIntervalRef.current = setInterval(() => {
      setFraction((prev) => Math.min(prev + 0.004, 0.95));
      setSimSpeed(50 + Math.floor(Math.random() * 35));
    }, 2000);
 
    return () => {
      clearInterval(locationIntervalRef.current);
      clearInterval(animIntervalRef.current);
      socket.off("connect",         onConnect);
      socket.off("location-update", onLocationUpdate);
      socket.off("Alert",           onAlert);
    };
  }, [isOnTrip, tripId, token]);
 
  // ── Handlers ──────────────────────────────────────────────────────────
  const handleAcceptTrip = async (id) => {
    setAcceptingId(id);
    try {
      await acceptTrip({ trip_id: id }).unwrap();
      firstPingRef.current = true;
      refetch();
    } catch (e) {
      console.error("Accept trip error:", e);
    } finally {
      setAcceptingId(null);
    }
  };
 
  const handleEmergency = async () => {
    setEmgSent(true);
    setShowEmg(false);
    const pos = lastPosRef.current;
    if (tripId && pos) {
      try { await sendEmergency({ trip_id: tripId, lat: pos.lat, lng: pos.lng }).unwrap(); }
      catch {}
    }
    dispatch(pushAlert({
      type: "emergency", severity: "high",
      message: "Emergency alert sent to DC operator.",
      time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    }));
  };
 
  const handleEndTrip = async () => {
    setShowEnd(false);
    if (tripId) {
      try { await endTrip({ trip_id: tripId }).unwrap(); }
      catch {}
    }
    clearInterval(locationIntervalRef.current);
    clearInterval(animIntervalRef.current);
    socketRef.current?.disconnect();
    router.replace("/trip-complete");
  };
 
  // ── Map route data ─────────────────────────────────────────────────────
  // DC coords: not in API, use fallback (you can add dc_lat/dc_lng to API later)
  const dcCoords = { latitude: 18.6298, longitude: 73.7997 };
  const routeCoords = isOnTrip
    ? [dcCoords, ...stops.map((st) => ({ latitude: st.latitude, longitude: st.longitude }))]
    : [];
  const truckMapPos = routeCoords.length > 1 ? interpolateRoute(routeCoords, fraction) : dcCoords;
  const splitIdx    = Math.floor(fraction * Math.max(routeCoords.length - 1, 0));
  const donePath    = routeCoords.slice(0, splitIdx + 1);
  const restPath    = routeCoords.slice(splitIdx);
  const completedStops = stops.filter((st) => st.status === "completed").length;
  const progressPct    = stops.length ? Math.round((completedStops / stops.length) * 100) : 0;
  const nearStop       = nearStopId ? stops.find((st) => st.id === nearStopId && st.status === "pending") : null;
 
  // ══════════════════════════════════════════════════════════════════════
  // RENDER: LOADING
  // ══════════════════════════════════════════════════════════════════════
  if (tripsLoading) {
    return (
      <View style={nS.root}>
        <View style={[nS.topBar, { paddingTop: insets.top + 8 }]}>
          <Text style={nS.topName}>{driver?.name ?? "Fleet Driver"}</Text>
        </View>
        <View style={nS.center}>
          <ActivityIndicator color={THEME.maroon} size="large" />
          <Text style={nS.centerTxt}>Loading your trips…</Text>
        </View>
      </View>
    );
  }
 
  // ══════════════════════════════════════════════════════════════════════
  // RENDER: ACTIVE TRIP → FULL MAP
  // ══════════════════════════════════════════════════════════════════════
  if (isOnTrip) {
    return (
      <View style={mS.root}>
 
        {/* TOP BAR */}
        <View style={[mS.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={mS.topLeft}>
            <View style={mS.topAvatar}><Text style={{ fontSize: 18 }}>🚛</Text></View>
            <View>
              <Text style={mS.topName}>{driver?.name ?? "Driver"}</Text>
              <Text style={mS.topCode}>{tripId?.slice(0, 8).toUpperCase()} · {driver?.truck ?? "—"}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowEnd(true)} style={mS.endBtn}>
            <Text style={mS.endBtnTxt}>{s.end_trip}</Text>
          </TouchableOpacity>
        </View>
 
        {/* EMERGENCY SENT BANNER */}
        {emergencySent && (
          <View style={mS.emergencyBanner}>
            <Text style={mS.emergencyBannerTxt}>🚨 {s.emergency_sent}</Text>
          </View>
        )}
 
        {/* NEAR STORE BANNER */}
        {nearStop && (
          <View style={mS.nearBanner}>
            <View style={{ flex: 1 }}>
              <Text style={mS.nearBannerLabel}>📍 {s.near_store}</Text>
              <Text style={mS.nearBannerStore} numberOfLines={1}>{nearStop.name}</Text>
            </View>
            <TouchableOpacity
              style={mS.nearConfirmBtn}
              onPress={() => {
                dispatch(confirmStopAction(nearStop.id));
                dispatch(setNearStop(null));
              }}
            >
              <Text style={mS.nearConfirmTxt}>✓ Confirm</Text>
            </TouchableOpacity>
          </View>
        )}
 
        {/* PROGRESS BAR WITH MILESTONE DOTS */}
        <View style={mS.progressBarWrap}>
          <View style={mS.progressBg}>
            <View style={[mS.progressFill, { width: `${progressPct}%` }]} />
          </View>
          {stops.map((stop) => (
            <View
              key={stop.id}
              style={[
                mS.milestoneDot,
                { left: `${stop.milestonePct}%` },
                stop.status === "completed" && mS.milestoneDotDone,
              ]}
            />
          ))}
        </View>
 
        {/* MAP */}
        <MapView
          style={mS.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude:      dcCoords.latitude,
            longitude:     dcCoords.longitude,
            latitudeDelta: 0.18,
            longitudeDelta: 0.14,
          }}
          showsUserLocation={false}
        >
          {donePath.length > 1 && (
            <Polyline coordinates={donePath} strokeColor={THEME.green600} strokeWidth={5} />
          )}
          {restPath.length > 1 && (
            <Polyline coordinates={restPath} strokeColor={THEME.blue500} strokeWidth={4} lineDashPattern={[10, 6]} />
          )}
 
          {/* DC */}
          <Marker coordinate={dcCoords} title="Distribution Center">
            <View style={mS.dcMarker}><Text style={{ fontSize: 18 }}>🏭</Text></View>
          </Marker>
 
          {/* Stores */}
          {stops.map((stop) => (
            <Marker
              key={stop.id}
              coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
              title={stop.name}
              description={stop.address}
            >
              <View style={[mS.storeMarker, stop.status === "completed" && mS.storeMarkerDone]}>
                <Text style={{ fontSize: 17 }}>{stop.status === "completed" ? "✅" : "🏪"}</Text>
              </View>
            </Marker>
          ))}
 
          {/* Animated truck */}
          {routeCoords.length > 1 && truckMapPos && (
            <AnimatedTruck position={truckMapPos} />
          )}
 
          {/* Driver GPS dot */}
          {userLoc && (
            <Marker coordinate={userLoc} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={mS.userDot} />
            </Marker>
          )}
        </MapView>
 
        {/* OVERLAYS */}
        <View style={[mS.speedBox, { top: insets.top + 80 }]}>
          <Text style={[mS.speedNum, simSpeed > 80 && { color: THEME.red600 }]}>{simSpeed}</Text>
          <Text style={mS.speedUnit}>km/h</Text>
          {simSpeed > 80 && <Text style={mS.speedWarn}>!</Text>}
        </View>
 
        <View style={[mS.gpsPill, { top: insets.top + 80 }]}>
          <View style={[mS.gpsDot, { backgroundColor: gpsStatus === "ok" ? THEME.green500 : THEME.amber500 }]} />
          <Text style={mS.gpsTxt}>{gpsStatus === "ok" ? "GPS active" : "GPS…"}</Text>
        </View>
 
        <View style={[mS.progressChip, { top: insets.top + 80 }]}>
          <Text style={mS.progressChipTxt}>{completedStops}/{stops.length} stops · {progressPct}%</Text>
        </View>
 
        {/* EMERGENCY BUTTON */}
        <TouchableOpacity
          style={[mS.emergencyBtn, { bottom: insets.bottom + 18 }]}
          onPress={() => setShowEmg(true)}
          activeOpacity={0.9}
        >
          <Text style={mS.emergencyBtnTxt}>🚨  {s.emergency}</Text>
        </TouchableOpacity>
 
        {/* EMERGENCY MODAL */}
        <Modal visible={showEmergency} transparent animationType="slide">
          <View style={mS.modalBg}>
            <View style={mS.modalCard}>
              <View style={mS.modalIconWrap}><Text style={{ fontSize: 44 }}>🚨</Text></View>
              <Text style={mS.modalTitle}>{s.emergency_q}</Text>
              <Text style={mS.modalSub}>Your DC operator will be notified immediately with your GPS location.</Text>
              <TouchableOpacity style={[mS.modalBtn, { backgroundColor: THEME.red600 }]} onPress={handleEmergency}>
                <Text style={mS.modalBtnTxt}>{s.emergency_yes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mS.modalBtn, { backgroundColor: THEME.slate100, marginTop: 8 }]} onPress={() => setShowEmg(false)}>
                <Text style={[mS.modalBtnTxt, { color: THEME.slate700 }]}>{s.emergency_cancel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
 
        {/* END TRIP MODAL */}
        <Modal visible={showEndTrip} transparent animationType="slide">
          <View style={mS.modalBg}>
            <View style={mS.modalCard}>
              <View style={mS.modalIconWrap}><Text style={{ fontSize: 44 }}>🏁</Text></View>
              <Text style={mS.modalTitle}>{s.end_trip_q}</Text>
              <Text style={mS.modalSub}>All deliveries will be marked as complete.</Text>
              <TouchableOpacity style={[mS.modalBtn, { backgroundColor: THEME.maroon }]} onPress={handleEndTrip}>
                <Text style={mS.modalBtnTxt}>{s.end_trip_yes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[mS.modalBtn, { backgroundColor: THEME.slate100, marginTop: 8 }]} onPress={() => setShowEnd(false)}>
                <Text style={[mS.modalBtnTxt, { color: THEME.slate700 }]}>{s.cancel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }
 
  // ══════════════════════════════════════════════════════════════════════
  // RENDER: NO ACTIVE TRIP — dashboard with scheduled + past trips
  // ═══════════════════s═══════════════════════════════════════════════════
  return (
    <View style={nS.root}>
 
      {/* TOP BAR */}
      <View style={[nS.topBar, { paddingTop: insets.top + 8 }]}>
        <View style={nS.topLeft}>
          <View style={nS.avatar}>
            <Text style={nS.avatarTxt}>{(driver?.name ?? "D")[0]}</Text>
          </View>
          <View>
            <Text style={nS.topName}>{driver?.name ?? "Driver"}</Text>
            <Text style={nS.topSub}>{driver?.truck ?? "No truck assigned"}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={refetch} style={nS.iconBtn}>
            <Text style={{ fontSize: 16 }}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { dispatch(clearAuth()); router.replace("/"); }}
            style={nS.logoutBtn}
          >
            <Text style={nS.logoutTxt}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
 
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
 
        {/* GPS STATUS CARD */}
        <View style={nS.gpsCard}>
          <View style={[nS.gpsDot, { backgroundColor: gpsStatus === "ok" ? THEME.green500 : THEME.amber500 }]} />
          <Text style={nS.gpsTxt}>
            {gpsStatus === "ok" ? "GPS active — tracking ready" : "Acquiring GPS signal…"}
          </Text>
        </View>
 
        {/* ── SCHEDULED TRIPS (ready to accept) ── */}
        {scheduledTrips.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={nS.sectionHeader}>
              <Text style={nS.sectionTitle}>Assigned Trips</Text>
              <View style={nS.sectionBadge}>
                <Text style={nS.sectionBadgeTxt}>{scheduledTrips.length}</Text>
              </View>
            </View>
 
            {scheduledTrips.map((t) => {
              const stopsCount = t.stops?.length ?? 0;
              const isAccepting = acceptingId === t.id;
              return (
                <View key={t.id} style={aS.assignCard}>
                  {/* Header row */}
                  <View style={aS.cardHeader}>
                    <View style={aS.cardHeaderLeft}>
                      <Text style={aS.assignEmoji}>📦</Text>
                      <View>
                        <Text style={aS.assignLabel}>NEW TRIP</Text>
                        <Text style={aS.assignCode}>{t.id.slice(0, 8).toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={aS.scheduledPill}>
                      <Text style={aS.scheduledPillTxt}>Scheduled</Text>
                    </View>
                  </View>
 
                  {/* Stats row */}
                  <View style={aS.statsRow}>
                    {[
                      { icon: "📅", label: "Departs", value: t.departed_at ? new Date(t.departed_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—" },
                      { icon: "🏪", label: "Stops",   value: `${stopsCount} store${stopsCount !== 1 ? "s" : ""}` },
                    ].map(({ icon, label, value }) => (
                      <View key={label} style={aS.statCell}>
                        <Text style={aS.statIcon}>{icon}</Text>
                        <Text style={aS.statLabel}>{label}</Text>
                        <Text style={aS.statValue}>{value}</Text>
                      </View>
                    ))}
                  </View>
 
                  {/* Stops preview */}
                  {t.stops?.length > 0 && (
                    <View style={aS.stopsPreview}>
                      {t.stops.map((stop, i) => (
                        <View key={stop.stop_id ?? i} style={[aS.stopPreviewRow, i > 0 && { borderTopWidth: 1, borderTopColor: THEME.slate100 }]}>
                          <View style={aS.stopPreviewNum}>
                            <Text style={aS.stopPreviewNumTxt}>{i + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={aS.stopPreviewName} numberOfLines={1}>
                              {stop.store?.name ?? `Stop ${i + 1}`}
                            </Text>
                            <Text style={aS.stopPreviewAddr} numberOfLines={1}>
                              {stop.store?.address ?? "—"}
                            </Text>
                          </View>
                          <Text style={aS.stopPreviewEta}>
                            {stop.eta ? new Date(stop.eta).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
 
                  {/* Accept button */}
                  <TouchableOpacity
                    style={[aS.acceptBtn, isAccepting && { opacity: 0.7 }]}
                    onPress={() => handleAcceptTrip(t.id)}
                    disabled={isAccepting}
                    activeOpacity={0.88}
                  >
                    {isAccepting ? (
                      <ActivityIndicator color={THEME.white} />
                    ) : (
                      <>
                        <Text style={{ fontSize: 18, color: THEME.white }}>✓</Text>
                        <Text style={aS.acceptBtnTxt}>{s.accept_trip}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
 
        {/* ── NO TRIPS AT ALL ── */}
        {scheduledTrips.length === 0 && pastTrips.length === 0 && (
          <View style={nS.emptyCard}>
            <Text style={nS.emptyEmoji}>🚛</Text>
            <Text style={nS.emptyTitle}>{s.no_trip}</Text>
            <Text style={nS.emptySub}>{s.no_trip_sub}</Text>
            <TouchableOpacity style={nS.refreshBtn} onPress={refetch}>
              <Text style={nS.refreshBtnTxt}>🔄  Refresh</Text>
            </TouchableOpacity>
          </View>
        )}
 
        {/* ── PAST TRIPS ── */}
        {pastTrips.length > 0 && (
          <View>
            <View style={nS.sectionHeader}>
              <Text style={nS.sectionTitle}>Past Trips</Text>
              <View style={[nS.sectionBadge, { backgroundColor: THEME.slate100 }]}>
                <Text style={[nS.sectionBadgeTxt, { color: THEME.slate600 }]}>{pastTrips.length}</Text>
              </View>
            </View>
            {pastTrips.map((t) => (
              <PastTripCard key={t.id} trip={t} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
 
 
// ═══════════════════════════════════
// STYLES
// ═══════════════════════════════════
 
// No-trip / dashboard styles
const nS = StyleSheet.create({
  root:          { flex: 1, backgroundColor: THEME.slate50 },
  topBar:        { backgroundColor: THEME.maroon, paddingHorizontal: 18, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topLeft:       { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar:        { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  avatarTxt:     { color: THEME.white, fontSize: 18, fontWeight: "800" },
  topName:       { color: THEME.white, fontSize: 15, fontWeight: "800" },
  topSub:        { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "monospace" },
  iconBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  logoutBtn:     { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  logoutTxt:     { color: THEME.white, fontSize: 13, fontWeight: "600" },
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  centerTxt:     { color: THEME.slate500, fontSize: 14, marginTop: 14 },
  gpsCard:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: THEME.white, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 20, borderWidth: 1, borderColor: THEME.slate100 },
  gpsDot:        { width: 10, height: 10, borderRadius: 5 },
  gpsTxt:        { fontSize: 13, fontWeight: "600", color: THEME.slate700 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: "800", color: THEME.slate900 },
  sectionBadge:  { backgroundColor: "#fef9ec", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  sectionBadgeTxt:{ fontSize: 12, fontWeight: "700", color: "#92400e" },
  emptyCard:     { backgroundColor: THEME.white, borderRadius: 24, padding: 40, alignItems: "center", marginBottom: 24, elevation: 2, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  emptyEmoji:    { fontSize: 64, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: "800", color: THEME.slate900, marginBottom: 8 },
  emptySub:      { fontSize: 14, color: THEME.slate500, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  refreshBtn:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: THEME.slate100, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 14 },
  refreshBtnTxt: { color: THEME.slate700, fontSize: 14, fontWeight: "700" },
});
 
// Accept card styles
const aS = StyleSheet.create({
  assignCard:      { backgroundColor: THEME.white, borderRadius: 22, marginBottom: 16, overflow: "hidden", elevation: 4, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  cardHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18, backgroundColor: "#fef9ec", borderBottomWidth: 1, borderBottomColor: "#fde68a" },
  cardHeaderLeft:  { flexDirection: "row", alignItems: "center", gap: 12 },
  assignEmoji:     { fontSize: 30 },
  assignLabel:     { fontSize: 10, fontWeight: "700", color: "#92400e", letterSpacing: 1.5 },
  assignCode:      { fontSize: 18, fontWeight: "900", color: THEME.slate900, fontFamily: "monospace", marginTop: 2 },
  scheduledPill:   { backgroundColor: THEME.slate100, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  scheduledPillTxt:{ fontSize: 11, fontWeight: "700", color: THEME.slate600 },
  statsRow:        { flexDirection: "row", padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: THEME.slate100 },
  statCell:        { flex: 1, backgroundColor: THEME.slate50, borderRadius: 14, padding: 12, alignItems: "center" },
  statIcon:        { fontSize: 20, marginBottom: 4 },
  statLabel:       { fontSize: 10, fontWeight: "600", color: THEME.slate400, textTransform: "uppercase", letterSpacing: 0.8 },
  statValue:       { fontSize: 13, fontWeight: "700", color: THEME.slate800, textAlign: "center", marginTop: 2 },
  stopsPreview:    { marginHorizontal: 16, marginBottom: 8, backgroundColor: THEME.slate50, borderRadius: 14, overflow: "hidden" },
  stopPreviewRow:  { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  stopPreviewNum:  { width: 24, height: 24, borderRadius: 12, backgroundColor: THEME.maroon, alignItems: "center", justifyContent: "center" },
  stopPreviewNumTxt: { color: THEME.white, fontSize: 11, fontWeight: "800" },
  stopPreviewName: { fontSize: 13, fontWeight: "600", color: THEME.slate800 },
  stopPreviewAddr: { fontSize: 11, color: THEME.slate500, marginTop: 1 },
  stopPreviewEta:  { fontSize: 11, color: THEME.slate400, fontFamily: "monospace" },
  acceptBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, margin: 16, paddingVertical: 17, borderRadius: 18, backgroundColor: THEME.maroon, elevation: 6, shadowColor: THEME.maroon, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  acceptBtnTxt:    { color: THEME.white, fontSize: 17, fontWeight: "800" },
});
 
// Past trip card styles
const ptS = StyleSheet.create({
  card:     { backgroundColor: THEME.white, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: THEME.slate100 },
  cardLeft: { alignItems: "center", minWidth: 52 },
  tripCode: { fontSize: 12, fontWeight: "800", color: THEME.slate700, fontFamily: "monospace" },
  tripDate: { fontSize: 11, color: THEME.slate400, marginTop: 3 },
  cardMid:  { flex: 1 },
  stops:    { fontSize: 13, fontWeight: "700", color: THEME.slate800 },
  addr:     { fontSize: 12, color: THEME.slate400, marginTop: 2 },
  badge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});
 
// Map styles
const mS = StyleSheet.create({
  root:              { flex: 1, backgroundColor: THEME.slate900 },
  topBar:            { backgroundColor: THEME.maroon, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topLeft:           { flexDirection: "row", alignItems: "center", gap: 12 },
  topAvatar:         { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  topName:           { color: THEME.white, fontSize: 15, fontWeight: "800" },
  topCode:           { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "monospace" },
  endBtn:            { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  endBtnTxt:         { color: THEME.white, fontSize: 13, fontWeight: "600" },
  progressBarWrap:   { height: 6, backgroundColor: THEME.slate100, position: "relative", overflow: "visible" },
  progressBg:        { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: THEME.slate100 },
  progressFill:      { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: THEME.green500, borderRadius: 3 },
  milestoneDot:      { position: "absolute", top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: THEME.slate300, borderWidth: 2, borderColor: THEME.white, marginLeft: -6 },
  milestoneDotDone:  { backgroundColor: THEME.green600 },
  emergencyBanner:   { backgroundColor: THEME.red600, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center" },
  emergencyBannerTxt:{ color: THEME.white, fontSize: 13, fontWeight: "700" },
  nearBanner:        { backgroundColor: THEME.green600, paddingVertical: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  nearBannerLabel:   { color: THEME.white, fontSize: 12, fontWeight: "700" },
  nearBannerStore:   { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600", marginTop: 1 },
  nearConfirmBtn:    { backgroundColor: THEME.white, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  nearConfirmTxt:    { color: THEME.green700, fontSize: 13, fontWeight: "800" },
  map:               { flex: 1 },
  truckMarker:       { backgroundColor: THEME.maroon, width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: THEME.white, elevation: 10, shadowColor: THEME.maroon, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  dcMarker:          { backgroundColor: "#1e3a8a", width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: THEME.white, elevation: 6 },
  storeMarker:       { backgroundColor: THEME.green700, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: THEME.white, elevation: 4 },
  storeMarkerDone:   { backgroundColor: THEME.green500, opacity: 0.75 },
  userDot:           { width: 16, height: 16, borderRadius: 8, backgroundColor: THEME.sky500, borderWidth: 3, borderColor: THEME.white, elevation: 4 },
  speedBox:          { position: "absolute", right: 12, backgroundColor: THEME.white, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  speedNum:          { fontSize: 24, fontWeight: "900", color: THEME.slate900 },
  speedUnit:         { fontSize: 11, color: THEME.slate400 },
  speedWarn:         { fontSize: 12, fontWeight: "900", color: THEME.red600, marginTop: 1 },
  gpsPill:           { position: "absolute", left: 12, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: THEME.white, elevation: 4 },
  gpsDot:            { width: 8, height: 8, borderRadius: 4 },
  gpsTxt:            { fontSize: 11, fontWeight: "600", color: THEME.slate700 },
  progressChip:      { position: "absolute", alignSelf: "center", left: "50%", marginLeft: -65, backgroundColor: THEME.white, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, elevation: 4 },
  progressChipTxt:   { fontSize: 11, fontWeight: "700", color: THEME.slate700 },
  emergencyBtn:      { position: "absolute", left: 16, right: 16, backgroundColor: THEME.red600, paddingVertical: 17, borderRadius: 22, alignItems: "center", elevation: 10, shadowColor: THEME.red600, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  emergencyBtnTxt:   { color: THEME.white, fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  modalBg:           { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard:         { backgroundColor: THEME.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 44, alignItems: "center" },
  modalIconWrap:     { width: 80, height: 80, borderRadius: 40, backgroundColor: THEME.slate100, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  modalTitle:        { fontSize: 20, fontWeight: "900", color: THEME.slate900, marginBottom: 8, textAlign: "center" },
  modalSub:          { fontSize: 13, color: THEME.slate500, marginBottom: 28, textAlign: "center", lineHeight: 20 },
  modalBtn:          { width: "100%", paddingVertical: 17, borderRadius: 18, alignItems: "center" },
  modalBtnTxt:       { color: THEME.white, fontSize: 16, fontWeight: "800" },
});