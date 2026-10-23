import { useState } from 'react';
import './TeamDashboard.css';

const TEAM_PREFIX = 'sport-x.team.';
const PLAYER_PREFIX = 'sport-x.profile.';
const ORGANIZATION_PREFIX = 'sport-x.organization.';
const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'profile', label: 'Team profile' },
  { id: 'squad', label: 'Squad' },
  { id: 'players', label: 'Find players' },
  { id: 'vacancies', label: 'Open seats' },
  { id: 'tournaments', label: 'Tournaments' },
];

function emptyTeam(user) {
  return {
    profile: {
      name: user.name || '',
      location: '',
      sport: '',
      description: '',
      coach: '',
      manager: '',
      sponsors: '',
      logoUrl: '',
    },
    squad: [],
    vacancies: [],
    tournamentRegistrations: [],
  };
}

function loadTeam(user) {
  const data = { ...emptyTeam(user), players: [], tournaments: [], registrations: [] };
  try {
    const saved = window.localStorage.getItem(`${TEAM_PREFIX}${user.email}`);
    if (saved) Object.assign(data, JSON.parse(saved));
    data.squad = Array.isArray(data.squad) ? data.squad : [];
    data.vacancies = Array.isArray(data.vacancies) ? data.vacancies : [];
    data.players = [];
    data.tournaments = [];
    data.registrations = [];
    data.tournamentRegistrations = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      if (key.startsWith(PLAYER_PREFIX)) {
        const email = key.slice(PLAYER_PREFIX.length);
        const player = JSON.parse(window.localStorage.getItem(key));
        if (player && player.openToJoin) {
          data.players.push({ ...player, email });
        }
      } else if (key.startsWith(ORGANIZATION_PREFIX)) {
        const organization = JSON.parse(window.localStorage.getItem(key));
        (organization?.tournaments || []).forEach((tournament) => {
          if (tournament.status === 'Registration Open' || tournament.status === 'Ongoing') {
            data.tournaments.push({
              ...tournament,
              organizationName: organization.profile?.name || 'Organization',
              organizationKey: key,
            });
          }
          (tournament.registrations || []).forEach((registration) => {
            if (registration.teamEmail === user.email) {
              data.registrations.push({
                ...registration,
                tournamentName: tournament.name,
                organizationName: organization.profile?.name || 'Organization',
                tournamentId: tournament.id,
              });
              data.tournamentRegistrations = [
                ...data.tournamentRegistrations.filter((item) => item.tournamentId !== tournament.id),
                {
                  tournamentId: tournament.id,
                  tournamentName: tournament.name,
                  organizationName: organization.profile?.name || 'Organization',
                  captain: registration.captain,
                  status: registration.status,
                },
              ];
            }
          });
        });
      }
    }
    return { data, error: '' };
  } catch (error) {
    return {
      data,
      error: error instanceof Error ? error.message : 'Could not load team information.',
    };
  }
}

function loadApplications() {
  const applications = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(PLAYER_PREFIX)) continue;
    const email = key.slice(PLAYER_PREFIX.length);
    const profile = JSON.parse(window.localStorage.getItem(key));
    (profile?.applications || []).forEach((application, applicationIndex) => {
      applications.push({ ...application, email, profile, applicationIndex });
    });
  }
  return applications;
}

function TeamDashboard({ user, onLogout }) {
  const [initial] = useState(() => loadTeam(user));
  const [applicationState] = useState(() => {
    try {
      return { items: loadApplications(), error: '' };
    } catch (error) {
      return {
        items: [],
        error: error instanceof Error ? error.message : 'Could not load applications.',
      };
    }
  });
  const [data, setData] = useState(initial.data);
  const [applications, setApplications] = useState(applicationState.items);
  const [section, setSection] = useState('overview');
  const [notice, setNotice] = useState(initial.error || applicationState.error);
  const [noticeIsError, setNoticeIsError] = useState(Boolean(initial.error || applicationState.error));
  const [isSaving, setIsSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initial.data.profile.logoUrl || '');
  const [logoDraft, setLogoDraft] = useState('');
  const [logoDimensions, setLogoDimensions] = useState(null);
  const [logoZoom, setLogoZoom] = useState(1);
  const [logoX, setLogoX] = useState(50);
  const [logoY, setLogoY] = useState(50);
  const [logoError, setLogoError] = useState('');
  const [memberPhotoDraft, setMemberPhotoDraft] = useState('');
  const [memberPhoto, setMemberPhoto] = useState('');
  const [memberPhotoDimensions, setMemberPhotoDimensions] = useState(null);
  const [memberPhotoZoom, setMemberPhotoZoom] = useState(1);
  const [memberPhotoX, setMemberPhotoX] = useState(50);
  const [memberPhotoY, setMemberPhotoY] = useState(50);
  const [memberPhotoError, setMemberPhotoError] = useState('');

  const persist = (nextData, message) => {
    setIsSaving(true);
    try {
      const persistedData = {
        profile: nextData.profile,
        squad: nextData.squad,
        vacancies: nextData.vacancies,
        tournamentRegistrations: nextData.tournamentRegistrations,
      };
      window.localStorage.setItem(`${TEAM_PREFIX}${user.email}`, JSON.stringify(persistedData));
      setData(nextData);
      setNotice(message);
      setNoticeIsError(false);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not save changes: ${error.message}`
          : 'Could not save changes. Please try again.'
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
      ['name', 'location', 'sport', 'description', 'coach', 'manager', 'sponsors', 'logoUrl'].map((field) => [
        field,
        field === 'logoUrl' ? logoUrl : String(form.get(field) || '').trim(),
      ])
    );
    persist({ ...data, profile }, 'Team profile saved.');
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files && event.target.files[0];
    setLogoError('');
    setLogoDraft('');
    setLogoDimensions(null);
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Choose an image file to upload.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Choose an image smaller than 2 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDraft(reader.result);
        setLogoZoom(1);
        setLogoX(50);
        setLogoY(50);
      } else {
        setLogoError('Could not read this image. Try another file.');
      }
    };
    reader.onerror = () => setLogoError('Could not read this image. Try another file.');
    reader.readAsDataURL(file);
  };

  const applyLogoCrop = () => {
    if (!logoDraft || !logoDimensions) {
      setLogoError('Wait for the image preview to load before applying a crop.');
      return;
    }
    const cropSize = Math.min(logoDimensions.width, logoDimensions.height) / logoZoom;
    const cropX = (logoDimensions.width - cropSize) * (logoX / 100);
    const cropY = (logoDimensions.height - cropSize) * (logoY / 100);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      if (!context) {
        setLogoError('Image cropping is not supported by this browser.');
        return;
      }
      context.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, 512, 512);
      try {
        setLogoUrl(canvas.toDataURL('image/jpeg', 0.86));
        setLogoDraft('');
        setLogoDimensions(null);
        setLogoError('');
        setNotice('Logo crop applied. Save the team profile to keep the new logo.');
        setNoticeIsError(false);
      } catch (error) {
        setLogoError(error instanceof Error ? `Could not prepare the cropped logo: ${error.message}` : 'Could not prepare the cropped logo.');
      }
    };
    image.onerror = () => setLogoError('Could not crop this image. Try another file.');
    image.src = logoDraft;
  };

  const handleSquadSubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const squad = String(form.get('squad') || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('|');
        const name = separator < 0 ? line : line.slice(0, separator).trim();
        const role = separator < 0 ? '' : line.slice(separator + 1).trim();
        const previous = data.squad.find((player) => player.name === name);
        return {
          ...previous,
          name,
          role,
        };
      });
    persist({ ...data, squad }, 'Squad saved.');
  };

  const handleMemberPhotoUpload = (event) => {
    const file = event.target.files && event.target.files[0];
    setMemberPhotoError('');
    setMemberPhotoDraft('');
    setMemberPhotoDimensions(null);
    setMemberPhoto('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMemberPhotoError('Choose an image file to upload.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMemberPhotoError('Choose an image smaller than 2 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMemberPhotoDraft(reader.result);
        setMemberPhotoZoom(1);
        setMemberPhotoX(50);
        setMemberPhotoY(50);
      } else {
        setMemberPhotoError('Could not read this image. Try another file.');
      }
    };
    reader.onerror = () => setMemberPhotoError('Could not read this image. Try another file.');
    reader.readAsDataURL(file);
  };

  const applyMemberPhotoCrop = () => {
    if (!memberPhotoDraft || !memberPhotoDimensions) {
      setMemberPhotoError('Wait for the image preview to load before applying a crop.');
      return;
    }
    const cropSize = Math.min(memberPhotoDimensions.width, memberPhotoDimensions.height) / memberPhotoZoom;
    const cropX = (memberPhotoDimensions.width - cropSize) * (memberPhotoX / 100);
    const cropY = (memberPhotoDimensions.height - cropSize) * (memberPhotoY / 100);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) {
        setMemberPhotoError('Image cropping is not supported by this browser.');
        return;
      }
      context.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, 256, 256);
      try {
        setMemberPhoto(canvas.toDataURL('image/jpeg', 0.82));
        setMemberPhotoDraft('');
        setMemberPhotoDimensions(null);
        setMemberPhotoError('');
        setNotice('Squad member photo crop applied.');
        setNoticeIsError(false);
      } catch (error) {
        setMemberPhotoError(
          error instanceof Error
            ? `Could not prepare the cropped photo: ${error.message}`
            : 'Could not prepare the cropped photo.'
        );
      }
    };
    image.onerror = () => setMemberPhotoError('Could not crop this image. Try another file.');
    image.src = memberPhotoDraft;
  };

  const handleAddSquadMember = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('memberName') || '').trim();
    const role = String(form.get('memberRole') || '').trim();
    if (!name) return;
    if (data.squad.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
      setMemberPhotoError('A squad member with this name already exists.');
      return;
    }
    persist({ ...data, squad: [...data.squad, { name, role, photoUrl: memberPhoto }] }, 'Squad member added.');
    setMemberPhoto('');
    setMemberPhotoDraft('');
    setMemberPhotoDimensions(null);
    event.currentTarget.reset();
  };

  const handleVacancySubmit = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vacancy = {
      id: `${Date.now()}`,
      position: String(form.get('position') || '').trim(),
      slots: Number(form.get('slots')),
      requirements: String(form.get('requirements') || '').trim(),
      deadline: String(form.get('deadline') || ''),
      status: 'Open',
    };
    persist({ ...data, vacancies: [...data.vacancies, vacancy] }, 'Open seats published.');
    event.currentTarget.reset();
  };

  const updateApplication = (application, status) => {
    try {
      const key = `${PLAYER_PREFIX}${application.email}`;
      const profile = JSON.parse(window.localStorage.getItem(key));
      const updated = (profile.applications || []).map((item, index) =>
        index === application.applicationIndex ? { ...item, status } : item
      );
      const updatedProfile = {
        ...profile,
        applications: updated,
        openToJoin: status === 'Accepted' ? false : profile.openToJoin,
      };
      window.localStorage.setItem(key, JSON.stringify(updatedProfile));
      setApplications(loadApplications());
      if (status === 'Accepted') {
        setData((current) => ({
          ...current,
          players: current.players.filter((player) => player.email !== application.email),
        }));
      }
      setNotice(`Application ${status.toLowerCase()}.`);
      setNoticeIsError(false);

      if (status === 'Accepted') {
        const name = profile.name || application.email;
        const alreadyOnSquad = data.squad.some((player) => player.email === application.email);
        if (!alreadyOnSquad) {
          persist(
            {
              ...data,
              squad: [...data.squad, {
                name,
                role: application.position,
                email: application.email,
                photoUrl: profile.photoUrl || '',
              }],
            },
            'Application accepted and player added to the squad.'
          );
        }
      }
    } catch (error) {
      setNotice(error instanceof Error ? `Could not update application: ${error.message}` : 'Could not update application.');
      setNoticeIsError(true);
    }
  };

  const approachPlayer = (player) => {
    try {
      const key = `${PLAYER_PREFIX}${player.email}`;
      const profile = JSON.parse(window.localStorage.getItem(key));
      const openingId = `team-invitation:${user.email}`;
      if ((profile.applications || []).some((application) => application.openingId === openingId)) {
        setNotice('You have already sent this player a team invitation.');
        setNoticeIsError(false);
        return;
      }
      const invitation = {
        openingId,
        position: player.position || 'Team invitation',
        teamName: data.profile.name || user.name,
        organizationName: 'Team invitation',
        appliedAt: new Date().toISOString(),
        status: 'Invited',
        applicationType: 'team-invitation',
      };
      window.localStorage.setItem(
        key,
        JSON.stringify({ ...profile, applications: [...(profile.applications || []), invitation] })
      );
      setNotice(`Team invitation sent to ${player.name || player.email}.`);
      setNoticeIsError(false);
    } catch (error) {
      setNotice(error instanceof Error ? `Could not send invitation: ${error.message}` : 'Could not send invitation.');
      setNoticeIsError(true);
    }
  };

  const registerForTournament = (tournament, captain) => {
    if (!captain) {
      setNotice('Add at least one squad member before registering for a tournament.');
      setNoticeIsError(true);
      return;
    }
    try {
      const current = JSON.parse(window.localStorage.getItem(tournament.organizationKey));
      const tournaments = (current.tournaments || []).map((item) => {
        if (item.id !== tournament.id) return item;
        const registrations = item.registrations || [];
        if (registrations.some((registration) => registration.teamEmail === user.email)) {
          throw new Error('Your team is already registered for this tournament.');
        }
        if (item.status !== 'Registration Open') {
          throw new Error('Registration is not open for this tournament.');
        }
        if (item.capacity && registrations.length >= item.capacity) {
          throw new Error('This tournament has reached its team capacity.');
        }
        return {
          ...item,
          registrations: [
            ...registrations,
            {
              teamEmail: user.email,
              teamName: data.profile.name || user.name,
              captain,
              status: 'Submitted',
              submittedAt: new Date().toISOString(),
            },
          ],
        };
      });
      window.localStorage.setItem(tournament.organizationKey, JSON.stringify({ ...current, tournaments }));
      setData((currentData) => ({
        ...currentData,
        registrations: [
          ...currentData.registrations,
          {
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            organizationName: tournament.organizationName,
            captain,
            status: 'Submitted',
          },
        ],
      }));
      setNotice('Team registration submitted to the organization.');
      setNoticeIsError(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not register for this tournament.');
      setNoticeIsError(true);
    }
  };

  const openApplications = applications.filter((application) =>
    (data.vacancies || []).some((vacancy) => vacancy.id === application.openingId)
  );
  const openToJoinPlayers = data.players.filter(
    (player) => !data.squad.some((member) => member.email && member.email === player.email)
  );
  const upcomingTournaments = data.tournaments.filter((tournament) => tournament.status === 'Registration Open');
  const ongoingTournaments = data.tournaments.filter((tournament) => tournament.status === 'Ongoing');

  return (
    <section className="section-block team-workspace">
      <header className="team-header">
        <div className="team-heading">
          {data.profile.logoUrl ? (
            <img className="team-logo" src={data.profile.logoUrl} alt="" />
          ) : (
            <div className="team-logo-placeholder" aria-hidden="true">
              {(data.profile.name || user.name || 'T').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <span className="eyebrow">Team workspace</span>
            <h1>{data.profile.name || user.name}</h1>
            <p>{[data.profile.sport, data.profile.location].filter(Boolean).join(' · ') || user.email}</p>
          </div>
        </div>
        <button type="button" className="secondary-button" onClick={onLogout}>Log out</button>
      </header>

      <nav className="team-nav" aria-label="Team workspace navigation">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? 'team-nav-button active' : 'team-nav-button'}
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
        <p className={noticeIsError ? 'team-notice error' : 'team-notice'} role="status">{notice}</p>
      )}

      {section === 'overview' && (
        <div className="team-content">
          <div className="team-summary-grid">
            <Summary value={data.squad.length} label="Squad members" />
            <Summary value={data.vacancies.filter((item) => item.status === 'Open').length} label="Open seats" />
            <Summary value={openApplications.length} label="New applications" />
            <Summary value={data.tournamentRegistrations.length} label="Tournament entries" />
          </div>
          <section>
            <div className="team-section-heading">
              <div><h2>Squad</h2><p>Players and their roles on your team.</p></div>
              <button type="button" className="secondary-button" onClick={() => setSection('squad')}>Manage squad</button>
            </div>
            {data.squad.length ? <SquadList squad={data.squad} /> : (
              <div className="empty-state compact-team-empty">
                <h3>No squad members added</h3>
                <p>Add your players and positions to complete the team profile.</p>
              </div>
            )}
          </section>
          <section>
            <div className="team-section-heading">
              <div><h2>Open applications</h2><p>Review players who applied to your open seats.</p></div>
              <button type="button" className="secondary-button" onClick={() => setSection('players')}>Review players</button>
            </div>
            {openApplications.length ? (
              <ApplicationList applications={openApplications} onUpdate={updateApplication} />
            ) : (
              <div className="empty-state compact-team-empty"><h3>No applications yet</h3><p>Applications to your published openings appear here.</p></div>
            )}
          </section>
          <section>
            <div className="team-section-heading">
              <div><h2>Tournaments</h2><p>Registration-open and ongoing competitions.</p></div>
              <button type="button" className="secondary-button" onClick={() => setSection('tournaments')}>Browse tournaments</button>
            </div>
            <TournamentList
              tournaments={[...upcomingTournaments, ...ongoingTournaments].slice(0, 3)}
              squad={data.squad}
              registrations={data.tournamentRegistrations}
              onRegister={registerForTournament}
            />
          </section>
        </div>
      )}

      {section === 'profile' && (
        <form className="team-form" onSubmit={handleProfileSubmit}>
          <div><h2>Team profile</h2><p>Manage your team’s public details and staff information.</p></div>
          <div className="team-form-grid">
            <label><span>Team name</span><input name="name" defaultValue={data.profile.name} required /></label>
            <label><span>Sport</span><input name="sport" defaultValue={data.profile.sport} /></label>
            <label><span>Location</span><input name="location" defaultValue={data.profile.location} /></label>
            <label>
              <span>Team logo image</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleLogoUpload}
                aria-label="Upload team logo"
              />
              <small className="team-field-help">JPG, PNG, WebP, or GIF. Maximum file size: 2 MB.</small>
            </label>
            <label>
              <span>Or use a logo URL</span>
              <input name="logoUrl" type="url" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://..." />
            </label>
            {logoError && <p className="team-photo-error" role="alert">{logoError}</p>}
            {logoDraft && (
              <div className="team-crop-panel team-wide-field">
                <div className="team-crop-viewport" aria-label="Team logo crop preview">
                  <img
                    className="team-crop-image"
                    src={logoDraft}
                    alt="Team logo crop preview"
                    onLoad={(event) => setLogoDimensions({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })}
                    style={logoDimensions ? {
                      width: `${(logoDimensions.width / (Math.min(logoDimensions.width, logoDimensions.height) / logoZoom)) * 100}%`,
                      height: `${(logoDimensions.height / (Math.min(logoDimensions.width, logoDimensions.height) / logoZoom)) * 100}%`,
                      left: `-${(((logoDimensions.width - (Math.min(logoDimensions.width, logoDimensions.height) / logoZoom)) * (logoX / 100)) / (Math.min(logoDimensions.width, logoDimensions.height) / logoZoom)) * 100}%`,
                      top: `-${(((logoDimensions.height - (Math.min(logoDimensions.width, logoDimensions.height) / logoZoom)) * (logoY / 100)) / (Math.min(logoDimensions.width, logoDimensions.height) / logoZoom)) * 100}%`,
                    } : undefined}
                  />
                </div>
                <div className="team-crop-controls">
                  <label><span>Zoom</span><input aria-label="Logo crop zoom" type="range" min="1" max="3" step="0.1" value={logoZoom} onChange={(event) => setLogoZoom(Number(event.target.value))} /></label>
                  <label><span>Horizontal position</span><input aria-label="Logo crop horizontal position" type="range" min="0" max="100" value={logoX} onChange={(event) => setLogoX(Number(event.target.value))} /></label>
                  <label><span>Vertical position</span><input aria-label="Logo crop vertical position" type="range" min="0" max="100" value={logoY} onChange={(event) => setLogoY(Number(event.target.value))} /></label>
                  <button type="button" className="secondary-button" onClick={applyLogoCrop} disabled={!logoDimensions}>Apply logo crop</button>
                </div>
              </div>
            )}
            <label><span>Coach</span><input name="coach" defaultValue={data.profile.coach} /></label>
            <label><span>Team manager</span><input name="manager" defaultValue={data.profile.manager} /></label>
            <label><span>Sponsors</span><input name="sponsors" defaultValue={data.profile.sponsors} /></label>
            <label className="team-wide-field"><span>Team description</span><textarea name="description" rows="4" defaultValue={data.profile.description} /></label>
          </div>
          <button type="submit" className="primary-button" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save team profile'}
          </button>
        </form>
      )}

      {section === 'squad' && (
        <div className="team-content">
          <div className="team-section-heading">
            <div><h2>Total squad: {data.squad.length}</h2><p>Maintain player names and positions or roles.</p></div>
          </div>
          {data.squad.length ? <SquadList squad={data.squad} /> : (
            <div className="empty-state compact-team-empty"><h3>No squad members</h3><p>Add each player on a separate line below.</p></div>
          )}
          <form className="team-form" onSubmit={handleAddSquadMember}>
            <h3>Add squad member</h3>
            <div className="team-form-grid">
              <label><span>Player name</span><input name="memberName" required /></label>
              <label><span>Position or role</span><input name="memberRole" /></label>
              <label className="team-wide-field">
                <span>Player photo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  aria-label="Upload squad member photo"
                  onChange={handleMemberPhotoUpload}
                />
                <small className="team-field-help">JPG, PNG, WebP, or GIF. Maximum file size: 2 MB.</small>
              </label>
              {memberPhotoError && <p className="team-photo-error" role="alert">{memberPhotoError}</p>}
              {memberPhotoDraft && (
                <div className="team-crop-panel team-wide-field">
                  <div className="team-member-crop-viewport" aria-label="Squad member photo crop preview">
                    <img
                      className="team-crop-image"
                      src={memberPhotoDraft}
                      alt="Squad member crop preview"
                      onLoad={(event) => setMemberPhotoDimensions({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      })}
                      style={memberPhotoDimensions ? {
                        width: `${(memberPhotoDimensions.width / (Math.min(memberPhotoDimensions.width, memberPhotoDimensions.height) / memberPhotoZoom)) * 100}%`,
                        height: `${(memberPhotoDimensions.height / (Math.min(memberPhotoDimensions.width, memberPhotoDimensions.height) / memberPhotoZoom)) * 100}%`,
                        left: `-${(((memberPhotoDimensions.width - (Math.min(memberPhotoDimensions.width, memberPhotoDimensions.height) / memberPhotoZoom)) * (memberPhotoX / 100)) / (Math.min(memberPhotoDimensions.width, memberPhotoDimensions.height) / memberPhotoZoom)) * 100}%`,
                        top: `-${(((memberPhotoDimensions.height - (Math.min(memberPhotoDimensions.width, memberPhotoDimensions.height) / memberPhotoZoom)) * (memberPhotoY / 100)) / (Math.min(memberPhotoDimensions.width, memberPhotoDimensions.height) / memberPhotoZoom)) * 100}%`,
                      } : undefined}
                    />
                  </div>
                  <div className="team-crop-controls">
                    <label><span>Zoom</span><input aria-label="Member photo crop zoom" type="range" min="1" max="3" step="0.1" value={memberPhotoZoom} onChange={(event) => setMemberPhotoZoom(Number(event.target.value))} /></label>
                    <label><span>Horizontal position</span><input aria-label="Member photo crop horizontal position" type="range" min="0" max="100" value={memberPhotoX} onChange={(event) => setMemberPhotoX(Number(event.target.value))} /></label>
                    <label><span>Vertical position</span><input aria-label="Member photo crop vertical position" type="range" min="0" max="100" value={memberPhotoY} onChange={(event) => setMemberPhotoY(Number(event.target.value))} /></label>
                    <button type="button" className="secondary-button" onClick={applyMemberPhotoCrop} disabled={!memberPhotoDimensions}>Apply photo crop</button>
                  </div>
                </div>
              )}
              {memberPhoto && (
                <div className="team-member-photo-ready team-wide-field">
                  <img src={memberPhoto} alt="Selected member" />
                  <span>Photo ready to save with this squad member.</span>
                </div>
              )}
            </div>
            <button type="submit" className="primary-button" disabled={isSaving}>Add squad member</button>
          </form>
          <form className="team-form" onSubmit={handleSquadSubmit}>
            <label>
              <span>Players and roles (one per line, format: name | role)</span>
              <textarea
                name="squad"
                rows="8"
                defaultValue={data.squad.map((player) => `${player.name}${player.role ? ` | ${player.role}` : ''}`).join('\n')}
                placeholder={'Player name | Position\nAnother player | Role'}
              />
            </label>
            <p className="team-field-help">Saving replaces the current squad list.</p>
            <button type="submit" className="primary-button" disabled={isSaving}>Save squad</button>
          </form>
        </div>
      )}

      {section === 'players' && (
        <div className="team-content">
          <div className="team-section-heading">
            <div><h2>Player applications and talent</h2><p>Review applicants and discover players who are open to joining.</p></div>
          </div>
          <h3>Applications to your vacancies</h3>
          {openApplications.length ? <ApplicationList applications={openApplications} onUpdate={updateApplication} /> : (
            <div className="empty-state compact-team-empty"><h3>No applications yet</h3><p>Publish an open seat so players can apply.</p></div>
          )}
          <h3 className="team-subheading">Players open to joining</h3>
          {openToJoinPlayers.length ? (
            <div className="team-player-grid">
              {openToJoinPlayers.map((player) => (
                <article className="team-player-card" key={player.email}>
                  {player.photoUrl && <img src={player.photoUrl} alt="" />}
                  <div>
                    <h3>{player.name || player.email}</h3>
                    <p>{[player.position, player.sport, player.location].filter(Boolean).join(' · ')}</p>
                    <p>{player.experience}</p>
                    {player.biography && <p>{player.biography}</p>}
                    <span className="team-open-badge">Open to join</span>
                    <button type="button" className="text-button team-approach-button" onClick={() => approachPlayer(player)}>
                      Approach player
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-team-empty"><h3>No players currently available</h3><p>Players who enable “Open to join a team” appear here.</p></div>
          )}
        </div>
      )}

      {section === 'vacancies' && (
        <div className="team-content">
          <div className="team-section-heading">
            <div><h2>Open seats</h2><p>Publish roles that players can find and apply to.</p></div>
          </div>
          {data.vacancies.length ? (
            <div className="team-vacancy-list">
              {data.vacancies.map((vacancy) => (
                <article className="team-vacancy-card" key={vacancy.id}>
                  <div><span className="team-open-badge">{vacancy.status}</span><h3>{vacancy.position}</h3>
                    <p>{vacancy.slots} seat{vacancy.slots === 1 ? '' : 's'} · Deadline {vacancy.deadline || 'not set'}</p>
                    {vacancy.requirements && <p>{vacancy.requirements}</p>}
                  </div>
                  <span>{applications.filter((item) => item.openingId === vacancy.id).length} applications</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-team-empty"><h3>No open seats posted</h3><p>Add a position below so interested players can apply.</p></div>
          )}
          <form className="team-form" onSubmit={handleVacancySubmit}>
            <h3>Publish an open seat</h3>
            <div className="team-form-grid">
              <label><span>Position or role</span><input name="position" required /></label>
              <label><span>Number of seats</span><input name="slots" type="number" min="1" defaultValue="1" required /></label>
              <label><span>Application deadline</span><input name="deadline" type="date" /></label>
              <label className="team-wide-field"><span>Requirements</span><textarea name="requirements" rows="3" /></label>
            </div>
            <button type="submit" className="primary-button" disabled={isSaving}>Publish opening</button>
          </form>
        </div>
      )}

      {section === 'tournaments' && (
        <div className="team-content">
          <div className="team-section-heading">
            <div><h2>Team tournaments</h2><p>Apply for open tournament registrations and view your entries.</p></div>
          </div>
          <h3>Registration open</h3>
          <TournamentList tournaments={upcomingTournaments} squad={data.squad} registrations={data.tournamentRegistrations} onRegister={registerForTournament} />
          <h3 className="team-subheading">Ongoing tournaments</h3>
          <TournamentList tournaments={ongoingTournaments} squad={data.squad} registrations={data.tournamentRegistrations} onRegister={registerForTournament} />
          <h3 className="team-subheading">My tournament registrations</h3>
          {data.tournamentRegistrations.length ? (
            <div className="team-registration-list">
              {data.tournamentRegistrations.map((registration) => (
                <article className="team-registration-card" key={registration.tournamentId}>
                  <div><h3>{registration.tournamentName}</h3><p>Captain: {registration.captain} · {registration.organizationName}</p></div>
                  <span className="team-open-badge">{registration.status}</span>
                </article>
              ))}
            </div>
          ) : <div className="empty-state compact-team-empty"><h3>No tournament registrations</h3><p>Register your team for an open tournament.</p></div>}
        </div>
      )}
    </section>
  );
}

function Summary({ value, label }) {
  return <article className="team-summary-card"><strong>{value}</strong><span>{label}</span></article>;
}

function SquadList({ squad }) {
  return (
    <div className="team-squad-list">
      {squad.map((player, index) => (
        <article className="team-squad-player" key={`${player.name}-${index}`}>
          {player.photoUrl ? (
            <img className="squad-photo" src={player.photoUrl} alt={`${player.name} profile`} />
          ) : (
            <span className="squad-initial">{player.name.slice(0, 1).toUpperCase()}</span>
          )}
          <span><strong>{player.name}</strong><small>{player.role || 'Role not specified'}</small></span>
        </article>
      ))}
    </div>
  );
}

function ApplicationList({ applications, onUpdate }) {
  return (
    <div className="team-applications">
      {applications.map((application) => (
        <article className="team-application-card" key={`${application.email}-${application.openingId}`}>
          <div>
            <h3>{application.profile.name || application.email}</h3>
            <p>{application.position} · {application.teamName}</p>
            <p>{[application.profile.sport, application.profile.location, application.profile.experience].filter(Boolean).join(' · ')}</p>
            {application.profile.biography && <p>{application.profile.biography}</p>}
          </div>
          {application.status === 'Submitted' || application.status === 'Applied' ? (
            <div className="team-application-actions">
              <button type="button" className="primary-button" onClick={() => onUpdate(application, 'Accepted')}>Accept</button>
              <button type="button" className="secondary-button" onClick={() => onUpdate(application, 'Rejected')}>Reject</button>
            </div>
          ) : <span className="team-open-badge">{application.status}</span>}
        </article>
      ))}
    </div>
  );
}

function TournamentList({ tournaments, squad, registrations, onRegister }) {
  const [captains, setCaptains] = useState({});

  if (!tournaments.length) {
    return <div className="empty-state compact-team-empty"><h3>No tournaments in this category</h3><p>Organization tournaments appear here when published.</p></div>;
  }

  return (
    <div className="team-tournament-grid">
      {tournaments.map((tournament) => {
        const registration = registrations.find((item) => item.tournamentId === tournament.id);
        return (
          <article className="team-tournament-card" key={`${tournament.organizationKey}-${tournament.id}`}>
            <span className="team-open-badge">{tournament.status}</span>
            <h3>{tournament.name}</h3>
            <p>{tournament.organizationName} · {tournament.sport}</p>
            <p>{tournament.venue || 'Venue not set'} · {tournament.startDate || 'Date not set'}</p>
            {tournament.standings?.length ? (
              <div className="team-points-wrap">
                <table className="team-points-table">
                  <thead><tr><th>Team</th><th>Pl</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr></thead>
                  <tbody>
                    {tournament.standings.map((row) => (
                      <tr key={`${tournament.id}-${row.team}`}>
                        <td>{row.team}</td><td>{row.played}</td><td>{row.wins}</td><td>{row.draws}</td><td>{row.losses}</td><td>{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p>No standings published yet.</p>}
            {tournament.status === 'Registration Open' && (
              registration ? (
                <p className="team-registration-status">{registration.status} · Captain: {registration.captain}</p>
              ) : squad.length ? (
                <label className="captain-select">
                  <span>Select tournament captain</span>
                  <select
                    value={captains[tournament.id] || ''}
                    onChange={(event) => setCaptains((current) => ({
                      ...current,
                      [tournament.id]: event.target.value,
                    }))}
                  >
                    <option value="" disabled>Choose a squad member to register</option>
                    {squad.map((player, index) => (
                      <option key={`${player.name}-${index}`} value={player.name}>{player.name}{player.role ? ` — ${player.role}` : ''}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!captains[tournament.id]}
                    onClick={() => onRegister(tournament, captains[tournament.id])}
                  >
                    Apply team
                  </button>
                </label>
              ) : <p>Add a squad member before registering for this tournament.</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default TeamDashboard;
