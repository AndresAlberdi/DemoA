import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPersistence(auth, browserSessionPersistence)
      .then(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setCurrentUser(user);
          setLoading(false);
        });
        return unsubscribe;
      })
      .catch((error) => {
        console.error("Error setting persistence:", error);
        setLoading(false);
      });
  }, []);

  const logout = () => {
    return signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
