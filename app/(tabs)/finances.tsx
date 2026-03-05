import api from "@/constants/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";

interface ChartDataPoint {
  labels: string[];
  datasets: { data: number[] }[];
}

const polishMonths: { [key: string]: string } = {
  JANUARY: "Styczeń",
  FEBRUARY: "Luty",
  MARCH: "Marzec",
  APRIL: "Kwiecień",
  MAY: "Maj",
  JUNE: "Czerwiec",
  JULY: "Lipiec",
  AUGUST: "Sierpień",
  SEPTEMBER: "Wrzesień",
  OCTOBER: "Październik",
  NOVEMBER: "Listopad",
  DECEMBER: "Grudzień",
};

export default function FinancesScreen() {
  const [data, setData] = useState<ChartDataPoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalAllTime, setTotalAllTime] = useState(0);

  useEffect(() => {
    fetchFinances();
  }, []);

  const fetchFinances = async () => {
    try {
      const email = await AsyncStorage.getItem("userEmail");
      const response = await api.get(`/expenses/user/${email}/monthly-summary`);

      const rawLabels = Object.keys(response.data);
      const values = Object.values(response.data) as number[];

      setTotalAllTime(values.reduce((a: number, b: number) => a + b, 0));

      const formattedLabels = rawLabels.map((label) => {
        const monthEng = label.split(" ")[0];
        return polishMonths[monthEng] || monthEng;
      });

      setData({
        labels: formattedLabels,
        datasets: [{ data: values }],
      });
    } catch (e) {
      console.error("Błąd pobierania finansów:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <ActivityIndicator size="large" color="#2ecc71" style={{ flex: 1 }} />
    );

  const screenWidth = Dimensions.get("window").width;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Moje Finanse</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          Łączne wydatki (wszystkie grupy):
        </Text>
        <Text style={styles.summaryValue}>{totalAllTime.toFixed(2)} zł</Text>
      </View>

      <Text style={styles.sectionTitle}>Wydatki miesięczne</Text>

      {data && data.labels.length > 0 ? (
        <View style={styles.chartWrapper}>
          <BarChart
            data={data}
            width={screenWidth - 40} // Szerokość dopasowana do marginesów ekranu
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero={true}
            showValuesOnTopOfBars={true}
            withHorizontalLabels={false}
            withInnerLines={false}
            chartConfig={{
              backgroundColor: "#ffffff",
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo: "#ffffff",
              decimalPlaces: 0,
              fillShadowGradient: "#2ecc71",
              fillShadowGradientOpacity: 1,
              fillShadowGradientTo: "#2ecc71",
              color: (opacity = 1) => `rgba(46, 204, 113, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
              barPercentage: 0.6,
              // Usunięcie linii tła, które mogą przesuwać wykres
              propsForBackgroundLines: {
                strokeWidth: 0,
              },
              propsForLabels: {
                fontSize: 11,
                fontWeight: "600",
              },
            }}
            style={{
              marginVertical: 10,
              borderRadius: 16,
              paddingRight: 0, // Kluczowe dla wyśrodkowania
              paddingLeft: 0, // Kluczowe dla usunięcia luki z lewej
            }}
            verticalLabelRotation={0}
          />
        </View>
      ) : (
        <View style={styles.noDataCard}>
          <Text style={styles.noDataText}>Brak danych do wyświetlenia</Text>
        </View>
      )}

      {/* Miejsce na dodatkowe elementy, np. listę transakcji */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#2c3e50",
  },
  summaryCard: {
    backgroundColor: "#2ecc71",
    padding: 25,
    borderRadius: 20,
    marginBottom: 25,
    elevation: 4,
    shadowColor: "#2ecc71",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  summaryLabel: { color: "#fff", opacity: 0.9, fontSize: 14 },
  summaryValue: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold",
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#2c3e50",
    paddingLeft: 5,
  },
  chartWrapper: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 0, // Ustawione na 0, by wykres wypełniał kartę
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noDataCard: {
    backgroundColor: "#fff",
    padding: 40,
    borderRadius: 20,
    alignItems: "center",
  },
  noDataText: {
    color: "#95a5a6",
    fontSize: 16,
  },
});
