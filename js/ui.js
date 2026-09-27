(function () {
    "use strict";

    
    let activeDialog = null;
    let lastFocusedElement = null;
 
    function qs(selector, parent = document) {
        return parent.querySelector(selector);
    }
 
    /* ---------- toast ---------- */
 
    let toastTimer = null;
 
    function showToast(message, type = "success") {
        const toast = qs("#toast");
 
        if (!toast) {
            return;
        }
 
        const messageElement = qs("#toastMessage", toast);
 
        if (messageElement) {
            messageElement.textContent = message;
        } else {
            toast.textContent = message;
        }
 
        toast.dataset.type = type;
        toast.hidden = false;
 
        clearTimeout(toastTimer);
 
        toastTimer = setTimeout(() => {
            toast.hidden = true;
        }, 3000);
    }
 
    /* ---------- yükləmə / boş / xəta vəziyyətləri ---------- */
 
    function setLoading(show) {
        const loading = qs(".loading-state");
 
        if (loading) {
            loading.hidden = !show;
        }
    }
 
    function setError(show, retryHandler) {
        const error = qs(".error-state");
 
        if (!error) {
            return;
        }
 
        error.hidden = !show;
 
        const retry = qs("#retryButton", error);
 
        if (retry && retryHandler) {
            retry.onclick = retryHandler;
        }
    }
 
    function setEmpty(show) {
        const empty = qs(".empty-state");
 
        if (empty) {
            empty.hidden = !show;
        }
    }
 
 
    function getFocusable(dialog) {
        return Array.from(
            dialog.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        );
    }
 
    function trapFocus(event) {
        if (event.key !== "Tab" || !activeDialog) {
            return;
        }
 
        const focusable = getFocusable(activeDialog);
 
        if (!focusable.length) {
            event.preventDefault();
            return;
        }
 
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
 
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
 
    function handleBackdropClick(event) {
        if (event.target === activeDialog) {
            activeDialog.close();
        }
    }
 
    function unlockDialog() {
        if (activeDialog) {
            activeDialog.removeEventListener("keydown", trapFocus);
            activeDialog.removeEventListener("click", handleBackdropClick);
            activeDialog.removeEventListener("close", unlockDialog);
        }
 
        document.body.classList.remove("modal-open");
 
        if (lastFocusedElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.focus();
        }
 
        activeDialog = null;
        lastFocusedElement = null;
    }
 
    function lockDialog(dialog) {
        activeDialog = dialog;
        lastFocusedElement = document.activeElement;
 
        document.body.classList.add("modal-open");
 
        const focusable = getFocusable(dialog);
 
        if (focusable.length) {
            setTimeout(() => focusable[0].focus(), 0);
        }
 
        dialog.addEventListener("keydown", trapFocus);
        dialog.addEventListener("click", handleBackdropClick);
        dialog.addEventListener("close", unlockDialog);
    }
 
    function openModal(dialog) {
        if (!dialog || dialog.open) {
            return;
        }
 
        lockDialog(dialog);
        dialog.showModal();
    }
 
    function closeModal(dialog) {
        if (!dialog) {
            return;
        }
 
        if (dialog.open) {
            dialog.close(); 
        } else {
            unlockDialog();
        }
    }
 
    function clearFieldErrors(form) {
        form.querySelectorAll(".field-error").forEach((error) => {
            error.textContent = "";
            error.hidden = true;
        });
 
        form.querySelectorAll("[aria-invalid='true']").forEach((field) => {
            field.removeAttribute("aria-invalid");
        });
    }
 
    function showFieldError(field, message) {
        const error = document.getElementById(`${field.id}Error`);
 
        if (!error) {
            return;
        }
 
        error.textContent = message;
        error.hidden = false;
 
        field.setAttribute("aria-invalid", "true");
    }
 
    function focusFirstInvalid(fields) {
        const firstInvalid = fields.find(
            (field) => field && field.getAttribute("aria-invalid") === "true"
        );
 
        if (firstInvalid) {
            firstInvalid.focus();
        }
    }
 
 
    function debounce(fn, delay = 300) {
        let timer = null;
 
        return function debounced(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
 
 
    function getQueryParams() {
        return new URLSearchParams(window.location.search);
    }
 
    function setQueryParams(paramsObject) {
        const query = new URLSearchParams();
 
        Object.keys(paramsObject).forEach((key) => {
            const value = paramsObject[key];
            if (value !== undefined && value !== null && value !== "") {
                query.set(key, value);
            }
        });
 
        const queryString = query.toString();
        const newUrl = `${window.location.pathname}${queryString ? "?" + queryString : ""}`;
        window.history.replaceState({}, "", newUrl);
    }
 
    /* ---------- sidebar mobil toggle ---------- */
 
    function initSidebarToggle() {
        const menuButton = qs(".menu-button");
        const sidebar = qs("#sidebar");
 
        if (!menuButton || !sidebar) {
            return;
        }
 
        menuButton.addEventListener("click", () => {
            const open = sidebar.classList.toggle("open");
 
            menuButton.setAttribute("aria-expanded", String(open));
            menuButton.setAttribute("aria-label", open ? "Menyunu bağla" : "Menyunu aç");
        });
    }
 
    /* ---------- kurs detalı: tab keçidi ---------- */
 
    function initTabs() {
        const tabButtons = document.querySelectorAll(".tab-button");
 
        if (!tabButtons.length) {
            return;
        }
 
        tabButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const target = button.dataset.tab;
 
                tabButtons.forEach((btn) => {
                    btn.classList.toggle("active", btn === button);
                });
 
                document.querySelectorAll(".tab-content").forEach((content) => {
                    content.hidden = content.id !== target;
                });
            });
        });
    }
 
    /* ---------- giriş forması (index.html) ---------- */
 
    function initLoginForm() {
        const form = document.getElementById("loginForm");
 
        if (!form) {
            return;
        }
 
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");
        const errorMessage = document.getElementById("errorMessage");
        const toggleBtn = document.getElementById("togglePassword");
 
        if (toggleBtn && passwordInput) {
            toggleBtn.addEventListener("click", () => {
                const isHidden = passwordInput.type === "password";
                passwordInput.type = isHidden ? "text" : "password";
                toggleBtn.textContent = isHidden ? "Şifrəni Gizlət" : "Şifrəni Göstər";
            });
        }
 
        form.addEventListener("submit", (event) => {
            event.preventDefault();
 
            const email = emailInput.value.trim();
            const password = passwordInput.value;
 
            const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
            const isValidPassword = password.length >= 6;
 
            if (isValidEmail && isValidPassword) {
                errorMessage.hidden = true;
                window.location.href = "panel.html";
            } else {
                errorMessage.hidden = false;
                errorMessage.textContent = !isValidEmail
                    ? "Zəhmət olmasa düzgün email daxil edin."
                    : "Şifrə ən azı 6 simvol olmalıdır.";
            }
        });
    }
 
    /* ---------- ümumi başlanğıc ---------- */
 
    function initSharedUI() {
        initSidebarToggle();
        initTabs();
        initLoginForm();
    }
 
    document.addEventListener("DOMContentLoaded", initSharedUI);
 
    window.KursUI = {
        showToast,
        setLoading,
        setError,
        setEmpty,
        openModal,
        closeModal,
        clearFieldErrors,
        showFieldError,
        focusFirstInvalid,
        debounce,
        getQueryParams,
        setQueryParams
    };
})();