import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { User, LogOut, FileText, History } from 'lucide-react';

const Header: React.FC = () => {
  const { user } = useUser();
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (!user) return null;

  return (
    <header className="bg-white shadow-soft border-b border-pastel-gray-light">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pastel-blue to-pastel-blue-light flex items-center justify-center shadow-gentle group-hover:shadow-soft transition-all duration-300">
                <img src="/logo.png" alt="Geneped" className="w-8 h-8 object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                  Geneped
                </span>
                <span className="text-xs text-pastel-gray-dark font-medium">
                  Genética Pediátrica
                </span>
              </div>
            </Link>
            
            <nav className="flex space-x-1">
              <Link
                to="/"
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/'
                    ? 'bg-gradient-to-r from-pastel-blue to-pastel-blue-light text-primary-700 shadow-gentle'
                    : 'text-pastel-gray-dark hover:text-primary-600 hover:bg-pastel-gray-light'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Nuevo Historial</span>
              </Link>
              
              <Link
                to="/history"
                className={`flex items-center space-x-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/history'
                    ? 'bg-gradient-to-r from-pastel-blue to-pastel-blue-light text-primary-700 shadow-gentle'
                    : 'text-pastel-gray-dark hover:text-primary-600 hover:bg-pastel-gray-light'
                }`}
              >
                <History className="h-4 w-4" />
                <span>Historial</span>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 px-4 py-2 bg-pastel-gray-light rounded-xl">
              <div className="w-8 h-8 bg-gradient-to-br from-pastel-blue to-pastel-blue-light rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 text-primary-700" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-primary-700">{user.email}</span>
                <span className="text-xs text-pastel-gray-dark">Administrador</span>
              </div>
            </div>
            
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-pastel-gray-dark hover:text-primary-600 hover:bg-pastel-gray-light rounded-xl transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 