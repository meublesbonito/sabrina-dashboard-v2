// ─────────────────────────────────────────────
// AUTH UI — Login screen + session check
// ─────────────────────────────────────────────

let selectedUser = null;

export async function initAuthUI() {
  // Check si déjà connecté
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      showDashboard(data.user);
      return;
    }
  } catch (e) {
    console.log('Pas de session active');
  }

  // Sinon, montre le login
  showLogin();
}

async function showLogin() {
  document.getElementById('login-screen').hidden = false;
  document.getElementById('dashboard').hidden = true;

  // Récupère la liste des utilisateurs
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json().catch(() => ({}));
    const users = data.availableUsers?.length ? data.availableUsers : ['Oussama'];
    renderUserButtons(users);
  } catch {
    renderUserButtons(['Oussama']);
  }

  // Submit
  document.getElementById('login-btn').addEventListener('click', tryLogin);
  document.getElementById('pwd-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryLogin();
  });
}

function renderUserButtons(users) {
  const grid = document.getElementById('user-grid');
  grid.innerHTML = '';
  users.forEach(user => {
    const btn = document.createElement('button');
    btn.className = 'user-btn';
    btn.textContent = user;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedUser = user;
    });
    grid.appendChild(btn);
  });

  // Pre-select first user
  if (users.length > 0) {
    grid.firstElementChild.click();
  }
}

async function tryLogin() {
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const pwd = document.getElementById('pwd-input').value.trim();

  errorEl.hidden = true;

  if (!selectedUser) {
    errorEl.textContent = 'Sélectionne un utilisateur';
    errorEl.hidden = false;
    return;
  }
  if (!pwd) {
    errorEl.textContent = 'Mot de passe requis';
    errorEl.hidden = false;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Connexion...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user: selectedUser, password: pwd })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Erreur de connexion';
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Connexion';
      return;
    }

    showDashboard(data.user);
  } catch (e) {
    errorEl.textContent = 'Erreur réseau. Réessaye.';
    errorEl.hidden = false;
    btn.disabled = false;
    btn.textContent = 'Connexion';
  }
}

function showDashboard(user) {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('dashboard').hidden = false;
  document.getElementById('current-user').textContent = user || '—';

  // Set sync status initial
  if (window.setSyncStatus) {
    window.setSyncStatus('ok');
  }
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch {}
  location.reload();
}
