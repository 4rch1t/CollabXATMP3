/* Projects browse page */
(function () {
  const container = document.getElementById('projects-container');
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  let debounceTimer;

  async function load() {
    container.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
    try {
      const params = new URLSearchParams();
      const search = searchInput.value.trim();
      const category = categoryFilter.value;
      if (search) params.set('search', search);
      if (category) params.set('category', category);

      const projects = await api('/projects?' + params.toString());
      if (!projects.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-mark" aria-hidden="true"></div><h3>No projects found</h3><p>Try adjusting your search or filters</p></div>';
        return;
      }
      container.innerHTML = '<div class="projects-grid">' + projects.map(projectCard).join('') + '</div>';
    } catch (err) {
      container.innerHTML = '<p style="color:var(--gray)">Failed to load projects.</p>';
    }
  }

  function projectCard(p) {
    const skills = (p.requiredSkills || []).map(skillTag).join('');
    const ownerName = p.owner ? p.owner.name : 'Unknown';
    return '<a href="/project-detail.html?id=' + p._id + '" class="project-card" style="text-decoration:none">'
      + '<div class="project-card-header"><span class="project-category ' + p.category + '">' + escHtml(p.category) + '</span><span style="color:var(--gray);font-size:0.85rem">' + formatDate(p.createdAt) + '</span></div>'
      + '<h3>' + escHtml(p.title) + '</h3>'
      + '<p>' + escHtml(p.description).substring(0, 140) + (p.description.length > 140 ? '...' : '') + '</p>'
      + '<div class="tags-container" style="margin-bottom:12px">' + skills + '</div>'
      + '<div class="project-card-footer">'
      + '<div class="project-owner"><div class="avatar-sm">' + avatarInitial(ownerName) + '</div>' + escHtml(ownerName) + '</div>'
      + '<span style="color:var(--gray);font-size:0.85rem">' + (p.members ? p.members.length : 1) + '/' + p.teamSize + ' members</span>'
      + '</div></a>';
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(load, 400);
  });
  categoryFilter.addEventListener('change', load);

  load();
})();
