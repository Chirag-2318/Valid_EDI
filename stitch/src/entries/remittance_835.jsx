import React from 'react';
import { createRoot } from 'react-dom/client';
import { Remittance835Page } from '../pages/Remittance835';
import { AuthProvider } from '../auth/AuthProvider';
import '../styles/global.css';

createRoot(document.getElementById('root')).render(
	<AuthProvider>
		<Remittance835Page />
	</AuthProvider>
);
