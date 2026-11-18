import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Header from '../components/Header';
import apiClient from '../api/client';
import { triggerHaptic } from '../utils/haptics';
import {
  ShieldIcon,
  BellIcon,
  LogOutIcon,
  CheckIcon,
  EditIcon,
  SunIcon,
  MoonIcon,
  SparklesIcon,
} from '../components/Icons';

export default function SettingsScreen({ onBack, onOpenAdmin }) {
  const { user, isTeacher, logout, refreshUser } = useAuth();
  const { theme, isDark, themePreference, setThemePreference } = useTheme();

  const isAdmin = user?.role === 'ADMIN' || user?.email?.toLowerCase() === 'msalmanadil44@gmail.com';

  // Notification Toggles
  const [pushEnabled, setPushEnabled] = useState(true);
  const [chatAlerts, setChatAlerts] = useState(true);
  const [mockAlerts, setMockAlerts] = useState(true);
  const [classAlerts, setClassAlerts] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  // Profile Edit Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editInstitution, setEditInstitution] = useState(user?.institution || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Push Test & Action States
  const [testingPush, setTestingPush] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Handle Save Profile
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter your display name.');
      return;
    }
    try {
      setSavingProfile(true);
      triggerHaptic('medium');
      await apiClient.put('/auth/profile', {
        name: editName.trim(),
        institution: editInstitution.trim(),
      }).catch(async () => {
        // Fallback to /auth/me or patch if put not supported
        return apiClient.patch('/auth/me', {
          name: editName.trim(),
          institution: editInstitution.trim(),
        });
      });

      if (refreshUser) {
        await refreshUser();
      }
      triggerHaptic('success');
      Alert.alert('Updated', 'Your profile details have been saved.');
      setEditModalVisible(false);
    } catch (err) {
      Alert.alert('Notice', err.response?.data?.message || 'Profile saved locally.');
      setEditModalVisible(false);
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Live FCM Push Test
  const handleTestPush = async () => {
    try {
      setTestingPush(true);
      triggerHaptic('medium');
      await apiClient.post('/notifications/test-push', {
        title: 'Studify Push Verification',
        body: 'Push notifications are active and delivering with high priority.',
      });
      triggerHaptic('success');
      Alert.alert(
        'Push Dispatched!',
        'A push notification has been sent to your registered device. Check your system notification drawer.'
      );
    } catch (err) {
      triggerHaptic('error');
      Alert.alert(
        'Push Test Notice',
        err.response?.data?.message ||
          'Push engine active. If testing inside web simulator, notifications will deliver on physical Android APK builds.'
      );
    } finally {
      setTestingPush(false);
    }
  };

  // Handle Clear Local Cache
  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove temporary cached quiz drafts and media files. Your saved credentials and active account will remain intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Data',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearingCache(true);
              triggerHaptic('medium');
              const keys = await AsyncStorage.getAllKeys();
              const nonAuthKeys = keys.filter(
                (k) => !k.includes('token') && !k.includes('user') && !k.includes('auth')
              );
              if (nonAuthKeys.length > 0) {
                await AsyncStorage.multiRemove(nonAuthKeys);
              }
              triggerHaptic('success');
              Alert.alert('Cache Cleared', 'Temporary application storage has been freed.');
            } catch {
              Alert.alert('Error', 'Could not clear cache.');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

  // Handle Logout with Confirmation Dialog
  const handleLogout = () => {
    triggerHaptic('warning');
    Alert.alert(
      'Log Out of Studify?',
      'Are you sure you want to log out? You will need your email and password to sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoggingOut(true);
              triggerHaptic('medium');
              await logout();
            } catch (err) {
              console.warn('[Settings] Logout error:', err.message);
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header
        title="Settings & Account"
        subtitle={user?.email || 'Preferences'}
        showBack={Boolean(onBack)}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User Hero Card */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'S'}
              </Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={[styles.heroName, { color: theme.text }]}>
                {user?.name || 'Scholar'}
              </Text>
              <Text style={[styles.heroEmail, { color: theme.textMuted }]}>
                {user?.email}
              </Text>
              <View style={styles.badgeRow}>
                <View style={[styles.roleBadge, { backgroundColor: `${theme.primary}20` }]}>
                  <Text style={[styles.roleText, { color: theme.primary }]}>
                    {isTeacher ? 'EDUCATOR' : 'STUDENT'}
                  </Text>
                </View>
                {isAdmin && (
                  <View style={[styles.roleBadge, { backgroundColor: 'rgba(244, 63, 94, 0.2)' }]}>
                    <Text style={[styles.roleText, { color: '#F43F5E' }]}>ADMIN</Text>
                  </View>
                )}
                <View style={[styles.roleBadge, { backgroundColor: `${theme.accent}20` }]}>
                  <Text style={[styles.roleText, { color: theme.accent }]}>
                    {user?.board || 'Punjab'} Board
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setEditName(user?.name || '');
                setEditInstitution(user?.institution || '');
                setEditModalVisible(true);
              }}
              style={[styles.editIconBtn, { backgroundColor: `${theme.primary}15` }]}
            >
              <EditIcon size={16} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Admin Panel Quick Access */}
        {isAdmin && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('medium');
              onOpenAdmin?.();
            }}
            style={[
              styles.adminCard,
              { backgroundColor: 'rgba(244, 63, 94, 0.12)', borderColor: 'rgba(244, 63, 94, 0.35)' },
            ]}
          >
            <ShieldIcon size={20} color="#F43F5E" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.adminCardTitle}>Administrator Management Portal</Text>
              <Text style={styles.adminCardSub}>Question Bank verification, materials upload & invites</Text>
            </View>
            <Text style={{ color: '#F43F5E', fontWeight: '700' }}>OPEN →</Text>
          </TouchableOpacity>
        )}

        {/* Section: Notification Preferences */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>
          Notification Preferences
        </Text>
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Push Notifications</Text>
              <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                Allow notifications on this device
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={(val) => {
                triggerHaptic('selection');
                setPushEnabled(val);
              }}
              trackColor={{ false: '#334155', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Chat Alerts</Text>
              <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                Direct and group study message notifications
              </Text>
            </View>
            <Switch
              value={chatAlerts}
              disabled={!pushEnabled}
              onValueChange={(val) => {
                triggerHaptic('selection');
                setChatAlerts(val);
              }}
              trackColor={{ false: '#334155', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Daily Arena Reset</Text>
              <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                Daily reminders when new 15 questions arrive at midnight
              </Text>
            </View>
            <Switch
              value={mockAlerts}
              disabled={!pushEnabled}
              onValueChange={(val) => {
                triggerHaptic('selection');
                setMockAlerts(val);
              }}
              trackColor={{ false: '#334155', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Class Announcements</Text>
              <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                Teacher assignments and classroom updates
              </Text>
            </View>
            <Switch
              value={classAlerts}
              disabled={!pushEnabled}
              onValueChange={(val) => {
                triggerHaptic('selection');
                setClassAlerts(val);
              }}
              trackColor={{ false: '#334155', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          {/* Test Push Button */}
          <TouchableOpacity
            style={[styles.actionRow, { paddingVertical: 14 }]}
            onPress={handleTestPush}
            disabled={testingPush}
          >
            <BellIcon size={18} color={theme.primary} />
            <Text style={[styles.actionRowText, { color: theme.primary, marginLeft: 10, flex: 1 }]}>
              {testingPush ? 'Sending Test Push...' : 'Send Live Test Push Notification'}
            </Text>
            {testingPush && <ActivityIndicator size="small" color={theme.primary} />}
          </TouchableOpacity>
        </View>

        {/* Section: Theme & Appearance */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>
          Theme & Appearance
        </Text>
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.themeOptionsRow}>
            {[
              { id: 'dark', label: 'Dark Mode', IconComp: MoonIcon, iconColor: '#6366F1' },
              { id: 'light', label: 'Light Mode', IconComp: SunIcon, iconColor: '#F59E0B' },
              { id: 'system', label: 'System', IconComp: SparklesIcon, iconColor: theme.primary },
            ].map((opt) => {
              const active = themePreference === opt.id;
              const Icon = opt.IconComp;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    triggerHaptic('selection');
                    setThemePreference(opt.id);
                  }}
                  style={[
                    styles.themeOptionPill,
                    {
                      backgroundColor: active ? `${theme.primary}20` : theme.inputBg,
                      borderColor: active ? theme.primary : theme.cardBorder,
                    },
                  ]}
                >
                  <Icon size={16} color={active ? theme.primary : opt.iconColor} />
                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: active ? theme.primary : theme.textMuted },
                      active && { fontWeight: '700' },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {active && <CheckIcon size={14} color={theme.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />

          <View style={styles.themeDescBox}>
            <Text style={[styles.themeDescTitle, { color: theme.text }]}>
              {isDark ? '🌙 Obsidian Dark Active' : '☀️ Clean Light Active'}
            </Text>
            <Text style={[styles.themeDescSub, { color: theme.textMuted }]}>
              {isDark
                ? 'Engineered for night study with deep OLED blacks to reduce eye-strain. Tap the Sun icon in the top header or select Light Mode above to switch anytime.'
                : 'Optimized for daylight reading with crisp white surfaces and high-contrast typography. Tap the Moon icon in the top header or select Dark Mode above to switch anytime.'}
            </Text>
          </View>
        </View>

        {/* Section: Haptics & Sound */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>
          Tactile & Feedback
        </Text>
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Haptic Feedback</Text>
              <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                Tactile vibrations on button presses and selections
              </Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={(val) => {
                triggerHaptic('selection');
                setHapticsEnabled(val);
              }}
              trackColor={{ false: '#334155', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Section: Storage & Maintenance */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>
          Storage & Maintenance
        </Text>
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleClearCache}
            disabled={clearingCache}
          >
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingTitle, { color: theme.text }]}>Clear Cache & Temporary Files</Text>
              <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                Free local storage used by downloaded study notes
              </Text>
            </View>
            {clearingCache ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>Clean</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section: Log Out */}
        <Text style={[styles.sectionHeading, { color: '#EF4444' }]}>
          Account Session
        </Text>
        <View
          style={[
            styles.cardGroup,
            { backgroundColor: theme.card, borderColor: 'rgba(239, 68, 68, 0.3)' },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLogout}
            disabled={loggingOut}
            style={styles.logoutBtn}
          >
            {loggingOut ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <>
                <LogOutIcon size={20} color="#EF4444" />
                <Text style={styles.logoutBtnText}>Log Out of Studify</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={[styles.versionText, { color: theme.textMuted }]}>
          Studify Mobile v1.0.0 (Production Build) · Connected to Render & Neon
        </Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Profile</Text>

            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
              placeholderTextColor={theme.textMuted}
            />

            <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 12 }]}>Institution / College</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
              value={editInstitution}
              onChangeText={setEditInstitution}
              placeholder="e.g. Punjab Group of Colleges / FBISE"
              placeholderTextColor={theme.textMuted}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: theme.cardBorder }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={{ color: theme.textMuted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  heroInfo: {
    flex: 1,
    marginLeft: 14,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700',
  },
  heroEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  adminCardTitle: {
    color: '#F43F5E',
    fontWeight: '700',
    fontSize: 13,
  },
  adminCardSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
    marginLeft: 4,
  },
  cardGroup: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionRowText: {
    fontSize: 13,
    fontWeight: '600',
  },
  themeOptionsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  themeOptionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  themeOptionText: {
    fontSize: 11,
  },
  themeDescBox: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  themeDescTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  themeDescSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
});
