import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { currentUser } = useUser();
  const userKey = currentUser ? `fincontrol_${currentUser}_${key}` : `fincontrol_${key}`;

  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined' || !currentUser) {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(userKey);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });
  
  // This effect will re-initialize the state when the user logs in or out.
  useEffect(() => {
    if (currentUser) {
      try {
        const item = window.localStorage.getItem(userKey);
        setStoredValue(item ? JSON.parse(item) : initialValue);
      } catch (error) {
        console.error(error);
        setStoredValue(initialValue);
      }
    } else {
      // If user logs out, clear the state to the initial value
      setStoredValue(initialValue);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userKey]);


  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    if (!currentUser) return; // Do not save if no user is logged in
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(userKey, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };
  return [storedValue, setValue];
}

export default useLocalStorage;
