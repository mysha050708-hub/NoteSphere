// API Integration Test Suite for NoteSphere
async function runTests() {
  const base = 'http://localhost:3000';
  console.log('--- 1. Testing GET / (HTML Page) ---');
  const homeRes = await fetch(base);
  console.log(`GET / status: ${homeRes.status} (Expected: 200)`);

  console.log('\n--- 2. Testing Login as Alice ---');
  const aliceLoginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'alice', password: 'password123' })
  });
  const aliceData = await aliceLoginRes.json();
  console.log(`Alice login: ${aliceLoginRes.status}, user: ${aliceData.user.name}`);
  const aliceToken = aliceData.token;

  console.log('\n--- 3. Fetching notes for Alice ---');
  const aliceNotesRes = await fetch(`${base}/api/notes`, {
    headers: { Authorization: `Bearer ${aliceToken}` }
  });
  const aliceNotes = await aliceNotesRes.json();
  console.log(`Alice sees ${aliceNotes.notes.length} notes:`);
  aliceNotes.notes.forEach(n => {
    console.log(` • [${n.category}] "${n.title}" (Shared: ${n.isShared}, Author: ${n.authorName})`);
  });

  console.log('\n--- 4. Testing Login as Bob ---');
  const bobLoginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'bob', password: 'password123' })
  });
  const bobData = await bobLoginRes.json();
  console.log(`Bob login: ${bobLoginRes.status}, user: ${bobData.user.name}`);
  const bobToken = bobData.token;

  console.log('\n--- 5. Bob creates a Shared note ---');
  const newSharedRes = await fetch(`${base}/api/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bobToken}`
    },
    body: JSON.stringify({
      title: 'Bob Shared Announcement',
      content: 'This note is accessible to whoever logs in!',
      category: 'General',
      isShared: true,
      color: 'emerald'
    })
  });
  const newShared = await newSharedRes.json();
  console.log(`Created shared note: "${newShared.note.title}" (ID: ${newShared.note.id})`);

  console.log('\n--- 6. Bob creates a Private note ---');
  const newPrivateRes = await fetch(`${base}/api/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bobToken}`
    },
    body: JSON.stringify({
      title: 'Bob Secret Vault Code',
      content: 'Visible ONLY to Bob!',
      category: 'Personal',
      isShared: false,
      color: 'rose'
    })
  });
  const newPrivate = await newPrivateRes.json();
  console.log(`Created private note: "${newPrivate.note.title}" (ID: ${newPrivate.note.id})`);

  console.log('\n--- 7. Verifying Alice permissions ---');
  const aliceVerifyRes = await fetch(`${base}/api/notes`, {
    headers: { Authorization: `Bearer ${aliceToken}` }
  });
  const aliceVerifyNotes = await aliceVerifyRes.json();
  const aliceTitles = aliceVerifyNotes.notes.map(n => n.title);
  console.log(`Alice's visible note titles:`, aliceTitles);

  const canSeeShared = aliceTitles.includes('Bob Shared Announcement');
  const canSeePrivate = aliceTitles.includes('Bob Secret Vault Code');

  console.log(`\nResults:`);
  console.log(` - Alice can see Bob's Shared Note: ${canSeeShared ? '✅ PASS' : '❌ FAIL'}`);
  console.log(` - Alice cannot see Bob's Private Note: ${!canSeePrivate ? '✅ PASS' : '❌ FAIL'}`);

  if (canSeeShared && !canSeePrivate) {
    console.log('\n🎉 ALL TESTS PASSED! Access control & sharing works flawlessly.\n');
  } else {
    console.error('\n❌ TEST FAILED: Permissions mismatch.\n');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
