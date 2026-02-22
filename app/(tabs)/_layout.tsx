import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2ecc71",
        tabBarInactiveTintColor: "#7f8c8d",
        headerShown: false, // Ukrywamy nagłówek, bo masz własny Toolbar w dashboardzie
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="friends"
        options={{
          title: "Znajomi",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Grupy",
          tabBarIcon: ({ color }) => (
            <Ionicons name="people" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: "Finanse",
          tabBarIcon: ({ color }) => (
            <Ionicons name="wallet" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Konto",
          tabBarIcon: ({ color }) => (
            <Ionicons name="id-card" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
