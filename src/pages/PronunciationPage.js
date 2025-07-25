// src/pages/PronunciationPage.js
import React from 'react';
import SpeechInput from '../components/SpeechInput';

const PronunciationPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">
        Pronunciation Practice
      </h1>
      <div className="max-w-xl mx-auto">
        <SpeechInput />
      </div>
    </div>
  );
};

export default PronunciationPage;
