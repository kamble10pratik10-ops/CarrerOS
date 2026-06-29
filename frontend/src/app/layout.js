import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
import { LemmaProvider } from "./context/LemmaContext";

export const metadata = {
  title: "CareerOS | AI Career Operating System",
  description: "Your AI-powered career operating system. Analyze jobs, optimize resumes, track applications, and accelerate your career.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('careeros_theme') === 'dark') {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-surface transition-colors duration-300">
        <ThemeProvider>
          <LemmaProvider>
            {children}
          </LemmaProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
