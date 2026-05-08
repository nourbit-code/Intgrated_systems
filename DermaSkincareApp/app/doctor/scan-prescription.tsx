import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type RxPayload = {
  documentType?: string;
  schemaVersion?: number;
  issuedAt?: string;
  rxNumber?: string;
  clinic?: { name?: string };
  doctor?: { name?: string };
  patient?: { name?: string; patientId?: string; age?: number; gender?: string; phone?: string };
  diagnosis?: { finalDiagnosis?: string; notes?: string };
  prescriptions?: Array<{ line?: number; medication?: string; dose?: string; duration?: string; notes?: string }>;
};

export default function ScanPrescriptionPage() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [payload, setPayload] = useState<RxPayload | null>(null);

  const parsedDate = useMemo(() => {
    if (!payload?.issuedAt) return "-";
    const d = new Date(payload.issuedAt);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
  }, [payload?.issuedAt]);

  const onScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const raw = String(data || "").trim();
      let candidate = raw;
      if (raw.startsWith("data:")) {
        const comma = raw.indexOf(",");
        candidate = comma >= 0 ? raw.slice(comma + 1) : raw;
      }
      try {
        candidate = decodeURIComponent(candidate);
      } catch {
        // keep original candidate when not URI-encoded
      }

      let parsed: any = null;
      try {
        parsed = JSON.parse(candidate);
      } catch {
        // Try to salvage JSON from mixed payload text
        const start = candidate.indexOf("{");
        const end = candidate.lastIndexOf("}");
        if (start >= 0 && end > start) {
          parsed = JSON.parse(candidate.slice(start, end + 1));
        }
      }

      if (parsed?.documentType !== "DERMA_RX") {
        Alert.alert("Invalid QR", "This is not a DERMA prescription QR.");
        return;
      }
      setPayload(parsed);
    } catch {
      Alert.alert("Invalid QR", "Could not parse this QR. Please scan a DERMA prescription QR.");
    }
  };

  if (!permission) return <View style={styles.center}><Text>Loading camera permission...</Text></View>;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Camera access is required to scan prescription QR.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Prescription QR</Text>
      </View>

      {!payload ? (
        <View style={styles.scannerWrap}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onScanned}
          />
          <Text style={styles.muted}>Point camera at the prescription QR</Text>
          {scanned ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setScanned(false)}>
              <Text style={styles.primaryBtnText}>Scan Again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.cardWrap}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardHeadText}>{payload?.clinic?.name || "Derma Clinic"}</Text>
            </View>
            <View style={styles.cardMeta}>
              <Text style={styles.cardMetaText}>Doctor: {payload?.doctor?.name || "-"}</Text>
              <Text style={styles.cardMetaText}>Date: {parsedDate}</Text>
              <Text style={styles.rxId}>#{payload?.rxNumber || "RX-N/A"}</Text>
            </View>
            <View style={styles.infoBlock}>
              <Text style={styles.infoLine}><Text style={styles.label}>Name:</Text> {payload?.patient?.name || "-"}</Text>
              <Text style={styles.infoLine}><Text style={styles.label}>Patient ID:</Text> {payload?.patient?.patientId || "-"}</Text>
              <Text style={styles.infoLine}><Text style={styles.label}>Age:</Text> {payload?.patient?.age ?? "-"}</Text>
              <Text style={styles.infoLine}><Text style={styles.label}>Gender:</Text> {payload?.patient?.gender || "-"}</Text>
              <Text style={styles.infoLine}><Text style={styles.label}>Phone:</Text> {payload?.patient?.phone || "-"}</Text>
            </View>
            <View style={styles.diagBox}>
              <Text style={styles.diagText}>Final Diagnosis: {payload?.diagnosis?.finalDiagnosis || "-"}</Text>
            </View>
            <View style={styles.tableHead}>
              <Text style={styles.th}>Medication</Text>
              <Text style={styles.th}>Dose</Text>
              <Text style={styles.th}>Duration</Text>
              <Text style={styles.th}>Notes</Text>
            </View>
            {(payload?.prescriptions || []).map((m, idx) => (
              <View key={`rx-${idx}`} style={styles.tr}>
                <Text style={styles.td}>{m.medication || "-"}</Text>
                <Text style={styles.td}>{m.dose || "-"}</Text>
                <Text style={styles.td}>{m.duration || "-"}</Text>
                <Text style={styles.td}>{m.notes || "-"}</Text>
              </View>
            ))}
            <Text style={styles.notes}><Text style={styles.label}>Notes:</Text> {payload?.diagnosis?.notes || "-"}</Text>
          </View>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              setPayload(null);
              setScanned(false);
            }}
          >
            <Text style={styles.primaryBtnText}>Scan Another QR</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10 },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: "#e2e8f0", marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  scannerWrap: { flex: 1, padding: 16, alignItems: "center", gap: 12 },
  camera: { width: "100%", maxWidth: 500, aspectRatio: 1, borderRadius: 14, overflow: "hidden" },
  muted: { color: "#64748b", textAlign: "center" },
  primaryBtn: { backgroundColor: "#9b084d", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, marginTop: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  cardWrap: { padding: 16, gap: 12 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff", overflow: "hidden" },
  cardHead: { backgroundColor: "#9b084d", padding: 12 },
  cardHeadText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  cardMeta: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", gap: 2 },
  cardMetaText: { color: "#334155", fontSize: 14 },
  rxId: { color: "#9b084d", fontWeight: "800", marginTop: 4 },
  infoBlock: { padding: 12, gap: 4 },
  infoLine: { fontSize: 15, color: "#111827" },
  label: { fontWeight: "800" },
  diagBox: { marginHorizontal: 12, marginBottom: 10, backgroundColor: "#f7dbe9", borderRadius: 10, padding: 10 },
  diagText: { fontWeight: "800", color: "#111827" },
  tableHead: { flexDirection: "row", backgroundColor: "#9b084d", paddingVertical: 8, paddingHorizontal: 6 },
  th: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 12 },
  tr: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: "#eceff3" },
  td: { flex: 1, fontSize: 12, color: "#111827" },
  notes: { padding: 12, color: "#374151" },
});
