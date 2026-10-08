import React, { createContext, useContext, useState, useEffect } from 'react';
import { Alert } from '../types';
import { subscribeToAlerts, markAlertRead, markAllAlertsRead } from '../services/api';
import { useAuth } from './useAuth';

interface AlertsContextType {
  alerts: Alert[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (alertId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const AlertsContext = createContext<AlertsContextType>({
  alerts: [],
  unreadCount: 0,
  loading: true,
  markAsRead: async () => {},
  markAllAsRead: async () => {}
});

export const AlertsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToAlerts((updatedAlerts) => {
      setAlerts(updatedAlerts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = alerts.filter(a => a.status === 'New').length;

  const handleMarkAsRead = async (alertId: string) => {
    await markAlertRead(alertId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAlertsRead();
  };

  return (
    <AlertsContext.Provider value={{
      alerts,
      unreadCount,
      loading,
      markAsRead: handleMarkAsRead,
      markAllAsRead: handleMarkAllAsRead
    }}>
      {children}
    </AlertsContext.Provider>
  );
};

export const useAlerts = () => useContext(AlertsContext);
