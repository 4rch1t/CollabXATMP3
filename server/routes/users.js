const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update current user
router.put('/me', auth, async (req, res) => {
  try {
    const allowed = ['name', 'bio', 'skills', 'interests', 'github', 'linkedin', 'resume', 'avatar'];
    const updates = {};
    for (const key of allowed) { if (req.body[key] !== undefined) updates[key] = req.body[key]; }

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Search / list users
router.get('/', auth, async (req, res) => {
  try {
    const { skills, search } = req.query;
    let query = {};
    if (skills) query.skills = { $in: skills.split(',').map(s => s.trim()) };
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { skills: { $regex: search, $options: 'i' } }
    ];
    const users = await User.find(query).select('-password').limit(50);
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get user by id
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
