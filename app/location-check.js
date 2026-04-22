// FILE: app/location-check.js
// GPS gate screen — mandatory before proceeding to tabs
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useDispatch } from "react-redux";
import { setGpsOk } from "../store/tripSlice";
import { THEME } from "../constants/theme";
 
export default function LocationCheckScreen() {
  const insets   = useSafeAreaInsets();
  const dispatch = useDispatch();
  const [status, setStatus]   = useState("checking"); // checking | denied | getting | ready
  const [errMsg, setErrMsg]   = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const subRef    = useRef(null);
  const timeoutRef = useRef(null);
 
  const cleanup = () => {
    subRef.current?.remove();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };
 
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  };
 
  const check = async () => {
    cleanup();
    setStatus("checking");
 
    // 1. Permission
    let { status: perm } = await Location.getForegroundPermissionsAsync();
    if (perm !== "granted") {
      const res = await Location.requestForegroundPermissionsAsync();
      perm = res.status;
    }
    if (perm !== "granted") {
      setStatus("denied");
      setErrMsg("Location permission is required to use Fleet Driver.");
      return;
    }
 
    // 2. GPS enabled
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      setStatus("denied");
      setErrMsg("Please turn ON GPS / Location in your phone settings.");
      return;
    }
 
    setStatus("getting");
    startPulse();
 
    // 3. Try last known first
    const last = await Location.getLastKnownPositionAsync();
    if (last) {
      dispatch(setGpsOk(true));
      cleanup();
      router.replace("/(tabs)/home");
      return;
    }
 
    // 4. Force timeout fallback after 12 seconds
    timeoutRef.current = setTimeout(() => {
      dispatch(setGpsOk(true));
      cleanup();
      router.replace("/(tabs)/home");
    }, 12000);
 
    // 5. Watch for a fix
    subRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 1 },
      (loc) => {
        if (loc.coords.accuracy < 300) {
          dispatch(setGpsOk(true));
          cleanup();
          router.replace("/(tabs)/home");
        }
      }
    );
  };
 
  useEffect(() => {
    check();
    return cleanup;
  }, []);
 
  return (
    <View style={[S.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      // Top maroon bar
      <View style={S.topBar}>
        <Text style={S.topBarTitle}>Fleet Driver</Text>
      </View>
 
      <View style={S.body}>
        {/* // Animated GPS ring */}
        <View style={S.ringOuter}>
          <Animated.View style={[S.ringInner, { transform: [{ scale: pulseAnim }] }]}>
            <View style={S.ringCore}>
              <Text style={S.coreEmoji}>
                {status === "denied" ? "⚠️" : "📍"}
              </Text>
            </View>
          </Animated.View>
        </View>
 
        {status === "checking" || status === "getting" ? (
          <>
            <ActivityIndicator color={THEME.maroon} size="large" style={{ marginBottom: 20 }} />
            <Text style={S.title}>
              {status === "checking" ? "Checking location…" : "Acquiring GPS signal…"}
            </Text>
            <Text style={S.sub}>
              {status === "getting"
                ? "Move near a window or step outside for better signal."
                : "Please wait a moment."}
            </Text>
          </>
        ) : (
          <>
            <Text style={S.title}>Location Required</Text>
            <Text style={S.sub}>{errMsg}</Text>
            <TouchableOpacity style={S.btn} onPress={check}>
              <Text style={S.btnTxt}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}
 
        {/* // Status steps */}
        <View style={S.stepCard}>
          {[
            { icon: "✅", text: "Location permission",    done: status !== "denied" },
            { icon: "✅", text: "GPS service enabled",     done: status === "getting" || status === "ready" },
            { icon: "📡", text: "Getting satellite fix…",  done: false, active: status === "getting" },
          ].map((step, i) => (
            <View key={i} style={[S.step, i > 0 && S.stepBorder]}>
              <Text style={[S.stepIcon, step.done && S.stepIconDone, step.active && S.stepIconActive]}>
                {step.active ? "⏳" : step.done ? "✅" : "○"}
              </Text>
              <Text style={[S.stepTxt, step.done && S.stepTxtDone]}>{step.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
 
const S = StyleSheet.create({
  root:          { flex: 1, backgroundColor: THEME.slate50 },
  topBar:        { backgroundColor: THEME.maroon, paddingHorizontal: 20, paddingVertical: 18 },
  topBarTitle:   { color: THEME.white, fontSize: 18, fontWeight: "800" },
  body:          { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  ringOuter:     { width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(112,26,64,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 32 },
  ringInner:     { width: 110, height: 110, borderRadius: 55, backgroundColor: "rgba(112,26,64,0.12)", alignItems: "center", justifyContent: "center" },
  ringCore:      { width: 80, height: 80, borderRadius: 40, backgroundColor: THEME.maroon, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: THEME.maroon, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  coreEmoji:     { fontSize: 34 },
  title:         { fontSize: 22, fontWeight: "800", color: THEME.slate900, textAlign: "center", marginBottom: 10 },
  sub:           { fontSize: 14, color: THEME.slate500, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  btn:           { backgroundColor: THEME.maroon, paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16, elevation: 4 },
  btnTxt:        { color: THEME.white, fontSize: 15, fontWeight: "700" },
  stepCard:      { marginTop: 36, backgroundColor: THEME.white, borderRadius: 18, borderWidth: 1, borderColor: THEME.slate200, width: "100%", overflow: "hidden" },
  step:          { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 13 },
  stepBorder:    { borderTopWidth: 1, borderTopColor: THEME.slate100 },
  stepIcon:      { fontSize: 16, width: 22 },
  stepIconDone:  {},
  stepIconActive:{ },
  stepTxt:       { fontSize: 13, color: THEME.slate500, flex: 1 },
  stepTxtDone:   { color: THEME.slate700, fontWeight: "600" },
});