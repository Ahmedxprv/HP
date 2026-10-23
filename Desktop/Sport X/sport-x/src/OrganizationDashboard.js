import { useEffect, useState } from 'react';
import './OrganizationDashboard.css';

const DATA_KEY_PREFIX = 'sport-x.organization.';
const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Organization profile' },
  { id: 'tournaments', label: 'Tournaments' },
  { id: 'teams', label: 'Teams & rosters' },
  { id: 'openings', label: 'Player openings' },
];

function emptyOrganization(user) {
  return {
    profile: {
      name: user.name || '',
      location: '',
      sport: '',
      details: '',
      contactEmail: user.email || '',
    },
    tournaments: [],
    teams: [],
    openings: [],
  };
}

function normalizeOrganization(data, user) {
  const saved = data && typeof data === 'object' ? data : {};
  const organization = { ...emptyOrganization(user), ...saved };
  organization.profile = { ...emptyOrganization(user).profile, ...(saved.profile || {}) };
  organization.tournaments = Array.isArray(saved.tournaments)
    ? saved.tournaments.map((tournament) => ({
      ...tournament,
      registrations: Array.isArray(tournament.registrations) ? tournament.registrations : [],
      standings: Array.isArray(tournament.standings) ? tournament.standings : [],
    }))
    : [];
  organization.teams = Array.isArray(saved.teams) ? saved.teams : [];
  organization.openings = Array.isArray(saved.openings) ? saved.openings : [];
  return organization;
}

function loadOrganization(user) {
  try {
    const stored = window.localStorage.getItem(`${DATA_KEY_PREFIX}${user.email}`);
    return { data: normalizeOrganization(stored ? JSON.parse(stored) : {}, user), error: '' };
  } catch (error) {
    return {
      data: emptyOrganization(user),
      error: error instanceof Error ? error.message : 'Could not load organization information.',
    };
  }
}

function OrganizationDashboard({ user, onLogout }) {
  const [initial] = useState(() => loadOrganization(user));
  const [data, setData] = useState(initial.data);
  const [section, setSection] = useState('overview');
  const [notice, setNotice] = useState(initial.error);
  const [noticeIsError, setNoticeIsError] = useState(Boolean(initial.error));
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState('');
  const pendingRegistrations = data.tournaments.flatMap((tournament) =>
    tournament.registrations
      .filter((registration) => registration.status === 'Submitted')
      .map((registration) => ({ ...registration, tournamentId: tournament.id, tournamentName: tournament.name }))
  );

  useEffect(() => {
    const organizationKey = `${DATA_KEY_PREFIX}${user.email}`;
    const handleStorage = (event) => {
      if (event.key !== organizationKey) return;
      const refreshed = loadOrganization(user);
      if (refreshed.error) {
        setNotice(refreshed.error);
        setNoticeIsError(true);
        return;
      }

      const previousPendingCount = data.tournaments.reduce(
        (count, tournament) => count + tournament.registrations.filter((registration) => registration.status === 'Submitted').length,
        0
      );
      const nextPendingCount = refreshed.data.tournaments.reduce(
        (count, tournament) => count + tournament.registrations.filter((registration) => registration.status === 'Submitted').length,
        0
      );
      setData(refreshed.data);
      if (nextPendingCount > previousPendingCount) {
        setNotice('New team tournament registration received.');
        setNoticeIsError(false);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [data, user]);

  const persist = (nextData, message) => {
    setIsSaving(true);
    try {
      window.localStorage.setItem(`${DATA_KEY_PREFIX}${user.email}`, JSON.stringify(nextData));
      setData(nextData);
      setNotice(message);
      setNoticeIsError(false);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not save your changes: ${error.message}`
          : 'Could not save your changes. Please try again.'
      );
      setNoticeIsError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profile = Object.fromEntries(
      ['name', 'location', 'sport', 'details', 'contactEmail'].map((field) => [
        field,
        String(form.get(field) || '').trim(),
      ])
    );
    persist({ ...data, profile }, 'Organization profile saved.');
  };

  const handleTournamentSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tournament = {
      id: `${Date.now()}`,
      name: String(form.get('name') || '').trim(),
      sport: String(form.get('sport') || '').trim(),
      format: String(form.get('format') || '').trim(),
      venue: String(form.get('venue') || '').trim(),
      startDate: String(form.get('startDate') || ''),
      registrationDeadline: String(form.get('registrationDeadline') || ''),
      capacity: Number(form.get('capacity')),
      status: String(form.get('status') || 'Draft'),
      registrations: [],
      standings: [],
    };
    persist({ ...data, tournaments: [...data.tournaments, tournament] }, 'Tournament created.');
    event.currentTarget.reset();
  };

  const handleTeamSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const team = {
      id: `${Date.now()}`,
      name: String(form.get('name') || '').trim(),
      sport: String(form.get('sport') || '').trim(),
      location: String(form.get('location') || '').trim(),
      coach: String(form.get('coach') || '').trim(),
      manager: String(form.get('manager') || '').trim(),
      sponsors: String(form.get('sponsors') || '').trim(),
      players: String(form.get('players') || '')
        .split('\n')
        .map((player) => player.trim())
        .filter(Boolean),
    };
    persist({ ...data, teams: [...data.teams, team] }, 'Team added to your organization.');
    event.currentTarget.reset();
  };

  const handleOpeningSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const opening = {
      id: `${Date.now()}`,
      teamId: String(form.get('teamId') || ''),
      position: String(form.get('position') || '').trim(),
      slots: Number(form.get('slots')),
      deadline: String(form.get('deadline') || ''),
      requirements: String(form.get('requirements') || '').trim(),
    };
    persist({ ...data, openings: [...data.openings, opening] }, 'Player opening published.');
    event.currentTarget.reset();
  };

  const updateTournament = (id, field, value) => {
    const tournaments = data.tournaments.map((tournament) =>
      tournament.id === id ? { ...tournament, [field]: value } : tournament
    );
    persist({ ...data, tournaments }, 'Tournament updated.');
  };

  const updateRegistration = (tournamentId, teamEmail, status) => {
    const tournaments = data.tournaments.map((tournament) => (
      tournament.id === tournamentId
        ? {
          ...tournament,
          registrations: (tournament.registrations || []).map((registration) => (
            registration.teamEmail === teamEmail ? { ...registration, status } : registration
          )),
        }
        : tournament
    ));
    persist({ ...data, tournaments }, `Team registration ${status.toLowerCase()}.`);
  };

  const addStanding = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const tournament = data.tournaments.find((item) => item.id === selectedTournament);
    if (!tournament) return;

    const entry = {
      team: String(form.get('team') || '').trim(),
      played: Number(form.get('played')),
      wins: Number(form.get('wins')),
      draws: Number(form.get('draws')),
      losses: Number(form.get('losses')),
      points: Number(form.get('points')),
    };
    const tournaments = data.tournaments.map((item) =>
      item.id === tournament.id
        ? { ...item, standings: [...item.standings, entry] }
        : item
    );
    persist({ ...data, tournaments }, 'Standings updated.');
    event.currentTarget.reset();
  };

  const selected = data.tournaments.find((item) => item.id === selectedTournament);

  return (
    <section className="section-block organization-workspace">
      <header className="organization-header">
        <div>
          <span className="eyebrow">Organization workspace</span>
          <h1>{data.profile.name || 'Your organization'}</h1>
          <p>{user.email}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onLogout}>Log out</button>
      </header>

      <nav className="organization-nav" aria-label="Organization workspace navigation">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? 'organization-nav-button active' : 'organization-nav-button'}
            onClick={() => {
              setSection(item.id);
              setNotice('');
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {notice && (
        <p className={noticeIsError ? 'organization-notice error' : 'organization-notice'} role="status">
          {notice}
        </p>
      )}

      {section === 'overview' && (
        <div className="organization-content">
          <div className="organization-metrics">
            <article className="organization-metric">
              <strong>{data.tournaments.filter((item) => item.status === 'Completed').length}</strong>
              <span>Completed tournaments</span>
            </article>
            <article className="organization-metric">
              <strong>{data.tournaments.filter((item) => item.status === 'Registration Open').length}</strong>
              <span>Open for registration</span>
            </article>
            <article className="organization-metric">
              <strong>{data.tournaments.filter((item) => item.status === 'Ongoing').length}</strong>
              <span>Ongoing tournaments</span>
            </article>
            <article className="organization-metric">
              <strong>{data.teams.length}</strong>
              <span>Managed teams</span>
            </article>
            <article className="organization-metric">
              <strong>{pendingRegistrations.length}</strong>
              <span>Pending team registrations</span>
            </article>
          </div>

          {pendingRegistrations.length > 0 && (
            <section className="pending-registration-section" aria-label="Pending team registrations">
              <div className="organization-section-heading">
                <div>
                  <h2>New team registrations</h2>
                  <p>Review teams waiting for your tournament approval.</p>
                </div>
              </div>
              <div className="organization-card-grid">
                {pendingRegistrations.map((registration) => (
                  <article className="organization-card pending-registration-card" key={`${registration.tournamentId}-${registration.teamEmail}`}>
                    <span className="tournament-status registration-open">New registration</span>
                    <h3>{registration.teamName}</h3>
                    <p>{registration.tournamentName} · Captain: {registration.captain}</p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setSelectedTournament(registration.tournamentId);
                        setSection('tournaments');
                      }}
                    >
                      Review {registration.tournamentName} registration
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="organization-section-heading">
            <div>
              <h2>Tournament overview</h2>
              <p>Completed, upcoming registration, and ongoing competitions managed by you.</p>
            </div>
            <button type="button" className="primary-button" onClick={() => setSection('tournaments')}>
              Manage tournaments
            </button>
          </div>
          {data.tournaments.length === 0 ? (
            <div className="empty-state">
              <h3>No tournaments created</h3>
              <p>Create a tournament to manage registration, competition status, teams, and standings.</p>
              <button type="button" className="secondary-button" onClick={() => setSection('tournaments')}>
                Create a tournament
              </button>
            </div>
          ) : (
            <div className="organization-card-grid">
              {data.tournaments.map((tournament) => (
                <article className="organization-card" key={tournament.id}>
                  <span className={`tournament-status ${tournament.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {tournament.status}
                  </span>
                  <h3>{tournament.name}</h3>
                  <p>{[tournament.sport, tournament.venue].filter(Boolean).join(' · ')}</p>
                  <p>{tournament.startDate || 'Date not set'} · {tournament.registrations.length} registrations</p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setSelectedTournament(tournament.id);
                      setSection('tournaments');
                    }}
                  >
                    Manage tournament
                  </button>
                </article>
              ))}
            </div>
          )}
          <div className="organization-section-heading team-overview-heading">
            <div>
              <h2>Teams under your organization</h2>
              <p>Roster members, roles, coaches, managers, and sponsors.</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setSection('teams')}>
              Manage teams
            </button>
          </div>
          {data.teams.length === 0 ? (
            <div className="empty-state compact-empty">
              <h3>No teams added</h3>
              <p>Add a team to manage its staff and roster.</p>
            </div>
          ) : (
            <TeamList teams={data.teams} />
          )}
        </div>
      )}

      {section === 'profile' && (
        <form className="organization-form" onSubmit={handleProfileSubmit}>
          <div>
            <h2>Organization profile</h2>
            <p>Manage the public details associated with your organization account.</p>
          </div>
          <div className="organization-form-grid">
            <label><span>Organization name</span><input name="name" defaultValue={data.profile.name} required /></label>
            <label><span>Location</span><input name="location" defaultValue={data.profile.location} /></label>
            <label><span>Primary sport</span><input name="sport" defaultValue={data.profile.sport} /></label>
            <label><span>Contact email</span><input name="contactEmail" type="email" defaultValue={data.profile.contactEmail} /></label>
            <label className="wide-field"><span>Organization details</span><textarea name="details" rows="4" defaultValue={data.profile.details} /></label>
          </div>
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save organization profile'}
          </button>
        </form>
      )}

      {section === 'tournaments' && (
        <div className="organization-content">
          <div className="organization-section-heading">
            <div>
              <h2>Manage tournaments</h2>
              <p>Set registration status, track participating teams, and maintain standings.</p>
            </div>
          </div>
          {data.tournaments.length > 0 && (
            <div className="organization-table-wrap">
              <table className="organization-table">
                <thead><tr><th>Tournament</th><th>Sport</th><th>Date</th><th>Teams</th><th>Status</th></tr></thead>
                <tbody>
                  {data.tournaments.map((tournament) => (
                    <tr key={tournament.id}>
                      <td>
                        <button
                          type="button"
                          className="table-link"
                          onClick={() => setSelectedTournament(tournament.id)}
                        >
                          {tournament.name}
                        </button>
                      </td>
                      <td>{tournament.sport}</td>
                      <td>{tournament.startDate || '—'}</td>
                      <td>{tournament.registrations.length}/{tournament.capacity || '—'}</td>
                      <td>
                        <select
                          aria-label={`${tournament.name} status`}
                          value={tournament.status}
                          onChange={(event) => updateTournament(tournament.id, 'status', event.target.value)}
                        >
                          <option>Draft</option>
                          <option>Registration Open</option>
                          <option>Registration Closed</option>
                          <option>Ongoing</option>
                          <option>Completed</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form className="organization-form" onSubmit={handleTournamentSubmit}>
            <h3>Create tournament</h3>
            <div className="organization-form-grid">
              <label><span>Tournament name</span><input name="name" required /></label>
              <label><span>Sport</span><input name="sport" required /></label>
              <label><span>Format</span><input name="format" placeholder="For example: round robin" /></label>
              <label><span>Venue</span><input name="venue" /></label>
              <label><span>Start date</span><input name="startDate" type="date" /></label>
              <label><span>Registration deadline</span><input name="registrationDeadline" type="date" /></label>
              <label><span>Team capacity</span><input name="capacity" type="number" min="2" /></label>
              <label>
                <span>Initial status</span>
                <select name="status" defaultValue="Draft">
                  <option>Draft</option>
                  <option>Registration Open</option>
                </select>
              </label>
            </div>
            <button type="submit" className="primary-button" disabled={isSaving}>Create tournament</button>
          </form>

          {selected && (
            <section className="standings-section">
              <div className="organization-section-heading">
                <div>
                  <h2>{selected.name} standings</h2>
                  <p>Enter the table values recorded by your organization.</p>
                </div>
              </div>
              {selected.standings.length > 0 ? (
                <div className="organization-table-wrap">
                  <table className="organization-table">
                    <thead><tr><th>Team</th><th>Played</th><th>Wins</th><th>Draws</th><th>Losses</th><th>Points</th></tr></thead>
                    <tbody>
                      {selected.standings.map((row) => (
                        <tr key={`${selected.id}-${row.team}`}>
                          <td>{row.team}</td><td>{row.played}</td><td>{row.wins}</td>
                          <td>{row.draws}</td><td>{row.losses}</td><td>{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="empty-inline">No standings recorded for this tournament yet.</p>}
              <div className="organization-section-heading">
                <div>
                  <h2>Team registrations</h2>
                  <p>Review teams that applied to participate in this tournament.</p>
                </div>
              </div>
              {(selected.registrations || []).length > 0 ? (
                <div className="organization-table-wrap">
                  <table className="organization-table">
                    <thead><tr><th>Team</th><th>Captain</th><th>Submitted</th><th>Status</th><th>Review</th></tr></thead>
                    <tbody>
                      {(selected.registrations || []).map((registration) => (
                        <tr key={`${selected.id}-${registration.teamEmail}`}>
                          <td>{registration.teamName}</td>
                          <td>{registration.captain}</td>
                          <td>{registration.submittedAt ? new Date(registration.submittedAt).toLocaleDateString() : '—'}</td>
                          <td>{registration.status}</td>
                          <td>
                            {registration.status === 'Submitted' ? (
                              <div className="registration-actions">
                                <button
                                  type="button"
                                  className="text-button"
                                  onClick={() => updateRegistration(selected.id, registration.teamEmail, 'Accepted')}
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  className="text-button danger-text"
                                  onClick={() => updateRegistration(selected.id, registration.teamEmail, 'Rejected')}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : 'Reviewed'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="empty-inline">No team registrations submitted yet.</p>}
              <form className="standing-form" onSubmit={addStanding}>
                <label><span>Team name</span><input name="team" required /></label>
                <label><span>Played</span><input name="played" type="number" min="0" defaultValue="0" required /></label>
                <label><span>Wins</span><input name="wins" type="number" min="0" defaultValue="0" required /></label>
                <label><span>Draws</span><input name="draws" type="number" min="0" defaultValue="0" required /></label>
                <label><span>Losses</span><input name="losses" type="number" min="0" defaultValue="0" required /></label>
                <label><span>Points</span><input name="points" type="number" min="0" defaultValue="0" required /></label>
                <button type="submit" className="primary-button" disabled={isSaving}>Add standings row</button>
              </form>
            </section>
          )}
        </div>
      )}

      {section === 'teams' && (
        <div className="organization-content">
          <div className="organization-section-heading">
            <div>
              <h2>Teams and rosters</h2>
              <p>Keep player names and roles, coaching staff, managers, and sponsors together.</p>
            </div>
          </div>
          {data.teams.length > 0 && <TeamList teams={data.teams} />}
          <form className="organization-form" onSubmit={handleTeamSubmit}>
            <h3>Add a team</h3>
            <div className="organization-form-grid">
              <label><span>Team name</span><input name="name" required /></label>
              <label><span>Sport</span><input name="sport" required /></label>
              <label><span>Location</span><input name="location" /></label>
              <label><span>Coach</span><input name="coach" /></label>
              <label><span>Team manager</span><input name="manager" /></label>
              <label><span>Sponsors</span><input name="sponsors" /></label>
              <label className="wide-field">
                <span>Players and roles (one per line)</span>
                <textarea name="players" rows="5" placeholder="Player name — role" />
              </label>
            </div>
            <button type="submit" className="primary-button" disabled={isSaving}>Add team</button>
          </form>
        </div>
      )}

      {section === 'openings' && (
        <div className="organization-content">
          <div className="organization-section-heading">
            <div>
              <h2>Player openings</h2>
              <p>Publish positions that players can apply for on your teams.</p>
            </div>
          </div>
          {data.openings.length > 0 ? (
            <div className="organization-card-grid">
              {data.openings.map((opening) => {
                const team = data.teams.find((item) => item.id === opening.teamId);
                return (
                  <article className="organization-card" key={opening.id}>
                    <span className="tournament-status registration-open">Open seat</span>
                    <h3>{opening.position}</h3>
                    <p>{team ? team.name : 'Team not found'} · {opening.slots} available</p>
                    <p>Apply by: {opening.deadline || 'No deadline set'}</p>
                    {opening.requirements && <p>{opening.requirements}</p>}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <h3>No player openings published</h3>
              <p>Add a team first, then publish open seats for players.</p>
            </div>
          )}
          <form className="organization-form" onSubmit={handleOpeningSubmit}>
            <h3>Publish an open seat</h3>
            {data.teams.length === 0 ? (
              <p className="empty-inline">Add a team before publishing a player opening.</p>
            ) : (
              <>
                <div className="organization-form-grid">
                  <label>
                    <span>Team</span>
                    <select name="teamId" required>
                      {data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                  </label>
                  <label><span>Position or role</span><input name="position" required /></label>
                  <label><span>Available seats</span><input name="slots" type="number" min="1" defaultValue="1" required /></label>
                  <label><span>Deadline</span><input name="deadline" type="date" /></label>
                  <label className="wide-field"><span>Requirements</span><textarea name="requirements" rows="3" /></label>
                </div>
                <button type="submit" className="primary-button" disabled={isSaving}>Publish opening</button>
              </>
            )}
          </form>
        </div>
      )}
    </section>
  );
}

function TeamList({ teams }) {
  return (
    <div className="organization-card-grid">
      {teams.map((team) => (
        <article className="organization-card" key={team.id}>
          <h3>{team.name}</h3>
          <p>{[team.sport, team.location].filter(Boolean).join(' · ')}</p>
          <div className="team-staff">
            <span><strong>Coach</strong>{team.coach || 'Not provided'}</span>
            <span><strong>Manager</strong>{team.manager || 'Not provided'}</span>
            <span><strong>Sponsors</strong>{team.sponsors || 'Not provided'}</span>
          </div>
          <h4>Players and roles</h4>
          {team.players.length > 0 ? (
            <ul className="roster-list">
              {team.players.map((player, index) => <li key={`${team.id}-${index}`}>{player}</li>)}
            </ul>
          ) : <p>No roster members added yet.</p>}
        </article>
      ))}
    </div>
  );
}

export default OrganizationDashboard;
