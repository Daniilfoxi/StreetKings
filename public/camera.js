class Camera {
    constructor(canvas, worldWidth, worldHeight) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.minZoom = 1;
        this.maxZoom = 2.5;
        
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };

        // Кэшируем элементы UI один раз, чтобы не искать их 60 раз в секунду
        this.uiCoords = document.getElementById('coords');
        this.uiZoom = document.getElementById('zoom');
        
        this.updateMinZoom();
        this.setToMinZoom();
    }

    updateMinZoom() {
        const zoomX = this.canvas.width / this.worldWidth;
        const zoomY = this.canvas.height / this.worldHeight;
        this.minZoom = Math.max(zoomX, zoomY);
    }

    setToMinZoom() {
        this.zoom = this.minZoom;
        // Центрируем
        this.x = (this.canvas.width - this.worldWidth * this.zoom) / 2;
        this.y = (this.canvas.height - this.worldHeight * this.zoom) / 2;
    }

    clamp() {
        if (this.zoom < this.minZoom) this.zoom = this.minZoom;
        if (this.zoom > this.maxZoom) this.zoom = this.maxZoom;

        const minX = this.canvas.width - (this.worldWidth * this.zoom);
        const minY = this.canvas.height - (this.worldHeight * this.zoom);

        // Центрирование по X
        if (this.worldWidth * this.zoom <= this.canvas.width) {
            this.x = (this.canvas.width - this.worldWidth * this.zoom) / 2;
        } else {
            this.x = Math.min(0, Math.max(this.x, minX));
        }

        // Центрирование по Y
        if (this.worldHeight * this.zoom <= this.canvas.height) {
            this.y = (this.canvas.height - this.worldHeight * this.zoom) / 2;
        } else {
            this.y = Math.min(0, Math.max(this.y, minY));
        }
    }

    screenToWorld(sx, sy) {
        return {
            x: (sx - this.x) / this.zoom,
            y: (sy - this.y) / this.zoom
        };
    }

    begin() {
        this.clamp(); 
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.translate(this.x, this.y);
        this.ctx.scale(this.zoom, this.zoom);
    }

    end() {
        this.ctx.restore();
        // Обновляем текст только если элементы найдены и значения изменились
        if (this.uiCoords) this.uiCoords.innerText = `X: ${Math.round(this.x)} Y: ${Math.round(this.y)}`;
        if (this.uiZoom) this.uiZoom.innerText = `${Math.round(this.zoom * 100)}%`;
    }
}