import api from "@/constants/api";
import { Color } from "@/constants/TWPalette";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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

interface Group {
  id: string;
  name: string;
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

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [totalAllTime, setTotalAllTime] = useState(0);

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [groupChartData, setGroupChartData] = useState<ChartItem[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupTotal, setGroupTotal] = useState(0);

  const bgcolors = [Color.green[50], "#ffffff", Color.green[50]] as const;

  useFocusEffect(
    useCallback(() => {
      fetchInitialData();
    }, []),
  );

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const email = await AsyncStorage.getItem("userEmail");

      if (!email) {
        console.warn("Nie znaleziono adresu e-mail w AsyncStorage.");
        setLoading(false);
        return;
      }

      const [financesRes, groupsRes] = await Promise.all([
        api.get(`/expenses/user/${email}/monthly-summary`),
        api.get(`/groups/user/${email.toLowerCase()}/with-balances`),
      ]);

      const rawLabels = Object.keys(financesRes.data);
      const values = Object.values(financesRes.data) as number[];
      setTotalAllTime(values.reduce((a, b) => a + b, 0));

      const formattedData = rawLabels.map((label, index) => {
        let monthKey = label.includes("-")
          ? Object.keys(shortPolishMonths)[
              parseInt(label.split("-")[1], 10) - 1
            ]
          : label;
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

      const userGroups = groupsRes.data;
      setGroups(userGroups);
      if (userGroups.length > 0) {
        setSelectedGroupId(userGroups[0].id);
      }
    } catch (e) {
      console.error("Błąd ładowania danych:", e);
    } finally {
      setLoading(false);
    }
  };

  const openGroupSelector = () => {
    if (Platform.OS === "ios") {
      const options = [...groups.map((g) => g.name), "Anuluj"];
      const cancelIndex = options.length - 1;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          title: "Wybierz grupę",
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelIndex) {
            setSelectedGroupId(groups[buttonIndex].id);
          }
        },
      );
    }
  };

  const fetchGroupSpending = async (groupId: string) => {
    if (!groupId) return;
    try {
      setGroupLoading(true);
      const response = await api.get(
        `/groups/group/${groupId}/member-spending-summary`,
      );

      const data = response.data;

      const total = Object.values(data).reduce(
        (acc: number, curr: any) => acc + curr,
        0,
      );
      setGroupTotal(total as number);

      const formatted: ChartItem[] = Object.entries(data).map(
        ([name, amount]) => ({
          value: amount as number,
          label: name.split(" ")[0],
          frontColor: "#3498db",
          gradientColor: "#85c1e9",
        }),
      );

      setGroupChartData(formatted);
    } catch (e) {
      console.error("Błąd pobierania wydatków grupy:", e);
      setGroupChartData([]);
    } finally {
      setGroupLoading(false);
    }
  };

  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupSpending(selectedGroupId);
    }
  }, [selectedGroupId]);

  const maxValueGeneral =
    chartData.length > 0
      ? Math.max(...chartData.map((d) => d.value)) * 1.4
      : 100;
  const maxValueGroup =
    groupChartData.length > 0
      ? Math.max(...groupChartData.map((d) => d.value)) * 1.4
      : 100;

  if (loading && chartData.length === 0) {
    return (
      <ActivityIndicator size="large" color="#2ecc71" style={{ flex: 1 }} />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 20,
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
        <View style={styles.chartWrapper}>
          <LinearGradient style={styles.gradientWrapper} colors={bgcolors}>
            <BarChart
              data={chartData}
              barWidth={28}
              spacing={24}
              roundedTop
              noOfSections={4}
              maxValue={maxValueGeneral}
              isAnimated
              showGradient
              yAxisTextStyle={styles.axisText}
              xAxisLabelTextStyle={styles.axisText}
              renderTooltip={(item: any) => (
                <View style={styles.tooltipContainer}>
                  <Text style={styles.tooltipText}>
                    {item.value.toFixed(2)} zł
                  </Text>
                </View>
              )}
            />
          </LinearGradient>
        </View>

        <View style={{ height: 30 }} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Wydatki w grupie</Text>
        </View>

        {Platform.OS === "ios" ? (
          <TouchableOpacity
            style={styles.iosSelector}
            onPress={openGroupSelector}
          >
            <View style={styles.iosSelectorContent}>
              <Text style={styles.iosSelectorText}>
                {groups.find((g) => g.id === selectedGroupId)?.name ||
                  "Wybierz grupę"}
              </Text>
              <Text style={styles.iosSelectorArrow}>▾</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedGroupId}
              onValueChange={(itemValue) => setSelectedGroupId(itemValue)}
              style={styles.picker}
              dropdownIconColor="#2c3e50"
            >
              {groups.map((group) => (
                <Picker.Item
                  key={group.id}
                  label={group.name}
                  value={group.id}
                />
              ))}
            </Picker>
          </View>
        )}

        {!groupLoading && groupChartData.length > 0 && (
          <View style={styles.groupTotalCard}>
            <Text style={styles.groupTotalLabel}>Suma wydatków grupy:</Text>
            <Text style={styles.groupTotalValue}>
              {groupTotal.toFixed(2)} zł
            </Text>
          </View>
        )}

        {groupLoading ? (
          <ActivityIndicator color="#2ecc71" style={{ marginVertical: 40 }} />
        ) : groupChartData.length > 0 ? (
          <View style={[styles.chartWrapper, { marginBottom: 20 }]}>
            <LinearGradient
              style={styles.gradientWrapper}
              colors={["#ebf5fb", "#ffffff", "#ebf5fb"]}
            >
              <BarChart
                data={groupChartData}
                barWidth={35}
                spacing={30}
                roundedTop
                noOfSections={4}
                maxValue={maxValueGroup}
                isAnimated
                showGradient
                yAxisTextStyle={styles.axisText}
                xAxisLabelTextStyle={styles.axisText}
                renderTooltip={(item: any) => (
                  <View
                    style={[
                      styles.tooltipContainer,
                      { backgroundColor: "#2980b9" },
                    ]}
                  >
                    <Text style={styles.tooltipText}>
                      {item.value.toFixed(2)} zł
                    </Text>
                  </View>
                )}
              />
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.noDataCard}>
            <Text style={styles.noDataText}>
              W tej grupie nie ma jeszcze wydatków
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
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
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartWrapper: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: "hidden",
  },
  gradientWrapper: {
    paddingVertical: 20,
    paddingTop: 40,
    alignItems: "center",
  },
  axisText: { color: "#7f8c8d", fontSize: 11 },
  pickerContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    overflow: "hidden",
  },
  picker: { height: 50, width: "100%" },
  noDataCard: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
  },
  noDataText: { color: "#95a5a6", fontSize: 14 },
  tooltipContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#2c3e50",
    borderRadius: 6,
    alignItems: "center",
  },
  tooltipText: { color: "white", fontWeight: "bold", fontSize: 10 },
  groupTotalCard: {
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 15,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderLeftWidth: 5,
    borderLeftColor: "#3498db",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupTotalLabel: {
    fontSize: 14,
    color: "#7f8c8d",
    fontWeight: "600",
  },
  groupTotalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  iosSelector: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iosSelectorContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iosSelectorText: {
    fontSize: 16,
    color: "#2c3e50",
    fontWeight: "500",
  },
  iosSelectorArrow: {
    fontSize: 18,
    color: "#bdc3c7",
  },
});
