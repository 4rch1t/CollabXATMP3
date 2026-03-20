const express = require('express');
const Project = require('../models/Project');
const Application = require('../models/Application');
const auth = require('../middleware/auth');
const router = express.Router();

// Create project
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, category, requiredSkills, teamSize } = req.body;
    const project = await Project.create({
      title, description, category, requiredSkills, teamSize,
      owner: req.user.id, members: [req.user.id]
    });
    await project.populate('owner', 'name avatar');
    res.status(201).json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List projects (with filters)
router.get('/', async (req, res) => {
  try {
    const { category, skills, search, status } = req.query;
    let query = {};
    if (category) query.category = category;
    if (status) query.status = status; else query.status = 'open';
    if (skills) query.requiredSkills = { $in: skills.split(',').map(s => s.trim()) };
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
    const projects = await Project.find(query)
      .populate('owner', 'name avatar')
      .populate('members', 'name avatar')
      .sort({ createdAt: -1 }).limit(50);
    res.json(projects);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// My projects (owned + member-of)  — MUST be before /:id
router.get('/mine', auth, async (req, res) => {
  try {
    const owned = await Project.find({ owner: req.user.id })
      .populate('owner', 'name avatar').populate('members', 'name avatar');
    const memberOf = await Project.find({ members: req.user.id, owner: { $ne: req.user.id } })
      .populate('owner', 'name avatar').populate('members', 'name avatar');
    res.json({ owned, memberOf });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// My applications
router.get('/my-applications', auth, async (req, res) => {
  try {
    const apps = await Application.find({ applicant: req.user.id })
      .populate({ path: 'project', populate: { path: 'owner', select: 'name avatar' } });
    res.json(apps);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Join via invite code — MUST be before /:id
router.post('/join/:code', auth, async (req, res) => {
  try {
    const project = await Project.findOne({ inviteCode: req.params.code });
    if (!project) return res.status(404).json({ error: 'Invalid invite code' });
    if (project.members.map(m => m.toString()).includes(req.user.id)) return res.status(400).json({ error: 'Already a member' });
    if (project.members.length >= project.teamSize) return res.status(400).json({ error: 'Team is full' });
    project.members.push(req.user.id);
    await project.save();
    await project.populate('owner', 'name avatar');
    await project.populate('members', 'name avatar skills');
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Handle application (accept / reject)  — before /:id
router.put('/applications/:appId', auth, async (req, res) => {
  try {
    const application = await Application.findById(req.params.appId).populate('project');
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.project.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    application.status = req.body.status;
    await application.save();

    if (req.body.status === 'accepted') {
      await Project.findByIdAndUpdate(application.project._id, { $addToSet: { members: application.applicant } });
    }
    res.json(application);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get single project
router.get('/:id', async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) return res.status(400).json({ error: 'Invalid project ID' });
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name avatar skills')
      .populate('members', 'name avatar skills')
      .populate('leader', 'name avatar');
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update project
router.put('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    const allowed = ['title', 'description', 'category', 'requiredSkills', 'teamSize', 'status'];
    for (const k of allowed) { if (req.body[k] !== undefined) project[k] = req.body[k]; }
    await project.save();
    await project.populate('owner', 'name avatar');
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete project
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    await Project.findByIdAndDelete(req.params.id);
    await Application.deleteMany({ project: req.params.id });
    res.json({ message: 'Project deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Apply to project
router.post('/:id/apply', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() === req.user.id) return res.status(400).json({ error: 'Cannot apply to own project' });
    if (project.members.map(m => m.toString()).includes(req.user.id)) return res.status(400).json({ error: 'Already a member' });
    const existing = await Application.findOne({ project: req.params.id, applicant: req.user.id });
    if (existing) return res.status(400).json({ error: 'Already applied' });
    const app = await Application.create({ project: req.params.id, applicant: req.user.id, message: req.body.message || '' });
    await app.populate('applicant', 'name avatar skills');
    res.status(201).json(app);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get applications for a project (owner only)
router.get('/:id/applications', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
    const apps = await Application.find({ project: req.params.id }).populate('applicant', 'name avatar skills bio');
    res.json(apps);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Leave a project (member voluntarily leaves)
router.post('/:id/leave', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() === req.user.id) return res.status(400).json({ error: 'Owner cannot leave. Transfer ownership or delete the project.' });
    if (!project.members.map(m => m.toString()).includes(req.user.id)) return res.status(400).json({ error: 'You are not a member' });
    project.members = project.members.filter(m => m.toString() !== req.user.id);
    if (project.leader && project.leader.toString() === req.user.id) project.leader = project.owner;
    await project.save();
    res.json({ message: 'Left the project' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kick a member (owner/leader only)
router.delete('/:id/members/:memberId', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const isOwner = project.owner.toString() === req.user.id;
    const isLeader = project.leader && project.leader.toString() === req.user.id;
    if (!isOwner && !isLeader) return res.status(403).json({ error: 'Only owner or team leader can kick members' });
    if (req.params.memberId === project.owner.toString()) return res.status(400).json({ error: 'Cannot kick the project owner' });
    project.members = project.members.filter(m => m.toString() !== req.params.memberId);
    if (project.leader && project.leader.toString() === req.params.memberId) project.leader = project.owner;
    await project.save();
    await project.populate('members', 'name avatar skills');
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Transfer team leader (owner only)
router.put('/:id/leader', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.owner.toString() !== req.user.id) return res.status(403).json({ error: 'Only owner can transfer leadership' });
    if (!project.members.map(m => m.toString()).includes(req.body.memberId)) return res.status(400).json({ error: 'User is not a team member' });
    project.leader = req.body.memberId;
    await project.save();
    res.json(project);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Regenerate invite code (owner/leader only)
router.post('/:id/invite-code', auth, async (req, res) => {
  try {
    const crypto = require('crypto');
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const isOwner = project.owner.toString() === req.user.id;
    const isLeader = project.leader && project.leader.toString() === req.user.id;
    if (!isOwner && !isLeader) return res.status(403).json({ error: 'Not authorized' });
    project.inviteCode = crypto.randomBytes(4).toString('hex');
    await project.save();
    res.json({ inviteCode: project.inviteCode });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
