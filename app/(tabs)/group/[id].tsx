import * as ImagePicker from "expo-image-picker";
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
import api from "../../../constants/api";

interface Expense {
  id: string;
  description: string;
  totalAmount: number;
  paidById: string;
  isSettlement: boolean;
  createdAt: Date;
}

interface GroupMember {
  email: string;
  username: string;
}

export default function GroupDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // Stany danych grupy
  const [groupName, setGroupName] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Stany dodawania użytkowników
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
  const [settleFrom, setSettleFrom] = useState("");
  const [settleTo, setSettleTo] = useState("");
  const [settleAmount, setSettleAmount] = useState("");

  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    fetchGroupDetails();
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
  }, [selectedParticipants, isCustomSplit]);

  const getRemainingPercent = () => {
    const totalUsed = Object.values(sharesPercent).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0,
    );
    const diff = 100 - totalUsed;
    return Math.abs(diff) < 0.05 ? 0 : diff;
  };

  // ZMIENIONA NAZWA I POPRAWIONE MAPOWANIE KLUCZA "members"
  const fetchGroupDetails = async () => {
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

      // KLUCZOWE: Backend przesyła to w polu "members", nie "memberEmails"
      const members: GroupMember[] = groupRes.data.members || [];
      setGroupMembers(members);

      if (members.length > 0) {
        // Inicjalizacja formularza, jeśli jeszcze nie wybrano płatnika
        if (!selectedPaidBy) setSelectedPaidBy(members[0].email);
        if (selectedParticipants.length === 0)
          setSelectedParticipants(members.map((m) => m.email));
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
        `Suma procentów musi wynosić 100%. Brakuje: ${remaining.toFixed(2)}%`,
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
      fetchGroupDetails();
      setDescription("");
      setAmount("");
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się dodać wydatku");
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim() || !newUserEmail.includes("@")) {
      Alert.alert("Błąd", "Wprowadź poprawny adres e-mail");
      return;
    }

    try {
      setIsAddingUser(true);
      const response = await api.post(`/groups/${id}/add-user`, null, {
        params: { email: newUserEmail.trim() },
      });

      if (response.status === 200) {
        Alert.alert("Sukces", "Użytkownik został dodany do grupy");
        setAddUserModalVisible(false);
        setNewUserEmail("");
        fetchGroupDetails();
      }
    } catch (error: any) {
      const errorMsg = error.response?.data || "Wystąpił błąd";
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
      setSettleModalVisible(false);
      setSettleFrom("");
      setSettleTo("");
      setSettleAmount("");
      fetchGroupDetails();
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
    } else if (amount > 0) {
      setSettleTo(email);
    }
    setSettleModalVisible(true);
  };

  const handleSelectToEmail = (toEmail: string) => {
    setSettleTo(toEmail);
    if (settleFrom) {
      const fromBalance = balances[settleFrom] || 0;
      const toBalance = balances[toEmail] || 0;
      if (fromBalance < 0 && toBalance > 0) {
        const suggestion = Math.min(Math.abs(fromBalance), toBalance);
        setSettleAmount(suggestion.toFixed(2));
      } else if (fromBalance < 0) {
        setSettleAmount(Math.abs(fromBalance).toFixed(2));
      }
    }
  };

  const swapSettleSides = () => {
    const tempFrom = settleFrom;
    setSettleFrom(settleTo);
    setSettleTo(tempFrom);
  };

  const handleScanReceipt = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Błąd", "Aplikacja potrzebuje dostępu do aparatu.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    setIsScanning(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      const filename = uri.split("/").pop() || "receipt.jpg";

      // Specyficzny format dla React Native
      formData.append("file", {
        uri: uri,
        name: filename,
        type: "image/jpeg",
      } as any);

      console.log("Wysyłam zdjęcie do backendu...");

      // Wysyłka do Spring Boota
      const response = await api.post("/expenses/scan", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("=== ODPOWIEDŹ Z BACKENDU ===");
      console.log(JSON.stringify(response.data, null, 2));

      const { totalAmount, storeName } = response.data;

      console.log("Wyciągnięte dane:");
      console.log(" - totalAmount:", totalAmount);
      console.log(" - storeName:", storeName);

      let updated = false;

      // Interpretacja i uzupełnienie danych
      if (totalAmount) {
        // Zamiana przecinka na kropkę, jeśli AI tak zwróciło, by nie zepsuć parsowania
        const formattedAmount = totalAmount.toString().replace(",", ".");
        setAmount(formattedAmount);
        updated = true;
      }
      if (storeName) {
        setDescription(storeName);
        updated = true;
      }

      if (updated) {
        Alert.alert("Sukces", "Pomyślnie odczytano dane z paragonu!");
      } else {
        Alert.alert(
          "Uwaga",
          "Serwer odpowiedział, ale nie znaleziono kwoty ani nazwy sklepu w odpowiednim formacie. Sprawdź terminal.",
        );
      }

      Alert.alert("Sukces", "Pomyślnie odczytano dane z paragonu!");
    } catch (error: any) {
      console.error("Błąd skanowania:", error.response?.data || error.message);
      Alert.alert(
        "Błąd",
        "Nie udało się rozpoznać paragonu. Spróbuj ponownie z wyraźniejszym zdjęciem.",
      );
    } finally {
      setIsScanning(false);
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
          onPress={() => router.push("/dashboard")}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Powrót do listy</Text>
        </TouchableOpacity>

        <View style={styles.actionRowContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.actionRow}
          >
            <TouchableOpacity
              style={[styles.actionButton, styles.addPersonButton]}
              onPress={() => setAddUserModalVisible(true)}
            >
              <Text style={styles.addPersonButtonText}>+ Dodaj osobę</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.settleButton]}
              onPress={() => setSettleModalVisible(true)}
            >
              <Text style={styles.settleButtonText}>🤝 Rozlicz</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <Text style={styles.title}>{groupName}</Text>

        {/* --- CZŁONKOWIE I BILANS --- */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Członkowie i bilans</Text>
          {groupMembers.map((member) => {
            const amount = balances[member.email] || 0;
            return (
              <TouchableOpacity
                key={member.email}
                style={styles.balanceRow}
                onPress={() => openSettleWithData(member.email, amount)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.emailText}>
                    {member.username || member.email}
                  </Text>
                  <Text style={styles.settleHint}>{member.email}</Text>
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

        {/* --- WYDATKI --- */}
        <Text style={styles.sectionTitle}>Wydatki</Text>
        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>Brak wydatków w tej grupie</Text>
        ) : (
          expenses.map((item) => (
            <View
              key={item.id}
              style={[
                styles.expenseCard,
                item.isSettlement && styles.settlementCard,
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
                  {new Date(item.createdAt).toLocaleDateString()}{" "}
                  {!item.isSettlement && `• Płacił: ${item.paidById}`}
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

      {/* FAB - NOWY WYDATEK */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* MODAL DODAWANIA UŻYTKOWNIKA */}
      <Modal visible={isAddUserModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dodaj członka</Text>
            <TextInput
              style={styles.input}
              placeholder="email@przyklad.pl"
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              keyboardType="email-address"
              autoCapitalize="none"
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

      {/* MODAL NOWEGO WYDATKU */}
      <Modal animationType="slide" transparent visible={isModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Nowy wydatek</Text>

              <TouchableOpacity
                style={styles.scanButton}
                onPress={handleScanReceipt}
                disabled={isScanning}
              >
                {isScanning ? (
                  <ActivityIndicator color="#2ecc71" />
                ) : (
                  <Text style={styles.scanButtonText}>
                    📸 Skanuj paragon (AI)
                  </Text>
                )}
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Opis"
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
                {groupMembers.map((member) => (
                  <TouchableOpacity
                    key={member.email}
                    style={[
                      styles.chip,
                      selectedPaidBy === member.email &&
                        styles.chipSelectedPayer,
                    ]}
                    onPress={() => setSelectedPaidBy(member.email)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedPaidBy === member.email &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {member.username || member.email}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Kto uczestniczy?</Text>
              <View style={styles.chipContainer}>
                {groupMembers.map((member) => (
                  <TouchableOpacity
                    key={member.email}
                    style={[
                      styles.chip,
                      selectedParticipants.includes(member.email) &&
                        styles.chipSelectedParticipant,
                    ]}
                    onPress={() => toggleParticipant(member.email)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedParticipants.includes(member.email) &&
                          styles.chipTextSelected,
                      ]}
                    >
                      {member.username || member.email}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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

              {isCustomSplit && (
                <View style={styles.customSplitBox}>
                  <Text style={styles.remainingText}>
                    Zostało: {getRemainingPercent().toFixed(2)}%
                  </Text>
                  {selectedParticipants.map((email) => (
                    <View key={email} style={styles.participantRow}>
                      <Text style={styles.participantEmailSmall}>
                        {groupMembers.find((m) => m.email === email)
                          ?.username || email}
                      </Text>
                      <View style={styles.percentInputContainer}>
                        <TextInput
                          style={styles.percentInput}
                          keyboardType="numeric"
                          value={sharesPercent[email]}
                          onChangeText={(val) =>
                            setSharesPercent({ ...sharesPercent, [email]: val })
                          }
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
                  <Text style={styles.cancelButtonText}>Anuluj</Text>
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

      {/* MODAL ROZLICZEŃ */}
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
              {groupMembers.map((member) => (
                <TouchableOpacity
                  key={member.email}
                  style={[
                    styles.chip,
                    settleFrom === member.email && {
                      backgroundColor: "#e74c3c",
                    },
                  ]}
                  onPress={() => setSettleFrom(member.email)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      settleFrom === member.email && styles.chipTextSelected,
                    ]}
                  >
                    {member.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

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
              {groupMembers.map((member) => (
                <TouchableOpacity
                  key={member.email}
                  style={[
                    styles.chip,
                    settleTo === member.email && styles.chipSelectedParticipant,
                  ]}
                  onPress={() => handleSelectToEmail(member.email)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      settleTo === member.email && styles.chipTextSelected,
                    ]}
                  >
                    {member.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.input}
              placeholder="Kwota"
              keyboardType="numeric"
              value={settleAmount}
              onChangeText={setSettleAmount}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setSettleModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Anuluj</Text>
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
    </View>
  );
}

// Dodane brakujące style dla kart rozliczeń
const styles = StyleSheet.create({
  // ... Twoje poprzednie style ...
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    padding: 20,
    paddingTop: 60,
  },
  backButton: { marginBottom: 15 },
  backText: { color: "#2ecc71", fontWeight: "bold", fontSize: 16 },
  actionRowContainer: { height: 45, marginBottom: 20 },
  actionRow: { flexDirection: "row", alignItems: "center", paddingRight: 20 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 25,
    marginRight: 10,
    borderWidth: 1.5,
  },
  addPersonButton: { backgroundColor: "#e8f5e9", borderColor: "#2ecc71" },
  addPersonButtonText: { color: "#27ae60", fontWeight: "700", fontSize: 14 },
  settleButton: { backgroundColor: "#ebf5fb", borderColor: "#3498db" },
  settleButtonText: { color: "#2980b9", fontWeight: "700", fontSize: 14 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
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
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  emailText: { color: "#333", fontSize: 15, fontWeight: "500" },
  amountText: { fontWeight: "bold", fontSize: 16 },
  expenseCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    elevation: 1,
  },
  settlementCard: {
    backgroundColor: "#f8f9fa",
    borderLeftWidth: 5,
    borderLeftColor: "#3498db",
  },
  expenseDesc: { fontSize: 16, fontWeight: "600", color: "#2c3e50" },
  expenseSub: { fontSize: 12, color: "#7f8c8d", marginTop: 4 },
  expenseAmount: { fontSize: 16, fontWeight: "bold", color: "#2c3e50" },
  emptyText: {
    textAlign: "center",
    color: "#aaa",
    marginTop: 15,
    fontStyle: "italic",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    backgroundColor: "#2ecc71",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 32, fontWeight: "400", marginTop: -2 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "90%",
    maxHeight: "85%",
    padding: 25,
    borderRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#2c3e50",
  },
  input: {
    backgroundColor: "#f8f9fa",
    padding: 14,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    fontSize: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#34495e",
  },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 20 },
  chip: {
    backgroundColor: "#f1f2f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#dfe4ea",
  },
  chipSelectedPayer: { backgroundColor: "#2ecc71", borderColor: "#27ae60" },
  chipSelectedParticipant: {
    backgroundColor: "#3498db",
    borderColor: "#2980b9",
  },
  chipText: { fontSize: 13, color: "#576574", fontWeight: "500" },
  chipTextSelected: { color: "#fff", fontWeight: "bold" },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
  },
  modalButton: {
    flex: 0.47,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: { backgroundColor: "#ecf0f1" },
  cancelButtonText: { color: "#7f8c8d", fontWeight: "700", fontSize: 15 },
  saveButton: { backgroundColor: "#2ecc71" },
  createButton: { backgroundColor: "#2ecc71" },
  createButtonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  percentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  percentInput: {
    width: 45,
    paddingVertical: 8,
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 15,
  },
  modeButton: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 20,
    alignItems: "center",
  },
  modeButtonText: { color: "#2c3e50", fontSize: 14, fontWeight: "600" },
  customSplitBox: {
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  remainingText: {
    fontSize: 13,
    color: "#e67e22",
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "right",
  },
  participantEmailSmall: {
    fontSize: 14,
    color: "#34495e",
    flex: 1,
    fontWeight: "500",
  },
  settleHint: { fontSize: 11, color: "#95a5a6", marginTop: 4 },
  swapButton: {
    alignSelf: "center",
    backgroundColor: "#f8f9fa",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  swapButtonText: { fontSize: 13, color: "#3498db", fontWeight: "bold" },
  scanButton: {
    backgroundColor: "#f0fff4",
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#2ecc71",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48, // Zapobiega skakaniu UI podczas ładowania
  },
  scanButtonText: {
    color: "#27ae60",
    fontWeight: "bold",
    fontSize: 15,
  },
});
