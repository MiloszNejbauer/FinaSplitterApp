import axios from 'axios';
import { Platform } from 'react-native';

const getBaseUrl = (): string => {
  if (Platform.OS === 'web') {
    return 'http://localhost:8080/api';
  }
  return 'http://10.0.2.2:8080/api';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

export default api;