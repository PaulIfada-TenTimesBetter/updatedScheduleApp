import './globals.css';
import RegisterSW from './register-sw';

export const metadata = {
  title: 'TenTimesetter-Scheduler',
  description:
    'Plan projects on a visual Gantt timeline and track progress — secure accounts, critical vs normal priorities, weighted progress tracking, and Excel import.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '10× Scheduler',
  },
};

// Apply the saved theme before first paint to avoid a flash of the wrong mode.
const themeScript = `(function(){try{if(localStorage.getItem('tt-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
