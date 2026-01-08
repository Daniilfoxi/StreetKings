class PointsManager {
    constructor() {
        this.points = [];
        // Словарь иконок для разных типов зданий
        this.icons = {
            "ПОРТ": "🚢",
            "БАНК": "💰",
            "ОФИС": "🏢",
            "СКЛАД": "📦",
            "ЗАВОД": "🏭"
        };
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
    draw(ctx, myName) {
        const now = Date.now();

        this.points.forEach(p => {
            const isOwner = p.owner === myName && myName !== "";
            const isNeutral = p.owner === 'neutral';
            
            // 1. Цветовая схема
            let themeColor = isNeutral ? '#d4af37' : (isOwner ? '#4cd964' : '#ff3b30');
            
            let ownerText = "";
            const timeLeftPoint = Math.ceil((p.lastCapturedAt + 30000 - now) / 1000);
            const isProtected = timeLeftPoint > 0;

            if (p.isCapturing) {
                ownerText = `🔥 ШТУРМ: ${p.attackerName}`;
                themeColor = "#ffffff";
            } else if (isProtected) {
                ownerText = `🛡️ ЗАЩИТА: ${timeLeftPoint}S`;
                themeColor = "#5ac8fa"; 
            } else if (isNeutral) {
                ownerText = "ГОСУДАРСТВО";
            } else {
                ownerText = isOwner ? "✅ ВАШ КВАРТАЛ" : `❌ БАНДА: ${p.ownerName}`;
            }

            ctx.save();
            
            // --- НОВОЕ: Подчеркивание / Выделение своей точки ---
            if (isOwner && !p.isCapturing) {
                // Рисуем внешнее "аурическое" свечение для своих точек
                ctx.beginPath();
                ctx.arc(p.x, p.y, 35, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(76, 217, 100, 0.5)"; // Прозрачный зеленый
                ctx.lineWidth = 4;
                ctx.setLineDash([5, 3]); // Пунктирный круг вокруг
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // 3. Анимация пульсации
            let pulse = p.isCapturing ? Math.sin(now / 150) * 10 : 0;

            // 4. Ядро точки
            ctx.shadowBlur = isOwner ? 25 : 15 + pulse; // Свои точки светятся сильнее
            ctx.shadowColor = themeColor;
            ctx.fillStyle = themeColor;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 25 + (pulse / 2), 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Иконка
            ctx.font = "24px serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const icon = this.icons[p.name.toUpperCase()] || "📍";
            ctx.fillText(icon, p.x, p.y);

            // 5. Плашка UI
            const rectW = 210;
            const rectH = 70;
            const rectX = p.x - rectW / 2;
            const rectY = p.y - 120;

            // Линия к плашке
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.moveTo(p.x, p.y - 35);
            ctx.lineTo(p.x, rectY + rectH);
            ctx.strokeStyle = isOwner ? "rgba(76, 217, 100, 0.4)" : "rgba(255,255,255,0.2)";
            ctx.stroke();
            ctx.setLineDash([]);

            // 6. Отрисовка плашки
            ctx.fillStyle = "rgba(10, 10, 10, 0.95)"; 
            // Если точка твоя, делаем рамку чуть толще и ярче
            ctx.strokeStyle = themeColor;
            ctx.lineWidth = isOwner ? 4 : 2; 
            this.roundRect(ctx, rectX, rectY, rectW, rectH, 12, true, true);

            // Тексты
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 15px sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(`${p.name} [LVL ${p.level}]`, rectX + 15, rectY + 28);

            ctx.fillStyle = themeColor;
            ctx.font = "900 11px monospace";
            ctx.fillText(ownerText, rectX + 15, rectY + 52);

            if (isOwner && !p.isCapturing) {
                ctx.fillStyle = "#4cd964";
                ctx.textAlign = "right";
                ctx.font = "bold 13px sans-serif";
                ctx.fillText(`+$${p.income}/s`, rectX + rectW - 15, rectY + 52);
            }

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

        // Внешнее темное кольцо
        ctx.beginPath();
        ctx.arc(p.x, p.y, 40, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.lineWidth = 10;
        ctx.stroke();

        // Линия прогресса (белая)
        ctx.beginPath();
        ctx.arc(p.x, p.y, 40, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * progress));
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.stroke();
    }

    // Улучшенный метод рисования скругленного прямоугольника
    roundRect(ctx, x, y, width, height, radius, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }
}