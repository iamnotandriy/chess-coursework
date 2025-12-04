const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = 'chess_secret_key_2025';

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'User created' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, userId: user._id, username: user.username, rating: user.rating });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// get user stats
router.get('/stats/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // calculate rank
    const higherRankedUsers = await User.countDocuments({ rating: { $gt: user.rating } });
    const rank = higherRankedUsers + 1;

    const userData = user.toObject();
    userData.rank = rank;

    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// update profile
router.put('/profile/:userId', async (req, res) => {
  try {
    const { bio, avatar, isPrivate } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (isPrivate !== undefined) user.isPrivate = isPrivate;

    await user.save();
    res.json({ message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const topUsers = await User.find({})
      .sort({ rating: -1 })
      .limit(10)
      .select('username rating avatar isPrivate wins matches');
    
    res.json(topUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;