const TOKEN_KEY = 'learnos_token';

const API = {
  getToken:   () => localStorage.getItem(TOKEN_KEY),
  setToken:   (t) => localStorage.setItem(TOKEN_KEY, t),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(`/api${path}`, {
        method, headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Cannot reach the server. Make sure it is running.');
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : null;
    if (!res.ok) {
      const err = new Error(data?.message || `Server error (${res.status})`);
      err.status = res.status;
      err.code = data?.code || null;
      throw err;
    }
    return data;
  },

  get:   (path)       => API.request('GET',    path),
  post:  (path, body) => API.request('POST',   path, body),
  patch: (path, body) => API.request('PATCH',  path, body),
  del:   (path)       => API.request('DELETE', path),

  // ── Auth ──────────────────────────────────────────────────────────────────
  async login(email, password) {
    const data = await this.post('/auth/login', { email, password });
    this.setToken(data.token);
    return data;
  },
  async register(name, email, password) {
    const data = await this.post('/auth/register', { name, email, password });
    this.setToken(data.token);
    return data;
  },
  async logout() {
    try { await this.post('/auth/logout'); } catch {}
    this.clearToken();
  },
  getMe: () => API.get('/auth/me'),

  // ── Stats / Dashboard ──────────────────────────────────────────────────────
  getStats:       () => API.get('/stats'),
  getDailyStats:  (window) => API.get('/daily-stats' + (window ? `?window=${window}` : '')),

  // ── Roadmaps ──────────────────────────────────────────────────────────────
  getRoadmaps:  () => API.get('/roadmaps'),
  getRoadmap:   (id) => API.get(`/roadmaps/${id}`),
  patchRoadmap: (id, data) => API.patch(`/roadmaps/${id}`, data),
  patchNode:    (rid, nid, data) => API.patch(`/roadmaps/${rid}/nodes/${nid}`, data),

  // ── Node resources (RE agent) ─────────────────────────────────────────────
  getNodeResources:    (nodeId, include) => API.get(`/nodes/${nodeId}/resources${include ? `?include=${include}` : ''}`),
  proposeNodeResources:(nodeId, kind)    => API.post(`/nodes/${nodeId}/resources/propose`, { kind: kind || null }),
  getNodeLesson:       (nodeId) => API.get(`/nodes/${nodeId}/lesson`),
  putNodeLesson:       (nodeId, body_md) => API.request('PUT', `/nodes/${nodeId}/lesson`, { body_md }),

  // ── Sessions ──────────────────────────────────────────────────────────────
  getSessions:   () => API.get('/sessions'),
  getSession:    (id) => API.get(`/sessions/${id}`),
  createSession: (data) => API.post('/sessions', data),
  patchSession:  (id, data) => API.patch(`/sessions/${id}`, data),
  postMessage:   (sid, data) => API.post(`/sessions/${sid}/messages`, data),
  patchMessage:  (sid, mid, data) => API.patch(`/sessions/${sid}/messages/${mid}`, data),
  getSessionAnalysis: (sid) => API.get(`/sessions/${sid}/analysis`),

  // ── Activity ──────────────────────────────────────────────────────────────
  getActivity:  () => API.get('/activity'),
  postActivity: (data) => API.post('/activity', data),

  // ── Assignments ───────────────────────────────────────────────────────────
  getAssignments:   () => API.get('/assignments'),
  createAssignment: (data) => API.post('/assignments', data),
  patchAssignment:  (id, data) => API.patch(`/assignments/${id}`, data),
  deleteAssignment: (id) => API.del(`/assignments/${id}`),

  // ── Flashcards ────────────────────────────────────────────────────────────
  getFlashcards:    () => API.get('/flashcards'),
  getFlashcardsDue: () => API.get('/flashcards/due'),
  getFlashcardDecks: () => API.get('/flashcards/stats/decks'),
  createFlashcard:  (data) => API.post('/flashcards', data),
  reviewFlashcard:  (id, data) => API.post(`/flashcards/${id}/review`, data),
  deleteFlashcard:  (id) => API.del(`/flashcards/${id}`),

  // ── Courses ───────────────────────────────────────────────────────────────
  getCourses:    (search) => API.get(search ? `/courses?search=${encodeURIComponent(search)}` : '/courses'),
  getCourse:     (slug) => API.get(`/courses/${slug}`),
  enrollCourse:  (slug) => API.post(`/courses/${slug}/enroll`),
  unenrollCourse: (slug) => API.del(`/courses/${slug}/enroll`),

  // ── Certificates & Badges ─────────────────────────────────────────────────
  getCertificates: () => API.get('/certificates'),
  getBadges:       () => API.get('/badges'),

  // ── Schedule ──────────────────────────────────────────────────────────────
  getSchedule:         () => API.get('/schedule'),
  createScheduleEvent: (data) => API.post('/schedule', data),
  deleteScheduleEvent: (id) => API.del(`/schedule/${id}`),
  patchScheduleEvent:  (id, data) => API.patch(`/schedule/${id}`, data),

  // ── Starred ───────────────────────────────────────────────────────────────
  getStarred:    () => API.get('/users/starred'),
  addStarred:    (item_type, item_id) => API.post('/users/starred', { item_type, item_id }),
  removeStarred: (type, id) => API.del(`/users/starred/${type}/${id}`),

  // ── User / Settings ───────────────────────────────────────────────────────
  getUserProfile:   () => API.get('/users/profile'),
  patchUserProfile: (data) => API.patch('/users/profile', data),
  getUserSettings:  () => API.get('/users/settings'),
  patchUserSettings: (data) => API.patch('/users/settings', data),
  getApiKeys:       () => API.get('/users/apikeys'),
  createApiKey:     (data) => API.post('/users/apikeys', data),
  deleteApiKey:     (id) => API.del(`/users/apikeys/${id}`),
  patchApiKey:      (id, data) => API.patch(`/users/apikeys/${id}`, data),
  getAgentRouting:  () => API.get('/users/agent-routing'),
  patchAgentRouting: (code, data) => API.patch(`/users/agent-routing/${code}`, data),
  getAgents:        () => API.get('/users/agents'),

  // ── Community ─────────────────────────────────────────────────────────────
  getCommunityThreads: (params) => {
    const qs = new URLSearchParams(params).toString();
    return API.get('/community/threads' + (qs ? '?' + qs : ''));
  },
  getCommunityThread:  (id) => API.get(`/community/threads/${id}`),
  createCommunityThread: (data) => API.post('/community/threads', data),
  voteThread:          (id, value) => API.post(`/community/threads/${id}/vote`, { value }),
  replyToThread:       (id, body) => API.post(`/community/threads/${id}/replies`, { body }),
  getLeaderboard:      () => API.get('/community/leaderboard'),
  getEnrollments:     () => API.get('/users/enrollments'),
  createCourse:       (data) => API.post('/courses', data),

  // ── AI ─────────────────────────────────────────────────────────────────────
  postChat:            (data) => API.post('/ai/chat', data),
  getAIStatus:         () => API.get('/ai/status'),
  generateAssignment:  (data) => API.post('/ai/assignments/generate', data),
  generateQuiz:        (data) => API.post('/ai/quiz/generate', data),

  // ── Profile / Roadmap generation (Phase 2) ─────────────────────────────────
  getProfile:   () => API.get('/profile'),
  postIntake:   (data) => API.post('/profile/intake', data),
  genRoadmap:   (goal, profile) => API.post('/roadmaps/generate', { goal, profile }),
  getJob:       (id) => API.get(`/jobs/${id}`),

  // ── Uploads (§3.3) ─────────────────────────────────────────────────────────
  uploadFile:   (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = API.getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch('/api/uploads', { method: 'POST', body: fd, headers }).then(r => r.json());
  },

  // ── Course modules & lessons (§3.2) ────────────────────────────────────────
  getCourseModules:    (slug) => API.get(`/courses/${slug}/modules`),
  createCourseModule:  (slug, data) => API.post(`/courses/${slug}/modules`, data),
  patchCourseModule:   (slug, mid, data) => API.patch(`/courses/${slug}/modules/${mid}`, data),
  deleteCourseModule:  (slug, mid) => API.del(`/courses/${slug}/modules/${mid}`),
  createModuleLesson:  (slug, mid, data) => API.post(`/courses/${slug}/modules/${mid}/lessons`, data),
  patchModuleLesson:   (slug, mid, lid, data) => API.patch(`/courses/${slug}/modules/${mid}/lessons/${lid}`, data),
  deleteModuleLesson:  (slug, mid, lid) => API.del(`/courses/${slug}/modules/${mid}/lessons/${lid}`),
  markLessonComplete:   (slug, lessonId) => API.post(`/courses/${slug}/progress/${lessonId}`),
  getCourseProgress:   (slug) => API.get(`/courses/${slug}/progress`),

  // ── Assignment submissions (§3.5) ──────────────────────────────────────────
  submitAssignment:    (id, body_md) => API.post(`/assignments/${id}/submit`, { body_md }),
  getAssignmentSubmission: (id) => API.get(`/assignments/${id}/submission`),

  // ── Schedule due (§3.8) ────────────────────────────────────────────────────
  getScheduleDue:      () => API.get('/schedule/due'),

  // ── Course verification (§3.9) ─────────────────────────────────────────────
  verifyCourse:        (slug) => API.post(`/courses/${slug}/verify`),
  unverifyCourse:      (slug) => API.post(`/courses/${slug}/unverify`),

  // ── Whiteboard strokes (§3.10) ─────────────────────────────────────────────
  getWhiteboardStrokes: (sid) => API.get(`/sessions/${sid}/whiteboard`),
  saveWhiteboardStroke: (sid, stroke) => API.post(`/sessions/${sid}/whiteboard`, stroke),
  deleteWhiteboardStroke: (sid, strokeId) => API.del(`/sessions/${sid}/whiteboard/${strokeId}`),
  clearWhiteboardStrokes: (sid) => API.del(`/sessions/${sid}/whiteboard`),

  // ── Roadmap node creation (§3.11) ──────────────────────────────────────────
  createRoadmapNode:    (rid, data) => API.post(`/roadmaps/${rid}/nodes`, data),
  deleteRoadmapNode:    (rid, nid) => API.del(`/roadmaps/${rid}/nodes/${nid}`),

  // ── Password reset + email verification (§3.13) ────────────────────────────
  forgotPassword:       (email) => API.post('/auth/forgot', { email }),
  resetPassword:        (token, new_password) => API.post('/auth/reset', { token, new_password }),
  verifyEmail:          (token) => API.get(`/auth/verify?token=${encodeURIComponent(token)}`),
  resendVerification:   () => API.post('/auth/resend-verification'),
};

export default API;

// ── Time helpers ─────────────────────────────────────────────────────────────

export function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7)  return `${d}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function scheduledWhen(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const sessionDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let when;
  if (+sessionDay === +today)         when = 'Today';
  else if (+sessionDay === +tomorrow) when = 'Tomorrow';
  else when = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return { when, time };
}

export function fmtDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function dueLabel(isoString) {
  if (!isoString) return '';
  const diff = new Date(isoString).getTime() - Date.now();
  const d = Math.floor(diff / 86_400_000);
  if (d < -1) return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (d === -1) return 'Yesterday';
  if (d === 0)  return 'Today';
  if (d === 1)  return 'Tomorrow';
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
