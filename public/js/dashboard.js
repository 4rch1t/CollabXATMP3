/* Dashboard page logic */
(function () {
  if (!requireAuth()) return;
  const user = getUser();
  document.getElementById('greeting').textContent = 'Welcome back, ' + (user ? user.name.split(' ')[0] : '') + '!';

  let myProjects = { owned: [], memberOf: [] };
  let myApps = [];
  let activeTab = 'owned';

  async function load() {
    try {
      const [projData, appsData] = await Promise.all([
        api('/projects/mine'),
        api('/projects/my-applications')
      ]);
      myProjects = projData;
      myApps = appsData;

      document.getElementById('stat-owned').textContent = myProjects.owned.length;
      document.getElementById('stat-member').textContent = myProjects.memberOf.length;
      document.getElementById('stat-apps').textContent = myApps.filter(a => a.status === 'pending').length;

      renderTab();
    } catch (err) {
      document.getElementById('tab-content').innerHTML = '<p style="color:var(--gray)">Failed to load data.</p>';
    }
  }

  function renderTab() {
    const container = document.getElementById('tab-content');
    if (activeTab === 'owned') {
      if (!myProjects.owned.length) {
        container.innerHTML = '<div class="empty-state"><div class="icon">//</div><h3>No projects yet</h3><p>Create your first project and start building your team!</p><a href="/create-project.html" class="btn btn-red">Create Project</a></div>';
        return;
      }
      container.innerHTML = '<div class="projects-grid">' + myProjects.owned.map(projectCard).join('') + '</div>';
    } else if (activeTab === 'joined') {
      if (!myProjects.memberOf.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-mark" aria-hidden="true"></div><h3>No teams joined yet</h3><p>Browse projects and apply to join a team!</p><a href="/projects.html" class="btn btn-yellow">Browse Projects</a></div>';
        return;
      }
      container.innerHTML = '<div class="projects-grid">' + myProjects.memberOf.map(projectCard).join('') + '</div>';
    } else {
      if (!myApps.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-mark" aria-hidden="true"></div><h3>No applications</h3><p>Apply to projects to start collaborating!</p><a href="/projects.html" class="btn btn-yellow">Browse Projects</a></div>';
        return;
      }
      container.innerHTML = myApps.map(appItem).join('');
    }
  }

  function projectCard(p) {
    const skills = (p.requiredSkills || []).map(skillTag).join('');
    return '<a href="/project-detail.html?id=' + p._id + '" class="project-card" style="text-decoration:none">'
      + '<div class="project-card-header"><span class="project-category ' + p.category + '">' + escHtml(p.category) + '</span><span style="color:var(--gray);font-size:0.85rem">' + formatDate(p.createdAt) + '</span></div>'
      + '<h3>' + escHtml(p.title) + '</h3>'
      + '<p>' + escHtml(p.description).substring(0, 120) + (p.description.length > 120 ? '...' : '') + '</p>'
      + '<div class="tags-container" style="margin-bottom:12px">' + skills + '</div>'
      + '<div class="project-meta"><span>' + (p.members ? p.members.length : 1) + '/' + p.teamSize + ' members</span><span>' + p.status + '</span></div>'
      + '</a>';
  }

  function appItem(a) {
    const statusColors = { pending: 'var(--yellow)', accepted: '#4CAF50', rejected: 'var(--red)' };
    return '<div class="app-card">'
      + '<div class="app-info"><h4>' + escHtml(a.project ? a.project.title : 'Unknown') + '</h4><p>' + escHtml(a.message || 'No message') + '</p></div>'
      + '<span class="skill-tag" style="background:' + statusColors[a.status] + '">' + a.status + '</span>'
      + '</div>';
  }

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      renderTab();
    });
  });

  // Join with invite code
  const joinBtn = document.getElementById('join-invite-btn');
  const inviteInput = document.getElementById('invite-input');
  if (joinBtn) {
    joinBtn.addEventListener('click', async () => {
      const code = inviteInput.value.trim();
      if (!code) return showToast('Enter an invite code', 'error');
      if (!(await requireCompleteProfile())) return;
      joinBtn.disabled = true; joinBtn.textContent = 'Joining...';
      try {
        const project = await api('/projects/join/' + encodeURIComponent(code), { method: 'POST' });
        showToast('Joined "' + project.title + '"!', 'success');
        inviteInput.value = '';
        load();
      } catch (err) { showToast(err.message, 'error'); }
      joinBtn.disabled = false; joinBtn.textContent = 'Join Team';
    });
    inviteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinBtn.click(); });
  }

  load();
})();
