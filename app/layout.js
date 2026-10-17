import './globals.css';

export const metadata = {
  title: 'TenTimesetter-Scheduler',
  description:
    'Plan projects on a visual Gantt timeline — secure accounts, and critical vs normal task priorities.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
