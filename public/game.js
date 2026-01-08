const canvas = document.getElementById('gameCanvas');
const cam = new Camera(canvas, 1600, 1600); 
const pointsMgr = new PointsManager();      
const socket = io();
window.socket = socket; 

const mapImg = new Image();
mapImg.src = 'maps.jpg';

let dragDistance = 0;
let playerCooldownEnd = 0; 
let myPlayerKey = ""; 
let selectedPointId = null; 

mapImg.onload = () => {
    cam.ctx.imageSmoothingEnabled = true;
    cam.ctx.imageSmoothingQuality = 'high';
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

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function isItMe(ownerKey) {
    if (!ownerKey || !myPlayerKey) return false;
    return ownerKey === myPlayerKey;
}

// --- СЕТЕВАЯ ЛОГИКА ---

socket.on('news_update', (text) => {
    const newsContent = document.getElementById('news-content');
    if (newsContent) {
        newsContent.style.animation = 'none';
        newsContent.offsetHeight; 
        newsContent.style.animation = 'ticker 25s linear infinite';
        newsContent.innerText = text;
    }
});

socket.on('set_name_confirmed', (key) => {
    myPlayerKey = key;
    console.log("CLIENT KEY CONFIRMED:", myPlayerKey);
});

socket.on('init', (data) => pointsMgr.sync(data));

socket.on('update', (data) => {
    pointsMgr.updatePoint(data);
    // Обновляем UI меню в реальном времени, если оно открыто
    if (selectedPointId === data.id) {
        updateMenuUI(data);
    }
});

socket.on('money_update', (balance) => {
    const moneyElem = document.getElementById('money-display');
    if (moneyElem) moneyElem.innerText = `$ ${balance.toLocaleString()}`;
});

socket.on('player_cooldown', (endTime) => {
    playerCooldownEnd = endTime;
});

socket.on('error_msg', (msg) => {
    window.Telegram?.WebApp ? window.Telegram.WebApp.showAlert(msg) : alert(msg);
});

// --- ЛОГИКА ИГРОВОГО МЕНЮ ---

function updateMenuUI(point) {
    const menu = document.getElementById('point-menu');
    const title = document.getElementById('menu-title');
    const info = document.getElementById('menu-info');
    const upgradeBtn = document.getElementById('btn-upgrade');

    if (!menu || !point) return;

    title.innerText = point.name;
    info.innerHTML = `
        <div style="line-height: 1.6;">
            УРОВЕНЬ: <span style="color: #fff; float: right;">${point.level}</span><br>
            ДОХОД: <span style="color: #4cd964; float: right;">+$${point.income}/сек</span><br>
            ВЛАДЕЕТ: <span style="color: #5ac8fa; float: right;">${point.ownerName}</span>
        </div>
    `;

    if (isItMe(point.owner)) {
        upgradeBtn.style.display = "block";
        upgradeBtn.style.background = "#4cd964";
        upgradeBtn.innerText = `УЛУЧШИТЬ ($5000)`;
        upgradeBtn.onclick = () => socket.emit('upgrade_point', point.id);
    } else {
        upgradeBtn.style.display = "block";
        upgradeBtn.style.background = "#ff3b30";
        upgradeBtn.innerText = `ЗАХВАТИТЬ`;
        upgradeBtn.onclick = () => {
            socket.emit('capture', point.id);
            menu.style.display = "none";
        };
    }
}

function handleInput(clientX, clientY) {
    if (dragDistance > 15) return;

    const now = Date.now();
    const menu = document.getElementById('point-menu');
    const worldCoords = cam.screenToWorld(clientX, clientY);
    const clickedPoint = pointsMgr.checkHit(worldCoords.x, worldCoords.y);

    if (clickedPoint) {
        // Проверка кулдауна только для захвата
        if (!isItMe(clickedPoint.owner) && playerCooldownEnd > now) {
            const rem = Math.ceil((playerCooldownEnd - now) / 1000);
            const msg = `Перезарядка: ${rem} сек.`;
            window.Telegram?.WebApp ? window.Telegram.WebApp.showAlert(msg) : alert(msg);
            return;
        }

        selectedPointId = clickedPoint.id;
        updateMenuUI(clickedPoint);
        menu.style.display = "block";
    } else {
        menu.style.display = "none";
        selectedPointId = null;
    }
}

const closeBtn = document.getElementById('btn-close');
if (closeBtn) closeBtn.onclick = () => {
    document.getElementById('point-menu').style.display = "none";
    selectedPointId = null;
};

// --- ПОЛНОЕ УПРАВЛЕНИЕ (МЫШЬ + ТАЧ + ЗУМ) ---

const triggerCamMove = () => {
    window.dispatchEvent(new CustomEvent('camera_move', { 
        detail: { x: cam.x, y: cam.y, zoom: cam.zoom } 
    }));
};

// Мышь
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
    if (dragDistance > 20) document.getElementById('point-menu').style.display = "none";
    triggerCamMove();
});

window.addEventListener('mouseup', () => cam.isDragging = false);

// Колесо (Зум)
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const worldPos = cam.screenToWorld(e.clientX, e.clientY);
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    cam.zoom = Math.min(Math.max(cam.zoom * zoomFactor, cam.minZoom), cam.maxZoom);
    cam.x = e.clientX - worldPos.x * cam.zoom;
    cam.y = e.clientY - worldPos.y * cam.zoom;
    cam.clamp();
    triggerCamMove();
}, { passive: false });

canvas.addEventListener('click', (e) => handleInput(e.clientX, e.clientY));

// Тач-управление (Мобилки)
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
    if (dragDistance > 20) document.getElementById('point-menu').style.display = "none";
    cam.clamp(); 
    triggerCamMove();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    cam.isDragging = false;
    if (dragDistance < 15 && e.changedTouches.length > 0 && e.touches.length === 0) {
        handleInput(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }
});

// --- ГЛАВНЫЙ ЦИКЛ ---

function loop() {
    cam.begin();
    if (mapImg.complete) {
            // 1. Сначала настраиваем «очки» (фильтр)
            cam.ctx.filter = "brightness(0.6) contrast(1.1)"; 
            
            // 2. Рисуем карту ОДИН РАЗ (она сразу нарисуется темной и четкой)
            cam.ctx.drawImage(mapImg, 0, 0, 1600, 1600);
            
            // 3. Снимаем «очки», чтобы всё остальное (здания) было ярким
            cam.ctx.filter = "none";
        }
    
    pointsMgr.draw(cam.ctx, myPlayerKey);
    cam.end();

    const now = Date.now();
    const cooldownElem = document.getElementById('cooldown-timer');
    if (cooldownElem) {
        if (playerCooldownEnd > now) {
            cooldownElem.style.display = 'block';
            cooldownElem.innerText = `ПЕРЕЗАРЯДКА: ${Math.ceil((playerCooldownEnd - now)/1000)}s`;
        } else {
            cooldownElem.style.display = 'none';
        }
    }

    requestAnimationFrame(loop);
}
loop();