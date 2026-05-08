import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { ActionCard } from '../components/ActionCard';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { SecondaryButton } from '../components/Buttons';
import { Section } from '../components/Section';
import { StatCard } from '../components/StatCard';
import { stats } from '../data/mockData';
import { createPrescription } from '../api/pharmacy';
import { Notice } from '../components/Notice';
import { theme } from '../theme';

export function DoctorDashboard() {
  const [patient, setPatient] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [medication, setMedication] = useState('');
  const [dosage, setDosage] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState('info');
  const [activeAction, setActiveAction] = useState('prescription');
  const [recordNote, setRecordNote] = useState('');

  const handleSend = async () => {
    setActiveAction('prescription');
    if (!patient.trim() || !diagnosis.trim() || !medication.trim()) {
      setNotice('Patient, diagnosis and medication are required.');
      setNoticeTone('warning');
      return;
    }
    try {
      await createPrescription({
        patient: patient.trim(),
        diagnosis: diagnosis.trim(),
        medication: medication.trim(),
        dosage: dosage.trim(),
        notes: notes.trim(),
      });
      setNotice('Prescription sent to pharmacy.');
      setNoticeTone('success');
      setPatient('');
      setDiagnosis('');
      setMedication('');
      setDosage('');
      setNotes('');
    } catch (err) {
      setNotice('Failed to send prescription.');
      setNoticeTone('warning');
    }
  };

  return (
    <View style={styles.scrollContainer}>
      {notice ? <Notice title="Doctor" message={notice} tone={noticeTone} /> : null}
      <Section title="Action Workspace">
        <Card variant="white">
          {activeAction === 'prescription' ? (
            <View style={styles.actionBlock}>
              <Text style={styles.actionTitle}>Prescription Composer</Text>
              <Text style={styles.actionText}>
                Use the form below to create and send a new prescription to the pharmacy.
              </Text>
              <SecondaryButton
                label="Jump to Form"
                onPress={() => {
                  setNotice('Prescription form is ready below.');
                  setNoticeTone('info');
                }}
              />
            </View>
          ) : activeAction === 'record' ? (
            <View style={styles.actionBlock}>
              <Text style={styles.actionTitle}>Patient Record Snapshot</Text>
              <Text style={styles.actionText}>
                Patient: Mona Hassan - MRN-2218 - Allergies: None
              </Text>
              <InputField
                label="Quick Note"
                placeholder="Add a short note to the record"
                value={recordNote}
                onChangeText={setRecordNote}
              />
              <View style={styles.buttonRow}>
                <SecondaryButton
                  label="Save Note"
                  onPress={() => {
                    if (!recordNote.trim()) {
                      setNotice('Please add a note before saving.');
                      setNoticeTone('warning');
                      return;
                    }
                    setNotice('Note saved to patient record.');
                    setNoticeTone('success');
                    setRecordNote('');
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.actionBlock}>
              <Text style={styles.actionTitle}>Lab Review</Text>
              <Text style={styles.actionText}>
                CBC and lipid panel results are ready for review.
              </Text>
              <View style={styles.buttonRow}>
                <SecondaryButton
                  label="Request Repeat Test"
                  onPress={() => {
                    setNotice('Repeat test requested and sent to reception.');
                    setNoticeTone('success');
                  }}
                />
              </View>
            </View>
          )}
        </Card>
      </Section>

      <View style={styles.row}>
        {stats.doctor.map((item) => (
          <StatCard key={item.label} {...item} />
        ))}
      </View>

      <Section title="Doctor Quick Actions">
        <View style={styles.row}>
          <ActionCard
            label="New Prescription"
            hint="Auto-sync to pharmacy"
            onPress={() => {
              setActiveAction('prescription');
              setNotice('Prescription form opened.');
              setNoticeTone('info');
            }}
          />
          <ActionCard
            label="Open Medical Record"
            hint="Review patient history"
            onPress={() => {
              setActiveAction('record');
              setNotice('Patient record workspace opened.');
              setNoticeTone('info');
            }}
          />
          <ActionCard
            label="Lab Results"
            hint="View latest tests"
            onPress={() => {
              setActiveAction('lab');
              setNotice('Lab results workspace opened.');
              setNoticeTone('info');
            }}
          />
        </View>
      </Section>

      <Section title="New Prescription">
        <Card variant="white">
          <InputField label="Patient" placeholder="Search patient" value={patient} onChangeText={setPatient} />
          <InputField label="Diagnosis" placeholder="Write diagnosis" value={diagnosis} onChangeText={setDiagnosis} />
          <InputField label="Medication" placeholder="Drug name" value={medication} onChangeText={setMedication} />
          <InputField label="Dosage" placeholder="Example: 1 tab twice daily" value={dosage} onChangeText={setDosage} />
          <InputField label="Notes" placeholder="Optional notes for pharmacy" value={notes} onChangeText={setNotes} />
          <View style={styles.buttonRow}>
            <SecondaryButton label="Send to Pharmacy" onPress={handleSend} />
          </View>
        </Card>
      </Section>

    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  buttonRow: {
    marginTop: 16,
    alignItems: 'flex-start',
  },
  actionBlock: {
    gap: 12,
  },
  actionTitle: {
    fontSize: 14,
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
  },
  actionText: {
    color: theme.colors.inkMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    lineHeight: 18,
  },
});



