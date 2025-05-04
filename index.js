// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/User');
const Vote = require('./models/Vote');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'https://election-website-xi.vercel.app' , '*']
}));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ Connected to MongoDB Atlas'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Election API!' });
});

// Register a new user
app.post('/users', async (req, res) => {
  const { matricNumber, fullName, department, faculty, hallOfResidence, level, password } = req.body;

  if (!matricNumber || !fullName || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const existing = await User.findOne({ matricNumber });
  if (existing) {
    return res.status(400).json({ message: 'Matric Number already registered. Please login instead.' });
  }

  const newUser = new User({ matricNumber, fullName, department, faculty, hallOfResidence, level, password });
  await newUser.save();

  const { password: _, ...userWithoutPassword } = newUser.toObject();
  res.status(201).json({ message: 'User registered successfully', user: userWithoutPassword });
});

// Login
app.post('/login', async (req, res) => {
  const { matricNumber, password } = req.body;

  const user = await User.findOne({ matricNumber, password });
  if (!user) {
    return res.status(401).json({ message: 'Invalid matric number or password' });
  }

  const { password: _, ...userData } = user.toObject();
  res.status(200).json({ user: userData });
});

// Cast a vote
app.post('/vote', async (req, res) => {
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
});

// GET all votes
app.get('/votes', async (req, res) => {
  const votes = await Vote.find().populate('userId', 'matricNumber fullName');
  res.json({ votes });
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server is running on http://localhost:${port}`);
});
