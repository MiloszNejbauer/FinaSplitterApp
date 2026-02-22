import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../constants/api";

interface Group {
  id: string;
  name: string;
  memberEmails: string[];
}

export default function Dashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Dodajemy tylko stan dla bilansu, bez zmiany logiki grup
  const [totalBalance, setTotalBalance] = useState(0);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const email = await AsyncStorage.getItem("userEmail");
      if (email) {
        const response = await api.get(`/groups/user/${email}`);
        console.log("DANE Z BACKENDU:", JSON.stringify(response.data, null, 2));
        setGroups(response.data);
        const balanceResponse = await api.get(
          `/expenses/user/${email}/total-balance`,
        );
        setTotalBalance(balanceResponse.data);

        // Tutaj opcjonalnie możesz dodać setTotalBalance, jeśli masz już dane,
        // ale na razie zostawiamy 0, by nie psuć widoku grup.
      }
    } catch (error) {
      console.error("Błąd pobierania grup:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ActivityIndicator size="large" color="#2ecc71" style={{ flex: 1 }} />
    );
  }

  return (
    <View style={styles.container}>
      {/* TOOLBAR NA GÓRZE */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>FinaSplitter</Text>
      </View>

      {/* SEKCJA BILANSU - PRZYKLEJONA DO LEWEJ Z ODSTĘPEM */}
      <View style={styles.balanceContainer}>
        <Text style={styles.balanceText}>
          Twój bilans:
          <Text style={{ color: totalBalance >= 0 ? "#27ae60" : "#e74c3c" }}>
            {totalBalance >= 0
              ? ` +${totalBalance.toFixed(2)}`
              : ` ${totalBalance.toFixed(2)}`}{" "}
            zł
          </Text>
        </Text>
      </View>

      <Text style={styles.header}>Twoje Grupy</Text>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.groupCard}
            onPress={() => router.push(`/group/${item.id}` as any)}
          >
            <Text style={styles.groupName}>{item.name ?? "Brak nazwy"}</Text>
            <Text style={styles.groupInfo}>
              {Array.isArray(item.memberEmails) ? item.memberEmails.length : 0}{" "}
              członków
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nie należysz jeszcze do żadnej grupy.
          </Text>
        }
        contentContainerStyle={{ paddingHorizontal: 20 }} // Odstęp dla kart
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => alert("Tu będzie tworzenie grupy")}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  toolbar: {
    height: 90,
    backgroundColor: "#fff",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  toolbarTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2ecc71",
  },
  balanceContainer: {
    marginTop: 15,
    marginLeft: 20, // Lekki odstęp od lewej krawędzi
    marginBottom: 10,
  },
  balanceText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    marginLeft: 20,
    marginBottom: 15,
    marginTop: 10,
    color: "#333",
  },
  groupCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  groupName: { fontSize: 18, fontWeight: "bold", color: "#2c3e50" },
  groupInfo: { fontSize: 14, color: "#7f8c8d", marginTop: 5 },
  empty: { textAlign: "center", marginTop: 50, color: "#999" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    backgroundColor: "#2ecc71",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 30, fontWeight: "bold" },
});
