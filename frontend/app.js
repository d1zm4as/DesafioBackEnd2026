const qs = (id) => document.getElementById(id);

const dom = {
  baseUrl: qs('baseUrl'),
  jwtToken: qs('jwtToken'),
  tokenHint: qs('tokenHint'),
  statusBar: qs('statusBar'),
  statusText: qs('statusText'),
  apiLog: qs('apiLog'),
  posterTitle: qs('posterTitle'),
  sessionHint: qs('sessionHint'),
  selectedSession: qs('selectedSession'),
  selectedSeat: qs('selectedSeat'),
  movies: qs('movies'),
  sessions: qs('sessions'),
  seats: qs('seats'),
  tickets: qs('tickets'),
  ticketFilter: qs('ticketFilter'),
};

const state = {
  baseUrl: localStorage.getItem('baseUrl') || window.location.origin,
  token: localStorage.getItem('jwtToken') || '',
  selectedMovie: null,
  selectedSession: null,
  selectedSeat: null,
  seats: [],
};

const sessionStatusCache = new Map();

const normalizeBaseUrl = (value) => value.replace(/\/+$/, '');

const setStatus = (message, type = 'info') => {
  dom.statusText.textContent = message;
  dom.statusBar.classList.toggle('error', type === 'error');
};

const logApi = (payload) => {
  dom.apiLog.textContent = JSON.stringify(payload, null, 2);
};

const updateTokenHint = () => {
  if (state.token) {
    dom.tokenHint.textContent = `Autenticado (token ${state.token.slice(0, 8)}...)`;
  } else {
    dom.tokenHint.textContent = 'Nao autenticado';
  }
};

const saveConfig = () => {
  state.baseUrl = normalizeBaseUrl(dom.baseUrl.value.trim() || window.location.origin);
  state.token = dom.jwtToken.value.trim();
  localStorage.setItem('baseUrl', state.baseUrl);
  localStorage.setItem('jwtToken', state.token);
  updateTokenHint();
};

const clearConfig = () => {
  localStorage.removeItem('baseUrl');
  localStorage.removeItem('jwtToken');
  state.baseUrl = window.location.origin;
  state.token = '';
  dom.baseUrl.value = '';
  dom.jwtToken.value = '';
  updateTokenHint();
};

const api = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const useAuth = options.auth !== false;
  if (useAuth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  try {
    const response = await fetch(`${state.baseUrl}${path}`, {
      ...options,
      headers,
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: { error: error.message || 'Erro de rede' } };
  }
};

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('pt-BR');
};

const formatDayLabel = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(parsed);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / 86400000);
  const shortDate = target.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
  if (diffDays === 0) return `Hoje, ${shortDate}`;
  if (diffDays === 1) return `Amanhã, ${shortDate}`;
  return parsed.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  });
};

const getSessionStatus = (seats, session) => {
  const total = session.total_rows * session.seats_per_row;
  const available = seats.filter((seat) => seat.status === 'available').length;
  const ratio = total ? available / total : 0;
  let label = 'Disponivel';
  let tone = 'ok';
  if (available === 0) {
    label = 'Lotado';
    tone = 'full';
  } else if (ratio <= 0.2) {
    label = 'Poucas vagas';
    tone = 'warn';
  }
  return { label, tone, available, total };
};

const hydrateSessionStatus = async (session, statusEl, countEl) => {
  if (sessionStatusCache.has(session.id)) {
    const cached = sessionStatusCache.get(session.id);
    statusEl.textContent = cached.label;
    statusEl.className = `session-status ${cached.tone}`;
    countEl.textContent = `${cached.available}/${cached.total} disponiveis`;
    return;
  }
  statusEl.textContent = 'Carregando...';
  const result = await api(`/api/sessions/${session.id}/seats/`, { auth: false });
  if (!result.ok) {
    statusEl.textContent = 'Indisponivel';
    statusEl.className = 'session-status neutral';
    countEl.textContent = '-';
    return;
  }
  const status = getSessionStatus(result.data || [], session);
  sessionStatusCache.set(session.id, status);
  statusEl.textContent = status.label;
  statusEl.className = `session-status ${status.tone}`;
  countEl.textContent = `${status.available}/${status.total} disponiveis`;
};

const renderStars = (value) => {
  const numeric = Number(value);
  const count = Number.isFinite(numeric) ? Math.min(5, Math.max(1, Math.round(numeric))) : 0;
  const filled = '&#9733;'.repeat(count);
  const empty = '&#9734;'.repeat(5 - count);
  return `<span class="stars" aria-label="rating ${count}/5">${filled}${empty}</span>`;
};

const resetUi = () => {
  state.selectedMovie = null;
  state.selectedSession = null;
  state.selectedSeat = null;
  state.seats = [];
  dom.movies.innerHTML = '';
  dom.sessions.innerHTML = '';
  dom.seats.innerHTML = '';
  dom.tickets.innerHTML = '';
  dom.posterTitle.textContent = 'Selecione um filme';
  dom.sessionHint.textContent = 'Nenhum filme selecionado.';
  dom.selectedSession.textContent = '-';
  dom.selectedSeat.textContent = '-';
  dom.apiLog.textContent = 'Nenhuma chamada realizada.';
  setStatus('Estado limpo');
};

const renderMovies = (movies) => {
  dom.movies.innerHTML = '';
  if (!movies || movies.length === 0) {
    dom.movies.innerHTML = '<p class="hint">Nenhum filme encontrado.</p>';
    return;
  }
  movies.forEach((movie) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${movie.title}</strong>
      <p>${movie.description || 'Sem descricao.'}</p>
      <p>Duraçao: ${movie.duration_minutes} min</p>
      <div class="rating">Avaliacao: ${renderStars(movie.rating)}</div>
      <div class="card-actions">
        <button class="btn" data-movie-id="${movie.id}">Ver sessoes</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', () => {
      state.selectedMovie = movie;
      dom.posterTitle.textContent = movie.title;
      dom.sessionHint.textContent = `Filme selecionado: ${movie.title}`;
      loadSessions();
    });
    dom.movies.appendChild(card);
  });
};

const renderSessions = (sessions) => {
  dom.sessions.innerHTML = '';
  if (!sessions || sessions.length === 0) {
    dom.sessions.innerHTML = '<p class="hint">Nenhuma sessao encontrada.</p>';
    return;
  }
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
  const groups = new Map();
  sorted.forEach((session) => {
    const key = new Date(session.starts_at).toDateString();
    if (!groups.has(key)) {
      groups.set(key, { label: formatDayLabel(session.starts_at), items: [] });
    }
    groups.get(key).items.push(session);
  });

  groups.forEach((group) => {
    const block = document.createElement('div');
    block.className = 'session-group';
    block.innerHTML = `<div class="session-group-header">${group.label}</div>`;
    const list = document.createElement('div');
    list.className = 'card-list';

    group.items.forEach((session) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="session-head">
          <strong>Sessao ${session.id}</strong>
          <span class="session-status neutral">Status</span>
        </div>
        <p>${formatDate(session.starts_at)}</p>
        <p>Sala: ${session.auditorium}</p>
        <p class="session-count">-</p>
        <div class="card-actions">
          <button class="btn" data-session-id="${session.id}">Abrir assentos</button>
        </div>
      `;
      card.querySelector('button').addEventListener('click', () => {
        state.selectedSession = session;
        dom.selectedSession.textContent = `#${session.id} - ${formatDate(session.starts_at)}`;
        state.selectedSeat = null;
        dom.selectedSeat.textContent = '-';
        loadSeats();
      });
      list.appendChild(card);
      const statusEl = card.querySelector('.session-status');
      const countEl = card.querySelector('.session-count');
      hydrateSessionStatus(session, statusEl, countEl);
    });

    block.appendChild(list);
    dom.sessions.appendChild(block);
  });
};

const renderSeats = (seats) => {
  dom.seats.innerHTML = '';
  if (!seats || seats.length === 0) {
    dom.seats.innerHTML = '<p class="hint">Sem assentos disponiveis.</p>';
    return;
  }

  const rows = {};
  seats.forEach((seat) => {
    if (!rows[seat.row]) rows[seat.row] = [];
    rows[seat.row].push(seat);
  });

  Object.keys(rows)
    .map((row) => Number(row))
    .sort((a, b) => a - b)
    .forEach((row) => {
      const rowWrap = document.createElement('div');
      rowWrap.className = 'seat-row';
      const label = document.createElement('span');
      label.className = 'row-label';
      label.textContent = `Fila ${row}`;
      rowWrap.appendChild(label);
      rows[row]
        .sort((a, b) => a.number - b.number)
        .forEach((seat) => {
          const btn = document.createElement('button');
          const isSelected = state.selectedSeat && state.selectedSeat.id === seat.id;
          btn.className = `seat ${seat.status}${isSelected ? ' selected' : ''}`;
          btn.textContent = `N${seat.number}`;
          btn.disabled = seat.status !== 'available';
          btn.addEventListener('click', () => {
            state.selectedSeat = seat;
            dom.selectedSeat.textContent = `R${seat.row} N${seat.number} (#${seat.id})`;
            renderSeats(state.seats);
          });
          rowWrap.appendChild(btn);
        });
      dom.seats.appendChild(rowWrap);
    });
};

const renderTickets = (tickets) => {
  dom.tickets.innerHTML = '';
  if (!tickets || tickets.length === 0) {
    dom.tickets.innerHTML = '<p class="hint">Nenhum ingresso encontrado.</p>';
    return;
  }
  tickets.forEach((ticket) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${ticket.session.movie_title}</strong>
      <p>Ingresso: ${ticket.code}</p>
      <p>${formatDate(ticket.session.starts_at)}</p>
      <p>Sala ${ticket.session.auditorium} - R${ticket.seat.row} N${ticket.seat.number}</p>
    `;
    dom.tickets.appendChild(card);
  });
};

const loadMovies = async () => {
  saveConfig();
  setStatus('Carregando filmes...');
  const result = await api('/api/movies/', { auth: false });
  logApi(result);
  if (!result.ok) {
    setStatus('Falha ao carregar filmes', 'error');
    return;
  }
  setStatus('Filmes carregados');
  renderMovies(result.data.results || []);
};

const loadSessions = async () => {
  saveConfig();
  if (!state.selectedMovie) {
    setStatus('Selecione um filme primeiro', 'error');
    return;
  }
  setStatus('Carregando sessoes...');
  const result = await api(`/api/movies/${state.selectedMovie.id}/sessions/`, { auth: false });
  logApi(result);
  if (!result.ok) {
    setStatus('Falha ao carregar sessoes', 'error');
    return;
  }
  setStatus('Sessoes carregadas');
  renderSessions(result.data.results || []);
};

const loadSeats = async () => {
  saveConfig();
  if (!state.selectedSession) {
    setStatus('Selecione uma sessao primeiro', 'error');
    return;
  }
  setStatus('Carregando assentos...');
  const result = await api(`/api/sessions/${state.selectedSession.id}/seats/`, { auth: false });
  logApi(result);
  if (!result.ok) {
    setStatus('Falha ao carregar assentos', 'error');
    return;
  }
  setStatus('Assentos carregados');
  state.seats = result.data || [];
  renderSeats(state.seats);
};

const reserveSeat = async () => {
  saveConfig();
  if (!state.selectedSession || !state.selectedSeat) {
    setStatus('Selecione uma sessao e um assento', 'error');
    return;
  }
  if (!state.token) {
    setStatus('Faca login para reservar', 'error');
    return;
  }
  setStatus('Reservando assento...');
  const result = await api(`/api/sessions/${state.selectedSession.id}/reserve/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seat_id: Number(state.selectedSeat.id) }),
  });
  logApi(result);
  if (!result.ok) {
    setStatus('Nao foi possivel reservar', 'error');
    return;
  }
  setStatus('Assento reservado');
  await loadSeats();
};

const checkoutSeat = async () => {
  saveConfig();
  if (!state.selectedSession || !state.selectedSeat) {
    setStatus('Selecione uma sessao e um assento', 'error');
    return;
  }
  if (!state.token) {
    setStatus('Faca login para finalizar', 'error');
    return;
  }
  setStatus('Finalizando checkout...');
  const result = await api(`/api/sessions/${state.selectedSession.id}/checkout/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seat_id: Number(state.selectedSeat.id) }),
  });
  logApi(result);
  if (!result.ok) {
    setStatus('Checkout falhou', 'error');
    return;
  }
  setStatus('Checkout concluido');
  await loadSeats();
  await loadTickets();
};

const loadTickets = async () => {
  saveConfig();
  if (!state.token) {
    setStatus('Faca login para ver ingressos', 'error');
    return;
  }
  const status = dom.ticketFilter.value;
  const suffix = status && status !== 'all' ? `?status=${status}` : '';
  setStatus('Carregando ingressos...');
  const result = await api(`/api/me/tickets/${suffix}`);
  logApi(result);
  if (!result.ok) {
    setStatus('Falha ao carregar ingressos', 'error');
    return;
  }
  setStatus('Ingressos carregados');
  renderTickets(result.data.results || []);
};

const testApi = async () => {
  saveConfig();
  setStatus('Testando conexao...');
  const result = await api('/api/movies/', { auth: false });
  logApi(result);
  if (!result.ok) {
    const detail = result.data?.detail || result.data?.error || result.data?.message;
    setStatus(`API indisponivel (${result.status})${detail ? `: ${detail}` : ''}`, 'error');
    return;
  }
  setStatus('API ok');
};

const register = async () => {
  saveConfig();
  const payload = {
    email: qs('regEmail').value,
    username: qs('regUsername').value,
    password: qs('regPassword').value,
  };
  setStatus('Criando usuario...');
  const result = await api('/api/auth/register/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  logApi(result);
  if (!result.ok) {
    setStatus('Falha no cadastro', 'error');
    return;
  }
  setStatus('Usuario criado');
};

const login = async () => {
  saveConfig();
  const payload = {
    username: qs('loginUsername').value,
    password: qs('loginPassword').value,
  };
  setStatus('Autenticando...');
  const result = await api('/api/auth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  logApi(result);
  if (result.ok && result.data.access) {
    state.token = result.data.access;
    dom.jwtToken.value = state.token;
    localStorage.setItem('jwtToken', state.token);
    updateTokenHint();
    setStatus('Login realizado');
    return;
  }
  setStatus('Login falhou', 'error');
};

const init = () => {
  dom.baseUrl.value = state.baseUrl;
  dom.jwtToken.value = state.token;
  updateTokenHint();

  qs('saveConfig').addEventListener('click', saveConfig);
  qs('clearConfig').addEventListener('click', clearConfig);
  qs('loadMovies').addEventListener('click', loadMovies);
  qs('loadSessions').addEventListener('click', loadSessions);
  qs('refreshSeats').addEventListener('click', loadSeats);
  qs('reserveBtn').addEventListener('click', reserveSeat);
  qs('checkoutBtn').addEventListener('click', checkoutSeat);
  qs('loadTickets').addEventListener('click', loadTickets);
  qs('testApi').addEventListener('click', testApi);
  qs('resetUi').addEventListener('click', resetUi);
  qs('registerBtn').addEventListener('click', register);
  qs('loginBtn').addEventListener('click', login);
};

init();
