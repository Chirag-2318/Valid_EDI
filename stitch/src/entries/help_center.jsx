import React from 'react';
import { createRoot } from 'react-dom/client';
import { HelpCenterPage } from '../pages/HelpCenter';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<HelpCenterPage />
	</AuthProvider>
);
