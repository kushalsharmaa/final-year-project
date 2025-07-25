// components/SpeechInput.js
import React, { useState } from 'react';

const SpeechInput = () => {
  const [spokenText, setSpokenText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [score, setScore] = useState(null);
  const [feedback, setFeedback] = useState('');

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const result = event.results[0][0].transcript;
      setSpokenText(result);
      setIsListening(false);
      assessPronunciation(result);
    };

    recognition.onerror = (event) => {
      console.error('Speech error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const assessPronunciation = (text) => {
    // Fake scoring logic: score higher for longer, more complex English sentences
    const wordCount = text.split(' ').length;
    const clearEnglish = /^[A-Za-z0-9 ,.'?!]+$/.test(text);
    let baseScore = clearEnglish ? 60 : 30;
    const adjusted = Math.min(100, baseScore + wordCount * 4);

    setScore(adjusted);

    if (adjusted >= 80) {
      setFeedback("Excellent! Very clear pronunciation.");
    } else if (adjusted >= 60) {
      setFeedback("Good effort! Try to speak more clearly.");
    } else {
      setFeedback("Keep practicing. Focus on clarity and pace.");
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto rounded-xl shadow bg-white dark:bg-gray-800">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
        Speak Anything
      </h2>

      <button
        onClick={startListening}
        className="px-5 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        {isListening ? 'Listening...' : '🎤 Start Speaking'}
      </button>

      {spokenText && (
        <div className="mt-6 text-gray-800 dark:text-gray-200">
          <p className="text-lg"><strong>You said:</strong> {spokenText}</p>

          {score !== null && (
            <>
              <p className="mt-3 text-lg font-semibold">
                Score: <span className="text-purple-600">{score}%</span>
              </p>
              <p className="mt-2">{feedback}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SpeechInput;
