const ICONS = {
  menu: '<line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="20" y2="17"></line>',
  x: '<line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line>',
  sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"></path><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"></path><path d="M5 15l.9 2.1L8 18l-2.1.9L5 21l-.9-2.1L2 18l2.1-.9L5 15z"></path>',
  brain: '<path d="M9.5 6A3.5 3.5 0 0 0 6 9.5v5A3.5 3.5 0 0 0 9.5 18H10v2"></path><path d="M14.5 6A3.5 3.5 0 0 1 18 9.5v5a3.5 3.5 0 0 1-3.5 3.5H14v2"></path><path d="M10 6v12"></path><path d="M14 6v12"></path><path d="M10 10H8"></path><path d="M14 10h2"></path><path d="M10 14H8"></path><path d="M14 14h2"></path>',
  network: '<circle cx="12" cy="5" r="2"></circle><circle cx="5" cy="19" r="2"></circle><circle cx="19" cy="19" r="2"></circle><path d="M12 7v5"></path><path d="M10 12 6.5 17"></path><path d="M14 12 17.5 17"></path>',
  'flask-conical': '<path d="M10 3v5l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 8V3"></path><path d="M8 3h8"></path><path d="M7 15h10"></path>',
  'arrow-right': '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
  copy: '<rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"></path>',
  check: '<path d="M5 12l4 4L19 6"></path>'
};

function renderIcons() {
  document.querySelectorAll('[data-lucide]').forEach((node) => {
    const iconName = node.getAttribute('data-lucide');
    const iconMarkup = ICONS[iconName];
    if (!iconMarkup) {
      return;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', node.getAttribute('aria-hidden') || 'true');
    svg.innerHTML = iconMarkup;

    const replacement = document.createElement('span');
    replacement.className = `icon ${node.className}`.trim();
    if (node.id) {
      replacement.id = node.id;
    }
    replacement.setAttribute('data-lucide-rendered', iconName);
    replacement.appendChild(svg);
    node.replaceWith(replacement);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  renderIcons();

  const email = 'info@emergentcomputing.org';
  const modal = document.getElementById('emailModal');
  const showBtn = document.getElementById('showEmailBtn');
  const copyBtn = document.getElementById('copyEmailBtn');
  const copyIcon = document.getElementById('copyIcon');
  const checkIcon = document.getElementById('checkIcon');
  const closeBtn = document.getElementById('modalClose');
  const yearSpan = document.getElementById('currentYear');

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuClose = document.getElementById('mobileMenuClose');

  const openModal = () => {
    if (modal) {
      modal.classList.remove('hidden');
    }
  };

  const closeModal = () => {
    if (modal) {
      modal.classList.add('hidden');
    }
  };

  const openMobileMenu = () => {
    if (mobileMenu) {
      mobileMenu.style.display = 'block';
      document.body.style.overflow = 'hidden';
    }
  };

  const closeMobileMenu = () => {
    if (mobileMenu) {
      mobileMenu.style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  if (showBtn) showBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileMenu);
  if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMobileMenu);
  if (mobileMenu) {
    mobileMenu.addEventListener('click', (e) => {
      if (e.target === mobileMenu) closeMobileMenu();
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMobileMenu);
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileMenu();
      closeModal();
    }
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(email);
        if (copyIcon && checkIcon) {
          copyIcon.classList.add('hidden');
          checkIcon.classList.remove('hidden');
          setTimeout(() => {
            checkIcon.classList.add('hidden');
            copyIcon.classList.remove('hidden');
          }, 2000);
        }
      } catch (err) {
        console.error('Could not copy email:', err);
        const textArea = document.createElement('textarea');
        textArea.value = email;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          if (copyIcon && checkIcon) {
            copyIcon.classList.add('hidden');
            checkIcon.classList.remove('hidden');
            setTimeout(() => {
              checkIcon.classList.add('hidden');
              copyIcon.classList.remove('hidden');
            }, 2000);
          }
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr);
        }
        document.body.removeChild(textArea);
      }
    });
  }

  if (yearSpan) {
    yearSpan.textContent = String(new Date().getFullYear());
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768 && mobileMenu && mobileMenu.style.display !== 'none') {
      closeMobileMenu();
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      if (!href) {
        return;
      }
      const target = document.querySelector(href);
      if (target) {
        const offsetTop = target.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });
      }
    });
  });
});
