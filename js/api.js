(function () {
    "use strict";
 
 
    const STORAGE_KEYS = {
        courses: "kurs-paneli-courses",
        students: "kurs-paneli-students",
        teachers: "kurs-paneli-teachers",
        theme: "kurs-paneli-theme"
    };
 
    const DELAY_MS = 500;
 
    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
 
    /* hər fetch çağırışına 500ms süni gecikmə əlavə edir */
    async function fetchJson(url) {
        await wait(DELAY_MS);
 
        const response = await fetch(url);
 
        if (!response.ok) {
            throw new Error(`Məlumat yüklənmədi: ${response.status}`);
        }
 
        return response.json();
    }
 
    function readStorage(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            return fallback;
        }
    }
 
    function writeStorage(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
 
    /* ---------- kurslar ---------- */
 
    async function getCourses() {
        const saved = readStorage(STORAGE_KEYS.courses, null);
 
        if (Array.isArray(saved)) {
            return saved;
        }
 
        const data = await fetchJson("data/courses.json");
        saveCourses(data);
        return data;
    }
 
    function saveCourses(courses) {
        writeStorage(STORAGE_KEYS.courses, courses);
    }
 
    /* ---------- tələbələr ---------- */
 
    async function getStudents() {
        const saved = readStorage(STORAGE_KEYS.students, null);
 
        if (Array.isArray(saved)) {
            return saved;
        }
 
        const data = await fetchJson("data/students.json");
        saveStudents(data);
        return data;
    }
 
    function saveStudents(students) {
        writeStorage(STORAGE_KEYS.students, students);
    }
 
    /* ---------- müəllimlər ---------- */
 
    async function getTeachers() {
        const saved = readStorage(STORAGE_KEYS.teachers, null);
 
        if (Array.isArray(saved)) {
            return saved;
        }
 
        const data = await fetchJson("data/teachers.json");
        writeStorage(STORAGE_KEYS.teachers, data);
        return data;
    }
 

 
    function createID(prefix, items) {
        const numbers = items
            .map((item) => Number(String(item.id || "").replace(/\D/g, "")))
            .filter(Number.isFinite);
 
        const next = numbers.length ? Math.max(...numbers) + 1 : 1;
 
        return `${prefix}-${next}`;
    }
 
    window.KursApi = {
        fetchJson,
        getCourses,
        getStudents,
        getTeachers,
        saveCourses,
        saveStudents,
        createID,
        readStorage,
        writeStorage,
        STORAGE_KEYS
    };
})();
 