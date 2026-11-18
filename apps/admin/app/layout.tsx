import "./style.css";
export const metadata = {
  title: "Tracksy · Operations",
  description: "Secure Tracksy operations console",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <a href="/">
            tracksy<span> / operations</span>
          </a>
          <small>Restricted access · MFA required</small>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
