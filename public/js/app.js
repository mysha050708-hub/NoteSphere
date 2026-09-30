/**
 * NoteSphere Main Application Logic
 */

const app = {
  // State
  currentUser: null,
  notes: [],
  users: [],
  activeScope: 'all', // 'all', 'shared', 'private', 'mine'
  selectedCategory: 'All',
  selectedAuthor: 'All',
  searchQuery: '',
  sortBy: 'pinned-newest',
  viewingNote: null,
  deletingNoteId: null,

  // Init
  async init() {
    this.initTheme();
    this.initKeyboardShortcuts();

    // Check if token exists and validate
    if (API.getToken()) {
      try {
        const res = await API.getMe();
        if (res && res.user) {
          this.currentUser = res.user;
          this.showAppView();
          await this.loadNotes();
          await this.loadUsers();
          return;
        }
      } catch (err) {
        console.warn('Session expired or invalid:', err.message);
        API.setToken(null);
      }
    }

    this.showAuthView();
  },

  // ---------------- THEME ----------------
  initTheme() {
    const savedTheme = localStorage.getItem('notesphere_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
      this.updateThemeIcons(true);
    } else {
      document.documentElement.classList.remove('dark');
      this.updateThemeIcons(false);
    }
  },

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('notesphere_theme', isDark ? 'dark' : 'light');
    this.updateThemeIcons(isDark);
  },

  updateThemeIcons(isDark) {
    const sun = document.getElementById('themeIconSun');
    const moon = document.getElementById('themeIconMoon');
    if (isDark) {
      sun.classList.remove('hidden');
      moon.classList.add('hidden');
    } else {
      sun.classList.add('hidden');
      moon.classList.remove('hidden');
    }
  },

  // ---------------- VIEW ROUTING ----------------
  showAuthView() {
    document.getElementById('authView').classList.remove('hidden');
    document.getElementById('appView').classList.add('hidden');
    document.getElementById('userNavSection').classList.remove('flex');
    document.getElementById('userNavSection').classList.add('hidden');
    this.currentUser = null;
  },

  showAppView() {
    document.getElementById('authView').classList.add('hidden');
    document.getElementById('appView').classList.remove('hidden');
    document.getElementById('userNavSection').classList.remove('hidden');
    document.getElementById('userNavSection').classList.add('flex');

    // Update user info display
    if (this.currentUser) {
      document.getElementById('userNameDisplay').textContent = this.currentUser.name || this.currentUser.username;
      document.getElementById('userUsernameDisplay').textContent = `@${this.currentUser.username}`;
      const avatar = document.getElementById('userAvatarBadge');
      avatar.textContent = (this.currentUser.name || this.currentUser.username).charAt(0).toUpperCase();
      avatar.className = `w-9 h-9 rounded-full text-white font-semibold text-sm flex items-center justify-center shadow-sm ${this.getAvatarBgClass(this.currentUser.avatarColor)}`;
    }
  },

  // ---------------- AUTH HANDLERS ----------------
  switchAuthTab(tab) {
    const tabLogin = document.getElementById('tabLogin');
    const tabReg = document.getElementById('tabRegister');
    const formLogin = document.getElementById('loginForm');
    const formReg = document.getElementById('registerForm');
    const errBox = document.getElementById('authError');
    errBox.classList.add('hidden');

    if (tab === 'login') {
      tabLogin.className = 'flex-1 py-3 text-center border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold';
      tabReg.className = 'flex-1 py-3 text-center border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200';
      formLogin.classList.remove('hidden');
      formReg.classList.add('hidden');
    } else {
      tabReg.className = 'flex-1 py-3 text-center border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold';
      tabLogin.className = 'flex-1 py-3 text-center border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200';
      formReg.classList.remove('hidden');
      formLogin.classList.add('hidden');
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginSubmitBtn');
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block animate-spin mr-2">🔄</span> Signing in...`;
      const res = await API.login(username, password);
      this.currentUser = res.user;
      this.showToast(`Welcome back, ${res.user.name || res.user.username}!`, 'success');
      this.showAppView();
      await this.loadNotes();
      await this.loadUsers();
    } catch (err) {
      this.showAuthError(err.message || 'Login failed.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Sign In</span>`;
    }
  },

  async quickLogin(username, password) {
    document.getElementById('loginUsername').value = username;
    document.getElementById('loginPassword').value = password;
    this.switchAuthTab('login');
    document.getElementById('loginForm').dispatchEvent(new Event('submit', { cancelable: true }));
  },

  async handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('regSubmitBtn');
    const name = document.getElementById('regName').value;
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const avatarColor = document.querySelector('input[name="regAvatarColor"]:checked')?.value || 'indigo';

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block animate-spin mr-2">🔄</span> Creating account...`;
      const res = await API.register(username, name, password, avatarColor);
      this.currentUser = res.user;
      this.showToast(`Welcome to NoteSphere, ${res.user.name}!`, 'success');
      this.showAppView();
      await this.loadNotes();
      await this.loadUsers();
    } catch (err) {
      this.showAuthError(err.message || 'Registration failed.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Register & Start Writing</span>`;
    }
  },

  async logout() {
    await API.logout();
    this.showToast('You have been logged out.', 'info');
    this.showAuthView();
  },

  showAuthError(msg) {
    const errBox = document.getElementById('authError');
    errBox.textContent = msg;
    errBox.classList.remove('hidden');
  },

  // ---------------- NOTES DATA & STATS ----------------
  async loadNotes() {
    try {
      const data = await API.getNotes();
      this.notes = data.notes || [];
      this.updateStats();
      this.renderNotes();
    } catch (err) {
      this.showToast('Failed to load notes: ' + err.message, 'error');
    }
  },

  async loadUsers() {
    try {
      const data = await API.getUsers();
      this.users = data.users || [];
      this.renderAuthorSelect();
    } catch (err) {
      // non-critical
    }
  },

  updateStats() {
    const total = this.notes.length;
    const shared = this.notes.filter(n => n.isShared).length;
    const myPrivate = this.notes.filter(n => !n.isShared && n.userId === this.currentUser?.id).length;

    document.getElementById('statTotalCount').textContent = total;
    document.getElementById('statSharedCount').textContent = shared;
    document.getElementById('statPrivateCount').textContent = myPrivate;
  },

  renderAuthorSelect() {
    const select = document.getElementById('authorSelectFilter');
    const currentVal = select.value;
    select.innerHTML = '<option value="All">Everyone</option>';
    this.users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.username;
      opt.textContent = `${u.name || u.username} (@${u.username})`;
      select.appendChild(opt);
    });
    select.value = currentVal || 'All';
  },

  // ---------------- FILTERING & SORTING ----------------
  setScope(scope) {
    this.activeScope = scope;
    ['scopeAll', 'scopeShared', 'scopePrivate', 'scopeMine'].forEach(id => {
      const btn = document.getElementById(id);
      if (id === 'scope' + scope.charAt(0).toUpperCase() + scope.slice(1)) {
        btn.className = 'px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm transition flex items-center gap-1.5';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5';
      }
    });
    this.renderNotes();
  },

  setCategory(cat) {
    this.selectedCategory = cat;
    document.querySelectorAll('.category-chip').forEach(btn => {
      if (btn.textContent.trim() === cat) {
        btn.className = 'category-chip active px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800 transition';
      } else {
        btn.className = 'category-chip px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition';
      }
    });
    this.renderNotes();
  },

  setAuthorFilter(authorUsername) {
    this.selectedAuthor = authorUsername;
    this.renderNotes();
  },

  setSort(sortBy) {
    this.sortBy = sortBy;
    this.renderNotes();
  },

  handleSearch(val) {
    this.searchQuery = val.trim().toLowerCase();
    const clearBtn = document.getElementById('searchClearBtn');
    if (this.searchQuery.length > 0) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
    this.renderNotes();
  },

  clearSearch() {
    document.getElementById('searchInput').value = '';
    this.handleSearch('');
  },

  resetFilters() {
    this.setScope('all');
    this.setCategory('All');
    this.setAuthorFilter('All');
    document.getElementById('authorSelectFilter').value = 'All';
    this.clearSearch();
  },

  getFilteredNotes() {
    let result = [...this.notes];

    // 1. Scope filter
    if (this.activeScope === 'shared') {
      result = result.filter(n => n.isShared);
    } else if (this.activeScope === 'private') {
      result = result.filter(n => !n.isShared && n.userId === this.currentUser?.id);
    } else if (this.activeScope === 'mine') {
      result = result.filter(n => n.userId === this.currentUser?.id);
    }

    // 2. Category filter
    if (this.selectedCategory !== 'All') {
      result = result.filter(n => n.category.toLowerCase() === this.selectedCategory.toLowerCase());
    }

    // 3. Author filter
    if (this.selectedAuthor !== 'All') {
      result = result.filter(n => n.authorUsername.toLowerCase() === this.selectedAuthor.toLowerCase());
    }

    // 4. Search query
    if (this.searchQuery) {
      const q = this.searchQuery;
      result = result.filter(n => {
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q) ||
          n.authorName.toLowerCase().includes(q) ||
          n.authorUsername.toLowerCase().includes(q)
        );
      });
    }

    // 5. Sorting
    result.sort((a, b) => {
      if (this.sortBy === 'pinned-newest') {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      } else if (this.sortBy === 'newest') {
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      } else if (this.sortBy === 'oldest') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      } else if (this.sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });

    return result;
  },

  // ---------------- RENDER NOTES ----------------
  renderNotes() {
    const grid = document.getElementById('notesGrid');
    const emptyState = document.getElementById('emptyState');
    const filtered = this.getFilteredNotes();

    if (filtered.length === 0) {
      grid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    grid.innerHTML = filtered.map(note => this.generateNoteCardHtml(note)).join('');
  },

  generateNoteCardHtml(note) {
    const isOwner = this.currentUser && note.userId === this.currentUser.id;
    const timeAgo = this.formatTimeAgo(note.updatedAt || note.createdAt);
    const colorClass = `card-color-${note.color || 'default'}`;

    return `
      <div class="note-card bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between shadow-sm relative group cursor-pointer ${colorClass}" onclick="app.openViewModal('${note.id}')">
        
        <!-- Header -->
        <div>
          <div class="flex items-center justify-between gap-2 mb-2.5">
            <!-- Badges -->
            <div class="flex items-center gap-1.5 flex-wrap">
              ${note.isShared ? `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900" title="Accessible to anyone who logs in">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Shared
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900" title="Visible only to you">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  Private
                </span>
              `}

              <span class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                ${this.escapeHtml(note.category)}
              </span>
            </div>

            <!-- Pin Button -->
            <div class="flex items-center gap-1" onclick="event.stopPropagation()">
              ${isOwner ? `
                <button onclick="app.togglePin('${note.id}')" class="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition ${note.isPinned ? 'text-amber-500 font-bold' : ''}" title="${note.isPinned ? 'Unpin' : 'Pin to top'}">
                  <svg class="w-4 h-4 ${note.isPinned ? 'fill-amber-500 text-amber-500' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              ` : (note.isPinned ? `
                <span title="Pinned by author" class="text-amber-500 text-xs">📌</span>
              ` : '')}
            </div>
          </div>

          <!-- Title -->
          <h3 class="text-base font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
            ${this.escapeHtml(note.title)}
          </h3>

          <!-- Content preview -->
          <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4 whitespace-pre-wrap font-sans">
            ${this.escapeHtml(note.content || '(No content)')}
          </p>
        </div>

        <!-- Footer: Author Info & Quick Actions -->
        <div class="pt-4 mt-4 border-t border-slate-100 dark:border-slate-750 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400" onclick="event.stopPropagation()">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${this.getAvatarBgClass(note.authorAvatarColor)}">
              ${(note.authorName || 'U').charAt(0).toUpperCase()}
            </div>
            <div class="leading-tight">
              <span class="font-medium text-slate-700 dark:text-slate-300">${this.escapeHtml(note.authorName)}</span>
              <span class="text-[10px] text-slate-400 block">${timeAgo}</span>
            </div>
          </div>

          <!-- Action buttons for owner -->
          <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
            <button onclick="app.copyNoteContent('${note.id}')" class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition" title="Copy to clipboard">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            </button>
            ${isOwner ? `
              <button onclick="app.openEditModal('${note.id}')" class="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 transition" title="Edit note">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
              <button onclick="app.promptDelete('${note.id}')" class="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-500 hover:text-rose-700 transition" title="Delete note">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            ` : ''}
          </div>
        </div>

      </div>
    `;
  },

  // ---------------- NOTE MODAL (CREATE / EDIT) ----------------
  openCreateModal() {
    document.getElementById('noteEditId').value = '';
    document.getElementById('noteModalTitle').textContent = 'Create New Note';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('noteCategory').value = 'General';
    document.getElementById('visShared').checked = true;
    document.getElementById('noteIsPinned').checked = false;
    document.querySelector('input[name="noteColor"][value="default"]').checked = true;

    document.getElementById('noteModal').classList.remove('hidden');
    this.updateTextCounts();
    setTimeout(() => document.getElementById('noteTitle').focus(), 50);
  },

  openEditModal(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;

    document.getElementById('noteEditId').value = note.id;
    document.getElementById('noteModalTitle').textContent = 'Edit Note';
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteCategory').value = note.category;
    
    if (note.isShared) {
      document.getElementById('visShared').checked = true;
    } else {
      document.getElementById('visPrivate').checked = true;
    }

    document.getElementById('noteIsPinned').checked = Boolean(note.isPinned);

    const colorRadio = document.querySelector(`input[name="noteColor"][value="${note.color || 'default'}"]`);
    if (colorRadio) colorRadio.checked = true;

    document.getElementById('noteModal').classList.remove('hidden');
    this.updateTextCounts();
    setTimeout(() => document.getElementById('noteTitle').focus(), 50);
  },

  closeNoteModal() {
    document.getElementById('noteModal').classList.add('hidden');
  },

  updateTextCounts() {
    const text = document.getElementById('noteContent').value || '';
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const display = document.getElementById('textCountDisplay');
    if (display) {
      display.textContent = `${words} word${words === 1 ? '' : 's'} • ${chars} char${chars === 1 ? '' : 's'}`;
    }
  },

  insertMarkdown(prefix, suffix = '') {
    const textarea = document.getElementById('noteContent');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const replacement = prefix + selected + suffix;
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    this.updateTextCounts();
  },

  async handleNoteSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveNoteBtn');
    const noteId = document.getElementById('noteEditId').value;
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteContent').value;
    const category = document.getElementById('noteCategory').value;
    const isShared = document.getElementById('visShared').checked;
    const isPinned = document.getElementById('noteIsPinned').checked;
    const color = document.querySelector('input[name="noteColor"]:checked')?.value || 'default';

    const payload = { title, content, category, isShared, isPinned, color };

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block animate-spin mr-1">🔄</span> Saving...`;

      if (noteId) {
        // Edit existing
        const res = await API.updateNote(noteId, payload);
        const index = this.notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
          this.notes[index] = res.note;
        }
        this.showToast('Note updated successfully!', 'success');
      } else {
        // Create new
        const res = await API.createNote(payload);
        this.notes.unshift(res.note);
        this.showToast('Note created successfully!', 'success');
      }

      this.closeNoteModal();
      this.updateStats();
      this.renderNotes();
    } catch (err) {
      this.showToast(err.message || 'Failed to save note.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Note';
    }
  },

  // ---------------- PIN / DELETE / ACTIONS ----------------
  async togglePin(noteId) {
    try {
      const res = await API.togglePin(noteId);
      const index = this.notes.findIndex(n => n.id === noteId);
      if (index !== -1) {
        this.notes[index] = res.note;
      }
      this.renderNotes();
      this.showToast(res.note.isPinned ? 'Note pinned to top' : 'Note unpinned', 'info');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  promptDelete(noteId) {
    this.deletingNoteId = noteId;
    document.getElementById('deleteModal').classList.remove('hidden');
  },

  closeDeleteModal() {
    this.deletingNoteId = null;
    document.getElementById('deleteModal').classList.add('hidden');
  },

  async confirmDelete() {
    if (!this.deletingNoteId) return;
    const btn = document.getElementById('confirmDeleteBtn');

    try {
      btn.disabled = true;
      btn.textContent = 'Deleting...';
      await API.deleteNote(this.deletingNoteId);
      this.notes = this.notes.filter(n => n.id !== this.deletingNoteId);
      this.closeDeleteModal();
      this.closeViewModal();
      this.updateStats();
      this.renderNotes();
      this.showToast('Note deleted.', 'info');
    } catch (err) {
      this.showToast(err.message || 'Failed to delete note.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Delete';
    }
  },

  // ---------------- VIEW MODAL ----------------
  openViewModal(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) return;

    this.viewingNote = note;
    const isOwner = this.currentUser && note.userId === this.currentUser.id;

    // Badges
    const visBadge = document.getElementById('viewVisibilityBadge');
    if (note.isShared) {
      visBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900';
      visBadge.innerHTML = '🌐 Shared Board';
    } else {
      visBadge.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900';
      visBadge.innerHTML = '🔒 Private Note';
    }

    document.getElementById('viewCategoryBadge').textContent = note.category;
    
    const pinnedBadge = document.getElementById('viewPinnedBadge');
    if (note.isPinned) pinnedBadge.classList.remove('hidden');
    else pinnedBadge.classList.add('hidden');

    // Title & Content
    document.getElementById('viewTitle').textContent = note.title;
    document.getElementById('viewContent').innerHTML = this.renderMarkdown(note.content);

    // Author
    const authorAvatar = document.getElementById('viewAuthorAvatar');
    authorAvatar.textContent = (note.authorName || 'U').charAt(0).toUpperCase();
    authorAvatar.className = `w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${this.getAvatarBgClass(note.authorAvatarColor)}`;

    document.getElementById('viewAuthorName').textContent = `${note.authorName} (@${note.authorUsername})`;
    document.getElementById('viewDate').textContent = new Date(note.updatedAt || note.createdAt).toLocaleString();

    // Owner action buttons
    const authorActions = document.getElementById('viewAuthorActions');
    if (isOwner) {
      authorActions.classList.remove('hidden');
      authorActions.classList.add('flex');
    } else {
      authorActions.classList.add('hidden');
      authorActions.classList.remove('flex');
    }

    document.getElementById('viewModal').classList.remove('hidden');
    this.renderNoteDiscussion(note);
  },

  renderNoteDiscussion(note) {
    const emojis = ['👍', '❤️', '🚀', '🎉', '👀'];
    const reactions = note.reactions || {};
    const reactionsEl = document.getElementById('viewReactions');
    reactionsEl.innerHTML = emojis.map(emoji => {
      const users = Array.isArray(reactions[emoji]) ? reactions[emoji] : [];
      const reacted = users.includes(this.currentUser?.id);
      return `<button type="button" onclick="app.toggleReaction('${emoji}')" aria-pressed="${reacted}" class="px-3 py-1.5 rounded-full border text-sm transition ${reacted ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}">${emoji} <span>${users.length}</span></button>`;
    }).join('');

    const comments = Array.isArray(note.comments) ? note.comments : [];
    document.getElementById('viewCommentCount').textContent = `(${comments.length})`;
    const commentsEl = document.getElementById('viewComments');
    commentsEl.innerHTML = comments.length ? comments.map(comment => {
      const canDelete = comment.userId === this.currentUser?.id || note.userId === this.currentUser?.id;
      const date = comment.createdAt ? new Date(comment.createdAt).toLocaleString() : '';
      return `<article class="rounded-xl bg-slate-50 dark:bg-slate-900/70 p-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0"><div class="text-xs font-semibold text-slate-800 dark:text-slate-200">${this.escapeHtml(comment.authorName || comment.authorUsername || 'User')} <span class="font-normal text-slate-400">@${this.escapeHtml(comment.authorUsername || '')} · ${this.escapeHtml(date)}</span></div>
          <p class="mt-1 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">${this.escapeHtml(comment.content || '')}</p></div>
          ${canDelete ? `<button type="button" onclick="app.deleteComment('${comment.id}')" class="shrink-0 text-xs text-rose-600 hover:underline">Delete</button>` : ''}
        </div>
      </article>`;
    }).join('') : '<p class="text-sm text-slate-500">No comments yet. Start the conversation.</p>';
  },

  async refreshNoteFromResponse(note) {
    if (!note) return;
    const index = this.notes.findIndex(item => item.id === note.id);
    if (index !== -1) this.notes[index] = note;
    this.viewingNote = note;
    this.openViewModal(note.id);
  },

  async handleCommentSubmit(e) {
    e.preventDefault();
    if (!this.viewingNote) return;
    const input = document.getElementById('commentInput');
    const button = document.getElementById('commentSubmitBtn');
    const content = input.value.trim();
    if (!content) return;
    button.disabled = true;
    try {
      const result = await API.addComment(this.viewingNote.id, content);
      input.value = '';
      await this.refreshNoteFromResponse(result.note);
      this.showToast('Comment posted.', 'success');
    } catch (err) {
      this.showToast(err.message || 'Failed to post comment.', 'error');
    } finally {
      button.disabled = false;
    }
  },

  async deleteComment(commentId) {
    if (!this.viewingNote) return;
    try {
      const result = await API.deleteComment(this.viewingNote.id, commentId);
      await this.refreshNoteFromResponse(result.note);
      this.showToast('Comment deleted.', 'info');
    } catch (err) {
      this.showToast(err.message || 'Failed to delete comment.', 'error');
    }
  },

  async toggleReaction(emoji) {
    if (!this.viewingNote) return;
    try {
      const result = await API.toggleReaction(this.viewingNote.id, emoji);
      await this.refreshNoteFromResponse(result.note);
    } catch (err) {
      this.showToast(err.message || 'Failed to update reaction.', 'error');
    }
  },

  closeViewModal() {
    document.getElementById('viewModal').classList.add('hidden');
    this.viewingNote = null;
  },

  editFromViewModal() {
    if (this.viewingNote) {
      const id = this.viewingNote.id;
      this.closeViewModal();
      this.openEditModal(id);
    }
  },

  copyViewNoteContent() {
    if (this.viewingNote) {
      const fullText = `${this.viewingNote.title}\n\n${this.viewingNote.content}`;
      navigator.clipboard.writeText(fullText).then(() => {
        this.showToast('Note copied to clipboard!', 'success');
      });
    }
  },

  copyNoteContent(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      const fullText = `${note.title}\n\n${note.content}`;
      navigator.clipboard.writeText(fullText).then(() => {
        this.showToast('Note copied to clipboard!', 'success');
      });
    }
  },

  downloadViewNoteMarkdown() {
    if (!this.viewingNote) return;
    const md = `# ${this.viewingNote.title}\n\n*Author: ${this.viewingNote.authorName} (@${this.viewingNote.authorUsername})*\n*Category: ${this.viewingNote.category} | ${this.viewingNote.isShared ? 'Shared' : 'Private'}*\n*Date: ${new Date(this.viewingNote.createdAt).toISOString()}*\n\n---\n\n${this.viewingNote.content}`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = this.viewingNote.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'note';
    link.download = `${cleanName}.md`;
    link.click();
    URL.revokeObjectURL(url);
    this.showToast('Downloaded Markdown file!', 'success');
  },

  exportNotesJSON() {
    window.open('/api/notes/export/json', '_blank');
    this.showToast('Exporting all accessible notes as JSON...', 'info');
  },

  // ---------------- TOAST NOTIFICATIONS ----------------
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast-enter pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold text-white ${
      type === 'success' ? 'bg-emerald-600' :
      type === 'error' ? 'bg-rose-600' :
      type === 'warning' ? 'bg-amber-600' : 'bg-slate-800 dark:bg-slate-700'
    }`;

    let icon = `ℹ️`;
    if (type === 'success') icon = `✅`;
    if (type === 'error') icon = `⚠️`;

    toast.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('toast-enter');
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  // ---------------- HELPERS ----------------
  getAvatarBgClass(color) {
    const map = {
      indigo: 'bg-indigo-600',
      emerald: 'bg-emerald-600',
      blue: 'bg-blue-600',
      amber: 'bg-amber-500',
      purple: 'bg-purple-600',
      rose: 'bg-rose-600'
    };
    return map[color] || 'bg-indigo-600';
  },

  formatTimeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString();
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  renderMarkdown(text) {
    if (!text || !text.trim()) return '<p class="text-slate-400 italic">(No content)</p>';
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        return window.marked.parse(text, { breaks: true, gfm: true });
      } catch (e) {
        console.warn('Markdown parsing error:', e);
      }
    }
    return this.escapeHtml(text).replace(/\n/g, '<br>');
  },

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ctrl+N or Cmd+N for new note when logged in
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        if (this.currentUser && document.getElementById('noteModal').classList.contains('hidden')) {
          e.preventDefault();
          this.openCreateModal();
        }
      }
      // Escape to close modals
      if (e.key === 'Escape') {
        this.closeNoteModal();
        this.closeViewModal();
        this.closeDeleteModal();
      }
    });
  }
};

// Auto-run on load
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});
