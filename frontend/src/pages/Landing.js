import React from "react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 p-6 flex flex-col items-center font-sans">
      {/* Navbar */}
      <nav className="w-full max-w-6xl flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold text-gray-800">Language Learner</h1>
        <div className="flex gap-4">
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 bg-white text-sm rounded-full shadow hover:bg-gray-100 transition"
          >
            Login
          </button>
          <button
            onClick={() => navigate("/register")}
            className="px-4 py-2 bg-purple-500 text-white text-sm rounded-full shadow hover:bg-purple-600 transition"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-8 mt-8">
        <div className="flex-1 space-y-6">
          <h2 className="text-4xl font-extrabold text-gray-800">
            Master a New Language with AI
          </h2>
          <p className="text-gray-700 text-base">
            Personalized lessons, progress tracking, and real-time feedback to
            boost your learning journey.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/register")}
              className="px-6 py-3 bg-purple-500 text-white rounded-full shadow hover:bg-purple-600 transition"
            >
              Get Started
            </button>
            <button
              onClick={() => navigate("/login")}
              className="px-6 py-3 bg-white rounded-full shadow hover:bg-gray-100 transition"
            >
              Learn More
            </button>
          </div>
        </div>
        <div className="flex-1">
          <img
            src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1050&q=80"
            alt="Language Learning"
            className="rounded-2xl shadow-xl"
          />
        </div>
      </div>

      {/* Product Menu Section */}
      <div className="w-full max-w-6xl mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => navigate("/login")}
          className="bg-white p-4 rounded-2xl shadow hover:shadow-lg cursor-pointer text-center hover:bg-purple-50 transition"
        >
          <h3 className="text-sm font-semibold text-purple-600">Phrasebook</h3>
          <p className="text-xs text-gray-500 mt-1">
            Essential phrases to practice
          </p>
        </div>
        <div
          onClick={() => navigate("/login")}
          className="bg-white p-4 rounded-2xl shadow hover:shadow-lg cursor-pointer text-center hover:bg-purple-50 transition"
        >
          <h3 className="text-sm font-semibold text-blue-600">Quiz</h3>
          <p className="text-xs text-gray-500 mt-1">Challenge yourself daily</p>
        </div>
        <div
          onClick={() => navigate("/login")}
          className="bg-white p-4 rounded-2xl shadow hover:shadow-lg cursor-pointer text-center hover:bg-purple-50 transition"
        >
          <h3 className="text-sm font-semibold text-green-600">Word Game</h3>
          <p className="text-xs text-gray-500 mt-1">
            Fun games to boost vocabulary
          </p>
        </div>
        <div
          onClick={() => navigate("/login")}
          className="bg-white p-4 rounded-2xl shadow hover:shadow-lg cursor-pointer text-center hover:bg-purple-50 transition"
        >
          <h3 className="text-sm font-semibold text-pink-600">
            Personalized
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Your tailored learning path
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-6xl mt-16 border-t pt-6 text-center text-gray-600 text-sm">
        © 2025 Language Learner. All rights reserved.
      </footer>
    </div>
  );
};

export default Landing;
