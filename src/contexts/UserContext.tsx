import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../firebase/config';

interface UserContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  isAdmin: false,
});

export const useUser = () => useContext(UserContext);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Lista de emails de administradores
  const adminEmails = [
    'genepedmur@geneped.com',
    
    // Añade aquí más emails de administradores
  ];

  const isAdmin = user ? adminEmails.includes(user.email || '') : false;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, signOut, isAdmin }}>
      {children}
    </UserContext.Provider>
  );
}; 