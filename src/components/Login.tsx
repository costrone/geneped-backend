import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, UserPlus, CheckCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registrationLoading, setRegistrationLoading] = useState(false);
  const navigate = useNavigate();

  // Lista de usuarios autorizados
  const authorizedUsers = [
    'mj.sanchezsoler@gmail.com'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (error: any) {
      setError('Credenciales incorrectas. Por favor, inténtalo de nuevo.');
      console.error('Error de login:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Verificar si el usuario está autorizado
      if (!authorizedUsers.includes(result.user.email || '')) {
        await auth.signOut();
        setError('Tu cuenta no está autorizada para acceder a este sistema. Contacta al administrador.');
        return;
      }
      
      navigate('/');
    } catch (error: any) {
      setError('Error al iniciar sesión con Google. Por favor, inténtalo de nuevo.');
      console.error('Error de Google Auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setRegistrationLoading(true);

    try {
      // Verificar si el email está autorizado
      if (!authorizedUsers.includes(registrationEmail)) {
        setError('Tu email no está autorizado para registrarse. Contacta al administrador.');
        return;
      }

      // Enviar enlace de restablecimiento de contraseña
      await sendPasswordResetEmail(auth, registrationEmail);
      setRegistrationSuccess(true);
    } catch (error: any) {
      setError('Error al enviar el enlace de registro. Por favor, inténtalo de nuevo.');
      console.error('Error de registro:', error);
    } finally {
      setRegistrationLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pastel-gray to-pastel-gray-light py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-8">
            <img src="/logo.png" alt="Geneped" className="w-32 h-32 mx-auto object-contain" />
          </div>
          <p className="text-lg text-pastel-gray-dark font-medium">
            Sistema de Gestión de Historiales
          </p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-soft p-8">
          {!showRegistration ? (
            <>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-primary-700 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-pastel-gray-dark" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        className="block w-full pl-12 pr-4 py-3 border border-pastel-gray-light rounded-xl placeholder-pastel-gray-dark text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-primary-700 mb-2">
                      Contraseña
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-pastel-gray-dark" />
                      </div>
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        className="block w-full pl-12 pr-4 py-3 border border-pastel-gray-light rounded-xl placeholder-pastel-gray-dark text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-700">{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-gentle hover:shadow-soft"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Iniciando sesión...</span>
                    </div>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-pastel-gray-light" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-pastel-gray-dark">O continúa con</span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-pastel-gray-light rounded-xl bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-gentle hover:shadow-soft"
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Accede con tu cuenta de Google
                  </button>
                </div>
              </div>

              <div className="mt-6 text-center">
                <button
                  onClick={() => setShowRegistration(true)}
                  className="flex items-center justify-center space-x-2 text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors duration-200"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>¿No tienes cuenta? Regístrate aquí</span>
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {registrationSuccess ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <CheckCircle className="h-16 w-16 text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      ¡Enlace enviado!
                    </h3>
                    <p className="text-sm text-gray-600">
                      Hemos enviado un enlace de registro a <strong>{registrationEmail}</strong>. 
                      Revisa tu correo electrónico y sigue las instrucciones para crear tu contraseña.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowRegistration(false);
                      setRegistrationSuccess(false);
                      setRegistrationEmail('');
                    }}
                    className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 shadow-gentle hover:shadow-soft"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Crear nueva cuenta
                    </h3>
                    <p className="text-sm text-gray-600">
                      Introduce tu email autorizado para recibir un enlace de registro
                    </p>
                  </div>

                  <form onSubmit={handleRegistration} className="space-y-4">
                    <div>
                      <label htmlFor="registrationEmail" className="block text-sm font-medium text-primary-700 mb-2">
                        Email autorizado
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-pastel-gray-dark" />
                        </div>
                        <input
                          id="registrationEmail"
                          name="registrationEmail"
                          type="email"
                          autoComplete="email"
                          required
                          className="block w-full pl-12 pr-4 py-3 border border-pastel-gray-light rounded-xl placeholder-pastel-gray-dark text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                          placeholder="tu@email.com"
                          value={registrationEmail}
                          onChange={(e) => setRegistrationEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <span className="text-sm text-red-700">{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={registrationLoading}
                      className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-gentle hover:shadow-soft"
                    >
                      {registrationLoading ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Enviando enlace...</span>
                        </div>
                      ) : (
                        'Enviar enlace de registro'
                      )}
                    </button>
                  </form>

                  <div className="text-center">
                    <button
                      onClick={() => {
                        setShowRegistration(false);
                        setError('');
                        setRegistrationEmail('');
                      }}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium transition-colors duration-200"
                    >
                      ← Volver al inicio de sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login; 