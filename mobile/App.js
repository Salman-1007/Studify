import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import {
  registerForPushNotificationsAsync,
  attachNotificationListeners,
} from './src/services/notifications';

// Components & Screens
import StudifyLogo from './src/components/StudifyLogo';
import TabBar from './src/components/TabBar';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import QuizzesScreen from './src/screens/QuizzesScreen';
import ClassroomsScreen from './src/screens/ClassroomsScreen';
import ChatScreen from './src/screens/ChatScreen';
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
  const [activeTrack, setActiveTrack] = useState(null);
  const [activeChatClassroom, setActiveChatClassroom] = useState(null);

  // Initialize push notification listeners and channels on mount
  useEffect(() => {
    registerForPushNotificationsAsync();

    const unsubscribe = attachNotificationListeners({
      onNotificationReceived: (notification) => {
        console.log('[App] Foreground notification received:', notification.request.content.title);
      },
      onNotificationResponse: (data) => {
        console.log('[App] Notification tapped with deep link data:', data);
        if (data?.screen === 'ChatRoom') {
          setActiveTab('chat');
        } else if (data?.screen === 'QuizRunner') {
          setActiveTab('quizzes');
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
        case 'profile':
          return <ProfileScreen />;
        default:
          return <TeacherDashboardScreen onNavigateTab={(tab) => setActiveTab(tab)} />;
      }
    }

    // Student Views
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen
            onSelectTrack={(track) => {
              setActiveTrack(track);
              setActiveTab('quizzes');
            }}
            onEnterArena={() => {
              setActiveTrack({ name: 'Daily Mock Arena' });
              setActiveTab('quizzes');
            }}
          />
        );
      case 'quizzes':
        return (
          <QuizzesScreen
            initialTrack={activeTrack}
            onBack={() => {
              setActiveTrack(null);
              setActiveTab('dashboard');
            }}
          />
        );
      case 'classrooms':
        return (
          <ClassroomsScreen
            onOpenChat={(classroom) => {
              setActiveChatClassroom(classroom);
              setActiveTab('chat');
            }}
          />
        );
      case 'chat':
        return (
          <ChatScreen
            targetClassroom={activeChatClassroom}
            onBack={() => {
              setActiveChatClassroom(null);
              setActiveTab('classrooms');
            }}
          />
        );
      case 'profile':
        return <ProfileScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.mainContent}>{renderScreen()}</View>
      <TabBar
        activeTab={activeTab}
        onTabChange={(tab) => {
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
  splashBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  splashBadgeText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '900',
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
