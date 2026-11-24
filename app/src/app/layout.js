import './globals.css';

export const metadata = {
  title: 'Caller ID Lookup',
  description: 'Names-first caller ID and spam lookups for phone numbers',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
