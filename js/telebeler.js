(function () {
    "use strict";
 
    const PAGE_SIZE = 6;
 
    const STATUS_LABELS = {
        aktiv: "Aktiv",
        dondurulub: "Dondurulub",
        bitirib: "Bitirib"
    };
 
    function qs(selector, parent = document) {
        return parent.querySelector(selector);
    }
 
    function formatDate(isoDate) {
        if (!isoDate) return "-";
        const [y, m, d] = isoDate.split("-");
        return `${d}.${m}.${y}`;
    }
 
    function validateStudentFields(form, { requireCourse }) {
        window.KursUI.clearFieldErrors(form);
 
        const adField = qs("#studentAd", form);
        const emailField = qs("#studentEmail", form);
        const phoneField = qs("#studentPhone", form);
        const courseField = qs("#studentCourse", form);
 
        const focusOrder = [adField, emailField, phoneField];
        let isValid = true;
 
        if (!adField.value.trim()) {
            window.KursUI.showFieldError(adField, "Ad Soyad boş ola bilməz.");
            isValid = false;
        }
 
        const emailValue = emailField.value.trim();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailValue) {
            window.KursUI.showFieldError(emailField, "E-poçt boş ola bilməz.");
            isValid = false;
        } else if (!emailPattern.test(emailValue)) {
            window.KursUI.showFieldError(emailField, "Düzgün e-poçt formatı daxil edin.");
            isValid = false;
        }
 
        const phoneValue = phoneField.value.trim();
        const phonePattern = /^\+?[\d\s()-]{7,}$/;
        if (!phoneValue) {
            window.KursUI.showFieldError(phoneField, "Telefon boş ola bilməz.");
            isValid = false;
        } else if (!phonePattern.test(phoneValue)) {
            window.KursUI.showFieldError(phoneField, "Düzgün telefon nömrəsi daxil edin (məs: +994 50 123 45 67).");
            isValid = false;
        }
 
        if (requireCourse && courseField) {
            focusOrder.push(courseField);
            if (!courseField.value) {
                window.KursUI.showFieldError(courseField, "Kurs seçilməlidir.");
                isValid = false;
            }
        }
 
        if (!isValid) {
            window.KursUI.focusFirstInvalid(focusOrder);
        }
 
        return isValid;
    }
  
    async function initStudentsListPage() {
        const tableBody = document.getElementById("studentTableBody");
        const searchInput = document.getElementById("studentsearch");
 
        if (!tableBody || !searchInput) {
            return;
        }
 
        const statusSelect = document.getElementById("status");
        const studentModal = document.getElementById("studentModal");
        const studentForm = document.getElementById("studentForm");
        const modalTitle = document.getElementById("modalTitle");
        const courseSelect = document.getElementById("studentCourse");
 
        let allStudents = [];
        let allCourses = [];
        let currentPage = 1;
        let editingStudentId = null;
        let pendingDeleteId = null;
 
        const params = window.KursUI.getQueryParams();
        if (params.get("axtar")) searchInput.value = params.get("axtar");
        if (params.get("status")) statusSelect.value = params.get("status");
        if (params.get("sehife")) currentPage = Number(params.get("sehife")) || 1;
 
        function courseNameById(id) {
            const course = allCourses.find((c) => c.id === id);
            return course ? course.ad : "Naməlum kurs";
        }
 
        async function load() {
            window.KursUI.setLoading(true);
            window.KursUI.setError(false);
            window.KursUI.setEmpty(false);
            tableBody.innerHTML = "";
 
            try {
                const [students, courses] = await Promise.all([
                    window.KursApi.getStudents(),
                    window.KursApi.getCourses()
                ]);
                allStudents = students;
                allCourses = courses;
                window.KursUI.setLoading(false);
                renderStudentsList();
            } catch (error) {
                window.KursUI.setLoading(false);
                window.KursUI.setError(true, load);
            }
        }
 
        function updateUrl() {
            window.KursUI.setQueryParams({
                axtar: searchInput.value.trim(),
                status: statusSelect.value,
                sehife: currentPage > 1 ? currentPage : ""
            });
        }
 
        function renderStudentsList() {
            const searchTerm = searchInput.value.trim().toLowerCase();
            const statusValue = statusSelect.value;
 
            const filtered = allStudents.filter((student) => {
                const matchesSearch =
                    !searchTerm ||
                    student.ad.toLowerCase().includes(searchTerm) ||
                    student.epoct.toLowerCase().includes(searchTerm);
                const matchesStatus = !statusValue || student.status === statusValue;
                return matchesSearch && matchesStatus;
            });
 
            tableBody.innerHTML = "";
 
            if (!filtered.length) {
                window.KursUI.setEmpty(true);
                renderPagination(0);
                return;
            }
 
            window.KursUI.setEmpty(false);
 
            const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
            currentPage = Math.min(currentPage, totalPages);
 
            const start = (currentPage - 1) * PAGE_SIZE;
            const pageItems = filtered.slice(start, start + PAGE_SIZE);
 
            pageItems.forEach((student) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${student.ad}</td>
                    <td>${student.epoct}</td>
                    <td>${student.telefon}</td>
                    <td>${courseNameById(student.kursId)}</td>
                    <td><span class="status status-${student.status}">${STATUS_LABELS[student.status] || student.status}</span></td>
                    <td>
                        <button type="button" class="edit-button" data-id="${student.id}">Redaktə et</button>
                        <button type="button" class="danger-button delete-button" data-id="${student.id}">Sil</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
 
            renderPagination(totalPages);
            updateUrl();
        }
 
        function renderPagination(totalPages) {
            const nav = document.querySelector(".pagination");
            if (!nav) return;
 
            const prevBtn = document.getElementById("prevPageButton");
            const nextBtn = document.getElementById("nextPageButton");
 
            nav.querySelectorAll("button:not(#prevPageButton):not(#nextPageButton)").forEach((btn) => btn.remove());
 
            for (let page = 1; page <= totalPages; page++) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = String(page);
                if (page === currentPage) {
                    btn.classList.add("active");
                    btn.setAttribute("aria-current", "page");
                }
                btn.addEventListener("click", () => {
                    currentPage = page;
                    renderStudentsList();
                });
                nextBtn.insertAdjacentElement("beforebegin", btn);
            }
 
            prevBtn.disabled = currentPage <= 1;
            nextBtn.disabled = currentPage >= totalPages;
        }
 
        document.getElementById("prevPageButton").addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage -= 1;
                renderStudentsList();
            }
        });
 
        document.getElementById("nextPageButton").addEventListener("click", () => {
            currentPage += 1;
            renderStudentsList();
        });
 
        const debouncedSearch = window.KursUI.debounce(() => {
            currentPage = 1;
            renderStudentsList();
        }, 300);
 
        searchInput.addEventListener("input", debouncedSearch);
 
        statusSelect.addEventListener("change", () => {
            currentPage = 1;
            renderStudentsList();
        });

        async function populateCourseSelect() {
            if (!courseSelect) return;
            const courses = await window.KursApi.getCourses();
            allCourses = courses;
            courseSelect.innerHTML =
                `<option value="">Seçin</option>` +
                courses.map((c) => `<option value="${c.id}">${c.ad}</option>`).join("");
        }
 
        function openAddModal() {
            editingStudentId = null;
            modalTitle.textContent = "Yeni Tələbə əlavə et";
            studentForm.reset();
            window.KursUI.clearFieldErrors(studentForm);
            window.KursUI.openModal(studentModal);
        }
 
        function openEditModal(student) {
            editingStudentId = student.id;
            modalTitle.textContent = "Tələbəni Redaktə Et";
            window.KursUI.clearFieldErrors(studentForm);
 
            document.getElementById("studentAd").value = student.ad;
            document.getElementById("studentEmail").value = student.epoct;
            document.getElementById("studentPhone").value = student.telefon;
            document.getElementById("studentStatus").value = student.status;
            if (courseSelect) courseSelect.value = student.kursId;
 
            window.KursUI.openModal(studentModal);
        }
 
        const addBtn = document.getElementById("addStudentButton");
        const addEmptyBtn = document.getElementById("addStudentButtonEmpty");
        const cancelBtn = document.getElementById("cancelButton");
 
        if (addBtn) addBtn.addEventListener("click", openAddModal);
        if (addEmptyBtn) addEmptyBtn.addEventListener("click", openAddModal);
        if (cancelBtn) cancelBtn.addEventListener("click", () => window.KursUI.closeModal(studentModal));
 
        tableBody.addEventListener("click", (event) => {
            const editBtn = event.target.closest(".edit-button");
            const deleteBtn = event.target.closest(".delete-button");
 
            if (editBtn) {
                const student = allStudents.find((s) => s.id === editBtn.dataset.id);
                if (student) openEditModal(student);
            }
 
            if (deleteBtn) {
                pendingDeleteId = deleteBtn.dataset.id;
                window.KursUI.openModal(document.getElementById("deleteConfirmationModal"));
            }
        });
 
        studentForm.addEventListener("submit", (event) => {
            event.preventDefault();
 
            if (!validateStudentFields(studentForm, { requireCourse: true })) {
                return;
            }
 
            const formValues = {
                ad: document.getElementById("studentAd").value.trim(),
                epoct: document.getElementById("studentEmail").value.trim(),
                telefon: document.getElementById("studentPhone").value.trim(),
                status: document.getElementById("studentStatus").value,
                kursId: courseSelect.value
            };
 
            if (editingStudentId) {
                allStudents = allStudents.map((s) =>
                    s.id === editingStudentId ? { ...s, ...formValues } : s
                );
                window.KursUI.showToast("Tələbə uğurla yeniləndi.", "success");
            } else {
                const newStudent = {
                    id: window.KursApi.createID("s", allStudents),
                    ...formValues,
                    qeydiyyatTarixi: new Date().toISOString().slice(0, 10)
                };
                allStudents.push(newStudent);
                window.KursUI.showToast("Tələbə uğurla əlavə edildi.", "success");
            }
 
            window.KursApi.saveStudents(allStudents);
            window.KursUI.closeModal(studentModal);
            renderStudentsList();
        });
 
        document.getElementById("confirmDeleteButton").addEventListener("click", () => {
            if (pendingDeleteId) {
                allStudents = allStudents.filter((s) => s.id !== pendingDeleteId);
                window.KursApi.saveStudents(allStudents);
                window.KursUI.showToast("Tələbə silindi.", "success");
                pendingDeleteId = null;
                renderStudentsList();
            }
            window.KursUI.closeModal(document.getElementById("deleteConfirmationModal"));
        });
 
        document.getElementById("cancelDeleteButton").addEventListener("click", () => {
            pendingDeleteId = null;
            window.KursUI.closeModal(document.getElementById("deleteConfirmationModal"));
        });
 
        await populateCourseSelect();
        await load();
    }
 
    async function initCourseStudentsTab() {
        const courseNameEl = document.getElementById("courseName");
        const tableBody = document.getElementById("studentTableBody");
 
        if (!courseNameEl || !tableBody) {
            return;
        }
 
        const currentCourseId = new URLSearchParams(window.location.search).get("id");
        const studentModal = document.getElementById("studentModal");
        const studentForm = document.getElementById("studentForm");
        const addBtn = document.getElementById("addStudentButton");
        const cancelBtn = document.getElementById("cancelButton");
 
        let courseStudents = [];
 
        function render() {
            const filtered = courseStudents.filter((s) => s.kursId === currentCourseId);
 
            if (!filtered.length) {
                tableBody.innerHTML = `<tr><td colspan="6">Bu kursa hələ tələbə yazılmayıb.</td></tr>`;
                return;
            }
 
            tableBody.innerHTML = filtered
                .map(
                    (student) => `
                    <tr>
                        <td>${student.id}</td>
                        <td>${student.ad}</td>
                        <td>${student.epoct}</td>
                        <td>${student.telefon}</td>
                        <td><time datetime="${student.qeydiyyatTarixi}">${formatDate(student.qeydiyyatTarixi)}</time></td>
                        <td><span class="status status-${student.status}">${STATUS_LABELS[student.status] || student.status}</span></td>
                    </tr>`
                )
                .join("");
        }
 
        async function load() {
            try {
                courseStudents = await window.KursApi.getStudents();
                render();
            } catch (error) {
                tableBody.innerHTML = `<tr><td colspan="6">Tələbələr yüklənə bilmədi.</td></tr>`;
            }
        }
 
        if (addBtn && studentModal) {
            addBtn.addEventListener("click", () => {
                studentForm.reset();
                window.KursUI.clearFieldErrors(studentForm);
                window.KursUI.openModal(studentModal);
            });
        }
 
        if (cancelBtn && studentModal) {
            cancelBtn.addEventListener("click", () => window.KursUI.closeModal(studentModal));
        }
 
        if (studentForm) {
            studentForm.addEventListener("submit", (event) => {
                event.preventDefault();
 
                if (!validateStudentFields(studentForm, { requireCourse: false })) {
                    return;
                }
 
                const newStudent = {
                    id: window.KursApi.createID("s", courseStudents),
                    ad: document.getElementById("studentAd").value.trim(),
                    epoct: document.getElementById("studentEmail").value.trim(),
                    telefon: document.getElementById("studentPhone").value.trim(),
                    status: document.getElementById("studentStatus").value,
                    kursId: currentCourseId,
                    qeydiyyatTarixi: new Date().toISOString().slice(0, 10)
                };
 
                courseStudents.push(newStudent);
                window.KursApi.saveStudents(courseStudents);
                window.KursUI.showToast("Tələbə uğurla əlavə edildi.", "success");
                window.KursUI.closeModal(studentModal);
                render();
            });
        }
 
        await load();
    }
 
    document.addEventListener("DOMContentLoaded", () => {
        initStudentsListPage();
        initCourseStudentsTab();
    });
})();