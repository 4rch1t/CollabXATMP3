# CollabX Codebase Analysis

## Project Overview
CollabX is a full-stack collaboration platform enabling users to create, discover, and join team projects. Built with Node.js/Express backend, MongoDB database, and Socket.io for real-time messaging. Features skill-based team matching, project management, and real-time chat capabilities.

---

## 1. Authentication Mechanism

### Authentication Methods

#### A. Email/Password Authentication
- **Route**: `POST /api/auth/register` and `POST /api/auth/login`
- **Process**:
  - Passwords hashed with bcryptjs (salt rounds: 12)
  - JWT tokens generated with 7-day expiration
  - Token stored in `Authorization: Bearer <token>` header

#### B. Google OAuth 2.0
- **Route**: `POST /api/auth/google`
- **Process**:
  - Verifies Google ID token from frontend
  - Links to existing email or creates new user
  - Uses `google-auth-library` for token verification
  - Requires `GOOGLE_CLIENT_ID` environment variable

### Token Management
- **Token Type**: JWT (JSON Web Token)
- **Secret Key**: `process.env.JWT_SECRET`
- **Expiration**: 7 days
- **Storage**: Browser localStorage as `collabx_token`
- **Verification**: Custom middleware checks Bearer token in Authorization header

### Middleware Protection
- **File**: `server/middleware/auth.js`
- **Function**: Validates JWT and extracts user ID (`req.user.id`)
- **Applied to**: Protected routes requiring authentication

### Session Handling
- **Frontend**: Stored in localStorage
  - `collabx_token`: JWT token
  - `collabx_user`: User object (JSON)
- **Logout**: Clears localStorage and redirects to login
- **Auto-redirect**: 401 responses trigger re-login

---

## 2. Database Schema

### Technology Stack
- **Database**: MongoDB (with fallback to in-memory for local development)
- **ODM**: Mongoose
- **Connection**: Atlas (production) or MongoDB Memory Server (development)

### User Schema (`server/models/User.js`)
```javascript
{
  name:       String (required, trimmed),
  email:      String (required, unique, lowercase),
  password:   String (optional for OAuth users),
  googleId:   String (unique for OAuth, sparse index),
  bio:        String (default: empty),
  skills:     [String] (array of skill tags),
  interests:  [String] (array of interest tags),
  avatar:     String (profile picture URL),
  github:     String (GitHub profile URL),
  linkedin:   String (LinkedIn profile URL),
  resume:     String (resume URL or text),
  createdAt:  Date (default: now)
}
```

**Key Features**:
- Supports both traditional and OAuth authentication
- Skills required for project creation (enforced by `requireProfile` middleware)
- Avatar auto-populated from Google profile picture

### Project Schema (`server/models/Project.js`)
```javascript
{
  title:           String (required, trimmed),
  description:     String (required),
  owner:           ObjectId (ref: User, required),
  category:        String (enum: ['hackathon', 'project', 'startup', 'research']),
  requiredSkills:  [String] (skills needed for team),
  teamSize:        Number (default: 4, max team members),
  members:         [ObjectId] (ref: User, includes owner),
  leader:          ObjectId (ref: User, project lead, defaults to owner),
  inviteCode:      String (unique, auto-generated hex, sparse index),
  status:          String (enum: ['open', 'in-progress', 'completed'], default: 'open'),
  createdAt:       Date (default: now)
}
```

**Key Features**:
- Auto-generates 4-byte hex invite code on creation
- Leader defaults to owner but can be changed
- Members array includes project owner
- Status tracks project lifecycle

### Application Schema (`server/models/Application.js`)
```javascript
{
  project:    ObjectId (ref: Project, required),
  applicant:  ObjectId (ref: User, required),
  message:    String (applicant cover letter, default: empty),
  status:     String (enum: ['pending', 'accepted', 'rejected'], default: 'pending'),
  createdAt:  Date (default: now)
}
```

**Key Features**:
- Tracks project membership applications
- Stores applicant motivation message
- Owner can accept/reject applications
- Accepted applications auto-add user to project members

### Message Schema (`server/models/Message.js`)
```javascript
{
  sender:     ObjectId (ref: User, required),
  receiver:   ObjectId (ref: User, required),
  content:    String (required),
  read:       Boolean (default: false),
  createdAt:  Date (default: now)
}
```

**Key Features**:
- One-to-one messaging between users
- Read status tracking
- Populated with sender name/avatar for frontend

---

## 3. Main API Endpoints

### Authentication Routes (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Register new user (email/password) |
| POST | `/login` | ❌ | Login with email/password |
| POST | `/google` | ❌ | Google OAuth login/signup |

### User Routes (`/api/users`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/me` | ✅ | Get current user profile |
| PUT | `/me` | ✅ | Update current user (bio, skills, social links) |
| GET | `/` | ✅ | Search/list users by skills or name |
| GET | `/:id` | ✅ | Get user by ID |

### Project Routes (`/api/projects`)
| Method | Endpoint | Auth | Profile* | Description |
|--------|----------|------|---------|-------------|
| POST | `/` | ✅ | ✅ | Create new project |
| GET | `/` | ❌ | ❌ | List projects (public, open status) with filters |
| GET | `/mine` | ✅ | ❌ | Get user's owned + member-of projects |
| GET | `/my-applications` | ✅ | ❌ | Get applications submitted by user |
| POST | `/join/:code` | ✅ | ✅ | Join project via invite code |
| POST | `/:id/apply` | ✅ | ✅ | Apply to join a project |
| PUT | `/applications/:appId` | ✅ | ❌ | Accept/reject application (owner only) |
| GET | `/:id` | ❌ | ❌ | Get single project details |
| PUT | `/:id` | ✅ | ❌ | Update project (owner only) |
| DELETE | `/:id` | ✅ | ❌ | Delete project (owner only) |
| GET | `/:id/applications` | ✅ | ❌ | List applications (owner only) |
| POST | `/:id/leave` | ✅ | ❌ | Member voluntarily leaves project |
| DELETE | `/:id/members/:memberId` | ✅ | ❌ | Kick member (owner/leader only) |

**Profile* = Requires completed profile (bio + ≥1 skill)

### Message Routes (`/api/messages`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/conversations` | ✅ | Get list of conversations with unread count |
| GET | `/:userId` | ✅ | Get message history with specific user (last 200) |
| POST | `/` | ✅ | Send message |
| PUT | `/:id/read` | ✅ | Mark message as read |

### Config Routes (`/api/config`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/google-client-id` | ❌ | Expose Google Client ID to frontend |

---

## 4. Role-Based Access Control & Authorization

### Authorization Patterns

#### A. Owner-Only Authorization
Applied to: Project updates, deletion, application handling
```javascript
if (project.owner.toString() !== req.user.id) 
  return res.status(403).json({ error: 'Not authorized' });
```

#### B. Owner/Leader Authorization
Applied to: Kicking members from project
```javascript
const isOwner = project.owner.toString() === req.user.id;
const isLeader = project.leader && project.leader.toString() === req.user.id;
if (!isOwner && !isLeader) 
  return res.status(403).json({ error: 'Only owner or team leader can kick members' });
```

#### C. Profile Completion Requirement
Applied to: Project creation, join, apply
- User must have: Non-empty bio AND ≥1 skill in array
- Checked via `requireProfile` middleware
- Prevents incomplete profiles from joining teams

#### D. Team Size Validation
- Users can only join projects if `members.length < teamSize`
- Prevents over-subscription

#### E. Membership Checks
- Cannot apply to own project
- Cannot apply twice to same project
- Cannot join if already a member
- Cannot kick project owner

### No Admin Role
- **Current Status**: No super-admin or admin role implemented
- **Access Control**: Owner-based (project level) only
- **Future Opportunity**: Could implement admin dashboard for system-wide operations

---

## 5. Environment Variables

### Required Configuration
```bash
# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/collabx

# Authentication
JWT_SECRET=your-secret-key-for-signing-tokens

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Server
PORT=3000 (default: 3000)
```

### Fallback Behavior
- **MongoDB**: Falls back to in-memory MongoDB Server if Atlas unavailable
- **Google Client ID**: Optional (empty string if not provided)
- **PORT**: Defaults to 3000

### Location
- Server looks for `.env` file in `server/` directory
- Loaded via `dotenv` package on server startup

---

## 6. Real-Time Features (Socket.io)

### WebSocket Events

#### Server Events Handled
- `connection`: User connects to socket
- `register`: User registers with userId
- `sendMessage`: User sends direct message
- `typing`: User typing indicator
- `disconnect`: User disconnects

#### Client Events Emitted
- `onlineUsers`: List of currently online user IDs
- `newMessage`: New message received
- `userTyping`: User is typing indicator

### Implementation
- Maintains `onlineUsers` Map (userId → socketId)
- Broadcasts online status to all connected clients
- Routing messages via socket map for direct delivery
- Auto-cleanup on disconnect

---

## 7. Security Features

### Authentication Security
- ✅ Password hashing with bcryptjs (12 rounds)
- ✅ JWT token-based stateless auth
- ✅ 7-day token expiration
- ✅ Google OAuth 2.0 with token verification
- ✅ Authorization header validation

### Data Protection
- ✅ Password fields excluded from user responses (`.select('-password')`)
- ✅ Email uniqueness enforced (prevents duplicate registration)
- ✅ Owner-based authorization on sensitive operations

### Input Validation
- ✅ Required field validation (name, email, password)
- ✅ Email lowercase + trim normalization
- ✅ Profile completion checks
- ✅ Project ID format validation (MongoDB ObjectId)
- ✅ Team size enforcement
- ✅ Invite code uniqueness

### Limitations/Future Improvements
- ⚠️ No admin role for system oversight
- ⚠️ No rate limiting on auth endpoints
- ⚠️ No email verification for registration
- ⚠️ No password reset mechanism
- ⚠️ No 2FA support

---

## 8. Frontend Architecture

### Token & Auth Management (`public/js/app.js`)
```javascript
// Storage keys
localStorage.collabx_token    // JWT token
localStorage.collabx_user     // User object (JSON)

// Helper functions
getToken()               // Retrieve JWT
getUser()               // Retrieve user object
setAuth(token, user)    // Set both
clearAuth()             // Clear both & redirect
isLoggedIn()            // Check if authenticated
requireAuth()           // Redirect to login if not authenticated
requireCompleteProfile()// Check profile completion
```

### API Client (`api()` function)
- Automatically attaches JWT to all requests
- Handles 401 redirects to login
- Converts JSON body to string
- Handles FormData for file uploads

### UI Helpers
- `updateNav()`: Shows/hides auth-only and guest-only elements
- `showToast()`: Display toast notifications
- `skillTag()`: Render skill badges with consistent coloring
- `formatDate()`: Relative time formatting (e.g., "2h ago")

---

## 9. Project Structure Summary

```
collabX/
├── server/
│   ├── server.js                 # Express app, MongoDB connection, Socket.io
│   ├── package.json              # Dependencies (Express, Mongoose, JWT, etc.)
│   ├── middleware/
│   │   └── auth.js               # JWT verification middleware
│   ├── models/
│   │   ├── User.js               # User schema
│   │   ├── Project.js            # Project schema
│   │   ├── Application.js        # Project application schema
│   │   └── Message.js            # Direct message schema
│   └── routes/
│       ├── auth.js               # /api/auth endpoints
│       ├── users.js              # /api/users endpoints
│       ├── projects.js           # /api/projects endpoints
│       └── messages.js           # /api/messages endpoints
├── public/
│   ├── index.html                # Home page
│   ├── login.html                # Login page
│   ├── register.html             # Registration page
│   ├── dashboard.html            # User dashboard
│   ├── projects.html             # Browse projects
│   ├── create-project.html       # Create project form
│   ├── project-detail.html       # Single project view
│   ├── messages.html             # Messaging interface
│   ├── profile.html              # User profile edit
│   ├── css/
│   │   └── style.css             # Shared styles
│   └── js/
│       ├── app.js                # Common utilities & auth
│       ├── login.js (implicit)   # Login form handler
│       ├── dashboard.js          # Dashboard logic
│       ├── projects.js           # Projects browse logic
│       ├── create-project.js     # Project creation logic
│       ├── project-detail.js     # Project detail logic
│       ├── messages.js           # Messaging logic
│       └── profile.js            # Profile edit logic
├── README.md                     # Project overview
└── CODEBASE_ANALYSIS.md         # This file
```

---

## 10. Data Flow Examples

### Registration Flow
1. User submits name/email/password on `/register.html`
2. Frontend calls `POST /api/auth/register`
3. Server: Hash password, create User document, generate JWT
4. Server: Return token + user object
5. Frontend: Store in localStorage, redirect to `/dashboard.html`

### Project Creation Flow
1. User on `/create-project.html` (must be logged in + profile complete)
2. Frontend calls `POST /api/projects` with title/description/skills/teamSize
3. Server: Verify auth + profile completion
4. Server: Create Project with owner=currentUser, auto-generate inviteCode
5. Frontend: Redirect to `/project-detail.html?id=<projectId>`

### Project Joining Flow (2 Methods)
**Method 1: Invite Code**
1. User has invite code
2. Calls `POST /api/projects/join/:code` (requires profile)
3. Server: Find project by code, verify space, add to members array

**Method 2: Application**
1. User views project on `/projects.html`
2. Clicks "Apply" → submits cover letter
3. Calls `POST /api/projects/:id/apply`
4. Server: Create Application with status='pending'
5. Project owner reviews on `/project-detail.html`
6. Owner calls `PUT /api/projects/applications/:appId` with status='accepted'
7. Server: Auto-adds applicant to project.members

### Real-Time Messaging Flow
1. User sends message on `/messages.html`
2. Frontend emits `socket.emit('sendMessage', {senderId, receiverId, content})`
3. Socket server: Save Message to DB, populate sender
4. Socket server: Emit `newMessage` to receiver (if online)
5. Both users receive message (receiver via socket, sender via response)

---

## 11. Performance & Limitations

### Current Constraints
- **Message Limit**: 200 messages per conversation (limits)
- **User Search**: Max 50 results
- **Project List**: Max 50 results
- **No Pagination**: Frontend handles limit-based results

### Optimization Opportunities
1. Implement pagination for large datasets
2. Add caching for frequently accessed projects/users
3. Implement message archiving
4. Add database indexing on frequently queried fields

---

## 12. Deployment Notes

### Production Requirements
- MongoDB Atlas cluster with credentials
- Google OAuth client ID and secret
- JWT secret key (strong random string)
- Server hosting (Render, Heroku, AWS, etc.)
- Frontend served via Express static middleware

### Current Deployment
- **Live URL**: https://collab-x-n32g.onrender.com
- **Database**: MongoDB Atlas (with fallback to memory)

---

## Summary Table: Key Endpoints

| Feature | Endpoint | Auth | Notes |
|---------|----------|------|-------|
| **Login** | POST /api/auth/login | ❌ | Email/password |
| **Register** | POST /api/auth/register | ❌ | Email/password |
| **Google Auth** | POST /api/auth/google | ❌ | OAuth 2.0 |
| **Create Project** | POST /api/projects | ✅ | Profile required |
| **Browse Projects** | GET /api/projects | ❌ | Public, open only |
| **Apply to Project** | POST /api/projects/:id/apply | ✅ | Profile required |
| **Join via Code** | POST /api/projects/join/:code | ✅ | Profile required |
| **My Projects** | GET /api/projects/mine | ✅ | Owned + member-of |
| **Send Message** | Socket: sendMessage | ✅ | Real-time |
| **Get Conversations** | GET /api/messages/conversations | ✅ | With unread count |

