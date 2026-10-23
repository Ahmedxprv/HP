import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { TextEncoder } from 'util';

let originalImage;
let originalFileReader;

beforeEach(() => {
  window.localStorage.clear();
  originalImage = window.Image;
  originalFileReader = window.FileReader;
  global.TextEncoder = TextEncoder;
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: {
      getRandomValues: (bytes) => bytes.fill(1),
      subtle: {
        digest: jest.fn(async (algorithm, data) => {
          const bytes = new Uint8Array(data);
          const checksum = bytes.reduce((sum, byte) => sum + byte, 0);
          return new Uint8Array([checksum & 255]).buffer;
        }),
      },
    },
  });
});

afterEach(() => {
  window.Image = originalImage;
  window.FileReader = originalFileReader;
  jest.restoreAllMocks();
});

test('shows empty discovery states instead of sample records', () => {
  render(<App />);

  expect(screen.getByText(/find your next move in sport/i)).toBeInTheDocument();
  expect(screen.getByText(/no teams listed yet/i)).toBeInTheDocument();
  expect(screen.getByText(/no tournaments open for registration/i)).toBeInTheDocument();
  expect(screen.queryByText(/northbridge fc/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/12k\+/i)).not.toBeInTheDocument();
});

test('shows saved open tournaments and teams on home, without join prompts for signed-in users', () => {
  window.localStorage.setItem('sport-x.session', JSON.stringify({
    email: 'member@example.com',
    name: 'Alex Member',
    role: 'player',
  }));
  window.localStorage.setItem('sport-x.team.rovers@example.com', JSON.stringify({
    profile: { name: 'Rovers FC', sport: 'Football', location: 'York' },
  }));
  window.localStorage.setItem('sport-x.organization.organizer@example.com', JSON.stringify({
    profile: { name: 'City Sports Association' },
    teams: [{ id: 'bears', name: 'City Bears', sport: 'Rugby', location: 'Leeds' }],
    tournaments: [
      {
        id: 'open-cup',
        name: 'Open Cup',
        sport: 'Football',
        format: 'Round robin',
        venue: 'City Ground',
        startDate: '2026-11-10',
        registrationDeadline: '2026-11-01',
        capacity: 8,
        status: 'Registration Open',
        registrations: [
          { teamEmail: 'rovers@example.com', teamName: 'Rovers FC', status: 'Submitted' },
          { teamEmail: 'city@example.com', teamName: 'City United', status: 'Accepted' },
        ],
      },
      {
        id: 'draft-cup',
        name: 'Draft Cup',
        status: 'Draft',
      },
    ],
  }));

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /sport x sports talent platform/i }));

  expect(screen.getByRole('heading', { name: /open cup/i })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /draft cup/i })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /rovers fc/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /city bears/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /view tournament details/i }));
  const tournamentDialog = screen.getByRole('dialog', { name: /open cup/i });
  expect(within(tournamentDialog).getByText('2026-11-01')).toBeInTheDocument();
  expect(within(tournamentDialog).getByText('Round robin')).toBeInTheDocument();
  expect(within(tournamentDialog).getByText('2 / 8')).toBeInTheDocument();
  expect(within(tournamentDialog).getByRole('button', { name: /team accounts only/i })).toBeDisabled();
  fireEvent.click(within(tournamentDialog).getByRole('button', { name: /close tournament details/i }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /view dashboard/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /join|create a player account|set up an organization/i })).not.toBeInTheDocument();
});

test('lets a team account open the selected tournament registration form from home', () => {
  window.localStorage.setItem('sport-x.session', JSON.stringify({
    email: 'rovers@example.com',
    name: 'Rovers FC',
    role: 'team',
  }));
  window.localStorage.setItem('sport-x.team.rovers@example.com', JSON.stringify({
    profile: { name: 'Rovers FC', sport: 'Football' },
    squad: [{ name: 'Jamie Striker', role: 'Forward' }],
    vacancies: [],
  }));
  window.localStorage.setItem('sport-x.organization.organizer@example.com', JSON.stringify({
    profile: { name: 'City Sports Association' },
    tournaments: [{
      id: 'open-cup',
      name: 'Open Cup',
      sport: 'Football',
      format: 'Round robin',
      venue: 'City Ground',
      startDate: '2026-11-10',
      registrationDeadline: '2026-11-01',
      capacity: 8,
      status: 'Registration Open',
      registrations: [],
      standings: [],
    }],
    teams: [],
    openings: [],
  }));

  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /sport x sports talent platform/i }));
  fireEvent.click(screen.getByRole('button', { name: /view tournament details/i }));

  const tournamentDialog = screen.getByRole('dialog', { name: /open cup/i });
  expect(within(tournamentDialog).getByRole('button', { name: /register your team/i })).toBeEnabled();
  fireEvent.click(within(tournamentDialog).getByRole('button', { name: /register your team/i }));

  expect(screen.getByRole('heading', { name: /team tournaments/i })).toBeInTheDocument();
  const captainSelect = screen.getByLabelText(/select tournament captain/i);
  expect(captainSelect).toHaveFocus();
  expect(within(captainSelect).getByRole('option', { name: /jamie striker/i })).toBeInTheDocument();
});

test('registers a user and allows that user to log in again', async () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /join now/i }));
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Casey Player' } });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'casey@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'securepass123' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'securepass123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  expect(await screen.findByRole('heading', { name: /casey player/i })).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('button', { name: /log out/i })[0]);
  fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'casey@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'securepass123' },
  });
  fireEvent.submit(screen.getByLabelText(/email address/i).closest('form'));

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /casey player/i })).toBeInTheDocument();
  });
});

test('opens the organization workspace for an organization account', async () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /join now/i }));
  fireEvent.change(screen.getByLabelText(/your name/i), {
    target: { value: 'City Sports Association' },
  });
  fireEvent.change(screen.getByLabelText(/account type/i), {
    target: { value: 'organization' },
  });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'organizer@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'securepass123' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'securepass123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  expect(await screen.findByRole('heading', { name: /city sports association/i })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: /organization workspace navigation/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /organization profile/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /teams & rosters/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /join as player/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /join as team/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /^tournaments$/i }));
  fireEvent.change(screen.getByLabelText(/tournament name/i), {
    target: { value: 'Community Cup' },
  });
  fireEvent.change(screen.getByLabelText(/^sport$/i), {
    target: { value: 'Football' },
  });
  fireEvent.click(screen.getByRole('button', { name: /create tournament/i }));

  expect(await screen.findByRole('button', { name: /community cup/i })).toBeInTheDocument();
  expect(screen.getByText(/tournament created/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /community cup/i }));
  fireEvent.change(screen.getByLabelText(/team name/i), {
    target: { value: 'Northside FC' },
  });
  fireEvent.click(screen.getByRole('button', { name: /add standings row/i }));
  expect(await screen.findByText('Northside FC')).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('button', { name: /log out/i })[0]);
  fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'organizer@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'securepass123' },
  });
  fireEvent.submit(screen.getByLabelText(/email address/i).closest('form'));

  expect(await screen.findByRole('heading', { name: /city sports association/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^tournaments$/i }));
  fireEvent.click(screen.getByRole('button', { name: /community cup/i }));
  expect(screen.getByText('Northside FC')).toBeInTheDocument();
});

test('shows a player workspace with profile, team applications, and tournament standings', async () => {
  window.localStorage.setItem('sport-x.organization.organizer@example.com', JSON.stringify({
    profile: { name: 'City Sports Association', contactEmail: 'organizer@example.com' },
    teams: [{
      id: 'team-1',
      name: 'Northside FC',
      sport: 'Football',
      location: 'Manchester',
      coach: 'Coach Lee',
      manager: 'Manager Kim',
      sponsors: 'Local Sports',
      players: ['Morgan — Goalkeeper'],
    }],
    openings: [{
      id: 'opening-1',
      teamId: 'team-1',
      position: 'Striker',
      slots: 2,
      deadline: '2026-12-01',
      requirements: 'Club experience preferred',
    }],
    tournaments: [{
      id: 'tournament-1',
      name: 'City Cup',
      sport: 'Football',
      format: 'Round robin',
      venue: 'Central Ground',
      startDate: '2026-11-01',
      registrationDeadline: '2026-10-25',
      capacity: 8,
      status: 'Ongoing',
      registrations: [],
      standings: [{ team: 'Northside FC', played: 3, wins: 2, draws: 1, losses: 0, points: 7 }],
    }],
  }));
  window.localStorage.setItem('sport-x.team.rovers@example.com', JSON.stringify({
    profile: {
      name: 'Westfield Rovers',
      sport: 'Football',
      location: 'Leeds',
      coach: 'Sam Coach',
      manager: 'Team Manager',
      sponsors: 'Rovers Club',
    },
    squad: [{ name: 'Jordan Keeper', role: 'Goalkeeper' }],
    vacancies: [{
      id: 'team-opening-1',
      position: 'Winger',
      slots: 1,
      deadline: '2026-12-15',
      requirements: 'Experienced player',
      status: 'Open',
    }],
  }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /join now/i }));
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Taylor Player' } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'player@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'securepass123' } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'securepass123' } });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  expect(await screen.findByRole('heading', { name: /taylor player/i })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: /player workspace navigation/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /join as player/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /join as team/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /find teams/i }));
  expect(screen.getByRole('heading', { name: /northside fc/i })).toBeInTheDocument();
  const westfieldCard = screen.getByRole('heading', { name: /westfield rovers/i }).closest('article');
  expect(westfieldCard).toBeInTheDocument();
  fireEvent.click(within(westfieldCard).getByRole('button', { name: /^apply$/i }));
  expect(await screen.findByText(/your application has been saved/i)).toBeInTheDocument();
  expect(window.localStorage.getItem('sport-x.profile.player@example.com')).toContain('team-opening-1');

  fireEvent.click(screen.getByRole('button', { name: /tournaments/i }));
  expect(screen.getByRole('heading', { name: /city cup/i })).toBeInTheDocument();
  expect(screen.getByText('Northside FC')).toBeInTheDocument();
  expect(screen.getByText('7')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /my profile/i }));
  fireEvent.change(screen.getByLabelText(/playing experience/i), { target: { value: '5 years' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /open to join a team/i }));
  const drawImage = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage });
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,cropped');
  window.Image = class MockImage {
    set src(value) {
      this.onload();
    }
  };
  fireEvent.change(screen.getByLabelText(/upload profile picture/i), {
    target: { files: [new File(['photo'], 'player.png', { type: 'image/png' })] },
  });
  const cropPreview = await screen.findByAltText(/crop preview/i);
  Object.defineProperty(cropPreview, 'naturalWidth', { configurable: true, value: 600 });
  Object.defineProperty(cropPreview, 'naturalHeight', { configurable: true, value: 400 });
  fireEvent.load(cropPreview);
  fireEvent.change(screen.getByLabelText(/crop zoom/i), { target: { value: '1.5' } });
  fireEvent.click(screen.getByRole('button', { name: /apply crop/i }));
  expect(drawImage).toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /save player profile/i }));
  expect(await screen.findByText(/your player profile has been saved/i)).toBeInTheDocument();
  expect(window.localStorage.getItem('sport-x.profile.player@example.com')).toContain('5 years');
  expect(window.localStorage.getItem('sport-x.profile.player@example.com')).toContain('data:image/jpeg;base64,cropped');
  expect(screen.getAllByText(/^open to join a team$/i).length).toBeGreaterThan(0);
});

test('shows a team workspace with profile, roster, vacancies, and tournament captain registration', async () => {
  window.localStorage.setItem('sport-x.organization.organizer@example.com', JSON.stringify({
    profile: { name: 'City Sports Association' },
    teams: [],
    openings: [],
    tournaments: [{
      id: 'open-cup',
      name: 'Open Cup',
      sport: 'Football',
      format: 'Round robin',
      venue: 'City Ground',
      startDate: '2026-11-10',
      registrationDeadline: '2026-11-01',
      capacity: 8,
      status: 'Registration Open',
      registrations: [],
      standings: [],
    }],
  }));
  window.localStorage.setItem('sport-x.team.rovers@example.com', JSON.stringify({
    profile: {
      name: 'Rovers',
      location: '',
      sport: '',
      description: '',
      coach: '',
      manager: '',
      sponsors: '',
      logoUrl: '',
    },
    squad: [],
    vacancies: [{
      id: 'open-role-1',
      position: 'Midfielder',
      slots: 1,
      deadline: '',
      requirements: '',
      status: 'Open',
    }],
    tournamentRegistrations: [],
  }));
  window.localStorage.setItem('sport-x.profile.player@example.com', JSON.stringify({
    name: 'Avery Player',
    location: 'York',
    sport: 'Football',
    position: 'Midfielder',
    experience: '3 years',
    openToJoin: true,
    applications: [{
      openingId: 'open-role-1',
      position: 'Midfielder',
      teamName: 'Rovers',
      organizationName: 'Rovers',
      appliedAt: '2026-10-20T00:00:00.000Z',
      status: 'Submitted',
    }],
  }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /join now/i }));
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Rovers' } });
  fireEvent.change(screen.getByLabelText(/account type/i), { target: { value: 'team' } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'rovers@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'securepass123' } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'securepass123' } });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  expect(await screen.findByRole('heading', { name: /rovers/i })).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: /team workspace navigation/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /join as player/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /join as team/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /team profile/i }));
  fireEvent.change(screen.getByLabelText(/team name/i), { target: { value: 'Rovers FC' } });
  fireEvent.change(screen.getByLabelText(/^sport$/i), { target: { value: 'Football' } });
  fireEvent.change(screen.getByLabelText(/coach/i), { target: { value: 'Alex Coach' } });
  const drawLogo = jest.fn();
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: drawLogo });
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,team-logo');
  window.Image = class MockImage {
    set src(value) {
      this.onload();
    }
  };
  fireEvent.change(screen.getByLabelText(/upload team logo/i), {
    target: { files: [new File(['logo'], 'team.png', { type: 'image/png' })] },
  });
  const logoPreview = await screen.findByAltText(/team logo crop preview/i);
  Object.defineProperty(logoPreview, 'naturalWidth', { configurable: true, value: 500 });
  Object.defineProperty(logoPreview, 'naturalHeight', { configurable: true, value: 400 });
  fireEvent.load(logoPreview);
  fireEvent.change(screen.getByLabelText(/logo crop zoom/i), { target: { value: '1.3' } });
  fireEvent.click(screen.getByRole('button', { name: /apply logo crop/i }));
  expect(drawLogo).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /save team profile/i }));
  expect(await screen.findByText(/team profile saved/i)).toBeInTheDocument();
  expect(window.localStorage.getItem('sport-x.team.rovers@example.com')).toContain('data:image/jpeg;base64,team-logo');

  fireEvent.click(screen.getByRole('button', { name: /^squad$/i }));
  window.FileReader = class MockFileReader {
    readAsDataURL() {
      this.result = 'data:image/png;base64,member-source';
      this.onload();
    }
  };
  fireEvent.change(screen.getByLabelText(/upload squad member photo/i), {
    target: { files: [new File(['member'], 'member.png', { type: 'image/png' })] },
  });
  const memberPhotoPreview = await screen.findByAltText(/squad member crop preview/i);
  Object.defineProperty(memberPhotoPreview, 'naturalWidth', { configurable: true, value: 400 });
  Object.defineProperty(memberPhotoPreview, 'naturalHeight', { configurable: true, value: 300 });
  fireEvent.load(memberPhotoPreview);
  fireEvent.click(screen.getByRole('button', { name: /apply photo crop/i }));
  fireEvent.change(screen.getByLabelText(/player name/i), { target: { value: 'Jamie Striker' } });
  fireEvent.change(screen.getByLabelText(/position or role/i), { target: { value: 'Forward' } });
  fireEvent.click(screen.getByRole('button', { name: /add squad member/i }));
  expect(await screen.findByText(/squad member added/i)).toBeInTheDocument();
  expect(screen.getByAltText(/jamie striker profile/i)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/players and roles/i), {
    target: { value: 'Jamie Striker | Forward' },
  });
  fireEvent.click(screen.getByRole('button', { name: /save squad/i }));
  expect(await screen.findByText(/squad saved/i)).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem('sport-x.team.rovers@example.com')).squad).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: 'Jamie Striker',
        role: 'Forward',
        photoUrl: 'data:image/jpeg;base64,team-logo',
      }),
    ])
  );

  fireEvent.click(screen.getByRole('button', { name: /open seats/i }));
  fireEvent.change(screen.getByLabelText(/position or role/i), { target: { value: 'Goalkeeper' } });
  fireEvent.click(screen.getByRole('button', { name: /publish opening/i }));
  expect(await screen.findByText(/open seats published/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /find players/i }));
  expect(screen.getAllByRole('heading', { name: /avery player/i }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button', { name: /approach player/i }));
  expect(await screen.findByText(/team invitation sent to avery player/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));
  expect(await screen.findByText(/application accepted and player added to the squad/i)).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem('sport-x.profile.player@example.com')).openToJoin).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: /^tournaments$/i }));
  fireEvent.change(screen.getByLabelText(/select tournament captain/i), {
    target: { value: 'Jamie Striker' },
  });
  fireEvent.click(screen.getByRole('button', { name: /apply team/i }));
  expect(await screen.findByText(/team registration submitted/i)).toBeInTheDocument();

  const organization = JSON.parse(window.localStorage.getItem('sport-x.organization.organizer@example.com'));
  expect(organization.tournaments[0].registrations[0]).toMatchObject({
    teamName: 'Rovers FC',
    captain: 'Jamie Striker',
    status: 'Submitted',
  });
  expect(JSON.parse(window.localStorage.getItem('sport-x.team.rovers@example.com')).squad).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'Jamie Striker', role: 'Forward' }),
      expect.objectContaining({ name: 'Avery Player', role: 'Midfielder' }),
    ])
  );

  fireEvent.click(screen.getAllByRole('button', { name: /log out/i })[0]);
  fireEvent.click(screen.getByRole('button', { name: /join now/i }));
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'City Sports Association' } });
  fireEvent.change(screen.getByLabelText(/account type/i), { target: { value: 'organization' } });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'organizer@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'securepass123' } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'securepass123' } });
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));
  expect(await screen.findByRole('heading', { name: /city sports association/i })).toBeInTheDocument();
  expect(screen.getByText(/pending team registrations/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /rovers fc/i })).toBeInTheDocument();
  expect(screen.getByText(/open cup · captain: jamie striker/i)).toBeInTheDocument();

  const updatedOrganization = {
    ...JSON.parse(window.localStorage.getItem('sport-x.organization.organizer@example.com')),
  };
  updatedOrganization.tournaments[0].registrations.push({
    teamEmail: 'bears@example.com',
    teamName: 'City Bears',
    captain: 'Taylor Captain',
    status: 'Submitted',
    submittedAt: '2026-10-23T00:00:00.000Z',
  });
  const organizationStorageKey = 'sport-x.organization.organizer@example.com';
  window.localStorage.setItem(organizationStorageKey, JSON.stringify(updatedOrganization));
  const storageEvent = new Event('storage');
  Object.defineProperty(storageEvent, 'key', { value: organizationStorageKey });
  act(() => window.dispatchEvent(storageEvent));
  expect(await screen.findByText(/new team tournament registration received/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /city bears/i })).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('button', { name: /review open cup registration/i })[0]);
  fireEvent.click(screen.getByRole('button', { name: /open cup/i }));
  fireEvent.click(screen.getAllByRole('button', { name: /approve/i })[0]);
  expect(await screen.findByText(/team registration accepted/i)).toBeInTheDocument();

  const approvedOrganization = JSON.parse(window.localStorage.getItem('sport-x.organization.organizer@example.com'));
  expect(approvedOrganization.tournaments[0].registrations[0].status).toBe('Accepted');

  fireEvent.click(screen.getAllByRole('button', { name: /log out/i })[0]);
  fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'rovers@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'securepass123' } });
  fireEvent.submit(screen.getByLabelText(/email address/i).closest('form'));
  expect(await screen.findByRole('heading', { name: /rovers fc/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^tournaments$/i }));
  expect(screen.getByText(/accepted · captain: jamie striker/i)).toBeInTheDocument();
});
