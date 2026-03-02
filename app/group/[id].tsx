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
  isSettlement: boolean;
  createdAt: Date;
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

  //Stany dodawania uzytkownikow
  const [isAddUserModalVisible, setAddUserModalVisible] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);

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

  // Stany rozliczania
  const [isSettleModalVisible, setSettleModalVisible] = useState(false);
  const [settleFrom, setSettleFrom] = useState(""); // Dłużnik
  const [settleTo, setSettleTo] = useState(""); // Odbiorca
  const [settleAmount, setSettleAmount] = useState("");

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
    const diff = 100 - totalUsed;
    // Jeśli różnica jest mniejsza niż 0.05%, uznajemy, że jest to 100%
    return Math.abs(diff) < 0.05 ? 0 : diff;
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
        `Suma procentów musi wynosić 100%. Aktualnie brakuje: ${remaining.toFixed(2)}%`,
      );
      return;
    }

    try {
      const total = parseFloat(amount);
      if (isNaN(total)) {
        Alert.alert("Błąd", "Wprowadź poprawną kwotę");
        return;
      }

      const shares: Record<string, number> = {};
      let allocatedAmount = 0;

      selectedParticipants.forEach((email, index) => {
        if (index === selectedParticipants.length - 1) {
          // Ostatnia osoba otrzymuje "resztę" (np. 100 - 33.33 - 33.33 = 33.34)
          shares[email] = parseFloat((total - allocatedAmount).toFixed(2));
        } else {
          const percent = parseFloat(sharesPercent[email]) || 0;
          const memberShare = parseFloat(((percent / 100) * total).toFixed(2));
          shares[email] = memberShare;
          allocatedAmount += memberShare;
        }
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
      // Reset formularza
      setDescription("");
      setAmount("");
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się dodać wydatku");
    }
  };

  // FUNKCJA DODAWANIA UŻYTKOWNIKA
  const handleAddUser = async () => {
    if (!newUserEmail.trim() || !newUserEmail.includes("@")) {
      Alert.alert("Błąd", "Wprowadź poprawny adres e-mail");
      return;
    }

    try {
      setIsAddingUser(true);

      // Korzystamy z Twojego endpointu: @PostMapping("/{groupId}/add-user")
      const response = await api.post(`/groups/${id}/add-user`, null, {
        params: { email: newUserEmail.trim() },
      });

      if (response.status === 200) {
        Alert.alert("Sukces", "Użytkownik został dodany do grupy");
        setAddUserModalVisible(false);
        setNewUserEmail("");
        fetchEverything(); // Odświeżamy dane grupy, aby zobaczyć nowego członka
      }
    } catch (error: any) {
      // Obsługa błędu "Użytkownik o takim mailu nie istnieje" z Twojego serwisu
      const errorMsg =
        error.response?.data || "Wystąpił błąd podczas dodawania użytkownika";
      Alert.alert("Błąd", errorMsg);
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleSettleUp = async () => {
    if (!settleFrom || !settleTo || !settleAmount) {
      Alert.alert("Błąd", "Wypełnij wszystkie pola");
      return;
    }
    try {
      await api.post("/expenses/settle", null, {
        params: {
          groupId: id,
          fromEmail: settleFrom,
          toEmail: settleTo,
          amount: parseFloat(settleAmount),
        },
      });
      // RESET STANÓW
      setSettleModalVisible(false);
      setSettleFrom("");
      setSettleTo("");
      setSettleAmount("");

      fetchEverything();
      Alert.alert("Sukces", "Rozliczenie zapisane");
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się zapisać rozliczenia");
    }
  };

  const openSettleWithData = (email: string, amount: number) => {
    setSettleFrom("");
    setSettleTo("");
    setSettleAmount("");

    if (amount < 0) {
      setSettleFrom(email);
      // Nie ustawiamy kwoty od razu, poczekamy aż użytkownik wybierze komu oddaje
    } else if (amount > 0) {
      setSettleTo(email);
      // Jeśli kliknęliśmy osobę na plusie, ustawiamy ją jako odbiorcę
      // Kwota zostanie zasugerowana, gdy wybierzemy dłużnika
    }

    setSettleModalVisible(true);
  };

  const handleSelectToEmail = (toEmail: string) => {
    setSettleTo(toEmail);

    // Jeśli mamy już dłużnika (settleFrom), obliczamy sugerowaną kwotę
    if (settleFrom) {
      const fromBalance = balances[settleFrom] || 0; // ile dłużnik ma na minusie (np. -50)
      const toBalance = balances[toEmail] || 0; // ile odbiorca ma na plusie (np. 30)

      // Logika: Chcemy oddać tyle, ile dłużnik jest winien,
      // ALE nie więcej niż odbiorca ma do odzyskania.
      // Kwota = mniejsza z wartości bezwzględnych długu i nadpłaty.
      if (fromBalance < 0 && toBalance > 0) {
        const suggestion = Math.min(Math.abs(fromBalance), toBalance);
        setSettleAmount(suggestion.toFixed(2));
      } else if (fromBalance < 0) {
        // Jeśli odbiorca nie ma nadpłaty, sugerujemy po prostu spłatę całego długu dłużnika
        setSettleAmount(Math.abs(fromBalance).toFixed(2));
      }
    }
  };

  const swapSettleSides = () => {
    const tempFrom = settleFrom;
    setSettleFrom(settleTo);
    setSettleTo(tempFrom);
  };

  if (loading)
    return (
      <ActivityIndicator size="large" color="#2ecc71" style={{ flex: 1 }} />
    );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <TouchableOpacity
          onPress={() => router.push("/dashboard")}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Powrót do listy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addUserButton}
          onPress={() => setAddUserModalVisible(true)}
        >
          <Text style={styles.addUserButtonText}>+ Dodaj osobę</Text>
        </TouchableOpacity>

        {/* MODAL DODAWANIA UŻYTKOWNIKA */}
        <Modal
          visible={isAddUserModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setAddUserModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Dodaj członka</Text>
              <Text style={styles.modalSubtitle}>
                Wpisz e-mail osoby, którą chcesz dodać do tej grupy.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="email@przyklad.pl"
                value={newUserEmail}
                onChangeText={setNewUserEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setAddUserModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Anuluj</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.createButton]}
                  onPress={handleAddUser}
                  disabled={isAddingUser}
                >
                  {isAddingUser ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.createButtonText}>Dodaj</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={isSettleModalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Rozlicz się</Text>

              <Text style={styles.label}>Kto oddaje pieniądze?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipContainer}
              >
                {groupMembers.map((email) => (
                  <TouchableOpacity
                    key={email}
                    style={[
                      styles.chip,
                      settleFrom === email && styles.chipSelectedParticipant,
                    ]}
                    onPress={() => setSettleFrom(email)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        settleFrom === email && styles.chipTextSelected,
                      ]}
                    >
                      {email}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* PRZYCISK ZAMIANY STRON */}
              <TouchableOpacity
                style={styles.swapButton}
                onPress={swapSettleSides}
              >
                <Text style={styles.swapButtonText}>⇅ Zamień strony</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Komu oddaje?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipContainer}
              >
                {groupMembers.map((email) => (
                  <TouchableOpacity
                    key={email}
                    style={[
                      styles.chip,
                      settleTo === email && styles.chipSelectedPayer,
                    ]}
                    onPress={() => handleSelectToEmail(email)} // <--- TUTAJ ZMIANA
                  >
                    <Text
                      style={[
                        styles.chipText,
                        settleTo === email && styles.chipTextSelected,
                      ]}
                    >
                      {email}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                style={styles.input}
                placeholder="Kwota rozliczenia"
                keyboardType="numeric"
                value={settleAmount}
                onChangeText={setSettleAmount}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setSettleModalVisible(false)}
                >
                  <Text style={styles.buttonText}>Anuluj</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: "#3498db" }]}
                  onPress={handleSettleUp}
                >
                  <Text style={styles.buttonText}>Zatwierdź</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          style={[styles.addUserButton, { borderColor: "#3498db" }]}
          onPress={() => setSettleModalVisible(true)}
        >
          <Text style={[styles.addUserButtonText, { color: "#3498db" }]}>
            🤝 Rozlicz
          </Text>
        </TouchableOpacity>

        <Text style={styles.title}>{groupName}</Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Członkowie i bilans</Text>
          {groupMembers.map((email) => {
            const amount = balances[email] || 0;

            return (
              <TouchableOpacity
                key={email}
                style={styles.balanceRow}
                onPress={() => openSettleWithData(email, amount)} // <--- Dodajemy akcję
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.emailText}>{email}</Text>
                  <Text style={styles.settleHint}>Kliknij, aby rozliczyć</Text>
                </View>
                <Text
                  style={[
                    styles.amountText,
                    {
                      color:
                        amount > 0
                          ? "#27ae60"
                          : amount < 0
                            ? "#e74c3c"
                            : "#95a5a6",
                    },
                  ]}
                >
                  {amount > 0 ? `+${amount.toFixed(2)}` : amount.toFixed(2)} zł
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Wydatki</Text>
        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>Brak wydatków w tej grupie</Text>
        ) : (
          expenses.map((item) => (
            <View
              key={item.id}
              style={[
                styles.expenseCard,
                item.isSettlement && {
                  backgroundColor: "#f8f9fa",
                  borderLeftWidth: 5,
                  borderLeftColor: "#3498db",
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.expenseDesc,
                    item.isSettlement && { color: "#7f8c8d", fontSize: 14 },
                  ]}
                >
                  {item.isSettlement
                    ? "🤝 " + item.description
                    : item.description}
                </Text>
                <Text style={styles.expenseSub}>
                  {item.isSettlement
                    ? `Rozliczone: ${new Date(item.createdAt).toLocaleDateString()}`
                    : `${new Date(item.createdAt).toLocaleDateString()}` +
                      ` ${item.paidById}`}
                </Text>
              </View>
              <Text
                style={[
                  styles.expenseAmount,
                  item.isSettlement && { color: "#3498db" },
                ]}
              >
                {item.totalAmount.toFixed(2)} zł
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
  addUserButton: {
    backgroundColor: "#e8f5e9",
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#2ecc71",
  },
  addUserButtonText: {
    color: "#27ae60",
    fontWeight: "600",
    fontSize: 14,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 15,
  },
  cancelButtonText: {
    color: "#7f8c8d",
    fontWeight: "600",
  },
  createButton: {
    backgroundColor: "#2ecc71",
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  settleHint: {
    fontSize: 10,
    color: "#aaa",
    marginTop: 2,
  },
  swapButton: {
    alignSelf: "center",
    backgroundColor: "#f0f0f0",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  swapButtonText: {
    fontSize: 12,
    color: "#3498db",
    fontWeight: "bold",
  },
});
