import api from "@/constants/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Group {
  id: string;
  name: string;
  members?: any[];
  memberEmails: string[];
  balances?: { [key: string]: number };
  userBalance?: number;
}

export default function Dashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const [totalBalance, setTotalBalance] = useState<Record<string, number>>({});

  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, []),
  );

  const fetchGroups = async () => {
    try {
      const email = await AsyncStorage.getItem("userEmail");
      if (email) {
        const userEmail = email.toLowerCase();

        const response = await api.get(
          `/groups/user/${userEmail}/with-balances`,
        );
        const fetchedGroups: Group[] = response.data;

        setGroups(fetchedGroups);

        const calculatedTotalBalance: Record<string, number> = {};

        fetchedGroups.forEach((group) => {
          if (group.balances) {
            Object.entries(group.balances).forEach(([currency, amount]) => {
              if (!calculatedTotalBalance[currency]) {
                calculatedTotalBalance[currency] = 0;
              }
              calculatedTotalBalance[currency] += amount;
            });
          }
        });

        setTotalBalance(calculatedTotalBalance);
      }
    } catch (error) {
      console.error("Błąd pobierania danych:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
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

      const response = await api.post("/groups/create", {
        name: newGroupName,
        creatorEmail: email,
      });

      if (response.status === 200 || response.status === 201) {
        setModalVisible(false);
        setNewGroupName("");
        fetchGroups();
      }
    } catch (error) {
      console.error("Błąd tworzenia grupy:", error);
      alert("Błąd, Nie udało się utworzyć grupy");
    } finally {
      setIsCreating(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchGroups();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.toolbar, { paddingTop: insets.top }]}>
        <Text style={styles.toolbarTitle}>FinaSplitter</Text>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={styles.balanceText}>Twój bilans całkowity:</Text>
        {Object.keys(totalBalance).length > 0 ? (
          Object.entries(totalBalance).map(([currency, value]) => (
            <Text key={currency} style={styles.balanceValueText}>
              <Text style={{ color: value >= 0 ? "#27ae60" : "#e74c3c" }}>
                {value >= 0 ? `+${value.toFixed(2)}` : `${value.toFixed(2)}`}{" "}
                {currency}
              </Text>
            </Text>
          ))
        ) : (
          <Text style={[styles.balanceValueText, { color: "#95a5a6" }]}>
            0.00 PLN
          </Text>
        )}
      </View>

      <Text style={styles.header}>Twoje Grupy</Text>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => {
          const groupCurrencyKeys = item.balances
            ? Object.keys(item.balances)
            : [];

          return (
            <TouchableOpacity
              style={styles.groupCard}
              onPress={() => router.push(`/group/${item.id}` as any)}
            >
              <View style={styles.groupCardContent}>
                <View style={styles.groupLeftInfo}>
                  <Text style={styles.groupName}>
                    {item.name ?? "Brak nazwy"}
                  </Text>
                  <Text style={styles.groupInfo}>
                    {Array.isArray(item.members)
                      ? item.members.length
                      : Array.isArray(item.memberEmails)
                        ? item.memberEmails.length
                        : 0}{" "}
                    członków
                  </Text>
                </View>

                <View style={styles.groupBalanceContainer}>
                  <Text style={styles.balanceLabelSmall}>Twój stan</Text>
                  {groupCurrencyKeys.length > 0 ? (
                    groupCurrencyKeys.map((curr) => {
                      const val = item.balances![curr];
                      return (
                        <Text
                          key={curr}
                          style={[
                            styles.groupBalanceAmount,
                            { color: val >= 0 ? "#27ae60" : "#e74c3c" },
                          ]}
                        >
                          {val >= 0
                            ? `+${val.toFixed(2)}`
                            : `${val.toFixed(2)}`}{" "}
                          {curr}
                        </Text>
                      );
                    })
                  ) : (
                    <Text
                      style={[styles.groupBalanceAmount, { color: "#95a5a6" }]}
                    >
                      0.00 PLN
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nie należysz jeszcze do żadnej grupy.
          </Text>
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
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
              placeholderTextColor="#999"
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

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>Nowa grupa</Text>
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
    backgroundColor: "#fff",
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 15,
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
    marginLeft: 20,
    marginBottom: 10,
    minHeight: 40,
  },
  balanceText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  balanceValueText: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 2,
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
    backgroundColor: "#2ecc71",
    paddingHorizontal: 20,
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  groupCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  groupLeftInfo: {
    flex: 1,
  },
  groupBalanceContainer: {
    alignItems: "flex-end",
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
