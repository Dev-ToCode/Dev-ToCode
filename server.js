const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const MAX_PROJECTS = 5;
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (!ADMIN_EMAILS.length) {
  throw new Error("ADMIN_EMAILS não foi definida nas variáveis de ambiente.");
}

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  throw new Error("ADMIN_PASSWORD não foi definida nas variáveis de ambiente.");
}

const sessions = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const defaultProjects = [
  {
    id: crypto.randomUUID(),
    title: "API de Gerenciamento",
    subtitle: "Backend para dados organizados",
    description:
      "Estrutura REST para cadastro, listagem e atualizacao de dados com foco em rotas claras e regras de negocio.",
    projectUrl: "https://github.com/Dev-ToCode?tab=repositories",
    githubUrl: "https://github.com/Dev-ToCode",
    technologies: ["Node.js", "Express", "MySQL"],
  },
  {
    id: crypto.randomUUID(),
    title: "Landing Page Responsiva",
    subtitle: "Interface para apresentacao de marca",
    description:
      "Interface moderna com estrutura semantica, responsividade e componentes reutilizaveis para experiencias web.",
    projectUrl: "https://github.com/Dev-ToCode?tab=repositories",
    githubUrl: "https://github.com/Dev-ToCode",
    technologies: ["HTML", "CSS", "JavaScript"],
  },
  {
    id: crypto.randomUUID(),
    title: "Base TypeScript",
    subtitle: "Organizacao para backend evolutivo",
    description:
      "Projeto de estudo para tipagem, organizacao de modulos e boas praticas aplicadas ao desenvolvimento backend.",
    projectUrl: "https://github.com/Dev-ToCode?tab=repositories",
    githubUrl: "https://github.com/Dev-ToCode",
    technologies: ["TypeScript", "Git", "REST"],
  },
  {
    id: crypto.randomUUID(),
    title: "Painel Administrativo",
    subtitle: "Gestao de conteudo do portfolio",
    description:
      "Area autenticada para acompanhar metricas, cadastrar projetos e manter a galeria principal sempre atualizada.",
    projectUrl: "https://github.com/Dev-ToCode?tab=repositories",
    githubUrl: "https://github.com/Dev-ToCode",
    technologies: ["Node.js", "API", "JSON"],
  },
  {
    id: crypto.randomUUID(),
    title: "Galeria Interativa",
    subtitle: "Carrossel para projetos em destaque",
    description:
      "Experiencia visual com transicao suave, pausa no hover e navegacao manual para destacar os cinco projetos principais.",
    projectUrl: "https://github.com/Dev-ToCode?tab=repositories",
    githubUrl: "https://github.com/Dev-ToCode",
    technologies: ["JavaScript", "CSS", "UX"],
  },
];

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DB_PATH);
  } catch {
    await writeDb({
      analytics: {
        visits: 0,
        socialClicks: {},
        messages: 0,
      },
      projects: defaultProjects,
    });
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_PATH, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const index = cookie.indexOf("=");
        return [cookie.slice(0, index), decodeURIComponent(cookie.slice(index + 1))];
      }),
  );
}

function getSession(req) {
  const token = parseCookies(req).dtc_session;
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }

  return { token, ...session };
}

function requireAuth(req, res) {
  const session = getSession(req);
  if (session) return session;

  sendJson(res, 401, { error: "Nao autenticado." });
  return null;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 128) throw new Error("Payload muito grande.");
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sanitizeProject(input, existingId) {
  const title = String(input.title || "").trim();
  const subtitle = String(input.subtitle || "").trim();
  const description = String(input.description || "").trim();
  const projectUrl = String(input.projectUrl || "").trim();
  const githubUrl = String(input.githubUrl || "").trim();
  const technologies = Array.isArray(input.technologies)
    ? input.technologies.map((tech) => String(tech).trim()).filter(Boolean).slice(0, 10)
    : [];

  if (!title || !subtitle || !description) {
    return { error: "Nome, subtitulo e descricao sao obrigatorios." };
  }

  if (!technologies.length) {
    return { error: "Adicione pelo menos uma tecnologia." };
  }

  return {
    project: {
      id: existingId || crypto.randomUUID(),
      title,
      subtitle,
      description,
      projectUrl,
      githubUrl,
      technologies,
    },
  };
}

function analyticsSummary(db) {
  const socialClicks = Object.values(db.analytics.socialClicks || {}).reduce(
    (total, count) => total + count,
    0,
  );

  return {
    visits: db.analytics.visits || 0,
    socialClicks,
    messages: db.analytics.messages || 0,
    projects: `${(db.projects || []).length}/${MAX_PROJECTS}`,
    socialBreakdown: db.analytics.socialClicks || {},
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/projects") {
    const db = await readDb();
    sendJson(res, 200, { projects: db.projects || [] });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/analytics/visit") {
    const db = await readDb();
    db.analytics.visits = (db.analytics.visits || 0) + 1;
    await writeDb(db);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/analytics/social-click") {
    const body = await readBody(req);
    const name = String(body.name || "Outro").trim().slice(0, 40);
    const db = await readDb();
    db.analytics.socialClicks[name] = (db.analytics.socialClicks[name] || 0) + 1;
    await writeDb(db);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/analytics/message") {
    const db = await readDb();
    db.analytics.messages = (db.analytics.messages || 0) + 1;
    await writeDb(db);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!ADMIN_EMAILS.includes(email) || password !== ADMIN_PASSWORD) {
      sendJson(res, 401, { error: "Email ou senha incorretos." });
      return true;
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { createdAt: Date.now() });
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": `dtc_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const session = getSession(req);
    if (session) sessions.delete(session.token);
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": "dtc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/me") {
    sendJson(res, getSession(req) ? 200 : 401, { authenticated: Boolean(getSession(req)) });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/metrics") {
    if (!requireAuth(req, res)) return true;
    const db = await readDb();
    sendJson(res, 200, analyticsSummary(db));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/projects") {
    if (!requireAuth(req, res)) return true;
    const db = await readDb();
    sendJson(res, 200, { projects: db.projects || [] });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/admin/projects") {
    if (!requireAuth(req, res)) return true;
    const db = await readDb();
    if ((db.projects || []).length >= MAX_PROJECTS) {
      sendJson(res, 400, { error: "Limite de 5 projetos atingido." });
      return true;
    }

    const parsed = sanitizeProject(await readBody(req));
    if (parsed.error) {
      sendJson(res, 400, { error: parsed.error });
      return true;
    }

    db.projects.push(parsed.project);
    await writeDb(db);
    sendJson(res, 201, { project: parsed.project });
    return true;
  }

  const projectMatch = url.pathname.match(/^\/api\/admin\/projects\/([^/]+)$/);
  if (projectMatch && req.method === "PUT") {
    if (!requireAuth(req, res)) return true;
    const id = decodeURIComponent(projectMatch[1]);
    const db = await readDb();
    const index = db.projects.findIndex((project) => project.id === id);
    if (index === -1) {
      sendJson(res, 404, { error: "Projeto nao encontrado." });
      return true;
    }

    const parsed = sanitizeProject(await readBody(req), id);
    if (parsed.error) {
      sendJson(res, 400, { error: parsed.error });
      return true;
    }

    db.projects[index] = parsed.project;
    await writeDb(db);
    sendJson(res, 200, { project: parsed.project });
    return true;
  }

  if (projectMatch && req.method === "DELETE") {
    if (!requireAuth(req, res)) return true;
    const id = decodeURIComponent(projectMatch[1]);
    const db = await readDb();
    db.projects = db.projects.filter((project) => project.id !== id);
    await writeDb(db);
    sendJson(res, 200, { ok: true });
    return true;
  }

  return false;
}

async function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(ROOT, `.${pathname}`);

  if (!filePath.startsWith(ROOT) || filePath.includes(`${path.sep}data${path.sep}`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (!handled) sendJson(res, 404, { error: "Rota nao encontrada." });
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Erro interno." });
  }
});

ensureDb().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`DevToCode rodando em ${PORT}`);
  });
});
