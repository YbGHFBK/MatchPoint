/* ==========================================================================
   MatchPoint — Общая логика модалки входа / регистрации (client/js/auth.js)
   Зона ответственности: Фронтенд-ядро
   Раньше файл был пустым, из-за чего кнопка «Аккаунт» на admin.html не работала:
   собственная логика модалки была только в swipe.js (index.html) и profile.js.
   Теперь это переиспользуемый модуль window.MPAuth:
   - при отсутствии #authModal в разметке — сам внедряет аркадную модалку в <body>;
   - вешает открытие на #openAuthModalBtn / #mobileOpenAuthBtn;
   - табы ВХОД/РЕГИСТРАЦИЯ, быстрая подстановка сид-аккаунтов, сабмит на
     /api/auth/login и /api/auth/register через window.MPApi;
   - после успеха диспатчит событие mp:auth-change и зовёт колбэк onAuthSuccess.
   Подключение: <script src="js/auth.js"></script> и в page-скрипте:
   window.MPAuth?.bindAuthModal({ onAuthSuccess: (user) => { ... } });
   ========================================================================== */

(function (global) {
  "use strict";

  const MODAL_HTML = `
  <div class="modal-overlay" id="authModal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
    <div class="modal">
      <button type="button" class="arcade-btn arcade-btn--xs modal__close" data-close-modal="authModal" aria-label="Закрыть">×</button>
      <h3 class="font-pixel text-gold" id="authModalTitle" style="font-size:0.74rem;margin:0 0 12px;">🔐 АККАУНТ MATCHPOINT</h3>
      <div class="right-tabs" style="margin-bottom:14px;">
        <button type="button" class="segment-btn is-active" style="flex:1;" data-auth-tab="login">ВХОД</button>
        <button type="button" class="segment-btn" style="flex:1;" data-auth-tab="register">РЕГИСТРАЦИЯ</button>
      </div>
      <form id="authForm">
        <div class="arcade-form-group" id="authNicknameGroup" style="display:none;">
          <label class="arcade-label" for="authNickname">НИКНЕЙМ</label>
          <input class="arcade-input" id="authNickname" type="text" placeholder="Ваш игровой ник">
        </div>
        <div class="arcade-form-group"><label class="arcade-label" for="authEmail">EMAIL</label><input class="arcade-input" id="authEmail" type="email" value="admin@matchpoint.dev" required></div>
        <div class="arcade-form-group"><label class="arcade-label" for="authPassword">ПАРОЛЬ</label><input class="arcade-input" id="authPassword" type="password" value="password" required></div>
        <button type="submit" class="arcade-btn-mint arcade-btn--block" id="authSubmitBtn">ВОЙТИ В АККАУНТ</button>
      </form>
      <div class="demo-accounts-box">
        <div>Быстрая подстановка (пароль: <code>password</code>):</div>
        <div class="demo-accounts-grid">
          <button type="button" class="btn btn--ghost" data-seed-email="admin@matchpoint.dev">AdminRoot</button>
          <button type="button" class="btn btn--ghost" data-seed-email="mod@matchpoint.dev">ModWatch</button>
          <button type="button" class="btn btn--ghost" data-seed-email="org@matchpoint.dev">OrgCyber</button>
          <button type="button" class="btn btn--ghost" data-seed-email="captain@matchpoint.dev">KuroCap</button>
          <button type="button" class="btn btn--ghost" data-seed-email="player@matchpoint.dev">ShadowStep</button>
        </div>
      </div>
    </div>
  </div>`;

  let initialized = false;

  function showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(20px)";
      el.style.transition = "0.22s ease";
      setTimeout(() => el.remove(), 240);
    }, 2800);
  }

  function syncBodyLock() {
    document.body.classList.toggle("modal-open", Boolean(document.querySelector(".modal-overlay.is-open")));
  }

  function openAuthModal() {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    modal.classList.add("is-open");
    syncBodyLock();
  }

  function closeAuthModal() {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    syncBodyLock();
  }

  function injectModalIfNeeded() {
    if (document.getElementById("authModal")) return;
    const template = document.createElement("div");
    template.innerHTML = MODAL_HTML.trim();
    document.body.appendChild(template.firstElementChild);
  }

  function initModalInteractions(onAuthSuccess) {
    if (initialized) return;
    const modal = document.getElementById("authModal");
    if (!modal) return;
    initialized = true;

    let mode = "login";
    const tabs = modal.querySelectorAll("[data-auth-tab]");
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.getAttribute("data-auth-tab");
        tabs.forEach((b) => b.classList.toggle("is-active", b === btn));
        const nicknameGroup = document.getElementById("authNicknameGroup");
        if (nicknameGroup) nicknameGroup.style.display = mode === "register" ? "block" : "none";
        const submitBtn = document.getElementById("authSubmitBtn");
        if (submitBtn) submitBtn.textContent = mode === "register" ? "Создать аккаунт" : "Войти в аккаунт";
      });
    });

    modal.querySelectorAll("[data-seed-email]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("authEmail").value = btn.getAttribute("data-seed-email");
        document.getElementById("authPassword").value = "password";
      });
    });

    document.getElementById("authForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value;
      const nickname = document.getElementById("authNickname")?.value.trim() || "";
      const submitBtn = document.getElementById("authSubmitBtn");
      if (submitBtn) submitBtn.disabled = true;
      try {
        const res = mode === "register"
          ? await global.MPApi.register({ email, password, nickname })
          : await global.MPApi.login({ email, password });
        closeAuthModal();
        showToast(`✅ Вы вошли как @${res.user.nickname} (${res.user.role})`);
        global.dispatchEvent(new CustomEvent("mp:auth-change", { detail: { user: res.user } }));
        if (typeof onAuthSuccess === "function") {
          try { onAuthSuccess(res.user); } catch (_) {}
        }
      } catch (err) {
        showToast(`⚠️ ${err.message}`);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });

    modal.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", closeAuthModal);
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeAuthModal();
    });
    global.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("is-open")) closeAuthModal();
    });
  }

  const MPAuth = {
    /** Внедряет модалку (если её нет) и вешает открытие на кнопки шапки. */
    bindAuthModal(options = {}) {
      const open = () => {
        injectModalIfNeeded();
        initModalInteractions(options.onAuthSuccess);
        openAuthModal();
      };
      document.getElementById("openAuthModalBtn")?.addEventListener("click", open);
      document.getElementById("mobileOpenAuthBtn")?.addEventListener("click", open);
    },

    /** Программное открытие (например, при попытке действия, требующего входа). */
    openLoginModal(onAuthSuccess) {
      injectModalIfNeeded();
      initModalInteractions(onAuthSuccess);
      openAuthModal();
    }
  };

  global.MPAuth = MPAuth;
})(typeof window !== "undefined" ? window : globalThis);
