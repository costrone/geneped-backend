import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider } from './contexts/UserContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import CreateRecord from './components/CreateRecord';
import RecordHistory from './components/RecordHistory';
import Trash from './components/Trash';
import EditRecord from './components/EditRecord';
import Header from './components/Header';

import { useAutoCleanup } from './hooks/useAutoCleanup';
import { emailService } from './services/emailService';

function AppContent() {
  // Inicializar limpieza automática
  useAutoCleanup();

  // Inicializar EmailJS
  React.useEffect(() => {
    emailService.init();
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-pastel-gray to-pastel-gray-light">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><CreateRecord /></PrivateRoute>} />
            <Route path="/history" element={<PrivateRoute><RecordHistory /></PrivateRoute>} />
            <Route path="/trash" element={<PrivateRoute><Trash /></PrivateRoute>} />
            <Route path="/edit/:id" element={<PrivateRoute><EditRecord /></PrivateRoute>} />

          </Routes>
        </main>
      </div>
    </Router>
  );
}

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;
