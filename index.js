const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// === Schemas ===

// User Schema
const User = mongoose.model('User', new mongoose.Schema({
  matricNumber: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  department: String,
  faculty: String,
  hallOfResidence: String,
  level: Number,
  password: { type: String, required: true }
}));

// Candidate Schema
const Candidate = mongoose.model('Candidate', new mongoose.Schema({
  fullName: String,
  position: String,
  department: String,
  image: String,
}));

// Vote Schema
const Vote = mongoose.model('Vote', new mongoose.Schema({
  userId: { type: String, required: true },  // matricNumber
  votes: {
    type: Map,
    of: String // position => candidateId
  }
}));

// === Routes ===

// Welcome route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Election API!' });
});

// Signup
app.post('/signup', async (req, res) => {
  try {
    const { matricNumber, fullName, department, faculty, hallOfResidence, level, password } = req.body;
    if (!matricNumber || !fullName || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await User.findOne({ matricNumber });
    if (existing) {
      return res.status(400).json({ message: 'Matric Number already registered. Please login instead.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      matricNumber, fullName, department, faculty, hallOfResidence, level, password: hashedPassword
    });

    await newUser.save();
    const { password: _, ...userWithoutPassword } = newUser.toObject();
    res.status(201).json({ message: 'User registered successfully', user: userWithoutPassword });

  } catch (err) {
    console.error("❌ Signup Error:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { matricNumber, password } = req.body;

  const user = await User.findOne({ matricNumber });
  if (!user) return res.status(401).json({ message: 'Invalid matric number or password' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: 'Invalid matric number or password' });

  const { password: _, ...userData } = user.toObject();
  res.status(200).json({ user: userData });
});

// Submit vote
app.post('/vote', async (req, res) => {
  try {
    const { userId, candidateId, position } = req.body;
    if (!userId || !candidateId || !position) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    let userVote = await Vote.findOne({ userId });

    if (!userVote) {
      userVote = new Vote({ userId, votes: { [position]: candidateId } });
    } else {
      if (userVote.votes.has(position)) {
        return res.status(400).json({ message: 'You have already voted for this position.' });
      }
      userVote.votes.set(position, candidateId);
    }

    await userVote.save();
    res.status(200).json({ message: 'Vote recorded successfully.', votes: userVote.votes });

  } catch (err) {
    console.error('❌ Vote Error:', err);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
  }
});

// Get votes by user
app.get('/vote/:matricNumber', async (req, res) => {
  try {
    const { matricNumber } = req.params;
    const vote = await Vote.findOne({ userId: matricNumber });

    if (!vote) return res.json({});
    res.json(vote.votes);
  } catch (err) {
    console.error('❌ Fetch vote error:', err);
    res.status(500).json({ message: 'Error retrieving votes', error: err.message });
  }
});

// Aggregated vote results (cleaned)
app.get('/results', async (req, res) => {
  try {
    const allVotes = await Vote.find();
    const allCandidates = await Candidate.find();
    const validPositions = [...new Set(allCandidates.map(c => c.position))];

    const results = {};

    allVotes.forEach(({ votes }) => {
      for (let [position, candidateId] of votes.entries()) {
        if (!validPositions.includes(position)) {
          console.log(`🧹 Skipping invalid position: ${position}`);
          continue;
        }

        if (!results[position]) results[position] = {};
        results[position][candidateId] = (results[position][candidateId] || 0) + 1;
      }
    });

    res.status(200).json({ results });
  } catch (err) {
    console.error('❌ Error aggregating results:', err);
    res.status(500).json({ message: 'Failed to get results', error: err.message });
  }
});

// Optional route to delete invalid votes (manual cleanup)
app.delete('/cleanup-invalid-votes', async (req, res) => {
  try {
    const allCandidates = await Candidate.find();
    const validPositions = new Set(allCandidates.map(c => c.position));

    const allVotes = await Vote.find();

    let cleaned = 0;

    for (let vote of allVotes) {
      const original = new Map(vote.votes);
      let updated = false;

      for (let [pos] of original.entries()) {
        if (!validPositions.has(pos)) {
          vote.votes.delete(pos);
          updated = true;
        }
      }

      if (updated) {
        await vote.save();
        cleaned++;
      }
    }

    res.json({ message: `🧹 Cleaned ${cleaned} vote record(s) with invalid positions.` });
  } catch (err) {
    console.error('❌ Cleanup error:', err);
    res.status(500).json({ message: 'Failed to clean up invalid votes', error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
