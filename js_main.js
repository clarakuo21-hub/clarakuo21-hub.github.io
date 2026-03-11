// ====================================
// Wedding Website - JavaScript
// ====================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize opening animation
  initOpeningAnimation();
  
  // Initialize all features
  initCountdown();
  initNavigation();
  initSmoothScroll();
  initScrollAnimations();
  initRSVPForm();
  initGuestbook();
  initFallingPetals();
});

// ====================================
// Opening Animation
// ====================================
function initOpeningAnimation() {
  const overlay = document.getElementById('opening-animation');
  if (!overlay) return;
  
  // 動畫時間軸：
  // 0-4s: 兩個小人移動
  // 4-5.5s: 愛心出現並停留
  // 5.5-6.5s: 淡出
  // 總計: 6.5秒後移除overlay
  
  // 7.5秒後完全移除元素（給淡出動畫多一點時間）
  setTimeout(() => {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 7500);
  
  // 可選：添加點擊跳過功能（點擊任意處立即進入主頁）
  overlay.addEventListener('click', () => {
    overlay.style.animation = 'fadeOut 0.5s ease-out forwards';
    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 500);
  });
}

// ====================================
// Countdown Timer
// ====================================
function initCountdown() {
  const weddingDate = new Date('2026-05-06T13:00:00').getTime();
  
  const daysEl = document.getElementById('days');
  const hoursEl = document.getElementById('hours');
  const minutesEl = document.getElementById('minutes');
  const secondsEl = document.getElementById('seconds');
  
  if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;
  
  function updateCountdown() {
    const now = new Date().getTime();
    const distance = weddingDate - now;
    
    if (distance < 0) {
      // Wedding day has passed
      daysEl.textContent = '0';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      secondsEl.textContent = '00';
      return;
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    daysEl.textContent = days.toString().padStart(3, '0');
    hoursEl.textContent = hours.toString().padStart(2, '0');
    minutesEl.textContent = minutes.toString().padStart(2, '0');
    secondsEl.textContent = seconds.toString().padStart(2, '0');
  }
  
  // Update immediately and then every second
  updateCountdown();
  setInterval(updateCountdown, 1000);
}

// ====================================
// Navigation
// ====================================
function initNavigation() {
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');
  
  // Toggle mobile menu
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      navToggle.classList.toggle('active');
    });
  }
  
  // Close menu when clicking a link
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu?.classList.remove('active');
      navToggle?.classList.remove('active');
    });
  });
  
  // Add scrolled class to navbar on scroll
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });
  }
  
  // Update active nav link on scroll
  const sections = document.querySelectorAll('section[id], header[id]');
  
  function updateActiveNav() {
    const scrollY = window.scrollY + 100;
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');
      
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }
  
  window.addEventListener('scroll', updateActiveNav);
}

// ====================================
// Smooth Scroll
// ====================================
function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');

  const getAnchorElement = (targetElement) => {
    if (!targetElement) return null;

    // For content sections, align to the visible section heading for more accurate jumps.
    if (targetElement.matches('section')) {
      return targetElement.querySelector('.section-title') || targetElement;
    }

    return targetElement;
  };
  
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        const navHeight = document.getElementById('navbar')?.offsetHeight || 70;
        const anchorElement = getAnchorElement(targetElement);
        const anchorTop = anchorElement.getBoundingClientRect().top + window.scrollY;
        const targetPosition = Math.max(0, anchorTop - navHeight - 8);
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
}

// ====================================
// Scroll Animations
// ====================================
function initScrollAnimations() {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // Observe elements
  const animatedElements = document.querySelectorAll(
    '.section-header, .about-content, .countdown-wrapper, .info-card, .timeline-item, .journey-story-card, .rsvp-card, .guestbook-panel, .blessing-card'
  );
  
  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
  
  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    .animate-in {
      opacity: 1 !important;
      transform: translateY(0) !important;
    }
  `;
  document.head.appendChild(style);
}

// ====================================
// Guestbook Board
// ====================================
function initGuestbook() {
  const form = document.getElementById('guestbook-form');
  const list = document.getElementById('blessings-list');
  const downloadBtn = document.getElementById('download-guestbook');

  if (!form || !list) return;

  const GUESTBOOK_API = '/api/guestbook';
  const GUESTBOOK_TXT_API = '/api/guestbook.txt';
  const AUTO_REFRESH_MS = 8000;
  let entries = [];
  let isLoadingEntries = false;
  let lastRenderedSignature = '';

  const escapeHtml = (value) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const renderEntries = () => {
    const nextSignature = entries.map((entry) => `${entry.createdAt}|${entry.name}|${entry.message}`).join('||');
    if (nextSignature === lastRenderedSignature) return;
    lastRenderedSignature = nextSignature;

    if (!entries.length) {
      list.innerHTML = '<p class="blessings-empty">第一则祝福，就由你写下吧。</p>';
      return;
    }

    list.innerHTML = entries.map((entry) => `
      <article class="blessing-card">
        <div class="blessing-meta">
          <span class="blessing-name">${escapeHtml(entry.name)}</span>
          <span>${formatDate(entry.createdAt)}</span>
        </div>
        <p class="blessing-message">${escapeHtml(entry.message).replace(/\n/g, '<br>')}</p>
      </article>
    `).join('');
  };

  const loadEntries = async ({ allowFallback = true } = {}) => {
    if (isLoadingEntries) return;
    isLoadingEntries = true;

    try {
      try {
        const response = await fetch(GUESTBOOK_API, { method: 'GET' });
        if (!response.ok) throw new Error(`API failed with ${response.status}`);
        const payload = await response.json();
        entries = Array.isArray(payload.entries) ? payload.entries : [];
        renderEntries();
        return;
      } catch (error) {
        console.error('Guestbook API unavailable, fallback to static txt:', error);
      }

      if (!allowFallback) return;

      // Fallback for local preview when API is not deployed.
      try {
        const response = await fetch('guestbook.txt');
        const text = response.ok ? await response.text() : '';
        entries = parseGuestbookTxt(text);
      } catch {
        entries = [];
      }
      renderEntries();
    } finally {
      isLoadingEntries = false;
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nameInput = document.getElementById('guest-name');
    const messageInput = document.getElementById('guest-message');
    if (!nameInput || !messageInput) return;

    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    if (!name || !message) {
      alert('请先填写名字与祝福内容');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '送出中...';
    }

    try {
      const response = await fetch(GUESTBOOK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, message })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || '送出失败');
      }

      // Optimistic update: show the newly created blessing immediately.
      if (payload.entry) {
        entries = [payload.entry, ...entries]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 200);
        renderEntries();
      }

      form.reset();
      loadEntries({ allowFallback: false });
    } catch (error) {
      console.error(error);
      alert(`目前无法送出到服务器: ${error.message || '未知错误'}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '送出祝福';
      }
    }
  });

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      window.location.href = GUESTBOOK_TXT_API;
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      loadEntries({ allowFallback: false });
    }
  });

  setInterval(() => {
    loadEntries({ allowFallback: false });
  }, AUTO_REFRESH_MS);

  loadEntries();
}

function parseGuestbookTxt(text) {
  if (!text || typeof text !== 'string') return [];

  const entries = [];
  const chunks = text.split(/\n\s*\n/);

  chunks.forEach((chunk) => {
    const lines = chunk.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length || lines[0].startsWith('#')) return;

    const headerMatch = lines[0].match(/^\d+\.\s+(.+?)\s*\((\d{4}[\/-]\d{2}[\/-]\d{2})\)$/);
    if (!headerMatch) return;

    const [, name, dateStr] = headerMatch;
    const message = lines.slice(1).join('\n').trim();
    if (!message) return;

    const normalizedDate = dateStr.replace(/\//g, '-');
    entries.push({
      name,
      message,
      createdAt: `${normalizedDate}T00:00:00`
    });
  });

  return entries;
}

// ====================================
// RSVP Form
// ====================================
function initRSVPForm() {
  const form = document.getElementById('rsvp-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    const action = form.action || '';
    
    // Only intercept if using Formspree
    if (!action.includes('formspree.io/f/')) return;

    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    submitBtn.disabled = true;
    submitBtn.textContent = '送出中...';

    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      });

      if (res.ok) {
        form.innerHTML = `
          <div style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 4rem; margin-bottom: 20px;">💕</div>
            <h3 style="font-family: var(--ff-heading); font-size: 1.5rem; color: var(--text-dark); margin-bottom: 15px;">
              感谢您的回复！
            </h3>
            <p style="color: var(--text-light);">
              我们已收到您的 RSVP，期待与您共同庆祝！
            </p>
          </div>
        `;
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }
    } catch (err) {
      console.error(err);
      alert('抱歉，发生错误。您也可以直接发送电子邮件给我们。');
      submitBtn.disabled = false;
      submitBtn.textContent = '送出 RSVP';
    }
  });

  // Show/hide guest count based on attendance selection
  const attendingSelect = document.getElementById('attending');
  const guestsInput = document.getElementById('guests');
  
  if (attendingSelect && guestsInput) {
    attendingSelect.addEventListener('change', () => {
      const guestGroup = guestsInput.closest('.form-group');
      if (attendingSelect.value === 'no') {
        guestGroup.style.opacity = '0.5';
        guestsInput.disabled = true;
      } else {
        guestGroup.style.opacity = '1';
        guestsInput.disabled = false;
      }
    });
  }
}

// ====================================
// Utility: Add Staggered Animation Delays
// ====================================
function addStaggeredDelay(selector, baseDelay = 0.1) {
  const elements = document.querySelectorAll(selector);
  elements.forEach((el, index) => {
    el.style.transitionDelay = `${index * baseDelay}s`;
  });
}

// Apply staggered delays after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  addStaggeredDelay('.info-card', 0.1);
  addStaggeredDelay('.timeline-item', 0.15);
  addStaggeredDelay('.journey-story-card', 0.2);
});

// ====================================
// Falling Flower Petals Animation
// ====================================
function initFallingPetals() {
  const container = document.getElementById('petals-container');
  if (!container) return;

  // Petal SVG templates — cherry blossoms & small roses
  const petalShapes = [
    // Cherry blossom petal
    `<svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 2C15 2 8 8 8 15C8 19 11 22 15 22C19 22 22 19 22 15C22 8 15 2 15 2Z" fill="FILL" opacity="0.8"/>
    </svg>`,
    // Round petal
    `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="14" cy="14" rx="10" ry="12" fill="FILL" opacity="0.75" transform="rotate(-15 14 14)"/>
    </svg>`,
    // Heart-shaped small petal
    `<svg viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 24C13 24 2 16 2 9C2 5 5 2 9 2C11 2 13 4 13 4C13 4 15 2 17 2C21 2 24 5 24 9C24 16 13 24 13 24Z" fill="FILL" opacity="0.7"/>
    </svg>`,
    // Tiny flower
    `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="3" fill="#E5D4A1" opacity="0.9"/>
      <ellipse cx="12" cy="5" rx="3.5" ry="5" fill="FILL" opacity="0.7"/>
      <ellipse cx="12" cy="19" rx="3.5" ry="5" fill="FILL" opacity="0.7"/>
      <ellipse cx="5" cy="12" rx="5" ry="3.5" fill="FILL" opacity="0.7"/>
      <ellipse cx="19" cy="12" rx="5" ry="3.5" fill="FILL" opacity="0.7"/>
    </svg>`,
    // Slim petal
    `<svg viewBox="0 0 20 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 0C10 0 0 10 0 20C0 26 4 32 10 32C16 32 20 26 20 20C20 10 10 0 10 0Z" fill="FILL" opacity="0.7"/>
    </svg>`
  ];

  // Romantic color palette for petals
  const petalColors = [
    '#F5C6CB',  // soft pink
    '#E8B4C0',  // rose pink
    '#F0D4DB',  // blush
    '#D4A5A5',  // dusty rose
    '#F7DFE4',  // pale pink
    '#FADCE5',  // light cherry
    '#E8C4C4',  // warm rose
    '#F2E0E0',  // cream rose
    '#FFE4E9',  // baby pink
    '#EDD5C8',  // peach
  ];

  const MAX_PETALS = 35; // Limit total petals on screen
  let activePetals = 0;

  function createPetal() {
    if (activePetals >= MAX_PETALS) return;

    const petal = document.createElement('div');
    petal.className = 'petal';

    // Random petal shape & color
    const shape = petalShapes[Math.floor(Math.random() * petalShapes.length)];
    const color = petalColors[Math.floor(Math.random() * petalColors.length)];
    petal.innerHTML = shape.replace(/FILL/g, color);

    // Random size 14-28px
    const size = 14 + Math.random() * 14;
    petal.style.width = size + 'px';
    petal.style.height = size + 'px';

    // Random horizontal position
    petal.style.left = Math.random() * 100 + 'vw';

    // Random fall duration 6-14s
    const duration = 6 + Math.random() * 8;
    petal.style.animationDuration = duration + 's';

    // Random delay 0-3s
    const delay = Math.random() * 3;
    petal.style.animationDelay = delay + 's';

    // Random initial rotation
    petal.style.transform = `rotate(${Math.random() * 360}deg)`;

    container.appendChild(petal);
    activePetals++;

    // Remove petal after animation
    setTimeout(() => {
      if (petal.parentNode) {
        petal.parentNode.removeChild(petal);
        activePetals--;
      }
    }, (duration + delay) * 1000 + 500);
  }

  // Wait for opening animation to finish, then start petals
  setTimeout(() => {
    // Create initial burst of petals
    for (let i = 0; i < 10; i++) {
      setTimeout(createPetal, i * 300);
    }

    // Continuously create petals
    setInterval(() => {
      if (Math.random() < 0.7) { // 70% chance each interval
        createPetal();
      }
    }, 800);
  }, 7000); // Start after opening animation
}
