import React from 'react';
import { createRoot } from 'react-dom/client';
import { DashboardPage } from '../pages/Dashboard';
import { AuthProvider } from '../auth/AuthProvider';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<DashboardPage />
	</AuthProvider>
);
