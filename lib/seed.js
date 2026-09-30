const db = require('./db');
const { hashPassword } = require('./auth');

function seedInitialData() {
  // If users already exist, don't overwrite
  if (db.state.users.length > 0) {
    return;
  }

  console.log('Seeding demo users and initial notes...');

  // Seed demo user: Alice
  const alice = db.createUser({
    username: 'alice',
    name: 'Alice Walker',
    passwordHash: hashPassword('password123'),
    avatarColor: 'indigo'
  });

  // Seed demo user: Bob
  const bob = db.createUser({
    username: 'bob',
    name: 'Bob Miller',
    passwordHash: hashPassword('password123'),
    avatarColor: 'emerald'
  });

  // Alice's Shared Note
  db.createNote({
    title: '👋 Welcome to NoteSphere!',
    content: `Welcome to our collaborative notes space!

Here is how note accessibility works:
• 🌐 **Shared Notes**: Marked with a blue community badge. Visible to anyone who logs in.
• 🔒 **Private Notes**: Marked with a lock badge. Strictly visible only to you.
• ⚡ **Full-Text Search**: Filter by tags, categories, or author.
• 📌 **Pinning**: Pin your most crucial notes to the top.

Feel free to add your own notes, try the dark mode, and log in with different accounts to test private vs shared visibility!`,
    isShared: true,
    category: 'General',
    color: 'blue',
    isPinned: true
  }, alice);

  // Bob's Shared Note
  db.createNote({
    title: '🚀 Q4 Project Roadmap & Brainstorming',
    content: `Team priorities for the upcoming cycle:

1. **User Authentication & RBAC** - Complete and secured with JWT.
2. **Real-time note sync** - Testing local storage and instantaneous UI updates.
3. **Export options** - Markdown & JSON downloads available.

Leave your feedback or post a new note on the shared board!`,
    isShared: true,
    category: 'Work',
    color: 'emerald',
    isPinned: false
  }, bob);

  // Alice's Private Note
  db.createNote({
    title: '🛒 Alice’s Private Shopping List',
    content: `Confidential - visible only to Alice:
- Fresh Colombian coffee beans
- Sourdough bread
- Organic avocados
- Dark chocolate (85%)`,
    isShared: false,
    category: 'Personal',
    color: 'amber',
    isPinned: false
  }, alice);

  // Bob's Private Note
  db.createNote({
    title: '🔑 Bob’s Secret BBQ Sauce Recipe',
    content: `Do not share with anyone:
- 2 cups tomato puree
- 1/2 cup apple cider vinegar
- 1/3 cup dark molasses
- 2 tbsp smoked paprika
- 1 tsp cayenne pepper
- Simmer on low for 45 mins.`,
    isShared: false,
    category: 'Personal',
    color: 'rose',
    isPinned: false
  }, bob);

  console.log('Sample data seeded successfully.');
}

module.exports = {
  seedInitialData
};
