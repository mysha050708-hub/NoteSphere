const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'notes-db.json');
const ALLOWED_REACTIONS = ['👍', '❤️', '🚀', '🎉', '👀'];

// In-memory state cache
let state = {
  users: [],
  notes: []
};

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Save in-memory state to disk atomically
function save() {
  ensureDataDir();
  const tempPath = `${DB_FILE}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tempPath, DB_FILE);
}

// Load database from disk
function load() {
  ensureDataDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      state = JSON.parse(raw);
      if (!Array.isArray(state.users)) state.users = [];
      if (!Array.isArray(state.notes)) state.notes = [];
    } catch (err) {
      console.error('Failed to load database, initializing clean state:', err.message);
      state = { users: [], notes: [] };
      save();
    }
  } else {
    state = { users: [], notes: [] };
    save();
  }
}

// Generate unique ID
function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).substring(2, 9));
}

// Initialize on module load
load();

// --- USER OPERATIONS ---
function findUserByUsername(username) {
  if (!username) return null;
  return state.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase()) || null;
}

function findUserById(id) {
  return state.users.find(u => u.id === id) || null;
}

function createUser(userData) {
  const newUser = {
    id: generateId(),
    username: userData.username.trim(),
    name: userData.name ? userData.name.trim() : userData.username.trim(),
    passwordHash: userData.passwordHash,
    avatarColor: userData.avatarColor || 'indigo',
    createdAt: new Date().toISOString()
  };
  state.users.push(newUser);
  save();
  return newUser;
}

function getAllUsersPublic() {
  return state.users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    avatarColor: u.avatarColor
  }));
}

// --- NOTE OPERATIONS ---
/**
 * Return all notes visible to the given user:
 * - All notes where isShared === true
 * - Notes where isShared === false AND userId === currentUserId
 */
function getNotesForUser(userId) {
  return state.notes
    .filter(note => note.isShared || note.userId === userId)
    .map(normalizeNote)
    .sort((a, b) => {
      // Pinned notes come first
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      // Then newest first
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    });
}

function getNoteById(noteId) {
  const note = state.notes.find(n => n.id === noteId);
  return note ? normalizeNote(note) : null;
}

function createNote(data, user) {
  const newNote = {
    id: generateId(),
    title: (data.title || 'Untitled Note').trim(),
    content: (data.content || '').trim(),
    userId: user.id,
    authorName: user.name || user.username,
    authorUsername: user.username,
    authorAvatarColor: user.avatarColor || 'indigo',
    isShared: Boolean(data.isShared),
    category: (data.category || 'General').trim(),
    color: data.color || 'default',
    isPinned: Boolean(data.isPinned),
    comments: [],
    reactions: { '👍': [], '❤️': [], '🚀': [], '🎉': [], '👀': [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.notes.unshift(newNote);
  save();
  return newNote;
}

function updateNote(noteId, updates, userId) {
  const noteIndex = state.notes.findIndex(n => n.id === noteId);
  if (noteIndex === -1) return { error: 'Note not found', code: 404 };

  const note = state.notes[noteIndex];
  // Only the creator can edit their note
  if (note.userId !== userId) {
    return { error: 'You are only authorized to edit your own notes.', code: 403 };
  }

  if (updates.title !== undefined) note.title = updates.title.trim();
  if (updates.content !== undefined) note.content = updates.content.trim();
  if (updates.isShared !== undefined) note.isShared = Boolean(updates.isShared);
  if (updates.category !== undefined) note.category = updates.category.trim();
  if (updates.color !== undefined) note.color = updates.color;
  if (updates.isPinned !== undefined) note.isPinned = Boolean(updates.isPinned);
  note.updatedAt = new Date().toISOString();

  state.notes[noteIndex] = note;
  save();
  return { note };
}

function togglePinNote(noteId, userId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return { error: 'Note not found', code: 404 };

  // Allow author to pin/unpin their note
  if (note.userId !== userId) {
    return { error: 'You can only pin/unpin notes you created.', code: 403 };
  }

  note.isPinned = !note.isPinned;
  note.updatedAt = new Date().toISOString();
  save();
  return { note };
}

function deleteNote(noteId, userId) {
  const noteIndex = state.notes.findIndex(n => n.id === noteId);
  if (noteIndex === -1) return { error: 'Note not found', code: 404 };

  const note = state.notes[noteIndex];
  // Only the creator can delete their note
  if (note.userId !== userId) {
    return { error: 'You can only delete your own notes.', code: 403 };
  }

  state.notes.splice(noteIndex, 1);
  save();
  return { success: true };
}

function normalizeNote(note) {
  if (!Array.isArray(note.comments)) note.comments = [];
  if (!note.reactions || typeof note.reactions !== 'object') {
    note.reactions = { '👍': [], '❤️': [], '🚀': [], '🎉': [], '👀': [] };
  }
  return note;
}

function addCommentToNote(noteId, content, user) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return { error: 'Note not found', code: 404 };
  
  if (!note.isShared && note.userId !== user.id) {
    return { error: 'You do not have permission to comment on this note.', code: 403 };
  }
  if (typeof content !== 'string' || !content.trim() || content.trim().length > 2000) {
    return { error: 'Comment must be between 1 and 2000 characters.', code: 400 };
  }

  normalizeNote(note);
  const newComment = {
    id: generateId(),
    noteId,
    userId: user.id,
    authorName: user.name || user.username,
    authorUsername: user.username,
    authorAvatarColor: user.avatarColor || 'indigo',
    content: content.trim(),
    createdAt: new Date().toISOString()
  };
  note.comments.push(newComment);
  note.updatedAt = new Date().toISOString();
  save();
  return { comment: newComment, note };
}

function deleteCommentFromNote(noteId, commentId, userId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return { error: 'Note not found', code: 404 };

  normalizeNote(note);
  const commentIndex = note.comments.findIndex(c => c.id === commentId);
  if (commentIndex === -1) return { error: 'Comment not found', code: 404 };

  const comment = note.comments[commentIndex];
  if (comment.userId !== userId && note.userId !== userId) {
    return { error: 'Unauthorized to delete this comment.', code: 403 };
  }

  note.comments.splice(commentIndex, 1);
  note.updatedAt = new Date().toISOString();
  save();
  return { success: true, note };
}

function toggleReactionOnNote(noteId, emoji, userId) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return { error: 'Note not found', code: 404 };

  if (!note.isShared && note.userId !== userId) {
    return { error: 'You do not have permission to react to this note.', code: 403 };
  }
  if (!ALLOWED_REACTIONS.includes(emoji)) {
    return { error: 'This reaction is not supported.', code: 400 };
  }

  normalizeNote(note);
  if (!Array.isArray(note.reactions[emoji])) note.reactions[emoji] = [];

  const userIndex = note.reactions[emoji].indexOf(userId);
  let action = '';
  if (userIndex > -1) {
    note.reactions[emoji].splice(userIndex, 1);
    action = 'removed';
  } else {
    note.reactions[emoji].push(userId);
    action = 'added';
  }

  save();
  return { note, reactions: note.reactions, action };
}

module.exports = {
  load,
  save,
  findUserByUsername,
  findUserById,
  createUser,
  getAllUsersPublic,
  getNotesForUser,
  getNoteById,
  createNote,
  updateNote,
  togglePinNote,
  deleteNote,
  addCommentToNote,
  deleteCommentFromNote,
  toggleReactionOnNote,
  normalizeNote,
  state
};
