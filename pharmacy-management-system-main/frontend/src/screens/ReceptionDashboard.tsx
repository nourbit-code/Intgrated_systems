import { StyleSheet, Text, View } from 'react-native';
import { ActionCard } from '../components/ActionCard';
import { Notice } from '../components/Notice';
import { Card } from '../components/Card';
import { DataTable } from '../components/DataTable';
import { InputField } from '../components/InputField';
import { SecondaryButton } from '../components/Buttons';
import { Section } from '../components/Section';
import { StatCard } from '../components/StatCard';
import { appointments, stats } from '../data/mockData';
import { useState } from 'react';
import { theme } from '../theme';

export function ReceptionDashboard() {
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState('info');
  const [activeAction, setActiveAction] = useState('appointment');
  const [bookingPatient, setBookingPatient] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingDoctor, setBookingDoctor] = useState('');
  const [checkinPatient, setCheckinPatient] = useState('');

  const handleBookAppointment = () => {
    if (!bookingPatient.trim() || !bookingTime.trim() || !bookingDoctor.trim()) {
      setNotice('Please enter patient, time, and doctor to schedule.');
      setNoticeTone('warning');
      return;
    }
    setNotice('Appointment booked and added to today schedule.');
    setNoticeTone('success');
    setBookingPatient('');
    setBookingTime('');
    setBookingDoctor('');
  };

  const handleCheckIn = () => {
    if (!checkinPatient.trim()) {
      setNotice('Enter a patient name or ID to check-in.');
      setNoticeTone('warning');
      return;
    }
    setNotice('Patient checked in and waiting room updated.');
    setNoticeTone('success');
    setCheckinPatient('');
  };

  return (
    <View style={styles.scrollContainer}>
      {notice ? <Notice title="Reception" message={notice} tone={noticeTone} /> : null}
      <Section title="Action Workspace">
        <Card variant="white">
          {activeAction === 'appointment' ? (
            <View style={styles.actionBlock}>
              <Text style={styles.actionTitle}>Book Appointment</Text>
              <InputField
                label="Patient"
                placeholder="Patient name"
                value={bookingPatient}
                onChangeText={setBookingPatient}
              />
              <InputField
                label="Time"
                placeholder="10:30"
                value={bookingTime}
                onChangeText={setBookingTime}
              />
              <InputField
                label="Doctor"
                placeholder="Dr. Salma"
                value={bookingDoctor}
                onChangeText={setBookingDoctor}
              />
              <View style={styles.buttonRow}>
                <SecondaryButton label="Schedule" onPress={handleBookAppointment} />
              </View>
            </View>
          ) : (
            <View style={styles.actionBlock}>
              <Text style={styles.actionTitle}>Patient Check-In</Text>
              <InputField
                label="Patient"
                placeholder="Patient name or ID"
                value={checkinPatient}
                onChangeText={setCheckinPatient}
              />
              <View style={styles.buttonRow}>
                <SecondaryButton label="Check In" onPress={handleCheckIn} />
              </View>
            </View>
          )}
        </Card>
      </Section>

      <View style={styles.row}>
        {stats.reception.map((item) => (
          <StatCard key={item.label} {...item} variant="soft" />
        ))}
      </View>

      <Section title="Reception Actions">
        <View style={styles.row}>
          <ActionCard
            label="Book Appointment"
            hint="Schedule patient"
            onPress={() => {
              setActiveAction('appointment');
              setNotice('Appointment booking opened.');
              setNoticeTone('info');
            }}
          />
          <ActionCard
            label="Check-In"
            hint="Arrival tracking"
            onPress={() => {
              setActiveAction('checkin');
              setNotice('Check-in workspace opened.');
              setNoticeTone('info');
            }}
          />
        </View>
      </Section>

      <Section title="Today Appointments">
        <Card variant="white">
          <DataTable
            columns={[
              { key: 'patient', label: 'Patient', wide: true },
              { key: 'time', label: 'Time' },
              { key: 'doctor', label: 'Doctor' },
            ]}
            rows={appointments}
          />
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
});


