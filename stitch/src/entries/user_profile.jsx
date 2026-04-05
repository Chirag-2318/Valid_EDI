import React from 'react';
import { createRoot } from 'react-dom/client';
import { UserProfilePage } from '../pages/UserProfile';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<UserProfilePage />
	</AuthProvider>
);
