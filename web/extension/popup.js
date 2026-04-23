const $ = (id) => document.getElementById(id);
const show = (id) => {
  for (const s of document.querySelectorAll(".state")) s.classList.add("hidden");
  $(id).classList.remove("hidden");
};

function send(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (!res?.ok) return reject(new Error(res?.error || "Erro"));
      resolve(res.data);
    });
  });
}

async function refresh() {
  const status = await send({ type: "status" });
  if ($("api-base")) $("api-base").value = status.apiBase || "";
  if (status.authenticated) {
    $("user-name").textContent = status.user?.name || "Usuário";
    $("user-email").textContent = status.user?.email || "";
    $("tenant-name").textContent = status.tenant?.name ? `Tenant: ${status.tenant.name}` : "";
    show("authed");
  } else {
    show("login");
  }
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  const btn = $("login-btn");
  const errEl = $("login-error");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.textContent = "Entrando…";
  try {
    await send({ type: "login", email, password });
    await refresh();
  } catch (err) {
    errEl.textContent = err.message || "Falha no login";
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

$("logout-btn").addEventListener("click", async () => {
  await send({ type: "logout" });
  await refresh();
});

$("save-api").addEventListener("click", async () => {
  const base = $("api-base").value.trim().replace(/\/$/, "");
  if (!base) return;
  await send({ type: "setApiBase", apiBase: base });
  $("save-api").textContent = "Salvo ✓";
  setTimeout(() => ($("save-api").textContent = "Salvar"), 1200);
});

refresh();
