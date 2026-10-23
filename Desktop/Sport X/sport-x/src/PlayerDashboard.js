import { useMemo, useState } from 'react';
import './PlayerDashboard.css';

const ORGANIZATION_PREFIX = 'sport-x.organization.';
const TEAM_PREFIX = 'sport-x.team.';
const PROFILE_PREFIX = 'sport-x.profile.';
const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'My profile' },
  { id: 'teams', label: 'Find teams' },
  { id: 'tournaments', label: 'Tournaments' },
  { id: 'applications', label: 'Applications' },
];

function emptyPlayerProfile(user) {
  return {
    name: user.name || '',
    location: '',
    sport: '',
    position: '',
    biography: '',
    photoUrl: '',
    experience: '',
    previousTeams: '',
    activities: '',
    achievements: '',
    statistics: '',
    openToJoin: false,
    applications: [],
  };
}

function loadPlayerData(user) {
  try {
    const savedProfile = window.localStorage.getItem(`${PROFILE_PREFIX}${user.email}`);
    const savedValues = savedProfile ? JSON.parse(savedProfile) : {};
    const profile = {
      ...emptyPlayerProfile(user),
      ...savedValues,
      position: savedValues.position || savedValues.details || '',
    };
    const organizations = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (key.startsWith(ORGANIZATION_PREFIX)) {
        const organizationData = JSON.parse(window.localStorage.getItem(key));
        if (organizationData && typeof organizationData === 'object') {
          organizations.push(organizationData);
        }
      } else if (key.startsWith(TEAM_PREFIX)) {
        const teamData = JSON.parse(window.localStorage.getItem(key));
        if (teamData?.profile) {
          const teamKey = key;
          organizations.push({
            profile: {
              name: teamData.profile.name || 'Team',
              contactEmail: key.slice(TEAM_PREFIX.length),
            },
            teams: [{
              id: teamKey,
              ...teamData.profile,
              players: (teamData.squad || []).map((player) =>
                `${player.name}${player.role ? ` — ${player.role}` : ''}`
              ),
            }],
            openings: (teamData.vacancies || []).map((vacancy) => ({
              ...vacancy,
              teamId: teamKey,
            })),
            tournaments: [],
          });
        }
      }
    }
    return { profile, organizations, error: '' };
  } catch (error) {
    return {
      profile: emptyPlayerProfile(user),
      organizations: [],
      error: error instanceof Error ? error.message : 'Could not load saved player information.',
    };
  }
}

function getMarketplace(organizations) {
  const teams = [];
  const tournaments = [];
  organizations.forEach((organization) => {
    const organizationTeams = organization.teams || [];
    organizationTeams.forEach((team) => {
      teams.push({
        ...team,
        organizationName: organization.profile?.name || 'Organization',
        organizationEmail: organization.profile?.contactEmail || '',
        openings: (organization.openings || []).filter((opening) => opening.teamId === team.id),
      });
    });
    (organization.tournaments || []).forEach((tournament) => {
      if (tournament.status !== 'Draft') {
        tournaments.push({
          ...tournament,
          organizationName: organization.profile?.name || 'Organization',
        });
      }
    });
  });
  return { teams, tournaments };
}

function PlayerDashboard({ user, onLogout }) {
  const [initial] = useState(() => loadPlayerData(user));
  const [profile, setProfile] = useState(initial.profile);
  const [marketplace] = useState(() => getMarketplace(initial.organizations));
  const [section, setSection] = useState('overview');
  const [teamSearch, setTeamSearch] = useState('');
  const [photoDraft, setPhotoDraft] = useState('');
  const [photoDimensions, setPhotoDimensions] = useState(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoX, setPhotoX] = useState(50);
  const [photoY, setPhotoY] = useState(50);
  const [photoError, setPhotoError] = useState('');
  const [notice, setNotice] = useState(initial.error);
  const [noticeIsError, setNoticeIsError] = useState(Boolean(initial.error));
  const [isSaving, setIsSaving] = useState(false);

  const filteredTeams = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();
    if (!query) return marketplace.teams;
    return marketplace.teams.filter((team) =>
      [team.name, team.sport, team.location, team.organizationName]
        .some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [marketplace.teams, teamSearch]);

  const saveProfile = (nextProfile, message) => {
    setIsSaving(true);
    try {
      window.localStorage.setItem(`${PROFILE_PREFIX}${user.email}`, JSON.stringify(nextProfile));
      setProfile(nextProfile);
      setNotice(message);
      setNoticeIsError(false);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not save your profile: ${error.message}`
          : 'Could not save your profile. Please try again.'
      );
      setNoticeIsError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextProfile = {
      ...profile,
      name: String(form.get('name') || '').trim(),
      location: String(form.get('location') || '').trim(),
      sport: String(form.get('sport') || '').trim(),
      position: String(form.get('position') || '').trim(),
      biography: String(form.get('biography') || '').trim(),
      experience: String(form.get('experience') || '').trim(),
      previousTeams: String(form.get('previousTeams') || '').trim(),
      activities: String(form.get('activities') || '').trim(),
      achievements: String(form.get('achievements') || '').trim(),
      statistics: String(form.get('statistics') || '').trim(),
      openToJoin: form.get('openToJoin') === 'on',
    };
    saveProfile(nextProfile, 'Your player profile has been saved.');
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files && event.target.files[0];
    setPhotoError('');
    setPhotoDraft('');
    setPhotoDimensions(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Choose an image file to upload.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Choose an image smaller than 2 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDraft(reader.result);
        setPhotoZoom(1);
        setPhotoX(50);
        setPhotoY(50);
      } else {
        setPhotoError('Could not read this image. Try another file.');
      }
    };
    reader.onerror = () => setPhotoError('Could not read this image. Try another file.');
    reader.readAsDataURL(file);
  };

  const applyPhotoCrop = () => {
    if (!photoDraft || !photoDimensions) {
      setPhotoError('Wait for the image preview to load before applying a crop.');
      return;
    }
    const cropSize = Math.min(photoDimensions.width, photoDimensions.height) / photoZoom;
    const cropX = (photoDimensions.width - cropSize) * (photoX / 100);
    const cropY = (photoDimensions.height - cropSize) * (photoY / 100);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) {
        setPhotoError('Image cropping is not supported by this browser.');
        return;
      }
      context.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, 512, 512);
      try {
        setProfile((current) => ({ ...current, photoUrl: canvas.toDataURL('image/jpeg', 0.86) }));
        setPhotoDraft('');
        setPhotoDimensions(null);
        setPhotoError('');
        setNotice('Photo crop applied. Save your profile to keep the new picture.');
        setNoticeIsError(false);
      } catch (error) {
        setPhotoError(
          error instanceof Error
            ? `Could not prepare the cropped image: ${error.message}`
            : 'Could not prepare the cropped image.'
        );
      }
    };
    image.onerror = () => setPhotoError('Could not crop this image. Try another file.');
    image.src = photoDraft;
  };

  const applyToOpening = (opening, team) => {
    if (profile.applications.some((application) => application.openingId === opening.id)) {
      setNotice('You have already applied for this opening.');
      setNoticeIsError(false);
      return;
    }
    const application = {
      openingId: opening.id,
      position: opening.position,
      teamName: team.name,
      organizationName: team.organizationName,
      appliedAt: new Date().toISOString(),
      status: 'Submitted',
    };
    saveProfile(
      { ...profile, applications: [...profile.applications, application] },
      'Your application has been saved in this browser.'
    );
  };

  const activeTournaments = marketplace.tournaments.filter(
    (tournament) => tournament.status === 'Registration Open' || tournament.status === 'Ongoing'
  );
  const completedTournaments = marketplace.tournaments.filter(
    (tournament) => tournament.status === 'Completed'
  );

  return (
    <section className="section-block player-workspace">
      <header className="player-header">
        <div className="player-heading">
          {profile.photoUrl ? (
            <img className="player-avatar" src={profile.photoUrl} alt="" />
          ) : (
            <div className="player-avatar-placeholder" aria-hidden="true">
              {(profile.name || user.name || 'P').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <span className="eyebrow">Player workspace</span>
            <h1>{profile.name || user.name}</h1>
            <p>{[profile.position, profile.sport, profile.location].filter(Boolean).join(' · ') || user.email}</p>
          </div>
        </div>
        <div className="player-header-actions">
          {profile.openToJoin && <span className="open-to-join-badge">Open to join a team</span>}
          <button type="button" className="secondary-button" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <nav className="player-nav" aria-label="Player workspace navigation">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? 'player-nav-button active' : 'player-nav-button'}
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
        <p className={noticeIsError ? 'player-notice error' : 'player-notice'} role="status">
          {notice}
        </p>
      )}

      {section === 'overview' && (
        <div className="player-content">
          <div className="player-summary-grid">
            <article className="player-summary-card">
              <strong>{profile.applications.length}</strong><span>Team applications</span>
            </article>
            <article className="player-summary-card">
              <strong>{marketplace.teams.length}</strong><span>Teams to explore</span>
            </article>
            <article className="player-summary-card">
              <strong>{activeTournaments.length}</strong><span>Active tournaments</span>
            </article>
            <article className="player-summary-card">
              <strong>{profile.openToJoin ? 'On' : 'Off'}</strong><span>Open to join</span>
            </article>
          </div>

          <div className="player-section-heading">
            <div>
              <h2>Teams looking for players</h2>
              <p>Browse team profiles and apply to their published open seats.</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setSection('teams')}>
              See all teams
            </button>
          </div>
          {marketplace.teams.length === 0 ? (
            <div className="empty-state">
              <h3>No teams listed yet</h3>
              <p>Teams created by organizations will appear here when they are available.</p>
            </div>
          ) : (
            <TeamCards teams={marketplace.teams.slice(0, 3)} applications={profile.applications} onApply={applyToOpening} />
          )}

          <div className="player-section-heading">
            <div>
              <h2>Current tournaments</h2>
              <p>See registration status, match information, and organization-maintained standings.</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => setSection('tournaments')}>
              View tournaments
            </button>
          </div>
          {activeTournaments.length === 0 ? (
            <div className="empty-state compact-player-empty">
              <h3>No current tournaments</h3>
              <p>Registration-open and ongoing tournaments will be shown here.</p>
            </div>
          ) : <TournamentCards tournaments={activeTournaments.slice(0, 3)} />}
        </div>
      )}

      {section === 'profile' && (
        <form className="player-profile-form" onSubmit={handleProfileSubmit}>
          <div>
            <h2>Player profile</h2>
            <p>Share the information teams need to assess your experience and playing history.</p>
          </div>
          <div className="player-profile-grid">
            <label><span>Full name</span><input name="name" defaultValue={profile.name} required /></label>
            <label className="player-wide-field">
              <span>Upload profile picture</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handlePhotoUpload}
                aria-label="Upload profile picture"
              />
              <small className="player-field-help">JPG, PNG, WebP, or GIF. Maximum file size: 2 MB.</small>
            </label>
            {photoError && <p className="player-photo-error" role="alert">{photoError}</p>}
            {photoDraft && (
              <div className="player-crop-panel player-wide-field">
                <div className="player-crop-viewport" aria-label="Profile picture crop preview">
                  <img
                    className="player-crop-image"
                    src={photoDraft}
                    alt="Crop preview"
                    onLoad={(event) => setPhotoDimensions({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })}
                    style={photoDimensions ? {
                      width: `${(photoDimensions.width / (Math.min(photoDimensions.width, photoDimensions.height) / photoZoom)) * 100}%`,
                      height: `${(photoDimensions.height / (Math.min(photoDimensions.width, photoDimensions.height) / photoZoom)) * 100}%`,
                      left: `-${(((photoDimensions.width - (Math.min(photoDimensions.width, photoDimensions.height) / photoZoom)) * (photoX / 100)) / (Math.min(photoDimensions.width, photoDimensions.height) / photoZoom)) * 100}%`,
                      top: `-${(((photoDimensions.height - (Math.min(photoDimensions.width, photoDimensions.height) / photoZoom)) * (photoY / 100)) / (Math.min(photoDimensions.width, photoDimensions.height) / photoZoom)) * 100}%`,
                    } : undefined}
                  />
                </div>
                <div className="player-crop-controls">
                  <label>
                    <span>Zoom</span>
                    <input
                      aria-label="Crop zoom"
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={photoZoom}
                      onChange={(event) => setPhotoZoom(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>Horizontal position</span>
                    <input
                      aria-label="Crop horizontal position"
                      type="range"
                      min="0"
                      max="100"
                      value={photoX}
                      onChange={(event) => setPhotoX(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    <span>Vertical position</span>
                    <input
                      aria-label="Crop vertical position"
                      type="range"
                      min="0"
                      max="100"
                      value={photoY}
                      onChange={(event) => setPhotoY(Number(event.target.value))}
                    />
                  </label>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={applyPhotoCrop}
                    disabled={!photoDimensions}
                  >
                    Apply crop
                  </button>
                </div>
              </div>
            )}
            <label><span>Location</span><input name="location" defaultValue={profile.location} /></label>
            <label><span>Sport</span><input name="sport" defaultValue={profile.sport} /></label>
            <label><span>Position or role</span><input name="position" defaultValue={profile.position} /></label>
            <label><span>Playing experience</span><input name="experience" defaultValue={profile.experience} placeholder="Years or level" /></label>
            <label className="player-wide-field"><span>Biography</span><textarea name="biography" rows="3" defaultValue={profile.biography} /></label>
            <label><span>Previous teams</span><textarea name="previousTeams" rows="3" defaultValue={profile.previousTeams} placeholder="One team per line" /></label>
            <label><span>Activities</span><textarea name="activities" rows="3" defaultValue={profile.activities} placeholder="One activity per line" /></label>
            <label><span>Achievements</span><textarea name="achievements" rows="3" defaultValue={profile.achievements} placeholder="One achievement per line" /></label>
            <label><span>Statistics</span><textarea name="statistics" rows="3" defaultValue={profile.statistics} /></label>
            <label className="player-open-toggle">
              <span>
                <strong>Open to join a team</strong>
                <small>Let teams know you are available and interested in being approached.</small>
              </span>
              <input name="openToJoin" type="checkbox" defaultChecked={profile.openToJoin} />
            </label>
          </div>
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save player profile'}
          </button>
        </form>
      )}

      {section === 'teams' && (
        <div className="player-content">
          <div className="player-section-heading">
            <div>
              <h2>Find teams</h2>
              <p>Search teams and apply for a position when they publish an open seat.</p>
            </div>
          </div>
          <label className="player-search">
            <span>Search teams by name, sport, location, or organization</span>
            <input
              type="search"
              value={teamSearch}
              onChange={(event) => setTeamSearch(event.target.value)}
              placeholder="Search teams"
            />
          </label>
          {filteredTeams.length === 0 ? (
            <div className="empty-state compact-player-empty">
              <h3>{marketplace.teams.length ? 'No matching teams' : 'No teams listed yet'}</h3>
              <p>{marketplace.teams.length ? 'Try a different search.' : 'Organization teams will show here when created.'}</p>
            </div>
          ) : (
            <TeamCards teams={filteredTeams} applications={profile.applications} onApply={applyToOpening} />
          )}
        </div>
      )}

      {section === 'tournaments' && (
        <div className="player-content">
          <div className="player-section-heading">
            <div>
              <h2>Current tournaments</h2>
              <p>Registration-open and ongoing events, including the standings provided by organizers.</p>
            </div>
          </div>
          {activeTournaments.length > 0 ? <TournamentCards tournaments={activeTournaments} /> : (
            <div className="empty-state compact-player-empty">
              <h3>No current tournaments</h3>
              <p>There are no registration-open or ongoing tournaments yet.</p>
            </div>
          )}
          <div className="player-section-heading completed-heading">
            <div><h2>Completed tournaments</h2><p>Past events and their final points tables.</p></div>
          </div>
          {completedTournaments.length > 0 ? <TournamentCards tournaments={completedTournaments} /> : (
            <div className="empty-state compact-player-empty">
              <h3>No completed tournaments</h3>
              <p>Completed events will appear here.</p>
            </div>
          )}
        </div>
      )}

      {section === 'applications' && (
        <div className="player-content">
          <div className="player-section-heading">
            <div><h2>Team applications</h2><p>Track the team opportunities you have applied to.</p></div>
          </div>
          {profile.applications.length === 0 ? (
            <div className="empty-state">
              <h3>No applications yet</h3>
              <p>Find a team with an open seat and apply to start tracking your applications here.</p>
              <button type="button" className="secondary-button" onClick={() => setSection('teams')}>Find teams</button>
            </div>
          ) : (
            <div className="player-application-list">
              {profile.applications.map((application) => (
                <article className="player-application-card" key={application.openingId}>
                  <div>
                    <h3>{application.position}</h3>
                    <p>{application.teamName} · {application.organizationName}</p>
                    <small>Applied {new Date(application.appliedAt).toLocaleDateString()}</small>
                  </div>
                  <span className="open-to-join-badge">{application.status}</span>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TeamCards({ teams, applications, onApply }) {
  return (
    <div className="player-card-grid">
      {teams.map((team) => (
        <article className="player-market-card" key={`${team.id}-${team.organizationName}`}>
          <span className="player-card-category">{team.sport || 'Sport not specified'}</span>
          <h3>{team.name}</h3>
          <p>{[team.location, team.organizationName].filter(Boolean).join(' · ')}</p>
          <div className="player-team-details">
            <span><strong>Coach</strong>{team.coach || 'Not provided'}</span>
            <span><strong>Manager</strong>{team.manager || 'Not provided'}</span>
            <span><strong>Sponsors</strong>{team.sponsors || 'Not provided'}</span>
          </div>
          <h4>Players and roles</h4>
          {team.players?.length ? (
            <ul className="player-roster">
              {team.players.map((player, index) => <li key={`${team.id}-${index}`}>{player}</li>)}
            </ul>
          ) : <p>No roster details provided.</p>}
          <div className="player-openings">
            <h4>Open positions</h4>
            {team.openings?.length ? team.openings.map((opening) => {
              const applied = applications.some((application) => application.openingId === opening.id);
              return (
                <div className="player-opening-row" key={opening.id}>
                  <div>
                    <strong>{opening.position}</strong>
                    <span>{opening.slots} seat{opening.slots === 1 ? '' : 's'} · {opening.deadline || 'No deadline'}</span>
                    {opening.requirements && <small>{opening.requirements}</small>}
                  </div>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={applied}
                    onClick={() => onApply(opening, team)}
                  >
                    {applied ? 'Applied' : 'Apply'}
                  </button>
                </div>
              );
            }) : <p>This team has not posted open seats.</p>}
          </div>
        </article>
      ))}
    </div>
  );
}

function TournamentCards({ tournaments }) {
  return (
    <div className="player-card-grid">
      {tournaments.map((tournament) => (
        <article className="player-market-card tournament-market-card" key={tournament.id}>
          <span className="player-card-category">{tournament.status}</span>
          <h3>{tournament.name}</h3>
          <p>{tournament.organizationName}</p>
          <dl className="tournament-details">
            <div><dt>Sport</dt><dd>{tournament.sport || 'Not specified'}</dd></div>
            <div><dt>Format</dt><dd>{tournament.format || 'Not specified'}</dd></div>
            <div><dt>Venue</dt><dd>{tournament.venue || 'Not specified'}</dd></div>
            <div><dt>Starts</dt><dd>{tournament.startDate || 'Not scheduled'}</dd></div>
            <div><dt>Registration deadline</dt><dd>{tournament.registrationDeadline || 'Not specified'}</dd></div>
            <div><dt>Team capacity</dt><dd>{tournament.capacity || 'Not specified'}</dd></div>
          </dl>
          {tournament.status === 'Registration Open' && (
            <p className="registration-hint">
              Contact the organizer to register: {tournament.organizationName}
            </p>
          )}
          <h4>Points table</h4>
          {tournament.standings?.length ? (
            <div className="player-table-wrap">
              <table className="player-points-table">
                <thead><tr><th>Team</th><th>Played</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr></thead>
                <tbody>
                  {tournament.standings.map((row) => (
                    <tr key={`${tournament.id}-${row.team}`}>
                      <td>{row.team}</td><td>{row.played}</td><td>{row.wins}</td>
                      <td>{row.draws}</td><td>{row.losses}</td><td>{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>No points table published yet.</p>}
        </article>
      ))}
    </div>
  );
}

export default PlayerDashboard;
