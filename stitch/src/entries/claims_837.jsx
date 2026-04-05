import React from 'react';
import { createRoot } from 'react-dom/client';
import { Claims837Page } from '../pages/Claims837';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<Claims837Page />
	</AuthProvider>
);
