import { useState } from 'react';
import './App.css';
import OrganizationDashboard from './OrganizationDashboard';
import PlayerDashboard from './PlayerDashboard';
import TeamDashboard from './TeamDashboard';

const ACCOUNT_STORAGE_KEY = 'sport-x.accounts';
const SESSION_STORAGE_KEY = 'sport-x.session';

const accountTypes = [
  { id: 'player', label: 'Player' },
  { id: 'team', label: 'Team' },
  { id: 'organization', label: 'Organization' },
];

function readStoredValue(key, fallback) {
  const value = window.localStorage.getItem(key);
  return value ? JSON.parse(value) : fallback;
}

async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await window.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function App() {
  const [currentUser, setCurrentUser] = useState(() => readStoredValue(SESSION_STORAGE_KEY, null));
  const [page, setPage] = useState(() => (currentUser ? 'dashboard' : 'home'));
  const [authMode, setAuthMode] = useState('register');
  const [selectedRole, setSelectedRole] = useState('player');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAuth = (mode, role = 'player') => {
    setAuthMode(mode);
    setSelectedRole(role);
    setAuthError('');
    setPage('auth');
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');

    try {
      const accounts = readStoredValue(ACCOUNT_STORAGE_KEY, []);
      if (!Array.isArray(accounts)) {
        throw new Error('Saved account data is invalid. Clear this site’s stored data and try again.');
      }

      if (authMode === 'register') {
        const name = String(form.get('name') || '').trim();
        const confirmPassword = String(form.get('confirmPassword') || '');
        if (password.length < 8) {
          setAuthError('Use a password with at least 8 characters.');
          return;
        }
        if (password !== confirmPassword) {
          setAuthError('The passwords do not match.');
          return;
        }
        if (accounts.some((account) => account.email === email)) {
          setAuthError('An account with this email already exists. Please log in.');
          return;
        }

        const salt = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
        const passwordHash = await hashPassword(password, salt);
        const account = { email, name, role: selectedRole, salt, passwordHash };
        window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify([...accounts, account]));
        const session = { email, name, role: selectedRole };
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        setCurrentUser(session);
        setPage('dashboard');
        return;
      }

      const account = accounts.find((savedAccount) => savedAccount.email === email);
      if (!account) {
        setAuthError('No account was found for this email. Create an account to get started.');
        return;
      }
      if ((await hashPassword(password, account.salt)) !== account.passwordHash) {
        setAuthError('The email or password is incorrect.');
        return;
      }

      const session = { email: account.email, name: account.name, role: account.role };
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      setCurrentUser(session);
      setPage('dashboard');
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'Unable to complete authentication in this browser. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setCurrentUser(null);
    setPage('home');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand-wrap brand-button" onClick={() => setPage('home')}>
          <span className="brand-mark">SX</span>
          <span>
            <span className="brand-name">Sport X</span>
            <span className="brand-subtitle">Sports talent platform</span>
          </span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          {currentUser ? (
            <span className="signed-in-label">{currentUser.role} account</span>
          ) : (
            <>
              <button type="button" onClick={() => setPage('home')}>Home</button>
              <a href="#explore" onClick={() => setPage('home')}>Explore</a>
              <a href="#features" onClick={() => setPage('home')}>How it works</a>
            </>
          )}
        </nav>
        <div className="nav-actions">
          {currentUser ? (
            <>
              <button type="button" className="ghost-button" onClick={() => setPage('dashboard')}>
                Dashboard
              </button>
              <button type="button" className="primary-button" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <button type="button" className="ghost-button" onClick={() => openAuth('login')}>
                Log in
              </button>
              <button type="button" className="primary-button" onClick={() => openAuth('register')}>
                Join now
              </button>
            </>
          )}
        </div>
      </header>

      <main>
        {page === 'home' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">For players, teams, and organizers</span>
                <h1>Find your next move in sport.</h1>
                <p>
                  Create your account to build a sports profile, find opportunities, or organize
                  competitions.
                </p>
                <div className="cta-row">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => openAuth('register', 'player')}
                  >
                    Create a player account
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openAuth('register', 'team')}
                  >
                    Join as a team
                  </button>
                </div>
              </div>
              <aside className="hero-panel">
                <div className="feature-card highlight-card">
                  <span className="eyebrow">A better way to connect</span>
                  <h2>Your sport. Your next opportunity.</h2>
                  <p>Start with your own account. Your details are not prefilled with sample data.</p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => openAuth('register', 'organization')}
                  >
                    Set up an organization
                  </button>
                </div>
              </aside>
            </section>

            <section id="explore" className="section-block">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Discover</span>
                  <h2>Teams and tournaments</h2>
                </div>
              </div>
              <div className="empty-state">
                <h3>No teams or tournaments yet</h3>
                <p>When members add listings, they’ll appear here. Nothing is populated with sample records.</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => openAuth('register')}
                >
                  Create an account
                </button>
              </div>
            </section>

            <section id="features" className="section-block">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">How it works</span>
                  <h2>One place for your sports journey</h2>
                </div>
              </div>
              <div className="features-grid">
                {accountTypes.map((type) => (
                  <article className="feature-card" key={type.id}>
                    <h3>{type.label}s</h3>
                    <p>
                      {type.id === 'player' && 'Create and manage your own player profile.'}
                      {type.id === 'team' && 'Set up a team account and manage its information.'}
                      {type.id === 'organization' && 'Create an organization account for your sports activities.'}
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => openAuth('register', type.id)}
                    >
                      Join as {type.label.toLowerCase()}
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {page === 'auth' && (
          <section className="auth-layout">
            <div className="auth-intro">
              <span className="eyebrow">{authMode === 'register' ? 'Create your account' : 'Welcome back'}</span>
              <h1>{authMode === 'register' ? 'Join Sport X' : 'Log in to Sport X'}</h1>
              <p>
                {authMode === 'register'
                  ? 'Enter your details to create an account. Only the information you provide will be saved.'
                  : 'Use the email and password you registered with in this browser.'}
              </p>
            </div>
            <form className="auth-card" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <>
                  <label>
                    <span>Your name</span>
                    <input name="name" type="text" autoComplete="name" required />
                  </label>
                  <label>
                    <span>Account type</span>
                    <select
                      value={selectedRole}
                      onChange={(event) => setSelectedRole(event.target.value)}
                    >
                      {accountTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label>
                <span>Email address</span>
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  minLength={authMode === 'register' ? 8 : undefined}
                  required
                />
              </label>
              {authMode === 'register' && (
                <label>
                  <span>Confirm password</span>
                  <input
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
              )}
              {authError && <p className="form-error" role="alert">{authError}</p>}
              <button type="submit" className="primary-button auth-submit" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Log in'}
              </button>
              <p className="auth-switch">
                {authMode === 'register' ? 'Already have an account?' : 'New to Sport X?'}{' '}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setAuthMode(authMode === 'register' ? 'login' : 'register');
                    setAuthError('');
                  }}
                >
                  {authMode === 'register' ? 'Log in' : 'Create an account'}
                </button>
              </p>
              <p className="prototype-note">
                Prototype mode: accounts are stored in this browser only. This is not production
                authentication or cloud storage.
              </p>
              <button type="button" className="back-button" onClick={() => setPage('home')}>
                Back to home
              </button>
            </form>
          </section>
        )}

        {page === 'dashboard' && currentUser && currentUser.role === 'organization' && (
          <OrganizationDashboard user={currentUser} onLogout={handleLogout} />
        )}

        {page === 'dashboard' && currentUser && currentUser.role === 'player' && (
          <PlayerDashboard user={currentUser} onLogout={handleLogout} />
        )}

        {page === 'dashboard' && currentUser && currentUser.role === 'team' && (
          <TeamDashboard user={currentUser} onLogout={handleLogout} />
        )}
      </main>

      <footer id="footer" className="site-footer">
        <div>
          <div className="brand-name">Sport X</div>
          <p>Connecting players, teams, and organizations through sport.</p>
        </div>
        <div className="footer-links">
          <a href="#explore" onClick={() => setPage('home')}>Explore</a>
          <a href="#features" onClick={() => setPage('home')}>How it works</a>
          {!currentUser && (
            <button type="button" onClick={() => openAuth('register')}>Join Sport X</button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;
