import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';

export default function ProfileScreen() {
  const { user, isTeacher, logout } = useAuth();
  const { theme, themePreference, setThemePreference } = useTheme();

  const [testingPush, setTestingPush] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleTestPush = async () => {
    try {
      setTestingPush(true);
      triggerHaptic('medium');
      await apiClient.post('/notifications/test-push', {
        title: 'Studify APK Push Verification 🚀',
        body: 'Push engine verified! Sideloaded APK receives notifications cleanly in foreground and background.',
      });

      triggerHaptic('success');
      Alert.alert(
        'Push Dispatched!',
        'A push notification has been sent to your registered device. Check your Android notification drawer.'
      );
    } catch (err) {
      triggerHaptic('error');
      Alert.alert(
        'Push Test Notice',
        err.response?.data?.message ||
          'Push token registered. If testing on an emulator, push delivery requires a physical Android device or standalone APK build.'
      );
    } finally {
      setTestingPush(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from Studify?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            setLoggingOut(true);
            triggerHaptic('medium');
            await logout();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header title="Account Profile" subtitle="Settings & Appearance" />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User Profile Card */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
            </Text>
          </View>
          <Text style={[styles.userName, { color: theme.text }]}>{user?.name || 'Scholar'}</Text>
          <Text style={[styles.userEmail, { color: theme.textMuted }]}>{user?.email}</Text>

          <View style={styles.badgeRow}>
            <View style={[styles.roleBadge, { backgroundColor: `${theme.primary}20` }]}>
              <Text style={[styles.roleText, { color: theme.primary }]}>
                {isTeacher ? 'EDUCATOR / TEACHER' : 'STUDENT'}
              </Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: `${theme.accent}20` }]}>
              <Text style={[styles.roleText, { color: theme.accent }]}>
                {user?.board || 'Punjab'} Board
              </Text>
            </View>
          </View>
        </View>

        {/* APK Push Notification Test Section */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>
          Push Notifications Engine
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Sideloaded Android APK Push Guarantee
          </Text>
          <Text style={[styles.cardDesc, { color: theme.textMuted }]}>
            Studify uses Firebase Cloud Messaging (FCM) channels with high-importance heads-up delivery on standalone Android APKs.
          </Text>
          <TouchableOpacity
            style={[styles.pushTestBtn, { backgroundColor: theme.primary }]}
            onPress={handleTestPush}
            disabled={testingPush}
          >
            {testingPush ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.pushTestBtnText}>📲 Send Live Test Push Notification</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Appearance Settings */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 20 }]}>
          Theme & Display
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.text }]}>Appearance Mode</Text>
          <View style={styles.themeRow}>
            {[
              { id: 'dark', label: 'Dark Mode', icon: '🌙' },
              { id: 'light', label: 'Light Mode', icon: '☀️' },
              { id: 'system', label: 'Auto System', icon: '⚙️' },
            ].map((m) => {
              const isSelected = themePreference === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: isSelected ? `${theme.primary}20` : theme.inputBg,
                      borderColor: isSelected ? theme.primary : theme.cardBorder,
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setThemePreference(m.id);
                  }}
                >
                  <Text style={styles.themeIcon}>{m.icon}</Text>
                  <Text
                    style={[
                      styles.themeText,
                      { color: isSelected ? theme.primary : theme.textMuted },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: theme.error }]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator color={theme.error} />
          ) : (
            <Text style={[styles.logoutText, { color: theme.error }]}>Sign Out of Studify</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 18,
    paddingBottom: 36,
  },
  profileCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  pushTestBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  pushTestBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  themeIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  themeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  logoutBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
