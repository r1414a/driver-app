// FILE: app/(tabs)/trip.js
// Trip details — driver info, truck, cargo, stops progress
// ─────────────────────────────────────────────────────────────────────────

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { useGetActiveTripQuery } from "../../store/driverApi";
import { Linking } from "react-native";
import { THEME } from "../../constants/theme";
 
function InfoRow({ label, value }) {
  return (
    <View style={S.infoRow}>
      <Text style={S.infoLabel}>{label}</Text>
      <Text style={S.infoValue} numberOfLines={1}>{value ?? "—"}</Text>
    </View>
  );
}
 
function Grid({ items }) {
  return (
    <View style={S.grid}>
      {items.map(({ label, value }) => (
        <View key={label} style={S.gridCell}>
          <Text style={S.gridLabel}>{label}</Text>
          <Text style={S.gridValue} numberOfLines={1}>{value ?? "—"}</Text>
        </View>
      ))}
    </View>
  );
}
 
export default function TripScreen() {
  const insets  = useSafeAreaInsets();
  const driver  = useSelector(s => s.auth.driver);
  const { stops, activeTrip: trip } = useSelector(s => s.trip);
  const completedStops = stops.filter(s => s.status === "completed").length;
  const progressPct    = stops.length ? Math.round((completedStops / stops.length) * 100) : 0;
 
  const openNav = (lat, lng) =>
    Linking.openURL(`https://maps.google.com/maps?daddr=${lat},${lng}`);
 
  const isOnTrip = trip?.status === "in_transit";
 
  return (
    <ScrollView style={[S.root, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
 
      // HEADER
      <View style={S.header}>
        <View>
          <Text style={S.headerTitle}>Trip Details</Text>
          <Text style={S.headerSub}>{trip?.tracking_code ?? "No active trip"}</Text>
        </View>
        <View style={[S.statusBadge, !isOnTrip && { backgroundColor: "rgba(255,255,255,0.2)" }]}>
          <View style={[S.statusDot, { backgroundColor: isOnTrip ? "#4ade80" : "#94a3b8" }]} />
          <Text style={S.statusBadgeTxt}>{trip?.status ?? "Idle"}</Text>
        </View>
      </View>
 
      <View style={S.content}>
 
        // TRIP HERO CARD
        {trip ? (
          <View style={S.heroCard}>
            <View style={S.heroLeft}>
              <Text style={S.heroLabel}>TRIP ID</Text>
              <Text style={S.heroId}>{trip.tracking_code ?? trip.id?.slice(0,12)}</Text>
              <Text style={S.heroCargo}>{trip.cargo ?? "Apparel"}</Text>
            </View>
            <View style={S.heroRight}>
              <Text style={{ fontSize: 38 }}>🚛</Text>
              <Text style={S.heroReg}>{driver?.truck ?? trip.truck_reg ?? "—"}</Text>
            </View>
          </View>
        ) : (
          <View style={S.emptyCard}>
            <Text style={S.emptyEmoji}>📋</Text>
            <Text style={S.emptyTitle}>No active trip</Text>
            <Text style={S.emptySubtitle}>Accept a trip to see details here</Text>
          </View>
        )}
 
        {trip && (
          <>
            // PROGRESS
            <View style={S.card}>
              <View style={S.cardHeaderRow}>
                <Text style={S.cardTitle}>Stop progress</Text>
                <Text style={S.progressCount}>{completedStops}/{stops.length} done · {progressPct}%</Text>
              </View>
              <View style={S.progressBg}>
                <View style={[S.progressFill, { width: `${progressPct}%` }]} />
                {stops.map(stop => (
                  <View
                    key={stop.id}
                    style={[S.milestoneDot, { left: `${stop.milestonePct}%` },
                      stop.status === "completed" && S.milestoneDotDone]}
                  />
                ))}
              </View>
            </View>
 
            // STATS GRID
            <View style={S.card}>
              <Text style={S.cardTitle}>Trip stats</Text>
              <Grid items={[
                { label: "Departed",    value: trip.departed_at ? new Date(trip.departed_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—" },
                { label: "Stops",       value: `${stops.length} stores` },
                { label: "Distance",    value: trip.distance ? `${trip.distance} km` : "—" },
                { label: "DC",          value: trip.dc_name ?? "—" },
              ]} />
            </View>
 
            // VEHICLE DETAILS
            <View style={S.card}>
              <Text style={S.cardTitle}>Vehicle</Text>
              <InfoRow label="Registration" value={driver?.truck ?? trip.truck_reg} />
              <InfoRow label="Model"        value={trip.truck_model ?? "—"} />
              <InfoRow label="Type"         value={trip.truck_type  ?? "—"} />
              <InfoRow label="Cargo"        value={trip.cargo       ?? "—"} />
              <InfoRow label="From DC"      value={trip.dc_name     ?? "—"} />
            </View>
 
            // DRIVER PROFILE
            <View style={S.card}>
              <Text style={S.cardTitle}>Driver profile</Text>
              <View style={S.driverRow}>
                <View style={S.driverAvatar}>
                  <Text style={S.driverAvatarTxt}>
                    {(driver?.name ?? "D").split(" ").map(n => n[0]).join("").slice(0,2)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.driverName}>{driver?.name ?? "—"}</Text>
                  <Text style={S.driverSub}>{driver?.id ?? "—"}</Text>
                  <View style={S.starsRow}>
                    {[1,2,3,4,5].map(n => (
                      <Text key={n} style={{ fontSize: 13, color: n <= Math.floor(driver?.rating ?? 4.5) ? "#f59e0b" : "#e2e8f0" }}>★</Text>
                    ))}
                    <Text style={S.ratingTxt}>{driver?.rating ?? "—"}</Text>
                  </View>
                </View>
                <View style={S.tripsBox}>
                  <Text style={S.tripsNum}>{driver?.totalTrips ?? "—"}</Text>
                  <Text style={S.tripsLbl}>trips</Text>
                </View>
              </View>
            </View>
 
            // STOPS TIMELINE
            <View style={S.card}>
              <Text style={S.cardTitle}>Stops</Text>
              {stops.map((stop, i) => {
                const isDone = stop.status === "completed";
                return (
                  <View key={stop.id} style={[S.stopRow, i > 0 && S.stopBorder]}>
                    <View style={[S.stopTimeline]}>
                      <View style={[S.stopDot, isDone && S.stopDotDone]}>
                        <Text style={S.stopDotTxt}>{isDone ? "✓" : i + 1}</Text>
                      </View>
                      {i < stops.length - 1 && <View style={[S.stopLine, isDone && S.stopLineDone]} />}
                    </View>
                    <View style={S.stopInfo}>
                      <Text style={S.stopName} numberOfLines={1}>{stop.name}</Text>
                      <Text style={S.stopAddr} numberOfLines={1}>{stop.address}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                        <View style={[S.stopStatus, isDone ? S.stopStatusDone : S.stopStatusPend]}>
                          <Text style={[S.stopStatusTxt, { color: isDone ? THEME.green700 : THEME.slate600 }]}>
                            {isDone ? "Done" : "Pending"}
                          </Text>
                        </View>
                        {!isDone && (
                          <TouchableOpacity
                            style={S.navBtn}
                            onPress={() => openNav(stop.latitude, stop.longitude)}
                          >
                            <Text style={S.navBtnTxt}>🗺 Navigate</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
 
const S = StyleSheet.create({
  root:           { flex: 1, backgroundColor: THEME.slate50 },
  header:         { backgroundColor: THEME.maroon, paddingHorizontal: 20, paddingVertical: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle:    { fontSize: 22, fontWeight: "900", color: THEME.white },
  headerSub:      { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2, fontFamily: "monospace" },
  statusBadge:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusDot:      { width: 8, height: 8, borderRadius: 4 },
  statusBadgeTxt: { color: THEME.white, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  content:        { padding: 16, gap: 14 },
  heroCard:       { backgroundColor: THEME.white, borderRadius: 22, padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center", elevation: 3, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  heroLeft:       { flex: 1 },
  heroLabel:      { fontSize: 10, fontWeight: "700", color: THEME.slate400, letterSpacing: 1.5, marginBottom: 4 },
  heroId:         { fontSize: 22, fontWeight: "900", color: THEME.maroon, fontFamily: "monospace" },
  heroCargo:      { fontSize: 13, color: THEME.slate500, marginTop: 4 },
  heroRight:      { alignItems: "center", gap: 4 },
  heroReg:        { fontSize: 11, fontWeight: "700", color: THEME.slate500, fontFamily: "monospace" },
  emptyCard:      { backgroundColor: THEME.white, borderRadius: 22, padding: 40, alignItems: "center", elevation: 2 },
  emptyEmoji:     { fontSize: 48, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: "800", color: THEME.slate800 },
  emptySubtitle:  { fontSize: 13, color: THEME.slate500, marginTop: 6, textAlign: "center" },
  card:           { backgroundColor: THEME.white, borderRadius: 18, padding: 18, elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardHeaderRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle:      { fontSize: 12, fontWeight: "700", color: THEME.slate400, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 },
  progressCount:  { fontSize: 12, fontWeight: "700", color: THEME.slate700 },
  progressBg:     { height: 10, backgroundColor: THEME.slate100, borderRadius: 5, overflow: "visible", position: "relative" },
  progressFill:   { height: "100%", backgroundColor: THEME.green500, borderRadius: 5 },
  milestoneDot:   { position: "absolute", top: -3, width: 16, height: 16, borderRadius: 8, backgroundColor: THEME.slate300, borderWidth: 2.5, borderColor: THEME.white, marginLeft: -8 },
  milestoneDotDone: { backgroundColor: THEME.green600 },
  grid:           { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridCell:       { flex: 1, minWidth: "45%", backgroundColor: THEME.slate50, borderRadius: 14, padding: 14 },
  gridLabel:      { fontSize: 10, fontWeight: "700", color: THEME.slate400, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  gridValue:      { fontSize: 17, fontWeight: "800", color: THEME.slate900 },
  infoRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: THEME.slate100 },
  infoLabel:      { fontSize: 14, color: THEME.slate500 },
  infoValue:      { fontSize: 14, fontWeight: "600", color: THEME.slate800, flex: 1, textAlign: "right", marginLeft: 16 },
  driverRow:      { flexDirection: "row", alignItems: "center", gap: 14 },
  driverAvatar:   { width: 52, height: 52, borderRadius: 26, backgroundColor: THEME.maroon, alignItems: "center", justifyContent: "center" },
  driverAvatarTxt:{ color: THEME.white, fontSize: 18, fontWeight: "900" },
  driverName:     { fontSize: 16, fontWeight: "800", color: THEME.slate900 },
  driverSub:      { fontSize: 12, color: THEME.slate400, fontFamily: "monospace" },
  starsRow:       { flexDirection: "row", alignItems: "center", gap: 1, marginTop: 4 },
  ratingTxt:      { fontSize: 12, color: THEME.slate400, marginLeft: 4 },
  tripsBox:       { alignItems: "center" },
  tripsNum:       { fontSize: 24, fontWeight: "900", color: THEME.maroon },
  tripsLbl:       { fontSize: 11, color: THEME.slate400 },
  stopRow:        { flexDirection: "row", gap: 12, paddingVertical: 12 },
  stopBorder:     { borderTopWidth: 1, borderTopColor: THEME.slate100 },
  stopTimeline:   { alignItems: "center", paddingTop: 2 },
  stopDot:        { width: 30, height: 30, borderRadius: 15, backgroundColor: THEME.slate200, alignItems: "center", justifyContent: "center" },
  stopDotDone:    { backgroundColor: THEME.green500 },
  stopDotTxt:     { fontSize: 12, fontWeight: "900", color: THEME.white },
  stopLine:       { width: 2, flex: 1, backgroundColor: THEME.slate200, marginTop: 4 },
  stopLineDone:   { backgroundColor: "#86efac" },
  stopInfo:       { flex: 1 },
  stopName:       { fontSize: 14, fontWeight: "700", color: THEME.slate900 },
  stopAddr:       { fontSize: 12, color: THEME.slate500 },
  stopStatus:     { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  stopStatusDone: { backgroundColor: "#dcfce7" },
  stopStatusPend: { backgroundColor: THEME.slate100 },
  stopStatusTxt:  { fontSize: 11, fontWeight: "700" },
  navBtn:         { backgroundColor: "#dbeafe", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  navBtnTxt:      { fontSize: 12, fontWeight: "600", color: THEME.blue600 },
});