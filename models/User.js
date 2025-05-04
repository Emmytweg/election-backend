const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  matricNumber: { type: String, unique: true, required: true },
  fullName: String,
  department: String,
  faculty: String,
  hallOfResidence: String,
  level: String,
  password: String
});

module.exports = mongoose.model('User', userSchema);
