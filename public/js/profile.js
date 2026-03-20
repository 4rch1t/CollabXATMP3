/* Profile page */
(function () {
  if (!requireAuth()) return;

  let userData = null;
  const skillsInput = setupTagInput('edit-skills-wrapper', 'edit-skills-hidden');
  const interestsInput = setupTagInput('edit-interests-wrapper', 'edit-interests-hidden');

  function calcProgress(u) {
    const fields = [
      { label: 'Bio', done: !!u.bio },
      { label: 'Skills', done: u.skills && u.skills.length > 0 },
      { label: 'Interests', done: u.interests && u.interests.length > 0 },
      { label: 'GitHub', done: !!u.github },
      { label: 'LinkedIn', done: !!u.linkedin },
      { label: 'Resume', done: !!u.resume }
    ];
    const completed = fields.filter(f => f.done).length;
    const percent = Math.round((completed / fields.length) * 100);
    const missing = fields.filter(f => !f.done).map(f => f.label);
    return { percent, missing };
  }

  function renderProgress() {
    const { percent, missing } = calcProgress(userData);
    const card = document.getElementById('profile-progress-card');
    const fill = document.getElementById('progress-bar-fill');
    const pct = document.getElementById('progress-percent');
    const hint = document.getElementById('progress-hint');
    card.style.display = '';
    fill.style.width = percent + '%';
    pct.textContent = percent + '%';
    if (percent === 100) {
      hint.textContent = 'Your profile is complete!';
      card.classList.add('complete');
    } else {
      hint.textContent = 'Add ' + missing.join(', ') + ' to complete your profile.';
      card.classList.remove('complete');
    }
  }

  async function load() {
    try {
      userData = await api('/users/me');
      render();
      renderProgress();
    } catch (err) {
      showToast('Failed to load profile', 'error');
    }
  }

  function render() {
    document.getElementById('profile-avatar').textContent = avatarInitial(userData.name);
    document.getElementById('profile-name').textContent = userData.name;
    document.getElementById('profile-email').textContent = userData.email;
    document.getElementById('profile-bio').textContent = userData.bio || 'No bio yet.';
    document.getElementById('profile-skills').innerHTML = (userData.skills || []).map(skillTag).join('') || '<span style="color:var(--gray)">No skills added</span>';
    document.getElementById('profile-interests').innerHTML = (userData.interests || []).map(s => '<span class="skill-tag-outline">' + escHtml(s) + '</span>').join('') || '<span style="color:var(--gray)">No interests added</span>';
    document.getElementById('profile-github').textContent = userData.github || '—';
    document.getElementById('profile-linkedin').textContent = userData.linkedin || '—';

    const resumeEl = document.getElementById('profile-resume');
    if (userData.resume) {
      resumeEl.innerHTML = '<a href="' + escHtml(userData.resume) + '" target="_blank" rel="noopener noreferrer" style="color:var(--red)">View Resume</a>';
    } else {
      resumeEl.textContent = '—';
    }
  }

  document.getElementById('edit-btn').addEventListener('click', () => {
    document.getElementById('view-mode').style.display = 'none';
    document.getElementById('edit-mode').style.display = 'block';
    document.getElementById('edit-name').value = userData.name;
    document.getElementById('edit-bio').value = userData.bio || '';
    document.getElementById('edit-github').value = userData.github || '';
    document.getElementById('edit-linkedin').value = userData.linkedin || '';
    document.getElementById('edit-resume').value = userData.resume || '';
    skillsInput.setTags(userData.skills || []);
    interestsInput.setTags(userData.interests || []);
  });

  document.getElementById('cancel-edit').addEventListener('click', () => {
    document.getElementById('view-mode').style.display = 'block';
    document.getElementById('edit-mode').style.display = 'none';
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      userData = await api('/users/me', {
        method: 'PUT',
        body: {
          name: document.getElementById('edit-name').value,
          bio: document.getElementById('edit-bio').value,
          skills: skillsInput.getTags(),
          interests: interestsInput.getTags(),
          github: document.getElementById('edit-github').value,
          linkedin: document.getElementById('edit-linkedin').value,
          resume: document.getElementById('edit-resume').value
        }
      });
      // Update stored user
      const stored = getUser();
      stored.name = userData.name;
      stored.skills = userData.skills;
      stored.bio = userData.bio;
      setAuth(getToken(), stored);
      updateNav();

      document.getElementById('view-mode').style.display = 'block';
      document.getElementById('edit-mode').style.display = 'none';
      render();
      renderProgress();
      showToast('Profile updated!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
    btn.disabled = false; btn.textContent = 'Save Changes';
  });

  load();
})();
