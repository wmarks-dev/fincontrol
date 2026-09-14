import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import firebase from 'firebase/compat/app';
import { auth } from '../firebase/config';

interface UserContextType {
  currentUser: firebase.User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe; // Cleanup on unmount
  }, []);

  const login = async (email: string, pass: string) => {
    await auth.signInWithEmailAndPassword(email, pass);
  };

  const signup = async (email: string, pass: string, name: string) => {
    const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
    if (userCredential.user) {
        // updateProfile is a method on the user object in v8
        await userCredential.user.updateProfile({ displayName: name });
    }
    // This will trigger onAuthStateChanged and update the currentUser state with the new profile info
  };
  
  const logout = async () => {
    await auth.signOut();
  };

  const sendPasswordResetEmail = async (email: string) => {
    await auth.sendPasswordResetEmail(email);
  }

  const loginWithGoogle = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  }

  const value = {
    currentUser,
    loading,
    login,
    signup,
    logout,
    sendPasswordResetEmail,
    loginWithGoogle,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};