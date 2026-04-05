import React from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsPage } from '../pages/Settings';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<SettingsPage />
	</AuthProvider>
);
