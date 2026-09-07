const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const Project = require('../models/Project');
const User = require('../models/User');
const Application = require('../models/Application');
const router = express.Router();

// Get admin dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalApplications = await Application.countDocuments();
    const openProjects = await Project.countDocuments({ status: 'open' });

    res.json({
      totalProjects,
      totalUsers,
      totalApplications,
      openProjects
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all projects with pagination
router.get('/projects', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (page - 1) * limit;
    
    let query = {};
    if (status) query.status = status;

    const projects = await Project.find(query)
      .populate('owner', 'name email avatar')
      .populate('members', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Project.countDocuments(query);

    res.json({
      projects,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: projects.length,
        total: total
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('name email skills interests createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments();

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        count: users.length,
        total: total
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete project
router.delete('/projects/:id', adminAuth, async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    
    // Also delete related applications
    await Application.deleteMany({ project: req.params.id });

    res.json({ message: 'Project deleted successfully', project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Delete all projects owned by this user
    await Project.deleteMany({ owner: req.params.id });
    
    // Delete applications from this user
    await Application.deleteMany({ applicant: req.params.id });

    res.json({ message: 'User deleted successfully', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update project status (open, in-progress, completed)
router.put('/projects/:id/status', adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'in-progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('owner', 'name avatar');

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
