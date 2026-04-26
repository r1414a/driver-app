import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// import MapView, { Marker, Polyline, PROVIDER_GOOGLE, AnimatedRegion } from "react-native-maps";
import * as Location from "expo-location";
import * as KeepAwake from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import {
  setActiveTrip,
  setStops,
  setTruckPos,
  setNearStop,
  pushAlert,
  confirmStop as confirmStopAction,
} from "../../store/tripSlice";
import { clearAuth } from "../../store/authSlice";
import {
  useGetAllTripsQuery,
  useAcceptTripMutation,
  useSendEmergencyMutation,
  useEndTripMutation,
  useGetActiveTripQuery,
} from "../../store/driverApi";
import { getSocket } from "../../lib/socket";
import { THEME } from "../../constants/theme";
import { STRINGS } from "../../constants/i18n";
import { format, parseISO, subMinutes, isBefore } from "date-fns";
import { TRUCK_TYPE } from "../../constants/constants";
import { haversine, mapStop } from "../../lib/tripHelpers";
import { RefreshControl } from "react-native-gesture-handler";
import LiveMap from "../../components/LiveMap";
import { sendLocalNotification } from "../../lib/notificationRequest";

const parseGeoPath = (geoPathString) => {
  try {
    const arr = JSON.parse(geoPathString);

    return arr.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
  } catch (e) {
    console.error("Invalid geopath", e);
    return [];
  }
};

// ── Past trips mini-card ──────────────────────────────────────────────────
function PastTripCard({ trip }) {
  const done = (trip.stops ?? []).filter(
    (s) => s.status === "confirmed",
  ).length;
  return (
    <View style={ptS.card}>
      <View style={ptS.cardLeft}>
        <Text style={ptS.tripCode}>{trip.tracking_code.toUpperCase()}</Text>

        <Text style={ptS.tripDate}>{format(trip.departed_at, "MMM d")}</Text>
        <Text style={ptS.tripDate}>
          {format(trip.departed_at, "'at' h:mm a")}
        </Text>
      </View>
      <View style={ptS.cardMid}>
        <Text style={ptS.stops}>
          {done}/{trip.stops?.length ?? 0} stops
        </Text>
        <Text style={ptS.addr}>{trip.stops?.[0]?.store?.address ?? "—"}</Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text
          style={{ color: THEME.slate700, fontSize: 12, fontWeight: "600" }}
        >
          {trip.truck_no}
        </Text>
        <View
          style={[
            ptS.badge,
            {
              backgroundColor:
                trip.status === "in_transit" ? "#dbeafe" : "#f1f5f9",
            },
          ]}
        >
          <Text
            style={[
              ptS.badgeTxt,
              {
                color:
                  trip.status === "in_transit" ? THEME.blue600 : THEME.slate500,
              },
            ]}
          >
            {trip.status}
          </Text>
        </View>
      </View>
    </View>
  );
}

function getClosestIndex(route, pos) {
  if (!route.length || !pos) return 0;

  let minDist = Infinity;
  let index = 0;

  route.forEach((point, i) => {
    const d =
      Math.pow(point.latitude - pos.latitude, 2) +
      Math.pow(point.longitude - pos.longitude, 2);

    if (d < minDist) {
      minDist = d;
      index = i;
    }
  });

  return index;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN HOME SCREEN
// ══════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const driver = useSelector((s) => s.auth.driver);
  const token = useSelector((s) => s.auth.token);
  const lang = useSelector((s) => s.auth.lang ?? "en");
  const truckPosition = useSelector((s) => s.trip.truckPos);
  const { stops, nearStopId } = useSelector((s) => s.trip);
  const s = STRINGS[lang];

  // ── RTK Query ─────────────────────────────────────────────────────────
  //  const driverId = driver?.id ?? "43f8fa9a-9985-48bc-84df-1a4428b747fc";
  const driverId = "43f8fa9a-9985-48bc-84df-1a4428b747fc"; // demo fallback

  // ── RTK Query ────────────────────────────────────────────────────────
  const {
    data: tripsData,
    isLoading: tripsLoading,
    isFetching,
    refetch: refetchAll,
  } = useGetAllTripsQuery(driverId, {
    pollingInterval: 30000,
    // skip: !driverId,
  });

  const { data: activeTripData, refetch: refetchActive } =
    useGetActiveTripQuery(driverId, {
      pollingInterval: 15000,
      // skip: !driverId,
    });

  // console.log("getAllTrip", tripsData);
  // console.log("getActivetrip", activeTripData);

  const [acceptTrip, { isLoading: accepting }] = useAcceptTripMutation();
  const [sendEmergency] = useSendEmergencyMutation();
  const [endTrip] = useEndTripMutation();

  // ── Derive active / scheduled trip from API response ──────────────────

  // ── Derive trip state ────────────────────────────────────────────────
  // Priority: use activeTripData (dedicated endpoint) for the running trip
  // Fall back to tripsData?.upcoming in_transit if activeTripData is null
  const trip =
    activeTripData ??
    tripsData?.upcoming?.find((t) => t.status === "in_transit") ??
    null;

  // console.log("HELLOEOEONO", process.env.EXPO_PUBLIC_API_URL);

  const tripId = trip?.id;
  const isOnTrip = !!trip;
  const scheduledTrips =
    tripsData?.upcoming?.filter((t) => t.status === "scheduled") ?? [];
  const pastTrips = tripsData?.past ?? [];

  // ── Local state ───────────────────────────────────────────────────────
  const [userLoc, setUserLoc] = useState(null);
  const [gpsStatus, setGpsStatus] = useState("loading");
  // full [{lat,lng}] from Mapbox
  const [showEmergency, setShowEmg] = useState(false);
  const [emergencySent, setEmgSent] = useState(false);
  const [showEndTrip, setShowEnd] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null); // which trip is being accepted
  const [routeCoords, setRouteCoords] = useState([]);

  const locationSubRef = useRef(null);
  const locationTimerRef = useRef(null);
  const socketRef = useRef(null);
  const lastPosRef = useRef(null);
  // const firstPingRef = useRef(true);
  const mapRef = useRef(null);
  // const [truckPosition, setTruckPosition] = useState(null);


  // console.log("user location", userLoc, trip?.stops);

  // console.log("ROUTE:", routeCoords.length, routeCoords, dcCoords);

  // ── Keep screen awake ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOnTrip) return;
    KeepAwake.activateKeepAwakeAsync();
    return () => KeepAwake.deactivateKeepAwake();
  }, [isOnTrip]);

  // ── Seed Redux stops from active trip ─────────────────────────────────
  useEffect(() => {
    if (!trip?.stops?.length) return;
    const mapped = trip.stops.map((st, i) => mapStop(st, i, trip.stops.length));
    dispatch(setStops(mapped));
    dispatch(setActiveTrip(trip));
  }, [trip?.id, trip?.stops?.length]);

  // ── Fetch Mapbox route whenever trip or stops change ───────────────────
  useEffect(() => {
    if (!isOnTrip || !trip?.stops?.length) return;
    const wholeRouteCoords = parseGeoPath(trip?.geopath);

    setRouteCoords(wholeRouteCoords);
  }, [trip?.id, isOnTrip, trip?.geopath]);

  // ── GPS watcher ───────────────────────────────────────────────────────
  useEffect(() => {
    let sub = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsStatus("error");
        return;
      }
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          // const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLoc(coords);
          lastPosRef.current = {
            latitude: coords.latitude,
            longitude: coords.longitude,
          };
          dispatch(
            setTruckPos({
              latitude: coords.latitude,
              longitude: coords.longitude,
            }),
          );
          setGpsStatus("ok");
        },
      );
      locationSubRef.current = sub;
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  useEffect(() => {
    if (!userLoc || !mapRef.current) return;

    mapRef.current.animateCamera({
      center: userLoc,
      zoom: 15,
    });
  }, [userLoc]);

  // ── Socket + location streaming (only when on trip) ───────────────────
  useEffect(() => {
    if (!isOnTrip || !tripId) return;
    // if (!isOnTrip || !tripId || !token) return;

    const socket = getSocket(token);
    socketRef.current = socket;

    const onConnect = () => {
      console.log("[Socket] Joining delivery", tripId);
      socket.emit("join-delivery", { deliveryId: tripId });
    };

    const onJoined = (data) => {
      console.log("[Socket] Joined:", data.message);
    };

    const onLocationUpdate = ({ lat, lng }) => {
      dispatch(setTruckPos({
        latitude: lat,
  longitude: lng,
      }));
    };

    const onAlert = async (data) => {
      // console.log("ALERTS COMING", data);
      
      const message = data.message ?? "Alert from server";

      dispatch(
        pushAlert({
          type: "server_alert",
          severity: "high",
          message,
          time: new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }),
      );

      await sendLocalNotification("🚨 Fleet Alert", message)
    };

    socket.on("connect", onConnect);
    socket.on("joined-successfully", onJoined);
    socket.on("location-update", onLocationUpdate);
    socket.on("Alert", onAlert);

    // If already connected, join immediately
    if (socket.connected) onConnect();

    // Send real GPS location every 10 seconds
    locationTimerRef.current = setInterval(() => {
      const pos = lastPosRef.current;
      if (!pos) return;

      const payload = {
        deliveryId: tripId,
        lat: pos.latitude,
        lng: pos.longitude,
        // speed: simSpeed,
      };

      socket.emit("get-updated-location", payload);

      // Client-side geofence check (backup)
      stops
        .filter((st) => st.status === "pending")
        .forEach((stop) => {
          const dist = haversine(
            { latitude: pos.latitude, longitude: pos.longitude },
            { latitude: stop.latitude, longitude: stop.longitude },
          );
          if (dist <= (stop.geofenceRadius ?? 200)) {
            dispatch(setNearStop(stop.id));
          }
        });
    }, 10000);

    return () => {
      clearInterval(locationTimerRef.current);
      socket.off("connect", onConnect);
      socket.off("joined-successfully", onJoined);
      socket.off("location-update", onLocationUpdate);
      socket.off("Alert", onAlert);
    };
  }, [isOnTrip, tripId, token]);

  // ── Cleanup socket on trip end / logout ─────────────────────────────
  useEffect(() => {
    if (!isOnTrip) {
      clearInterval(locationTimerRef.current);
    }
  }, [isOnTrip]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleAcceptTrip = async (id) => {
    setAcceptingId(id);
    try {
      await acceptTrip({ trip_id: id }).unwrap();
      // firstPingRef.current = true;
      // Refetch both queries to pick up the now-in_transit trip
      await Promise.all([refetchAll(), refetchActive()]);
    } catch (e) {
      console.error("[AcceptTrip]");
    } finally {
      setAcceptingId(null);
    }
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const handleEmergency = async () => {
    setEmgSent(true);
    setShowEmg(false);
    const pos = lastPosRef.current;
    if (tripId && pos) {
      try {
        await sendEmergency({
          trip_id: tripId,
          lat: pos.latitude,
          lng: pos.longitude,
        }).unwrap();
      } catch {
        console.error("[Emergency]");
      }
    }
    dispatch(
      pushAlert({
        type: "emergency",
        severity: "high",
        message: "Emergency alert sent to DC operator.",
        time: new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }),
    );
  };

  const handleEndTrip = async () => {
    setShowEnd(false);
    if (tripId) {
      try {
        await endTrip({ trip_id: tripId }).unwrap();
      } catch (e) {
        console.error("[EndTrip]", e);
      }
    }
    clearInterval(locationTimerRef.current);
    disconnectSocket();
    dispatch(clearTrip ? clearTrip() : setActiveTrip(null));
    await Promise.all([refetchAll(), refetchActive()]);
    router.replace("/trip-complete");
  };

  const handleConfirmNearStop = useCallback(
    async (stop) => {
      dispatch(confirmStopAction(stop.id));
      dispatch(setNearStop(null));
      // Also call the API to persist
      try {
        // We need stop_id and trip_id
        // confirmStop mutation is available via the hook at the stop list level
        // For simplicity emit via socket and trust server-side update
      } catch (e) {
        console.error("[ConfirmStop]", e);
      }
    },
    [dispatch],
  );

  // ── Map route data ─────────────────────────────────────────────────────
  // DC coords: not in API, use fallback (you can add dc_lat/dc_lng to API later)

  const dcCoords = trip?.dc
    ? {
        latitude: parseFloat(trip.dc.latitude),
        longitude: parseFloat(trip.dc.longitude),
      }
    : { latitude: 45.6298, longitude: 73.7997 }; // fallback

  const truckMapPos = userLoc || dcCoords;

  console.log("truckMapPos", truckMapPos, dcCoords);

  // Split route into green (done) + blue-dashed (remaining)

  // const splitIndex = getClosestIndex(routeCoords, truckPosition);

  // const doneCoords = routeCoords.slice(0, splitIndex + 1);
  // const remainingCoords = routeCoords.slice(splitIndex);

  const completedStops = stops.filter(
    (st) => st.status === "confirmed" || st.status === "completed",
  ).length;
  const progressPct = stops.length
    ? Math.round((completedStops / stops.length) * 100)
    : 0;
  const nearStop = nearStopId
    ? stops.find((st) => st.id === nearStopId && st.status === "pending")
    : null;
  // const speedOverLimit = speed > (trip?.speed_threshold ?? 80);

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
            <View style={mS.topAvatar}>
              <Text style={{ fontSize: 18 }}>🚛</Text>
            </View>
            <View>
              <Text style={mS.topName}>{driver?.name ?? "Driver"}</Text>
              <Text style={mS.topCode}>
                {trip?.tracking_code ?? ""} ·{" "}
                {trip?.truck?.registration_no ?? driver?.truck ?? "—"}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowEnd(true)} style={mS.endBtn}>
            <Text style={mS.endBtnTxt}>{s.end_trip ?? "End Trip"}</Text>
          </TouchableOpacity>
        </View>

        {/* EMERGENCY BANNER */}
        {emergencySent && (
          <View style={mS.emergencyBanner}>
            <Text style={mS.emergencyBannerTxt}>
              🚨 {s.emergency_sent ?? "Emergency alert sent"}
            </Text>
          </View>
        )}

        {/* NEAR STORE BANNER */}
        {nearStop && (
          <View style={mS.nearBanner}>
            <View style={{ flex: 1 }}>
              <Text style={mS.nearBannerLabel}>
                📍 {s.near_store ?? "Near store"}
              </Text>
              <Text style={mS.nearBannerStore} numberOfLines={1}>
                {nearStop.name}
              </Text>
            </View>
            <TouchableOpacity
              style={mS.nearConfirmBtn}
              onPress={() => handleConfirmNearStop(nearStop)}
            >
              <Text style={mS.nearConfirmTxt}>✓ Confirm</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PROGRESS BAR */}
        <View style={mS.progressBarWrap}>
          <View style={mS.progressBg}>
            <View style={[mS.progressFill, { width: `${progressPct}%` }]} />
          </View>
          {stops.map((stop) => (
            <View
              key={stop.stop_id}
              style={[
                mS.milestoneDot,
                { left: `${stop.milestonePct}%` },
                stop.status === "confirmed" && mS.milestoneDotDone,
              ]}
            />
          ))}
        </View>

        {/* // MAP + OVERLAYS (flex:1 — takes all remaining space) */}
        <View style={{ flex: 1, position: "relative" }}>
          <LiveMap
            routeCoords={routeCoords}
            truckPosition={truckPosition ?? dcCoords}
            stops={trip?.stops ?? []}
            dcCoords={dcCoords}
          />

          {/* OVERLAYS */}
          {/* <View style={[mS.speedBox, { top: insets.top + 80 }]}>
          <Text style={[mS.speedNum, simSpeed > 80 && { color: THEME.red600 }]}>{simSpeed}</Text>
          <Text style={mS.speedUnit}>km/h</Text>
          {simSpeed > 80 && <Text style={mS.speedWarn}>!</Text>}
        </View> */}

          {/* <View style={[mS.gpsPill, { top: insets.top + 80 }]}>
          <View style={[mS.gpsDot, { backgroundColor: gpsStatus === "ok" ? THEME.green500 : THEME.amber500 }]} />
          <Text style={mS.gpsTxt}>{gpsStatus === "ok" ? "GPS active" : "GPS…"}</Text>
        </View> */}
          <View style={[mS.gpsPill, { top: 12 }]}>
            <View
              style={[
                mS.gpsDot,
                {
                  backgroundColor:
                    gpsStatus === "ok" ? THEME.green500 : THEME.amber500,
                },
              ]}
            />
            <Text style={mS.gpsTxt}>
              {gpsStatus === "ok" ? "GPS active" : "GPS…"}
            </Text>
          </View>

          {/* <View style={[mS.progressChip, { top: insets.top + 80 }]}>
          <Text style={mS.progressChipTxt}>{completedStops}/{stops.length} stops · {progressPct}%</Text>
        </View> */}

          <View style={[mS.progressChip, { top: 12 }]}>
            <Text style={mS.progressChipTxt}>
              {completedStops}/{stops.length} stops · {progressPct}%
            </Text>
          </View>

          {/* EMERGENCY BUTTON */}
          {/* <TouchableOpacity
            style={[mS.emergencyBtn, { bottom: insets.bottom }]}
            onPress={() => setShowEmg(true)}
            activeOpacity={0.9}
          >
            <Text style={mS.emergencyBtnTxt}>
              🚨 {s.emergency ?? "Emergency"}
            </Text>
          </TouchableOpacity> */}
        </View>

        {/* EMERGENCY MODAL */}
        {/* <Modal visible={showEmergency} transparent animationType="slide">
          <View style={mS.modalBg}>
            <View style={mS.modalCard}>
              <View style={mS.modalIconWrap}>
                <Text style={{ fontSize: 44 }}>🚨</Text>
              </View>
              <Text style={mS.modalTitle}>
                {s.emergency_q ?? "Send Emergency Alert?"}
              </Text>
              <Text style={mS.modalSub}>
                Your DC operator will be notified immediately with your GPS
                location.
              </Text>
              <TouchableOpacity
                style={[mS.modalBtn, { backgroundColor: THEME.red600 }]}
                onPress={handleEmergency}
              >
                <Text style={mS.modalBtnTxt}>
                  {s.emergency_yes ?? "Yes, Send Alert"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  mS.modalBtn,
                  { backgroundColor: THEME.slate100, marginTop: 8 },
                ]}
                onPress={() => setShowEmg(false)}
              >
                <Text style={[mS.modalBtnTxt, { color: THEME.slate700 }]}>
                  {s.emergency_cancel ?? "Cancel"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal> */}

        {/* END TRIP MODAL */}
        <Modal visible={showEndTrip} transparent animationType="slide">
          <View style={mS.modalBg}>
            <View style={mS.modalCard}>
              <View style={mS.modalIconWrap}>
                <Text style={{ fontSize: 44 }}>🏁</Text>
              </View>
              <Text style={mS.modalTitle}>
                {s.end_trip_q ?? "End this trip?"}
              </Text>
              <Text style={mS.modalSub}>
                All deliveries will be marked as complete.
              </Text>
              <TouchableOpacity
                style={[mS.modalBtn, { backgroundColor: THEME.maroon }]}
                onPress={handleEndTrip}
              >
                <Text style={mS.modalBtnTxt}>
                  {s.end_trip_yes ?? "End Trip"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  mS.modalBtn,
                  { backgroundColor: THEME.slate100, marginTop: 8 },
                ]}
                onPress={() => setShowEnd(false)}
              >
                <Text style={[mS.modalBtnTxt, { color: THEME.slate700 }]}>
                  {s.cancel ?? "Cancel"}
                </Text>
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
            <Text style={nS.topSub}>
              {driver?.truck ?? "No truck assigned"}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={refetchAll} style={nS.iconBtn}>
            <Text style={{ fontSize: 16 }}>{isFetching ? "⟳" : "🔄"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              disconnectSocket();
              dispatch(clearAuth());
              router.replace("/");
            }}
            style={nS.logoutBtn}
          >
            <Text style={nS.logoutTxt}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 18,
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetchAll}
            tintColor={THEME.maroon}
          />
        }
      >
        {/* GPS STATUS */}
        <View style={nS.gpsCard}>
          <View
            style={[
              nS.gpsDot,
              {
                backgroundColor:
                  gpsStatus === "ok" ? THEME.green500 : THEME.amber500,
              },
            ]}
          />
          <Text style={nS.gpsTxt}>
            {gpsStatus === "ok"
              ? "GPS active — tracking ready"
              : "Acquiring GPS signal…"}
          </Text>
        </View>

        {/* ASSIGNED TRIPS */}
        {scheduledTrips.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <View style={nS.sectionHeader}>
              <Text style={nS.sectionTitle}>Assigned Trips</Text>
              <View style={nS.sectionBadge}>
                <Text style={nS.sectionBadgeTxt}>{scheduledTrips.length}</Text>
              </View>
            </View>

            {scheduledTrips.map((t) => {
              const isAccepting = acceptingId === t.id;
              const stopsCount = t.stops?.length ?? 0;
              const departureDate = t.departed_at
                ? parseISO(t.departed_at)
                : null;
              const isTooEarly = departureDate
                ? isBefore(new Date(), subMinutes(departureDate, 5))
                : false;

              return (
                <View key={t.id} style={aS.assignCard}>
                  {/* Header */}
                  <View style={aS.cardHeader}>
                    <View style={aS.cardHeaderLeft}>
                      <Text style={aS.assignEmoji}>📦</Text>
                      <View>
                        <Text style={aS.assignLabel}>NEW TRIP</Text>
                        <Text style={aS.assignCode}>
                          {(t.tracking_code ?? "").toUpperCase()}
                        </Text>
                        <Text style={aS.truckDetails}>
                          {(t.truck_no ?? "").toUpperCase()} ·{" "}
                          {TRUCK_TYPE[t.truck_type]} · {t.truck_capacity}Tons
                        </Text>
                      </View>
                    </View>
                    <View style={aS.scheduledPill}>
                      <Text style={aS.scheduledPillTxt}>Scheduled</Text>
                    </View>
                  </View>

                  {/* Stats */}
                  <View style={aS.statsRow}>
                    {[
                      {
                        icon: "📅",
                        label: "Departs",
                        value: departureDate
                          ? format(departureDate, "d MMM, h:mm a")
                          : "—",
                      },
                      {
                        icon: "🏪",
                        label: "Stops",
                        value: `${stopsCount} store${stopsCount !== 1 ? "s" : ""}`,
                      },
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
                        <View
                          key={stop.stop_id ?? i}
                          style={[
                            aS.stopPreviewRow,
                            i > 0 && {
                              borderTopWidth: 1,
                              borderTopColor: THEME.slate100,
                            },
                          ]}
                        >
                          <View style={aS.stopPreviewNum}>
                            <Text style={aS.stopPreviewNumTxt}>{i + 1}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={aS.stopPreviewName} numberOfLines={1}>
                              {stop.store?.name ?? `Stop ${i + 1}`}
                            </Text>
                            <Text style={aS.stopPreviewAddr}>
                              {stop.store?.address ?? "—"}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Accept button */}
                  <TouchableOpacity
                    style={[
                      aS.acceptBtn,
                      isAccepting && { opacity: 0.65 },
                      // (isAccepting || isTooEarly) && { opacity: 0.65 },
                    ]}
                    onPress={() => handleAcceptTrip(t.id)}
                    disabled={isAccepting}
                    // disabled={isAccepting || isTooEarly}
                    activeOpacity={0.88}
                  >
                    {isAccepting ? (
                      <ActivityIndicator color={THEME.white} />
                    ) : (
                      <>
                        <Text style={{ fontSize: 18, color: THEME.white }}>
                          ✓
                        </Text>
                        <Text style={aS.acceptBtnTxt}>
                          {isTooEarly
                            ? `Available at ${departureDate ? format(subMinutes(departureDate, 5), "h:mm a") : ""}`
                            : (s.accept_trip ?? "Accept Trip")}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* EMPTY STATE */}
        {scheduledTrips.length === 0 && pastTrips.length === 0 && (
          <View style={nS.emptyCard}>
            <Text style={nS.emptyEmoji}>🚛</Text>
            <Text style={nS.emptyTitle}>
              {s.no_trip ?? "No trips assigned"}
            </Text>
            <Text style={nS.emptySub}>
              {s.no_trip_sub ?? "Pull down to refresh"}
            </Text>
            <TouchableOpacity style={nS.refreshBtn} onPress={refetchAll}>
              <Text style={nS.refreshBtnTxt}>🔄 Refresh</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PAST TRIPS */}
        {pastTrips.length > 0 && (
          <View>
            <View style={nS.sectionHeader}>
              <Text style={nS.sectionTitle}>Past Trips</Text>
              <View
                style={[nS.sectionBadge, { backgroundColor: THEME.slate100 }]}
              >
                <Text style={[nS.sectionBadgeTxt, { color: THEME.slate600 }]}>
                  {pastTrips.length}
                </Text>
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
  root: { flex: 1, backgroundColor: THEME.slate50 },
  topBar: {
    backgroundColor: THEME.maroon,
    paddingHorizontal: 18,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: THEME.white, fontSize: 18, fontWeight: "800" },
  topName: { color: THEME.white, fontSize: 15, fontWeight: "800" },
  topSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontFamily: "monospace",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  logoutTxt: { color: THEME.white, fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  centerTxt: { color: THEME.slate500, fontSize: 14, marginTop: 14 },
  gpsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: THEME.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: THEME.slate100,
  },
  gpsDot: { width: 10, height: 10, borderRadius: 5 },
  gpsTxt: { fontSize: 13, fontWeight: "600", color: THEME.slate700 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: THEME.slate900 },
  sectionBadge: {
    backgroundColor: "#fef9ec",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  sectionBadgeTxt: { fontSize: 12, fontWeight: "700", color: "#92400e" },
  emptyCard: {
    backgroundColor: THEME.white,
    borderRadius: 24,
    padding: 40,
    alignItems: "center",
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: THEME.slate900,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: THEME.slate500,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.slate100,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 14,
  },
  refreshBtnTxt: { color: THEME.slate700, fontSize: 14, fontWeight: "700" },
});

const aS = StyleSheet.create({
  assignCard: {
    backgroundColor: THEME.white,
    borderRadius: 22,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    backgroundColor: "#fef9ec",
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
  },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  assignEmoji: { fontSize: 20 },
  truckDetails: { fontSize: 13, color: THEME.slate500 },
  assignLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
    letterSpacing: 1.5,
  },
  assignCode: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.slate900,
    fontFamily: "monospace",
    marginTop: 2,
  },
  scheduledPill: {
    backgroundColor: THEME.slate100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scheduledPillTxt: { fontSize: 11, fontWeight: "700", color: THEME.slate600 },
  statsRow: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.slate100,
  },
  statCell: {
    flex: 1,
    backgroundColor: THEME.slate50,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: THEME.slate400,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.slate800,
    textAlign: "center",
    marginTop: 2,
  },
  stopsPreview: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: THEME.slate50,
    borderRadius: 14,
    overflow: "hidden",
  },
  stopPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  stopPreviewNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.maroon,
    alignItems: "center",
    justifyContent: "center",
  },
  stopPreviewNumTxt: { color: THEME.white, fontSize: 11, fontWeight: "800" },
  stopPreviewName: { fontSize: 13, fontWeight: "600", color: THEME.slate800 },
  stopPreviewAddr: { fontSize: 11, color: THEME.slate500, marginTop: 1 },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    margin: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: THEME.maroon,
    elevation: 6,
    shadowColor: THEME.maroon,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  acceptBtnTxt: { color: THEME.white, fontSize: 17, fontWeight: "800" },
});

const ptS = StyleSheet.create({
  card: {
    backgroundColor: THEME.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: THEME.slate100,
  },
  cardLeft: { minWidth: 52 },
  tripCode: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.slate700,
    fontFamily: "monospace",
  },
  tripDate: { fontSize: 11, color: THEME.slate400 },
  cardMid: { flex: 1 },
  stops: { fontSize: 12, fontWeight: "700", color: THEME.slate800 },
  addr: { fontSize: 12, color: THEME.slate400, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
});

const mS = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.slate900 },
  topBar: {
    backgroundColor: THEME.maroon,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  topAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  topName: { color: THEME.white, fontSize: 15, fontWeight: "800" },
  topCode: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontFamily: "monospace",
  },
  endBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  endBtnTxt: { color: THEME.white, fontSize: 13, fontWeight: "600" },
  progressBarWrap: {
    height: 6,
    backgroundColor: THEME.slate100,
    position: "relative",
    overflow: "visible",
  },
  progressBg: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: THEME.slate100,
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: THEME.green500,
    borderRadius: 3,
  },
  milestoneDot: {
    position: "absolute",
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.slate300,
    borderWidth: 2,
    borderColor: THEME.white,
    marginLeft: -6,
  },
  milestoneDotDone: { backgroundColor: THEME.green600 },
  emergencyBanner: {
    backgroundColor: THEME.red600,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emergencyBannerTxt: { color: THEME.white, fontSize: 13, fontWeight: "700" },
  nearBanner: {
    backgroundColor: THEME.green600,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nearBannerLabel: { color: THEME.white, fontSize: 12, fontWeight: "700" },
  nearBannerStore: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 1,
  },
  nearConfirmBtn: {
    backgroundColor: THEME.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  nearConfirmTxt: { color: THEME.green700, fontSize: 13, fontWeight: "800" },
  map: { flex: 1 },
  truckMarker: {
    backgroundColor: THEME.maroon,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: THEME.white,
    elevation: 10,
    shadowColor: THEME.maroon,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  dcMarker: {
    backgroundColor: "#1e3a8a",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: THEME.white,
    elevation: 6,
  },
  storeMarker: {
    backgroundColor: THEME.green700,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: THEME.white,
    elevation: 4,
  },
  storeMarkerDone: { backgroundColor: THEME.green500, opacity: 0.75 },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0ea5e9",
    borderWidth: 3,
    borderColor: THEME.white,
    elevation: 4,
  },
  speedBox: {
    position: "absolute",
    right: 12,
    backgroundColor: THEME.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  speedNum: { fontSize: 24, fontWeight: "900", color: THEME.slate900 },
  speedUnit: { fontSize: 11, color: THEME.slate400 },
  speedWarn: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.red600,
    marginTop: 1,
  },
  gpsPill: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: THEME.white,
    elevation: 4,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsTxt: { fontSize: 11, fontWeight: "600", color: THEME.slate700 },
  progressChip: {
    position: "absolute",
    alignSelf: "center",
    left: "50%",
    marginLeft: -65,
    backgroundColor: THEME.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    elevation: 4,
  },
  progressChipTxt: { fontSize: 11, fontWeight: "700", color: THEME.slate700 },
  emergencyBtn: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: THEME.red600,
    paddingVertical: 17,
    borderRadius: 22,
    alignItems: "center",
    elevation: 10,
    shadowColor: THEME.red600,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  emergencyBtnTxt: {
    color: THEME.white,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: THEME.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 28,
    paddingBottom: 44,
    alignItems: "center",
  },
  modalIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.slate100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: THEME.slate900,
    marginBottom: 8,
    textAlign: "center",
  },
  modalSub: {
    fontSize: 13,
    color: THEME.slate500,
    marginBottom: 28,
    textAlign: "center",
    lineHeight: 20,
  },
  modalBtn: {
    width: "100%",
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: "center",
  },
  modalBtnTxt: { color: THEME.white, fontSize: 16, fontWeight: "800" },
});

const zoomBtn = {
  backgroundColor: "#fff",
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: "center",
  justifyContent: "center",
  elevation: 5,
};

const zoomTxt = {
  fontSize: 22,
  fontWeight: "bold",
};
