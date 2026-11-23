export const metadata = {
  title: 'Caller ID Lookup',
  description: 'Name and spam lookups for phone numbers',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
