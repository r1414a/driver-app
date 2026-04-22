import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME } from "../../constants/theme";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs 
     screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.maroon,
        tabBarInactiveTintColor: THEME.slate400,

        tabBarStyle: {
          backgroundColor: THEME.white,
          borderTopColor: THEME.slate100,
          borderTopWidth: 1,

          height: 64 + insets.bottom,   // ✅ FIX
          paddingBottom: insets.bottom, // ✅ FIX
          paddingTop: 6,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen name="home"   options={{ title: "Map",    tabBarIcon: ({ color, size }) => <Ionicons name="map"           size={size} color={color} /> }} />
      <Tabs.Screen name="trip"   options={{ title: "Trip",   tabBarIcon: ({ color, size }) => <Ionicons name="car"           size={size} color={color} /> }} />
      {/* <Tabs.Screen name="stops"  options={{ title: "Stops",  tabBarIcon: ({ color, size }) => <Ionicons name="location"      size={size} color={color} /> }} /> */}
      <Tabs.Screen name="alerts" options={{ title: "Alerts", tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} /> }} />
      <Tabs.Screen name="report" options={{ title: "Report", tabBarIcon: ({ color, size }) => <Ionicons name="warning-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}