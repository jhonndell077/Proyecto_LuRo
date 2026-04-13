(() => {
  const track = document.getElementById('carouselTrack');
  if (!track) return;

  const topNav = document.getElementById('topNav');
  const navToggle = document.getElementById('navToggle');
  const moduleItems = Array.from(document.querySelectorAll('.module-item'));
  const isMobile = () =>
    window.matchMedia('(max-width: 1200px)').matches ||
    window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const panels = Array.from(track.querySelectorAll('.panel'));
  const navLinks = Array.from(document.querySelectorAll('nav a[href^="#"]'));
  const hasSectionNav = navLinks.length > 0;
  const useCarousel = () => hasSectionNav && !isMobile();
  const sectionIds = panels.map((panel) => panel.id);
  let currentIndex = Math.max(0, sectionIds.indexOf((location.hash || '#inicio').slice(1)));
  let isAnimating = false;
  let touchStartX = null;

  const setNavState = (isOpen) => {
    if (!topNav || !navToggle) return;
    topNav.classList.toggle('open', isOpen);
    topNav.hidden = !isOpen;
    topNav.style.display = isOpen ? 'flex' : 'none';
    topNav.setAttribute('aria-hidden', String(!isOpen));
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
  };

  const closeNavMenu = () => {
    setNavState(false);
  };

  const toggleNavMenu = () => {
    if (!topNav || !navToggle) return;
    setNavState(!topNav.classList.contains('open'));
  };

  closeNavMenu();

  const updateNav = () => {
    navLinks.forEach((link) => {
      const href = (link.getAttribute('href') || '').replace('#', '');
      link.classList.toggle('active', href === sectionIds[currentIndex]);
    });
  };

  const revealInPanel = (panel) => {
    panel.querySelectorAll('.reveal').forEach((n, idx) => {
      setTimeout(() => n.classList.add('show'), Math.min(260, idx * 70));
    });
  };

  const goTo = (index, pushHash = true, options = {}) => {
    const { scrollMobile = true } = options;
    const bounded = Math.max(0, Math.min(index, panels.length - 1));
    currentIndex = bounded;

    if (!useCarousel()) {
      const target = panels[currentIndex];
      if (target && scrollMobile && hasSectionNav) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateNav();
      return;
    }

    isAnimating = true;
    track.style.transform = `translate3d(-${currentIndex * 100}%, 0, 0)`;
    updateNav();
    revealInPanel(panels[currentIndex]);
    if (pushHash) history.replaceState(null, '', `#${sectionIds[currentIndex]}`);
    setTimeout(() => { isAnimating = false; }, 850);
  };

  navLinks.forEach((link) => {
    link.addEventListener('click', (ev) => {
      ev.preventDefault();
      const id = (link.getAttribute('href') || '').replace('#', '');
      const index = sectionIds.indexOf(id);
      if (index >= 0) goTo(index);
      closeNavMenu();
    });
  });

  if (navToggle) {
    navToggle.addEventListener('click', toggleNavMenu);
  }

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeNavMenu();
    if (isAnimating || !useCarousel()) return;
    if (ev.key === 'ArrowRight') goTo(currentIndex + 1);
    if (ev.key === 'ArrowLeft') goTo(currentIndex - 1);
  });

  track.addEventListener('touchstart', (ev) => {
    if (isAnimating || !useCarousel()) return;
    touchStartX = ev.changedTouches[0]?.clientX ?? null;
  }, { passive: true });

  track.addEventListener('touchend', (ev) => {
    if (touchStartX === null || isAnimating || !useCarousel()) return;
    const endX = ev.changedTouches[0]?.clientX ?? touchStartX;
    const deltaX = endX - touchStartX;
    touchStartX = null;
    if (Math.abs(deltaX) < 45) return;
    if (deltaX < 0) goTo(currentIndex + 1);
    if (deltaX > 0) goTo(currentIndex - 1);
  }, { passive: true });

  window.addEventListener('hashchange', () => {
    if (!hasSectionNav) return;
    const hashId = (location.hash || '#inicio').slice(1);
    const index = sectionIds.indexOf(hashId);
    if (index >= 0) goTo(index, false);
  });

  window.addEventListener('resize', () => {
    closeNavMenu();
    if (!isMobile()) moduleItems.forEach((it) => it.classList.remove('open'));
    goTo(currentIndex, false, { scrollMobile: false });
  });

  const closeModuleTips = () => moduleItems.forEach((it) => it.classList.remove('open'));
  moduleItems.forEach((item) => {
    item.setAttribute('tabindex', '0');
    item.addEventListener('click', (ev) => {
      if (!isMobile()) return;
      ev.stopPropagation();
      const willOpen = !item.classList.contains('open');
      closeModuleTips();
      if (willOpen) item.classList.add('open');
    });
    item.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      if (!isMobile()) return;
      ev.preventDefault();
      const willOpen = !item.classList.contains('open');
      closeModuleTips();
      if (willOpen) item.classList.add('open');
    });
  });
  document.addEventListener('click', (ev) => {
    const target = ev.target;
    if (topNav && navToggle && target instanceof Node && !topNav.contains(target) && !navToggle.contains(target)) {
      closeNavMenu();
    }
    if (!isMobile()) return;
    closeModuleTips();
  });

  panels.forEach((panel, idx) => {
    if (idx === currentIndex) revealInPanel(panel);
  });

  goTo(currentIndex, false, { scrollMobile: false });
})();
