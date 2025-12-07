const API_URL = 'http://localhost:3000/api/projects'; 

document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    setupModalsAndForms();
    setupDropArea();
});

// --- Основные Константы Модальных Окон ---
const uploadModal = document.getElementById('upload-modal');
const fileModal = document.getElementById('file-modal');
const fileListContainer = document.getElementById('file-list-container');
const fileViewer = document.getElementById('file-viewer');
const fileModalTitle = document.getElementById('file-modal-title');
const openInNewWindowLink = document.getElementById('open-in-new-window');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('project-zip');
const dropArea = document.getElementById('drop-area');

// --- Функции Отображения и Избранного ---

async function loadProjects() {
    const gridContainer = document.getElementById('projects-grid');
    gridContainer.innerHTML = '<h2>Загрузка...</h2>';

    try {
        const response = await fetch(API_URL);
        const projects = await response.json();
        
        gridContainer.innerHTML = ''; 
        
        if (projects.length === 0) {
            gridContainer.innerHTML = '<h2>Проектов пока нет. Добавьте первый!</h2>';
            return;
        }

        projects.forEach(project => {
            gridContainer.appendChild(createProjectCard(project));
        });

    } catch (error) {
        console.error('Ошибка при загрузке проектов:', error);
        gridContainer.innerHTML = '<h2>Не удалось загрузить проекты. Проверьте подключение к серверу (порт 3000).</h2>';
    }
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    
    // Создание кнопки избранного
    const favoriteIcon = project.is_favorite ? '★' : '☆';
    const favoriteClass = project.is_favorite ? '' : 'not-favorite';
    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = `favorite-btn ${favoriteClass}`;
    favoriteBtn.innerHTML = favoriteIcon;
    favoriteBtn.title = project.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное';

    favoriteBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(project.id, !project.is_favorite, favoriteBtn);
    };

    // Создание кнопки просмотра файлов
    const codeButton = document.createElement('button');
    codeButton.textContent = 'Посмотреть / Выбрать файл 🔍';
    codeButton.style.marginTop = '15px';
    codeButton.style.padding = '8px 15px';
    codeButton.style.cursor = 'pointer';
    codeButton.style.backgroundColor = '#ecf0f1';
    codeButton.style.border = 'none';
    codeButton.style.borderRadius = '5px';
    codeButton.onclick = (e) => {
        e.stopPropagation();
        e.preventDefault();
        openFileModal(project);
    };

    card.innerHTML = `
        <h3>${project.title}</h3>
        <p>${project.description}</p>
        <div class="tags">
            ${project.technologies.map(tech => `<span class="tag">${tech}</span>`).join('')}
        </div>
    `;
    card.prepend(favoriteBtn);
    card.appendChild(codeButton);
    return card;
}

async function toggleFavorite(projectId, newStatus, buttonElement) {
    try {
        const response = await fetch(`${API_URL}/${projectId}/favorite`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_favorite: newStatus })
        });

        if (response.ok) {
            buttonElement.innerHTML = newStatus ? '★' : '☆';
            buttonElement.classList.toggle('not-favorite', !newStatus);
            // Перезагрузка для обновления сортировки
            loadProjects(); 
        } else {
            alert('Не удалось обновить статус избранного.');
        }
    } catch (error) {
        console.error('Сетевая ошибка при обновлении избранного:', error);
    }
}

// --- Функции Управления Модальными Окнами ---

function setupModalsAndForms() {
    document.getElementById('add-project-btn').onclick = () => { uploadModal.style.display = 'block'; }

    document.querySelectorAll('.close-button').forEach(btn => {
        btn.onclick = (event) => {
            const targetId = event.target.getAttribute('data-close-target');
            document.getElementById(targetId).style.display = 'none';
            if (targetId === 'file-modal') { fileViewer.src = ''; }
        };
    });

    window.onclick = (event) => {
        if (event.target == uploadModal) { uploadModal.style.display = 'none'; }
        if (event.target == fileModal) { fileModal.style.display = 'none'; fileViewer.src = ''; }
    }
    
    uploadForm.onsubmit = handleUpload;
}

// --- Функции Загрузки ---

function setupDropArea() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.style.backgroundColor = '#eef', false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.style.backgroundColor = 'transparent', false);
    });

    dropArea.addEventListener('drop', handleDrop, false);
    dropArea.addEventListener('click', () => fileInput.click(), false);
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            dropArea.textContent = `Выбран файл: ${fileInput.files[0].name}`;
        }
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const files = e.dataTransfer.files;
    fileInput.files = files;
    if (files.length > 0) {
        dropArea.textContent = `Выбран файл: ${files[0].name}`;
    }
}

async function handleUpload(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-upload-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Загрузка и распаковка...';

    const formData = new FormData(uploadForm);
    
    if (!fileInput.files[0]) {
        alert('Пожалуйста, выберите ZIP-файл проекта.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Загрузить проект';
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData 
        });

        if (response.ok) {
            alert('Проект успешно загружен!');
            uploadModal.style.display = 'none';
            uploadForm.reset();
            dropArea.textContent = 'Перетащите ZIP сюда или нажмите для выбора';
            loadProjects(); 
        } else {
            const errorText = await response.text();
            alert(`Ошибка загрузки: ${errorText}`);
        }
    } catch (error) {
        console.error('Сетевая ошибка при загрузке:', error);
        alert('Не удалось связаться с сервером.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Загрузить проект';
    }
}


// --- Функции Просмотра Файлов ---

async function openFileModal(project) {
    fileModalTitle.textContent = `Файлы проекта: ${project.title}`;
    fileListContainer.innerHTML = '<h4>Загрузка списка файлов...</h4>';
    fileViewer.src = '';
    openInNewWindowLink.style.display = 'none';

    fileModal.style.display = 'block';

    try {
        const response = await fetch(`${API_URL}/${project.id}/files`);
        if (!response.ok) throw new Error('Не удалось получить список файлов.');

        const files = await response.json();
        
        fileListContainer.innerHTML = '';
        const list = document.createElement('div');
        list.style.padding = '10px 0';
        
        files.forEach(fileName => {
            const button = document.createElement('button');
            button.textContent = fileName;
            button.className = 'file-select-btn';
            button.style.margin = '5px';
            button.style.padding = '8px 12px';
            
            button.onclick = () => viewFile(project.id, fileName);
            list.appendChild(button);
        });
        
        fileListContainer.appendChild(list);

    } catch (error) {
        console.error('Ошибка при загрузке списка файлов:', error);
        fileListContainer.innerHTML = '<h4>Ошибка: Не удалось получить файлы с сервера.</h4>';
    }
}

function viewFile(projectId, fileName) {
    const fileUrl = `${API_URL}/${projectId}/file/${fileName}`;
    
    fileViewer.src = fileUrl; 
    openInNewWindowLink.href = fileUrl;
    openInNewWindowLink.style.display = 'inline-block';

    // Подсветка выбранной кнопки
    document.querySelectorAll('.file-select-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    const selectedBtn = Array.from(document.querySelectorAll('.file-select-btn')).find(btn => btn.textContent === fileName);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
    }
}
