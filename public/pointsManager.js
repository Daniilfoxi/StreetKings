class PointsManager {
    constructor() {
        this.points = [];
    }

    // Синхронизация данных с сервером (вызывается при init)
    sync(data) {
        this.points = data;
    }

    // Обновление конкретной точки (вызывается при update)
    updatePoint(data) {
        const p = this.points.find(pt => pt.id === data.id);
        if (p) Object.assign(p, data);
    }

    // Проверка попадания по точке (для кликов)
    checkHit(worldX, worldY) {
        // Радиус 50 пикселей, чтобы было легче попасть пальцем
        return this.points.find(p => Math.hypot(p.x - worldX, p.y - worldY) < 50);
    }

    // Основной цикл отрисовки
    draw(ctx, myId) {
        const now = Date.now();

        this.points.forEach(p => {
            const isOwner = p.owner === myId;
            const isNeutral = p.owner === 'neutral';
            
            // Определяем цветовую схему
            let themeColor = isNeutral ? '#d4af37' : (isOwner ? '#4cd964' : '#ff3b30');
            let ownerText = isNeutral ? "ГОСУДАРСТВО" : (isOwner ? "ВАШ КОНТРОЛЬ" : "ВРАЖЕСКАЯ ГРУППИРОВКА");

            ctx.save();
            
            // 1. Анимация пульсации, если идет захват
            let pulse = 0;
            if (p.isCapturing) {
                pulse = Math.sin(now / 150) * 5;
            }

            // 2. Рисуем "Ядро" точки
            ctx.shadowBlur = 15 + pulse;
            ctx.shadowColor = themeColor;
            ctx.fillStyle = themeColor;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 25 + (pulse / 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // 3. Параметры плашки UI
            const rectW = 190;
            const rectH = 60;
            const rectX = p.x - rectW / 2;
            const rectY = p.y - 110;

            // Соединительная пунктирная линия
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(p.x, p.y - 25);
            ctx.lineTo(p.x, rectY + rectH);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            ctx.stroke();
            ctx.setLineDash([]);

            // 4. Отрисовка плашки (Меню)
            ctx.fillStyle = "rgba(10, 10, 10, 0.9)"; // Темный фон
            ctx.strokeStyle = themeColor;
            ctx.lineWidth = 2;
            this.roundRect(ctx, rectX, rectY, rectW, rectH, 10, true, true);

            // Текст: Название
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 16px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(p.name.toUpperCase(), rectX + 15, rectY + 25);

            // Текст: Владелец
            ctx.fillStyle = themeColor;
            ctx.font = "10px monospace";
            ctx.fillText(ownerText, rectX + 15, rectY + 45);

            // Индикатор дохода
            if (isOwner) {
                ctx.fillStyle = "#4cd964";
                ctx.textAlign = "right";
                ctx.font = "bold 12px sans-serif";
                ctx.fillText("+$10/S", rectX + rectW - 15, rectY + 45);
            }

            // 5. Шкала прогресса захвата
            if (p.isCapturing && p.captureEnd > now) {
                this.drawProgress(ctx, p, now);
            }

            ctx.restore();
        });
    }

    // Метод отрисовки кругового прогресса
    drawProgress(ctx, p, now) {
        const total = p.captureEnd - p.captureStart;
        const current = now - p.captureStart;
        const progress = Math.max(0, Math.min(current / total, 1));

        // Фоновое кольцо (серое)
        ctx.beginPath();
        ctx.arc(p.x, p.y, 40, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 10;
        ctx.stroke();

        // Активная полоса (белая)
        ctx.beginPath();
        ctx.arc(p.x, p.y, 40, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progress));
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.stroke();
    }

    // Вспомогательная функция для прямоугольников со скругленными углами
    roundRect(ctx, x, y, width, height, radius, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }
}