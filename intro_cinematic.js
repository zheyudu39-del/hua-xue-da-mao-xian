// 电影级开场动画 - 雪崩逃生场景
class CinematicIntro {
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
        
        // 动画阶段（15秒完整版）
        this.phases = [
            { name: 'calm', start: 0, end: 3000 },        // 0-3秒：宁静场景
            { name: 'rumble', start: 3000, end: 5000 },   // 3-5秒：山体震动
            { name: 'avalanche', start: 5000, end: 7000 }, // 5-7秒：雪崩爆发
            { name: 'chase', start: 7000, end: 12000 },   // 7-12秒：惊险追逐
            { name: 'title', start: 12000, end: 15000 }   // 12-15秒：标题出现
        ];
        
        // 镜头
        this.camera = {
            y: -150,
            zoom: 0.85,
            shakeX: 0,
            shakeY: 0
        };
        
        // 主角
        this.skier = {
            x: 800,
            y: 580,
            state: 'sitting',
            eyeWide: 0,
            runCycle: 0
        };
        
        // 雪崩
        this.avalanche = {
            x: -700,
            speed: 0,
            height: 900,
            particles: []
        };
        
        // 环境
        this.mountains = this.createMountains();
        this.trees = this.createTrees();
        this.snowflakes = this.createSnowflakes();
        
        // 视觉效果
        this.fadeIn = 1; // 淡入效果
        this.vignette = 0; // 边缘暗化
        
        this.setupSkip();
        this.animate();
    }
    
    setupSkip() {
        this.skipHandler = (e) => {
            if (!this.isRunning) return; // 如果动画已结束，不处理
            this.finish();
        };
        this.clickHandler = () => {
            if (!this.isRunning) return; // 如果动画已结束，不处理
            this.finish();
        };
        // 只在intro canvas上监听，不影响整个window
        this.canvas.addEventListener('keydown', this.skipHandler);
        this.canvas.addEventListener('click', this.clickHandler);
    }
    
    createMountains() {
        return [
            { x: 150, y: 180, w: 350, h: 280 },
            { x: 450, y: 130, w: 450, h: 340 },
            { x: 850, y: 160, w: 400, h: 310 },
            { x: 1200, y: 200, w: 350, h: 270 }
        ];
    }
    
    createTrees() {
        const trees = [];
        for (let i = 0; i < 30; i++) {
            trees.push({
                x: 80 + Math.random() * 1440,
                y: 520 + Math.random() * 220,
                size: 30 + Math.random() * 45,
                fallen: false
            });
        }
        return trees.sort((a, b) => a.y - b.y);
    }
    
    createSnowflakes() {
        const flakes = [];
        // 根据设备性能调整粒子数量
        const count = window.innerWidth < 1200 ? 100 : 180;
        for (let i = 0; i < count; i++) {
            flakes.push({
                x: Math.random() * 1600,
                y: Math.random() * 900,
                size: Math.random() * 2.5 + 0.5,
                speed: Math.random() * 1.2 + 0.4,
                drift: Math.random() * 0.6 - 0.3,
                depth: Math.random() // 景深效果
            });
        }
        return flakes;
    }
    
    getCurrentPhase() {
        for (let phase of this.phases) {
            if (this.time >= phase.start && this.time < phase.end) {
                return { ...phase, progress: (this.time - phase.start) / (phase.end - phase.start) };
            }
        }
        return this.phases[this.phases.length - 1];
    }
    
    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    easeOut(t) {
        return 1 - Math.pow(1 - t, 3);
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
        const phase = this.getCurrentPhase();
        const p = phase.progress;
        
        // 淡入效果（前0.5秒）
        if (this.time < 500) {
            this.fadeIn = this.time / 500;
        } else {
            this.fadeIn = 1;
        }
        
        // 更新雪花（景深效果）
        this.snowflakes.forEach(flake => {
            const depthSpeed = 0.5 + flake.depth * 1.5; // 根据景深调整速度
            flake.y += flake.speed * depthSpeed;
            flake.x += flake.drift * depthSpeed;
            if (flake.y > 900) {
                flake.y = -10;
                flake.x = Math.random() * 1600;
            }
        });
        
        // 根据阶段更新
        switch(phase.name) {
            case 'calm':
                // 镜头缓慢下降
                this.camera.y = -150 + this.easeOut(p) * 150;
                this.camera.zoom = 0.85 + this.easeOut(p) * 0.15;
                this.vignette = 0;
                break;
                
            case 'rumble':
                // 开始震动
                const rumbleIntensity = this.easeInOut(p);
                this.camera.shakeX = Math.sin(this.time * 0.05) * rumbleIntensity * 8;
                this.camera.shakeY = Math.cos(this.time * 0.07) * rumbleIntensity * 8;
                this.skier.state = p > 0.5 ? 'alert' : 'sitting';
                this.vignette = p * 0.2;
                break;
                
            case 'avalanche':
                // 雪崩爆发
                const avalancheIntensity = this.easeOut(p);
                this.camera.shakeX = Math.sin(this.time * 0.08) * 15 * avalancheIntensity;
                this.camera.shakeY = Math.cos(this.time * 0.1) * 15 * avalancheIntensity;
                this.avalanche.speed = avalancheIntensity * 18;
                this.avalanche.x += this.avalanche.speed;
                
                // 生成雪崩粒子（优化：限制粒子数量）
                if (Math.random() < 0.3 && this.avalanche.particles.length < 200) {
                    this.avalanche.particles.push({
                        x: this.avalanche.x + Math.random() * 500,
                        y: Math.random() * 900,
                        size: Math.random() * 30 + 10,
                        speedX: Math.random() * 8 + 5,
                        speedY: Math.random() * 4 - 2,
                        opacity: Math.random() * 0.6 + 0.4,
                        rotation: Math.random() * Math.PI * 2
                    });
                }
                
                // 树木倒下
                this.trees.forEach(tree => {
                    if (tree.x < this.avalanche.x + 400 && !tree.fallen) {
                        tree.fallen = true;
                    }
                });
                
                this.skier.state = p > 0.7 ? 'standing' : 'alert';
                this.vignette = 0.3 + p * 0.2;
                break;
                
            case 'chase':
                // 追逐场景（增强紧张感）
                const chaseIntensity = 1 + p * 0.5;
                this.camera.shakeX = Math.sin(this.time * 0.1) * 10 * chaseIntensity;
                this.camera.shakeY = Math.cos(this.time * 0.12) * 10 * chaseIntensity;
                this.avalanche.speed = (18 + p * 5) * chaseIntensity;
                this.avalanche.x += this.avalanche.speed;
                
                // 更新粒子
                this.avalanche.particles.forEach(particle => {
                    particle.x += particle.speedX;
                    particle.y += particle.speedY;
                });
                
                // 移除屏幕外的粒子
                this.avalanche.particles = this.avalanche.particles.filter(p => 
                    p.x < 1700 && p.y > -50 && p.y < 950
                );
                
                // 持续生成粒子（优化：限制数量）
                if (Math.random() < 0.2 && this.avalanche.particles.length < 250) {
                    this.avalanche.particles.push({
                        x: this.avalanche.x + Math.random() * 500,
                        y: Math.random() * 900,
                        size: Math.random() * 25 + 8,
                        speedX: Math.random() * 7 + 4,
                        speedY: Math.random() * 3 - 1.5,
                        opacity: Math.random() * 0.5 + 0.3,
                        rotation: Math.random() * Math.PI * 2
                    });
                }
                
                this.skier.state = 'running';
                this.skier.runCycle += 0.3;
                this.skier.eyeWide = 1;
                this.vignette = 0.5 + p * 0.2;
                break;
                
            case 'title':
                // 标题出现（平滑过渡）
                this.camera.shakeX *= 0.85;
                this.camera.shakeY *= 0.85;
                this.vignette = 0.7 - p * 0.3; // 逐渐减弱暗化
                break;
        }
    }
    
    draw() {
        this.ctx.save();
        
        // 淡入效果
        this.ctx.globalAlpha = this.fadeIn;
        
        // 应用镜头效果
        this.ctx.translate(this.camera.shakeX, this.camera.shakeY);
        this.ctx.translate(800, 450);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-800, -450 + this.camera.y);
        
        // 绘制天空
        this.drawSky();
        
        // 绘制太阳
        this.drawSun();
        
        // 绘制远山
        this.drawMountains();
        
        // 绘制雪地
        this.drawSnowGround();
        
        // 绘制树木
        this.drawTrees();
        
        // 绘制雪崩
        this.drawAvalanche();
        
        // 绘制主角
        this.drawSkier();
        
        // 绘制雪花
        this.drawSnowflakes();
        
        this.ctx.restore();
        
        // 边缘暗化效果（增强紧张感）
        if (this.vignette > 0) {
            this.drawVignette();
        }
        
        // 绘制UI（不受镜头影响）
        this.drawUI();
    }
    
    drawSky() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, 900);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.5, '#B0D4E8');
        gradient.addColorStop(1, '#D0E8F0');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, 1600, 900);
    }
    
    drawSun() {
        const x = 1350;
        const y = 180;
        
        // 光晕
        const glow = this.ctx.createRadialGradient(x, y, 30, x, y, 120);
        glow.addColorStop(0, 'rgba(255, 255, 200, 0.4)');
        glow.addColorStop(1, 'rgba(255, 255, 200, 0)');
        this.ctx.fillStyle = glow;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 120, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 太阳
        const sun = this.ctx.createRadialGradient(x, y, 0, x, y, 50);
        sun.addColorStop(0, '#FFFEF0');
        sun.addColorStop(1, '#FFE87C');
        this.ctx.fillStyle = sun;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 50, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawMountains() {
        this.mountains.forEach(mountain => {
            this.ctx.save();
            
            // 山体
            const gradient = this.ctx.createLinearGradient(
                mountain.x, mountain.y,
                mountain.x, mountain.y + mountain.h
            );
            gradient.addColorStop(0, '#E8F4F8');
            gradient.addColorStop(0.3, '#D0E0E8');
            gradient.addColorStop(1, '#B8D0D8');
            
            this.ctx.fillStyle = gradient;
            this.ctx.beginPath();
            this.ctx.moveTo(mountain.x, mountain.y + mountain.h);
            
            // 绘制山峰
            const peaks = 3;
            for (let i = 0; i <= peaks; i++) {
                const px = mountain.x + (mountain.w / peaks) * i;
                const py = mountain.y + (i % 2 === 0 ? 0 : mountain.h * 0.2);
                this.ctx.lineTo(px, py);
            }
            
            this.ctx.lineTo(mountain.x + mountain.w, mountain.y + mountain.h);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 山体阴影
            this.ctx.fillStyle = 'rgba(160, 180, 200, 0.3)';
            this.ctx.beginPath();
            this.ctx.moveTo(mountain.x + mountain.w * 0.6, mountain.y + mountain.h * 0.3);
            this.ctx.lineTo(mountain.x + mountain.w, mountain.y + mountain.h);
            this.ctx.lineTo(mountain.x + mountain.w * 0.6, mountain.y + mountain.h);
            this.ctx.closePath();
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }
    
    drawSnowGround() {
        // 白色雪地
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 500);
        
        for (let x = 0; x <= 1600; x += 40) {
            const y = 500 + Math.sin(x * 0.008) * 25;
            this.ctx.lineTo(x, y);
        }
        
        this.ctx.lineTo(1600, 900);
        this.ctx.lineTo(0, 900);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 雪地纹理
        this.ctx.fillStyle = 'rgba(230, 240, 250, 0.5)';
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * 1600;
            const y = 500 + Math.random() * 400;
            this.ctx.beginPath();
            this.ctx.arc(x, y, Math.random() * 3 + 1, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    
    drawTrees() {
        this.trees.forEach(tree => {
            this.ctx.save();
            this.ctx.translate(tree.x, tree.y);
            
            if (tree.fallen) {
                this.ctx.rotate(Math.PI / 2);
                this.ctx.globalAlpha = 0.6;
            }
            
            const size = tree.size;
            
            // 树影（增加立体感）
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            this.ctx.beginPath();
            this.ctx.ellipse(size * 0.15, size * 0.45, size * 0.25, size * 0.08, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 树干（渐变效果）
            const trunkGradient = this.ctx.createLinearGradient(-size * 0.1, 0, size * 0.1, 0);
            trunkGradient.addColorStop(0, '#4A3C28');
            trunkGradient.addColorStop(0.5, '#5D4E37');
            trunkGradient.addColorStop(1, '#3A2C18');
            this.ctx.fillStyle = trunkGradient;
            this.ctx.fillRect(-size * 0.1, 0, size * 0.2, size * 0.45);
            
            // 树皮纹理
            this.ctx.strokeStyle = 'rgba(58, 44, 24, 0.4)';
            this.ctx.lineWidth = 1;
            for (let i = 0; i < 5; i++) {
                const y = size * 0.1 * i;
                this.ctx.beginPath();
                this.ctx.moveTo(-size * 0.08, y);
                this.ctx.lineTo(size * 0.08, y + size * 0.02);
                this.ctx.stroke();
            }
            
            // 树冠（五层，更茂密）
            const layers = 5;
            for (let i = 0; i < layers; i++) {
                const layerY = -size * 0.15 * i;
                const layerWidth = size * (0.6 - i * 0.08);
                const layerHeight = size * 0.25;
                
                // 树冠主体（渐变）
                const treeGradient = this.ctx.createLinearGradient(0, layerY - layerHeight, 0, layerY);
                treeGradient.addColorStop(0, '#3A6B2C');
                treeGradient.addColorStop(0.5, '#2D5016');
                treeGradient.addColorStop(1, '#1F3A0F');
                this.ctx.fillStyle = treeGradient;
                this.ctx.beginPath();
                this.ctx.moveTo(-layerWidth * 0.48, layerY);
                this.ctx.lineTo(0, layerY - layerHeight * 0.95);
                this.ctx.lineTo(layerWidth * 0.48, layerY);
                this.ctx.closePath();
                this.ctx.fill();
                
                // 松针细节（左侧）
                this.ctx.strokeStyle = '#2D5016';
                this.ctx.lineWidth = 1.5;
                for (let j = 0; j < 3; j++) {
                    const branchY = layerY - layerHeight * (0.3 + j * 0.25);
                    this.ctx.beginPath();
                    this.ctx.moveTo(-layerWidth * 0.2, branchY);
                    this.ctx.lineTo(-layerWidth * 0.45, branchY - size * 0.05);
                    this.ctx.stroke();
                }
                
                // 松针细节（右侧）
                for (let j = 0; j < 3; j++) {
                    const branchY = layerY - layerHeight * (0.3 + j * 0.25);
                    this.ctx.beginPath();
                    this.ctx.moveTo(layerWidth * 0.2, branchY);
                    this.ctx.lineTo(layerWidth * 0.45, branchY - size * 0.05);
                    this.ctx.stroke();
                }
            }
            
            // 雪覆盖（更自然的形状）
            for (let i = 0; i < layers; i++) {
                const layerY = -size * 0.15 * i;
                const layerWidth = size * (0.6 - i * 0.08);
                const layerHeight = size * 0.25;
                
                // 雪的渐变
                const snowGradient = this.ctx.createLinearGradient(0, layerY - layerHeight, 0, layerY);
                snowGradient.addColorStop(0, '#FFFFFF');
                snowGradient.addColorStop(0.7, '#F0F8FF');
                snowGradient.addColorStop(1, 'rgba(240, 248, 255, 0.5)');
                this.ctx.fillStyle = snowGradient;
                
                this.ctx.beginPath();
                this.ctx.moveTo(-layerWidth * 0.42, layerY);
                // 雪的波浪边缘
                for (let x = -layerWidth * 0.42; x <= 0; x += size * 0.05) {
                    const wave = Math.sin(x * 0.5) * size * 0.02;
                    const progress = (x + layerWidth * 0.42) / (layerWidth * 0.42);
                    const y = layerY - layerHeight * 0.9 * progress + wave;
                    this.ctx.lineTo(x, y);
                }
                for (let x = 0; x <= layerWidth * 0.42; x += size * 0.05) {
                    const wave = Math.sin(x * 0.5) * size * 0.02;
                    const progress = x / (layerWidth * 0.42);
                    const y = layerY - layerHeight * 0.9 * (1 - progress) + wave;
                    this.ctx.lineTo(x, y);
                }
                this.ctx.lineTo(layerWidth * 0.42, layerY);
                this.ctx.closePath();
                this.ctx.fill();
                
                // 雪的高光
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                this.ctx.beginPath();
                this.ctx.ellipse(-layerWidth * 0.15, layerY - layerHeight * 0.6, size * 0.04, size * 0.03, -0.3, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // 树顶星形雪花装饰
            this.ctx.fillStyle = '#FFFFFF';
            const topY = -size * 0.15 * (layers - 1) - size * 0.25;
            this.ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI * 2 / 6) * i;
                const x = Math.cos(angle) * size * 0.06;
                const y = topY + Math.sin(angle) * size * 0.06;
                if (i === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }
            this.ctx.closePath();
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }
    
    drawAvalanche() {
        if (this.avalanche.x < -600) return;
        
        this.ctx.save();
        
        // 雪崩阴影（地面上的阴影）
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.moveTo(this.avalanche.x, 500);
        for (let x = this.avalanche.x; x < this.avalanche.x + 600; x += 40) {
            const wave = Math.sin(x * 0.01 + this.time * 0.01) * 20;
            this.ctx.lineTo(x, 500 + wave);
        }
        this.ctx.lineTo(this.avalanche.x + 600, 900);
        this.ctx.lineTo(this.avalanche.x, 900);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 雪崩底层（深色雪雾）
        const darkGradient = this.ctx.createLinearGradient(
            this.avalanche.x, 0,
            this.avalanche.x + 400, 0
        );
        darkGradient.addColorStop(0, 'rgba(200, 210, 220, 0.8)');
        darkGradient.addColorStop(0.5, 'rgba(220, 230, 240, 0.5)');
        darkGradient.addColorStop(1, 'rgba(230, 240, 250, 0.2)');
        
        this.ctx.fillStyle = darkGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(this.avalanche.x, 900);
        
        for (let y = 900; y >= 0; y -= 30) {
            const wave = Math.sin(y * 0.025 + this.time * 0.008) * 60;
            const turbulence = Math.cos(y * 0.05 + this.time * 0.012) * 25;
            this.ctx.lineTo(this.avalanche.x + wave + turbulence, y);
        }
        
        this.ctx.lineTo(this.avalanche.x + 400, 0);
        this.ctx.lineTo(this.avalanche.x + 400, 900);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 雪崩主体（明亮的雪墙）
        const mainGradient = this.ctx.createLinearGradient(
            this.avalanche.x, 0,
            this.avalanche.x + 500, 0
        );
        mainGradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        mainGradient.addColorStop(0.3, 'rgba(245, 250, 255, 0.9)');
        mainGradient.addColorStop(0.6, 'rgba(235, 245, 255, 0.7)');
        mainGradient.addColorStop(1, 'rgba(220, 235, 250, 0.3)');
        
        this.ctx.fillStyle = mainGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(this.avalanche.x, 900);
        
        for (let y = 900; y >= 0; y -= 25) {
            const wave = Math.sin(y * 0.03 + this.time * 0.015) * 70;
            const foam = Math.sin(y * 0.1 + this.time * 0.02) * 15;
            this.ctx.lineTo(this.avalanche.x + wave + foam, y);
        }
        
        this.ctx.lineTo(this.avalanche.x + 500, 0);
        this.ctx.lineTo(this.avalanche.x + 500, 900);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 雪崩前沿（泡沫效果）
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        for (let y = 0; y < 900; y += 60) {
            const wave = Math.sin(y * 0.03 + this.time * 0.015) * 70;
            const foamSize = 20 + Math.sin(y * 0.1) * 10;
            this.ctx.beginPath();
            this.ctx.arc(this.avalanche.x + wave, y, foamSize, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // 雪崩高光（顶部反光）
        const highlightGradient = this.ctx.createLinearGradient(
            this.avalanche.x, 0,
            this.avalanche.x + 200, 0
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        this.ctx.fillStyle = highlightGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(this.avalanche.x, 0);
        for (let y = 0; y <= 300; y += 30) {
            const wave = Math.sin(y * 0.03 + this.time * 0.015) * 70;
            this.ctx.lineTo(this.avalanche.x + wave, y);
        }
        this.ctx.lineTo(this.avalanche.x + 200, 300);
        this.ctx.lineTo(this.avalanche.x + 200, 0);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 雪崩粒子（多种类型）
        this.avalanche.particles.forEach(p => {
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);
            this.ctx.globalAlpha = p.opacity;
            
            // 大块雪块（不规则形状）
            if (p.size > 20) {
                this.ctx.fillStyle = '#F5F5F5';
                this.ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI * 2 / 6) * i + p.rotation;
                    const radius = p.size * (0.4 + Math.random() * 0.3);
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;
                    if (i === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.closePath();
                this.ctx.fill();
                
                // 雪块阴影
                this.ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
                this.ctx.fillRect(p.size * 0.1, p.size * 0.1, p.size * 0.6, p.size * 0.6);
            } 
            // 中等雪块（圆形）
            else if (p.size > 12) {
                const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
                gradient.addColorStop(0, '#FFFFFF');
                gradient.addColorStop(0.7, '#F0F8FF');
                gradient.addColorStop(1, 'rgba(240, 248, 255, 0.5)');
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            } 
            // 小雪粒（方形）
            else {
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            }
            
            this.ctx.restore();
            
            // 更新旋转
            p.rotation += 0.05;
        });
        
        // 雪雾效果（前景）
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = '#FFFFFF';
        for (let i = 0; i < 30; i++) {
            const x = this.avalanche.x + Math.random() * 600;
            const y = Math.random() * 900;
            const size = Math.random() * 8 + 2;
            this.ctx.beginPath();
            this.ctx.arc(x, y, size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }
    
    drawSkier() {
        this.ctx.save();
        this.ctx.translate(this.skier.x, this.skier.y);
        
        const state = this.skier.state;
        const armSwing = state === 'running' ? Math.sin(this.skier.runCycle) * 0.3 : 0;
        const legSwing = state === 'running' ? Math.sin(this.skier.runCycle) * 0.2 : 0;
        
        if (state === 'sitting') {
            this.ctx.translate(0, 10);
        } else if (state === 'alert') {
            this.ctx.translate(0, 5);
        } else if (state === 'running') {
            const bounce = Math.sin(this.skier.runCycle) * 3;
            this.ctx.translate(0, bounce);
        }
        
        // 人物阴影
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 35, 20, 6, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 背包
        const backpackGradient = this.ctx.createLinearGradient(-10, -5, -6, 10);
        backpackGradient.addColorStop(0, '#8B4513');
        backpackGradient.addColorStop(0.5, '#A0522D');
        backpackGradient.addColorStop(1, '#6B3410');
        this.ctx.fillStyle = backpackGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(-8, 3, 5, 12, 0.15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 背包带子
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-5, -5);
        this.ctx.quadraticCurveTo(-3, 0, -2, 8);
        this.ctx.stroke();
        
        // 背包扣环
        this.ctx.fillStyle = '#C0C0C0';
        this.ctx.fillRect(-9, 0, 2, 3);
        this.ctx.fillRect(-9, 6, 2, 3);
        
        // 后腿
        this.ctx.save();
        this.ctx.translate(-5, 20);
        this.ctx.rotate(legSwing);
        const backLegGradient = this.ctx.createLinearGradient(0, 0, 0, 15);
        backLegGradient.addColorStop(0, '#2E5F8F');
        backLegGradient.addColorStop(1, '#1E3F5F');
        this.ctx.fillStyle = backLegGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 7, 4, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        
        // 后滑雪板
        this.ctx.fillStyle = '#CC3333';
        this.ctx.fillRect(-28, 28, 32, 5);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(-26, 29.5, 28, 1);
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(-24, 29, 2, 3);
        
        // 后滑雪靴
        const backBootGradient = this.ctx.createLinearGradient(-12, 24, -12, 32);
        backBootGradient.addColorStop(0, '#4A4A4A');
        backBootGradient.addColorStop(1, '#2A2A2A');
        this.ctx.fillStyle = backBootGradient;
        this.ctx.fillRect(-15, 24, 8, 8);
        this.ctx.strokeStyle = '#1A1A1A';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(-15, 24, 8, 8);
        
        // 身体
        const bodyGradient = this.ctx.createLinearGradient(-8, -5, 8, 22);
        bodyGradient.addColorStop(0, '#5BA3E8');
        bodyGradient.addColorStop(0.3, '#4A90E2');
        bodyGradient.addColorStop(0.7, '#3A7BC8');
        bodyGradient.addColorStop(1, '#2E5F8F');
        this.ctx.fillStyle = bodyGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 6, 14, 16, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 拉链
        this.ctx.strokeStyle = '#C0C0C0';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, -5);
        this.ctx.lineTo(0, 18);
        this.ctx.stroke();
        this.ctx.fillStyle = '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(0, -5, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 口袋
        this.ctx.strokeStyle = '#2E5F8F';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(-8, 2, 6, 5);
        
        // 腰带
        this.ctx.fillStyle = '#1A1A1A';
        this.ctx.fillRect(-14, 18, 28, 3);
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(-2, 18, 4, 3);
        
        // 前腿
        this.ctx.save();
        this.ctx.translate(5, 20);
        this.ctx.rotate(-legSwing);
        const frontLegGradient = this.ctx.createLinearGradient(0, 0, 0, 15);
        frontLegGradient.addColorStop(0, '#3A7BC8');
        frontLegGradient.addColorStop(1, '#2E5F8F');
        this.ctx.fillStyle = frontLegGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 7, 4.5, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        
        // 前滑雪板
        this.ctx.fillStyle = '#FF4757';
        this.ctx.fillRect(8, 28, 32, 5);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(10, 29.5, 28, 1);
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillRect(36, 29, 2, 3);
        
        // 前滑雪靴
        const frontBootGradient = this.ctx.createLinearGradient(12, 24, 12, 32);
        frontBootGradient.addColorStop(0, '#5A5A5A');
        frontBootGradient.addColorStop(1, '#3A3A3A');
        this.ctx.fillStyle = frontBootGradient;
        this.ctx.fillRect(8, 24, 8, 8);
        this.ctx.strokeStyle = '#2A2A2A';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(8, 24, 8, 8);
        this.ctx.fillStyle = '#C0C0C0';
        this.ctx.fillRect(8, 26, 8, 1.5);
        this.ctx.fillRect(8, 29, 8, 1.5);
        
        // 后手臂
        this.ctx.save();
        this.ctx.translate(-14, 8);
        this.ctx.rotate(-armSwing - 0.3);
        const backArmGradient = this.ctx.createLinearGradient(0, 0, 0, 11);
        backArmGradient.addColorStop(0, '#3A7BC8');
        backArmGradient.addColorStop(1, '#2E5F8F');
        this.ctx.fillStyle = backArmGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 5, 5, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        
        // 后滑雪杖
        if (state === 'running') {
            this.ctx.strokeStyle = '#8B8B8B';
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.moveTo(-18 + armSwing * 10, 12 - armSwing * 5);
            this.ctx.lineTo(-22 + armSwing * 10, 30 - armSwing * 5);
            this.ctx.stroke();
            this.ctx.fillStyle = '#4A4A4A';
            this.ctx.beginPath();
            this.ctx.arc(-22 + armSwing * 10, 30 - armSwing * 5, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // 前手臂
        this.ctx.save();
        this.ctx.translate(14, 8);
        this.ctx.rotate(armSwing + 0.3);
        const frontArmGradient = this.ctx.createLinearGradient(0, 0, 0, 11);
        frontArmGradient.addColorStop(0, '#5BA3E8');
        frontArmGradient.addColorStop(1, '#4A90E2');
        this.ctx.fillStyle = frontArmGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(0, 5, 5.5, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        
        // 前滑雪杖
        if (state === 'running') {
            this.ctx.strokeStyle = '#A0A0A0';
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.moveTo(18 - armSwing * 10, 12 + armSwing * 5);
            this.ctx.lineTo(22 - armSwing * 10, 30 + armSwing * 5);
            this.ctx.stroke();
            this.ctx.fillStyle = '#5A5A5A';
            this.ctx.beginPath();
            this.ctx.arc(22 - armSwing * 10, 30 + armSwing * 5, 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        // 手套
        this.ctx.fillStyle = '#FF6B6B';
        this.ctx.beginPath();
        this.ctx.ellipse(-14 - armSwing * 2, 18 - armSwing * 3, 4, 4.5, -0.3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.ellipse(14 + armSwing * 2, 18 + armSwing * 3, 4, 4.5, 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 脖子
        this.ctx.fillStyle = '#FFD4A3';
        this.ctx.fillRect(-3, -8, 6, 5);
        
        // 头盔
        const helmetGradient = this.ctx.createRadialGradient(-3, -16, 2, 0, -14, 12);
        helmetGradient.addColorStop(0, '#FF8888');
        helmetGradient.addColorStop(0.5, '#FF6B6B');
        helmetGradient.addColorStop(1, '#CC5555');
        this.ctx.fillStyle = helmetGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(0, -14, 11, 12, 0, Math.PI, Math.PI * 2);
        this.ctx.fill();
        
        // 头盔边缘
        this.ctx.strokeStyle = '#CC5555';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.ellipse(0, -14, 11, 12, 0, Math.PI, Math.PI * 2);
        this.ctx.stroke();
        
        // 头盔通风口
        this.ctx.strokeStyle = '#AA4444';
        this.ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(-6 + i * 3, -18);
            this.ctx.lineTo(-4 + i * 3, -16);
            this.ctx.stroke();
        }
        
        // 头盔高光
        this.ctx.fillStyle = 'rgba(255, 200, 200, 0.5)';
        this.ctx.beginPath();
        this.ctx.ellipse(-4, -18, 4, 3, -0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 脸
        const faceGradient = this.ctx.createLinearGradient(-8, -10, 8, -10);
        faceGradient.addColorStop(0, '#FFE0B8');
        faceGradient.addColorStop(0.5, '#FFD4A3');
        faceGradient.addColorStop(1, '#FFC890');
        this.ctx.fillStyle = faceGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(0, -10, 10, 10, 0, 0, Math.PI);
        this.ctx.fill();
        
        // 耳朵
        this.ctx.fillStyle = '#FFD4A3';
        this.ctx.beginPath();
        this.ctx.ellipse(-9, -12, 2.5, 3, 0.3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.ellipse(9, -12, 2.5, 3, -0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 护目镜
        this.ctx.strokeStyle = '#2C2C2C';
        this.ctx.lineWidth = 2.5;
        this.ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
        
        const eyeSize = this.skier.eyeWide > 0 ? 5 : 4;
        this.ctx.beginPath();
        this.ctx.ellipse(0, -12, 12, eyeSize, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // 护目镜反光
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.beginPath();
        this.ctx.ellipse(-4, -13, 3, 2, -0.3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 护目镜带
        this.ctx.strokeStyle = '#1A1A1A';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-12, -12);
        this.ctx.quadraticCurveTo(-14, -14, -10, -16);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(12, -12);
        this.ctx.quadraticCurveTo(14, -14, 10, -16);
        this.ctx.stroke();
        
        // 表情
        if (this.skier.eyeWide > 0) {
            this.ctx.fillStyle = '#2C2C2C';
            this.ctx.beginPath();
            this.ctx.arc(-4, -12, 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(4, -12, 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.ellipse(0, -6, 3, 4, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 汗滴
            this.ctx.fillStyle = 'rgba(100, 200, 255, 0.6)';
            this.ctx.beginPath();
            this.ctx.ellipse(7, -8, 1.5, 2, 0.3, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            // 鼻子
            this.ctx.fillStyle = '#FFB080';
            this.ctx.beginPath();
            this.ctx.ellipse(0, -8, 1.5, 2, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 微笑
            this.ctx.strokeStyle = '#CC8866';
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.arc(0, -7, 3, 0.2, Math.PI - 0.2);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    drawSnowflakes() {
        this.ctx.fillStyle = '#FFFFFF';
        this.snowflakes.forEach(flake => {
            // 景深效果：远处的雪花更小更透明
            const depthAlpha = 0.3 + flake.depth * 0.5;
            const depthSize = flake.size * (0.5 + flake.depth * 0.5);
            this.ctx.globalAlpha = depthAlpha * this.fadeIn;
            this.ctx.beginPath();
            this.ctx.arc(flake.x, flake.y, depthSize, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }
    
    drawVignette() {
        // 边缘暗化效果
        const gradient = this.ctx.createRadialGradient(800, 450, 200, 800, 450, 900);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, `rgba(0, 0, 0, ${this.vignette})`);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, 1600, 900);
    }
    
    drawUI() {
        const phase = this.getCurrentPhase();
        
        // 标题（仅在title阶段显示）
        if (phase.name === 'title') {
            const alpha = this.easeInOut(phase.progress);
            const scale = 0.8 + this.easeOut(phase.progress) * 0.2;
            
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.translate(800, 440);
            this.ctx.scale(scale, scale);
            this.ctx.translate(-800, -440);
            
            // 背景暗化
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, 1600, 900);
            
            // 游戏标题（添加发光效果）
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            this.ctx.shadowBlur = 20;
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.strokeStyle = '#2C2C2C';
            this.ctx.lineWidth = 6;
            this.ctx.font = 'bold 80px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.strokeText('滑雪大冒险', 800, 400);
            this.ctx.fillText('滑雪大冒险', 800, 400);
            
            // 副标题
            this.ctx.shadowBlur = 10;
            this.ctx.font = 'bold 36px Arial';
            this.ctx.strokeText('一场惊心动魄的冒险即将开始', 800, 480);
            this.ctx.fillText('一场惊心动魄的冒险即将开始', 800, 480);
            
            this.ctx.shadowBlur = 0;
            
            this.ctx.restore();
        }
        
        // 跳过提示（闪烁效果）
        const blinkAlpha = 0.5 + Math.sin(this.time * 0.005) * 0.3;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${blinkAlpha})`;
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('点击或按任意键跳过 ⏭', 1550, 870);
        
        // 进度条
        const progress = this.time / this.duration;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(50, 850, 1500, 4);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(50, 850, 1500 * progress, 4);
    }
    
    finish() {
        this.isRunning = false;
        
        // 移除事件监听器，防止影响游戏
        if (this.skipHandler) {
            this.canvas.removeEventListener('keydown', this.skipHandler);
        }
        if (this.clickHandler) {
            this.canvas.removeEventListener('click', this.clickHandler);
        }
        
        // 淡出效果
        const introElement = document.getElementById('intro-animation');
        introElement.style.transition = 'opacity 0.5s';
        introElement.style.opacity = '0';
        
        setTimeout(() => {
            introElement.classList.add('hidden');
            introElement.style.opacity = '1';
            document.getElementById('start-screen').classList.remove('hidden');
        }, 500);
    }
}

// 页面加载后自动播放
window.addEventListener('load', () => {
    new CinematicIntro();
});
