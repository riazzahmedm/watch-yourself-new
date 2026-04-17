// ============================================================
// Tab Bar Layout — app/(tabs)/_layout.tsx
// 5 tabs: Discover | (spacer) | Library | Timeline | Profile
// Centre slot is the floating Log FAB, not a real tab.
// ============================================================

import { Tabs, useRouter } from "expo-router";
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Text,
  Platform,
} from "react-native";
import { Colors } from "@/constants/colors";
import * as Haptics from "expo-haptics";

// ---- Tab bar icons (text emoji — replace with icon library later) ---
const ICONS = {
  discover: { active: "🎭", inactive: "🎭" },
  library:  { active: "📚", inactive: "📚" },
  timeline: { active: "📅", inactive: "📅" },
  profile:  { active: "👤", inactive: "👤" },
};

export default function TabLayout() {
  const router = useRouter();

  const handleLogPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/log-sheet");
  };

  return (
    <Tabs
      screenOptions={{
        headerShown:        false,
        tabBarStyle:        styles.tabBar,
        tabBarActiveTintColor:   Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle:   styles.tabLabel,
        tabBarShowLabel:    true,
      }}
    >
      {/* ---- Discover ---------------------------------------- */}
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ICONS.discover} focused={focused} />
          ),
        }}
      />

      {/* ---- Library ----------------------------------------- */}
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ICONS.library} focused={focused} />
          ),
        }}
      />

      {/* ---- Log FAB (centre, elevated) ---------------------- */}
      <Tabs.Screen
        name="log"
        options={{
          title: "",
          tabBarButton: () => (
            <View style={styles.fabWrapper}>
              <TouchableOpacity
                style={styles.fab}
                onPress={handleLogPress}
                activeOpacity={0.85}
              >
                <Text style={styles.fabIcon}>＋</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* ---- Timeline ---------------------------------------- */}
      <Tabs.Screen
        name="timeline"
        options={{
          title: "Timeline",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ICONS.timeline} focused={focused} />
          ),
        }}
      />

      {/* ---- Profile ----------------------------------------- */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={ICONS.profile} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ icon, focused }: { icon: { active: string; inactive: string }; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {focused ? icon.active : icon.inactive}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor:  Colors.tabBar,
    borderTopColor:   Colors.border,
    borderTopWidth:   1,
    height:           Platform.OS === "ios" ? 85 : 65,
    paddingBottom:    Platform.OS === "ios" ? 28 : 8,
  },
  tabLabel: {
    fontSize:   11,
    fontWeight: "500",
  },
  fabWrapper: {
    alignItems:  "center",
    justifyContent: "center",
    top: -18,           // lift above the tab bar
    width: 70,
  },
  fab: {
    width:           58,
    height:          58,
    borderRadius:    29,
    backgroundColor: Colors.accent,
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     Colors.accent,
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.4,
    shadowRadius:    12,
    elevation:       8,
  },
  fabIcon: {
    fontSize:   26,
    color:      "#fff",
    fontWeight: "300",
  },
});
