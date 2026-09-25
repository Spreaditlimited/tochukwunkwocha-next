const themeScript = `
(() => {
  try {
    // The legacy key also stored automatic device-theme choices. Only restore
    // preferences explicitly selected under the light-default policy.
    const stored = localStorage.getItem("tochukwu-theme-choice");
    const theme = stored === "dark" || stored === "light"
      ? stored
      : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.classList.remove("dark");
    document.documentElement.dataset.theme = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />
}
