import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../App';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<App />
	</AuthProvider>
);
