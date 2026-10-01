
(function () {
    'use strict';

    const TEACHERS_URL = 'data/teachers.json';   
    const COURSES_URL = 'data/courses.json';     
    const STORAGE_KEY = 'kurs_teachers';
    const PAGE_SIZE = 6;


    const $ = (id) => document.getElementById(id);
    const tableBody = $('teacherTableBody');
    const tableContainer = document.querySelector('.table-container');
    const pagination = document.querySelector('.pagination');
    const emptyState = document.querySelector('.empty-state');
    const loadingState = document.querySelector('.loading-state');
    const errorState = document.querySelector('.error-state');
    const searchInput = $('teachersearch');
    const filtersForm = document.querySelector('.filters');

    const teacherModal = $('teacherModal');
    const teacherForm = $('teacherForm');
    const modalTitle = $('modalTitle');
    const deleteModal = $('deleteConfirmationModal');

    const fields = {
        ad: { input: $('teacherAd'), error: $('teacherAdError') },
        email: { input: $('teacherEmail'), error: $('teacherEmailError') },
        telefon: { input: $('teacherPhone'), error: $('teacherPhoneError') },
        kursId: { input: $('teacherCourse'), error: $('teacherCourseError') }
    };

    /* ---------- Vəziyyət ---------- */
    let teachers = [];
    let courses = [];
    let currentPage = 1;
    let editingId = null;
    let deletingId = null;
    let toastTimer = null;

    /* ---------- Toast ---------- */
    function showToast(message, type) {
        const toast = $('toast');
        $('toastMessage').textContent = message;
        toast.classList.remove('toast-success', 'toast-error');
        toast.classList.add(type === 'error' ? 'toast-error' : 'toast-success');
        toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
    }

    function norm(s) {
        return String(s || '').toLocaleLowerCase('az').trim();
    }

    function nextId() {
        const nums = teachers.map((t) => parseInt(String(t.id).replace(/\D/g, ''), 10) || 0);
        return 'm-' + (Math.max(0, ...nums) + 1);
    }

    function courseName(t) {
        const c = courses.find((x) => x.id === t.kursId);
        return c ? c.ad : (t.ixtisas || '—');
    }

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(teachers)); } catch (e) { /* ignore */ }
    }

    async function fetchJson(url) {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }

    function setView(view) {
        loadingState.hidden = view !== 'loading';
        errorState.hidden = view !== 'error';
        emptyState.hidden = view !== 'empty';
        tableContainer.hidden = view !== 'table';
        pagination.hidden = view !== 'table';
        filtersForm.hidden = view === 'loading' || view === 'error';
    }

    /* ---------- Data yükləmə ---------- */
    async function loadData() {
        setView('loading');
        try {
            let saved = null;
            try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { /* ignore */ }

            teachers = Array.isArray(saved) ? saved : await fetchJson(TEACHERS_URL);

            try {
                courses = await fetchJson(COURSES_URL);
            } catch (e) {
                courses = [];
            }
            if (!Array.isArray(courses) || !courses.length) {
                const names = [...new Set(teachers.map((t) => t.ixtisas).filter(Boolean))];
                courses = names.map((ad, i) => ({ id: 'c-' + (i + 1), ad }));
            } else {
                courses = courses.map((c) => ({ id: c.id, ad: c.ad || c.name || c.title || c.id }));
            }
            teachers.forEach((t) => {
                if (!t.kursId) {
                    const c = courses.find((x) => x.ad === t.ixtisas);
                    if (c) t.kursId = c.id;
                }
            });

            fillCourseSelect();
            render();
        } catch (err) {
            console.error(err);
            setView('error');
        }
    }

    function fillCourseSelect() {
        const select = fields.kursId.input;
        select.innerHTML = '<option value="">Seçin</option>';
        courses.forEach((c) => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.ad;
            select.appendChild(opt);
        });
    }

    /* ---------- Filtr ---------- */
    function getFiltered() {
        const q = norm(searchInput.value);
        if (!q) return teachers;
        return teachers.filter((t) =>
            norm(t.ad).includes(q) || norm(t.email).includes(q) || norm(courseName(t)).includes(q)
        );
    }

    function cell(text) {
        const td = document.createElement('td');
        td.textContent = text;
        return td;
    }

    function actionButton(label, action, id, cls) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.dataset.action = action;
        b.dataset.id = id;
        if (cls) b.className = cls;
        return b;
    }

    function render() {
        const list = getFiltered();

        if (!teachers.length) { setView('empty'); return; }
        setView('table');

        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = list.slice(start, start + PAGE_SIZE);

        tableBody.innerHTML = '';
        if (!pageItems.length) {
            const tr = document.createElement('tr');
            const td = cell('Axtarışa uyğun müəllim tapılmadı.');
            td.colSpan = 6;
            tr.appendChild(td);
            tableBody.appendChild(tr);
        } else {
            pageItems.forEach((t) => {
                const tr = document.createElement('tr');
                tr.appendChild(cell(t.ad));
                tr.appendChild(cell(t.email));
                tr.appendChild(cell(t.telefon));
                tr.appendChild(cell(courseName(t)));

                const statusTd = document.createElement('td');
                const badge = document.createElement('span');
                badge.className = 'status status-active';
                badge.textContent = 'Aktiv';
                statusTd.appendChild(badge);
                tr.appendChild(statusTd);

                const actionsTd = document.createElement('td');
                actionsTd.appendChild(actionButton('Redaktə et', 'edit', t.id));
                actionsTd.appendChild(actionButton('Sil', 'delete', t.id, 'danger-button'));
                tr.appendChild(actionsTd);

                tableBody.appendChild(tr);
            });
        }
        renderPagination(totalPages);
    }

    function renderPagination(totalPages) {
        pagination.innerHTML = '';

        const prev = document.createElement('button');
        prev.type = 'button';
        prev.id = 'prevPageButton';
        prev.textContent = 'Əvvəlki';
        prev.disabled = currentPage === 1;
        pagination.appendChild(prev);

        for (let i = 1; i <= totalPages; i++) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = i;
            b.dataset.page = i;
            if (i === currentPage) {
                b.className = 'active';
                b.setAttribute('aria-current', 'page');
            }
            pagination.appendChild(b);
        }

        const next = document.createElement('button');
        next.type = 'button';
        next.id = 'nextPageButton';
        next.textContent = 'Növbəti';
        next.disabled = currentPage === totalPages;
        pagination.appendChild(next);
    }

    /* ---------- Modal: əlavə / redaktə ---------- */
    function clearErrors() {
        Object.values(fields).forEach(({ input, error }) => {
            error.hidden = true;
            error.textContent = '';
            input.removeAttribute('aria-invalid');
        });
    }

    function setError(name, message) {
        const { input, error } = fields[name];
        error.textContent = message;
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
    }

    function openTeacherModal(teacher) {
        clearErrors();
        teacherForm.reset();
        editingId = teacher ? teacher.id : null;
        modalTitle.textContent = teacher ? 'Müəllimi redaktə et' : 'Yeni Müəllim əlavə et';

        if (teacher) {
            fields.ad.input.value = teacher.ad || '';
            fields.email.input.value = teacher.email || '';
            fields.telefon.input.value = teacher.telefon || '';
            fields.kursId.input.value = teacher.kursId || '';
        }
        teacherModal.showModal();
        fields.ad.input.focus();
    }

    function closeTeacherModal() {
        teacherModal.close();
        editingId = null;
    }

    function validate() {
        clearErrors();
        let ok = true;
        const ad = fields.ad.input.value.trim();
        const email = fields.email.input.value.trim();
        const tel = fields.telefon.input.value.trim();
        const kurs = fields.kursId.input.value;

        if (ad.length < 3) { setError('ad', 'Ad Soyad ən azı 3 simvol olmalıdır.'); ok = false; }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('email', 'Düzgün e-poçt ünvanı daxil edin.'); ok = false;
        } else if (teachers.some((t) => norm(t.email) === norm(email) && t.id !== editingId)) {
            setError('email', 'Bu e-poçt artıq istifadə olunub.'); ok = false;
        }

        if (!/^\+?[0-9\s\-()]{7,20}$/.test(tel)) {
            setError('telefon', 'Düzgün telefon nömrəsi daxil edin (məs: +994 50 123 45 67).'); ok = false;
        }

        if (!kurs) { setError('kursId', 'Kurs seçin.'); ok = false; }

        return ok;
    }

    teacherForm.addEventListener('submit', (e) => {
        e.preventDefault(); // dialog-un avtomatik bağlanmasının qarşısını al
        if (!validate()) return;

        const kurs = courses.find((c) => c.id === fields.kursId.input.value);
        const data = {
            ad: fields.ad.input.value.trim(),
            email: fields.email.input.value.trim(),
            telefon: fields.telefon.input.value.trim(),
            kursId: kurs.id,
            ixtisas: kurs.ad
        };

        if (editingId) {
            const idx = teachers.findIndex((t) => t.id === editingId);
            if (idx !== -1) teachers[idx] = { ...teachers[idx], ...data };
            showToast('Müəllim məlumatları yeniləndi.');
        } else {
            teachers.push({ id: nextId(), ...data });
            currentPage = Math.ceil(getFiltered().length / PAGE_SIZE) || 1;
            showToast('Yeni müəllim əlavə edildi.');
        }

        save();
        closeTeacherModal();
        render();
    });

    $('cancelButton').addEventListener('click', closeTeacherModal);

    function openDeleteModal(id) {
        deletingId = id;
        deleteModal.showModal();
    }

    $('cancelDeleteButton').addEventListener('click', () => {
        deletingId = null;
        deleteModal.close();
    });

    $('confirmDeleteButton').addEventListener('click', (e) => {
        e.preventDefault();
        if (deletingId) {
            teachers = teachers.filter((t) => t.id !== deletingId);
            save();
            showToast('Müəllim silindi.');
            render();
        }
        deletingId = null;
        deleteModal.close();
    });

    [teacherModal, deleteModal].forEach((dlg) => {
        dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    });

    tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const teacher = teachers.find((t) => t.id === btn.dataset.id);
        if (!teacher) return;
        if (btn.dataset.action === 'edit') openTeacherModal(teacher);
        if (btn.dataset.action === 'delete') openDeleteModal(teacher.id);
    });

    pagination.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || btn.disabled) return;
        if (btn.id === 'prevPageButton') currentPage--;
        else if (btn.id === 'nextPageButton') currentPage++;
        else if (btn.dataset.page) currentPage = Number(btn.dataset.page);
        else return;
        render();
    });

    filtersForm.addEventListener('submit', (e) => e.preventDefault());
    searchInput.addEventListener('input', () => {
        currentPage = 1;
        render();
    });

    $('addTeacherButton').addEventListener('click', () => openTeacherModal(null));
    $('addTeacherButtonEmpty').addEventListener('click', () => openTeacherModal(null));
    $('retryButton').addEventListener('click', loadData);

    document.addEventListener('DOMContentLoaded', loadData);
})();
