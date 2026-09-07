const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  const header = req.header('Authorization');
  if (!header) return res.status(401).json({ error: 'No token, access denied' });

  const token = header.replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch user from DB to get email
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Check if user email matches admin email
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail || user.email !== adminEmail) {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    req.user.email = user.email;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token or not authorized' });
  }
};
