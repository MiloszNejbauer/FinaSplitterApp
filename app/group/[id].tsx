import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../constants/api";

interface Expense {
  id: string;
  description: string;
  totalAmount: number;
  paidById: string;
}

export default function GroupDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Stany danych grupy
  const [groupName, setGroupName] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Stany formularza wydatku
  const [isModalVisible, setModalVisible] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedPaidBy, setSelectedPaidBy] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    [],
  );
  const [sharesPercent, setSharesPercent] = useState<Record<string, string>>(
    {},
  );
  const [isCustomSplit, setIsCustomSplit] = useState(false);

  useEffect(() => {
    fetchEverything();
  }, [id]);

  useEffect(() => {
    if (!isCustomSplit && selectedParticipants.length > 0) {
      const equalShare = (100 / selectedParticipants.length).toFixed(2);
      const newShares: Record<string, string> = {};
      selectedParticipants.forEach((email) => {
        newShares[email] = equalShare;
      });
      setSharesPercent(newShares);
    }
  }, [selectedParticipants, isCustomSplit]); // Uruchamia się przy zmianie osób lub trybu

  const getRemainingPercent = () => {
    const totalUsed = Object.values(sharesPercent).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0,
    );
    return 100 - totalUsed; // Zwracamy liczbę (number)
  };

  const fetchEverything = async () => {
    try {
      setLoading(true);
      const [groupRes, expensesRes, balancesRes] = await Promise.all([
        api.get(`groups/${id}`),
        api.get(`expenses/group/${id}`),
        api.get(`expenses/group/${id}/balances`),
      ]);

      setGroupName(groupRes.data.name);
      setExpenses(expensesRes.data);
      setBalances(balancesRes.data);

      const members = groupRes.data.memberEmails || [];
      setGroupMembers(members);

      // Inicjalizacja formularza domyślnymi wartościami
      if (members.length > 0) {
        setSelectedPaidBy(members[0]);
        setSelectedParticipants(members);
      }
    } catch (error) {
      console.error("Błąd pobierania danych:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (email: string) => {
    if (selectedParticipants.includes(email)) {
      setSelectedParticipants(selectedParticipants.filter((e) => e !== email));
    } else {
      setSelectedParticipants([...selectedParticipants, email]);
    }
  };

  const handleAddExpense = async () => {
    const remaining = getRemainingPercent();
    if (remaining !== 0) {
      Alert.alert(
        "Błąd",
        `Suma procentów musi wynosić 100%. Brakuje: ${remaining}%`,
      );
      return;
    }

    try {
      const total = parseFloat(amount);
      const shares: Record<string, number> = {};

      selectedParticipants.forEach((email) => {
        const percent = parseFloat(sharesPercent[email]) || 0;
        shares[email] = (percent / 100) * total;
      });

      const expenseRequest = {
        description,
        totalAmount: total,
        paidById: selectedPaidBy,
        groupId: id,
        participantShares: shares,
      };

      await api.post("/expenses/add", expenseRequest);
      setModalVisible(false);
      fetchEverything();
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się dodać wydatku");
    }
  };

  if (loading)
    return (
      <ActivityIndicator size="large" color="#2ecc71" style={{ flex: 1 }} />
    );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Powrót do listy</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{groupName}</Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Bilans grupy</Text>
          {Object.entries(balances).map(([email, amount]) => (
            <View key={email} style={styles.balanceRow}>
              <Text style={styles.emailText}>{email}</Text>
              <Text
                style={[
                  styles.amountText,
                  { color: amount >= 0 ? "#27ae60" : "#e74c3c" },
                ]}
              >
                {amount >= 0 ? `+${amount.toFixed(2)}` : amount.toFixed(2)} zł
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Wydatki</Text>
        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>Brak wydatków w tej grupie</Text>
        ) : (
          expenses.map((item) => (
            <View key={item.id} style={styles.expenseCard}>
              <View>
                <Text style={styles.expenseDesc}>{item.description}</Text>
                <Text style={styles.expenseSub}>Płacił: {item.paidById}</Text>
              </View>
              <Text style={styles.expenseAmount}>
                {(item.totalAmount || 0).toFixed(2)} zł
              </Text>
            </View>
          ))
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nowy wydatek</Text>

              <TextInput
                style={styles.input}
                placeholder="Opis (np. Pizza)"
                value={description}
                onChangeText={setDescription}
              />
              <TextInput
                style={styles.input}
                placeholder="Kwota (zł)"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              <Text style={styles.label}>Kto płacił?</Text>
              <View style={styles.chipContainer}>
                {groupMembers.map((email) => (
                  <TouchableOpacity
                    key={email}
                    style={[
                      styles.chip,
                      selectedPaidBy === email && styles.chipSelectedPayer,
                    ]}
                    onPress={() => setSelectedPaidBy(email)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedPaidBy === email && styles.chipTextSelected,
                      ]}
                    >
                      {email}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Kto uczestniczy?</Text>
              <View style={styles.chipContainer}>
                {groupMembers.map((email) => (
                  <TouchableOpacity
                    key={email}
                    style={[
                      styles.chip,
                      selectedParticipants.includes(email) &&
                        styles.chipSelectedParticipant,
                    ]}
                    onPress={() => toggleParticipant(email)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedParticipants.includes(email) &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {email}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* PRZYCISK TRYBU PODZIAŁU */}
              <TouchableOpacity
                style={styles.modeButton}
                onPress={() => setIsCustomSplit(!isCustomSplit)}
              >
                <Text style={styles.modeButtonText}>
                  {isCustomSplit
                    ? "← Przywróć równy podział"
                    : "⚙️ Podział niestandardowy (%)"}
                </Text>
              </TouchableOpacity>

              {/* LISTA PROCENTÓW (widoczna tylko w trybie niestandardowym) */}
              {isCustomSplit && (
                <View style={styles.customSplitBox}>
                  <Text>
                    Zostało do rozdzielenia: {getRemainingPercent().toFixed(2)}%
                  </Text>
                  {selectedParticipants.map((email) => (
                    <View key={email} style={styles.participantRow}>
                      <Text style={styles.participantEmailSmall}>{email}</Text>
                      <View style={styles.percentInputContainer}>
                        <TextInput
                          style={styles.percentInput}
                          keyboardType="numeric"
                          value={sharesPercent[email]}
                          onChangeText={(val) => {
                            const numVal = parseFloat(val) || 0;
                            const otherTotal = Object.entries(sharesPercent)
                              .filter(([key]) => key !== email)
                              .reduce(
                                (sum, [_, v]) => sum + (parseFloat(v) || 0),
                                0,
                              );

                            if (numVal + otherTotal <= 100) {
                              setSharesPercent({
                                ...sharesPercent,
                                [email]: val,
                              });
                            }
                          }}
                        />
                        <Text style={{ fontWeight: "bold" }}>%</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Anuluj</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleAddExpense}
                >
                  <Text style={styles.buttonText}>Dodaj</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    padding: 20,
    paddingTop: 60,
  },
  backButton: { marginBottom: 10 },
  backText: { color: "#2ecc71", fontWeight: "bold" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 25,
    color: "#1a1a1a",
  },
  sectionCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 25,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#444",
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  emailText: { color: "#555", fontSize: 13 },
  amountText: { fontWeight: "bold" },
  expenseCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  expenseDesc: { fontSize: 16, fontWeight: "500" },
  expenseSub: { fontSize: 12, color: "#888" },
  expenseAmount: { fontSize: 16, fontWeight: "bold" },
  emptyText: { textAlign: "center", color: "#aaa", marginTop: 10 },
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
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "90%",
    maxHeight: "80%",
    padding: 25,
    borderRadius: 15,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#eee",
  },
  label: { fontSize: 14, fontWeight: "bold", marginBottom: 10, color: "#666" },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 15 },
  chip: {
    backgroundColor: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  chipSelectedPayer: { backgroundColor: "#2ecc71", borderColor: "#27ae60" },
  chipSelectedParticipant: {
    backgroundColor: "#3498db",
    borderColor: "#2980b9",
  },
  chipText: { fontSize: 11, color: "#666" },
  chipTextSelected: { color: "#fff", fontWeight: "bold" },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButton: {
    flex: 0.45,
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: { backgroundColor: "#95a5a6" },
  saveButton: { backgroundColor: "#2ecc71" },
  buttonText: { color: "#fff", fontWeight: "bold" },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  percentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  percentInput: {
    width: 40,
    paddingVertical: 5,
    textAlign: "center",
    fontWeight: "bold",
  },
  participantsList: {
    marginBottom: 20,
  },
  modeButton: {
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 15,
    alignItems: "center",
  },
  modeButtonText: {
    color: "#2c3e50",
    fontSize: 13,
    fontWeight: "600",
  },
  customSplitBox: {
    backgroundColor: "#f9f9f9",
    padding: 10,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#eee",
  },
  remainingText: {
    fontSize: 12,
    color: "#e67e22",
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "right",
  },
  participantEmailSmall: {
    fontSize: 12,
    color: "#555",
    flex: 1,
  },
});
