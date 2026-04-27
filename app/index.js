import { useState, useRef } from "react";
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { THEME } from "../constants/theme";
import { router } from "expo-router";
import { STRINGS } from "../constants/i18n";
import { requestNotificationPermission } from "../lib/notificationRequest";


export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [lang, setLang] = useState("en");
  const s = STRINGS[lang];

  const [step, setStep] = useState("phone"); // phone | otp
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const inputs = useRef([]);

  // 👉 SEND OTP
  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      alert("Enter valid phone number");
      return;
    }

    try {
      // API CALL HERE
      // await sendOtp(phone)

      setStep("otp");
    } catch (err) {
      alert("Failed to send OTP");
    }
  };

  // 👉 HANDLE OTP INPUT
  const handleOtpChange = (text, index) => {
  if (!/^\d*$/.test(text)) return;

  const newOtp = [...otp];
  newOtp[index] = text;
  setOtp(newOtp);

  if (text && index < otp.length - 1) {
    inputs.current[index + 1].focus();
  }
};

  // 👉 VERIFY OTP
  const handleVerifyOtp = async () => {
    const finalOtp = otp.join("");
    console.log(finalOtp);
    

    if (finalOtp.length !== 6) {
      alert("Enter 6 digit OTP");
      return;
    }

    try {
      // API CALL HERE
      // await verifyOtp({ phone, otp: finalOtp })

      await requestNotificationPermission();

      router.replace("/location-check");
    } catch (err) {
      console.log(err);
      
      alert("Invalid OTP");
    }
  };

  const handleKeyPress = (e, index) => {
  if (e.nativeEvent.key === "Backspace") {
    if (otp[index]) {
      // If current box has value → clear it
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
    } else if (index > 0) {
      // If empty → go to previous box
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      inputs.current[index - 1].focus();
    }
  }
};

  return (
    <KeyboardAvoidingView
      style={[S.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
    
        {/* HEADER */}
        <View style={S.header}>
          <View style={S.truckWrap}>
             <Text style={S.truckEmoji}>🚛</Text>
           </View>
          <Text style={S.heroTitle}>Fleet Driver</Text>
          <Text style={S.heroSub}>
            {step === "phone" ? "Login with phone" : "Enter OTP"}
          </Text>
        </View>

        {/* CARD */}
        <View style={S.card}>

          {step === "phone" && (
            <>
              <Text style={S.label}>Phone Number</Text>

              <TextInput
                style={S.input}
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
                keyboardType="phone-pad"
                placeholder="Enter phone"
                placeholderTextColor={THEME.slate400}
              />

              <TouchableOpacity style={S.btn} onPress={handleSendOtp}>
                <Text style={S.btnTxt}>Request OTP</Text>
              </TouchableOpacity>
            </>
          )}

          {step === "otp" && (
            <>
              <Text style={S.label}>Enter OTP</Text>

              <View style={S.otpRow}>
                {otp.map((digit, i) => (
                 <TextInput
  key={i}
  ref={(ref) => (inputs.current[i] = ref)}
  style={S.otpBox}
  value={digit}
  onChangeText={(text) => handleOtpChange(text, i)}
  onKeyPress={(e) => handleKeyPress(e, i)} // 👈 ADD THIS
  keyboardType="number-pad"
  maxLength={1}
/>
                ))}
              </View>

              <TouchableOpacity style={S.btn} onPress={handleVerifyOtp}>
                <Text style={S.btnTxt}>Verify OTP</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setStep("phone")}>
                <Text style={S.changeTxt}>Change phone number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.slate50 },
  truckWrap:    { width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 16 },

  header: {
    backgroundColor: THEME.maroon,
     paddingTop: 60, paddingBottom: 52, alignItems: "center", paddingHorizontal: 28
  },

  truckEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 26, fontWeight: "900", color: THEME.white },
  heroSub: { color: THEME.slate300, marginTop: 6 },

  card: {
    backgroundColor: THEME.white,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    color: THEME.slate700,
  },

  input: {
    borderWidth: 1.5,
    borderColor: THEME.slate200,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },

  btn: {
    backgroundColor: THEME.maroon,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  btnTxt: {
    color: THEME.white,
    fontWeight: "800",
  },

  // 🔥 OTP UI
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  otpBox: {
    width: 45,
    height: 55,
    borderWidth: 1.5,
    borderColor: THEME.slate300,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "800",
    color: THEME.maroon,
  },

  changeTxt: {
    textAlign: "center",
    marginTop: 16,
    color: THEME.blue500,
    fontWeight: "600",
  },
});