(() => {
  const root = document.documentElement;
  const themeToggle = document.querySelector(".theme-toggle");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const mobileLayout = window.matchMedia("(max-width: 64rem)");
  const menuToggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".site-nav");
  const header = document.querySelector(".site-header");

  const getStoredTheme = () => {
    try {
      const theme = localStorage.getItem("disnana-theme");
      return theme === "light" || theme === "dark" ? theme : null;
    } catch {
      return null;
    }
  };

  let selectedTheme = getStoredTheme();
  const applyTheme = () => {
    const theme = selectedTheme || (systemTheme.matches ? "dark" : "light");
    root.dataset.theme = theme;
    themeToggle?.setAttribute("aria-pressed", String(theme === "dark"));
    if (themeToggle) themeToggle.title = theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え";
    if (themeColorMeta) themeColorMeta.content = theme === "dark" ? "#0d1422" : "#f8f9fc";
  };

  themeToggle?.addEventListener("click", () => {
    selectedTheme = root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("disnana-theme", selectedTheme);
    } catch {}
    applyTheme();
  });

  systemTheme.addEventListener("change", applyTheme);
  applyTheme();
  if (themeToggle) themeToggle.hidden = false;

  if (menuToggle && navigation) {
    const setMenuOpen = (open) => {
      menuToggle.setAttribute("aria-expanded", String(open));
      navigation.classList.toggle("is-open", open);
    };

    menuToggle.addEventListener("click", (event) => {
      const open = menuToggle.getAttribute("aria-expanded") !== "true";
      setMenuOpen(open);
      if (open && event.detail === 0) navigation.querySelector("a")?.focus();
    });

    navigation.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      const wasOpen = menuToggle.getAttribute("aria-expanded") === "true";
      setMenuOpen(false);
      // Move keyboard focus with an in-page link when closing the mobile menu.
      if (wasOpen && link.hash) {
        const destination = document.getElementById(link.hash.slice(1));
        if (destination) {
          destination.setAttribute("tabindex", "-1");
          destination.focus({ preventScroll: true });
        }
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
        setMenuOpen(false);
        menuToggle.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (!header?.contains(event.target)) setMenuOpen(false);
    });

    mobileLayout.addEventListener("change", (event) => {
      const focusedNavigation = navigation.contains(document.activeElement);
      const focusedToggle = document.activeElement === menuToggle;
      setMenuOpen(false);
      if (event.matches && focusedNavigation) menuToggle.focus();
      if (!event.matches && focusedToggle) navigation.querySelector("a")?.focus();
    });
    menuToggle.hidden = false;
    root.dataset.enhanced = "true";
  }

  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });
})();
