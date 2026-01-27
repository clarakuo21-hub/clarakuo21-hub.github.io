// ====================================
// Wedding Website - JavaScript
// ====================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize all features
  initCountdown();
  initNavigation();
  initSmoothScroll();
  initScrollAnimations();
  initRSVPForm();
});

// ====================================
// Countdown Timer
// ====================================
function initCountdown() {
  const weddingDate = new Date('2026-05-20T16:00:00').getTime();
  
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