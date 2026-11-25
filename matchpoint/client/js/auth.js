/* ==========================================================================
   MatchPoint — Общая логика модалки входа / регистрации (client/js/auth.js)
   Зона ответственности: Фронтенд-ядро
   Кнопки аккаунта в шапке и общая форма входа и регистрации.
   ========================================================================== */

(function (global) {
  "use strict";

  const MODAL_HTML = `
  <div class="modal-overlay" id="authModal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
    <div class="modal">
      <button type="button" class="arcade-btn arcade-btn--xs modal__close" data-close-modal="authModal" aria-label="Закрыть">×</button>
      <h3 class="font-pixel text-gold" id="authModalTitle" style="font-size:0.74rem;margin:0 0 12px;">🔐 АККАУНТ MATCHPOINT</h3>
      <div class="right-tabs" style="margin-bottom:14px;">
        <button type="button" class="arcade-btn arcade-btn--xs segment-btn is-active" style="flex:1;" data-auth-tab="login">ВХОД</button>
        <button type="button" class="arcade-btn arcade-btn--xs segment-btn" style="flex:1;" data-auth-tab="register">РЕГИСТРАЦИЯ</button>
      </div>
      <form id="authForm">
        <div class="arcade-form-group" id="authNicknameGroup" style="display:none;">
          <label class="arcade-label" for="authNickname">НИКНЕЙМ</label>
          <input class="arcade-input" id="authNickname" type="text" placeholder="Ваш игровой ник">
        </div>
        <div class="arcade-form-group"><label class="arcade-label" for="authEmail">EMAIL</label><input class="arcade-input" id="authEmail" type="email" autocomplete="email" required></div>
        <div class="arcade-form-group"><label class="arcade-label" for="authPassword">ПАРОЛЬ</label><input class="arcade-input" id="authPassword" type="password" required></div>
        <button type="submit" class="arcade-btn-mint arcade-btn--block" id="authSubmitBtn">ВОЙТИ В АККАУНТ</button>
      </form>
      <div class="arcade-form-group">
        <label class="arcade-label" for="demoAccount">Быстрый вход для демонстрации</label>
        <select id="demoAccount" class="arcade-select"><option value="">Выберите демо-профиль</option></select>
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

    const demoAccount = document.getElementById("demoAccount");
    for (const account of global.MPApi.SEED_ACCOUNTS.filter(a => a.status !== "banned")) {
      demoAccount.add(new Option(`${account.nickname} (${account.role})`, account.id));
    }
    demoAccount.addEventListener("change", () => {
      if (demoAccount.value) authenticate(demoAccount.value);
    });
    document.getElementById("authForm").addEventListener("submit", (e) => {
      e.preventDefault();
      authenticate();
    });

    async function authenticate(demoId) {
      const email = document.getElementById("authEmail").value.trim();
      const password = document.getElementById("authPassword").value;
      const nickname = document.getElementById("authNickname")?.value.trim() || "";
      const submitBtn = document.getElementById("authSubmitBtn");
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      demoAccount.disabled = true;
      try {
        const res = demoId ? await global.MPApi.switchSeedAccount(Number(demoId))
          : mode === "register"
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
        submitBtn.disabled = false;
        demoAccount.disabled = false;
        demoAccount.value = "";
      }
    }

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

  function bindAccountButtons(openLogin, closeDrawer) {
    const buttons = ["openAuthModalBtn", "mobileOpenAuthBtn"]
      .map((id) => document.getElementById(id)).filter(Boolean);
    const refresh = () => {
      const signedIn = global.MPStorage.isAuthenticated();
      for (const button of buttons) {
        button.textContent = signedIn ? `👤 ${global.MPStorage.getUser().nickname}` : "Войти";
      }
    };
    for (const button of buttons) {
      button.onclick = () => {
        closeDrawer?.();
        if (global.MPStorage.isAuthenticated()) global.location.assign("profile.html");
        else openLogin();
      };
    }
    refresh();
    global.addEventListener("mp:user-change", refresh);
    global.addEventListener("mp:auth-change", refresh);
    global.addEventListener("pageshow", (event) => {
      if (event.persisted) global.location.reload();
    });
    global.addEventListener("storage", (event) => {
      const { TOKEN, LEGACY_TOKEN } = global.MPStorage.KEYS;
      if (event.key === null || event.key === TOKEN || event.key === LEGACY_TOKEN) {
        global.location.reload();
      } else {
        refresh();
      }
    });
  }

  const MPAuth = {
    bindAccountButtons,

    /** Программное открытие (например, при попытке действия, требующего входа). */
    openLoginModal(onAuthSuccess = () => global.location.reload()) {
      injectModalIfNeeded();
      initModalInteractions(onAuthSuccess);
      openAuthModal();
    }
  };

  global.MPAuth = MPAuth;
})(typeof window !== "undefined" ? window : globalThis);
