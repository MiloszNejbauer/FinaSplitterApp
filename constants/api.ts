import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Platform } from "react-native";

const getBaseUrl = (): string => {
  if (Platform.OS === "web") {
    return "http://localhost:8080/api";
  }
  // Pamiętaj, aby IP 192.168.0.56 było aktualne w Twojej sieci Wi-Fi
  return "http://192.168.1.21:8080/api";
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

// Dodajemy Interceptor żądań (Request Interceptor)
api.interceptors.request.use(
  async (config) => {
    // Pobieramy token zapisany podczas logowania
    const token = await AsyncStorage.getItem("userToken");

    if (token) {
      // Jeśli token istnieje, dodajemy go do nagłówka Authorization
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default api;
