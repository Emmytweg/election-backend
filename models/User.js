const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  matricNumber: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  department: String,
  faculty: String,
  hallOfResidence: String,
  level: Number,
  password: { type: String, required: true }
});

module.exports = mongoose.model('User', userSchema);
