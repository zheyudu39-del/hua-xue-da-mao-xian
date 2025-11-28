// 开场动画 - 电影级雪崩逃生场景
class IntroAnimation {
    constructor() {
        this.canvas = document.getElementById('introCanvas');
        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true
        });
        this.canvas.width = 1600;
        this.canvas.height = 900;
        
        this.time = 0;
        this.duration = 15000; // 15秒完整动画
        this.isRunning = true;
        
        // 动画阶段
        this.phase = 'calm'; // calm -> rumble -> avalanche -> chase -> title
        this.phaseTime = 0;
        
        // 镜头参数
        this.cameraY = 0; // 镜头高度
        this.cameraZoom = 1; // 镜头缩放
        this.cameraShake = 0; // 镜头震动
        
        // 滑雪者参数
        this.skierX = 800;
        this.skierY = 600;
        this.skierState = 'sitting'; // sitting -> standing -> running
        this.skierSpeed = 0;
        this.skierPanic = 0; // 恐慌程度 0-1
        
        // 雪崩参数
        this.avalancheX = -500;
        this.avalancheY = 0;
        this.avalancheSpeed = 0;
        this.avalancheHeight = 0;
        this.avalancheIntensity = 0;
        
        // 环境元素
        this.mountains = this.initMountains();
        this.trees = this.initTrees();
        this.snowflakes = this.initSnowflakes();
        this.avalancheParticles = [];
        this.debris = []; // 被卷起的树木和岩石
        
        // 音效提示（实际项目中可以添加音频）
        this.soundCues = {
            rumble: false,
            avalanche: false,
            heartbeat: false
        };
        
        this.animate();
    }
    
    initMountains() {
        // 初始化远处的雪山
        return [
            { x: 200, y: 200, width: 300, height: 250 },
            { x: 450, y: 150, width: 400, height: 300 },
            { x: 800, y: 180, width: 350, height: 280 },
            { x: 1100, y: 220, width: 300, height: 240 }
        ];
    }
    
    initTrees() {
        // 初始化松树林
        const trees = [];
        for (let i = 0; i < 20; i++) {
            trees.push({
                x: Math.random() * this.canvas.width,
                y: 500 + Math.random() * 200,
                size: 40 + Math.random() * 30,
                destroyed: false
            });
        }
        return trees;
    }
    
    initSnowflakes() {
        const flakes = [];
        for (let i = 0; i < 150; i++) {
            flakes.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 3 + 1,
                speed: Math.random() * 2 + 1,
                drift: Math.random() * 0.5 - 0.25
            });
        }
        return flakes;
    }
    
    initAvalancheParticles() {
        for (let i = 0; i < 150; i++) {
            this.avalancheParticles.push({
                x: Math.random() * 400,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 20 + 5,
                speedX: Math.random() * 4 + 3,
                speedY: Math.random() * 3 - 1.5,
                opacity: Math.random() * 0.6 + 0.4
            });
        }
    }
    
    animate() {
        if (!this.isRunning) return;
        
        this.time += 16;
        
        if (this.time >= this.duration) {
            this.finish();
            return;
        }
        
        this.update();
        this.draw();
        
        requestAnimationFrame(() => this.animate());
    }
    
    update() {
        // 更新滑雪者位置
        this.skierX += this.skierSpeed;
        this.skierY += Math.sin(this.time * 0.005) * 2;
        
        // 更新雪崩位置
        this.avalancheX += this.avalancheSpeed;
        
        // 更新雪花
        this.snowflakes.forEach(snow => {
            snow.y += snow.speed;
            if (snow.y > this.canvas.height) {
                snow.y = -10;
                snow.x = Math.random() * this.canvas.width;
            }
        });
        
        // 更新雪崩粒子
        this.avalancheParticles.forEach(p => {
            p.x += p.speedX;
            p.y += p.speedY;
            
            if (p.x > 400) p.x = 0;
            if (p.y < 0) p.y = this.canvas.height;
            if (p.y > this.canvas.height) p.y = 0;
        });
    }
    
    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制天空 - 夜晚深蓝天空
        const skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        skyGradient.addColorStop(0, '#1a3a52');  // 深蓝色（夜空）
        skyGradient.addColorStop(0.5, '#2a4a62'); // 中蓝色
        skyGradient.addColorStop(1, '#3a5a72');   // 亮一点的蓝色
        this.ctx.fillStyle = skyGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制星星
        this.drawStars();
        
        // 绘制月亮
        this.drawMoon();
        
        // 绘制云朵
        this.drawClouds();
        
        // 绘制雪花
        this.ctx.fillStyle = '#FFFFFF';
        this.snowflakes.forEach(snow => {
            this.ctx.globalAlpha = 0.6;
            this.ctx.beginPath();
            this.ctx.arc(snow.x, snow.y, snow.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
        
        // 绘制纯白色雪坡
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 500);
        for (let x = 0; x < this.canvas.width; x += 50) {
            const y = 500 + Math.sin(x * 0.01 + this.time * 0.001) * 30;
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(this.canvas.width, this.canvas.height);
        this.ctx.lineTo(0, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 绘制雪崩
        this.drawAvalanche();
        
        // 绘制滑雪者
        this.drawSkier();
        
        // 绘制文字提示
        this.drawText();
    }
    
    drawStars() {
        // 绘制闪亮的星星
        this.ctx.save();
        const stars = [
            { x: 0.15, y: 0.08, size: 1.5, brightness: 1 },
            { x: 0.25, y: 0.15, size: 1.2, brightness: 0.8 },
            { x: 0.35, y: 0.05, size: 1.4, brightness: 0.9 },
            { x: 0.55, y: 0.18, size: 1.6, brightness: 1 },
            { x: 0.65, y: 0.08, size: 1.3, brightness: 0.85 },
            { x: 0.82, y: 0.06, size: 1.5, brightness: 0.95 },
            { x: 0.92, y: 0.10, size: 1.6, brightness: 1 },
        ];
        
        stars.forEach(star => {
            const x = this.canvas.width * star.x;
            const y = this.canvas.height * star.y;
            
            // 星星闪烁效果
            const twinkle = 0.7 + Math.sin(Date.now() * 0.003 + star.x * 10) * 0.3;
            const alpha = star.brightness * twinkle;
            
            // 星星主体
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 星星光芒（十字形）
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
            this.ctx.lineWidth = 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x - star.size * 2, y);
            this.ctx.lineTo(x + star.size * 2, y);
            this.ctx.moveTo(x, y - star.size * 2);
            this.ctx.lineTo(x, y + star.size * 2);
            this.ctx.stroke();
        });
        this.ctx.restore();
    }
    
    drawMoon() {
        // 绘制明亮的月亮（右上角）
        this.ctx.save();
        const moonX = this.canvas.width * 0.88;
        const moonY = this.canvas.height * 0.12;
        const moonRadius = 35;
        
        // 月亮光晕
        const glowGradient = this.ctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 3);
        glowGradient.addColorStop(0, 'rgba(255, 255, 220, 0.3)');
        glowGradient.addColorStop(0.5, 'rgba(255, 255, 220, 0.1)');
        glowGradient.addColorStop(1, 'rgba(255, 255, 220, 0)');
        this.ctx.fillStyle = glowGradient;
        this.ctx.beginPath();
        this.ctx.arc(moonX, moonY, moonRadius * 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 月亮主体
        const moonGradient = this.ctx.createRadialGradient(moonX - moonRadius * 0.3, moonY - moonRadius * 0.3, moonRadius * 0.1, moonX, moonY, moonRadius);
        moonGradient.addColorStop(0, '#FFFEF0');
        moonGradient.addColorStop(0.7, '#FFF8DC');
        moonGradient.addColorStop(1, '#F0E68C');
        this.ctx.fillStyle = moonGradient;
        this.ctx.beginPath();
        this.ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 月亮表面纹理（陨石坑）
        this.ctx.fillStyle = 'rgba(240, 230, 140, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(moonX + moonRadius * 0.3, moonY - moonRadius * 0.2, moonRadius * 0.15, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(moonX - moonRadius * 0.2, moonY + moonRadius * 0.3, moonRadius * 0.1, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawClouds() {
        // 绘制飘动的云朵
        this.ctx.save();
        const time = Date.now() * 0.0001;
        
        const clouds = [
            { x: 0.3, y: 0.15, scale: 0.8, speed: 1 },
            { x: 0.65, y: 0.22, scale: 0.6, speed: 0.8 },
        ];
        
        clouds.forEach(cloud => {
            const baseX = this.canvas.width * cloud.x;
            const offsetX = (time * cloud.speed * 50) % (this.canvas.width + 200) - 100;
            const x = (baseX + offsetX) % (this.canvas.width + 200);
            const y = this.canvas.height * cloud.y;
            
            this.drawSingleCloud(x, y, cloud.scale);
        });
        
        this.ctx.restore();
    }
    
    drawSingleCloud(x, y, scale) {
        // 绘制单个云朵
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        
        const size = 30 * scale;
        
        // 云朵由多个圆形组成
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        this.ctx.arc(x + size * 0.8, y, size * 0.7, 0, Math.PI * 2);
        this.ctx.arc(x + size * 1.6, y, size * 0.6, 0, Math.PI * 2);
        this.ctx.arc(x + size * 0.4, y - size * 0.4, size * 0.5, 0, Math.PI * 2);
        this.ctx.arc(x + size * 1.2, y - size * 0.3, size * 0.55, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawAvalanche() {
        this.ctx.save();
        
        // 雪崩主体
        const avalancheGradient = this.ctx.createLinearGradient(
            this.avalancheX, 0, 
            this.avalancheX + 400, 0
        );
        avalancheGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        avalancheGradient.addColorStop(0.5, 'rgba(230, 240, 250, 0.8)');
        avalancheGradient.addColorStop(1, 'rgba(200, 220, 240, 0.4)');
        
        this.ctx.fillStyle = avalancheGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(this.avalancheX, this.canvas.height);
        
        for (let y = this.canvas.height; y >= 0; y -= 30) {
            const wave = Math.sin(y * 0.02 + this.time * 0.01) * 40;
            this.ctx.lineTo(this.avalancheX + wave, y);
        }
        
        this.ctx.lineTo(this.avalancheX + 400, 0);
        this.ctx.lineTo(this.avalancheX + 400, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 雪崩粒子
        this.avalancheParticles.forEach(p => {
            this.ctx.globalAlpha = p.opacity;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.beginPath();
            this.ctx.arc(this.avalancheX + p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }
    
    drawSkier() {
        this.ctx.save();
        this.ctx.translate(this.skierX, this.skierY);
        
        // 滑雪板
        this.ctx.fillStyle = '#FF4757';
        this.ctx.fillRect(-25, 25, 30, 4);
        this.ctx.fillRect(10, 25, 30, 4);
        
        // 身体 - 蓝色滑雪服
        const bodyGradient = this.ctx.createLinearGradient(0, -10, 0, 20);
        bodyGradient.addColorStop(0, '#4A90E2');
        bodyGradient.addColorStop(1, '#2E5F8F');
        this.ctx.fillStyle = bodyGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 5, 12, 14, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 手臂
        this.ctx.fillStyle = '#4A90E2';
        this.ctx.beginPath();
        this.ctx.ellipse(-12, 8, 5, 10, -0.3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.ellipse(12, 8, 5, 10, 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 头盔
        this.ctx.fillStyle = '#FF6B6B';
        this.ctx.beginPath();
        this.ctx.ellipse(0, -12, 10, 11, 0, Math.PI, Math.PI * 2);
        this.ctx.fill();
        
        // 脸
        this.ctx.fillStyle = '#FFD4A3';
        this.ctx.beginPath();
        this.ctx.ellipse(0, -8, 9, 9, 0, 0, Math.PI);
        this.ctx.fill();
        
        // 护目镜
        this.ctx.strokeStyle = '#2C2C2C';
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
        this.ctx.beginPath();
        this.ctx.ellipse(0, -10, 11, 4, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawText() {
        this.ctx.save();
        
        // 标题
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.strokeStyle = '#2C2C2C';
        this.ctx.lineWidth = 3;
        this.ctx.font = 'bold 60px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.strokeText('滑雪大冒险', this.canvas.width / 2, 150);
        this.ctx.fillText('滑雪大冒险', this.canvas.width / 2, 150);
        
        // 副标题
        this.ctx.font = 'bold 36px Arial';
        this.ctx.strokeText('逃离雪崩！', this.canvas.width / 2, 220);
        this.ctx.fillText('逃离雪崩！', this.canvas.width / 2, 220);
        
        // 倒计时提示
        const remaining = Math.ceil((this.duration - this.time) / 1000);
        this.ctx.font = '24px Arial';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillText(`游戏即将开始... ${remaining}`, this.canvas.width / 2, this.canvas.height - 50);
        
        this.ctx.restore();
    }
    
    finish() {
        this.isRunning = false;
        
        // 隐藏开场动画
        document.getElementById('intro-animation').classList.add('hidden');
        
        // 显示开始界面
        document.getElementById('start-screen').classList.remove('hidden');
    }
}

// 页面加载后自动播放开场动画
window.addEventListener('load', () => {
    new IntroAnimation();
});
