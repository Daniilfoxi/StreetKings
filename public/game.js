const canvas = document.getElementById('gameCanvas');
const cam = new Camera(canvas, 1600, 1600); 
const pointsMgr = new PointsManager();      
const socket = io();
const mapImg = new Image();
mapImg.src = 'maps.jpg';

let dragDistance = 0;
let playerCooldownEnd = 0; 
let myPlayerName = ""; // Храним имя игрока для корректной отрисовки владельца

mapImg.onload = () => {
    cam.updateMinZoom();
    cam.setToMinZoom();
    window.dispatchEvent(new Event('map_loaded'));
};

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cam.updateMinZoom();
    cam.clamp();
}
window.onresize = resize;
resize();

// --- СЕТЕВАЯ ЛОГИКА ---

// 1. Новости города (Бегущая строка)
socket.on('news_update', (text) => {
    const newsContent = document.getElementById('news-content');
    if (newsContent) {
        // Сброс анимации для перезапуска (хак с reflow)
        newsContent.style.animation = 'none';
        newsContent.offsetHeight; // триггер reflow
        newsContent.style.animation = 'ticker 25s linear infinite';
        newsContent.innerText = text;
    }
});

// Когда сервер подтверждает наше имя
socket.on('set_name', (name) => {
    myPlayerName = name;
});

socket.on('init', (data) => pointsMgr.sync(data));
socket.on('update', (data) => pointsMgr.updatePoint(data));

socket.on('money_update', (balance) => {
    const moneyElem = document.getElementById('money-display');
    if (moneyElem) moneyElem.innerText = `$ ${balance.toLocaleString()}`;
});

socket.on('player_cooldown', (endTime) => {
    playerCooldownEnd = endTime;
});

socket.on('error_msg', (msg) => {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.showAlert(msg);
    } else {
        alert(msg);
    }
});

// --- ЛОГИКА ВЗАИМОДЕЙСТВИЯ (КЛИКИ) ---
function handleInput(clientX, clientY) {
    if (dragDistance > 10) return;

    const now = Date.now();
    
    // Проверка КД на клиенте
    if (playerCooldownEnd > now) {
        const remaining = Math.ceil((playerCooldownEnd - now) / 1000);
        const msg = `Вы восстанавливаете силы. Ждите ${remaining} сек.`;
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(msg);
        } else {
            alert(msg);
        }
        return;
    }

    const worldCoords = cam.screenToWorld(clientX, clientY);
    const clickedPoint = pointsMgr.checkHit(worldCoords.x, worldCoords.y);

    if (clickedPoint) {
        if (clickedPoint.owner === myPlayerName) {
            const upgradeCost = 5000;
            const nextIncome = clickedPoint.income + 5;
            
            if (window.Telegram && window.Telegram.WebApp) {
                window.Telegram.WebApp.showConfirm(
                    `Улучшить ${clickedPoint.name} до LVL ${clickedPoint.level + 1} за $${upgradeCost}? Доход вырастет до $${nextIncome}/сек`,
                    (confirmed) => {
                        if (confirmed) socket.emit('upgrade_point', clickedPoint.id);
                    }
                );
            } else {
                if (confirm(`Улучшить здание за $5000?`)) {
                    socket.emit('upgrade_point', clickedPoint.id);
                }
            }
        } else {
            socket.emit('capture', clickedPoint.id);
        }
    }
}

function updateCooldownUI() {
    const now = Date.now();
    const cooldownElem = document.getElementById('cooldown-timer');
    if (!cooldownElem) return;

    if (playerCooldownEnd > now) {
        const remaining = Math.ceil((playerCooldownEnd - now) / 1000);
        cooldownElem.style.display = 'block';
        cooldownElem.innerText = `ПЕРЕЗАРЯДКА: ${remaining}s`;
    } else {
        cooldownElem.style.display = 'none';
    }
}

// --- УПРАВЛЕНИЕ ---
canvas.addEventListener('mousedown', (e) => {
    cam.isDragging = true;
    dragDistance = 0;
    cam.lastMouse = { x: e.clientX, y: e.clientY };
});

window.addEventListener('mousemove', (e) => {
    if (!cam.isDragging) return;
    const dx = e.clientX - cam.lastMouse.x;
    const dy = e.clientY - cam.lastMouse.y;
    cam.x += dx; cam.y += dy;
    dragDistance += Math.abs(dx) + Math.abs(dy);
    cam.lastMouse = { x: e.clientX, y: e.clientY };
    
    // Оповещаем UI о движении
    window.dispatchEvent(new CustomEvent('camera_move', { 
        detail: { x: cam.x, y: cam.y, zoom: cam.zoom } 
    }));
});

window.addEventListener('mouseup', () => cam.isDragging = false);

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const worldPos = cam.screenToWorld(e.clientX, e.clientY);
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    cam.zoom = Math.min(Math.max(cam.zoom * zoomFactor, cam.minZoom), cam.maxZoom);
    
    cam.x = e.clientX - worldPos.x * cam.zoom;
    cam.y = e.clientY - worldPos.y * cam.zoom;
    cam.clamp();

    window.dispatchEvent(new CustomEvent('camera_move', { 
        detail: { x: cam.x, y: cam.y, zoom: cam.zoom } 
    }));
}, { passive: false });

canvas.addEventListener('click', (e) => handleInput(e.clientX, e.clientY));

// --- УПРАВЛЕНИЕ (ТАЧ) ---
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        cam.isDragging = true;
        dragDistance = 0;
        cam.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
        cam.lastDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX, 
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
});

canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && cam.isDragging) {
        const dx = e.touches[0].clientX - cam.lastMouse.x;
        const dy = e.touches[0].clientY - cam.lastMouse.y;
        cam.x += dx; cam.y += dy;
        dragDistance += Math.abs(dx) + Math.abs(dy);
        cam.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX, 
            e.touches[0].clientY - e.touches[1].clientY
        );
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const worldPos = cam.screenToWorld(centerX, centerY);

        const zoomScale = dist / cam.lastDist;
        cam.zoom = Math.min(Math.max(cam.zoom * zoomScale, cam.minZoom), cam.maxZoom);
        
        cam.x = centerX - worldPos.x * cam.zoom;
        cam.y = centerY - worldPos.y * cam.zoom;
        cam.lastDist = dist;
    }
    cam.clamp(); 
    window.dispatchEvent(new CustomEvent('camera_move', { 
        detail: { x: cam.x, y: cam.y, zoom: cam.zoom } 
    }));
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    cam.isDragging = false;
    if (dragDistance < 10 && e.changedTouches.length > 0 && e.touches.length === 0) {
        handleInput(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
});

// --- ЦИКЛ ---
function loop() {
    cam.begin();
    if (mapImg.complete) {
        cam.ctx.drawImage(mapImg, 0, 0, 1600, 1600);
    }
    
    // Передаем myPlayerName для правильной подсветки "ВАШ КОНТРОЛЬ"
    pointsMgr.draw(cam.ctx, myPlayerName);

    cam.end();
    updateCooldownUI();
    requestAnimationFrame(loop);
}
loop();