// This file exists only to satisfy Expo Router's file-based routing.
// The tab button is replaced by the FAB in (tabs)/_layout.tsx.
import { Redirect } from "expo-router";
export default function LogTab() {
  return <Redirect href="/(tabs)/discover" />;
}
