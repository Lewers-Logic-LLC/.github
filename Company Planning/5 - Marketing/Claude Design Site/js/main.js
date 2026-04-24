/* ── Splash Screen ── */
window.addEventListener('load', () => {
  const splash = document.getElementById('splash');
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 850);
  }, 1800);
});

/* ── Slide-In on Scroll ── */
const observer = new IntersectionObserver(
  (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.12 }
);
document.querySelectorAll('.slide-in').forEach(el => observer.observe(el));

/* ── Nav accent color transition ── */
function setNavAccent(color) {
  document.documentElement.style.setProperty('--nav-accent', color);
  const bar = document.querySelector('.nav-accent-bar');
  if (bar) bar.style.background = color;
  const cta = document.querySelector('.nav-cta');
  if (cta) cta.style.background = color;
}

if (window.PRODUCT_ACCENT) setNavAccent(window.PRODUCT_ACCENT);

/* ── Nav opacity on scroll ── */
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  if (!nav) return;
  nav.style.background = window.scrollY > 40
    ? 'rgba(13, 18, 24, 0.97)'
    : 'rgba(13, 18, 24, 0.82)';
}, { passive: true });

/* ── Active nav link ── */
document.querySelectorAll('.nav-links a').forEach(a => {
  if (a.href === location.href) a.style.color = 'var(--nav-accent)';
});

/* ── Contact form submit ── */
const form = document.getElementById('contact-form');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'Message Sent!';
    btn.style.background = '#26A69A';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = 'Send Message'; btn.disabled = false; }, 3000);
  });
}
