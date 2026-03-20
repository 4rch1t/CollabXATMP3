const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String },
  googleId:  { type: String, unique: true, sparse: true },
  bio:       { type: String, default: '' },
  skills:    [{ type: String, trim: true }],
  interests: [{ type: String, trim: true }],
  avatar:    { type: String, default: '' },
  github:    { type: String, default: '' },
  linkedin:  { type: String, default: '' },
  resume:    { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
