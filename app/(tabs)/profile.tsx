import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // Nowoczesne podejście

export default function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets(); // Pobieramy bezpieczne marginesy urządzenia

  useEffect(() => {
    const loadUser = async () => {
      const storedEmail = await AsyncStorage.getItem("userEmail");
      setEmail(storedEmail);
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    console.log("Próba wylogowania na platformie:", Platform.OS);

    const performLogout = async () => {
      await AsyncStorage.removeItem("userEmail");
      router.replace("/");
    };

    if (Platform.OS === "web") {
      // W przeglądarce używamy standardowego confirm()
      if (window.confirm("Czy na pewno chcesz się wylogować?")) {
        await performLogout();
      }
    } else {
      // Na telefonie używamy ładnego Alert.alert
      Alert.alert("Wylogowanie", "Czy na pewno chcesz się wylogować?", [
        { text: "Anuluj", style: "cancel" },
        { text: "Wyloguj", style: "destructive", onPress: performLogout },
      ]);
    }
  };

  return (
    // Używamy zwykłego View z dynamicznym paddingiem z insets
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Twój Profil</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {email ? email.toUpperCase() : "?"}
            </Text>
          </View>
          <Text style={styles.userEmail}>{email || "Ładowanie..."}</Text>
          <Text style={styles.backendStatus}>Połączono z API Spring Boot</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zarządzanie kontem</Text>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/friends")}
          >
            <Text style={styles.menuItemText}>👥 Zarządzaj znajomymi</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert("FinaSplitter", "Historia transakcji wkrótce")
            }
          >
            <Text style={styles.menuItemText}>📊 Historia rozliczeń</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Wyloguj się</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          FinaSplitter v1.0 | Spring Boot & MongoDB
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollContent: {
    padding: 20,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    alignSelf: "flex-start",
    marginBottom: 30,
    marginTop: 10,
    color: "#2c3e50",
  },
  profileCard: {
    backgroundColor: "#fff",
    width: "100%",
    padding: 25,
    borderRadius: 20,
    alignItems: "center",
    marginBottom: 25,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#2ecc71",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 40,
    color: "#fff",
    fontWeight: "bold",
  },
  userEmail: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  backendStatus: {
    fontSize: 12,
    color: "#7f8c8d",
    marginTop: 5,
  },
  section: {
    width: "100%",
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    color: "#95a5a6",
    fontWeight: "bold",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  menuItem: {
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 12,
    marginBottom: 10,
  },
  menuItemText: {
    fontSize: 16,
    color: "#2c3e50",
  },
  chevron: {
    fontSize: 20,
    color: "#bdc3c7",
  },
  logoutButton: {
    width: "100%",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e74c3c",
    marginTop: 10,
  },
  logoutButtonText: {
    color: "#e74c3c",
    fontSize: 16,
    fontWeight: "bold",
  },
  footerText: {
    marginTop: 40,
    color: "#bdc3c7",
    fontSize: 12,
  },
});
