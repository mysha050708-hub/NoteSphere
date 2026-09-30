/**
 * NoteSphere API Client
 */
const API = {
  TOKEN_KEY: 'notesphere_jwt_token',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
    }
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  // Auth Endpoints
  async login(username, password) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  async register(username, name, password, avatarColor) {
    const res = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, name, password, avatarColor })
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  async getMe() {
    return await this.request('/api/auth/me');
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    this.setToken(null);
  },

  async getUsers() {
    return await this.request('/api/users');
  },

  // Notes Endpoints
  async getNotes() {
    return await this.request('/api/notes');
  },

  async createNote(noteData) {
    return await this.request('/api/notes', {
      method: 'POST',
      body: JSON.stringify(noteData)
    });
  },

  async updateNote(id, noteData) {
    return await this.request(`/api/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData)
    });
  },

  async togglePin(id) {
    return await this.request(`/api/notes/${id}/pin`, {
      method: 'PATCH'
    });
  },

  async deleteNote(id) {
    return await this.request(`/api/notes/${id}`, {
      method: 'DELETE'
    });
  },

  async addComment(noteId, content) {
    return await this.request(`/api/notes/${noteId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  async deleteComment(noteId, commentId) {
    return await this.request(`/api/notes/${noteId}/comments/${commentId}`, {
      method: 'DELETE'
    });
  },

  async toggleReaction(noteId, emoji) {
    return await this.request(`/api/notes/${noteId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
  }
};
