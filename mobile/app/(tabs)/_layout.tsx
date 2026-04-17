// ============================================================
// Tab Bar Layout — blur background + Ionicons
// ============================================================

import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TABS: {
  name: string;
  label: string;
  icon: IoniconsName;
  iconFocused: IoniconsName;
}[] = [
  { name: "discover", label: "Discover", icon: "compass-outline",  iconFocused: "compass"  },
  { name: "library",  label: "Library",  icon: "albums-outline",   iconFocused: "albums"   },
  { name: "timeline", label: "Timeline", icon: "time-outline",     iconFocused: "time"     },
  { name: "profile",  label: "Profile",  icon: "person-outline",   iconFocused: "person"   },
];

export default function TabLayout() {
  const router = useRouter();

  const handleLogPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/log-sheet");
  };

  return (
    <Tabs
      screenOptions={{
        headerShown:           false,
        tabBarStyle:           styles.tabBar,
        tabBarBackground:      () => <TabBarBackground />,
        tabBarActiveTintColor:   Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle:      styles.tabLabel,
        tabBarShowLabel:       true,
      }}
    >
      {TABS.slice(0, 2).map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}

      {/* ── Centre FAB ─────────────────────────────────── */}
      <Tabs.Screen
        name="log"
        options={{
          title: "",
          tabBarButton: () => (
            <View style={styles.fabWrapper}>
              <TouchableOpacity
                style={styles.fabOuter}
                onPress={handleLogPress}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#9b8cf8", "#7c6af5", "#5b4dd4"]}
                  style={styles.fab}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {TABS.slice(2).map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.label,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

function TabBarBackground() {
  if (Platform.OS === "ios") {
    return (
      <BlurView
        intensity={60}
        tint="dark"
        style={[StyleSheet.absoluteFill, styles.blurBorder]}
      />
    );
  }
  // Android fallback
  return (
    <View style={[StyleSheet.absoluteFill, styles.androidBar]} />
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position:        "absolute",
    backgroundColor: "transparent",
    borderTopWidth:  0,
    elevation:       0,
    height:          Platform.OS === "ios" ? 88 : 68,
    paddingBottom:   Platform.OS === "ios" ? 28 : 10,
  },
  tabLabel: {
    fontSize:   10,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  blurBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
  },
  androidBar: {
    backgroundColor: "#08080fee",
    borderTopWidth:  1,
    borderTopColor:  Colors.border,
  },
  fabWrapper: {
    alignItems:     "center",
    justifyContent: "center",
    top:            -16,
    width:          72,
  },
  fabOuter: {
    shadowColor:   Colors.accent,
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius:  16,
    elevation:     10,
    borderRadius:  32,
  },
  fab: {
    width:          60,
    height:         60,
    borderRadius:   30,
    alignItems:     "center",
    justifyContent: "center",
  },
});
