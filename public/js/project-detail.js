/* Project Detail page */
(function () {
  const container = document.getElementById('project-content');
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');
  if (!projectId) { container.innerHTML = '<p>No project specified.</p>'; return; }

  let project = null;
  let applications = [];
  const currentUser = getUser();

  async function load() {
    try {
      project = await api('/projects/' + projectId);
    } catch (err) {
      container.innerHTML = '<div class="empty-state"><div class="icon">!</div><h3>Project not found</h3><p style="color:var(--gray);font-size:0.85rem;margin-bottom:16px">' + escHtml(err.message) + '</p><a href="/projects.html" class="btn btn-dark">Back to Projects</a></div>';
      return;
    }

    try {
      document.title = project.title + ' — CollabX';
      renderProject();
    } catch (renderErr) {
      console.error('Render error:', renderErr);
      container.innerHTML = '<p style="color:var(--red)">Error displaying project. Please try refreshing.</p>';
    }

    try {
      if (currentUser && project.owner && project.owner._id === currentUser.id) {
        applications = await api('/projects/' + projectId + '/applications');
        renderApplications();
      }
    } catch (appErr) {
      console.error('Applications load error:', appErr);
    }
  }

  function renderProject() {
    const isOwner = currentUser && project.owner._id === currentUser.id;
    const isLeader = currentUser && project.leader && project.leader._id === currentUser.id;
    const isMember = currentUser && project.members.some(m => m._id === currentUser.id);
    const canManage = isOwner || isLeader;
    const skills = (project.requiredSkills || []).map(skillTag).join('');

const members = project.members.filter(m => m && m._id).map(m => {
      const mIsOwner = m._id === (project.owner && project.owner._id);
      const mIsLeader = project.leader && m._id === project.leader._id;
      let badge = '';
      if (mIsOwner) badge = '<span class="role-badge owner-badge">Owner</span>';
      else if (mIsLeader) badge = '<span class="role-badge leader-badge">Leader</span>';

      let kickBtn = '';
      if (canManage && !mIsOwner && m._id !== (currentUser && currentUser.id)) {
        kickBtn = '<button class="kick-btn" data-id="' + m._id + '" data-name="' + escHtml(m.name || '') + '" title="Remove member">✕</button>';
      }

      return '<div class="member-chip-wrap">'
        + '<div class="member-chip" onclick="window.location.href=\'/messages.html?user=' + m._id + '\'">' 
        + '<div class="avatar-sm" style="background:var(--red);color:#fff">' + avatarInitial(m.name || '?') + '</div>'
        + escHtml(m.name || 'Unknown') + badge
        + '</div>'
        + kickBtn
        + '</div>';
    }).join('');

    let actions = '';
    if (!currentUser) {
      actions = '<a href="/login.html" class="btn btn-red">Log in to Apply</a>';
    } else if (isOwner) {
      actions = '<span class="skill-tag" style="background:var(--black)">You own this project</span>';
    } else if (isMember) {
      actions = '<span class="skill-tag" style="background:#4CAF50">You\'re on this team! ✓</span>'
        + ' <button class="btn btn-sm btn-outline" id="leave-btn" style="margin-left:8px">Leave Team</button>';
    } else {
      actions = '<button class="btn btn-red" id="apply-btn">Apply to Join →</button>';
    }

    /* Owner management toolbar */
    let ownerToolbar = '';
    if (isOwner) {
      const statusLabel = project.status === 'open' ? 'Close Project' : project.status === 'in-progress' ? 'Mark Completed' : 'Reopen Project';
      ownerToolbar =
        '<div class="project-toolbar">'
        + '<button class="btn btn-sm btn-dark" id="edit-project-btn">Edit Project</button>'
        + '<button class="btn btn-sm btn-outline" id="status-btn">' + statusLabel + '</button>'
        + '<button class="btn btn-sm btn-outline" id="delete-project-btn" style="border-color:var(--red);color:var(--red)">Delete Project</button>'
        + '</div>';
    }

    /* Invite code section (owner/leader only) */
    let inviteSection = '';
    if (canManage && project.inviteCode) {
      inviteSection =
        '<div class="profile-section invite-section">'
        + '<h3>Invite Code</h3>'
        + '<div class="invite-row">'
        + '<code class="invite-code" id="invite-code">' + escHtml(project.inviteCode) + '</code>'
        + '<button class="btn btn-sm btn-dark" id="copy-invite">Copy</button>'
        + '<button class="btn btn-sm btn-outline" id="regen-invite">Regenerate</button>'
        + '</div>'
        + '<p class="form-hint">Share this code so others can join with <strong>/join/' + escHtml(project.inviteCode) + '</strong></p>'
        + '</div>';
    }

    /* Leader transfer (owner only) */
    let leaderSection = '';
    if (isOwner && project.members.length > 1) {
      const options = project.members
        .filter(m => m._id !== project.owner._id)
        .map(m => '<option value="' + m._id + '"' + (project.leader && m._id === project.leader._id ? ' selected' : '') + '>' + escHtml(m.name) + '</option>')
        .join('');
      leaderSection =
        '<div class="profile-section">'
        + '<h3>Team Leader</h3>'
        + '<div style="display:flex;gap:12px;align-items:center">'
        + '<select class="form-select" id="leader-select" style="max-width:260px">'
        + '<option value="">— Select leader —</option>'
        + options
        + '</select>'
        + '<button class="btn btn-sm btn-dark" id="set-leader-btn">Set Leader</button>'
        + '</div>'
        + '</div>';
    }

    container.innerHTML =
      '<div class="project-detail-header">'
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px"><span class="project-category ' + project.category + '">' + escHtml(project.category) + '</span><span style="color:var(--gray)">' + formatDate(project.createdAt) + '</span>'
      + '<span class="skill-tag-outline" style="margin-left:auto">' + project.status + '</span></div>'
      + '<h1>' + escHtml(project.title) + '</h1>'
      + '<div class="project-meta" style="margin:16px 0"><span>' + project.members.length + '/' + project.teamSize + ' members</span></div>'
      + '<div style="margin-top:16px">' + actions + '</div>'
      + ownerToolbar
      + '</div>'
      + '<div class="project-detail-body">'
      + '<div class="profile-section"><h3>Description</h3><p style="white-space:pre-wrap">' + escHtml(project.description) + '</p></div>'
      + '<div class="profile-section"><h3>Required Skills</h3><div class="tags-container">' + (skills || '<span style="color:var(--gray)">No specific skills listed</span>') + '</div></div>'
      + '<div class="profile-section"><h3>Team Members</h3><div class="members-list">' + members + '</div></div>'
      + inviteSection
      + leaderSection
      + '<div id="applications-area"></div>'
      + '</div>'
      + '<div style="margin-top:16px"><a href="/projects.html" class="btn btn-outline btn-sm">← Back to Projects</a></div>';

    /* Bind apply button */
    const applyBtn = document.getElementById('apply-btn');
    if (applyBtn) applyBtn.addEventListener('click', async () => {
      if (!(await requireCompleteProfile())) return;
      document.getElementById('apply-modal').classList.add('show');
    });

    /* Bind kick buttons */
    container.querySelectorAll('.kick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const name = btn.dataset.name;
        if (confirm('Remove ' + name + ' from the team?')) kickMember(id);
      });
    });

    /* Copy invite code */
    const copyBtn = document.getElementById('copy-invite');
    if (copyBtn) copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(project.inviteCode);
      showToast('Invite code copied!', 'success');
    });

    /* Regenerate invite code */
    const regenBtn = document.getElementById('regen-invite');
    if (regenBtn) regenBtn.addEventListener('click', async () => {
      if (!confirm('Generate a new invite code? The old one will stop working.')) return;
      try {
        const res = await api('/projects/' + projectId + '/invite-code', { method: 'POST' });
        showToast('New invite code: ' + res.inviteCode, 'success');
        load();
      } catch (err) { showToast(err.message, 'error'); }
    });

    /* Set leader */
    const leaderBtn = document.getElementById('set-leader-btn');
    if (leaderBtn) leaderBtn.addEventListener('click', async () => {
      const memberId = document.getElementById('leader-select').value;
      if (!memberId) return showToast('Select a member first', 'error');
      try {
        await api('/projects/' + projectId + '/leader', { method: 'PUT', body: { memberId } });
        showToast('Team leader updated!', 'success');
        load();
      } catch (err) { showToast(err.message, 'error'); }
    });

    /* Leave team */
    const leaveBtn = document.getElementById('leave-btn');
    if (leaveBtn) leaveBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to leave this team?')) return;
      try {
        await api('/projects/' + projectId + '/leave', { method: 'POST' });
        showToast('You left the team', 'success');
        load();
      } catch (err) { showToast(err.message, 'error'); }
    });

    /* Edit project */
    const editBtn = document.getElementById('edit-project-btn');
    if (editBtn) editBtn.addEventListener('click', () => {
      document.getElementById('edit-title').value = project.title;
      document.getElementById('edit-description').value = project.description;
      document.getElementById('edit-category').value = project.category;
      document.getElementById('edit-teamsize').value = project.teamSize;
      document.getElementById('edit-modal').classList.add('show');
    });

    /* Save edit */
    const editSave = document.getElementById('edit-save');
    if (editSave) editSave.onclick = async () => {
      editSave.disabled = true; editSave.textContent = 'Saving...';
      try {
        await api('/projects/' + projectId, {
          method: 'PUT',
          body: {
            title: document.getElementById('edit-title').value,
            description: document.getElementById('edit-description').value,
            category: document.getElementById('edit-category').value,
            teamSize: parseInt(document.getElementById('edit-teamsize').value)
          }
        });
        document.getElementById('edit-modal').classList.remove('show');
        showToast('Project updated!', 'success');
        load();
      } catch (err) { showToast(err.message, 'error'); }
      editSave.disabled = false; editSave.textContent = 'Save Changes';
    };

    /* Change status */
    const statusBtn = document.getElementById('status-btn');
    if (statusBtn) statusBtn.addEventListener('click', async () => {
      let newStatus;
      if (project.status === 'open') newStatus = 'in-progress';
      else if (project.status === 'in-progress') newStatus = 'completed';
      else newStatus = 'open';
      try {
        await api('/projects/' + projectId, { method: 'PUT', body: { status: newStatus } });
        showToast('Status changed to ' + newStatus, 'success');
        load();
      } catch (err) { showToast(err.message, 'error'); }
    });

    /* Delete project */
    const deleteBtn = document.getElementById('delete-project-btn');
    if (deleteBtn) deleteBtn.addEventListener('click', () => {
      document.getElementById('delete-modal').classList.add('show');
    });
    const deleteConfirm = document.getElementById('delete-confirm');
    if (deleteConfirm) deleteConfirm.onclick = async () => {
      deleteConfirm.disabled = true; deleteConfirm.textContent = 'Deleting...';
      try {
        await api('/projects/' + projectId, { method: 'DELETE' });
        showToast('Project deleted', 'success');
        setTimeout(() => window.location.href = '/dashboard.html', 500);
      } catch (err) {
        showToast(err.message, 'error');
        deleteConfirm.disabled = false; deleteConfirm.textContent = 'Yes, Delete';
      }
    };
  }

  async function kickMember(memberId) {
    try {
      await api('/projects/' + projectId + '/members/' + memberId, { method: 'DELETE' });
      showToast('Member removed', 'success');
      load();
    } catch (err) { showToast(err.message, 'error'); }
  }

  function renderApplications() {
    if (!applications.length) return;
    const area = document.getElementById('applications-area');
    if (!area) return;
    area.innerHTML = '<div class="applications-section"><h3 style="margin-bottom:16px">Applications (' + applications.length + ')</h3>'
      + applications.map(a => {
        const skills = (a.applicant.skills || []).map(skillTag).join('');
        const statusColors = { pending: 'var(--yellow)', accepted: '#4CAF50', rejected: 'var(--red)' };
        let btns = '';
        if (a.status === 'pending') {
          btns = '<div class="app-actions">'
            + '<button class="btn btn-sm btn-dark" onclick="handleApp(\'' + a._id + '\',\'accepted\')">Accept</button>'
            + '<button class="btn btn-sm btn-outline" onclick="handleApp(\'' + a._id + '\',\'rejected\')">Reject</button>'
            + '</div>';
        } else {
          btns = '<span class="skill-tag" style="background:' + statusColors[a.status] + '">' + a.status + '</span>';
        }
        return '<div class="app-card">'
          + '<div class="avatar-md">' + avatarInitial(a.applicant.name) + '</div>'
          + '<div class="app-info"><h4>' + escHtml(a.applicant.name) + '</h4><p>' + escHtml(a.message || 'No message') + '</p><div class="tags-container" style="margin-top:6px">' + skills + '</div></div>'
          + btns + '</div>';
      }).join('')
      + '</div>';
  }

  // Handle application accept/reject (global scope)
  window.handleApp = async function (appId, status) {
    try {
      await api('/projects/applications/' + appId, { method: 'PUT', body: { status } });
      showToast(status === 'accepted' ? 'Application accepted!' : 'Application rejected', status === 'accepted' ? 'success' : '');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Submit application
  document.getElementById('apply-submit').addEventListener('click', async () => {
    const btn = document.getElementById('apply-submit');
    btn.disabled = true; btn.textContent = 'Submitting...';
    try {
      await api('/projects/' + projectId + '/apply', {
        method: 'POST',
        body: { message: document.getElementById('apply-msg').value }
      });
      document.getElementById('apply-modal').classList.remove('show');
      showToast('Application submitted!', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Submit Application';
  });

  load();
})();
