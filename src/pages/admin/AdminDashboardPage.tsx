import React, { useEffect } from 'react';
import { useRoute } from 'wouter';
import { AdminProvider, useAdmin, AdminTab } from './AdminContext';
import { AdminGuard } from './AdminGuard';
import { AdminLayout } from './AdminLayout';

function TabSyncWrapper({ explicitTab }: { explicitTab?: AdminTab }) {
  const { setActiveTab } = useAdmin();

  useEffect(() => {
    if (explicitTab) {
      setActiveTab(explicitTab);
    }
  }, [explicitTab, setActiveTab]);

  return <AdminLayout />;
}

export default function AdminDashboardPage({ tab }: { tab?: AdminTab }) {
  return (
    <AdminProvider>
      <AdminGuard>
        <TabSyncWrapper explicitTab={tab} />
      </AdminGuard>
    </AdminProvider>
  );
}
