import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';
import PrivateRoute from './PrivateRoute';
import Landing from './pages/Landing';
import PronunciationPage from './pages/PronunciationPage';



function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<Landing />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pronunciation" element={<PronunciationPage />} />
        <Route path="/home" element={
          <PrivateRoute>
            <Home />
          </PrivateRoute>
        } />
  <Route path="/" element={<Landing />} />
  </Routes>
    </Router>
  );
}

export default App;
