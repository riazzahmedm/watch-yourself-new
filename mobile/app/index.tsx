import { View, ActivityIndicator } from "react-native";

// Root index — shown for a split-second while the auth guard
// in _layout.tsx resolves the session and redirects to
// /auth (unauthenticated) or /(tabs)/discover (authenticated).
export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color="#7c6af5" />
    </View>
  );
}
