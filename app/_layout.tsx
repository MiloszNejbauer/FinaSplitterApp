import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    // SafeAreaProvider musi owijać całą nawigację
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Główny stos nawigacji - tutaj Expo Router sam znajdzie folder (tabs) */}
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
