import React from 'react';
import { createRoot } from 'react-dom/client';
import { MasterParserPage } from '../pages/MasterParser';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<MasterParserPage />
	</AuthProvider>
);
