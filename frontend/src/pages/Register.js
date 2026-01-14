import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Link, useNavigate } from 'react-router-dom';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const navigate = useNavigate();

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    try {
      await createUserWithEmailAndPassword(auth, form.email, form.password);
      setMessage('Registration successful!');
      setMessageType('success');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error) {
      setMessage(error.message);
      setMessageType('error');
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold text-center mb-6">Register</h2>
        <input className="w-full mb-4 p-2 border rounded" name="full_name" placeholder="Full Name" onChange={handleChange} required />
        <input className="w-full mb-4 p-2 border rounded" name="email" placeholder="Email" type="email" onChange={handleChange} required />
        <input className="w-full mb-4 p-2 border rounded" name="password" placeholder="Password" type="password" onChange={handleChange} required />
        <button type="submit" className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">Register</button>
        {message && (
          <div className={`mt-4 text-sm text-center p-2 rounded ${
            messageType === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message}
          </div>
        )}
        <p className="text-center text-sm mt-4">
          Already have an account? <Link to="/login" className="text-blue-500 underline">Login</Link>
        </p>
      </form>
    </div>
  );
}
