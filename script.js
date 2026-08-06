document.getElementById('dateTag').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
document.getElementById('yearTag').textContent = '© ' + new Date().getFullYear() + ' The Build Log · All rights reserved';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Scroll-triggered reveals */
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      if (e.target.classList.contains('stamp')) {
        setTimeout(() => e.target.classList.add('settled'), 700);
      }
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

/* Scroll progress bar */
const scrollBar = document.getElementById('scrollBar');
function updateScrollBar() {
  const h = document.documentElement;
  const pct = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
  scrollBar.style.width = pct + '%';
}
window.addEventListener('scroll', updateScrollBar, { passive: true });
updateScrollBar();

/* Mobile drawer */
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileDrawer = document.getElementById('mobileDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
function closeDrawer() {
  hamburgerBtn.classList.remove('open');
  mobileDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
}
hamburgerBtn.addEventListener('click', () => {
  const isOpen = mobileDrawer.classList.toggle('open');
  hamburgerBtn.classList.toggle('open', isOpen);
  drawerOverlay.classList.toggle('open', isOpen);
});
drawerOverlay.addEventListener('click', closeDrawer);
mobileDrawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeDrawer));

/* Typewriter headline */
const headline = document.getElementById('heroHeadline');
if (headline && !reduceMotion) {
  const original = headline.innerHTML;
  const plain = headline.textContent;
  headline.innerHTML = '';
  headline.style.minHeight = headline.offsetHeight + 'px';
  let i = 0;
  function typeChar() {
    if (i <= plain.length) {
      headline.textContent = plain.slice(0, i);
      i++;
      setTimeout(typeChar, 18);
    } else {
      headline.innerHTML = original + '<span class="type-cursor"></span>';
      setTimeout(() => {
        const cursor = headline.querySelector('.type-cursor');
        if (cursor) cursor.style.display = 'none';
      }, 1800);
    }
  }
  setTimeout(typeChar, 900);
}

/* Interactive Magnifying Glass Zoom on All Project Exhibit Pictures */
document.querySelectorAll('.exhibit-shot').forEach((shot) => {
  const img = shot.querySelector('img');
  if (img) {
    shot.addEventListener('mousemove', (e) => {
      const rect = shot.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      img.style.transformOrigin = `${x}% ${y}%`;
      img.style.transform = 'scale(2.2)';
    });
    shot.addEventListener('mouseleave', () => {
      img.style.transform = 'scale(1)';
      img.style.transformOrigin = 'center center';
    });
  }
});

/* Pause navbar animation when stuck to top */
const navElem = document.querySelector('.nav');
if (navElem) {
  const checkSticky = () => {
    const rect = navElem.getBoundingClientRect();
    navElem.classList.toggle('is-stuck', rect.top <= 0);
  };
  window.addEventListener('scroll', checkSticky, { passive: true });
  checkSticky();
}

/* Background Form Delivery (Web3Forms AJAX with Gmail Fallback) */
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const submitBtn = document.getElementById('contactSubmitBtn');
    const statusMsg = document.getElementById('formStatusMsg');
    const accessKeyInput = document.getElementById('web3AccessKey');
    const accessKey = accessKeyInput ? accessKeyInput.value : '';

    const name = document.getElementById('contactName').value;
    const email = document.getElementById('contactEmail').value;
    const subject = document.getElementById('contactSubject').value || 'Portfolio Contact Inquiry';
    const story = document.getElementById('contactStory').value;

    // If access key is placeholder, fallback to direct Gmail Web Compose
    if (!accessKey || accessKey === 'YOUR_WEB3FORMS_ACCESS_KEY') {
      const body = `Name: ${name}\nSender Email: ${email}\n\nMessage / Story:\n${story}`;
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=sapkotapranjal25@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailUrl, '_blank');
      return;
    }

    // Web3Forms AJAX background submit
    submitBtn.disabled = true;
    submitBtn.textContent = 'Dispatching...';
    if (statusMsg) statusMsg.textContent = 'Transmitting tip to the desk...';

    const formData = new FormData(contactForm);
    if (subject) {
      formData.set('subject', `[Portfolio Lead] ${subject}`);
    }

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      body: formData
    })
      .then(async (response) => {
        const json = await response.json();
        if (response.status === 200 && json.success) {
          submitBtn.textContent = 'Letter Sent ✓';
          if (statusMsg) statusMsg.textContent = '★ Received at the desk! Thank you.';
          contactForm.reset();
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send the letter';
          if (statusMsg) statusMsg.textContent = json.message || 'Transmission error. Try again.';
        }
      })
      .catch((error) => {
        console.error(error);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send the letter';
        if (statusMsg) statusMsg.textContent = 'Network issue. Please try again.';
      });
  });
}

/* Resume PDF Preview Toggle Handler */
const viewResumeBtn = document.getElementById('viewResumeBtn');
const heroViewResumeBtn = document.getElementById('heroViewResumeBtn');
const resumePreviewBox = document.getElementById('resumePreviewBox');
const closeResumeBtn = document.getElementById('closeResumeBtn');

function openResumePreview() {
  if (!resumePreviewBox) return;
  resumePreviewBox.style.display = 'block';
  if (viewResumeBtn) {
    const spanText = viewResumeBtn.querySelector('span');
    if (spanText) spanText.textContent = 'Hide Resume Preview';
  }
  resumePreviewBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

if (heroViewResumeBtn) {
  heroViewResumeBtn.addEventListener('click', openResumePreview);
}

if (viewResumeBtn && resumePreviewBox) {
  viewResumeBtn.addEventListener('click', function () {
    const isHidden = resumePreviewBox.style.display === 'none' || !resumePreviewBox.style.display;
    if (isHidden) {
      openResumePreview();
    } else {
      resumePreviewBox.style.display = 'none';
      const spanText = viewResumeBtn.querySelector('span');
      if (spanText) {
        spanText.textContent = 'View Resume Here';
      }
    }
  });

  if (closeResumeBtn) {
    closeResumeBtn.addEventListener('click', function () {
      resumePreviewBox.style.display = 'none';
      const spanText = viewResumeBtn.querySelector('span');
      if (spanText) {
        spanText.textContent = 'View Resume Here';
      }
    });
  }
}

/* Horizontally Moving & Scrollable Certificate Ledger */
const certWrapper = document.getElementById('certScrollWrapper');
const certTrack = document.getElementById('certTrack');
const certPrevBtn = document.getElementById('certPrevBtn');
const certNextBtn = document.getElementById('certNextBtn');

if (certWrapper && certTrack) {
  let isHovered = false;
  let isMouseDown = false;
  let startX = 0;
  let scrollLeftPos = 0;
  const speed = 0.75;

  function step() {
    if (!isHovered && !isMouseDown && !reduceMotion) {
      certWrapper.scrollLeft += speed;
      const halfWidth = certTrack.scrollWidth / 2;
      if (halfWidth > 0 && certWrapper.scrollLeft >= halfWidth) {
        certWrapper.scrollLeft -= halfWidth;
      }
    }
    requestAnimationFrame(step);
  }

  certWrapper.addEventListener('mouseenter', () => { isHovered = true; });
  certWrapper.addEventListener('mouseleave', () => {
    isHovered = false;
    isMouseDown = false;
  });

  certWrapper.querySelectorAll('img').forEach(img => {
    img.addEventListener('dragstart', (e) => e.preventDefault());
  });

  certWrapper.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    startX = e.pageX - certWrapper.offsetLeft;
    scrollLeftPos = certWrapper.scrollLeft;
  });
  certWrapper.addEventListener('mouseup', () => { isMouseDown = false; });
  certWrapper.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    e.preventDefault();
    const x = e.pageX - certWrapper.offsetLeft;
    const walk = (x - startX) * 1.5;
    certWrapper.scrollLeft = scrollLeftPos - walk;
  });

  if (certPrevBtn) {
    certPrevBtn.addEventListener('click', () => {
      const halfWidth = certTrack.scrollWidth / 2;
      if (certWrapper.scrollLeft <= 0 && halfWidth > 0) {
        certWrapper.scrollLeft += halfWidth;
      }
      certWrapper.scrollBy({ left: -360, behavior: 'smooth' });
    });
  }

  if (certNextBtn) {
    certNextBtn.addEventListener('click', () => {
      const halfWidth = certTrack.scrollWidth / 2;
      if (halfWidth > 0 && certWrapper.scrollLeft >= halfWidth) {
        certWrapper.scrollLeft -= halfWidth;
      }
      certWrapper.scrollBy({ left: 360, behavior: 'smooth' });
    });
  }

  requestAnimationFrame(step);
}

