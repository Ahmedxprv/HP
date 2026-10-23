import { useState } from 'react';
import './App.css';
import OrganizationDashboard from './OrganizationDashboard';
import PlayerDashboard from './PlayerDashboard';
import TeamDashboard from './TeamDashboard';

const ACCOUNT_STORAGE_KEY = 'sport-x.accounts';
const SESSION_STORAGE_KEY = 'sport-x.session';
const TEAM_STORAGE_PREFIX = 'sport-x.team.';
const ORGANIZATION_STORAGE_PREFIX = 'sport-x.organization.';

const accountTypes = [
  { id: 'player', label: 'Player' },
  { id: 'team', label: 'Team' },
  { id: 'organization', label: 'Organization' },
];

function readStoredValue(key, fallback) {
  const value = window.localStorage.getItem(key);
  return value ? JSON.parse(value) : fallback;
}

function loadPublicDiscoveries() {
  const teams = [];
  const tournaments = [];
  const teamKeys = new Set();

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;

      if (key.startsWith(TEAM_STORAGE_PREFIX)) {
        const email = key.slice(TEAM_STORAGE_PREFIX.length);
        const team = JSON.parse(window.localStorage.getItem(key));
        const profile = team.profile || {};
        if (profile.name) {
          const dedupeKey = `${profile.name.trim().toLowerCase()}|${(profile.sport || '').trim().toLowerCase()}`;
          if (!teamKeys.has(dedupeKey)) {
            teams.push({
              id: email,
              name: profile.name,
              sport: profile.sport || '',
              location: profile.location || '',
              logoUrl: profile.logoUrl || '',
            });
            teamKeys.add(dedupeKey);
          }
        }
      } else if (key.startsWith(ORGANIZATION_STORAGE_PREFIX)) {
        const organization = JSON.parse(window.localStorage.getItem(key));
        const organizationName = organization.profile?.name || 'Organization';
        (organization.tournaments || []).forEach((tournament) => {
          if (tournament.status === 'Registration Open') {
            tournaments.push({
              ...tournament,
              organizationName,
              organizationKey: key,
            });
          }
        });
        (organization.teams || []).forEach((team) => {
          if (!team.name) return;
          const dedupeKey = `${team.name.trim().toLowerCase()}|${(team.sport || '').trim().toLowerCase()}`;
          if (!teamKeys.has(dedupeKey)) {
            teams.push({
              id: `${key}-${team.id || team.name}`,
              name: team.name,
              sport: team.sport || '',
              location: team.location || '',
              logoUrl: team.logoUrl || '',
            });
            teamKeys.add(dedupeKey);
          }
        });
      }
    }
    return { teams, tournaments, error: '' };
  } catch (error) {
    return {
      teams: [],
      tournaments: [],
      error: error instanceof Error ? `Could not load listings: ${error.message}` : 'Could not load listings.',
    };
  }
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
  const [discoveries, setDiscoveries] = useState(loadPublicDiscoveries);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [registrationTarget, setRegistrationTarget] = useState(null);

  const goHome = () => {
    setDiscoveries(loadPublicDiscoveries());
    setSelectedTournament(null);
    setRegistrationTarget(null);
    setPage('home');
  };

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
    goHome();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="brand-wrap brand-button" onClick={goHome}>
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
                  {currentUser
                    ? `Welcome back, ${currentUser.name}. Explore teams and tournaments or continue to your dashboard.`
                    : 'Create your account to build a sports profile, find opportunities, or organize competitions.'}
                </p>
                <div className="cta-row">
                  {currentUser ? (
                    <button type="button" className="primary-button" onClick={() => setPage('dashboard')}>
                      View dashboard
                    </button>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
              <aside className="hero-panel">
                <div className="feature-card highlight-card">
                  <span className="eyebrow">A better way to connect</span>
                  <h2>Your sport. Your next opportunity.</h2>
                  <p>
                    {currentUser
                      ? 'Find opportunities and competition listings shared by Sport X members.'
                      : 'Start with your own account. Your details are not prefilled with sample data.'}
                  </p>
                  {!currentUser && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => openAuth('register', 'organization')}
                    >
                      Set up an organization
                    </button>
                  )}
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
              {discoveries.error && <p className="discovery-error" role="alert">{discoveries.error}</p>}
              <h3 className="discovery-subheading">Open for registration</h3>
              {discoveries.tournaments.length ? (
                <div className="discovery-grid">
                  {discoveries.tournaments.map((tournament) => (
                    <article className="discovery-card" key={tournament.id}>
                      <span className="eyebrow">Registration open</span>
                      <h3>{tournament.name}</h3>
                      <p>{[tournament.sport, tournament.venue].filter(Boolean).join(' · ')}</p>
                      <p>Organized by {tournament.organizationName}</p>
                      <p>{tournament.startDate || 'Date not set'} · {tournament.capacity || 'No'} team limit</p>
                      <p>{(tournament.registrations || []).length} teams registered</p>
                      <button
                        type="button"
                        className="text-button discovery-details-button"
                        onClick={() => {
                          setSelectedTournament(tournament);
                          setRegistrationTarget(null);
                        }}
                      >
                        View tournament details
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-discovery-empty">
                  <h3>No tournaments open for registration</h3>
                  <p>New tournaments will appear here when organizations open registration.</p>
                </div>
              )}

              {selectedTournament && (
                <div className="tournament-dialog-backdrop" onClick={() => setSelectedTournament(null)}>
                  <section
                    className="tournament-detail-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="public-tournament-title"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="tournament-detail-heading">
                      <div>
                        <span className="eyebrow">Registration open</span>
                        <h2 id="public-tournament-title">{selectedTournament.name}</h2>
                      </div>
                      <button
                        type="button"
                        className="secondary-button"
                        aria-label="Close tournament details"
                        onClick={() => setSelectedTournament(null)}
                      >
                        Close
                      </button>
                    </div>
                    <p className="tournament-detail-organizer">Organized by {selectedTournament.organizationName}</p>
                    <dl className="tournament-detail-grid">
                      <div><dt>Sport</dt><dd>{selectedTournament.sport || 'Not specified'}</dd></div>
                      <div><dt>Format</dt><dd>{selectedTournament.format || 'Not specified'}</dd></div>
                      <div><dt>Venue</dt><dd>{selectedTournament.venue || 'Not specified'}</dd></div>
                      <div><dt>Start date</dt><dd>{selectedTournament.startDate || 'Not specified'}</dd></div>
                      <div><dt>Registration deadline</dt><dd>{selectedTournament.registrationDeadline || 'Not specified'}</dd></div>
                      <div>
                        <dt>Registered teams</dt>
                        <dd>{(selectedTournament.registrations || []).length}{selectedTournament.capacity ? ` / ${selectedTournament.capacity}` : ''}</dd>
                      </div>
                    </dl>
                    <p className="tournament-detail-note">
                      Tournament details are available to all visitors. Teams can register from their team dashboard.
                    </p>
                    {currentUser?.role === 'team' ? (
                      (selectedTournament.registrations || []).some(
                        (registration) => registration.teamEmail === currentUser.email
                      ) ? (
                        <button type="button" className="primary-button" disabled>
                          Already registered
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => {
                            setRegistrationTarget({
                              organizationKey: selectedTournament.organizationKey,
                              tournamentId: selectedTournament.id,
                            });
                            setSelectedTournament(null);
                            setPage('dashboard');
                          }}
                        >
                          Register your team
                        </button>
                      )
                    ) : (
                      <button type="button" className="primary-button" disabled>
                        Team accounts only
                      </button>
                    )}
                  </section>
                </div>
              )}

              <h3 className="discovery-subheading">Teams on Sport X</h3>
              {discoveries.teams.length ? (
                <div className="discovery-grid">
                  {discoveries.teams.map((team) => (
                    <article className="discovery-card discovery-team-card" key={team.id}>
                      {team.logoUrl ? <img src={team.logoUrl} alt="" /> : (
                        <span className="discovery-team-mark">{team.name.slice(0, 1).toUpperCase()}</span>
                      )}
                      <div>
                        <h3>{team.name}</h3>
                        <p>{[team.sport, team.location].filter(Boolean).join(' · ') || 'Team'}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-discovery-empty">
                  <h3>No teams listed yet</h3>
                  <p>Team profiles will appear here after they are created.</p>
                </div>
              )}
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
                    {!currentUser && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => openAuth('register', type.id)}
                      >
                        Join as {type.label.toLowerCase()}
                      </button>
                    )}
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
          <TeamDashboard
            user={currentUser}
            onLogout={handleLogout}
            registrationTarget={registrationTarget}
          />
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
