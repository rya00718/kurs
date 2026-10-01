(function () {
    "use strict";
 
    const PAGE_SIZE = 6;
 
    const CATEGORY_LABELS = {
        proqramlasdirma: "Proqramlaşdırma",
        dizayn: "Dizayn",
        dil: "Dil"
    };
 
    const STATUS_LABELS = {
        aktiv: "Aktiv",
        bitib: "Bitib",
        planlasdirilir: "Planlaşdırılır"
    };
 
    const DAY_LABELS = {
        be: "Bazar ertəsi",
        ça: "Çərşənbə axşamı",
        çə: "Çərşənbə",
        ca: "Cümə axşamı",
        cü: "Cümə",
        şə: "Şənbə",
        ba: "Bazar"
    };
 
    const DAY_CODE_BY_JS_DAY = ["ba", "be", "ça", "çə", "ca", "cü", "şə"];
 
    function qs(selector, parent = document) {
        return parent.querySelector(selector);
    }
 
    function formatDate(isoDate) {
        if (!isoDate) return "-";
        const [y, m, d] = isoDate.split("-");
        return `${d}.${m}.${y}`;
    }
 
    /* İcmal (panel.html) */
 
    async function initDashboardPage() {
        const statsContainer = document.getElementById("statsContainer");
        const dashboardContent = document.getElementById("dashboardContent");
 
        if (!statsContainer || !dashboardContent) {
            return;
        }
 
        try {
            const [courses, students] = await Promise.all([
                window.KursApi.getCourses(),
                window.KursApi.getStudents()
            ]);
 
            renderStats(courses, students);
            renderTodayLessons(courses);
            renderRecentRegistrations(courses, students);
 
            dashboardContent.hidden = false;
        } catch (error) {
            statsContainer.innerHTML = "";
            window.KursUI.setError(true, () => window.location.reload());
        }
    }
 
    function renderStats(courses, students) {
        const statsContainer = document.getElementById("statsContainer");
 
        const aktivKurslar = courses.filter((c) => c.status === "aktiv");
        const bugunkuDersSayi = aktivKurslar.reduce(
            (sum, c) => sum + (c.cedvel ? c.cedvel.length : 0),
            0
        );
 
        const umumiYer = courses.reduce((sum, c) => sum + (c.yerSayi || 0), 0);
        const umumiYazilan = courses.reduce((sum, c) => sum + (c.yazilanSayi || 0), 0);
        const doluluqFaizi = umumiYer > 0 ? Math.round((umumiYazilan / umumiYer) * 100) : 0;
 
        statsContainer.innerHTML = `
            <div class="card">
                <span>Aktiv Kurslar</span>
                <strong>${aktivKurslar.length}</strong>
            </div>
            <div class="card">
                <span>Ümumi Tələbə sayı</span>
                <strong>${students.length}</strong>
            </div>
            <div class="card">
                <span>Bu həftəki dərslərin sayı</span>
                <strong>${bugunkuDersSayi}</strong>
            </div>
            <div class="card">
                <span>Doluluq faizi</span>
                <strong>${doluluqFaizi}%</strong>
            </div>
        `;
    }
 
    function renderTodayLessons(courses) {
        const list = document.getElementById("todayLessonsList");
 
        if (!list) return;
 
        const todayCode = DAY_CODE_BY_JS_DAY[new Date().getDay()];
 
        const lessons = [];
        courses
            .filter((c) => c.status === "aktiv")
            .forEach((c) => {
                (c.cedvel || []).forEach((slot) => {
                    if (slot.gun === todayCode) {
                        lessons.push({ time: slot.baslama, ad: c.ad, status: c.status });
                    }
                });
            });
 
        lessons.sort((a, b) => a.time.localeCompare(b.time));
 
        if (!lessons.length) {
            list.innerHTML = `<li>Bu gün üçün planlaşdırılmış dərs yoxdur.</li>`;
            return;
        }
 
        list.innerHTML = lessons
            .map(
                (lesson) => `
                <li>
                    <time>${lesson.time}</time>
                    <span>${lesson.ad}</span>
                    <span class="status status-${lesson.status}">${STATUS_LABELS[lesson.status]}</span>
                </li>`
            )
            .join("");
    }
 
    function renderRecentRegistrations(courses, students) {
        const list = document.getElementById("registrationsList");
 
        if (!list) return;
 
        const sorted = [...students].sort(
            (a, b) => new Date(b.qeydiyyatTarixi) - new Date(a.qeydiyyatTarixi)
        );
 
        const recent = sorted.slice(0, 5);
 
        if (!recent.length) {
            list.innerHTML = `<li>Hələ heç bir qeydiyyat yoxdur.</li>`;
            return;
        }
 
        list.innerHTML = recent
            .map((student) => {
                const course = courses.find((c) => c.id === student.kursId);
                const courseName = course ? course.ad : "Naməlum kurs";
                return `<li>${student.ad} — ${courseName}</li>`;
            })
            .join("");
    }
 
    /*  Kurslar siyahısı  */
 
    let allCourses = [];
    let currentPage = 1;
    let pendingDeleteId = null;
 
    async function initCoursesListPage() {
        const tableBody = document.getElementById("courseTableBody");
 
        if (!tableBody) {
            return;
        }
 
    
        const categorySelect = document.getElementById("category");
        const sortSelect = document.getElementById("sort");
        const statusSelect = document.getElementById("status");
 
        const params = window.KursUI.getQueryParams();
        
        if (params.get("kateqoriya")) categorySelect.value = params.get("kateqoriya");
        if (params.get("status")) statusSelect.value = params.get("status");
        if (params.get("sort")) sortSelect.value = params.get("sort");
        if (params.get("sehife")) currentPage = Number(params.get("sehife")) || 1;
 
        async function load() {
            window.KursUI.setLoading(true);
            window.KursUI.setError(false);
            window.KursUI.setEmpty(false);
            tableBody.innerHTML = "";
 
            try {
                allCourses = await window.KursApi.getCourses();
                window.KursUI.setLoading(false);
                renderCoursesList();
            } catch (error) {
                window.KursUI.setLoading(false);
                window.KursUI.setError(true, load);
            }
        }
 
        function updateUrl() {
            window.KursUI.setQueryParams({
                kateqoriya: categorySelect.value,
                status: statusSelect.value,
                sort: sortSelect.value,
                sehife: currentPage > 1 ? currentPage : ""
            });
        }
 
        function renderCoursesList() {
            const searchTerm = "";
            const categoryValue = categorySelect.value;
            const statusValue = statusSelect.value;
            const sortValue = sortSelect.value;
 
            const filtered = allCourses.filter((course) => {
                const matchesSearch = !searchTerm || course.ad.toLowerCase().includes(searchTerm);
                const matchesCategory = !categoryValue || course.kateqoriya === categoryValue;
                const matchesStatus = !statusValue || course.status === statusValue;
                return matchesSearch && matchesCategory && matchesStatus;
            });
 
            if (sortValue === "ad") {
                filtered.sort((a, b) => a.ad.localeCompare(b.ad, "az"));
            } else if (sortValue === "baslamaTarixi") {
                filtered.sort((a, b) => new Date(a.baslamaTarixi) - new Date(b.baslamaTarixi));
            } else if (sortValue === "yazilanSayi") {
                filtered.sort((a, b) => b.yazilanSayi - a.yazilanSayi);
            }
 
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
 
            pageItems.forEach((course) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td><a href="kurs.html?id=${course.id}" aria-label="${course.ad} kursuna bax">${course.ad}</a></td>
                    <td>${CATEGORY_LABELS[course.kateqoriya] || course.kateqoriya}</td>
                    <td><time datetime="${course.baslamaTarixi}">${formatDate(course.baslamaTarixi)}</time></td>
                    <td>${course.yazilanSayi}/${course.yerSayi}</td>
                    <td><span class="status status-${course.status}">${STATUS_LABELS[course.status] || course.status}</span></td>
                    <td>
                        <button type="button" class="edit-button" data-id="${course.id}">Redaktə et</button>
                        <button type="button" class="danger-button delete-button" data-id="${course.id}">Sil</button>
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
                    renderCoursesList();
                });
                nextBtn.insertAdjacentElement("beforebegin", btn);
            }
 
            prevBtn.disabled = currentPage <= 1;
            nextBtn.disabled = currentPage >= totalPages;
        }
 
        document.getElementById("prevPageButton").addEventListener("click", () => {
            if (currentPage > 1) {
                currentPage -= 1;
                renderCoursesList();
            }
        });
 
        document.getElementById("nextPageButton").addEventListener("click", () => {
            currentPage += 1;
            renderCoursesList();
        });
 
        // const debouncedSearch = window.KursUI.debounce(() => {
        //     currentPage = 1;
        //     renderCoursesList();
        // }, 300);
 
        // searchInput.addEventListener("input", debouncedSearch);
 
        [categorySelect, statusSelect, sortSelect].forEach((select) => {
            select.addEventListener("change", () => {
                currentPage = 1;
                renderCoursesList();
            });
        });
 
        /* ---------- Yeni kurs ---------- */
 
        const courseModal = document.getElementById("courseModal");
        const courseForm = document.getElementById("courseForm");
        const courseModalTitle = document.getElementById("courseModalTitle");
        const teacherSelect = document.getElementById("courseMuellim");
 
        let editingCourseId = null;
 
        async function populateTeacherSelect() {
            const teachers = await window.KursApi.getTeachers();
            teacherSelect.innerHTML =
                `<option value="">Seçin</option>` +
                teachers.map((t) => `<option value="${t.id}">${t.ad}</option>`).join("");
        }
 
        function openAddModal() {
            editingCourseId = null;
            courseModalTitle.textContent = "Yeni Kurs Əlavə Et";
            courseForm.reset();
            window.KursUI.clearFieldErrors(courseForm);
            window.KursUI.openModal(courseModal);
        }
 
        function openEditModal(course) {
            editingCourseId = course.id;
            courseModalTitle.textContent = "Kursu Redaktə Et";
            window.KursUI.clearFieldErrors(courseForm);
 
            document.getElementById("courseAd").value = course.ad;
            document.getElementById("courseKateqoriya").value = course.kateqoriya;
            document.getElementById("courseMuellim").value = course.muellimId;
            document.getElementById("courseBaslama").value = course.baslamaTarixi;
            document.getElementById("courseBitme").value = course.bitmeTarixi;
            document.getElementById("courseQiymet").value = course.qiymet;
            document.getElementById("courseYerSayi").value = course.yerSayi;
 
            window.KursUI.openModal(courseModal);
        }
 
        document.getElementById("addCourseButton").addEventListener("click", openAddModal);
 
        const addEmptyBtn = document.getElementById("addCourseButtonEmpty");
        if (addEmptyBtn) addEmptyBtn.addEventListener("click", openAddModal);
 
        document.getElementById("cancelCourseButton").addEventListener("click", () => {
            window.KursUI.closeModal(courseModal);
        });
 
        tableBody.addEventListener("click", (event) => {
            const editBtn = event.target.closest(".edit-button");
            const deleteBtn = event.target.closest(".delete-button");
 
            if (editBtn) {
                const course = allCourses.find((c) => c.id === editBtn.dataset.id);
                if (course) openEditModal(course);
            }
 
            if (deleteBtn) {
                pendingDeleteId = deleteBtn.dataset.id;
                window.KursUI.openModal(document.getElementById("deleteCourseModal"));
            }
        });
 
        function validateCourseForm() {
            window.KursUI.clearFieldErrors(courseForm);
 
            const fields = {
                courseAd: document.getElementById("courseAd"),
                courseKateqoriya: document.getElementById("courseKateqoriya"),
                courseMuellim: document.getElementById("courseMuellim"),
                courseBaslama: document.getElementById("courseBaslama"),
                courseBitme: document.getElementById("courseBitme"),
                courseQiymet: document.getElementById("courseQiymet"),
                courseYerSayi: document.getElementById("courseYerSayi")
            };
 
            let isValid = true;
 
            if (!fields.courseAd.value.trim()) {
                window.KursUI.showFieldError(fields.courseAd, "Kurs adı boş ola bilməz.");
                isValid = false;
            }
            if (!fields.courseKateqoriya.value) {
                window.KursUI.showFieldError(fields.courseKateqoriya, "Kateqoriya seçilməlidir.");
                isValid = false;
            }
            if (!fields.courseMuellim.value) {
                window.KursUI.showFieldError(fields.courseMuellim, "Müəllim seçilməlidir.");
                isValid = false;
            }
            if (!fields.courseBaslama.value) {
                window.KursUI.showFieldError(fields.courseBaslama, "Başlama tarixi seçilməlidir.");
                isValid = false;
            }
            if (!fields.courseBitme.value) {
                window.KursUI.showFieldError(fields.courseBitme, "Bitmə tarixi seçilməlidir.");
                isValid = false;
            } else if (fields.courseBaslama.value && fields.courseBitme.value < fields.courseBaslama.value) {
                window.KursUI.showFieldError(fields.courseBitme, "Bitmə tarixi başlama tarixindən əvvəl ola bilməz.");
                isValid = false;
            }
            if (!fields.courseQiymet.value || Number(fields.courseQiymet.value) < 0) {
                window.KursUI.showFieldError(fields.courseQiymet, "Düzgün qiymət daxil edin.");
                isValid = false;
            }
            if (!fields.courseYerSayi.value || Number(fields.courseYerSayi.value) < 1) {
                window.KursUI.showFieldError(fields.courseYerSayi, "Yer sayı ən azı 1 olmalıdır.");
                isValid = false;
            }
 
            if (!isValid) {
                window.KursUI.focusFirstInvalid(Object.values(fields));
            }
 
            return isValid;
        }
 
        courseForm.addEventListener("submit", (event) => {
            event.preventDefault();
 
            if (!validateCourseForm()) {
                return;
            }
 
            const formValues = {
                ad: document.getElementById("courseAd").value.trim(),
                kateqoriya: document.getElementById("courseKateqoriya").value,
                muellimId: document.getElementById("courseMuellim").value,
                baslamaTarixi: document.getElementById("courseBaslama").value,
                bitmeTarixi: document.getElementById("courseBitme").value,
                qiymet: Number(document.getElementById("courseQiymet").value),
                yerSayi: Number(document.getElementById("courseYerSayi").value)
            };
 
            if (editingCourseId) {
                allCourses = allCourses.map((c) =>
                    c.id === editingCourseId ? { ...c, ...formValues } : c
                );
                window.KursUI.showToast("Kurs uğurla yeniləndi.", "success");
            } else {
                const newCourse = {
                    id: window.KursApi.createID("c", allCourses),
                    ...formValues,
                    yazilanSayi: 0,
                    status: "planlasdirilir",
                    cedvel: []
                };
                allCourses.push(newCourse);
                window.KursUI.showToast("Kurs uğurla əlavə edildi.", "success");
            }
 
            window.KursApi.saveCourses(allCourses);
            window.KursUI.closeModal(courseModal);
            renderCoursesList();
        });
 
        document.getElementById("confirmDeleteCourseButton").addEventListener("click", () => {
            if (pendingDeleteId) {
                allCourses = allCourses.filter((c) => c.id !== pendingDeleteId);
                window.KursApi.saveCourses(allCourses);
                window.KursUI.showToast("Kurs silindi.", "success");
                pendingDeleteId = null;
                renderCoursesList();
            }
            window.KursUI.closeModal(document.getElementById("deleteCourseModal"));
        });
 
        document.getElementById("cancelDeleteCourseButton").addEventListener("click", () => {
            pendingDeleteId = null;
            window.KursUI.closeModal(document.getElementById("deleteCourseModal"));
        });
 
        await populateTeacherSelect();
        await load();
    }
 
    /* Kurs detalı (kurs.html)  */
 
    async function initCourseDetailPage() {
        const courseNameEl = document.getElementById("courseName");
 
        if (!courseNameEl) {
            return;
        }
 
        const courseId = new URLSearchParams(window.location.search).get("id");
 
        window.KursUI.setLoading(true);
        window.KursUI.setError(false);
        window.KursUI.setEmpty(false);
 
        try {
            const [courses, teachers] = await Promise.all([
                window.KursApi.getCourses(),
                window.KursApi.getTeachers()
            ]);
 
            window.KursUI.setLoading(false);
 
            const course = courses.find((c) => c.id === courseId);
 
            if (!course) {
                window.KursUI.setEmpty(true);
                return;
            }
 
            renderCourseDetail(course, teachers);
        } catch (error) {
            window.KursUI.setLoading(false);
            window.KursUI.setError(true, () => window.location.reload());
        }
    }
 
    function renderCourseDetail(course, teachers) {
        document.title = `${course.ad} - Kurs Mərkəzi Paneli`;
 
        document.getElementById("courseName").textContent = course.ad;
        document.getElementById("courseCategory").textContent =
            CATEGORY_LABELS[course.kateqoriya] || course.kateqoriya;
        document.getElementById("courseDescription").textContent =
            course.teswir || "Bu kurs üçün təsvir əlavə edilməyib.";
 
        const teacher = teachers.find((t) => t.id === course.muellimId);
        document.getElementById("courseTeacher").textContent = teacher ? teacher.ad : "Naməlum";
 
        document.getElementById("courseStartDate").textContent = formatDate(course.baslamaTarixi);
        document.getElementById("courseEndDate").textContent = formatDate(course.bitmeTarixi);
        document.getElementById("coursePrice").textContent = course.qiymet;
 
        document.getElementById("courseStudentCount").textContent = course.yazilanSayi;
        document.getElementById("courseLocation").textContent = course.yerSayi;
 
        const statusEl = document.getElementById("courseStatus");
        statusEl.textContent = STATUS_LABELS[course.status] || course.status;
        statusEl.className = `status status-${course.status}`;
 
        /* Cədvəl tabı */
        const scheduleBody = document.getElementById("scheduleTableBody");
        if (scheduleBody) {
            if (!course.cedvel || !course.cedvel.length) {
                scheduleBody.innerHTML = `<tr><td colspan="3">Bu kurs üçün dərs cədvəli əlavə edilməyib.</td></tr>`;
            } else {
                scheduleBody.innerHTML = course.cedvel
                    .map(
                        (slot) => `
                        <tr>
                            <td>${DAY_LABELS[slot.gun] || slot.gun}</td>
                            <td>${slot.baslama}</td>
                            <td>${slot.muddet} dəqiqə</td>
                        </tr>`
                    )
                    .join("");
            }
        }
    }
    document.addEventListener("DOMContentLoaded", () => {
        initDashboardPage();
        initCoursesListPage();
        initCourseDetailPage();
    });
})();