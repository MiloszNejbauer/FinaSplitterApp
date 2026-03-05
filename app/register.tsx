import api from "@/constants/api";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleRegister = async () => {
    if (!username || !email || !password) {
      if (Platform.OS === "web") {
        alert("Wypełnij wszystkie pola");
      } else {
        Alert.alert("Błąd", "Wypełnij wszystkie pola");
      }
      return;
    }

    try {
      const response = await api.post("/users/register", {
        username: username,
        email: email.toLowerCase(),
        password: password,
      });

      if (response.status === 200) {
        if (Platform.OS === "web") {
          // Na webie standardowy alert blokuje wątek do momentu kliknięcia OK
          alert("Sukces! Konto zostało utworzone. Możesz się teraz zalogować.");
          router.replace("/");
        } else {
          // Na telefonie używamy callbacka w przycisku
          Alert.alert("Sukces", "Twoje konto zostało utworzone!", [
            { text: "Zaloguj się", onPress: () => router.replace("/") },
          ]);
        }
      }
    } catch (error: any) {
      const errorMsg =
        error.response?.data || "Wystąpił błąd podczas rejestracji";
      if (Platform.OS === "web") {
        alert(`Błąd: ${errorMsg}`);
      } else {
        Alert.alert("Błąd rejestracji", errorMsg);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stwórz konto</Text>

      <TextInput
        style={styles.input}
        placeholder="Nazwa użytkownika"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Hasło"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>Zarejestruj się</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()}>
        <Text style={styles.link}>Masz już konto? Zaloguj się</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 30,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 40,
    color: "#2c3e50",
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
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  link: { marginTop: 20, textAlign: "center", color: "#3498db" },
});
