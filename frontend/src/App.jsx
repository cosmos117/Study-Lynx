import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Exams from './pages/Exams.jsx';
import ExamDetails from './pages/ExamDetails.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import TopicStudy from './pages/TopicStudy.jsx';
import Plan from './pages/Plan.jsx';
import FocusSession from './pages/FocusSession.jsx';
import Recall from './pages/Recall.jsx';
import RecallReview from './pages/RecallReview.jsx';
import Materials from './pages/Materials.jsx';
import YoutubeLearn from './pages/YoutubeLearn.jsx';
import AiTutor from './pages/AiTutor.jsx';
import TopicHub from './pages/TopicHub.jsx';
import Quizzes from './pages/Quizzes.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';
import { FeedbackProvider } from './components/Feedback.jsx';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FeedbackProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/plan" element={<Plan />} />
                <Route path="/subjects" element={<Exams />} />
                <Route path="/recall" element={<Recall />} />
                <Route path="/quizzes" element={<Quizzes />} />
                <Route path="/ai-tutor" element={<AiTutor />} />
                <Route path="/tutor" element={<Navigate to="/ai-tutor" replace />} />
                <Route path="/materials" element={<Materials />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/exams" element={<Navigate to="/subjects" replace />} />
                <Route path="/exams/:id" element={<ExamDetails />} />
                <Route path="/topics/:topicId" element={<TopicHub />} />
                <Route path="/topics/:topicId/study" element={<TopicStudy />} />
              </Route>
              <Route path="/study-session/:id" element={<FocusSession />} />
              <Route path="/recall/review" element={<RecallReview />} />
              <Route path="/learn/youtube/:resourceId" element={<YoutubeLearn />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </FeedbackProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
