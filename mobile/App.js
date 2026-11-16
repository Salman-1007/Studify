import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import {
  registerForPushNotificationsAsync,
  attachNotificationListeners,
} from './src/services/notifications';

// Shared Components & Auth
import StudifyLogo from './src/components/StudifyLogo';
import TabBar from './src/components/TabBar';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';

// Student Screens
import DashboardScreen from './src/screens/DashboardScreen';
import DailyArenaScreen from './src/screens/DailyArenaScreen';
import StandardTestsScreen from './src/screens/StandardTestsScreen';
import StudyHubScreen from './src/screens/StudyHubScreen';
import ClassroomsScreen from './src/screens/ClassroomsScreen';
import DirectChatScreen from './src/screens/DirectChatScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Teacher Screens
import TeacherDashboardScreen from './src/screens/TeacherDashboardScreen';
import TeacherClassroomsScreen from './src/screens/TeacherClassroomsScreen';
import NoteToQuizScreen from './src/screens/NoteToQuizScreen';
import ClassAnalyticsScreen from './src/screens/ClassAnalyticsScreen';

function AppContent() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated, isTeacher, loading } = useAuth();

  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'
  const [activeTab, setActiveTab] = useState(isTeacher ? 'teacherDashboard' : 'dashboard');
  const [hubSection, setHubSection] = useState(null);

  // Initialize push notification listeners and channels on mount
  useEffect(() => {
    registerForPushNotificationsAsync();

    const unsubscribe = attachNotificationListeners({
      onNotificationReceived: (notification) => {
        console.log('[App] Foreground push received:', notification.request.content.title);
      },
      onNotificationResponse: (data) => {
        console.log('[App] Push tapped with deep link payload:', data);
        if (data?.screen === 'DailyArena' || data?.type === 'DAILY_ARENA') {
          setActiveTab('arena');
        } else if (data?.screen === 'ChatRoom' || data?.type === 'DIRECT_MESSAGE' || data?.type === 'CHAT_MESSAGE') {
          setActiveTab('chat');
        } else if (data?.screen === 'QuizRunner' || data?.type === 'NEW_QUIZ') {
          setActiveTab('tests');
        } else if (data?.screen === 'Classroom' || data?.type === 'ANNOUNCEMENT') {
          setActiveTab('classrooms');
        }
      },
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Sync initial tab when auth/role changes
  useEffect(() => {
    if (isTeacher) {
      setActiveTab('teacherDashboard');
    } else {
      setActiveTab('dashboard');
    }
  }, [isTeacher]);

  // Loading Screen
  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingContainer, { backgroundColor: theme.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <StudifyLogo size={78} style={{ marginBottom: 16 }} />
        <Text style={[styles.splashTitle, { color: theme.text }]}>Studify</Text>
        <Text style={[styles.splashSub, { color: theme.textMuted }]}>
          Pakistan Education Ecosystem
        </Text>
        <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  // Unauthenticated Flow
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {authView === 'login' ? (
          <LoginScreen onNavigateSignup={() => setAuthView('signup')} />
        ) : (
          <SignupScreen onNavigateLogin={() => setAuthView('login')} />
        )}
      </SafeAreaView>
    );
  }

  // Authenticated Role-Aware Navigation
  const renderScreen = () => {
    // ----------------------------------------------------
    // TEACHER FLOW
    // ----------------------------------------------------
    if (isTeacher) {
      switch (activeTab) {
        case 'teacherDashboard':
          return (
            <TeacherDashboardScreen
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          );
        case 'teacherClassrooms':
          return <TeacherClassroomsScreen />;
        case 'noteToQuiz':
          return (
            <NoteToQuizScreen
              onQuizCreated={() => setActiveTab('teacherClassrooms')}
            />
          );
        case 'analytics':
          return <ClassAnalyticsScreen />;
        case 'chat':
          return <DirectChatScreen onBack={() => setActiveTab('teacherDashboard')} />;
        case 'profile':
          return <ProfileScreen />;
        default:
          return <TeacherDashboardScreen onNavigateTab={(tab) => setActiveTab(tab)} />;
      }
    }

    // ----------------------------------------------------
    // STUDENT FLOW
    // ----------------------------------------------------
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            onEnterArena={() => setActiveTab('arena')}
            onOpenStandardTests={() => setActiveTab('tests')}
            onOpenMentor={() => {
              setHubSection('mentor');
              setActiveTab('studyHub');
            }}
            onOpenMaterials={() => {
              setHubSection('materials');
              setActiveTab('studyHub');
            }}
            onOpenFlashcards={() => {
              setHubSection('flashcards');
              setActiveTab('studyHub');
            }}
            onOpenStudyGroups={() => {
              setHubSection('groups');
              setActiveTab('studyHub');
            }}
            onOpenClassrooms={() => setActiveTab('classrooms')}
            onOpenLeaderboard={() => setActiveTab('leaderboard')}
            onOpenProfile={() => setActiveTab('profile')}
          />
        );
      case 'arena':
        return <DailyArenaScreen />;
      case 'tests':
        return <StandardTestsScreen />;
      case 'studyHub':
        return <StudyHubScreen initialSection={hubSection} />;
      case 'classrooms':
        return (
          <ClassroomsScreen
            onOpenChat={() => setActiveTab('chat')}
          />
        );
      case 'chat':
        return <DirectChatScreen onBack={() => setActiveTab('dashboard')} />;
      case 'leaderboard':
        return <LeaderboardScreen onBack={() => setActiveTab('dashboard')} />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <DashboardScreen onEnterArena={() => setActiveTab('arena')} />;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.mainContent}>{renderScreen()}</View>
      <TabBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setHubSection(null);
          setActiveTab(tab);
        }}
        isTeacher={isTeacher}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

registerRootComponent(App);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  splashSub: {
    fontSize: 12,
    marginTop: 4,
  },
});
