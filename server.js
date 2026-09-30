const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const db = require('./lib/db');
const { hashPassword, verifyPassword, generateToken, authenticateToken } = require('./lib/auth');
const { seedInitialData } = require('./lib/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Seed initial data if database is empty
seedInitialData();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// Register new user
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, name, password, avatarColor } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existingUser = db.findUserByUsername(cleanUsername);
    if (existingUser) {
      return res.status(409).json({ error: 'Username is already taken. Please choose another.' });
    }

    const passwordHash = hashPassword(password);
    const newUser = db.createUser({
      username: cleanUsername,
      name: name ? name.trim() : cleanUsername,
      passwordHash,
      avatarColor: avatarColor || 'indigo'
    });

    const token = generateToken(newUser);

    // Set cookie
    res.cookie('notes_token', token, {
      httpOnly: false, // Accessible to front-end for token header if needed
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    return res.status(201).json({
      message: 'Account created successfully!',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        avatarColor: newUser.avatarColor
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to create account.' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = db.findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = generateToken(user);

    res.cookie('notes_token', token, {
      httpOnly: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    return res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatarColor: user.avatarColor
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
});

// Current user profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = db.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User no longer exists.' });
  }
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      avatarColor: user.avatarColor
    }
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('notes_token');
  return res.json({ message: 'Logged out successfully.' });
});

// Get public users (for author filtering)
app.get('/api/users', authenticateToken, (req, res) => {
  return res.json({ users: db.getAllUsersPublic() });
});

// ==========================================
// NOTES ROUTES (Protected by authenticateToken)
// ==========================================

// Get all notes visible to the current logged-in user
// (Shared notes + user's own private notes)
app.get('/api/notes', authenticateToken, (req, res) => {
  try {
    const notes = db.getNotesForUser(req.user.id);
    return res.json({ notes, currentUserId: req.user.id });
  } catch (err) {
    console.error('Error fetching notes:', err);
    return res.status(500).json({ error: 'Failed to retrieve notes.' });
  }
});

// Create a new note
app.post('/api/notes', authenticateToken, (req, res) => {
  try {
    const { title, content, isShared, category, color, isPinned } = req.body;

    if (!title && !content) {
      return res.status(400).json({ error: 'Note title or content is required.' });
    }

    const newNote = db.createNote(
      {
        title,
        content,
        isShared: isShared === true || isShared === 'true',
        category,
        color,
        isPinned: isPinned === true || isPinned === 'true'
      },
      req.user
    );

    return res.status(201).json({
      message: 'Note created successfully!',
      note: newNote
    });
  } catch (err) {
    console.error('Error creating note:', err);
    return res.status(500).json({ error: 'Failed to create note.' });
  }
});

// Update an existing note
app.put('/api/notes/:id', authenticateToken, (req, res) => {
  try {
    const noteId = req.params.id;
    const { title, content, isShared, category, color, isPinned } = req.body;

    const result = db.updateNote(
      noteId,
      { title, content, isShared, category, color, isPinned },
      req.user.id
    );

    if (result.error) {
      return res.status(result.code).json({ error: result.error });
    }

    return res.json({
      message: 'Note updated successfully!',
      note: result.note
    });
  } catch (err) {
    console.error('Error updating note:', err);
    return res.status(500).json({ error: 'Failed to update note.' });
  }
});

// Toggle pin status
app.patch('/api/notes/:id/pin', authenticateToken, (req, res) => {
  try {
    const result = db.togglePinNote(req.params.id, req.user.id);
    if (result.error) {
      return res.status(result.code).json({ error: result.error });
    }
    return res.json({
      message: result.note.isPinned ? 'Note pinned!' : 'Note unpinned.',
      note: result.note
    });
  } catch (err) {
    console.error('Error toggling pin:', err);
    return res.status(500).json({ error: 'Failed to update pin status.' });
  }
});

// Delete a note
app.delete('/api/notes/:id', authenticateToken, (req, res) => {
  try {
    const result = db.deleteNote(req.params.id, req.user.id);
    if (result.error) {
      return res.status(result.code).json({ error: result.error });
    }
    return res.json({ message: 'Note deleted successfully.' });
  } catch (err) {
    console.error('Error deleting note:', err);
    return res.status(500).json({ error: 'Failed to delete note.' });
  }
});

// Add comment to a note
app.post('/api/notes/:id/comments', authenticateToken, (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string' || !content.trim() || content.trim().length > 2000) {
      return res.status(400).json({ error: 'Comment must be between 1 and 2000 characters.' });
    }

    const result = db.addCommentToNote(req.params.id, content, req.user);
    if (result.error) {
      return res.status(result.code).json({ error: result.error });
    }

    return res.status(201).json({
      message: 'Comment posted successfully!',
      comment: result.comment,
      note: result.note
    });
  } catch (err) {
    console.error('Error posting comment:', err);
    return res.status(500).json({ error: 'Failed to post comment.' });
  }
});

// Delete comment from a note
app.delete('/api/notes/:id/comments/:commentId', authenticateToken, (req, res) => {
  try {
    const result = db.deleteCommentFromNote(req.params.id, req.params.commentId, req.user.id);
    if (result.error) {
      return res.status(result.code).json({ error: result.error });
    }

    return res.json({
      message: 'Comment deleted successfully.',
      note: result.note
    });
  } catch (err) {
    console.error('Error deleting comment:', err);
    return res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

// Toggle reaction on a note
app.post('/api/notes/:id/reactions', authenticateToken, (req, res) => {
  try {
    const { emoji } = req.body;
    if (typeof emoji !== 'string') {
      return res.status(400).json({ error: 'A supported reaction is required.' });
    }

    const result = db.toggleReactionOnNote(req.params.id, emoji, req.user.id);
    if (result.error) {
      return res.status(result.code).json({ error: result.error });
    }

    return res.json({
      message: `Reaction ${result.action}!`,
      reactions: result.reactions,
      note: result.note
    });
  } catch (err) {
    console.error('Error toggling reaction:', err);
    return res.status(500).json({ error: 'Failed to toggle reaction.' });
  }
});

// Export notes as JSON
app.get('/api/notes/export/json', authenticateToken, (req, res) => {
  try {
    const notes = db.getNotesForUser(req.user.id);
    res.setHeader('Content-disposition', `attachment; filename=notesphere-export-${Date.now()}.json`);
    res.setHeader('Content-type', 'application/json');
    return res.send(JSON.stringify(notes, null, 2));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to export notes.' });
  }
});

// Serve frontend for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 NoteSphere Server running at: http://localhost:${PORT}`);
  console.log(`🔑 Demo Accounts:`);
  console.log(`   - Username: alice | Password: password123`);
  console.log(`   - Username: bob   | Password: password123`);
  console.log(`===============================================`);
});
