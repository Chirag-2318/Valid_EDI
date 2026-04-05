import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocumentationPage } from '../pages/Documentation';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<DocumentationPage />
	</AuthProvider>
);
