import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker"; // Upewnij się, że masz: npx expo install @react-native-picker/picker
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../../constants/api";

interface ReceiptItem {
  name: string;
  price: number;
  assignedTo: string; // "all" lub email konkretnej osoby
}

interface Expense {
  id: string;
  description: string;
  totalAmount: number;
  currency: string;
  paidById: string;
  isSettlement: boolean;
  createdAt: Date;
  participants: Record<string, number>;
}

interface GroupMember {
  email: string;
  username: string;
}

export interface DebtSettlement {
  fromUserEmail: string;
  toUserEmail: string;
  fromUserName: string;
  toUserName: string;
  amount: number;
  currency: string;
}

export default function GroupDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [groupName, setGroupName] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<
    Record<string, Record<string, number>>
  >({});
  const [selectedCurrency, setSelectedCurrency] = useState("PLN");
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAddUserModalVisible, setAddUserModalVisible] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [myFriends, setMyFriends] = useState<
    { username: string; email: string }[]
  >([]);

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

  // NOWY STAN: Pozycje z paragonu
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);

  const [isSettleModalVisible, setSettleModalVisible] = useState(false);
  const [settleFrom, setSettleFrom] = useState("");
  const [settleTo, setSettleTo] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleCurrency, setSettleCurrency] = useState("PLN");
  const [isScanning, setIsScanning] = useState(false);
  const [exactDebts, setExactDebts] = useState<DebtSettlement[]>([]);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null,
  );

  // NOWE STANY: Konwersja walut
  const [isConvertModalVisible, setConvertModalVisible] = useState(false);
  const [uniqueCurrencies, setUniqueCurrencies] = useState<string[]>([]);
  const [selectedSourceCurrency, setSelectedSourceCurrency] = useState<
    string | null
  >(null);
  // Domyślnie PLN, chyba że masz globalny kontekst Usera (wtedy ustaw: user.defaultCurrency)
  const [targetCurrency, setTargetCurrency] = useState("PLN");

  const fixKey = (key: string) => (key ? key.replace(/__dot__/g, ".") : "");

  const fetchExactDebts = async () => {
    try {
      const response = await api.get(`/expenses/group/${id}/debts`);
      setExactDebts(response.data);
    } catch (error) {
      console.error("Błąd podczas pobierania szczegółowych długów:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchGroupDetails();
      fetchExactDebts();
    }, [id]),
  );

  useEffect(() => {
    if (isAddUserModalVisible) {
      fetchFriendsForModal();
    }
  }, [isAddUserModalVisible]);

  const fetchFriendsForModal = async () => {
    try {
      const email = await AsyncStorage.getItem("userEmail");
      const response = await api.get("/users/friends", { params: { email } });
      setMyFriends(response.data);
    } catch (error) {
      console.error("Błąd pobierania znajomych do modala:", error);
    }
  };

  useEffect(() => {
    if (
      !isCustomSplit &&
      selectedParticipants.length > 0 &&
      receiptItems.length === 0
    ) {
      const equalShare = (100 / selectedParticipants.length).toFixed(2);
      const newShares: Record<string, string> = {};
      selectedParticipants.forEach((email) => {
        newShares[email] = equalShare;
      });
      setSharesPercent(newShares);
    }
  }, [selectedParticipants, isCustomSplit, receiptItems]);

  useEffect(() => {
    if (expenses.length > 0) {
      // Wyciągamy tylko unikalne waluty z wydatków
      const currencies = [...new Set(expenses.map((ex) => ex.currency))];
      setUniqueCurrencies(currencies);

      // Jeśli wybrana wcześniej waluta źródłowa już nie istnieje na liście, resetujemy wybór
      if (
        selectedSourceCurrency &&
        !currencies.includes(selectedSourceCurrency)
      ) {
        setSelectedSourceCurrency(null);
      }
    } else {
      setUniqueCurrencies([]);
    }
  }, [expenses]);

  const getRemainingPercent = () => {
    const totalUsed = Object.values(sharesPercent).reduce(
      (sum, val) => sum + (parseFloat(val) || 0),
      0,
    );
    const diff = 100 - totalUsed;
    return Math.abs(diff) < 0.05 ? 0 : diff;
  };

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const [groupRes, expensesRes, balancesRes, userProfileRes] =
        await Promise.all([
          api.get(`groups/${id}`),
          api.get(`expenses/group/${id}`),
          api.get(`expenses/group/${id}/balances`),
          api.get(`users/me`),
        ]);
      setGroupName(groupRes.data.name);
      setExpenses(expensesRes.data);
      setBalances(balancesRes.data);
      const members: GroupMember[] = groupRes.data.members || [];
      setGroupMembers(members);

      if (members.length > 0) {
        if (selectedParticipants.length === 0)
          setSelectedParticipants(members.map((m) => m.email));
      }
      if (userProfileRes.data.defaultCurrency) {
        setSelectedCurrency(userProfileRes.data.defaultCurrency.toUpperCase());
      }
    } catch (error) {
      console.error("Błąd pobierania:", error);
    } finally {
      setLoading(false);
    }
  };

  const openAssignmentMenu = (itemIndex: number) => {
    if (Platform.OS === "ios") {
      const options = [
        "Anuluj",
        "Wszyscy",
        ...groupMembers.map((m) => m.username),
      ];

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          cancelButtonIndex: 0,
          title: "Kto płaci za tę pozycję?",
        },
        (buttonIndex) => {
          if (buttonIndex === 0) return; // Anuluj

          const selectedEmail =
            buttonIndex === 1 ? "all" : groupMembers[buttonIndex - 2].email;

          const newItems = [...receiptItems];
          newItems[itemIndex].assignedTo = selectedEmail;
          setReceiptItems(newItems);
          updateSplitFromItems(newItems);
        },
      );
    }
  };

  const updateSettleAmount = (from: string, to: string, curr: string) => {
    const directDebt = exactDebts.find(
      (d) =>
        d.fromUserEmail === from && d.toUserEmail === to && d.currency === curr,
    );

    if (directDebt) {
      setSettleAmount(directDebt.amount.toFixed(2));
    } else {
      setSettleAmount(""); // Brak długu w tej konkretnej walucie
    }
  };

  // --- KONFIGURACJA WALUT DOCELOWYCH ---
  const AVAILABLE_CURRENCIES = [
    { label: "Polski Złoty (PLN)", value: "PLN" },
    { label: "Euro (EUR)", value: "EUR" },
    { label: "Dolar Amerykański (USD)", value: "USD" },
    { label: "Funt Brytyjski (GBP)", value: "GBP" },
  ];

  const openCurrencySelector = () => {
    if (Platform.OS === "ios") {
      const options = ["Anuluj", ...AVAILABLE_CURRENCIES.map((c) => c.label)];

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options,
          cancelButtonIndex: 0,
          title: "Wybierz walutę docelową",
        },
        (buttonIndex) => {
          if (buttonIndex === 0) return; // Użytkownik kliknął "Anuluj"

          // buttonIndex - 1, ponieważ indeks 0 to "Anuluj"
          const selectedValue = AVAILABLE_CURRENCIES[buttonIndex - 1].value;
          setTargetCurrency(selectedValue);
        },
      );
    }
  };

  // FUNKCJA PRZELICZAJĄCA POZYCJE NA PROCENTY
  const updateSplitFromItems = (items: ReceiptItem[]) => {
    const total = items.reduce((sum, item) => sum + item.price, 0);
    if (total === 0) return;

    const newShares: Record<string, number> = {};
    selectedParticipants.forEach((email) => (newShares[email] = 0));

    items.forEach((item) => {
      if (item.assignedTo === "all") {
        const sharePerPerson = item.price / selectedParticipants.length;
        selectedParticipants.forEach((email) => {
          newShares[email] += sharePerPerson;
        });
      } else {
        if (newShares[item.assignedTo] !== undefined) {
          newShares[item.assignedTo] += item.price;
        }
      }
    });

    const finalShares: Record<string, string> = {};
    Object.keys(newShares).forEach((email) => {
      finalShares[email] = ((newShares[email] / total) * 100).toFixed(2);
    });

    setSharesPercent(finalShares);
    setIsCustomSplit(true);
  };

  const handleScanReceipt = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Błąd", "Brak uprawnień do aparatu");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.5,
    });

    if (result.canceled || !result.assets) return;

    setIsScanning(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "receipt.jpg",
        type: "image/jpeg",
      } as any);

      const response = await api.post("/expenses/scan", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { totalAmount, storeName, items } = response.data;

      if (totalAmount) setAmount(totalAmount.toString().replace(",", "."));
      if (storeName) setDescription(storeName);

      if (items && items.length > 0) {
        const mappedItems = items.map((i: any) => ({
          name: i.name,
          price: parseFloat(i.price) || 0,
          assignedTo: "all",
        }));
        setReceiptItems(mappedItems);
        updateSplitFromItems(mappedItems); // Automatycznie ustawia podział %
      }

      Alert.alert("Sukces", "Dane z paragonu wczytane!");
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się rozpoznać paragonu.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleOpenAddExpenseModal = async () => {
    try {
      // 1. Pobierz świeży profil użytkownika
      const res = await api.get("/users/me");

      if (res.data) {
        // 2. Ustaw walutę domyślną
        if (res.data.defaultCurrency) {
          setSelectedCurrency(res.data.defaultCurrency.toUpperCase());
        }

        // 3. KLUCZOWA ZMIANA: Ustaw zalogowanego użytkownika jako płacącego
        if (res.data.email) {
          setSelectedPaidBy(res.data.email);
        }
      }
    } catch (error) {
      console.error("Nie udało się odświeżyć danych użytkownika:", error);
    } finally {
      // 4. Pokazujemy modal
      setModalVisible(true);
    }
  };

  const handleAddExpense = async () => {
    try {
      const total = parseFloat(amount);
      if (isNaN(total) || total <= 0) {
        Alert.alert("Błąd", "Wprowadź poprawną kwotę");
        return;
      }

      const shares: Record<string, number> = {};
      const count = selectedParticipants.length;
      let currentSum = 0;

      selectedParticipants.forEach((email, index) => {
        if (index === count - 1) {
          // Ostatnia osoba zawsze bierze "resztę", by suma była idealna
          shares[email] = parseFloat((total - currentSum).toFixed(2));
        } else {
          let memberShare: number;

          if (!isCustomSplit) {
            // LOGIKA RÓWNEGO PODZIAŁU: Dzielimy kwotę bezpośrednio
            // Używamy Math.floor, aby reszta (grosze) została dla ostatniej osoby
            memberShare = Math.floor((total / count) * 100) / 100;
          } else {
            // LOGIKA PROCENTOWA: Tylko jeśli użytkownik sam pozmieniał suwaki/wpisał %
            const percent = parseFloat(sharesPercent[email]) || 0;
            memberShare = parseFloat(((percent / 100) * total).toFixed(2));
          }

          shares[email] = memberShare;
          currentSum = parseFloat((currentSum + memberShare).toFixed(2));
        }
      });

      // Log dla Ciebie do sprawdzenia w konsoli:
      console.log("Podział:", shares);

      await api.post("/expenses/add", {
        description,
        totalAmount: total,
        currency: selectedCurrency,
        paidById: selectedPaidBy,
        groupId: id,
        participantShares: shares,
      });

      setModalVisible(false);
      fetchGroupDetails();
      fetchExactDebts();
      setAmount("");
      setDescription("");
      setReceiptItems([]);
    } catch (error) {
      console.error(error);
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
          currency: settleCurrency,
        },
      });
      setSettleModalVisible(false);
      setSettleFrom("");
      setSettleTo("");
      setSettleAmount("");
      fetchGroupDetails();
      fetchExactDebts();
      Alert.alert("Sukces", "Rozliczenie zapisane");
    } catch (error) {
      Alert.alert("Błąd", "Nie udało się zapisać rozliczenia");
    }
  };

  const openSettleWithData = (
    email: string,
    amount: number,
    currency: string = "PLN",
  ) => {
    setSettleFrom("");
    setSettleTo("");
    setSettleAmount("");
    setSettleCurrency(currency); // Ustawiamy walutę rozliczenia

    if (amount < 0) {
      setSettleFrom(email);
    } else if (amount > 0) {
      setSettleTo(email);
    }
    setSettleModalVisible(true);
  };

  const handleSelectToEmail = (toEmail: string) => {
    setSettleTo(toEmail);
    updateSettleAmount(settleFrom, toEmail, settleCurrency);
  };

  const handleSelectFromEmail = (fromEmail: string) => {
    setSettleFrom(fromEmail);
    updateSettleAmount(fromEmail, settleTo, settleCurrency);
  };

  const handleSelectSettleCurrency = (curr: string) => {
    setSettleCurrency(curr);
    updateSettleAmount(settleFrom, settleTo, curr);
  };

  const toggleParticipant = (email: string) => {
    if (selectedParticipants.includes(email)) {
      setSelectedParticipants(selectedParticipants.filter((e) => e !== email));
    } else {
      setSelectedParticipants([...selectedParticipants, email]);
    }
  };

  const getUsernameByEmail = (email: string) => {
    // Czyścimy e-mail (na wypadek, gdyby backend zwracał go z kropkami jako __dot__)
    const cleanEmail = fixKey(email);
    const member = groupMembers.find((m) => m.email === cleanEmail);
    return member ? member.username : cleanEmail;
  };

  const swapSettleSides = () => {
    const tempFrom = settleFrom;
    setSettleFrom(settleTo);
    setSettleTo(tempFrom);
    updateSettleAmount(settleTo, tempFrom, settleCurrency);
  };

  const openConvertModal = () => {
    if (uniqueCurrencies.length === 0) {
      Alert.alert("Informacja", "Brak walut do konwersji w tej grupie.");
      return;
    }
    // Opcjonalnie zaznaczamy domyślnie pierwszą dostępną walutę
    setSelectedSourceCurrency(uniqueCurrencies[0]);
    setConvertModalVisible(true);
  };

  const handleExecuteConversion = async () => {
    if (!selectedSourceCurrency) {
      Alert.alert("Błąd", "Wybierz walutę, którą chcesz przekonwertować.");
      return;
    }

    if (selectedSourceCurrency === targetCurrency) {
      Alert.alert(
        "Błąd",
        "Waluta źródłowa i docelowa nie mogą być takie same.",
      );
      return;
    }

    try {
      setLoading(true);
      // Wywołujemy zaktualizowany endpoint z parametrami
      await api.post(`/groups/${id}/convert`, null, {
        params: {
          fromCurrency: selectedSourceCurrency,
          targetCurrency: targetCurrency,
        },
      });

      setConvertModalVisible(false);
      await Promise.all([fetchGroupDetails(), fetchExactDebts()]);
      Alert.alert(
        "Sukces",
        `Wydatki z ${selectedSourceCurrency} zostały przeliczone na ${targetCurrency}.`,
      );
    } catch (error: any) {
      const errorMsg =
        error.response?.data || "Nie udało się przeliczyć walut.";
      Alert.alert("Błąd", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        {/* Przycisk powrotu i Akcje bez zmian */}
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
            <TouchableOpacity
              style={[styles.actionButton, styles.convertButton]}
              onPress={openConvertModal}
            >
              <Text style={styles.convertButtonText}>💱 Konwertuj waluty</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <Text style={styles.title}>{groupName}</Text>

        {/* --- SEKCJA CZŁONKOWIE I BILANS --- */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Członkowie i bilans</Text>
          {groupMembers.map((member) => {
            const userBalances = balances[member.email] || {};
            const currencies = Object.keys(userBalances);

            // 1. Sprawdzamy, czy użytkownik ma jakiekolwiek saldo różniące się od zera (powyżej 1 grosza)
            const hasActiveBalance = currencies.some(
              (curr) => Math.abs(userBalances[curr]) >= 0.01,
            );

            // Filtrujemy długi, w których ten członek jest dłużnikiem LUB wierzycielem
            const relatedDebts = exactDebts.filter(
              (d) =>
                d.fromUserEmail === member.email ||
                d.toUserEmail === member.email,
            );

            return (
              <View key={member.email} style={styles.memberWrapper}>
                <TouchableOpacity
                  style={[
                    styles.balanceRow,
                    {
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    },
                  ]}
                  onPress={() =>
                    openSettleWithData(member.email, userBalances["PLN"] || 0)
                  }
                >
                  {/* Lewa strona: Nazwa użytkownika */}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emailText}>
                      {member.username || member.email}
                    </Text>
                  </View>

                  {/* Prawa strona: Kwoty lub Ptaszek */}
                  <View style={{ alignItems: "flex-end" }}>
                    {hasActiveBalance ? (
                      currencies.map((curr) => {
                        const val = userBalances[curr];
                        // 2. Jeśli konkretna waluta ma 0.00, pomijamy jej renderowanie
                        if (Math.abs(val) < 0.01) return null;

                        return (
                          <Text
                            key={curr}
                            style={[
                              styles.amountText,
                              {
                                color: val > 0 ? "#27ae60" : "#e74c3c",
                                fontSize: 16,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {val > 0 ? `+${val.toFixed(2)}` : val.toFixed(2)}{" "}
                            {curr}
                          </Text>
                        );
                      })
                    ) : (
                      // 3. Jeśli brak aktywnego salda, pokazujemy szary ptaszek
                      <Text
                        style={{
                          fontSize: 20,
                          color: "#bdc3c7",
                          fontWeight: "bold",
                        }}
                      >
                        ✓
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* --- SZCZEGÓŁOWE ROZLICZENIA (Mniejszą czcionką) --- */}
                {relatedDebts.length > 0 && (
                  <View style={styles.debtDetailContainer}>
                    {relatedDebts.map((debt, idx) => {
                      const isDebtor = debt.fromUserEmail === member.email;
                      return (
                        <Text key={idx} style={styles.debtDetailText}>
                          {isDebtor
                            ? `ma oddać ${debt.amount.toFixed(2)} ${debt.currency} do ${debt.toUserName}`
                            : `ma otrzymać ${debt.amount.toFixed(2)} ${debt.currency} od ${debt.fromUserName}`}
                        </Text>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Wydatki</Text>
        {expenses.length === 0 ? (
          <Text style={styles.emptyText}>Brak wydatków</Text>
        ) : (
          expenses.map((item) => {
            const isExpanded = expandedExpenseId === item.id;

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.7}
                onPress={() =>
                  setExpandedExpenseId(isExpanded ? null : item.id)
                }
                style={[
                  styles.expenseCard,
                  item.isSettlement && styles.settlementCard,
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
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
                      {new Date(item.createdAt).toLocaleDateString()} •{" "}
                      {fixKey(item.paidById)}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        styles.expenseAmount,
                        item.isSettlement && { color: "#3498db" },
                      ]}
                    >
                      {item.totalAmount.toFixed(2)} {item.currency || "PLN"}
                    </Text>
                    {/* Mała strzałeczka sugerująca rozwijanie */}
                    {!item.isSettlement && (
                      <Text style={{ fontSize: 10, color: "#bdc3c7" }}>
                        {isExpanded ? "▲ zwiń" : "▼ szczegóły"}
                      </Text>
                    )}
                  </View>
                </View>

                {/* --- ROZWIJANA SEKCJA UCZESTNIKÓW --- */}
                {isExpanded && !item.isSettlement && (
                  <View style={styles.participantsContainer}>
                    <Text style={styles.participantsTitle}>
                      Podział wydatku:
                    </Text>

                    {/* Sprawdzamy czy participants istnieje, jeśli nie - logujemy to dla debugowania */}
                    {item.participants &&
                    Object.keys(item.participants).length > 0 ? (
                      Object.entries(item.participants).map(
                        ([rawEmail, share]) => {
                          const email = fixKey(rawEmail);
                          const member = groupMembers.find(
                            (m) => m.email === email,
                          );
                          const displayName = member
                            ? member.username || email
                            : email;
                          const isPayer = email === fixKey(item.paidById);

                          return (
                            <View key={rawEmail} style={styles.participantsRow}>
                              <Text style={styles.participantName}>
                                {displayName}
                              </Text>
                              <Text
                                style={[
                                  styles.participantValue,
                                  { color: isPayer ? "#27ae60" : "#e74c3c" },
                                ]}
                              >
                                {isPayer
                                  ? `+${(item.totalAmount - share).toFixed(2)}`
                                  : `-${share.toFixed(2)}`}{" "}
                                {item.currency}
                              </Text>
                            </View>
                          );
                        },
                      )
                    ) : (
                      <Text style={styles.participantShareText}>
                        Brak danych o podziale
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenAddExpenseModal}>
        <Text style={styles.fabText}>Dodaj wydatek</Text>
      </TouchableOpacity>

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
                  <Text style={styles.scanButtonText}>Skanuj paragon</Text>
                )}
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Opis"
                value={description}
                onChangeText={setDescription}
                placeholderTextColor="#999"
              />
              <TextInput
                style={styles.input}
                placeholder="Kwota"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                placeholderTextColor="#999"
              />

              <View style={styles.currencyContainer}>
                {["PLN", "EUR", "USD", "GBP"].map((curr) => (
                  <TouchableOpacity
                    key={curr}
                    style={[
                      styles.currencyChip,
                      selectedCurrency === curr && styles.currencyChipSelected,
                    ]}
                    onPress={() => setSelectedCurrency(curr)}
                  >
                    <Text
                      style={
                        selectedCurrency === curr
                          ? styles.whiteText
                          : styles.blackText
                      }
                    >
                      {curr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* LISTA POZYCJI Z PARAGONU */}
              {receiptItems.length > 0 && (
                <View style={styles.receiptItemsContainer}>
                  <Text style={styles.label}>
                    Pozycje z paragonu (podziel osoby):
                  </Text>
                  {receiptItems.map((item, idx) => (
                    <View key={idx} style={styles.receiptItemRow}>
                      <View style={{ flex: 1.5 }}>
                        <Text style={styles.receiptItemName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.receiptItemPrice}>
                          {item.price.toFixed(2)} zł
                        </Text>
                      </View>

                      {Platform.OS === "ios" ? (
                        // STYLOWY PRZYCISK DLA iOS
                        <TouchableOpacity
                          style={styles.iosSelector}
                          onPress={() => openAssignmentMenu(idx)}
                        >
                          <Text
                            style={styles.iosSelectorText}
                            numberOfLines={1}
                          >
                            {item.assignedTo === "all"
                              ? "Wszyscy"
                              : groupMembers.find(
                                  (m) => m.email === item.assignedTo,
                                )?.username || "Wybierz"}
                          </Text>
                          <Text style={styles.iosSelectorArrow}>▾</Text>
                        </TouchableOpacity>
                      ) : (
                        // STANDARDOWY PICKER DLA ANDROIDA
                        <View style={styles.pickerWrapper}>
                          <Picker
                            selectedValue={item.assignedTo}
                            onValueChange={(val) => {
                              const newItems = [...receiptItems];
                              newItems[idx].assignedTo = val;
                              setReceiptItems(newItems);
                              updateSplitFromItems(newItems);
                            }}
                            style={styles.picker}
                            dropdownIconColor="#2c3e50"
                          >
                            <Picker.Item
                              label="Wszyscy"
                              value="all"
                              color="#2c3e50"
                            />
                            {groupMembers.map((m) => (
                              <Picker.Item
                                key={m.email}
                                label={m.username}
                                value={m.email}
                                color="#2c3e50"
                              />
                            ))}
                          </Picker>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

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
                      {member.username}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>
                Kto uczestniczy w całym rachunku?
              </Text>
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
                      {member.username}
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
                    ? "← Równy podział"
                    : "⚙️ Podział niestandardowy (%)"}
                </Text>
              </TouchableOpacity>

              {isCustomSplit && (
                <View style={styles.customSplitBox}>
                  <Text style={styles.remainingText}>
                    Suma: {(100 - getRemainingPercent()).toFixed(2)}%
                  </Text>

                  {selectedParticipants.map((email) => {
                    // Obliczamy kwotę na bieżąco dla każdego wiersza
                    const cleanAmount = amount.replace(",", ".");
                    const totalVal = parseFloat(cleanAmount) || 0;

                    const currentPercentStr = sharesPercent[email] || "0";
                    const currentPercent =
                      parseFloat(currentPercentStr.replace(",", ".")) || 0;
                    const individualAmount = (currentPercent / 100) * totalVal;

                    return (
                      <View key={email} style={styles.participantRow}>
                        <Text style={styles.participantEmailSmall}>
                          {groupMembers.find((m) => m.email === email)
                            ?.username || email}
                        </Text>

                        <View style={styles.shareValuesContainer}>
                          {/* Wyświetlanie wyliczonej kwoty */}
                          <Text style={styles.calculatedAmountText}>
                            {individualAmount.toFixed(2)} zł
                          </Text>

                          {/* Kontener na input procentowy */}
                          <View style={styles.percentInputContainer}>
                            <TextInput
                              style={styles.percentInput}
                              keyboardType="numeric"
                              value={sharesPercent[email]}
                              placeholderTextColor="#999"
                              onChangeText={(val) =>
                                setSharesPercent({
                                  ...sharesPercent,
                                  [email]: val,
                                })
                              }
                            />
                            <Text style={styles.percentSymbol}>%</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
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

      {/* MODAL KONWERSJI WALUT */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isConvertModalVisible}
        onRequestClose={() => setConvertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Konwersja Walut</Text>

            <Text style={styles.label}>
              Wybierz walutę, którą chcesz przekonwertować:
            </Text>
            <View style={styles.currencyContainer}>
              {uniqueCurrencies.map((curr) => (
                <TouchableOpacity
                  key={curr}
                  style={[
                    styles.currencyButton,
                    selectedSourceCurrency === curr &&
                      styles.currencyButtonSelected,
                  ]}
                  onPress={() => setSelectedSourceCurrency(curr)}
                >
                  <Text
                    style={[
                      styles.currencyText,
                      selectedSourceCurrency === curr &&
                        styles.currencyTextSelected,
                    ]}
                  >
                    {curr}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Konwersja na:</Text>
            {Platform.OS === "ios" ? (
              <TouchableOpacity
                style={styles.iosSelector}
                onPress={openCurrencySelector}
              >
                <Text style={styles.iosSelectorText} numberOfLines={1}>
                  {/* Szukamy etykiety, a jeśli jej nie ma, wyświetlamy sam kod waluty lub placeholder */}
                  {AVAILABLE_CURRENCIES.find((c) => c.value === targetCurrency)
                    ?.label ||
                    targetCurrency ||
                    "Wybierz walutę"}
                </Text>
                <Text style={styles.iosSelectorArrow}>▾</Text>
              </TouchableOpacity>
            ) : (
              // STANDARDOWY PICKER DLA ANDROIDA
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={targetCurrency}
                  onValueChange={(itemValue) => setTargetCurrency(itemValue)}
                  style={styles.picker}
                  dropdownIconColor="#2c3e50"
                >
                  {AVAILABLE_CURRENCIES.map((curr) => (
                    <Picker.Item
                      key={curr.value}
                      label={curr.label}
                      value={curr.value}
                      color="#2c3e50"
                    />
                  ))}
                </Picker>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setConvertModalVisible(false)}
              >
                <Text style={styles.buttonText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleExecuteConversion}
              >
                <Text style={styles.buttonText}>Przelicz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modale Rozliczeń i Dodawania Użytkownika pozostają bez zmian z Twojego kodu */}
      <Modal visible={isAddUserModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dodaj członka</Text>

            <TextInput
              style={styles.input}
              placeholder="Wpisz email lub wybierz z listy"
              value={newUserEmail}
              onChangeText={setNewUserEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#999"
            />

            {/* SEKCJA LISTY ZNAJOMYCH */}
            <View style={styles.friendSelectionWrapper}>
              <Text style={styles.smallLabel}>Twoi znajomi:</Text>
              <FlatList
                data={myFriends}
                horizontal // Lista pozioma dla oszczędności miejsca
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.email}
                style={styles.horizontalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.friendChip,
                      newUserEmail === item.email && styles.friendChipSelected,
                    ]}
                    onPress={() => setNewUserEmail(item.email)}
                  >
                    <View style={styles.chipAvatar}>
                      <Text style={styles.chipAvatarText}>
                        {item.username[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.chipText,
                        newUserEmail === item.email && styles.chipTextSelected,
                      ]}
                    >
                      {item.username}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptySmallText}>
                    Brak znajomych na liście
                  </Text>
                }
              />
            </View>

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
              {groupMembers.map((member) => (
                <TouchableOpacity
                  key={member.email}
                  style={[
                    styles.chip,
                    settleFrom === member.email && {
                      backgroundColor: "#e74c3c",
                    },
                  ]}
                  onPress={() => handleSelectFromEmail(member.email)}
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

            <Text style={styles.label}>Waluta rozliczenia</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipContainer}
            >
              {["PLN", "EUR", "USD", "GBP"].map((curr) => (
                <TouchableOpacity
                  key={curr}
                  style={[
                    styles.chip,
                    settleCurrency === curr && { backgroundColor: "#3498db" },
                  ]}
                  onPress={() => handleSelectSettleCurrency(curr)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      settleCurrency === curr && styles.chipTextSelected,
                    ]}
                  >
                    {curr}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={styles.input}
              placeholder={`Kwota (${settleCurrency})`}
              keyboardType="numeric"
              value={settleAmount}
              onChangeText={setSettleAmount}
              placeholderTextColor="#999"
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

// DOPISANE STYLE DLA NOWEJ FUNKCJONALNOŚCI
const styles = StyleSheet.create({
  // ... (poprzednie style bez zmian)
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
    paddingVertical: 4,
  },
  emailText: { color: "#333", fontSize: 15, fontWeight: "500" },
  amountText: { fontWeight: "bold", fontSize: 16 },
  expenseCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    // Cień
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
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
    // Usuwamy sztywne width: 60
    paddingHorizontal: 20, // Dodajemy margines wewnętrzny po bokach
    height: 56, // Standardowa wysokość FAB
    borderRadius: 28, // Połowa wysokości daje efekt zaokrąglonych końców
    flexDirection: "row", // Ustawiamy w linii, jeśli zechcesz dodać ikonę +
    justifyContent: "center",
    alignItems: "center",
    // Cienie dla Androida
    elevation: 8,
    // Cienie dla iOS (aby był efekt "pływania")
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  fabText: {
    color: "#fff",
    fontSize: 16, // 32 to zdecydowanie za dużo dla długiego tekstu
    fontWeight: "600", // Pogrubienie dla lepszej czytelności
    letterSpacing: 0.5, // Subtelny odstęp między literami
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "95%",
    maxHeight: "90%",
    padding: 20,
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
    backgroundColor: "#fdf7f2",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fbcfb1",
  },
  remainingText: {
    fontSize: 13,
    color: "#e67e22",
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "right",
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
  },
  scanButtonText: { color: "#27ae60", fontWeight: "bold", fontSize: 15 },

  // NOWE STYLE DLA POZYCJI
  receiptItemsContainer: {
    backgroundColor: "#f1f2f6",
    padding: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  receiptItemRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  picker: { width: "100%", height: "auto" }, // 'color' tutaj pomaga na Androidzie
  iosSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0f2f552",
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minWidth: 10,
    marginBottom: 20,
  },
  iosSelectorText: {
    fontSize: 13,
    color: "#1a1a1a",
    fontWeight: "600",
    marginRight: 4,
  },
  iosSelectorArrow: {
    fontSize: 12,
    color: "#131313",
  },
  receiptItemName: {
    fontWeight: "700",
    fontSize: 14,
    color: "#2c3e50",
    marginBottom: 2,
  },
  receiptItemPrice: {
    fontSize: 13,
    color: "#27ae60",
    fontWeight: "600",
  },
  pickerWrapper: {
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 32, // Mocne odsunięcie od przycisków na dole
    justifyContent: "center", // Ważne, aby zawartość wyższego pickera była na środku
    overflow: "hidden",
  },
  participantRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
  },
  participantEmailSmall: {
    flex: 1,
    fontSize: 14,
    color: "#34495e",
  },
  shareValuesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  calculatedAmountText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#27ae60",
    marginRight: 12, // Odstęp między kwotą a inputem
  },
  percentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#dcdde1",
    paddingHorizontal: 8,
    width: 70, // Stała szerokość dla inputu
  },
  percentInput: {
    flex: 1,
    paddingVertical: 4,
    fontSize: 14,
    textAlign: "right",
    fontWeight: "bold",
  },
  percentSymbol: {
    fontSize: 12,
    color: "#7f8c8d",
    marginLeft: 2,
  },
  currencyContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
  },
  currencyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: "#eee",
  },
  currencyChipSelected: {
    backgroundColor: "#2ecc71",
  },
  whiteText: { color: "#fff", fontWeight: "bold" },
  blackText: { color: "#333" },
  convertButton: {
    backgroundColor: "#9b59b6", // Kolor fioletowy dla odróżnienia
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  convertButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  currencyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: "#f9f9f9",
  },
  currencyButtonSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  currencyText: {
    color: "#333",
    fontWeight: "600",
  },
  currencyTextSelected: {
    color: "#fff",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: "#f9f9f9",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  confirmButton: {
    backgroundColor: "#34C759",
  },
  friendSelectionWrapper: {
    marginBottom: 20,
    maxHeight: 100, // Ograniczamy wysokość
  },
  smallLabel: {
    fontSize: 12,
    color: "#7f8c8d",
    marginBottom: 8,
    fontWeight: "600",
  },
  horizontalList: {
    flexGrow: 0,
  },
  friendChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f2f5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  friendChipSelected: {
    backgroundColor: "#2ecc71",
    borderColor: "#27ae60",
  },
  chipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#3498db",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  chipAvatarText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  emptySmallText: {
    fontSize: 12,
    color: "#ccc",
    fontStyle: "italic",
    marginTop: 5,
  },
  memberWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f2f6",
    paddingVertical: 12,
  },
  debtDetailContainer: {
    paddingLeft: 4, // Lekkie przesunięcie w prawo dla hierarchii
    marginTop: 6,
  },
  debtDetailText: {
    fontSize: 12, // Mała czcionka zgodnie z prośbą
    color: "#7f8c8d", // Szary kolor (subtelny)
    fontStyle: "italic",
    lineHeight: 16,
  },
  participantsContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f2f6",
  },
  participantsTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#95a5a6",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  participantsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  participantName: {
    fontSize: 13,
    color: "#34495e",
  },
  participantValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  participantShareText: {
    fontSize: 11, // Mała czcionka
    color: "#95a5a6", // Jasnoszary
    marginRight: 10,
    fontStyle: "italic",
  },
});
