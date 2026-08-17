/* ============================================================
   Terranova — slide-in menu behaviour
   ============================================================ */

const menu = document.getElementById('menu');
const openBtn = document.getElementById('menu-open');
const closeBtn = document.getElementById('menu-close');
const backdrop = document.getElementById('menu-backdrop');

function setMenu(open) {
  menu.classList.toggle('is-open', open);
  openBtn.setAttribute('aria-expanded', String(open));
  const target = open ? closeBtn : openBtn;
  target.focus({ preventScroll: true });
}

openBtn.addEventListener('click', () => setMenu(true));
closeBtn.addEventListener('click', () => setMenu(false));
backdrop.addEventListener('click', () => setMenu(false));

menu.querySelectorAll('.menu__link').forEach(link => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', e => {
  // Escape only acts while the menu is open.
  if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
});
