const MAX_PROJECTS = 5;
const CAROUSEL_INTERVAL_MS = 3600;
const CAROUSEL_TRANSITION_MS = 850;

const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector(".nav-links");
const navItems = document.querySelectorAll(".nav-links a");
const revealItems = document.querySelectorAll(".reveal");
const contactForm = document.querySelector("#form-contato");
const statusMessage = document.querySelector("#mensagem-status");
const projectTrack = document.querySelector("[data-project-track]");
const projectDots = document.querySelector("[data-project-dots]");
const projectPrev = document.querySelector("[data-project-prev]");
const projectNext = document.querySelector("[data-project-next]");
const authModal = document.querySelector("[data-auth-modal]");
const openLoginButton = document.querySelector("[data-open-login]");
const closeLoginButton = document.querySelector("[data-close-login]");
const loginForm = document.querySelector("[data-login-form]");
const loginStatus = document.querySelector("[data-login-status]");
const adminPanel = document.querySelector("[data-admin-panel]");
const adminLogout = document.querySelector("[data-admin-logout]");
const metricEls = document.querySelectorAll("[data-metric]");
const projectForm = document.querySelector("[data-project-form]");
const techList = document.querySelector("[data-tech-list]");
const addTechButton = document.querySelector("[data-add-tech]");
const projectStatus = document.querySelector("[data-project-status]");
const projectSubmit = document.querySelector("[data-project-submit]");
const projectCancel = document.querySelector("[data-project-cancel]");
const adminProjectList = document.querySelector("[data-admin-project-list]");
const projectCount = document.querySelector("[data-project-count]");

let carouselIndex = 0;
let draftTechs = [];
let projectsState = [];
let carouselTimer = null;
let carouselAutoEnabled = true;

async function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(options.method || "GET", path, true);
    request.withCredentials = true;
    request.setRequestHeader("Content-Type", "application/json");

    Object.entries(options.headers || {}).forEach(([key, value]) => {
      request.setRequestHeader(key, value);
    });

    request.onload = () => {
      let payload = {};
      try {
        payload = JSON.parse(request.responseText || "{}");
      } catch {
        payload = {};
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(payload.error || "Erro na requisicao."));
    };

    request.onerror = () => reject(new Error("Nao foi possivel conectar ao servidor."));
    request.send(options.body || null);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function closeMenu() {
  if (!menuToggle || !navLinks) return;

  menuToggle.classList.remove("is-active");
  navLinks.classList.remove("is-open");
  document.body.classList.remove("menu-open");
  menuToggle.setAttribute("aria-expanded", "false");
}

function renderProjectCard(project, index) {
  const tagMarkup = project.technologies
    .map((tech) => `<span>${escapeHtml(tech)}</span>`)
    .join("");
  const acronym = escapeHtml(project.title.slice(0, 3).toUpperCase());

  return `
    <article class="project-card">
      <div class="project-visual ${index % 3 === 1 ? "project-visual-alt" : ""} ${index % 3 === 2 ? "project-visual-dark" : ""}">
        <span>${acronym}</span>
      </div>
      <div class="project-content">
        <p class="project-subtitle">${escapeHtml(project.subtitle)}</p>
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.description)}</p>
        <div class="project-tags">${tagMarkup}</div>
        <div class="project-links">
          <a class="button button-primary" href="${escapeHtml(project.projectUrl || "#projetos")}" target="_blank" rel="noreferrer">
            Ver projeto
          </a>
          <a class="button button-secondary" href="${escapeHtml(project.githubUrl || "https://github.com/Dev-ToCode")}" target="_blank" rel="noreferrer" data-track-social="GitHub">
            GitHub
          </a>
        </div>
      </div>
    </article>
  `;
}

async function loadProjects() {
  const { projects } = await api("/api/projects");
  projectsState = projects.slice(0, MAX_PROJECTS);
  renderProjects();
}

function renderProjects() {
  carouselIndex = projectsState.length ? carouselIndex % projectsState.length : 0;

  if (projectTrack) {
    const visibleClones = projectsState.slice(0, getVisibleProjectCount());
    const carouselItems = [...projectsState, ...visibleClones];

    projectTrack.innerHTML = carouselItems
      .map((project, index) => renderProjectCard(project, index))
      .join("");
  }

  if (projectDots) {
    projectDots.innerHTML = projectsState
      .map(
        (_, index) =>
          `<button class="project-dot ${index === carouselIndex ? "is-active" : ""}" type="button" data-project-dot="${index}" aria-label="Ver projeto ${index + 1}"></button>`,
      )
      .join("");
  }

  updateCarousel(false);
  startCarouselAutoplay();
  renderAdminProjects();
}

function getVisibleProjectCount() {
  if (window.matchMedia("(max-width: 720px)").matches) return 1;
  if (window.matchMedia("(max-width: 1040px)").matches) return 2;
  return 3;
}

function getCarouselStep() {
  const firstCard = projectTrack?.querySelector(".project-card");
  const gap = 24;
  const cardWidth = firstCard?.getBoundingClientRect().width ?? 0;
  return cardWidth + gap;
}

function setTrackPosition(index, animate = true) {
  if (!projectTrack) return;

  projectTrack.style.transition = animate
    ? `transform ${CAROUSEL_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
    : "none";
  projectTrack.style.transform = `translateX(-${index * getCarouselStep()}px)`;
}

function getActiveProjectIndex() {
  if (!projectsState.length) return 0;
  return ((carouselIndex % projectsState.length) + projectsState.length) % projectsState.length;
}

function updateCarousel(animate = true) {
  const visible = getVisibleProjectCount();
  const canMove = projectsState.length > visible;

  if (!canMove) carouselIndex = 0;
  setTrackPosition(carouselIndex, animate);

  if (projectPrev) projectPrev.disabled = !canMove;
  if (projectNext) projectNext.disabled = !canMove;

  document.querySelectorAll("[data-project-dot]").forEach((dot) => {
    dot.classList.toggle("is-active", Number(dot.dataset.projectDot) === getActiveProjectIndex());
  });
}

function moveCarouselTo(nextIndex, animate = true) {
  if (!projectsState.length) return;
  carouselIndex = nextIndex;
  updateCarousel(animate);

  if (carouselIndex >= projectsState.length) {
    window.setTimeout(() => {
      carouselIndex = 0;
      updateCarousel(false);
    }, CAROUSEL_TRANSITION_MS);
  }
}

function stopCarouselAutoplay() {
  if (carouselTimer) window.clearInterval(carouselTimer);
  carouselTimer = null;
}

function startCarouselAutoplay() {
  stopCarouselAutoplay();
  if (!carouselAutoEnabled || projectsState.length <= getVisibleProjectCount()) return;

  carouselTimer = window.setInterval(() => {
    moveCarouselTo(carouselIndex + 1);
  }, CAROUSEL_INTERVAL_MS);
}

function disableCarouselAutoplay() {
  carouselAutoEnabled = false;
  stopCarouselAutoplay();
}

function openLogin() {
  if (!authModal) return;
  authModal.hidden = false;
  authModal.querySelector("input")?.focus();
}

function closeLogin() {
  if (!authModal) return;
  authModal.hidden = true;
  if (loginStatus) loginStatus.textContent = "";
}

async function isLoggedIn() {
  try {
    const { authenticated } = await api("/api/admin/me");
    return authenticated;
  } catch {
    return false;
  }
}

async function showAdmin() {
  if (!adminPanel) return;
  adminPanel.hidden = false;
  adminPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  await Promise.all([renderMetrics(), loadAdminProjects()]);
}

function hideAdmin() {
  if (adminPanel) adminPanel.hidden = true;
}

async function renderMetrics() {
  try {
    const metrics = await api("/api/admin/metrics");
    metricEls.forEach((el) => {
      el.textContent = metrics[el.dataset.metric] ?? "0";
    });
  } catch {
    // Metrics are private; silently ignore when logged out.
  }
}

async function trackSocialClick(name) {
  await api("/api/analytics/social-click", {
    method: "POST",
    body: JSON.stringify({ name }),
  }).catch(() => {});
  await renderMetrics();
}

function renderTechList() {
  if (!techList) return;
  techList.innerHTML = draftTechs
    .map(
      (tech, index) =>
        `<span class="tech-pill">${escapeHtml(tech)}<button type="button" data-remove-tech="${index}" aria-label="Remover ${escapeHtml(tech)}">x</button></span>`,
    )
    .join("");
}

function resetProjectForm() {
  if (!projectForm) return;
  projectForm.reset();
  projectForm.elements.id.value = "";
  draftTechs = [];
  renderTechList();
  if (projectSubmit) projectSubmit.textContent = "Salvar projeto";
  if (projectCancel) projectCancel.hidden = true;
  if (projectStatus) projectStatus.textContent = "";
}

async function loadAdminProjects() {
  try {
    const { projects } = await api("/api/admin/projects");
    projectsState = projects.slice(0, MAX_PROJECTS);
    renderProjects();
  } catch {
    // Admin projects are private.
  }
}

function renderAdminProjects() {
  if (projectCount) projectCount.textContent = `${projectsState.length} de ${MAX_PROJECTS}`;
  if (!adminProjectList) return;

  adminProjectList.innerHTML = projectsState
    .map(
      (project) => `
        <article class="admin-project-item">
          <div>
            <h4>${escapeHtml(project.title)}</h4>
            <p>${escapeHtml(project.subtitle)}</p>
          </div>
          <div class="admin-project-tags">
            ${project.technologies.map((tech) => `<span>${escapeHtml(tech)}</span>`).join("")}
          </div>
          <div class="admin-project-actions">
            <button type="button" data-edit-project="${escapeHtml(project.id)}">Editar</button>
            <button type="button" data-delete-project="${escapeHtml(project.id)}">Remover</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function startEditProject(id) {
  const project = projectsState.find((item) => item.id === id);
  if (!project || !projectForm) return;

  projectForm.elements.id.value = project.id;
  projectForm.elements.title.value = project.title;
  projectForm.elements.subtitle.value = project.subtitle;
  projectForm.elements.description.value = project.description;
  projectForm.elements.projectUrl.value = project.projectUrl;
  projectForm.elements.githubUrl.value = project.githubUrl;
  draftTechs = [...project.technologies];
  renderTechList();
  if (projectSubmit) projectSubmit.textContent = "Atualizar projeto";
  if (projectCancel) projectCancel.hidden = false;
  projectForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function deleteProject(id) {
  await api(`/api/admin/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadProjects();
  await renderMetrics();
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("is-open");
    menuToggle.classList.toggle("is-active", isOpen);
    document.body.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navItems.forEach((item) => item.addEventListener("click", closeMenu));
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14 },
);

revealItems.forEach((item) => revealObserver.observe(item));

document.addEventListener("click", async (event) => {
  const socialLink = event.target.closest("[data-track-social]");
  if (socialLink) trackSocialClick(socialLink.dataset.trackSocial);

  const dot = event.target.closest("[data-project-dot]");
  if (dot) {
    disableCarouselAutoplay();
    moveCarouselTo(Number(dot.dataset.projectDot));
  }

  const editButton = event.target.closest("[data-edit-project]");
  if (editButton) startEditProject(editButton.dataset.editProject);

  const deleteButton = event.target.closest("[data-delete-project]");
  if (deleteButton) await deleteProject(deleteButton.dataset.deleteProject);

  const removeTechButton = event.target.closest("[data-remove-tech]");
  if (removeTechButton) {
    draftTechs.splice(Number(removeTechButton.dataset.removeTech), 1);
    renderTechList();
  }
});

projectPrev?.addEventListener("click", () => {
  disableCarouselAutoplay();

  if (carouselIndex <= 0) {
    carouselIndex = projectsState.length;
    updateCarousel(false);
    window.requestAnimationFrame(() => moveCarouselTo(projectsState.length - 1));
    return;
  }

  moveCarouselTo(carouselIndex - 1);
});

projectNext?.addEventListener("click", () => {
  disableCarouselAutoplay();
  moveCarouselTo(carouselIndex + 1);
});

window.addEventListener("resize", () => {
  renderProjects();
});

document.querySelector(".projects-carousel")?.addEventListener("mouseenter", stopCarouselAutoplay);
document.querySelector(".projects-carousel")?.addEventListener("mouseleave", startCarouselAutoplay);

if (contactForm && statusMessage) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await api("/api/analytics/message", { method: "POST" }).catch(() => {});
    statusMessage.textContent =
      "Mensagem registrada. Conecte este formulario ao seu servico de email quando publicar o portfolio.";
    contactForm.reset();
    await renderMetrics();
  });
}

openLoginButton?.addEventListener("click", async () => {
  if (await isLoggedIn()) {
    await showAdmin();
    return;
  }
  openLogin();
});

closeLoginButton?.addEventListener("click", closeLogin);

authModal?.addEventListener("click", (event) => {
  if (event.target === authModal) closeLogin();
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? "").trim(),
      }),
    });
    closeLogin();
    await showAdmin();
    loginForm.reset();
  } catch (error) {
    if (loginStatus) loginStatus.textContent = error.message;
  }
});

adminLogout?.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  hideAdmin();
});

addTechButton?.addEventListener("click", () => {
  if (!projectForm) return;
  const input = projectForm.elements.techInput;
  const value = input.value.trim();
  if (!value || draftTechs.includes(value)) return;
  draftTechs.push(value);
  input.value = "";
  input.focus();
  renderTechList();
});

projectForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = projectForm.elements;
  const editingId = form.id.value;

  if (!editingId && projectsState.length >= MAX_PROJECTS) {
    if (projectStatus) projectStatus.textContent = "Limite de 5 projetos atingido. Remova um projeto para adicionar outro.";
    return;
  }

  if (draftTechs.length === 0) {
    if (projectStatus) projectStatus.textContent = "Adicione pelo menos uma tecnologia.";
    return;
  }

  const project = {
    title: form.title.value.trim(),
    subtitle: form.subtitle.value.trim(),
    description: form.description.value.trim(),
    projectUrl: form.projectUrl.value.trim(),
    githubUrl: form.githubUrl.value.trim() || "https://github.com/Dev-ToCode",
    technologies: [...draftTechs],
  };

  try {
    await api(
      editingId
        ? `/api/admin/projects/${encodeURIComponent(editingId)}`
        : "/api/admin/projects",
      {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(project),
      },
    );
    resetProjectForm();
    await loadProjects();
    await renderMetrics();
  } catch (error) {
    if (projectStatus) projectStatus.textContent = error.message;
  }
});

projectCancel?.addEventListener("click", resetProjectForm);

await api("/api/analytics/visit", { method: "POST" }).catch(() => {});
await loadProjects();
renderTechList();
