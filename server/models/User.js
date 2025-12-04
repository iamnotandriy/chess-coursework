const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rating: { type: Number, default: 1200 },
  matches: { type: Number, default: 0 },
  wins: { type: Number, default: 0 },
  avatar: { type: String, default: '' },
  bio: { type: String, default: 'Chess enthusiast' },
  isPrivate: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);