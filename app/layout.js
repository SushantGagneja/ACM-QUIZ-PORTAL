import "./globals.css";

export const metadata = {
  title: "Buzz Round",
  description: "Live trivia quiz portal",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const observer = new MutationObserver(() => {
                  const el = document.querySelector('netlify-connection-indicator, #netlify-feedback-widget, iframe[src*="netlify"]');
                  if (el) {
                    el.remove();
                  }
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}