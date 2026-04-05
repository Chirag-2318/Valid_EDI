import React from 'react';
import { createRoot } from 'react-dom/client';
import { LoginPage } from '../pages/Login';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<LoginPage />
	</AuthProvider>
);
