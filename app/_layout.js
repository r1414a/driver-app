import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { store } from "../store/store";
import { useEffect } from "react";
// import { useDispatch } from "react-redux";
// import { restoreAuth } from "../store/authSlice";
 
function AppContent() {
  // const dispatch = useDispatch();
  // useEffect(() => { dispatch(restoreAuth()); }, []);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="location-check" />
      <Stack.Screen name="trip-complete" />
    </Stack>
  );
}
 
export default function RootLayout() {
  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" backgroundColor="#701a40" />
          <AppContent />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </Provider>
  );
}