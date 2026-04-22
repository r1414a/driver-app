// FILE: app/(tabs)/alerts.js
// Reads alerts from Redux (pushed by socket "Alert" event in home.js)
// ─────────────────────────────────────────────────────────────────────────

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { markAlertsRead } from "../../store/tripSlice";
import { THEME } from "../../constants/theme";
 
const SEV_STYLE = {
  high:   { bg: "#fef2f2", border: "#fca5a5", text: THEME.red600,   icon: "🚨" },
  medium: { bg: "#fffbeb", border: "#fcd34d", text: THEME.amber600, icon: "⚠️" },
  info:   { bg: "#eff6ff", border: "#93c5fd", text: THEME.blue600,  icon: "ℹ️" },
};
 
const TYPE_LABELS = {
  speeding:       "Speeding",
  route_deviation:"Route deviation",
  geofence_enter: "Store arrival",
  emergency:      "Emergency",
  server_alert:   "Alert",
  info:           "Info",
};
 
export default function AlertsScreen() {
  const insets   = useSafeAreaInsets();
  const dispatch = useDispatch();
  const alerts   = useSelector(s => s.trip.alerts);
  const unread   = alerts.filter(a => a.unread).length;
 
  return (
    <View style={[S.root, { paddingTop: insets.top }]}>
      // HEADER
      <View style={S.header}>
        <View>
          <Text style={S.headerTitle}>Alerts</Text>
          {unread > 0 && <Text style={S.headerSub}>{unread} unread</Text>}
        </View>
        {unread > 0 && (
          <TouchableOpacity onPress={() => dispatch(markAlertsRead())} style={S.markReadBtn}>
            <Text style={S.markReadTxt}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
 
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
        {alerts.length === 0 ? (
          <View style={S.emptyState}>
            <Text style={S.emptyEmoji}>✅</Text>
            <Text style={S.emptyTitle}>All clear!</Text>
            <Text style={S.emptySubtitle}>No alerts on this trip. Keep it up!</Text>
          </View>
        ) : (
          alerts.map(alert => {
            const st = SEV_STYLE[alert.severity] ?? SEV_STYLE.info;
            return (
              <View
                key={alert.id}
                style={[S.card, { backgroundColor: st.bg, borderColor: st.border },
                  alert.unread && S.cardUnread]}
              >
                <View style={S.cardLeft}>
                  <Text style={S.cardIcon}>{st.icon}</Text>
                  {alert.unread && <View style={S.unreadDot} />}
                </View>
                <View style={S.cardBody}>
                  <View style={S.cardMeta}>
                    <Text style={[S.cardType, { color: st.text }]}>
                      {TYPE_LABELS[alert.type] ?? alert.type.replace("_"," ").toUpperCase()}
                    </Text>
                    <Text style={S.cardTime}>{alert.time}</Text>
                  </View>
                  <Text style={[S.cardMsg, { color: st.text }]}>{alert.message}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
 
const S = StyleSheet.create({
  root:          { flex: 1, backgroundColor: THEME.slate50 },
  header:        { backgroundColor: THEME.maroon, paddingHorizontal: 20, paddingVertical: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  headerTitle:   { fontSize: 22, fontWeight: "900", color: THEME.white },
  headerSub:     { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  markReadBtn:   { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, marginTop: 4 },
  markReadTxt:   { color: THEME.white, fontSize: 12, fontWeight: "600" },
  emptyState:    { alignItems: "center", paddingTop: 80 },
  emptyEmoji:    { fontSize: 56, marginBottom: 16 },
  emptyTitle:    { fontSize: 22, fontWeight: "800", color: THEME.slate800 },
  emptySubtitle: { fontSize: 14, color: THEME.slate400, marginTop: 6, textAlign: "center" },
  card:          { borderRadius: 18, borderWidth: 1.5, padding: 14, marginBottom: 12, flexDirection: "row", gap: 12 },
  cardUnread:    { elevation: 4, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  cardLeft:      { alignItems: "center", gap: 5 },
  cardIcon:      { fontSize: 24 },
  unreadDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.maroon },
  cardBody:      { flex: 1 },
  cardMeta:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  cardType:      { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  cardTime:      { fontSize: 11, color: THEME.slate400 },
  cardMsg:       { fontSize: 13, lineHeight: 20 },
});