import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { clearAuth } from "../store/authSlice";
import { clearTrip } from "../store/tripSlice";
import { disconnectSocket } from "../lib/socket";
import { driverApi } from "../store/driverApi";
import { useStore } from "react-redux";
import { THEME } from "../constants/theme";
import { STRINGS } from "../constants/i18n";
 
export default function TripCompleteScreen() {
  const insets   = useSafeAreaInsets();
  const dispatch = useDispatch();
  const store    = useStore();
  const lang     = useSelector(s => s.auth.lang ?? "en");
  const driver   = useSelector(s => s.auth.driver);
  const trip     = useSelector(s => s.trip.activeTrip);
  const stops    = useSelector(s => s.trip.stops);
  const s        = STRINGS[lang];
 
  const done = stops.filter(st => st.status === "completed").length;
 
  const handleLogout = () => {
    disconnectSocket();
    dispatch(clearTrip());
    dispatch(clearAuth());
    dispatch(driverApi.util.resetApiState());
    router.replace("/");
  };
 
  return (
    <View style={[S.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={S.content}>
        // Celebration
        <Text style={S.emoji}>🎉</Text>
        <Text style={S.title}>{s.trip_complete}</Text>
        <Text style={S.subtitle}>{s.trip_complete_sub}</Text>
 
        // Stats row
        <View style={S.statsRow}>
          {[
            { label: "Trip",     value: trip?.tracking_code ?? "—" },
            { label: "Stops",    value: `${done}/${stops.length}` },
            { label: "Truck",    value: driver?.truck ?? "—" },
          ].map(({ label, value }) => (
            <View key={label} style={S.statCard}>
              <Text style={S.statValue} numberOfLines={1}>{value}</Text>
              <Text style={S.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
 
        // Rating prompt
        <View style={S.ratingCard}>
          <Text style={S.ratingTitle}>How was the trip?</Text>
          <View style={S.starsRow}>
            {[1,2,3,4,5].map(n => (
              <Text key={n} style={S.star}>⭐</Text>
            ))}
          </View>
          <Text style={S.ratingHint}>Your feedback helps improve the fleet system.</Text>
        </View>
 
        <TouchableOpacity style={S.logoutBtn} onPress={handleLogout} activeOpacity={0.9}>
          <Text style={S.logoutBtnTxt}>{s.logout}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
 
const S = StyleSheet.create({
  root:       { flex: 1, backgroundColor: THEME.maroon },
  content:    { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emoji:      { fontSize: 80, marginBottom: 20 },
  title:      { fontSize: 36, fontWeight: "900", color: THEME.white, textAlign: "center", letterSpacing: -0.5 },
  subtitle:   { fontSize: 16, color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: 10, lineHeight: 24 },
  statsRow:   { flexDirection: "row", gap: 12, marginTop: 40, marginBottom: 28, width: "100%" },
  statCard:   { flex: 1, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, padding: 18, alignItems: "center" },
  statValue:  { fontSize: 16, fontWeight: "900", color: THEME.white },
  statLabel:  { fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 4 },
  ratingCard: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, padding: 20, alignItems: "center", width: "100%", marginBottom: 32 },
  ratingTitle:{ fontSize: 16, fontWeight: "700", color: THEME.white, marginBottom: 12 },
  starsRow:   { flexDirection: "row", gap: 6, marginBottom: 8 },
  star:       { fontSize: 28 },
  ratingHint: { fontSize: 12, color: "rgba(255,255,255,0.55)", textAlign: "center" },
  logoutBtn:  { backgroundColor: THEME.white, paddingHorizontal: 48, paddingVertical: 17, borderRadius: 22, elevation: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  logoutBtnTxt: { color: THEME.maroon, fontSize: 17, fontWeight: "900" },
});