import api from "@/constants/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function FriendsScreen() {
  const [friends, setFriends] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [isModalVisible, setModalVisible] = useState(false);
  const [newFriendEmail, setNewFriendEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const email = await AsyncStorage.getItem("userEmail");

      if (!email) {
        Alert.alert(
          "Błąd",
          "Nie znaleziono danych użytkownika. Zaloguj się ponownie.",
        );
        router.replace("/");
        return;
      }

      const response = await api.get("/users/friends", {
        params: { email: email.toLowerCase() },
      });
      setFriends(response.data);
    } catch (error: any) {
      console.error("Błąd pobierania znajomych:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async () => {
    try {
      const myEmail = await AsyncStorage.getItem("userEmail");
      if (!newFriendEmail) return;

      await api.post("/users/friends/add", null, {
        params: {
          email: myEmail,
          friendEmail: newFriendEmail.trim().toLowerCase(),
        },
      });

      Alert.alert("Sukces", "Dodano znajomego!");
      setModalVisible(false);
      setNewFriendEmail("");
      fetchFriends();
    } catch (error: any) {
      Alert.alert("Błąd", error.response?.data || "Użytkownik nie istnieje");
    }
  };

  const renderFriend = ({ item }: { item: string }) => (
    <View style={styles.friendCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item[0].toUpperCase()}</Text>
      </View>
      <Text style={styles.friendEmail}>{item}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#f0f2f5" }}>
      <View style={styles.container}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Powrót</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Moi znajomi</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2ecc71" />
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <View style={styles.friendCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.toUpperCase()}</Text>
                </View>
                <Text style={styles.friendEmail}>{item}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Brak znajomych. Dodaj kogoś!</Text>
            }
          />
        )}
      </View>

      {/* Przycisk FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal dodawania */}
      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dodaj znajomego</Text>
            <TextInput
              style={styles.input}
              placeholder="Email znajomego"
              value={newFriendEmail}
              onChangeText={setNewFriendEmail}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.buttonText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddFriend}
              >
                <Text style={styles.buttonText}>Dodaj</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  backButton: { marginBottom: 20 },
  backText: { color: "#2ecc71", fontWeight: "bold" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 25 },
  friendCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3498db",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: { color: "#fff", fontWeight: "bold" },
  friendEmail: { fontSize: 16, color: "#333" },
  emptyText: { textAlign: "center", color: "#aaa", marginTop: 50 },
  fab: {
    position: "absolute",
    right: 25,
    bottom: 25,
    backgroundColor: "#2ecc71",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    zIndex: 10,
  },
  fabText: { color: "#fff", fontSize: 30, fontWeight: "300" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "85%",
    padding: 20,
    borderRadius: 15,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  input: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#eee",
  },
  modalButtons: { flexDirection: "row", justifyContent: "space-between" },
  modalButton: {
    flex: 0.48,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: { backgroundColor: "#95a5a6" },
  saveButton: { backgroundColor: "#2ecc71" },
  buttonText: { color: "#fff", fontWeight: "bold" },
});
