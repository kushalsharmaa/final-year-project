import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
      setMessage('Login successful!');
      setMessageType('success');
      setTimeout(() => navigate('/home'), 1500);
    } catch (error) {
      setMessage(error.message);
      setMessageType('error');
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold text-center mb-6">Login</h2>
        <input className="w-full mb-4 p-2 border rounded" name="email" placeholder="Email" type="email" onChange={handleChange} required />
        <input className="w-full mb-4 p-2 border rounded" name="password" placeholder="Password" type="password" onChange={handleChange} required />
        <button type="submit" className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600">Login</button>
        {message && (
          <div className={`mt-4 text-sm text-center p-2 rounded ${
            messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}
        <p className="text-center text-sm mt-4">
          Don’t have an account? <Link to="/register" className="text-blue-500 underline">Register</Link>
        </p>
      </form>
    </div>
  );
}
