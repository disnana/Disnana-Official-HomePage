const header = document.querySelector(".site-header");
const menuButton = document.querySelector(".menu-button");

menuButton.addEventListener("click", () => {
  const open = header.classList.toggle("menu-open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
});

document.querySelectorAll(".desktop-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    header.classList.remove("menu-open");
    menuButton.setAttribute("aria-expanded", "false");
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.animate(
          [
            { opacity: 0, transform: "translateY(20px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 650, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" },
        );
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.1 },
);

document.querySelectorAll(".feature, .command-side, .terminal, .setup-list li, .reliability-copy, .reliability-visual, .status-card, .contact-card, .faq-list").forEach((element) => {
  element.style.opacity = "0";
  observer.observe(element);
});
