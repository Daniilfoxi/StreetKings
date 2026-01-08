class PointsManager {
    constructor() {
        this.points = [];
    }

    // Синхронизация данных с сервером
    sync(data) {
        this.points = data;
    }

    // Обновление конкретной точки
    updatePoint(data) {
        const p = this.points.find(pt => pt.id === data.id);
        if (p) Object.assign(p, data);
    }

    // Проверка попадания по точке (для кликов)
    checkHit(worldX, worldY) {
        return this.points.find(p => Math.hypot(p.x - worldX, p.y - worldY) < 50);
    }

    // Основной цикл отрисовки
    draw(ctx, myId) {
        const now = Date.now();

        this.points.forEach(p => {
            const isOwner = p.owner === myId;
            const isNeutral = p.owner === 'neutral';
            
            // 1. Определение цветов
            let themeColor = isNeutral ? '#d4af37' : (isOwner ? '#4cd964' : '#ff3b30');
            
            // 2. Логика динамических имен (TG WebApp)
            let ownerText = "";
            if (p.isCapturing) {
                // Если точку кто-то штурмует прямо сейчас
                ownerText = `ШТУРМ: ${p.attackerName || "КТО-ТО"}`;
            } else if (isNeutral) {
                ownerText = "ГОСУДАРСТВО";
            } else {
                // Показываем ник владельца (свой или чужой)
                ownerText = isOwner ? "ВАШ КОНТРОЛЬ" : `БАНДА: ${p.ownerName || "ВРАГИ"}`;
            }

            ctx.save();
            
            // 3. Анимация пульсации при захвате
            let pulse = 0;
            if (p.isCapturing) {
                pulse = Math.sin(now / 150) * 5;
            }

            // 4. Рисуем ядро точки
            ctx.shadowBlur = 15 + pulse;
            ctx.shadowColor = themeColor;
            ctx.fillStyle = themeColor;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 25 + (pulse / 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // 5. Параметры плашки UI
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

            // 6. Отрисовка плашки (Меню)
            ctx.fillStyle = "rgba(10, 10, 10, 0.95)"; 
            ctx.strokeStyle = themeColor;
            ctx.lineWidth = 2;
            this.roundRect(ctx, rectX, rectY, rectW, rectH, 10, true, true);

            // Текст: Название точки
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 15px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(p.name.toUpperCase(), rectX + 15, rectY + 25);

            // Текст: Статус владельца/штурма
            ctx.fillStyle = themeColor;
            ctx.font = "bold 10px monospace";
            ctx.fillText(ownerText, rectX + 15, rectY + 45);

            // Текст: Доход (только если вы владелец и нет штурма)
            if (isOwner && !p.isCapturing) {
                ctx.fillStyle = "#4cd964";
                ctx.textAlign = "right";
                ctx.font = "bold 12px sans-serif";
                ctx.fillText("+$10/S", rectX + rectW - 15, rectY + 45);
            }

            // 7. Круговая шкала прогресса (под точкой)
            if (p.isCapturing && p.captureEnd > now) {
                this.drawProgress(ctx, p, now);
            }

            ctx.restore();
        });
    }

    drawProgress(ctx, p, now) {
        const total = p.captureEnd - p.captureStart;
        const current = now - p.captureStart;
        const progress = Math.max(0, Math.min(current / total, 1));

        // Фон кольца
        ctx.beginPath();
        ctx.arc(p.x, p.y, 42, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.lineWidth = 10;
        ctx.stroke();

        // Полоса прогресса
        ctx.beginPath();
        ctx.arc(p.x, p.y, 42, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progress));
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.stroke();
    }

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