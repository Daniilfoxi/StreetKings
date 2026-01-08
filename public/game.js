const canvas = document.getElementById('gameCanvas');
const cam = new Camera(canvas, 1600, 1600);
const pointsMgr = new PointsManager();
const socket = io();
const mapImg = new Image();
mapImg.src = 'maps.jpg';

let dragDistance = 0;

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
socket.on('init', (data) => pointsMgr.sync(data));
socket.on('update', (data) => pointsMgr.updatePoint(data));
socket.on('money_update', (balance) => {
    const moneyElem = document.getElementById('money-display');
    if (moneyElem) moneyElem.innerText = `$ ${balance.toLocaleString()}`;
});

// --- УПРАВЛЕНИЕ (МЫШЬ) ---
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
});

window.addEventListener('mouseup', () => cam.isDragging = false);

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const worldPos = cam.screenToWorld(e.clientX, e.clientY);
    cam.zoom *= (e.deltaY > 0 ? 0.9 : 1.1);
    cam.clamp();
    cam.x = e.clientX - worldPos.x * cam.zoom;
    cam.y = e.clientY - worldPos.y * cam.zoom;
    cam.clamp();
}, { passive: false });

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
    e.preventDefault();
    if (e.touches.length === 1 && cam.isDragging) {
        const dx = e.touches[0].clientX - cam.lastMouse.x;
        const dy = e.touches[0].clientY - cam.lastMouse.y;
        cam.x += dx; cam.y += dy;
        dragDistance += Math.abs(dx) + Math.abs(dy);
        cam.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
        // Pinch Zoom
        const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX, 
            e.touches[0].clientY - e.touches[1].clientY
        );
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const worldPos = cam.screenToWorld(centerX, centerY);

        cam.zoom = Math.min(Math.max(cam.zoom * (dist / cam.lastDist), cam.minZoom), cam.maxZoom);
        cam.lastDist = dist;
        
        // Центрируем зум относительно пальцев
        cam.x = centerX - worldPos.x * cam.zoom;
        cam.y = centerY - worldPos.y * cam.zoom;
    }
    cam.clamp(); 
}, { passive: false });

canvas.addEventListener('click', (e) => {
    if (dragDistance > 15) return;
    const world = cam.screenToWorld(e.clientX, e.clientY);
    const hit = pointsMgr.checkHit(world.x, world.y);
    if (hit) {
        socket.emit('capture', hit.id);
        if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
});

// --- ЦИКЛ ---
function loop() {
    cam.begin();
    if (mapImg.complete) {
        cam.ctx.drawImage(mapImg, 0, 0, 1600, 1600);
    }
    
    // Рисуем точки через менеджер
    pointsMgr.draw(cam.ctx, socket.id);

    cam.end();
    requestAnimationFrame(loop);
}
loop();