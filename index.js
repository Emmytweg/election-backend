const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ========== MODELS ==========
const User = mongoose.model('User', new mongoose.Schema({
  matricNumber: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  department: String,
  faculty: String,
  hallOfResidence: String,
  level: Number,
  password: { type: String, required: true }
}));

const Candidate = mongoose.model('Candidate', new mongoose.Schema({
  fullName: String,
  position: String,
  department: String,
  image: String,
}));

const Vote = mongoose.model('Vote', new mongoose.Schema({
  userId: String,
  votes: {
    type: Map,
    of: String
  }
}));

// ========== ROUTES ==========

app.get('/', (_, res) => res.json({ message: '🎉 Welcome to the Election API!' }));

app.post('/signup', async (req, res) => {
  const { matricNumber, fullName, department, faculty, hallOfResidence, level, password } = req.body;
  if (!matricNumber || !fullName || !password)
    return res.status(400).json({ message: 'Required fields missing' });

  const exists = await User.findOne({ matricNumber });
  if (exists)
    return res.status(400).json({ message: 'Matric number already registered' });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    matricNumber, fullName, department, faculty, hallOfResidence, level,
    password: hashed
  });

  const { password: _, ...userData } = user.toObject();
  res.status(201).json({ message: 'Signup successful', user: userData });
});

app.post('/login', async (req, res) => {
  const { matricNumber, password } = req.body;

  const user = await User.findOne({ matricNumber });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ message: 'Invalid matric number or password' });

  const { password: _, ...userData } = user.toObject();
  res.status(200).json({ user: userData });
});

app.post('/vote', async (req, res) => {
  const { userId, candidateId, position } = req.body;
  if (!userId || !candidateId || !position)
    return res.status(400).json({ message: 'Missing fields' });

  let vote = await Vote.findOne({ userId });
  if (!vote) {
    vote = new Vote({ userId, votes: { [position]: candidateId } });
  } else {
    if (vote.votes.has(position))
      return res.status(400).json({ message: 'Already voted for this position' });
    vote.votes.set(position, candidateId);
  }

  await vote.save();
  res.json({ message: 'Vote recorded', votes: vote.votes });
});

app.get('/vote/:matricNumber', async (req, res) => {
  const vote = await Vote.findOne({ userId: req.params.matricNumber });
  res.json(vote ? vote.votes : {});
});

app.get('/results', async (_, res) => {
  try {
    const votes = await Vote.find();
    const candidates = await Candidate.find();
    const validPositions = [...new Set(candidates.map(c => c.position))];
    const results = {};

    for (const { votes: v } of votes) {
      for (const [pos, candId] of v.entries()) {
        if (!validPositions.includes(pos)) continue;
        if (!results[pos]) results[pos] = {};
        results[pos][candId] = (results[pos][candId] || 0) + 1;
      }
    }

    res.json({ results });
  } catch (err) {
    console.error('❌ Result aggregation error:', err);
    res.status(500).json({ message: 'Failed to get results', error: err.message });
  }
});

// Optional manual cleanup route
app.delete('/cleanup-invalid-votes', async (_, res) => {
  const candidates = await Candidate.find();
  const validPositions = new Set(candidates.map(c => c.position));
  const votes = await Vote.find();

  let cleaned = 0;

  for (const vote of votes) {
    const original = new Map(vote.votes);
    let changed = false;

    for (const [pos] of original.entries()) {
      if (!validPositions.has(pos)) {
        vote.votes.delete(pos);
        changed = true;
      }
    }

    if (changed) {
      await vote.save();
      cleaned++;
    }
  }

  res.json({ message: `🧹 Cleaned ${cleaned} invalid vote(s)` });
});

app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
