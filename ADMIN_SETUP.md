# Admin Dashboard Setup — CollabX

## Overview
A secure admin dashboard has been implemented for CollabX with role-based access control using environment variables. Only the specified admin email can access admin features.

## Features Implemented

### 1. **Non-Hardcoded Admin Email**
- **File**: `/server/.env`
- **Variable**: `ADMIN_EMAIL=kumararchit410@gmail.com`
- Can be easily changed by updating the environment variable without code changes

### 2. **Admin Authentication Middleware**
- **File**: `/server/middleware/adminAuth.js`
- Validates JWT token and checks if user's email matches ADMIN_EMAIL
- Returns 403 Forbidden if user is not admin
- Fetches user from database to verify email

### 3. **Admin API Endpoints**
- **Base Path**: `/api/admin`
- All endpoints require admin authentication via `adminAuth` middleware

#### Endpoints Available:
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/stats` | Dashboard statistics (total projects, users, applications) |
| GET | `/api/admin/projects` | List all projects with pagination & filtering |
| GET | `/api/admin/users` | List all users with pagination |
| DELETE | `/api/admin/projects/:id` | Delete a project (cascades to applications) |
| DELETE | `/api/admin/users/:id` | Delete a user (cascades to owned projects & applications) |
| PUT | `/api/admin/projects/:id/status` | Update project status (open/in-progress/completed) |

### 4. **Admin Dashboard UI**
- **File**: `/public/admin.html`
- **Access**: Only visible to admin users
- **Features**:
  - **Stats Tab**: View key metrics (projects, users, applications, open projects)
  - **Projects Tab**: 
    - Paginated list of all projects
    - Filter by status
    - Delete projects with confirmation
    - View project owner, category, team size, and creation date
  - **Users Tab**:
    - Paginated list of all users
    - Delete users with confirmation (cascades to their projects)
    - View user skills and join date

### 5. **Admin Link Visibility**
- Added to all page navbars: `/public/*.html`
- Only visible to authenticated admin users
- Styled in yellow (brand color) for visibility
- Automatically hidden/shown based on admin access check

### 6. **Frontend Integration**
- **File**: `/public/js/app.js`
- **Function**: `checkAdminAccess()`
- Runs on page load for all pages
- Makes silent request to `/api/admin/stats` to check admin status
- Shows/hides admin link accordingly
- No error messages for non-admin users

## Access Control Flow

```
User Logs In
    ↓
[JWT Token Stored in localStorage]
    ↓
Page Loads → app.js checkAdminAccess()
    ↓
[If admin] → Admin link becomes visible
[If not admin] → Admin link stays hidden
    ↓
User clicks Admin → admin.html loads
    ↓
checkAdminAccess() verifies token
    ↓
[If authorized] → Dashboard loads with data
[If not authorized] → Redirected to dashboard
```

## Database Cascading Deletes

When deleting through the admin panel:
- **Delete Project**: Also removes all applications for that project
- **Delete User**: Removes all projects owned by user + all their applications

## How to Use

### As Admin (kumararchit410@gmail.com):
1. Log in to CollabX with your admin email
2. "Admin" link will appear in the navbar (in yellow)
3. Click "Admin" to access the dashboard
4. View statistics, projects, and users
5. Delete projects or users as needed

### As Regular User:
- Admin link is not visible
- Admin endpoints return 403 Forbidden if accessed directly
- No indication of admin functionality exists

## Configuration

To change the admin email:
1. Edit `/server/.env`
2. Update the `ADMIN_EMAIL` variable
3. Restart the server

```env
ADMIN_EMAIL=newemail@example.com
```

## Security Notes

✓ Admin email stored in environment variable (not in code)
✓ JWT token validation required
✓ Email verification from database on each request
✓ No hardcoded credentials
✓ Cascading deletes to maintain data integrity
✓ Admin link hidden from non-admin users
✓ Confirmation dialogs before destructive actions

## Files Modified/Created

- ✅ `/server/.env` — Created with ADMIN_EMAIL
- ✅ `/server/middleware/adminAuth.js` — Created admin auth middleware
- ✅ `/server/routes/admin.js` — Created admin API routes
- ✅ `/server/server.js` — Added admin route registration
- ✅ `/public/admin.html` — Created admin dashboard UI
- ✅ `/public/js/app.js` — Added admin access checker
- ✅ All navbar files — Added admin link (8 pages)
