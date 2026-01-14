// src/App.js
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Review from "./pages/Review";
import Quiz from "./pages/Quiz";
import Drill from "./pages/Drill";
import Learn from "./pages/Learn";
import CurriculumLesson from "./pages/CurriculumLesson";
import Curriculum from "./pages/Curriculum";

// import the lab component directly
import PronunciationSmokeTest from "./components/PronunciationSmokeTest";
import VoiceGuard from "./components/VoiceGuard";

function RequireAuth({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(() => auth.currentUser);
  const location = useLocation();
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); });
    return () => unsub();
  }, []);
  if (!ready) return <div style={{ padding: 24 }}>loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/review" element={<RequireAuth><Review /></RequireAuth>} />
      <Route path="/quiz" element={<RequireAuth><Quiz /></RequireAuth>} />
      <Route path="/drill" element={<RequireAuth><Drill /></RequireAuth>} />
      <Route path="/learn" element={<RequireAuth><Learn /></RequireAuth>} />
      <Route
        path="/curriculum"
        element={
          <RequireAuth>
            <Curriculum />
          </RequireAuth>
        }
      />
      <Route path="/curriculum-lesson/:id" element={<RequireAuth><CurriculumLesson /></RequireAuth>} />

      {/* Lab route renders the component directly */}
      {/* If you want guest access, remove RequireAuth */}
      <Route
        path="/pronunciation"
        element={
          <RequireAuth>
            <VoiceGuard>
              <PronunciationSmokeTest />
            </VoiceGuard>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  );
}
