import './globals.css';

export const metadata = {
  title: 'TenTimesetter-Scheduler',
  description:
    'Plan projects on a visual Gantt timeline and track progress — secure accounts, critical vs normal priorities, weighted progress tracking, and Excel import.',
};

// Apply the saved theme before first paint to avoid a flash of the wrong mode.
const themeScript = `(function(){try{if(localStorage.getItem('tt-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
