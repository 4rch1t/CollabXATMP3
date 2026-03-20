/* CollabX — Common frontend utilities */

function getToken() { return localStorage.getItem('collabx_token'); }
function getUser() { const d = localStorage.getItem('collabx_user'); return d ? JSON.parse(d) : null; }
function setAuth(token, user) { localStorage.setItem('collabx_token', token); localStorage.setItem('collabx_user', JSON.stringify(user)); }
function clearAuth() { localStorage.removeItem('collabx_token'); localStorage.removeItem('collabx_user'); }
function isLoggedIn() { return !!getToken(); }
function requireAuth() { if (!isLoggedIn()) { window.location.href = '/login.html'; return false; } return true; }

async function requireCompleteProfile() {
  try {
    const user = await api('/users/me');
    if (!user.bio || !user.skills || user.skills.length === 0) {
      showToast('Complete your profile before continuing (bio and at least one skill required)', 'error');
      setTimeout(() => { window.location.href = '/profile.html'; }, 1200);
      return false;
    }
    return true;
  } catch (e) { return false; }
}

async function api(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const config = { ...options, headers: { ...headers, ...options.headers } };
  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch('/api' + endpoint, config);
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) { clearAuth(); window.location.href = '/login.html'; }
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

function logout() { clearAuth(); window.location.href = '/'; }

function updateNav() {
  document.querySelectorAll('.auth-only').forEach(el => el.style.display = isLoggedIn() ? '' : 'none');
  document.querySelectorAll('.guest-only').forEach(el => el.style.display = isLoggedIn() ? 'none' : '');
  const user = getUser();
  const nameEl = document.getElementById('nav-user-name');
  const avatarEl = document.getElementById('nav-user-avatar');
  if (nameEl && user) nameEl.textContent = user.name;
  if (avatarEl && user) avatarEl.textContent = user.name.charAt(0).toUpperCase();
}

function formatDate(d) {
  const diff = Date.now() - new Date(d).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return new Date(d).toLocaleDateString();
}

const TAG_COLORS = ['#E63312','#2196F3','#4CAF50','#9C27B0','#FF5722','#00BCD4','#F5B800','#607D8B'];
function tagColor(s) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return TAG_COLORS[Math.abs(h) % TAG_COLORS.length]; }
function skillTag(s) { return '<span class="skill-tag" style="background:' + tagColor(s) + '">' + escHtml(s) + '</span>'; }
function escHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function showToast(msg, type = '') {
  let t = document.getElementById('app-toast');
  if (!t) { t = document.createElement('div'); t.id = 'app-toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

function avatarInitial(name) { return name ? name.charAt(0).toUpperCase() : '?'; }

function setupTagInput(wrapperId, hiddenId) {
  const wrapper = document.getElementById(wrapperId);
  const hidden = document.getElementById(hiddenId);
  if (!wrapper) return;
  const input = wrapper.querySelector('input');
  let tags = [];
  function render() {
    wrapper.querySelectorAll('.tag-item').forEach(t => t.remove());
    tags.forEach((tag, i) => {
      const el = document.createElement('span');
      el.className = 'tag-item';
      el.innerHTML = escHtml(tag) + ' <span class="remove-tag" data-i="' + i + '">&times;</span>';
      wrapper.insertBefore(el, input);
    });
    if (hidden) hidden.value = tags.join(',');
  }
  input.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      const v = input.value.trim().replace(',', '');
      if (v && !tags.includes(v)) { tags.push(v); input.value = ''; render(); }
    }
    if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); render(); }
  });
  wrapper.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-tag')) { tags.splice(+e.target.dataset.i, 1); render(); }
    input.focus();
  });
  return { getTags: () => [...tags], setTags: (t) => { tags = [...t]; render(); } };
}

// Dropdown toggle + unread badge + nav scroll effect
document.addEventListener('DOMContentLoaded', () => {
  updateNav();
  const userBtn = document.getElementById('nav-user-btn');
  const dropdown = document.getElementById('nav-dropdown');
  if (userBtn && dropdown) {
    userBtn.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.toggle('show'); });
    document.addEventListener('click', () => dropdown.classList.remove('show'));
  }

  // Wrap Messages links with red-dot indicator
  if (isLoggedIn()) {
    document.querySelectorAll('a[href="/messages.html"]').forEach(link => {
      if (link.closest('.nav-dropdown')) return; // skip dropdown duplicates
      if (link.parentElement.classList.contains('msg-link-wrap')) return;
      const wrap = document.createElement('span');
      wrap.className = 'msg-link-wrap';
      link.parentNode.insertBefore(wrap, link);
      wrap.appendChild(link);
      const dot = document.createElement('span');
      dot.className = 'msg-dot';
      wrap.appendChild(dot);
    });
    checkUnread();
    setInterval(checkUnread, 15000);
  }

  // Navbar scroll shadow
  window.addEventListener('scroll', () => {
    document.querySelector('.navbar')?.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
});

async function checkUnread() {
  try {
    const data = await api('/messages/unread/count');
    document.querySelectorAll('.msg-dot').forEach(dot => {
      dot.classList.toggle('active', data.count > 0);
    });
  } catch (e) { /* not logged in or error */ }
}
