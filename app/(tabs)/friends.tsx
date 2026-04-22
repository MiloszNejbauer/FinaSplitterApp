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
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function FriendsScreen() {
  const [friends, setFriends] = useState<{ username: string; email: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [isModalVisible, setModalVisible] = useState(false);
  const [newFriendEmail, setNewFriendEmail] = useState("");

  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const email = await AsyncStorage.getItem("userEmail");

      if (!email) {
        Alert.alert("Błąd", "Nie znaleziono danych użytkownika.");
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

  return (
    <View style={{ flex: 1, backgroundColor: "#f0f2f5" }}>
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Text style={styles.title}>Moi znajomi</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#2ecc71" />
        ) : (
          <FlatList
            data={friends}
            keyExtractor={(item) => item.email}
            renderItem={({ item }) => (
              <View style={styles.friendCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.username ? item.username[0].toUpperCase() : "?"}
                  </Text>
                </View>
                <View>
                  <Text style={styles.friendUsername}>{item.username}</Text>
                  <Text style={styles.friendEmailSubtitle}>{item.email}</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Brak znajomych. Dodaj kogoś!</Text>
            }
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>Dodaj znajomych</Text>
      </TouchableOpacity>

      <Modal visible={isModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Dodaj znajomego</Text>
            <TextInput
              style={styles.input}
              placeholder="Email znajomego"
              placeholderTextColor="#999"
              value={newFriendEmail}
              onChangeText={setNewFriendEmail}
              autoCapitalize="none"
              keyboardType="email-address"
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
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 25,
    color: "#2c3e50",
  },
  friendCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#3498db",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  friendEmail: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    color: "#aaa",
    marginTop: 50,
    fontSize: 16,
  },
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
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "85%",
    padding: 25,
    borderRadius: 20,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#2c3e50",
    textAlign: "center",
  },
  input: {
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#eee",
    color: "#333",
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 0.48,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: { backgroundColor: "#95a5a6" },
  saveButton: { backgroundColor: "#2ecc71" },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  friendUsername: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "bold",
  },
  friendEmailSubtitle: {
    fontSize: 12,
    color: "#7f8c8d",
    marginTop: 2,
  },
});
