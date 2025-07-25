import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import {
  FaBook,
  FaGamepad,
  FaComments,
  FaMicrophone,
  FaUser,
  FaHome,
  FaClipboardList,
} from "react-icons/fa";
import { MdQuiz } from "react-icons/md";
import { IoMdSettings } from "react-icons/io";

export default function Home() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex font-sans">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } bg-white shadow p-4 flex flex-col transition-all duration-300 rounded-r-2xl`}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-600 hover:text-purple-600 mb-4"
        >
          <IoMdSettings size={24} />
        </button>
        <div className="flex flex-col space-y-4">
          <button
            onClick={() => navigate("/phrasebook")}
            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-purple-100 transition"
          >
            <FaBook />
            {sidebarOpen && <span>Phrasebook</span>}
          </button>
          <button
            onClick={() => navigate("/quiz")}
            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-purple-100 transition"
          >
            <MdQuiz />
            {sidebarOpen && <span>Quiz</span>}
          </button>
          <button
            onClick={() => navigate("/wordgame")}
            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-purple-100 transition"
          >
            <FaGamepad />
            {sidebarOpen && <span>Word Game</span>}
          </button>
          <button
            onClick={() => navigate("/personalized")}
            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-purple-100 transition"
          >
            <FaHome />
            {sidebarOpen && <span>Personalized</span>}
          </button>
          <button
            onClick={() => navigate("/feedback")}
            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-purple-100 transition"
          >
            <FaComments />
            {sidebarOpen && <span>Real-time Feedback</span>}
          </button>

          {/* Updated Link for Pronunciation */}
          <Link
            to="/pronunciation"
            className="flex items-center gap-3 px-2 py-2 rounded hover:bg-purple-100 transition text-gray-700"
          >
            <FaMicrophone />
            {sidebarOpen && <span>Pronunciation</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-6">
        {/* Navbar */}
        <nav className="w-full flex justify-between items-center mb-8">
          <h1 className="text-xl font-bold text-gray-800">Language Learner</h1>
          <div className="relative group">
            <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow hover:bg-gray-100 transition">
              <img
                src={`https://api.dicebear.com/7.x/personas/svg?seed=${user?.email}`}
                alt="avatar"
                className="w-8 h-8 rounded-full"
              />
              <span className="font-medium text-sm">{user?.email}</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div className="absolute hidden group-hover:block right-0 mt-2 w-48 bg-white rounded shadow p-2 z-10">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          </div>
        </nav>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition-all">
            <h2 className="text-lg font-semibold text-purple-600 mb-2">
              Learning Progress
            </h2>
            <p className="text-sm text-gray-600">
              You’ve completed <strong>8/12</strong> modules this week.
            </p>
            <div className="w-full bg-gray-200 h-2 rounded-full mt-3">
              <div className="bg-purple-500 h-2 rounded-full w-2/3"></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition-all">
            <h2 className="text-lg font-semibold text-blue-600 mb-2">Take a Quiz</h2>
            <p className="text-sm text-gray-600">
              Challenge yourself and reinforce what you’ve learned today.
            </p>
            <button className="mt-4 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition">
              Start Quiz
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition-all">
            <h2 className="text-lg font-semibold text-green-600 mb-2">
              Personal Tutor
            </h2>
            <p className="text-sm text-gray-600">
              Chat with your AI-powered language tutor for feedback and help.
            </p>
            <button className="mt-4 px-4 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition">
              Open Tutor
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition-all">
            <h2 className="text-lg font-semibold text-pink-600 mb-2">Daily Goal</h2>
            <p className="text-sm text-gray-600">
              You’ve studied 24 minutes today. Just 6 more to hit your goal!
            </p>
            <div className="mt-3 flex gap-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-1/6 rounded-full ${
                    i < 4 ? "bg-pink-500" : "bg-gray-300"
                  }`}
                ></div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow hover:shadow-lg transition-all col-span-full">
            <h2 className="text-lg font-semibold text-yellow-600 mb-2">
              Leaderboard
            </h2>
            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
              <li>You’re ranked #8 globally this week.</li>
              <li>
                Top scorer: <strong>EmilyB</strong> with 1520 XP
              </li>
              <li>Keep it up to break into top 5!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
