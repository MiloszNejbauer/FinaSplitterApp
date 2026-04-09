import api from "@/constants/api";
import { Color } from "@/constants/TWPalette";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router"; // Dodany import dla odświeżania
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ChartItem {
  value: number;
  label: string;
  frontColor?: string;
  gradientColor?: string;
}

const shortPolishMonths: { [key: string]: string } = {
  JANUARY: "Sty",
  FEBRUARY: "Lut",
  MARCH: "Mar",
  APRIL: "Kwi",
  MAY: "Maj",
  JUNE: "Cze",
  JULY: "Lip",
  AUGUST: "Sie",
  SEPTEMBER: "Wrz",
  OCTOBER: "Paź",
  NOVEMBER: "Lis",
  DECEMBER: "Gru",
};

const colorThemes = {
  green: { name: "green", primary: 500, accent: 600 },
};

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAllTime, setTotalAllTime] = useState(0);
  const [colorTheme, setColorTheme] =
    useState<keyof typeof colorThemes>("green");

  const theme = colorThemes[colorTheme];
  const themeColor = Color[theme.name as keyof typeof Color];

  const bgcolors = [
    Color[colorThemes[colorTheme].name as keyof typeof Color][50],
    "#ffffff",
    Color[colorThemes[colorTheme].name as keyof typeof Color][50],
  ] as const;

  // useFocusEffect zamiast useEffect odpali się za każdym razem, gdy ekran stanie się aktywny
  useFocusEffect(
    useCallback(() => {
      fetchFinances();
    }, []),
  );

  const fetchFinances = async () => {
    try {
      setLoading(true);
      const email = await AsyncStorage.getItem("userEmail");
      const response = await api.get(`/expenses/user/${email}/monthly-summary`);

      const rawLabels = Object.keys(response.data);
      const values = Object.values(response.data) as number[];

      setTotalAllTime(values.reduce((a: number, b: number) => a + b, 0));

      const formattedData: ChartItem[] = rawLabels.map((label, index) => {
        let monthKey = label;

        // Inteligentne wyciąganie nazwy miesiąca niezależnie od formatu
        if (label.includes(" ")) {
          const parts = label.split(" ");
          // Jeśli pierwsza część to liczba (np. "2024"), weź drugą część
          monthKey = isNaN(Number(parts[0])) ? parts[0] : parts[1];
        } else if (label.includes("-")) {
          // Obsługa formatu np. "2024-04"
          const monthIndex = parseInt(label.split("-")[1], 10) - 1;
          const monthsNames = Object.keys(shortPolishMonths);
          monthKey = monthsNames[monthIndex];
        }

        const shortMonth =
          shortPolishMonths[monthKey.toUpperCase()] || monthKey.substring(0, 3);

        return {
          value: values[index],
          label: shortMonth,
          frontColor: "#2ecc71",
          gradientColor: "#8ce8b1",
        };
      });

      setChartData(formattedData);
    } catch (e) {
      console.error("Błąd pobierania finansów:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading && chartData.length === 0) {
    // Pokazujemy loader tylko przy pierwszym ładowaniu, żeby nie migał ekran przy przełączaniu zakładek
    return (
      <ActivityIndicator size="large" color="#2ecc71" style={{ flex: 1 }} />
    );
  }

  const screenWidth = Dimensions.get("window").width;
  const maxValue =
    chartData.length > 0
      ? Math.max(...chartData.map((d) => d.value)) * 1.4
      : 100;

  return (
    <View style={[styles.container, { backgroundColor: "#f8f9fa" }]}>
      {/* <StatusBar style="dark" /> */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: 20,
        }}
      >
        <Text style={styles.title}>Moje Finanse</Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            Łączne wydatki (wszystkie grupy):
          </Text>
          <Text style={styles.summaryValue}>{totalAllTime.toFixed(2)} zł</Text>
        </View>

        <Text style={styles.sectionTitle}>Wydatki miesięczne</Text>

        {chartData && chartData.length > 0 ? (
          <View style={styles.chartWrapper}>
            <LinearGradient style={styles.gradientWrapper} colors={bgcolors}>
              <BarChart
                data={chartData}
                barWidth={28}
                spacing={24}
                roundedTop
                roundedBottom={false}
                hideRules={false}
                rulesColor="rgba(0,0,0,0.05)"
                xAxisThickness={1}
                xAxisColor="rgba(0,0,0,0.1)"
                yAxisThickness={0}
                yAxisTextStyle={{ color: "#7f8c8d", fontSize: 12 }}
                xAxisLabelTextStyle={{
                  color: "#7f8c8d",
                  fontSize: 12,
                  textAlign: "center",
                }}
                noOfSections={4}
                maxValue={maxValue}
                isAnimated
                showGradient
                initialSpacing={50}
                // --- KONFIGURACJA DYMKA (TOOLTIP) ---
                pointerConfig={{
                  pointerStripHeight: 160,
                  pointerStripColor: "rgba(46, 204, 113, 0.2)",
                  pointerStripWidth: 2,
                  pointerColor: "#2ecc71",
                  radius: 6,
                  pointerLabelWidth: 80,
                  pointerLabelHeight: 40,
                  // Kluczowe zmiany dla dotyku:
                  activatePointersOnLongPress: false, // Aktywacja po zwykłym kliknięciu
                  persistPointer: true, // Zostaje po kliknięciu
                  hidePointer1: false,
                  pointerVanishDelay: 0,
                  autoAdjustPointerLabelPosition: false,
                  pointerLabelComponent: (items: any) => {
                    return (
                      <View style={styles.tooltipContainer}>
                        <Text style={styles.tooltipText}>
                          {items[0].value.toFixed(2)} zł
                        </Text>
                      </View>
                    );
                  },
                }}
              />
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.noDataCard}>
            <Text style={styles.noDataText}>Brak danych do wyświetlenia</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1,
  },
  gradientWrapper: {
    paddingVertical: 20,
    paddingRight: 10,
    paddingLeft: 10,
    paddingTop: 40,
    alignItems: "center",
  },
  noDataCard: {
    backgroundColor: "#fff",
    padding: 40,
    borderRadius: 20,
    alignItems: "center",
    elevation: 2,
  },
  noDataText: {
    color: "#95a5a6",
    fontSize: 16,
  },
  // Style dla dymka
  tooltipContainer: {
    paddingVertical: 5,
    height: 30,
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2c3e50", // Ciemny granat kontrastujący z jasnym tłem i zielenią
    borderRadius: 8,
    // Przesunięcie, aby dymek był wyśrodkowany nad palcem/słupkiem
    marginLeft: -30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  tooltipText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
});
