import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../constants/api";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Błąd", "Wypełnij wszystkie pola");
      return;
    }

    try {
      const response = await api.post("/users/login", {
        email: email.toLowerCase().trim(),
        password: password,
      });

      if (response.status === 200) {
        const { token } = response.data;

        if (token) {
          await AsyncStorage.setItem("userToken", token);
          await AsyncStorage.setItem("userEmail", email.toLowerCase().trim());

          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

          Alert.alert("Sukces", "Zalogowano pomyślnie!");
          router.replace("/dashboard");
        }
      }
    } catch (error: any) {
      console.error("Login error:", error.response?.data || error.message);
      const msg = error.response?.data || "Niepoprawny email lub hasło";
      Alert.alert("Błąd logowania", msg);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>FinaSplitter</Text>
        <Text style={styles.subtitle}>
          Zaloguj się, aby zarządzać wydatkami
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={"#999"}
        />

        <TextInput
          style={styles.input}
          placeholder="Hasło"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor={"#999"}
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin}>
          <Text style={styles.buttonText}>Zaloguj się</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/register")}>
          <Text style={styles.linkText}>Nie masz konta? Zarejestruj się</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2ecc71",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
    marginBottom: 30,
  },
  input: {
    backgroundColor: "#f9f9f9",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#eee",
  },
  button: {
    backgroundColor: "#2ecc71",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  linkText: {
    color: "#2ecc71",
    textAlign: "center",
    marginTop: 20,
    fontWeight: "500",
  },
});
