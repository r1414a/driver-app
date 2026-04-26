// import { useState } from "react";
// import {
//   ActivityIndicator, KeyboardAvoidingView, Platform,
//   ScrollView, StyleSheet, Text, TextInput,
//   TouchableOpacity, View,
// } from "react-native";
// import { useSafeAreaInsets } from "react-native-safe-area-context";
// import { Controller, useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { loginSchema } from "../lib/schemas";
// import { router } from "expo-router";
// import { useDispatch } from "react-redux";
// import { setAuth } from "../store/authSlice";
// import { useLoginMutation } from "../store/driverApi";
// import { STRINGS } from "../constants/i18n";
// import { THEME } from "../constants/theme";
 
// export default function LoginScreen() {
//   const insets   = useSafeAreaInsets();
//   const dispatch = useDispatch();
//   const [lang, setLang] = useState("en");
//   const s = STRINGS[lang];
 
// //   const [login, { isLoading }] = useLoginMutation();
 
//   const { control, handleSubmit, setError, formState: { errors } } = useForm({
//     resolver: zodResolver(loginSchema),
//     defaultValues: { phone: "", pin: "" },
//   });
 
//   const onSubmit = async (data) => {
//     try {
//     //   const result = await login({ phone: data.phone, pin: data.pin }).unwrap();
//     //   dispatch(setAuth({ token: result.token, driver: result.driver }));
//       router.replace("/location-check");
//     } catch (err) {
//       setError("pin", { message: err?.data?.message ?? s.wrong_pin });
//     }
//   };
 
//   return (
//     <KeyboardAvoidingView
//       style={[S.root, { paddingTop: insets.top }]}
//       behavior={Platform.OS === "ios" ? "padding" : "height"}
//     >
//       <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
 
//         {/* // HERO HEADER */}
//         <View style={S.header}>
//           <View style={S.truckWrap}>
//             <Text style={S.truckEmoji}>🚛</Text>
//           </View>
//           <Text style={S.heroTitle}>{s.app_name}</Text>
//           <Text style={S.heroSub}>{s.app_sub}</Text>
//           {/* // Language switcher */}
//           <View style={S.langRow}>
//             {["en","mr","hi"].map(code => (
//               <TouchableOpacity
//                 key={code}
//                 onPress={() => setLang(code)}
//                 style={[S.langBtn, lang === code && S.langBtnActive]}
//               >
//                 <Text style={[S.langTxt, lang === code && S.langTxtActive]}>
//                   {code === "en" ? "EN" : code === "mr" ? "मराठी" : "हिंदी"}
//                 </Text>
//               </TouchableOpacity>
//             ))}
//           </View>
//         </View>
 
//         {/* // FORM CARD */}
//         <View style={[S.formCard, { paddingBottom: insets.bottom + 32 }]}>
//           <Text style={S.formTitle}>Driver Login</Text>
//           <Text style={S.formSub}>Enter your phone number and PIN to continue</Text>
 
//           {/* // Phone */}
//           <Text style={S.label}>{s.phone_label}</Text>
//           <Controller
//             control={control}
//             name="phone"
//             render={({ field: { onChange, value, onBlur } }) => (
//               <TextInput
//                 style={[S.input, errors.phone && S.inputErr]}
//                 value={value}
//                 onChangeText={onChange}
//                 onBlur={onBlur}
//                 placeholder={s.phone_ph}
//                 placeholderTextColor={THEME.slate400}
//                 keyboardType="phone-pad"
//                 returnKeyType="next"
//               />
//             )}
//           />
//           {errors.phone && <Text style={S.errTxt}>{errors.phone.message}</Text>}
 
//           {/* // PIN */}
//           <Text style={S.label}>{s.pin_label}</Text>
//           <Controller
//             control={control}
//             name="pin"
//             render={({ field: { onChange, value, onBlur } }) => (
//               <TextInput
//                 style={[S.input, S.pinInput, errors.pin && S.inputErr]}
//                 value={value}
//                 onChangeText={v => onChange(v.replace(/\D/g, "").slice(0, 4))}
//                 onBlur={onBlur}
//                 placeholder="••••"
//                 placeholderTextColor={THEME.slate300}
//                 keyboardType="number-pad"
//                 maxLength={4}
//                 secureTextEntry
//                 textAlign="center"
//                 returnKeyType="done"
//                 onSubmitEditing={handleSubmit(onSubmit)}
//               />
//             )}
//           />
//           {errors.pin && <Text style={S.errTxt}>{errors.pin.message}</Text>}
 
//           {/* // Submit */}
//           <TouchableOpacity
//             style={[S.btn]}
//             // style={[S.btn, isLoading && S.btnOff]}
//             onPress={handleSubmit(onSubmit)}
//             // disabled={isLoading}
//             activeOpacity={0.87}
//           >
//             {/* {isLoading
//               ? <ActivityIndicator color={THEME.white} /> */}
//               {/* :  */}
//               <Text style={S.btnTxt}>{s.login_btn}</Text>
//             {/* } */}
//           </TouchableOpacity>
 
//           {/* // Info */}
//           <View style={S.infoCard}>
//             <Text style={S.infoTxt}>
//               💡 Your DC operator creates your trip and sets your PIN before each shift.
//             </Text>
//           </View>
//         </View>
//       </ScrollView>
//     </KeyboardAvoidingView>
//   );
// }
 
// const S = StyleSheet.create({
//   root:         { flex: 1, backgroundColor: THEME.slate50 },
//   header:       { backgroundColor: THEME.maroon, paddingTop: 60, paddingBottom: 52, alignItems: "center", paddingHorizontal: 28 },
//   truckWrap:    { width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
//   truckEmoji:   { fontSize: 42 },
//   heroTitle:    { fontSize: 30, fontWeight: "900", color: THEME.white, letterSpacing: -0.5 },
//   heroSub:      { fontSize: 14, color: "rgba(255,255,255,0.65)", marginTop: 4, marginBottom: 24 },
//   langRow:      { flexDirection: "row", gap: 8 },
//   langBtn:      { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" },
//   langBtnActive:{ backgroundColor: THEME.white, borderColor: THEME.white },
//   langTxt:      { fontSize: 12, fontWeight: "700", color: THEME.white },
//   langTxtActive:{ color: THEME.maroon },
//   formCard:     { flex: 1, backgroundColor: THEME.white, marginTop: -16, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 28, paddingTop: 32 },
//   formTitle:    { fontSize: 22, fontWeight: "800", color: THEME.slate900, marginBottom: 4 },
//   formSub:      { fontSize: 13, color: THEME.slate500, marginBottom: 28, lineHeight: 18 },
//   label:        { fontSize: 13, fontWeight: "700", color: THEME.slate700, marginBottom: 8 },
//   input:        { borderWidth: 1.5, borderColor: THEME.slate200, borderRadius: 14, padding: 16, fontSize: 16, color: THEME.slate900, backgroundColor: THEME.slate50, marginBottom: 6 },
//   inputErr:     { borderColor: THEME.red500 },
//   pinInput:     { fontSize: 24, fontWeight: "800", letterSpacing: 12, color: THEME.maroon },
//   btn:          { backgroundColor: THEME.maroon, paddingVertical: 17, borderRadius: 16, alignItems: "center", marginTop: 20, elevation: 4, shadowColor: THEME.maroon, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
//   btnOff:       { backgroundColor: THEME.slate300, elevation: 0, shadowOpacity: 0 },
//   btnTxt:       { color: THEME.white, fontSize: 16, fontWeight: "800" },
//   errTxt:       { color: THEME.red500, fontSize: 12, marginBottom: 8 },
//   infoCard:     { marginTop: 28, backgroundColor: "#fef9ec", borderRadius: 14, borderWidth: 1, borderColor: "#fde68a", padding: 16 },
//   infoTxt:      { fontSize: 13, color: "#92400e", lineHeight: 20 },
// });


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