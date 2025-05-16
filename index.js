const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
// const User = require('./models/User');
// const Vote = require('./models/Vote');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;


// Middleware
app.use(cors())
// app.use(cors({
//   origin: ['http://localhost:3000', 'https://election-website-xi.vercel.app']
// }));
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB connection error:', err));
// User Schema
const User = mongoose.model('User', new mongoose.Schema({ 
  matricNumber: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  department: String,
  faculty: String,
  hallOfResidence: String,
  level: Number,
  password: { type: String, required: true }
}))

// Vote Schema
const Vote = mongoose.model('Vote', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    votes: {
      type: Map,
      of: String  // position => candidateId
    }
}));
// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Election API!' });
});

// User registration
app.post('/signup', async (req, res) => {
  try {
    const { matricNumber, fullName, department, faculty, hallOfResidence, level, password } = req.body;

    if (!matricNumber || !fullName || !password) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const existing = await User.findOne({ matricNumber });
    if (existing) {
      console.log("⚠️ User already exists:", matricNumber);
      return res.status(400).json({ message: 'Matric Number already registered. Please login instead.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      matricNumber,
      fullName,
      department,
      faculty,
      hallOfResidence,
      level,
      password: hashedPassword
    });

    await newUser.save();
    console.log("✅ User saved to DB");

    const { password: _, ...userWithoutPassword } = newUser.toObject();
    res.status(201).json({ message: 'User registered successfully', user: userWithoutPassword });

  } catch (err) {
    console.error("❌ Internal Server Error:", err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});




// User login
app.post('/login', async (req, res) => {
  const { matricNumber, password } = req.body;

  const user = await User.findOne({ matricNumber });
  if (!user) {
    return res.status(401).json({ message: 'Invalid matric number or password' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid matric number or password' });
  }

  const { password: _, ...userData } = user.toObject();
  res.status(200).json({ user: userData });
});

// Vote
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

// Get votes
app.get('/votes', async (req, res) => {
  const votes = await Vote.find().populate('userId', 'matricNumber fullName');
  res.json({ votes });
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
