const themeScript = `
(() => {
  try {
    const stored = localStorage.getItem("tochukwu-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersDark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />
}
