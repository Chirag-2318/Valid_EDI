import React from 'react';
import { createRoot } from 'react-dom/client';
import { Enrollment834Page } from '../pages/Enrollment834';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<Enrollment834Page />
	</AuthProvider>
);
