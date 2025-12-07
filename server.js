const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Для распаковки ZIP нужна внешняя библиотека. Установите: npm install adm-zip
const AdmZip = require('adm-zip'); 

// --- 1. Настройка Сервера и Файловых Путей ---
const app = express();
const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads_temp'); // Временное хранение ZIP
const PROJECTS_BASE_PATH = path.join(__dirname, 'projects'); // Распакованные проекты

// Создание необходимых папок
[UPLOAD_DIR, PROJECTS_BASE_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Настройка Multer для обработки загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Сохраняем файл под уникальным именем
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Имитация Базы Данных
let projectsDB = [
    {
        id: 'p1',
        title: 'Интерактивный Калькулятор',
        description: 'Простой JavaScript-калькулятор с отзывчивым дизайном.',
        technologies: ['JavaScript', 'HTML', 'CSS'],
        link: '#', 
        is_favorite: true,
    },
    {
        id: 'p2',
        title: 'Генератор Палитр (Демо)',
        description: 'Скрипт, который генерирует цветовые палитры.',
        technologies: ['Python', 'Flask', 'AI'],
        link: '#', 
        is_favorite: false,
    }
];
let nextProjectId = 3; 

// --- 2. API Роуты ---

// GET /api/projects - Получить все проекты
app.get('/api/projects', (req, res) => {
    // Сортировка: избранные идут первыми
    const sortedProjects = [...projectsDB].sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
    res.json(sortedProjects);
});

// POST /api/projects - Загрузка и распаковка нового проекта
app.post('/api/projects', upload.single('projectFile'), (req, res) => {
    const { name, description } = req.body;
    const file = req.file;

    if (!name || !file || !file.mimetype.includes('zip')) {
        // Удаляем загруженный файл, если он не нужен или неверный формат
        if (file) fs.unlinkSync(file.path);
        return res.status(400).send('Требуется название проекта и ZIP-файл.');
    }

    const projectId = `p${nextProjectId++}`;
    const projectFolderName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const projectDestPath = path.join(PROJECTS_BASE_PATH, projectFolderName);

    try {
        // 1. Распаковка ZIP
        const zip = new AdmZip(file.path);
        zip.extractAllTo(projectDestPath, true); // Распаковка

        // 2. Создание записи в БД
        const newProject = {
            id: projectId,
            title: name,
            description: description || 'Описание не предоставлено.',
            technologies: ['HTML', 'CSS', 'JS', 'ZIP'], // В реале - AI-анализ
            link: `/projects/${projectFolderName}`, 
            is_favorite: false,
        };
        projectsDB.push(newProject);
        
        // 3. Очистка (удаление временного ZIP-файла)
        fs.unlinkSync(file.path);

        console.log(`Проект "${name}" загружен и распакован в ${projectDestPath}`);
        res.status(201).json(newProject);

    } catch (error) {
        console.error('Ошибка при обработке ZIP-файла:', error);
        // Попытка очистки, если что-то пошло не так
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        if (fs.existsSync(projectDestPath)) fs.rmSync(projectDestPath, { recursive: true, force: true });
        
        res.status(500).send('Ошибка при распаковке или обработке файла.');
    }
});

// PATCH /api/projects/:id/favorite - Обновить статус избранного
app.patch('/api/projects/:id/favorite', (req, res) => {
    const projectId = req.params.id;
    const { is_favorite } = req.body;

    const project = projectsDB.find(p => p.id === projectId);
    if (!project) return res.status(404).send('Проект не найден.');

    if (typeof is_favorite !== 'boolean') return res.status(400).send('Неверный формат данных.');

    project.is_favorite = is_favorite;
    res.json({ id: projectId, is_favorite: is_favorite });
});

// GET /api/projects/:id/files - Получить список файлов проекта
app.get('/api/projects/:id/files', (req, res) => {
    const projectId = req.params.id;
    const project = projectsDB.find(p => p.id === projectId);
    if (!project) return res.status(404).send('Проект не найден.');

    const projectFolderName = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'); 
    const projectPath = path.join(PROJECTS_BASE_PATH, projectFolderName);
    
    if (!fs.existsSync(projectPath)) {
        return res.status(404).send('Папка проекта на сервере не найдена.');
    }

    try {
        const files = fs.readdirSync(projectPath);
        res.json(files.filter(f => !f.startsWith('.'))); 
    } catch (error) {
        console.error('Ошибка при чтении файлов:', error);
        res.status(500).send('Ошибка сервера при доступе к файлам.');
    }
});

// GET /api/projects/:id/file/:filename - Отдать конкретный файл для просмотра
app.get('/api/projects/:id/file/:filename', (req, res) => {
    const projectId = req.params.id;
    const filename = req.params.filename;
    const project = projectsDB.find(p => p.id === projectId);
    
    if (!project) return res.status(404).send('Проект не найден.');

    const projectFolderName = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filePath = path.join(PROJECTS_BASE_PATH, projectFolderName, filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Файл не найден.');
    }

    res.sendFile(filePath); 
});

// --- 3. Запуск Сервера ---
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});
