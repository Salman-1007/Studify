import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Mentor from './pages/Mentor.jsx';
import Materials from './pages/Materials.jsx';
import MaterialDetail from './pages/MaterialDetail.jsx';
import Quizzes from './pages/Quizzes.jsx';
import QuizCreate from './pages/QuizCreate.jsx';
import QuizTake from './pages/QuizTake.jsx';
import QuizResults from './pages/QuizResults.jsx';
import Flashcards from './pages/Flashcards.jsx';
import FlashcardDeck from './pages/FlashcardDeck.jsx';
import Groups from './pages/Groups.jsx';
import GroupCreate from './pages/GroupCreate.jsx';
import GroupDetail from './pages/GroupDetail.jsx';
import GroupChat from './pages/GroupChat.jsx';
import GroupQuizzes from './pages/GroupQuizzes.jsx';
import GroupQuizTake from './pages/GroupQuizTake.jsx';
import GroupLeaderboard from './pages/GroupLeaderboard.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Progress from './pages/Progress.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import Admin from './pages/Admin.jsx';
import AdminQuestions from './pages/AdminQuestions.jsx';
import StudentQuestionBank from './pages/StudentQuestionBank.jsx';
import StandardTestTake from './pages/StandardTestTake.jsx';
import StandardTestResult from './pages/StandardTestResult.jsx';
import TestHistory from './pages/TestHistory.jsx';
import NotFound from './pages/NotFound.jsx';
import Landing from './pages/Landing.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/mentor" element={<Mentor />} />
          <Route path="/mentor/:conversationId" element={<Mentor />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/materials/:id" element={<MaterialDetail />} />
          <Route path="/question-bank" element={<StudentQuestionBank />} />
          <Route path="/tests" element={<StudentQuestionBank />} />
          <Route path="/tests/history" element={<TestHistory />} />
          <Route path="/tests/:attemptId" element={<StandardTestTake />} />
          <Route path="/tests/:attemptId/results" element={<StandardTestResult />} />
          <Route path="/quizzes" element={<Quizzes />} />
          <Route path="/quizzes/create" element={<QuizCreate />} />
          <Route path="/quizzes/:id" element={<QuizTake />} />
          <Route path="/quizzes/:id/results" element={<QuizResults />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/flashcards/:deckId" element={<FlashcardDeck />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/groups/create" element={<GroupCreate />} />
          <Route path="/groups/:id" element={<GroupDetail />} />
          <Route path="/groups/:id/chat" element={<GroupChat />} />
          <Route path="/groups/:id/quizzes" element={<GroupQuizzes />} />
          <Route path="/groups/:id/quizzes/:groupQuizId/take" element={<GroupQuizTake />} />
          <Route path="/groups/:id/quizzes/:groupQuizId/leaderboard" element={<GroupLeaderboard />} />
          <Route path="/groups/:id/leaderboard" element={<GroupLeaderboard />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/questions" element={<AdminQuestions />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
