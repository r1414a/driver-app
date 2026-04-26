// app/(tabs)/alerts.js
// All alerts — socket alerts + geofence + speed + route deviation
// ──────────────────────────────────────────────────────────────────────────

import { useEffect } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { markAlertsRead } from "../../store/tripSlice";
import { THEME } from "../../constants/theme";

const SEVERITY_COLORS = {
  high:   { bg: "#fef2f2", border: "#fecaca", dot: THEME.red600,   label: "#dc2626" },
  medium: { bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b",      label: "#92400e" },
  low:    { bg: "#f0fdf4", border: "#bbf7d0", dot: THEME.green600, label: THEME.green700 },
};

const TYPE_ICONS = {
  route_deviation: "📍",
  speeding:        "⚡",
  geofence_enter:  "🏪",
  emergency:       "🚨",
  server_alert:    "🔔",
};

function AlertCard({ alert }) {
  const c = SEVERITY_COLORS[alert.severity] ?? SEVERITY_COLORS.medium;
  const icon = TYPE_ICONS[alert.type] ?? "🔔";
  return (
    <View style={[aS.card, { backgroundColor: c.bg, borderColor: c.border }, alert.unread && aS.cardUnread]}>
      <View style={[aS.iconWrap, { backgroundColor: c.bg }]}>
        <Text style={{ fontSize: 24 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <View style={[aS.dot, { backgroundColor: c.dot }]} />
          <Text style={[aS.severity, { color: c.label }]}>
            {(alert.severity ?? "medium").toUpperCase()}
          </Text>
          {alert.unread && <View style={aS.unreadDot} />}
        </View>
        <Text style={aS.message}>{alert.message}</Text>
        {alert.time && <Text style={aS.time}>{alert.time}</Text>}
      </View>
    </View>
  );
}

export default function AlertsScreen() {
  const insets   = useSafeAreaInsets();
  const dispatch = useDispatch();
  const alerts   = useSelector((s) => s.trip.alerts);

  // console.log("DJFKJDFKJDKJFDKJFD",alerts);
  
  const unread   = alerts.filter((a) => a.unread).length;

  // Mark all as read when tab opens
  useEffect(() => {
    if (unread > 0) dispatch(markAlertsRead());
  }, []);

  return (
    <View style={[S.root, { paddingTop: insets.top }]}>

      {/* HEADER */}
      <View style={S.header}>
        <View>
          <Text style={S.headerTitle}>Alerts</Text>
          <Text style={S.headerSub}>
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </Text>
        </View>
        {alerts.length > 0 && (
          <View style={S.badge}>
            <Text style={S.badgeTxt}>{alerts.length}</Text>
          </View>
        )}
      </View>

      {alerts.length === 0 ? (
        <View style={S.empty}>
          <Text style={S.emptyEmoji}>🔔</Text>
          <Text style={S.emptyTitle}>No alerts yet</Text>
          <Text style={S.emptySub}>Speed, route deviation, and geofence alerts will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AlertCard alert={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 10 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const S = StyleSheet.create({
  root:        { flex: 1, backgroundColor: THEME.slate50 },
  header:      { backgroundColor: THEME.maroon, paddingHorizontal: 20, paddingVertical: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 22, fontWeight: "900", color: THEME.white },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  badge:       { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeTxt:    { color: THEME.white, fontSize: 13, fontWeight: "800" },
  empty:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyEmoji:  { fontSize: 64, marginBottom: 16 },
  emptyTitle:  { fontSize: 20, fontWeight: "800", color: THEME.slate900, marginBottom: 8 },
  emptySub:    { fontSize: 14, color: THEME.slate500, textAlign: "center", lineHeight: 22 },
});

const aS = StyleSheet.create({
  card:       { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, padding: 14, borderWidth: 1 },
  cardUnread: { elevation: 3, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  iconWrap:   { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  severity:   { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  unreadDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.blue600 },
  message:    { fontSize: 14, fontWeight: "600", color: THEME.slate800, lineHeight: 20 },
  time:       { fontSize: 11, color: THEME.slate400, marginTop: 4 },
});