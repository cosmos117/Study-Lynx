import { BrowserRouter, Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { PomodoroProvider } from './context/PomodoroContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Recall from './pages/Recall.jsx';
import RecallReview from './pages/RecallReview.jsx';
import Settings from './pages/Settings.jsx';
import Subjects from './pages/Subjects.jsx';
import Topic from './pages/Topic.jsx';
import YoutubeLearn from './pages/YoutubeLearn.jsx';
import { FeedbackProvider } from './components/Feedback.jsx';

// Old topic links used other tab names; send them to the matching tab on the topic page.
const OLD_TAB = { Notes: 'sources', Learn: 'sources', Flashcards: 'flashcards', Recall: 'flashcards', Quiz: 'quiz', Practice: 'quiz', 'Mind map': 'mindmap', Progress: 'sources' };

function OldTopicLink() {
  const { topicId } = useParams();
  const [params] = useSearchParams();
  return <Navigate to={`/topics/${topicId}?tab=${OLD_TAB[params.get('tab')] || 'sources'}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <FeedbackProvider>
          <PomodoroProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/subjects" element={<Subjects />} />
                  <Route path="/topics/:topicId" element={<Topic />} />
                  <Route path="/recall" element={<Recall />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
                <Route path="/recall/review" element={<RecallReview />} />
                <Route path="/learn/youtube/:resourceId" element={<YoutubeLearn />} />

                {/* Pages that were merged into the topic page or retired */}
                <Route path="/topics/:topicId/study" element={<OldTopicLink />} />
                <Route path="/exams/*" element={<Navigate to="/subjects" replace />} />
                <Route path="/quizzes" element={<Navigate to="/subjects" replace />} />
                <Route path="/materials" element={<Navigate to="/subjects" replace />} />
                <Route path="/ai-tutor" element={<Navigate to="/subjects" replace />} />
                <Route path="/tutor" element={<Navigate to="/subjects" replace />} />
                <Route path="/plan" element={<Navigate to="/dashboard" replace />} />
                <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
                <Route path="/study-session/:id" element={<Navigate to="/dashboard" replace />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </PomodoroProvider>
        </FeedbackProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
