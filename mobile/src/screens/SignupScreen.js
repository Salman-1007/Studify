import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Switch,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../utils/haptics';
import { SunIcon, MoonIcon } from '../components/Icons';

export default function SignupScreen({ onNavigateLogin }) {
  const { signup } = useAuth();
  const { theme, isDark, setThemePreference } = useTheme();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [grade, setGrade] = useState('10');
  const [board, setBoard] = useState('Punjab');
  const [isEducator, setIsEducator] = useState(false);
  const [institution, setInstitution] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      setError('Please fill in all required fields');
      triggerHaptic('error');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      triggerHaptic('error');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        class: grade,
        board,
        role: isEducator ? 'TEACHER' : 'STUDENT',
        institution: isEducator ? institution : undefined,
      });
      triggerHaptic('success');
    } catch (err) {
      triggerHaptic('error');
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Quick Theme Switcher */}
        <View style={styles.topThemeRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              triggerHaptic('light');
              setThemePreference(isDark ? 'light' : 'dark');
            }}
            style={[
              styles.themeToggleBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {isDark ? (
              <SunIcon size={18} color="#F59E0B" />
            ) : (
              <MoonIcon size={18} color="#6366F1" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Join Pakistan's premier intelligent learning platform
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* Educator Toggle */}
          <View style={[styles.toggleRow, { borderColor: theme.cardBorder }]}>
            <View>
              <Text style={[styles.toggleTitle, { color: theme.text }]}>I am an Educator / Teacher</Text>
              <Text style={[styles.toggleSubtitle, { color: theme.textMuted }]}>
                Enables classroom management & Note-to-Quiz AI
              </Text>
            </View>
            <Switch
              value={isEducator}
              onValueChange={(val) => {
                triggerHaptic('light');
                setIsEducator(val);
              }}
              trackColor={{ false: '#334155', true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Full Name */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Full Name</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            placeholder="Muhammad Ali"
            placeholderTextColor={theme.textMuted}
            value={name}
            onChangeText={setName}
          />

          {/* Email */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Email Address</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            placeholder="ali@example.com"
            placeholderTextColor={theme.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          {isEducator ? (
            <>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Institution / School</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                placeholder="Army Public School / Punjab College"
                placeholderTextColor={theme.textMuted}
                value={institution}
                onChangeText={setInstitution}
              />
            </>
          ) : (
            <>
              {/* Grade Selector */}
              <Text style={[styles.label, { color: theme.textSecondary }]}>Syllabus / Class</Text>
              <View style={styles.gradeGrid}>
                {['9', '10', '11', '12', 'MDCAT', 'ECAT'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    onPress={() => {
                      triggerHaptic('selection');
                      setGrade(g);
                    }}
                    style={[
                      styles.gradePill,
                      { borderColor: theme.cardBorder },
                      grade === g && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.gradePillText,
                        { color: grade === g ? '#FFF' : theme.textMuted },
                      ]}
                    >
                      {g.length <= 2 ? `Class ${g}` : g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Board Selector */}
              <Text style={[styles.label, { color: theme.textSecondary }]}>Examination Board</Text>
              <View style={styles.gradeGrid}>
                {['Punjab', 'Federal', 'Sindh', 'KPK', 'Balochistan'].map((b) => (
                  <TouchableOpacity
                    key={b}
                    onPress={() => {
                      triggerHaptic('selection');
                      setBoard(b);
                    }}
                    style={[
                      styles.gradePill,
                      { borderColor: theme.cardBorder },
                      board === b && { backgroundColor: theme.primary, borderColor: theme.primary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.gradePillText,
                        { color: board === b ? '#FFF' : theme.textMuted },
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Password */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            placeholder="Minimum 8 characters"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Confirm Password */}
          <Text style={[styles.label, { color: theme.textSecondary }]}>Confirm Password</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.inputBorder,
                color: theme.text,
              },
            ]}
            placeholder="Re-enter password"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isEducator ? 'Register Educator Account' : 'Start Learning'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>Already have an account? </Text>
          <TouchableOpacity onPress={onNavigateLogin}>
            <Text style={[styles.footerLink, { color: theme.primary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: 22,
    justifyContent: 'center',
  },
  topThemeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  themeToggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleSubtitle: {
    fontSize: 11,
    marginTop: 2,
    maxWidth: 220,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 14,
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  gradePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  gradePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 13,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
  },
});
