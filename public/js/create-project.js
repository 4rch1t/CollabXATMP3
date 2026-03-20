/* Create Project page */
(async function () {
  if (!requireAuth()) return;
  if (!(await requireCompleteProfile())) return;

  const skillsInput = setupTagInput('skills-wrapper', 'skills-hidden');

  document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('error');
    errEl.style.display = 'none';
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Creating...';

    try {
      const project = await api('/projects', {
        method: 'POST',
        body: {
          title: document.getElementById('title').value,
          description: document.getElementById('description').value,
          category: document.getElementById('category').value,
          requiredSkills: skillsInput.getTags(),
          teamSize: parseInt(document.getElementById('teamSize').value)
        }
      });
      showToast('Project created!', 'success');
      window.location.href = '/project-detail.html?id=' + project._id;
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Create Project →';
    }
  });
})();
