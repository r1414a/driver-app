import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME } from "../../constants/theme";
import {View, Text} from "react-native"
import { useSelector } from "react-redux";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const alerts   = useSelector((s) => s.trip.alerts);
  const unread   = alerts.filter((a) => a.unread).length;
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
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, size }) => (
            <View style={{ width: 24, height: 24 }}>
              <Ionicons name="notifications" size={size} color={color} />

              {unread > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -8,
                    backgroundColor: "red",
                    borderRadius: 10,
                    minWidth: 16,
                    height: 16,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingHorizontal: 3,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontSize: 10,
                      fontWeight: "700",
                    }}
                  >
                    {unread}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen name="report" options={{ title: "Report", tabBarIcon: ({ color, size }) => <Ionicons name="warning-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}