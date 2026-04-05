import React from 'react';
import { createRoot } from 'react-dom/client';
import { NotificationsPage } from '../pages/Notifications';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<NotificationsPage />
	</AuthProvider>
);
