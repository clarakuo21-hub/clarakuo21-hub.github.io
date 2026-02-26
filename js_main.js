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
  
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        const navHeight = document.getElementById('navbar')?.offsetHeight || 70;
        const targetPosition = targetElement.offsetTop - navHeight;
        
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
    '.section-header, .about-content, .countdown-wrapper, .info-card, .timeline-item, .gallery-item, .rsvp-card'
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
              感謝您的回覆！
            </h3>
            <p style="color: var(--text-light);">
              我們已收到您的 RSVP，期待與您共同慶祝！
            </p>
          </div>
        `;
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Submission failed');
      }
    } catch (err) {
      console.error(err);
      alert('抱歉，發生錯誤。您也可以直接發送電子郵件給我們。');
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
  addStaggeredDelay('.gallery-item', 0.08);
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
