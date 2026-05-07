import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import InsuranceSettingsContent from "../../components/InsuranceSettingsContent";
import { useAuth } from "../context/AuthContext";
import { useAutoRefresh } from "@/src/hooks/useAutoRefresh";
import {
  createDoctor,
  createReceptionist,
  deleteDoctor,
  deleteReceptionist,
  ensureReceptionistAdmin,
  getClinicSchedules,
  getDoctors,
  getReceptionists,
  upsertClinicSchedule,
} from "../../src/api/receptionistApi";

const PRIMARY_DARK = "#9B084D";
const PRIMARY_LIGHT = "#E80A7A";
const GRAY_BG = "#F7F7F7";
const WHITE = "#FFFFFF";
const BORDER_LIGHT = "#E0E0E0";
const TEXT_DARK = "#333333";
const TEXT_MEDIUM = "#666666";

type CredentialsItem = {
  id: string;
  name: string;
  email: string;
  role: "receptionist" | "doctor";
  is_admin?: boolean;
  created_at?: string;
};

type DoctorItem = {
  doctor_id: number;
  name: string;
  email?: string;
};

type ReceptionistItem = {
  receptionist_id: number;
  name: string;
  email?: string;
  is_admin?: boolean;
};

type ClinicSchedule = {
  openDays: number[];
  openTime: string;
  closeTime: string;
  slotInterval: number;
};

const DEFAULT_SCHEDULE: ClinicSchedule = {
  openDays: [1, 2, 3, 4, 5, 6],
  openTime: "09:00",
  closeTime: "17:00",
  slotInterval: 30,
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const normalizeTime = (timeValue?: string): string => {
  if (!timeValue) return "09:00";
  return String(timeValue).slice(0, 5);
};

const toPayloadTime = (timeValue: string): string => {
  const trimmed = String(timeValue || "").trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  return "09:00";
};

export default function SettingsPage() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState<"insurance" | "credentials" | "schedule">("insurance");
  const [isLoading, setIsLoading] = useState(true);

  const [credentialsList, setCredentialsList] = useState<CredentialsItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [receptionists, setReceptionists] = useState<ReceptionistItem[]>([]);

  const [credName, setCredName] = useState("");
  const [credEmail, setCredEmail] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credRole, setCredRole] = useState<CredentialsItem["role"]>("receptionist");

  const [scheduleByDoctor, setScheduleByDoctor] = useState<Record<string, ClinicSchedule>>({
    default: DEFAULT_SCHEDULE,
  });
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("default");

  const refreshSettingsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [doctorsRes, receptionistsRes, schedulesRes] = await Promise.all([
        getDoctors(),
        getReceptionists(),
        getClinicSchedules(),
      ]);

      const doctorsData: DoctorItem[] = doctorsRes?.success && Array.isArray(doctorsRes.data) ? doctorsRes.data : [];
      const receptionistsData: ReceptionistItem[] =
        receptionistsRes?.success && Array.isArray(receptionistsRes.data) ? receptionistsRes.data : [];

      setDoctors(doctorsData);
      setReceptionists(receptionistsData);

      const mergedCredentials: CredentialsItem[] = [
        ...doctorsData.map((doc) => ({
          id: String(doc.doctor_id),
          name: doc.name,
          email: doc.email || "",
          role: "doctor" as const,
        })),
        ...receptionistsData.map((rec) => ({
          id: String(rec.receptionist_id),
          name: rec.name,
          email: rec.email || "",
          role: "receptionist" as const,
          is_admin: !!rec.is_admin,
        })),
      ];
      setCredentialsList(mergedCredentials);

      const nextMap: Record<string, ClinicSchedule> = { default: DEFAULT_SCHEDULE };
      if (schedulesRes?.success && Array.isArray(schedulesRes.data)) {
        schedulesRes.data.forEach(
          (item: {
            doctor: number | null;
            open_days: number[];
            open_time: string;
            close_time: string;
            slot_interval: number;
          }) => {
            const key = item.doctor ? String(item.doctor) : "default";
            nextMap[key] = {
              openDays: Array.isArray(item.open_days) ? item.open_days : DEFAULT_SCHEDULE.openDays,
              openTime: normalizeTime(item.open_time),
              closeTime: normalizeTime(item.close_time),
              slotInterval: Number(item.slot_interval) || 30,
            };
          }
        );
      }
      setScheduleByDoctor(nextMap);
    } catch (err) {
      console.error("[Settings] Failed to refresh settings data:", err);
      Alert.alert("Error", "Failed to load settings data from backend.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSettingsData();
  }, [refreshSettingsData]);

  useAutoRefresh(refreshSettingsData, { intervalMs: 45000 });

  useEffect(() => {
    const ensureAdmin = async () => {
      if (role === "receptionist" && user?.id) {
        await ensureReceptionistAdmin(user.id);
        await refreshSettingsData();
      }
    };
    ensureAdmin();
  }, [refreshSettingsData, role, user?.id]);

  const currentReceptionist = useMemo(
    () => receptionists.find((item) => item.receptionist_id === user?.id),
    [receptionists, user?.id]
  );
  const isAdmin = role === "receptionist" && (!!(user as { is_admin?: boolean } | null)?.is_admin || !!currentReceptionist?.is_admin);

  const doctorOptions = useMemo(
    () => doctors.map((doc) => ({ id: String(doc.doctor_id), name: doc.name })),
    [doctors]
  );

  useEffect(() => {
    if (selectedDoctorId !== "default" && !doctorOptions.find((d) => d.id === selectedDoctorId)) {
      setSelectedDoctorId("default");
    }
  }, [doctorOptions, selectedDoctorId]);

  const handleAddCredential = async () => {
    if (!credName.trim() || !credEmail.trim() || !credPassword.trim()) {
      Alert.alert("Missing Fields", "Please fill in name, email, and password.");
      return;
    }

    const payload = {
      name: credName.trim(),
      email: credEmail.trim().toLowerCase(),
      password: credPassword.trim(),
    };

    const response =
      credRole === "doctor" ? await createDoctor({ ...payload, specialty: "" }) : await createReceptionist(payload);

    if (!response.success) {
      Alert.alert("Error", String(response.error || "Failed to create account"));
      return;
    }

    setCredName("");
    setCredEmail("");
    setCredPassword("");
    setCredRole("receptionist");
    await refreshSettingsData();
    Alert.alert("Success", "Account created.");
  };

  const handleRemoveCredential = async (item: CredentialsItem) => {
    if (item.role === "receptionist" && Number(item.id) === user?.id) {
      Alert.alert("Not Allowed", "You cannot delete the currently logged in account.");
      return;
    }

    const response = item.role === "doctor" ? await deleteDoctor(Number(item.id)) : await deleteReceptionist(Number(item.id));
    if (!response.success) {
      Alert.alert("Error", String(response.error || "Failed to delete account"));
      return;
    }
    await refreshSettingsData();
  };

  const activeSchedule = scheduleByDoctor[selectedDoctorId] || scheduleByDoctor.default || DEFAULT_SCHEDULE;

  const toggleDay = (dayIndex: number) => {
    const openDays = activeSchedule.openDays.includes(dayIndex)
      ? activeSchedule.openDays.filter((d) => d !== dayIndex)
      : [...activeSchedule.openDays, dayIndex].sort((a, b) => a - b);
    setScheduleByDoctor((prev) => ({ ...prev, [selectedDoctorId]: { ...activeSchedule, openDays } }));
  };

  const saveSchedule = async () => {
    const payload = {
      doctor: selectedDoctorId === "default" ? null : Number(selectedDoctorId),
      open_days: activeSchedule.openDays,
      open_time: toPayloadTime(activeSchedule.openTime),
      close_time: toPayloadTime(activeSchedule.closeTime),
      slot_interval: Math.max(5, activeSchedule.slotInterval || 30),
    };

    const response = await upsertClinicSchedule(payload);
    if (!response.success) {
      Alert.alert("Error", String(response.error || "Failed to save schedule"));
      return;
    }
    await refreshSettingsData();
    Alert.alert("Saved", "Clinic schedule updated.");
  };

  const resetSchedule = async () => {
    const fallback = selectedDoctorId === "default" ? DEFAULT_SCHEDULE : scheduleByDoctor.default || DEFAULT_SCHEDULE;
    setScheduleByDoctor((prev) => ({ ...prev, [selectedDoctorId]: fallback }));

    const response = await upsertClinicSchedule({
      doctor: selectedDoctorId === "default" ? null : Number(selectedDoctorId),
      open_days: fallback.openDays,
      open_time: toPayloadTime(fallback.openTime),
      close_time: toPayloadTime(fallback.closeTime),
      slot_interval: fallback.slotInterval,
    });

    if (!response.success) {
      Alert.alert("Error", String(response.error || "Failed to reset schedule"));
      return;
    }
    await refreshSettingsData();
    Alert.alert("Saved", "Schedule reset.");
  };

  const slotsPreview = useMemo(() => {
    const [openH, openM] = activeSchedule.openTime.split(":").map(Number);
    const [closeH, closeM] = activeSchedule.closeTime.split(":").map(Number);
    if (Number.isNaN(openH) || Number.isNaN(openM) || Number.isNaN(closeH) || Number.isNaN(closeM)) return [];

    const startMinutes = openH * 60 + openM;
    const endMinutes = closeH * 60 + closeM;
    const interval = Math.max(5, activeSchedule.slotInterval || 30);

    const slots: string[] = [];
    for (let t = startMinutes; t <= endMinutes; t += interval) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      const period = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      slots.push(`${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`);
    }
    return slots;
  }, [activeSchedule]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Settings</Text>
            <Text style={styles.pageSubtitle}>Insurance, accounts, and clinic schedules</Text>
          </View>
          <View style={styles.titleIcon}>
            <Ionicons name="settings-outline" size={24} color={PRIMARY_DARK} />
          </View>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tabButton, activeTab === "insurance" && styles.tabActive]} onPress={() => setActiveTab("insurance")}>
            <Text style={[styles.tabText, activeTab === "insurance" && styles.tabTextActive]}>Insurance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === "credentials" && styles.tabActive]} onPress={() => setActiveTab("credentials")}>
            <Text style={[styles.tabText, activeTab === "credentials" && styles.tabTextActive]}>Credentials</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === "schedule" && styles.tabActive]} onPress={() => setActiveTab("schedule")}>
            <Text style={[styles.tabText, activeTab === "schedule" && styles.tabTextActive]}>Clinic Schedule</Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={PRIMARY_DARK} />
            <Text style={styles.loadingText}>Loading settings from backend...</Text>
          </View>
        )}

        {!isLoading && activeTab === "insurance" && (
          <View style={styles.sectionCard}>
            <InsuranceSettingsContent embedded />
          </View>
        )}

        {!isLoading && activeTab === "credentials" && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>User Accounts</Text>
            {!isAdmin ? (
              <View style={styles.noticeBox}>
                <Ionicons name="lock-closed-outline" size={18} color={PRIMARY_DARK} />
                <Text style={styles.noticeText}>Only the admin receptionist can manage accounts.</Text>
              </View>
            ) : (
              <>
                <TextInput style={styles.input} placeholder="Full Name" value={credName} onChangeText={setCredName} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  value={credEmail}
                  onChangeText={setCredEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextInput style={styles.input} placeholder="Temporary Password" value={credPassword} onChangeText={setCredPassword} />
                <Text style={styles.label}>Role</Text>
                <View style={styles.roleRow}>
                  <TouchableOpacity style={[styles.rolePill, credRole === "receptionist" && styles.rolePillActive]} onPress={() => setCredRole("receptionist")}>
                    <Text style={[styles.rolePillText, credRole === "receptionist" && styles.rolePillTextActive]}>Receptionist</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rolePill, credRole === "doctor" && styles.rolePillActive]} onPress={() => setCredRole("doctor")}>
                    <Text style={[styles.rolePillText, credRole === "doctor" && styles.rolePillTextActive]}>Doctor</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.saveButton} onPress={handleAddCredential}>
                  <Text style={styles.saveButtonText}>Create Account</Text>
                </TouchableOpacity>
              </>
            )}

            {credentialsList.length > 0 && (
              <View style={styles.list}>
                {credentialsList.map((c) => (
                  <View key={`${c.role}-${c.id}`} style={styles.listItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listTitle}>{c.name}</Text>
                      <Text style={styles.listSubtitle}>
                        {c.email} | {c.role === "doctor" ? "Doctor" : "Receptionist"}
                        {c.is_admin ? " | Admin" : ""}
                      </Text>
                    </View>
                    {isAdmin && (
                      <TouchableOpacity onPress={() => handleRemoveCredential(c)} style={styles.removeButton}>
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {!isLoading && activeTab === "schedule" && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Clinic Schedule and Time Slots</Text>
            <Text style={styles.label}>Doctor Schedule</Text>
            <View style={styles.doctorRow}>
              <TouchableOpacity style={[styles.doctorPill, selectedDoctorId === "default" && styles.doctorPillActive]} onPress={() => setSelectedDoctorId("default")}>
                <Ionicons name="people-outline" size={14} color={selectedDoctorId === "default" ? WHITE : TEXT_DARK} />
                <Text style={[styles.doctorPillText, selectedDoctorId === "default" && styles.doctorPillTextActive]}>All Doctors</Text>
              </TouchableOpacity>
              {doctorOptions.map((doc) => (
                <TouchableOpacity key={doc.id} style={[styles.doctorPill, selectedDoctorId === doc.id && styles.doctorPillActive]} onPress={() => setSelectedDoctorId(doc.id)}>
                  <Ionicons name="medical-outline" size={14} color={selectedDoctorId === doc.id ? WHITE : TEXT_DARK} />
                  <Text style={[styles.doctorPillText, selectedDoctorId === doc.id && styles.doctorPillTextActive]}>Dr. {doc.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Open Days</Text>
            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, idx) => {
                const active = activeSchedule.openDays.includes(idx);
                return (
                  <TouchableOpacity key={label} style={[styles.dayPill, active && styles.dayPillActive]} onPress={() => toggleDay(idx)}>
                    {active && <Ionicons name="checkmark-circle" size={14} color={WHITE} />}
                    <Text style={[styles.dayPillText, active && styles.dayPillTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Open Time (24h)</Text>
            <TextInput
              style={styles.input}
              value={activeSchedule.openTime}
              onChangeText={(v) => setScheduleByDoctor((prev) => ({ ...prev, [selectedDoctorId]: { ...activeSchedule, openTime: v } }))}
              placeholder="09:00"
            />

            <Text style={styles.label}>Close Time (24h)</Text>
            <TextInput
              style={styles.input}
              value={activeSchedule.closeTime}
              onChangeText={(v) => setScheduleByDoctor((prev) => ({ ...prev, [selectedDoctorId]: { ...activeSchedule, closeTime: v } }))}
              placeholder="17:00"
            />

            <Text style={styles.label}>Slot Interval (minutes)</Text>
            <TextInput
              style={styles.input}
              value={String(activeSchedule.slotInterval)}
              onChangeText={(v) =>
                setScheduleByDoctor((prev) => ({
                  ...prev,
                  [selectedDoctorId]: { ...activeSchedule, slotInterval: parseInt(v, 10) || 30 },
                }))
              }
              keyboardType="numeric"
            />

            <TouchableOpacity style={styles.saveButton} onPress={saveSchedule}>
              <Text style={styles.saveButtonText}>Save Schedule</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveButton, styles.resetButton]} onPress={resetSchedule}>
              <Text style={styles.resetButtonText}>Reset Defaults</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 16 }]}>Time Slots Preview</Text>
            <View style={styles.previewBox}>
              {slotsPreview.length === 0 ? (
                <Text style={styles.previewText}>No slots (check times).</Text>
              ) : (
                <Text style={styles.previewText}>{slotsPreview.join("  |  ")}</Text>
              )}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: GRAY_BG,
    paddingBottom: 30,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: PRIMARY_DARK,
  },
  pageSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: TEXT_MEDIUM,
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FCE7F3",
    justifyContent: "center",
    alignItems: "center",
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  tabButton: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: PRIMARY_DARK,
    borderColor: PRIMARY_DARK,
  },
  tabText: {
    color: TEXT_DARK,
    fontWeight: "600",
  },
  tabTextActive: {
    color: WHITE,
  },
  loadingBox: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: TEXT_MEDIUM,
    fontWeight: "600",
  },
  sectionCard: {
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: PRIMARY_DARK,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: PRIMARY_DARK,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 6,
  },
  saveButtonText: {
    color: WHITE,
    fontWeight: "700",
  },
  resetButton: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: PRIMARY_DARK,
  },
  resetButtonText: {
    color: PRIMARY_DARK,
    fontWeight: "700",
  },
  dayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: WHITE,
  },
  dayPillActive: {
    backgroundColor: PRIMARY_LIGHT,
    borderColor: PRIMARY_LIGHT,
  },
  dayPillText: {
    color: TEXT_DARK,
    fontWeight: "600",
    fontSize: 12,
  },
  dayPillTextActive: {
    color: WHITE,
  },
  doctorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  doctorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: WHITE,
  },
  doctorPillActive: {
    backgroundColor: PRIMARY_DARK,
    borderColor: PRIMARY_DARK,
  },
  doctorPillText: {
    color: TEXT_DARK,
    fontWeight: "600",
    fontSize: 12,
  },
  doctorPillTextActive: {
    color: WHITE,
  },
  roleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  rolePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: WHITE,
  },
  rolePillActive: {
    backgroundColor: PRIMARY_LIGHT,
    borderColor: PRIMARY_LIGHT,
  },
  rolePillText: {
    color: TEXT_DARK,
    fontWeight: "600",
    fontSize: 13,
  },
  rolePillTextActive: {
    color: WHITE,
  },
  previewBox: {
    backgroundColor: GRAY_BG,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  previewText: {
    color: TEXT_MEDIUM,
    fontSize: 12,
  },
  noticeBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#FDF2F8",
    borderWidth: 1,
    borderColor: "#FAD2E1",
  },
  noticeText: {
    color: PRIMARY_DARK,
    fontWeight: "600",
    fontSize: 13,
  },
  list: {
    marginTop: 16,
  },
  listItem: {
    backgroundColor: GRAY_BG,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  listSubtitle: {
    fontSize: 12,
    color: TEXT_MEDIUM,
    marginTop: 4,
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PRIMARY_LIGHT,
  },
  removeText: {
    color: WHITE,
    fontWeight: "700",
    fontSize: 12,
  },
});
