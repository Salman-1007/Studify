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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { triggerHaptic } from '../utils/haptics';
import StudifyLogo from '../components/StudifyLogo';

export default function LoginScreen({ onNavigateSignup }) {
  const { login } = useAuth();
  const { theme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please provide your email and password');
      triggerHaptic('error');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await login(email.trim(), password);
      triggerHaptic('success');
    } catch (err) {
      triggerHaptic('error');
      setError(
        err.response?.data?.message ||
          'Invalid credentials. Please verify your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = (type) => {
    triggerHaptic('light');
    if (type === 'teacher') {
      setEmail('teacher@studify.pk');
      setPassword('Password123');
    } else {
      setEmail('student@studify.pk');
      setPassword('Password123');
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
        {/* Brand Hero */}
        <View style={styles.heroSection}>
          <StudifyLogo size={68} style={{ marginBottom: 12 }} />
          <Text style={[styles.brandTitle, { color: theme.text }]}>Studify Mobile</Text>
          <Text style={[styles.brandSubtitle, { color: theme.textMuted }]}>
            Pakistani Curriculum, Board Exams & Real-Time Classes
          </Text>
        </View>

        {/* Form Card */}
        <View
          style={[
            styles.card,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.cardHeader, { color: theme.text }]}>Welcome Back</Text>
          <Text style={[styles.cardSub, { color: theme.textMuted }]}>
            Sign in to continue your streak and access classrooms
          </Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: `${theme.error}15`, borderColor: theme.error }]}>
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* Email Field */}
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
            placeholder="student@studify.pk"
            placeholderTextColor={theme.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (error) setError(null);
            }}
          />

          {/* Password Field */}
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
            placeholder="••••••••"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError(null);
            }}
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Demo Fill Helpers */}
          <View style={styles.demoRow}>
            <TouchableOpacity
              style={[styles.demoPill, { borderColor: theme.cardBorder }]}
              onPress={() => handleDemoFill('student')}
            >
              <Text style={[styles.demoPillText, { color: theme.textMuted }]}>Demo Student</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.demoPill, { borderColor: theme.cardBorder }]}
              onPress={() => handleDemoFill('teacher')}
            >
              <Text style={[styles.demoPillText, { color: theme.textMuted }]}>Demo Educator</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Switch to Signup */}
        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            Don't have an account yet?{' '}
          </Text>
          <TouchableOpacity onPress={onNavigateSignup}>
            <Text style={[styles.footerLink, { color: theme.primary }]}>Create One</Text>
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
    justifyContent: 'center',
    padding: 22,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 4,
  },
  brandBadgeText: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '900',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 260,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
  },
  cardHeader: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 18,
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
    marginBottom: 16,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  demoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 18,
  },
  demoPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  demoPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  footerText: {
    fontSize: 13,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
  },
});
