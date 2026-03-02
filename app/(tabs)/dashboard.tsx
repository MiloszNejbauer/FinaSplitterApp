import api from "@/constants/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Group {
  id: string;
  name: string;
  memberEmails: string[];
  userBalance?: number;
}

export default function Dashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
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
        const response = await api.get(`/groups/user/${email}/with-balances`);
        console.log("DANE Z BACKENDU:", JSON.stringify(response.data, null, 2));
        setGroups(response.data);
        const balanceResponse = await api.get(
          `/expenses/user/${email}/total-balance`,
        );
        setTotalBalance(balanceResponse.data);
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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      alert("Błąd, Nazwa grupy nie może być pusta");
      return;
    }

    try {
      setIsCreating(true);
      const email = await AsyncStorage.getItem("userEmail");

      // Korzystamy z Twojego endpointu @PostMapping("/create")
      // Zauważ, że używamy params, bo w kontrolerze masz @RequestParam
      const response = await api.post("/groups/create", null, {
        params: {
          name: newGroupName,
          creatorEmail: email,
        },
      });

      if (response.status === 200) {
        setModalVisible(false);
        setNewGroupName("");
        fetchGroups(); // Odświeżamy listę grup
      }
    } catch (error) {
      console.error("Błąd tworzenia grupy:", error);
      alert("Błąd, Nie udało się utworzyć grupy");
    } finally {
      setIsCreating(false);
    }
  };

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
            <View style={styles.groupCardContent}>
              {/* LEWA STRONA: Nazwa i liczba członków */}
              <View style={styles.groupLeftInfo}>
                <Text style={styles.groupName}>
                  {item.name ?? "Brak nazwy"}
                </Text>
                <Text style={styles.groupInfo}>
                  {Array.isArray(item.memberEmails)
                    ? item.memberEmails.length
                    : 0}{" "}
                  członków
                </Text>
              </View>

              {/* PRAWA STRONA: Bilans użytkownika */}
              <View style={styles.groupBalanceContainer}>
                <Text style={styles.balanceLabelSmall}>Twój stan</Text>
                <Text
                  style={[
                    styles.groupBalanceAmount,
                    {
                      color:
                        (item.userBalance ?? 0) >= 0 ? "#27ae60" : "#e74c3c",
                    },
                  ]}
                >
                  {(item.userBalance ?? 0) >= 0
                    ? `+${(item.userBalance ?? 0).toFixed(2)}`
                    : `${(item.userBalance ?? 0).toFixed(2)}`}{" "}
                  zł
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nie należysz jeszcze do żadnej grupy.
          </Text>
        }
        contentContainerStyle={{ paddingHorizontal: 20 }} // Odstęp dla kart
      />

      {/* MODAL DO TWORZENIA GRUPY */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nowa grupa</Text>

            <TextInput
              style={styles.input}
              placeholder="Nazwa grupy (np. Wyjazd Kraków)"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Anuluj</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateGroup}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Utwórz</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Zmieniamy onPress w FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
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
  groupCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  groupLeftInfo: {
    flex: 1, // Zajmuje całą dostępną przestrzeń po lewej
  },
  groupBalanceContainer: {
    alignItems: "flex-end", // Wyrównanie tekstu do prawej
    marginLeft: 10,
  },
  balanceLabelSmall: {
    fontSize: 10,
    color: "#999",
    textTransform: "uppercase",
    marginBottom: 2,
    fontWeight: "600",
  },
  groupBalanceAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "85%",
    borderRadius: 20,
    padding: 25,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 0.48,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f1f2f6",
  },
  createButton: {
    backgroundColor: "#2ecc71",
  },
  cancelButtonText: {
    color: "#7f8c8d",
    fontWeight: "600",
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
