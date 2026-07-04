const themeToggle = document.querySelector(".theme-toggle");
const themeToggleText = document.querySelector(".theme-toggle-text");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const systemTheme = window.matchMedia("(prefers-color-scheme: light)");

const getStoredTheme = () => {
  try {
    return localStorage.getItem("disnana-theme");
  } catch {
    return null;
  }
};

const storeTheme = (theme) => {
  try {
    localStorage.setItem("disnana-theme", theme);
  } catch {
    return null;
  }
};

const getPreferredTheme = () => getStoredTheme() || (systemTheme.matches ? "light" : "dark");

const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  const isLight = theme === "light";
  themeToggle?.setAttribute("aria-pressed", String(isLight));
  if (themeToggleText) themeToggleText.textContent = isLight ? "Light" : "Dark";
  if (themeColorMeta) themeColorMeta.setAttribute("content", isLight ? "#f6f8fc" : "#080a10");
};

applyTheme(getPreferredTheme());

themeToggle?.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme || getPreferredTheme();
  const nextTheme = currentTheme === "light" ? "dark" : "light";
  storeTheme(nextTheme);
  applyTheme(nextTheme);
});

systemTheme.addEventListener("change", () => {
  if (!getStoredTheme()) applyTheme(getPreferredTheme());
});

const revealTargets = document.querySelectorAll(
  ".shortcut-card, .card, .feature-item, .project-card, .profile-card, .detail-card, .contact-grid",
);

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  },
  { threshold: 0.12 },
);

revealTargets.forEach((element) => {
  element.classList.add("reveal");
  revealObserver.observe(element);
});
