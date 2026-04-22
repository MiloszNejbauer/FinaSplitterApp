import api from "@/constants/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CURRENCIES = ["PLN", "EUR", "USD", "GBP"];

export default function ProfileScreen() {
  const [email, setEmail] = useState<string | null>(null);
  const [defaultCurrency, setDefaultCurrency] = useState<string>("PLN");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedEmail = await AsyncStorage.getItem("userEmail");
        setEmail(storedEmail);

        const response = await api.get("/users/me");

        if (response.data) {
          setEmail(response.data.email);
          setDefaultCurrency(response.data.defaultCurrency || "PLN");
          setNotificationsEnabled(response.data.notificationsEnabled || false);

          await AsyncStorage.setItem(
            "userDefaultCurrency",
            response.data.defaultCurrency,
          );
        }
      } catch (error) {
        console.error("Błąd pobierania profilu:", error);
      }
    };

    fetchUserData();
  }, []);

  const changeDefaultCurrency = async (newCurrency: string) => {
    try {
      const response = await api.patch("/users/settings/currency", {
        currency: newCurrency,
      });

      if (response.status === 200) {
        setDefaultCurrency(newCurrency);
        if (Platform.OS !== "web") {
          Alert.alert(
            "Sukces",
            `Twoja domyślna waluta to teraz ${newCurrency}`,
          );
        }
      }
    } catch (error: any) {
      Alert.alert("Błąd", "Nie udało się zmienić waluty.");
    }
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
    } catch (error) {
      console.error("Błąd zapisu powiadomień:", error);
    }
  };

  const openCurrencyMenu = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Anuluj", ...CURRENCIES],
          cancelButtonIndex: 0,
          title: "Wybierz domyślną walutę",
        },
        (buttonIndex) => {
          if (buttonIndex !== 0) {
            changeDefaultCurrency(CURRENCIES[buttonIndex - 1]);
          }
        },
      );
    } else if (Platform.OS === "web") {
      const val = window.prompt(
        "Wpisz walutę (PLN, EUR, USD, GBP):",
        defaultCurrency,
      );
      if (val && CURRENCIES.includes(val.toUpperCase())) {
        changeDefaultCurrency(val.toUpperCase());
      }
    }
  };

  const handleLogout = async () => {
    const performLogout = async () => {
      await AsyncStorage.clear();
      router.replace("/");
    };

    if (Platform.OS === "web") {
      if (window.confirm("Czy na pewno chcesz się wylogować?"))
        await performLogout();
    } else {
      Alert.alert("Wylogowanie", "Czy na pewno chcesz się wylogować?", [
        { text: "Anuluj", style: "cancel" },
        { text: "Wyloguj", style: "destructive", onPress: performLogout },
      ]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Twój Profil</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {email ? email[0].toUpperCase() : "?"}
            </Text>
          </View>
          <Text style={styles.userEmail}>{email || "Ładowanie..."}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferencje</Text>

          <View style={styles.menuItem}>
            <Text style={styles.menuItemText}>Domyślna waluta</Text>
            {Platform.OS === "android" ? (
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={defaultCurrency}
                  onValueChange={(val) => changeDefaultCurrency(val)}
                  style={styles.androidPicker}
                  dropdownIconColor="#2ecc71"
                >
                  {CURRENCIES.map((c) => (
                    <Picker.Item key={c} label={c} value={c} />
                  ))}
                </Picker>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.iosSelector}
                onPress={openCurrencyMenu}
              >
                <Text style={styles.iosSelectorText}>{defaultCurrency}</Text>
                <Text style={styles.iosSelectorArrow}>▾</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.menuItem}>
            <Text style={styles.menuItemText}>Powiadomienia</Text>
            <Switch
              trackColor={{ false: "#dcdde1", true: "#2ecc71" }}
              thumbColor={
                Platform.OS === "ios"
                  ? "#fff"
                  : notificationsEnabled
                    ? "#fff"
                    : "#f4f3f4"
              }
              ios_backgroundColor="#dcdde1"
              onValueChange={toggleNotifications}
              value={notificationsEnabled}
            />
          </View>
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
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  scrollContent: { padding: 20, alignItems: "center" },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    alignSelf: "flex-start",
    marginBottom: 30,
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
  avatarText: { fontSize: 40, color: "#fff", fontWeight: "bold" },
  userEmail: { fontSize: 18, fontWeight: "600", color: "#333" },
  section: { width: "100%", marginBottom: 30 },
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
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  menuItemText: { fontSize: 16, color: "#2c3e50" },
  chevron: { fontSize: 20, color: "#bdc3c7" },
  iosSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f2f5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  iosSelectorText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#2ecc71",
    marginRight: 4,
  },
  iosSelectorArrow: {
    fontSize: 12,
    color: "#7f8c8d",
  },
  pickerWrapper: {
    width: 100,
    height: 40,
    justifyContent: "center",
  },
  androidPicker: {
    width: "100%",
    color: "#2ecc71",
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
  logoutButtonText: { color: "#e74c3c", fontSize: 16, fontWeight: "bold" },
  footerText: { marginTop: 40, color: "#bdc3c7", fontSize: 12 },
});
