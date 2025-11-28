// Game Configuration
const CONFIG = {
    canvas: {
        width: 1920,
        height: 1080
    },
    gravity: 0.6,
    baseSpeed: 8,
    maxSpeed: 20,
    jumpForce: -35,  // 极大跳跃力度，确保能轻松跳过小屋（216像素高）
    flipRotationSpeed: 0.15,
    flipSpeedBoost: 0.2,
    collisionSpeedLoss: 0.4,
    maxCollisions: 10,
    animalSpeedBoost: 1.2,
    animalDuration: 3000,
    obstacleSpawnInterval: 3000,
    // 性能优化配置
    targetFPS: 60,
    enableOptimization: true,
    // 渲染优化
    useLayering: true, // 使用分层渲染
    reducedParticles: true, // 减少粒子数量以提升性能
    smoothRendering: true, // 平滑渲染模式
    maxSnowflakes: 2500, // 最大雪花数量（暴风雪效果）
    maxNearSnow: 150, // 近景雪花数量（暴风雪效果）
    simplifiedTrees: true, // 简化树木绘制
    useOffscreenCache: true // 使用离屏缓存
};

// Game State
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        // 启用硬件加速和性能优化
        this.ctx = this.canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
            willReadFrequently: false,
            // 额外的性能优化选项
            powerPreference: 'high-performance'
        });
        this.canvas.width = CONFIG.canvas.width;
        this.canvas.height = CONFIG.canvas.height;
        
        // 性能优化：启用图像平滑和抗锯齿
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // 离屏Canvas用于背景缓存（提升性能）
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = CONFIG.canvas.width;
        this.offscreenCanvas.height = CONFIG.canvas.height;
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: false });
        
        // FPS控制和平滑
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / CONFIG.targetFPS;
        this.deltaAccumulator = 0;
        this.fixedTimeStep = 1000 / 60; // 固定时间步长
        
        this.isRunning = false;
        this.isPaused = false;
        this.distance = 0;
        this.speed = CONFIG.baseSpeed;
        this.collisions = 0;
        this.maxSpeed = 0;
        this.isSpacePressed = false; // 空格键状态
        this.hasJumped = false; // 跳跃状态追踪
        this.wasGrounded = true; // 上一帧是否在地面（用于检测落地瞬间）
        this.flipTime = 0;
        this.comboMultiplier = 1;
        
        this.terrain = new Terrain();
        // 将人物放在合适位置，让摄像机能正常工作
        // 获取初始位置的地形高度，将人物放在地面上
        const initialGroundY = this.terrain.getHeightAt(300);
        this.panda = new Panda(300, initialGroundY - 30); // 放在地面上（减去人物高度）
        this.obstacles = [];
        this.animals = [];
        this.particles = [];
        this.avalanche = null;
        
        this.lastObstacleSpawn = 0;
        this.lastAnimalSpawn = 0;
        
        // 摄像机偏移量，用于跟随熊猫
        this.cameraOffsetX = 0;
        this.cameraOffsetY = 0;
        
        // 天空飘雪系统
        this.fallingSnow = [];
        this.initFallingSnow();
        
        // 雪松树系统
        this.trees = [];
        this.initTrees();
        
        
        // 性能监控
        this.frameCount = 0;
        this.fps = 60;
        this.lastFpsUpdate = Date.now();
        this.renderTime = 0;
        this.updateTime = 0;
        
        // 渲染优化标志
        this.needsFullRedraw = true;
        this.backgroundDirty = true;
        
        this.setupEventListeners();
        this.setupUI();
    }
    
    initFallingSnow() {
        // 初始化天空飘落的雪花（暴风雪版）
        const snowCount = CONFIG.maxSnowflakes || 2500; // 暴风雪的雪花数量
        for (let i = 0; i < snowCount; i++) {
            this.fallingSnow.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 18 + 2, // 2-20px，各种尺寸的雪花
                speed: Math.random() * 8 + 3, // 3-11px/frame，快速下落
                drift: Math.random() * 2 - 1, // 强烈的左右飘动
                opacity: Math.random() * 0.7 + 0.3, // 0.3-1.0
                rotation: Math.random() * Math.PI * 2, // 旋转角度
                rotationSpeed: Math.random() * 0.02 - 0.01, // 旋转速度
                layer: Math.random() < 0.3 ? 'near' : (Math.random() < 0.5 ? 'mid' : 'far'), // 景深层次
                wobble: Math.random() * Math.PI * 2, // 摆动相位
                wobbleSpeed: Math.random() * 0.03 + 0.01 // 摆动速度
            });
        }
    }
    
    initTrees() {
        // 初始化雪松树 - 生成在滑雪路径上作为背景装饰（无碰撞）
        // 增加树木数量，营造茂密的森林氛围
        for (let i = 0; i < 60; i++) {  // 从30增加到60
            // 在人物前方生成树木（世界坐标）
            const worldX = this.panda.x + i * 250 + Math.random() * 150;  // 间距从400减少到250
            
            // 树木大小（放大3倍）
            const size = (100 + Math.random() * 60) * 3;
            
            // 获取地形在该X位置的高度
            const groundY = this.terrain.getHeightAt(worldX);
            
            // 树木绘制逻辑：
            // - 树干：fillRect(x - size*0.08, y, size*0.16, size*0.6) - 从 y 向下绘制
            // - 树干底部 = y + size*0.6
            // 要让树干底部在地面上：y + size*0.6 = groundY
            // 所以：y = groundY - size*0.6
            const treeY = groundY - size * 0.6;
            
            this.trees.push({
                x: worldX,  // 世界坐标
                y: treeY,
                size: size,
                layer: 'decoration'
            });
        }
        
        // console.log(`=== initTrees完成 ===`);
        // console.log(`树木总数: ${this.trees.length}`);
    }
    
    setupEventListeners() {
        // 键盘事件 - 空格键控制跳跃
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                if (!this.isRunning) return;
                this.isSpacePressed = true;
                // 跳跃逻辑移到update中处理，避免重复触发
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' || e.key === ' ') {
                e.preventDefault();
                if (!this.isRunning) return;
                this.isSpacePressed = false;
                
                if (this.flipTime > 0 && !this.panda.isGrounded) {
                    const boost = Math.min(this.flipTime * CONFIG.flipSpeedBoost, 10);
                    this.speed += boost;
                    this.showCombo(`翻转加速 +${boost.toFixed(1)}!`);
                    // 粒子从角色中心位置产生
                    this.createParticles(this.panda.x + this.panda.width / 2, this.panda.y + this.panda.height / 2, 10, '#FFD700');
                }
                
                this.flipTime = 0;
                this.panda.rotation = 0;
            }
        });
        
        // 触摸事件支持（移动端）
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!this.isRunning) return;
            this.isSpacePressed = true;
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!this.isRunning) return;
            this.isSpacePressed = false;
            
            if (this.flipTime > 0 && !this.panda.isGrounded) {
                const boost = Math.min(this.flipTime * CONFIG.flipSpeedBoost, 10);
                this.speed += boost;
                this.showCombo(`翻转加速 +${boost.toFixed(1)}!`);
                // 粒子从角色中心位置产生
                this.createParticles(this.panda.x + this.panda.width / 2, this.panda.y + this.panda.height / 2, 10, '#FFD700');
            }
            
            this.flipTime = 0;
            this.panda.rotation = 0;
        }, { passive: false });
        
        document.getElementById('start-btn').addEventListener('click', () => {
            this.start();
        });
        
        document.getElementById('restart-btn').addEventListener('click', () => {
            this.restart();
        });
    }
    
    setupUI() {
        this.distanceEl = document.getElementById('distance');
        this.speedEl = document.getElementById('speed');
        this.collisionsEl = document.getElementById('collisions');
        this.comboEl = document.getElementById('combo-display');
        this.fpsEl = document.getElementById('fps');
        
        // 可选：显示FPS监控（开发模式）
        // document.getElementById('fps-stat').style.display = 'flex';
    }
    
    start() {
        console.log('=== 游戏开始 ===');
        document.getElementById('start-screen').classList.add('hidden');
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.lastFpsUpdate = Date.now();
        console.log('初始化完成，启动游戏循环');
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    restart() {
        document.getElementById('game-over-screen').classList.add('hidden');
        this.distance = 0;
        this.speed = CONFIG.baseSpeed;
        this.collisions = 0;
        this.maxSpeed = 0;
        this.hasJumped = false;
        this.wasGrounded = true;
        this.terrain = new Terrain();
        // 将人物放在合适位置，让摄像机能正常工作
        // 获取初始位置的地形高度，将人物放在地面上
        const initialGroundY = this.terrain.getHeightAt(300);
        this.panda = new Panda(300, initialGroundY - 30); // 放在地面上（减去人物高度）
        this.obstacles = [];
        this.animals = [];
        this.particles = [];
        this.avalanche = null;
        this.lastObstacleSpawn = 0;
        this.lastAnimalSpawn = 0;
        this.cameraOffsetX = 0;
        this.cameraOffsetY = 0;
        this.isRunning = true;
        this.gameLoop();
    }
    
    gameLoop(currentTime = 0) {
        if (!currentTime) currentTime = performance.now();
        
        // 调试：每60帧输出一次
        if (!this.loopCounter) this.loopCounter = 0;
        this.loopCounter++;
        if (this.loopCounter % 60 === 0) {
            console.log('游戏循环运行中...', 'isRunning:', this.isRunning, 'distance:', Math.floor(this.distance));
        }
        
        // 计算时间差
        const deltaTime = currentTime - this.lastFrameTime;
        
        // 使用固定时间步长的更新，提供更平滑的物理模拟
        if (CONFIG.smoothRendering) {
            this.deltaAccumulator += deltaTime;
            
            // 固定时间步长更新（保证物理一致性）
            while (this.deltaAccumulator >= this.fixedTimeStep) {
                const updateStart = performance.now();
                this.update();
                this.updateTime = performance.now() - updateStart;
                this.deltaAccumulator -= this.fixedTimeStep;
            }
            
            // 每帧都渲染（保证流畅度）
            const renderStart = performance.now();
            this.render();
            this.renderTime = performance.now() - renderStart;
            
            this.lastFrameTime = currentTime;
        } else {
            // 传统的帧率限制方式
            if (deltaTime >= this.frameInterval) {
                this.lastFrameTime = currentTime - (deltaTime % this.frameInterval);
                this.update();
                this.render();
            }
        }
        
        // 更新FPS计数
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFpsUpdate >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    update() {
        // 如果有雪崩，即使游戏结束也要更新雪崩动画
        if (this.avalanche) {
            this.avalanche.update(this.panda.x, this.panda.y);
        }
        
        // 性能优化：禁用调试日志
        // if (!this.updateCounter) this.updateCounter = 0;
        // this.updateCounter++;
        // if (this.updateCounter % 60 === 0) {
        //     console.log(`游戏运行中 - 距离:${Math.floor(this.distance)}, 速度:${this.speed.toFixed(2)}, 人物X:${Math.floor(this.panda.x)}`);
        // }
        
        if (!this.isRunning) return;
        
        // Update distance and speed
        this.distance += this.speed * 0.1;
        
        // 雪地摩托状态下不限制速度
        if (!this.panda.ridingSnowmobile) {
            // 基础速度增长，严格限制不超过20
            if (this.speed < CONFIG.maxSpeed) {
                this.speed = Math.min(this.speed + 0.002, CONFIG.maxSpeed);
            } else {
                // 超过上限后快速降回上限
                this.speed = Math.min(this.speed - 0.05, CONFIG.maxSpeed);
            }
            // 严格限制速度不超过20
            this.speed = Math.min(this.speed, CONFIG.maxSpeed);
        }
        this.maxSpeed = Math.max(this.maxSpeed, this.speed);
        
        // 检查是否触发雪崩（碰撞超过10次）
        if (this.collisions >= CONFIG.maxCollisions && !this.avalanche) {
            this.triggerAvalanche();
        }
        
        // Update terrain
        this.terrain.update(this.speed);
        
        // 检测落地瞬间 - 从空中到地面的转换
        const justLanded = !this.wasGrounded && this.panda.isGrounded;
        
        // 落地瞬间自动重置跳跃状态，允许连续跳跃
        if (justLanded) {
            this.hasJumped = false;
        }
        
        // Handle jumping - 优化跳跃逻辑，支持连续跳跃和超级跳跃
        // 雪地摩托状态下禁用跳跃
        if (this.isSpacePressed && !this.hasJumped && !this.panda.ridingSnowmobile) {
            // 更宽容的跳跃判断：允许在接近地面时跳跃（提高响应性）
            const groundY = this.terrain.getHeightAt(this.panda.x + this.panda.width / 2);
            const distanceToGround = (this.panda.y + this.panda.height) - groundY;
            const isNearGround = distanceToGround < 5; // 距离地面5像素以内也可以跳跃
            
            if (this.panda.isGrounded || isNearGround) {
                // 普通跳跃
                this.panda.jump();
                // 粒子从脚底位置产生（跳跃起飞）
                this.createParticles(this.panda.x + this.panda.width / 2, this.panda.y + this.panda.height, 5, '#FFFFFF');
                this.hasJumped = true;
            }
        }
        
        // 松开空格键时重置跳跃状态（更积极的重置）
        if (!this.isSpacePressed) {
            this.hasJumped = false;
        }
        
        // 额外的安全重置：如果在地面上且没有按空格键，确保可以跳跃
        if (this.panda.isGrounded && !this.isSpacePressed && this.hasJumped) {
            this.hasJumped = false;
        }
        
        // 更新上一帧的地面状态
        this.wasGrounded = this.panda.isGrounded;
        
        // 摄像机直接锁定人物位置 - 确保人物始终在屏幕正中心
        // X轴：直接计算摄像机偏移，让人物在屏幕水平中心
        this.cameraOffsetX = this.panda.x - CONFIG.canvas.width * 0.5;
        
        // Y轴：直接计算摄像机偏移，让人物在屏幕垂直中心
        this.cameraOffsetY = this.panda.y - CONFIG.canvas.height * 0.5;
        
        // 检查人物是否在小屋屋顶上
        this.panda.onHouseRoof = false;
        this.obstacles.forEach(obs => {
            if (obs.type === 'house' && !obs.hit) {
                const pandaBottom = this.panda.y + this.panda.height;
                const pandaRight = this.panda.x + this.panda.width;
                const houseTop = obs.y;
                const houseLeft = obs.x;
                const houseRight = obs.x + obs.width;
                
                // 检查人物是否站在屋顶上
                const isOverHouse = pandaRight > houseLeft && this.panda.x < houseRight;
                const isOnRoof = Math.abs(pandaBottom - houseTop) < 10;
                
                if (isOverHouse && isOnRoof) {
                    this.panda.onHouseRoof = true;
                    this.panda.houseRoofY = houseTop;
                }
            }
        });
        
        // Update panda (传递摄像机偏移用于痕迹记录)
        this.panda.update(this.terrain, this.isSpacePressed, this.cameraOffsetX);
        
        // 检查白熊状态
        if (this.panda.ridingPolarBear) {
            const elapsed = Date.now() - this.panda.polarBearTimer;
            if (elapsed >= this.panda.polarBearDuration) {
                // 白熊时间到
                this.panda.ridingPolarBear = false;
                this.showCombo('白熊离开了！');
            } else {
                // 白熊自动跳跃障碍物
                this.obstacles.forEach(obs => {
                    const distance = obs.x - this.panda.x;
                    // 当障碍物在前方200像素内时，自动跳跃
                    if (distance > 0 && distance < 200 && !obs.hit && this.panda.isGrounded) {
                        this.panda.jump();
                    }
                });
            }
        }
        
        // 检查雪地摩托状态
        if (this.panda.ridingSnowmobile) {
            const elapsed = Date.now() - this.panda.snowmobileTimer;
            if (elapsed >= this.panda.snowmobileDuration) {
                // 雪地摩托时间到，恢复原速度
                this.panda.ridingSnowmobile = false;
                this.speed = this.panda.speedBeforeSnowmobile || CONFIG.baseSpeed;
                this.showCombo('雪地摩托时间到！恢复正常速度');
            }
        }
        
        // Add ski tracks when panda is on ground
        if (this.panda.isGrounded && Math.random() > 0.7) {
            this.terrain.addSkiTrack(this.panda.x + this.panda.width / 2, this.panda.y + this.panda.height);
        }
        
        // 取消翻转效果 - 空中保持正常姿态
        
        // Spawn obstacles (降低频率)
        if (Date.now() - this.lastObstacleSpawn > CONFIG.obstacleSpawnInterval) {
            this.spawnObstacle();
            this.lastObstacleSpawn = Date.now();
        }
        
        // Spawn animals
        if (Date.now() - this.lastAnimalSpawn > 5000) {
            this.spawnAnimal();
            this.lastAnimalSpawn = Date.now();
        }
        
        // Update obstacles
        this.obstacles = this.obstacles.filter(obs => {
            obs.update(this.speed);
            
            // 石头碰撞检测
            if (obs.type === 'rock' && this.checkCollision(this.panda, obs) && !obs.hit) {
                obs.hit = true;
                
                if (this.panda.ridingSnowmobile) {
                    // 雪地摩托：撞碎石头
                    this.handleSnowmobileSmash(obs);
                    return false; // 移除石头
                } else {
                    // 普通碰撞：撞到石头
                    this.handleObstacleCollision(obs);
                    return false; // 移除石头
                }
            }
            
            // 小屋：既是障碍物又是平台
            if (obs.type === 'house' && !obs.hit) {
                const pandaBottom = this.panda.y + this.panda.height;
                const pandaRight = this.panda.x + this.panda.width;
                const pandaCenterY = this.panda.y + this.panda.height / 2;
                const houseTop = obs.y;
                const houseLeft = obs.x;
                const houseRight = obs.x + obs.width;
                const houseBottom = obs.y + obs.height;
                
                // 检测人物是否在小屋上方（可以安全落在屋顶）
                const isOverHouse = pandaRight > houseLeft && this.panda.x < houseRight;
                const isJumping = this.panda.isJumping; // 使用isJumping标志
                const isInAir = !this.panda.isGrounded;
                
                // 性能优化：禁用调试输出
                
                // 检查碰撞
                if (this.checkCollision(this.panda, obs)) {
                    obs.hit = true;
                    
                    // 雪地摩托：直接撞碎小屋
                    if (this.panda.ridingSnowmobile) {
                        // console.log('🏍️ 雪地摩托撞碎小屋！');
                        this.handleSnowmobileSmash(obs);
                        return false; // 移除小屋
                    }
                    
                    // 非雪地摩托状态：检查是否可以跳跃穿过或落在屋顶
                    if (isOverHouse && (isJumping || isInAir)) {
                        // 检查是否应该落在屋顶
                        if (!isJumping && pandaBottom >= houseTop - 50 && pandaBottom <= houseTop + 30) {
                            // 人物从上方落在小屋屋顶上
                            this.panda.y = houseTop - this.panda.height;
                            this.panda.velocityY = 0;
                            this.panda.isGrounded = true;
                            this.panda.isJumping = false;
                            // console.log('✓ 落在屋顶上！');
                        } else {
                            // console.log('↑ 穿过小屋');
                        }
                        return true; // 保留小屋，不触发碰撞
                    }
                    
                    // 普通碰撞：游戏结束
                    // console.log('✗ 撞上小屋！');
                    this.handleObstacleCollision(obs);
                    return false; // 移除小屋
                }
                
                // 小屋保留
                return true;
            }
            
            return obs.x + obs.width > 0;
        });
        
        // Update animals
        this.animals = this.animals.filter(animal => {
            animal.update(this.speed);
            
            if (this.checkCollision(this.panda, animal) && !animal.caught) {
                animal.caught = true;
                
                // 道具优先级检查：如果已经骑白熊或雪地摩托，忽略普通动物
                if (this.panda.ridingPolarBear || this.panda.ridingSnowmobile) {
                    // 只允许更高级的道具覆盖
                    if (animal.type === 'polarbear' || animal.type === 'snowmobile') {
                        this.handleAnimalCatch(animal);
                    }
                    // 忽略企鹅和雪人
                    return false;
                } else {
                    this.handleAnimalCatch(animal);
                    return false;
                }
            }
            
            return animal.x + animal.width > 0;
        });
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.update();
            return p.life > 0;
        });
        
        // Update falling snow（增强版：旋转和摆动）
        const snowLen = this.fallingSnow.length;
        for (let i = 0; i < snowLen; i++) {
            const snow = this.fallingSnow[i];
            
            // 基础下落
            snow.y += snow.speed;
            
            // 摆动效果（左右飘动）
            snow.wobble += snow.wobbleSpeed;
            const wobbleOffset = Math.sin(snow.wobble) * 1.5;
            snow.x += snow.drift + wobbleOffset;
            
            // 旋转效果
            snow.rotation += snow.rotationSpeed;
            
            // 雪花落到底部后重新从顶部出现
            if (snow.y > this.canvas.height + 10) {
                snow.y = -10;
                snow.x = Math.random() * this.canvas.width;
            }
            
            // 雪花移出屏幕左右后重置
            if (snow.x < -10) snow.x = this.canvas.width + 10;
            else if (snow.x > this.canvas.width + 10) snow.x = -10;
        }
        
        // Update trees - 简化版：直接基于摄像机偏移
        // 移除已经远离屏幕左侧的树木
        this.trees = this.trees.filter(tree => {
            const screenX = tree.x - this.cameraOffsetX;
            return screenX > -tree.size - 500;
        });
        
        // 在前方生成新树木（保持树木数量）
        const treesBeforeGen = this.trees.length;
        while (this.trees.length < 50) {  // 从25增加到50
            // 找到最右侧的树
            let maxWorldX = this.cameraOffsetX + this.canvas.width;
            this.trees.forEach(tree => {
                if (tree.x > maxWorldX) maxWorldX = tree.x;
            });
            
            // 在最右侧树的后方生成新树（间距更小）
            const newWorldX = maxWorldX + 150 + Math.random() * 250;  // 间距从200-600减少到150-400
            const size = (100 + Math.random() * 60) * 3;
            
            // 获取地形高度
            const groundY = this.terrain.getHeightAt(newWorldX);
            // 树干底部对齐地面
            const treeY = groundY - size * 0.6;
            
            this.trees.push({
                x: newWorldX,
                y: treeY,
                size: size,
                layer: 'decoration'
            });
        }
        
        // 性能优化：禁用调试日志
        
        // Update avalanche
        if (this.avalanche) {
            this.avalanche.update(this.panda.x, this.panda.y);
            // 雪崩吞没玩家后不立即结束，等待死亡阶段
            if (this.avalanche.phase === 'death' && this.avalanche.phaseTimer > 180) {
                this.gameOver();
            }
        }
        
        // Update UI
        this.updateUI();
    }
    
    render() {
        // 1. 绘制整个画布为白色（雪地背景）
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 如果有雪崩且游戏结束，只绘制雪崩动画
        if (this.avalanche && !this.isRunning) {
            this.avalanche.draw(this.ctx, this.panda.x, this.panda.y);
            return;
        }
        
        // 2. 应用摄像机偏移，绘制游戏世界
        this.ctx.save();
        this.ctx.translate(-this.cameraOffsetX, -this.cameraOffsetY);
        
        // 2. 绘制地形（包含地形线以下的雪地）
        this.terrain.draw(this.ctx);
        
        // 3. Draw trees (在地形上绘制)
        this.drawTrees('decoration');
        
        // 恢复摄像机
        this.ctx.restore();
        
        // 4. 绘制天空覆盖层（在地形线上方）
        this.drawSkyOverlay();
        
        // 重新应用摄像机偏移，绘制其他物体
        this.ctx.save();
        this.ctx.translate(-this.cameraOffsetX, -this.cameraOffsetY);
        
        // Draw obstacles
        this.obstacles.forEach(obs => obs.draw(this.ctx));
        
        // Draw animals
        this.animals.forEach(animal => animal.draw(this.ctx));
        
        // Draw particles
        this.particles.forEach(p => p.draw(this.ctx));
        
        // Draw motion trail (拖尾特效) - 在人物和轨迹之前绘制
        // this.panda.drawMotionTrail(this.ctx, this.terrain); // 方法不存在，已注释
        
        // Draw trajectory (抛物线轨迹)
        this.panda.drawTrajectory(this.ctx);
        
        // Draw panda
        this.panda.draw(this.ctx);
        
        // 恢复摄像机
        this.ctx.restore();
        
        // Draw snow effect (不受摄像机影响)
        this.drawSnowEffect();
        
        // 绘制雪地摩托倒计时（右上角）
        this.drawSnowmobileTimer();
        
        // Draw avalanche (最后绘制，覆盖整个屏幕)
        if (this.avalanche) {
            this.avalanche.draw(this.ctx, this.panda.x, this.panda.y);
        }
    }
    
    drawSkyWithTerrainClip() {
        // 绘制天空，使用地形线作为裁剪边界（天空只在地形线以上）
        this.ctx.save();
        
        // 应用摄像机偏移
        this.ctx.translate(-this.cameraOffsetX, -this.cameraOffsetY);
        
        const firstPoint = this.terrain.points[0];
        const lastPoint = this.terrain.points[this.terrain.points.length - 1];
        
        // 找到地形最高点和最低点
        let minY = Math.min(...this.terrain.points.map(p => p.y));
        let maxY = Math.max(...this.terrain.points.map(p => p.y));
        
        // 创建裁剪路径：地形线以上的区域
        this.ctx.beginPath();
        
        // 从左上角开始，顺时针绘制
        this.ctx.moveTo(firstPoint.x - 2000, minY - 3000); // 左上角（扩展）
        this.ctx.lineTo(lastPoint.x + 2000, minY - 3000);  // 右上角（扩展）
        this.ctx.lineTo(lastPoint.x + 2000, lastPoint.y);  // 右侧到地形线
        
        // 沿着地形线（从右到左，使用贝塞尔曲线平滑）
        for (let i = this.terrain.points.length - 1; i > 0; i--) {
            const p1 = this.terrain.points[i];
            const p2 = this.terrain.points[i - 1];
            
            const cp1x = p1.x + (p2.x - p1.x) / 3;
            const cp1y = p1.y + (p2.y - p1.y) / 3;
            const cp2x = p1.x + (p2.x - p1.x) * 2 / 3;
            const cp2y = p1.y + (p2.y - p1.y) * 2 / 3;
            
            this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
        
        this.ctx.lineTo(firstPoint.x - 2000, firstPoint.y); // 左侧到地形线
        this.ctx.closePath();
        this.ctx.clip();
        
        // 绘制夜晚天空渐变（从很高的位置开始，确保完全覆盖）
        const skyGradient = this.ctx.createLinearGradient(0, minY - 2000, 0, maxY);
        skyGradient.addColorStop(0, '#3d5a6b');   // 深蓝灰色（顶部）
        skyGradient.addColorStop(0.5, '#4a6a7f'); // 中蓝灰色
        skyGradient.addColorStop(1, '#5a7a8f');   // 底部蓝灰色
        
        this.ctx.fillStyle = skyGradient;
        // 填充一个超大的矩形，确保完全覆盖裁剪区域
        this.ctx.fillRect(firstPoint.x - 3000, minY - 4000, (lastPoint.x - firstPoint.x) + 6000, (maxY - minY) + 5000);
        
        this.ctx.restore();
        
        // 绘制月亮和云朵（不受裁剪影响）
        this.ctx.save();
        this.drawMoon();
        this.drawClouds();
        this.ctx.restore();
    }
    
    drawSkyOverlay() {
        // 保留此函数以防其他地方调用
        this.drawSkyWithTerrainClip();
    }
    
    redrawSkyOverlay() {
        // 保留这个函数以防其他地方调用
        this.drawSkyOverlay();
    }
    
    drawStars() {
        // 绘制闪亮的星星（性能优化版）
        this.ctx.save();
        const stars = [
            // 减少星星数量
            { x: 0.15, y: 0.08, size: 2, brightness: 1 },
            { x: 0.35, y: 0.05, size: 1.8, brightness: 0.9 },
            { x: 0.55, y: 0.18, size: 2.2, brightness: 1 },
            { x: 0.72, y: 0.14, size: 1.4, brightness: 0.75 },
            { x: 0.88, y: 0.16, size: 1.7, brightness: 0.8 },
        ];
        
        stars.forEach(star => {
            const x = this.canvas.width * star.x;
            const y = this.canvas.height * star.y;
            
            // 简化闪烁效果
            const twinkle = 0.8 + Math.sin(Date.now() * 0.003 + star.x * 10) * 0.2;
            const alpha = star.brightness * twinkle;
            
            // 星星主体
            this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(x, y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }
    
    drawMoon() {
        // 绘制明亮的月亮（右上角）
        this.ctx.save();
        const moonX = this.canvas.width * 0.88;
        const moonY = this.canvas.height * 0.12;
        const moonRadius = 45;
        
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
        this.ctx.beginPath();
        this.ctx.arc(moonX + moonRadius * 0.1, moonY + moonRadius * 0.4, moonRadius * 0.12, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawClouds() {
        // 绘制飘动的云朵
        this.ctx.save();
        const time = Date.now() * 0.0001;
        
        const clouds = [
            { x: 0.2, y: 0.15, scale: 1, speed: 1 },
            { x: 0.5, y: 0.25, scale: 0.8, speed: 0.8 },
            { x: 0.75, y: 0.18, scale: 1.2, speed: 1.2 },
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
        
        const size = 40 * scale;
        
        // 云朵由多个圆形组成
        this.ctx.beginPath();
        this.ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        this.ctx.arc(x + size * 0.8, y, size * 0.7, 0, Math.PI * 2);
        this.ctx.arc(x + size * 1.6, y, size * 0.6, 0, Math.PI * 2);
        this.ctx.arc(x + size * 0.4, y - size * 0.4, size * 0.5, 0, Math.PI * 2);
        this.ctx.arc(x + size * 1.2, y - size * 0.3, size * 0.55, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawMountains() {
        // 超远景山脉 - 第一层（最远，巨大雄伟）- 深蓝色调
        const farMountainGradient = this.ctx.createLinearGradient(0, this.canvas.height * 0.03, 0, this.canvas.height * 0.5);
        farMountainGradient.addColorStop(0, 'rgba(30, 60, 90, 0.4)');
        farMountainGradient.addColorStop(0.5, 'rgba(40, 75, 105, 0.5)');
        farMountainGradient.addColorStop(1, 'rgba(50, 90, 120, 0.6)');
        this.ctx.fillStyle = farMountainGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.canvas.width * 2, this.canvas.height * 0.5);
        for (let i = 0; i <= 15; i++) {
            const x = -this.canvas.width * 2 + (i / 15) * this.canvas.width * 5.0;
            const baseY = this.canvas.height * 0.03;
            const wave1 = Math.sin(i * 0.4 - this.distance * 0.0001) * 150;
            const wave2 = Math.sin(i * 0.8 - this.distance * 0.00015) * 80;
            const y = baseY + wave1 + wave2;
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(this.canvas.width * 3, this.canvas.height);
        this.ctx.lineTo(-this.canvas.width * 2, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 超远景雪顶（明亮）- 保持白色
        const snowCapGradient = this.ctx.createLinearGradient(0, this.canvas.height * 0.03, 0, this.canvas.height * 0.2);
        snowCapGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        snowCapGradient.addColorStop(0.5, 'rgba(245, 250, 255, 0.8)');
        snowCapGradient.addColorStop(1, 'rgba(230, 240, 250, 0.5)'); 
        this.ctx.fillStyle = snowCapGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.canvas.width * 2, this.canvas.height * 0.5);
        for (let i = 0; i <= 15; i++) {
            const x = -this.canvas.width * 2 + (i / 15) * this.canvas.width * 5.0;
            const baseY = this.canvas.height * 0.03;
            const wave1 = Math.sin(i * 0.4 - this.distance * 0.0001) * 150;
            const wave2 = Math.sin(i * 0.8 - this.distance * 0.00015) * 80;
            const y = baseY + wave1 + wave2;
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(this.canvas.width * 3, this.canvas.height * 0.15);
        this.ctx.lineTo(-this.canvas.width * 2, this.canvas.height * 0.15);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 远景山脉 - 第二层（带阴影）- 深蓝色调
        const midFarGradient = this.ctx.createLinearGradient(0, this.canvas.height * 0.12, 0, this.canvas.height * 0.5);
        midFarGradient.addColorStop(0, 'rgba(35, 65, 95, 0.5)');
        midFarGradient.addColorStop(0.5, 'rgba(45, 80, 110, 0.6)');
        midFarGradient.addColorStop(1, 'rgba(55, 95, 125, 0.65)'); 
        this.ctx.fillStyle = midFarGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.canvas.width * 2, this.canvas.height * 0.5);
        for (let i = 0; i <= 12; i++) {
            const x = -this.canvas.width * 2 + (i / 12) * this.canvas.width * 5.0;
            const baseY = this.canvas.height * 0.12;
            const wave1 = Math.sin(i * 0.5 - this.distance * 0.0002) * 130;
            const wave2 = Math.cos(i * 0.9 - this.distance * 0.00025) * 60;
            const y = baseY + wave1 + wave2;
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(this.canvas.width * 3, this.canvas.height);
        this.ctx.lineTo(-this.canvas.width * 2, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 远景雪顶（更亮）- 增强版
        const midSnowGradient = this.ctx.createLinearGradient(0, this.canvas.height * 0.12, 0, this.canvas.height * 0.28);
        midSnowGradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        midSnowGradient.addColorStop(0.4, 'rgba(252, 254, 255, 0.9)');
        midSnowGradient.addColorStop(1, 'rgba(245, 248, 255, 0.65)');
        this.ctx.fillStyle = midSnowGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.canvas.width * 2, this.canvas.height * 0.5);
        for (let i = 0; i <= 12; i++) {
            const x = -this.canvas.width * 2 + (i / 12) * this.canvas.width * 5.0;
            const baseY = this.canvas.height * 0.12;
            const wave1 = Math.sin(i * 0.5 - this.distance * 0.0002) * 130;
            const wave2 = Math.cos(i * 0.9 - this.distance * 0.00025) * 60;
            const y = baseY + wave1 + wave2;
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(this.canvas.width * 3, this.canvas.height * 0.28);
        this.ctx.lineTo(-this.canvas.width * 2, this.canvas.height * 0.28);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 中景山脉 - 第三层（更立体，带渐变）- 深蓝色调
        const midGradient = this.ctx.createLinearGradient(0, this.canvas.height * 0.25, 0, this.canvas.height * 0.6);
        midGradient.addColorStop(0, 'rgba(40, 70, 100, 0.55)');
        midGradient.addColorStop(1, 'rgba(50, 85, 115, 0.65)'); 
        this.ctx.fillStyle = midGradient;
        this.ctx.beginPath();
        this.ctx.moveTo(-this.canvas.width, this.canvas.height * 0.55);
        for (let i = 0; i <= 10; i++) {
            const x = -this.canvas.width + (i / 10) * this.canvas.width * 3;
            const y = this.canvas.height * 0.25 + Math.sin(i * 0.9 - this.distance * 0.0004) * 100;
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(this.canvas.width * 2, this.canvas.height);
        this.ctx.lineTo(-this.canvas.width, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 中景雪顶（非常亮）
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.beginPath();
        this.ctx.moveTo(-this.canvas.width, this.canvas.height * 0.55);
        for (let i = 0; i <= 10; i++) {
            const x = -this.canvas.width + (i / 10) * this.canvas.width * 3;
            const y = this.canvas.height * 0.25 + Math.sin(i * 0.9 - this.distance * 0.0004) * 100;
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(this.canvas.width * 2, this.canvas.height * 0.35);
        this.ctx.lineTo(-this.canvas.width, this.canvas.height * 0.35);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 近景山脉 - 第三层（两侧）- 深蓝色调
        this.ctx.fillStyle = 'rgba(45, 75, 105, 0.7)';
        
        // 左侧山脉
        this.ctx.beginPath();
        this.ctx.moveTo(-this.canvas.width, this.canvas.height * 0.5);
        this.ctx.lineTo(-this.canvas.width * 0.3, this.canvas.height * 0.4);
        this.ctx.lineTo(-this.canvas.width * 0.3, this.canvas.height);
        this.ctx.lineTo(-this.canvas.width, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // 右侧山脉
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width * 2, this.canvas.height * 0.5);
        this.ctx.lineTo(this.canvas.width * 1.3, this.canvas.height * 0.4);
        this.ctx.lineTo(this.canvas.width * 1.3, this.canvas.height);
        this.ctx.lineTo(this.canvas.width * 2, this.canvas.height);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    
    drawTrees(layer) {
        this.ctx.save();
        
        let drawnCount = 0;
        let totalCount = 0;
        let outOfViewCount = 0;
        
        this.trees.forEach(tree => {
            if (tree.layer !== layer) return;
            totalCount++;
            
            // 装饰树木：提高透明度，更明显
            this.ctx.globalAlpha = 0.9;
            
            // 树木使用世界坐标，绘制时摄像机偏移会自动转换为屏幕坐标
            const x = tree.x;
            const y = tree.y;
            const size = tree.size;
            
            // 视野检测：转换为屏幕坐标
            const screenX = x - this.cameraOffsetX;
            if (screenX + size < -200 || screenX > this.canvas.width + 200) {
                outOfViewCount++;
                return;
            }
            
            drawnCount++;
            
            // 树影（增加立体感）
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            this.ctx.beginPath();
            this.ctx.ellipse(x + size * 0.15, y + size * 0.65, size * 0.25, size * 0.08, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 树干（渐变效果）
            const trunkGradient = this.ctx.createLinearGradient(x - size * 0.08, y, x + size * 0.08, y);
            trunkGradient.addColorStop(0, '#4A3C28');
            trunkGradient.addColorStop(0.5, '#5D4E37');
            trunkGradient.addColorStop(1, '#3A2C18');
            this.ctx.fillStyle = trunkGradient;
            this.ctx.fillRect(x - size * 0.08, y, size * 0.16, size * 0.6);
            
            // 树皮纹理
            this.ctx.strokeStyle = 'rgba(58, 44, 24, 0.4)';
            this.ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                const ty = y + size * 0.15 * i;
                this.ctx.beginPath();
                this.ctx.moveTo(x - size * 0.06, ty);
                this.ctx.lineTo(x + size * 0.06, ty + size * 0.02);
                this.ctx.stroke();
            }
            
            // 树冠（三层，更茂密）
            const layers = 3;
            for (let i = 0; i < layers; i++) {
                const layerY = y - size * 0.15 * i;
                const layerWidth = size * (0.5 - i * 0.08);
                const layerHeight = size * 0.25;
                
                // 树冠主体（渐变）
                const treeGradient = this.ctx.createLinearGradient(x, layerY - layerHeight, x, layerY);
                treeGradient.addColorStop(0, '#3A6B2C');
                treeGradient.addColorStop(0.5, '#2D5016');
                treeGradient.addColorStop(1, '#1F3A0F');
                this.ctx.fillStyle = treeGradient;
                this.ctx.beginPath();
                this.ctx.moveTo(x - layerWidth * 0.48, layerY);
                this.ctx.lineTo(x, layerY - layerHeight * 0.95);
                this.ctx.lineTo(x + layerWidth * 0.48, layerY);
                this.ctx.closePath();
                this.ctx.fill();
            }
            
            // 雪覆盖（波浪形）
            for (let i = 0; i < layers; i++) {
                const layerY = y - size * 0.15 * i;
                const layerWidth = size * (0.5 - i * 0.08);
                const layerHeight = size * 0.25;
                
                // 雪的渐变
                const snowGradient = this.ctx.createLinearGradient(x, layerY - layerHeight, x, layerY);
                snowGradient.addColorStop(0, '#FFFFFF');
                snowGradient.addColorStop(0.7, '#F0F8FF');
                snowGradient.addColorStop(1, 'rgba(240, 248, 255, 0.5)');
                this.ctx.fillStyle = snowGradient;
                
                this.ctx.beginPath();
                this.ctx.moveTo(x - layerWidth * 0.42, layerY);
                // 雪的波浪边缘（简化版）
                for (let sx = -layerWidth * 0.42; sx <= 0; sx += size * 0.08) {
                    const wave = Math.sin(sx * 0.5) * size * 0.02;
                    const progress = (sx + layerWidth * 0.42) / (layerWidth * 0.42);
                    const sy = layerY - layerHeight * 0.9 * progress + wave;
                    this.ctx.lineTo(x + sx, sy);
                }
                for (let sx = 0; sx <= layerWidth * 0.42; sx += size * 0.08) {
                    const wave = Math.sin(sx * 0.5) * size * 0.02;
                    const progress = sx / (layerWidth * 0.42);
                    const sy = layerY - layerHeight * 0.9 * (1 - progress) + wave;
                    this.ctx.lineTo(x + sx, sy);
                }
                this.ctx.lineTo(x + layerWidth * 0.42, layerY);
                this.ctx.closePath();
                this.ctx.fill();
            }
        });
        
        // 性能优化：禁用统计日志
        
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }
    
    drawSnowEffect() {
        // 在屏幕坐标系中绘制雪花（从顶部落到底部）
        this.ctx.save();
        
        // 按景深层次绘制（从远到近）
        ['far', 'mid', 'near'].forEach(layer => {
            this.fallingSnow.forEach(snow => {
                if (snow.layer !== layer) return;
                
                // 根据层次调整透明度和大小
                let layerOpacity = snow.opacity;
                let layerSize = snow.size;
                if (layer === 'far') {
                    layerOpacity *= 0.4;
                    layerSize *= 0.6;
                } else if (layer === 'mid') {
                    layerOpacity *= 0.7;
                    layerSize *= 0.8;
                }
                
                this.ctx.save();
                this.ctx.globalAlpha = layerOpacity;
                this.ctx.translate(snow.x, snow.y);
                this.ctx.rotate(snow.rotation);
                
                // 大雪纷飞效果：雪花带高光和阴影
                // 雪花阴影（模糊效果）
                this.ctx.fillStyle = 'rgba(200, 220, 255, 0.3)';
                this.ctx.beginPath();
                this.ctx.arc(layerSize * 0.2, layerSize * 0.2, layerSize * 1.2, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 雪花主体
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, layerSize, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 雪花高光
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.beginPath();
                this.ctx.arc(-layerSize * 0.3, -layerSize * 0.3, layerSize * 0.4, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.restore();
            });
        });
        
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }
    
    drawSnowmobileTimer() {
        // 显示白熊或雪地摩托的倒计时
        if (!this.panda.ridingSnowmobile && !this.panda.ridingPolarBear) return;
        
        // 根据道具类型获取计时器和持续时间
        const isPolarBear = this.panda.ridingPolarBear;
        const elapsed = isPolarBear ? 
            Date.now() - this.panda.polarBearTimer : 
            Date.now() - this.panda.snowmobileTimer;
        const duration = isPolarBear ? 
            this.panda.polarBearDuration : 
            this.panda.snowmobileDuration;
        const remaining = Math.max(0, duration - elapsed);
        const seconds = Math.ceil(remaining / 1000);
        
        this.ctx.save();
        
        // 警示牌位置（右上角）
        const panelX = this.canvas.width - 180;
        const panelY = 20;
        const panelWidth = 160;
        const panelHeight = 80;
        
        // 警示牌背景（白熊用蓝色，摩托用红色）
        const bgGradient = this.ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
        if (isPolarBear) {
            bgGradient.addColorStop(0, 'rgba(100, 200, 255, 0.95)');
            bgGradient.addColorStop(1, 'rgba(50, 150, 255, 0.95)');
        } else {
            bgGradient.addColorStop(0, 'rgba(255, 50, 50, 0.95)');
            bgGradient.addColorStop(1, 'rgba(200, 0, 0, 0.95)');
        }
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // 警示牌边框（闪烁）
        const flashAlpha = Math.sin(Date.now() / 200) * 0.3 + 0.7;
        this.ctx.strokeStyle = isPolarBear ? 
            `rgba(255, 255, 255, ${flashAlpha})` : 
            `rgba(255, 255, 0, ${flashAlpha})`;
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // 图标（白熊或摩托）
        this.ctx.font = 'bold 32px Arial';
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(isPolarBear ? '🐻‍❄️' : '🏍️', panelX + panelWidth / 2, panelY + 35);
        
        // 倒计时数字
        this.ctx.font = 'bold 24px Arial';
        this.ctx.fillStyle = seconds <= 5 ? '#FFFF00' : '#FFFFFF'; // 最后5秒变黄色
        this.ctx.fillText(`${seconds}秒`, panelX + panelWidth / 2, panelY + 65);
        
        // 进度条
        const progress = remaining / duration;
        const barX = panelX + 10;
        const barY = panelY + panelHeight - 10;
        const barWidth = panelWidth - 20;
        const barHeight = 6;
        
        // 进度条背景
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // 进度条填充（颜色根据剩余时间变化）
        const barColor = progress > 0.3 ? '#00FF00' : (progress > 0.1 ? '#FFFF00' : '#FF0000');
        this.ctx.fillStyle = barColor;
        this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        
        this.ctx.restore();
    }
    
    // 性能优化：渲染背景到离屏Canvas
    renderBackground() {
        const ctx = this.offscreenCtx;
        
        // 清空离屏Canvas
        ctx.fillStyle = '#1a3a52';
        ctx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        
        // 绘制天空渐变
        const skyGradient = ctx.createLinearGradient(0, 0, 0, this.offscreenCanvas.height);
        skyGradient.addColorStop(0, '#1a3a52');
        skyGradient.addColorStop(1, '#2a4a62');
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    }
    
    spawnObstacle() {
        // 随机生成障碍物（石头或小屋）
        const rand = Math.random();
        let type;
        
        if (rand < 0.6) {
            // 60%概率生成石头
            type = 'rock';
        } else {
            // 40%概率生成小屋
            type = 'house';
        }
        
        // 在人物前方一定距离生成障碍物
        const spawnDistance = 800 + Math.random() * 400; // 800-1200像素前方
        const x = this.panda.x + spawnDistance;
        
        // 获取该位置的地形高度
        const groundY = this.terrain.getHeightAt(x);
        
        // 创建障碍物，放置在地形上
        const obstacle = new Obstacle(x, groundY, type);
        
        // 确保障碍物站在地面上（减去障碍物高度）
        obstacle.y = groundY - obstacle.height;
        
        this.obstacles.push(obstacle);
    }
    
    spawnAnimal() {
        // 随机生成企鹅、雪人、雪地摩托或白熊
        const rand = Math.random();
        let type;
        
        if (rand < 0.05) {
            // 5%概率生成白熊（稀有道具）
            type = 'polarbear';
        } else if (rand < 0.10) {
            // 5%概率生成雪地摩托（稀有道具）
            type = 'snowmobile';
        } else if (rand < 0.55) {
            // 45%概率生成企鹅
            type = 'penguin';
        } else {
            // 45%概率生成雪人
            type = 'snowman';
        }
        
        // 动物/载具生成在人物前方的滑雪路径上
        const spawnX = this.panda.x + 400 + Math.random() * 200;
        const y = this.terrain.getHeightAt(spawnX);
        this.animals.push(new Animal(spawnX, y, type, this.terrain));
    }
    
    checkCollision(obj1, obj2) {
        return obj1.x < obj2.x + obj2.width &&
               obj1.x + obj1.width > obj2.x &&
               obj1.y < obj2.y + obj2.height &&
               obj1.y + obj1.height > obj2.y;
    }
    
    handleTreeCollision(tree) {
        this.collisions++;
        this.speed = Math.max(CONFIG.baseSpeed, this.speed * CONFIG.collisionSpeedLoss);
        
        // 绿色树叶粒子效果
        const treeX = tree.x - tree.offsetX;
        // 粒子从树的中心位置产生（tree对象使用size属性，不是width/height）
        // 树的宽度约为size*0.8，高度约为size*0.85
        this.createParticles(treeX, tree.y + tree.size * 0.2, 20, '#2E7D32');
        this.showCombo(`撞到雪松! 速度下降`);
        
        // 触发熊猫摔倒动画
        this.panda.fall();
        
        // 检查是否触发雪崩
        if (this.collisions >= CONFIG.maxCollisions) {
            this.triggerAvalanche();
        }
    }
    
    handleSnowmobileSmash(obstacle) {
        // 雪地摩托撞碎障碍物 - 不减速，不计碰撞
        const centerX = obstacle.x + obstacle.width / 2;
        const centerY = obstacle.y + obstacle.height / 2;
        
        if (obstacle.type === 'house') {
            // 撞碎小屋：产生大量木头碎片
            this.createParticles(centerX, centerY, 50, '#8B4513'); // 深棕色木头
            this.createParticles(centerX, centerY, 30, '#A0522D'); // 浅棕色木头
            this.createParticles(centerX, centerY, 20, '#D2691E'); // 橙棕色木头
            this.createParticles(centerX, centerY, 15, '#FFFFFF'); // 白色雪花
            this.showCombo(`💥 摩托撞碎小屋！`);
        } else {
            // 撞碎石头：产生灰色碎片
            this.createParticles(centerX, centerY, 40, '#8B4513'); // 棕色粒子
            this.createParticles(centerX, centerY, 20, '#A0A0A0'); // 灰色碎片
            this.showCombo(`💥 摩托撞碎石头！`);
        }
        
        // 不增加碰撞计数，不减速，不摔倒
    }
    
    handleObstacleCollision(obstacle) {
        this.collisions++;
        this.speed = Math.max(CONFIG.baseSpeed, this.speed * CONFIG.collisionSpeedLoss);
        
        const centerX = obstacle.x + obstacle.width / 2;
        const centerY = obstacle.y + obstacle.height / 2;
        
        // 根据障碍物类型产生不同的击碎效果
        if (obstacle.type === 'house') {
            // 撞击小屋：产生大量木头碎片（击碎效果）
            this.createParticles(centerX, centerY, 40, '#8B4513'); // 深棕色木头
            this.createParticles(centerX, centerY, 25, '#A0522D'); // 浅棕色木头
            this.createParticles(centerX, centerY, 15, '#D2691E'); // 橙棕色木头
            this.createParticles(centerX, centerY, 10, '#FFFFFF'); // 白色雪花
            this.showCombo(`💥 撞碎小屋! 速度下降`);
        } else {
            // 撞击石头：产生石头碎片
            this.createParticles(centerX, centerY, 20, '#8B4513'); // 棕色粒子
            this.createParticles(centerX, centerY, 10, '#A0A0A0'); // 灰色碎片
            this.showCombo(`💥 碰撞石头! 速度下降`);
        }
        
        // 触发熊猫摔倒动画
        // this.panda.fall(); // 方法不存在，已注释
        
        if (this.collisions >= CONFIG.maxCollisions) {
            this.triggerAvalanche();
        }
    }
    
    handleAnimalCatch(animal) {
        if (animal.type === 'polarbear') {
            // 清除其他道具状态
            this.panda.ridingSnowmobile = false;
            this.panda.ridingAnimal = null;
            
            // 白熊特殊处理 - 自动跳跃障碍物
            this.panda.ridingPolarBear = true;
            this.panda.polarBearTimer = Date.now();
            this.panda.polarBearDuration = 30000; // 30秒
            
            console.log('🐻‍❄️ 白熊已捕获！ridingPolarBear =', this.panda.ridingPolarBear);
            
            // 如果之前骑雪地摩托，恢复速度
            if (this.panda.speedBeforeSnowmobile) {
                this.speed = this.panda.speedBeforeSnowmobile;
                this.panda.speedBeforeSnowmobile = null;
            }
            
            // 粒子从动物中心位置产生
            this.createParticles(animal.x + animal.width / 2, animal.y + animal.height / 2, 40, '#FFFFFF'); // 白色粒子
            this.showCombo(`🐻‍❄️ 骑上白熊! 自动跳跃30秒!`);
        } else if (animal.type === 'snowmobile') {
            // 清除其他道具状态
            this.panda.ridingPolarBear = false;
            this.panda.ridingAnimal = null;
            
            // 雪地摩托特殊处理
            this.panda.ridingSnowmobile = true;
            this.panda.snowmobileTimer = Date.now();
            this.panda.snowmobileDuration = 30000; // 30秒
            this.panda.speedBeforeSnowmobile = this.speed; // 保存当前速度
            this.speed = 40; // 速度突破到40
            // 粒子从动物中心位置产生
            this.createParticles(animal.x + animal.width / 2, animal.y + animal.height / 2, 30, '#00FFFF'); // 青色粒子
            this.showCombo(`🏍️ 雪地摩托! 速度40! 无敌30秒!`);
        } else {
            // 普通动物处理
            this.panda.ridingAnimal = animal.type;
            this.panda.animalTimer = Date.now();
            this.speed += CONFIG.animalSpeedBoost;
            // 粒子从动物中心位置产生
            this.createParticles(animal.x + animal.width / 2, animal.y + animal.height / 2, 20, '#FFD700');
            
            // 根据动物类型显示不同提示
            let animalName = '';
            if (animal.type === 'penguin') {
                animalName = '企鹅';
            } else if (animal.type === 'snowman') {
                animalName = '雪人';
            }
            this.showCombo(`追上${animalName}! 加速+${CONFIG.animalSpeedBoost}!`);
        }
    }
    
    triggerAvalanche() {
        // 创建雪崩对象
        this.avalanche = new Avalanche(this.panda.x, this.panda.y);
        // 直接跳到掩埋阶段
        this.avalanche.phase = 'buried';
        this.avalanche.phaseTimer = 0;
        
        // 立即结束游戏
        this.gameOver();
        
        console.log('💥 雪崩瞬间吞没！游戏结束，播放掩埋动画');
    }
    
    createParticles(x, y, count, color) {
        // 性能优化：根据配置减少粒子数量
        const actualCount = CONFIG.reducedParticles ? Math.ceil(count * 0.6) : count;
        
        for (let i = 0; i < actualCount; i++) {
            this.particles.push(new Particle(x, y, color));
        }
        
        // 限制粒子总数，避免性能问题
        const maxParticles = CONFIG.reducedParticles ? 200 : 500;
        if (this.particles.length > maxParticles) {
            this.particles = this.particles.slice(-maxParticles);
        }
    }
    
    showCombo(text) {
        this.comboEl.textContent = text;
        this.comboEl.style.opacity = '1';
        this.comboEl.style.animation = 'none';
        setTimeout(() => {
            this.comboEl.style.animation = 'pulse 0.5s ease-in-out';
        }, 10);
        setTimeout(() => {
            this.comboEl.style.opacity = '0';
        }, 1500);
    }
    
    updateUI() {
        this.distanceEl.textContent = Math.floor(this.distance) + 'm';
        this.speedEl.textContent = this.speed.toFixed(1) + ' km/h';
        this.collisionsEl.textContent = `${this.collisions}/${CONFIG.maxCollisions}`;
        
        // 更新FPS显示（如果启用）
        if (this.fpsEl) {
            this.fpsEl.textContent = this.fps;
            // 根据FPS设置颜色
            if (this.fps >= 55) {
                this.fpsEl.style.color = '#2ecc71'; // 绿色 - 流畅
            } else if (this.fps >= 40) {
                this.fpsEl.style.color = '#f39c12'; // 橙色 - 一般
            } else {
                this.fpsEl.style.color = '#e74c3c'; // 红色 - 卡顿
            }
        }
        
        if (this.collisions >= 7) {
            this.collisionsEl.style.color = '#FF0000';
        }
    }
    
    gameOver() {
        this.isRunning = false;
        document.getElementById('final-distance').textContent = Math.floor(this.distance);
        document.getElementById('final-speed').textContent = this.maxSpeed.toFixed(1);
        document.getElementById('final-collisions').textContent = this.collisions;
        document.getElementById('game-over-screen').classList.remove('hidden');
    }
}

// Panda Character
class Panda {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;  // 从50缩小到30（远观视角）
        this.height = 30; // 从50缩小到30（远观视角）
        this.velocityY = 0;
        this.isGrounded = false;
        this.rotation = 0;
        this.slopeAngle = 0; // 当前坡度角度
        this.ridingAnimal = null;
        this.animalTimer = 0;
        this.isFalling = false; // 是否正在摔倒
        this.fallTimer = 0; // 摔倒计时器
        this.fallRotation = 0; // 摔倒旋转角度
        this.fallDuration = 1000; // 摔倒持续时间（毫秒）
        
        // 白熊状态
        this.ridingPolarBear = false;
        this.polarBearTimer = 0;
        this.polarBearDuration = 30000;
        
        // 雪地摩托状态
        this.ridingSnowmobile = false;
        this.snowmobileTimer = 0;
        this.snowmobileDuration = 30000;
        this.speedBeforeSnowmobile = null;
        
        // 抛物线轨迹记录
        this.trajectoryPoints = []; // 存储跳跃轨迹点
        this.maxTrajectoryPoints = 50; // 最多保留50个轨迹点，使抛物线更平滑
        
        // 跳跃姿态
        this.jumpPose = 0; // 跳跃姿态角度（-1到1，表示身体弯曲程度）
        this.maxJumpHeight = 0; // 记录本次跳跃的最高点
        
        // Sin函数抛物线跳跃系统
        this.isJumping = false; // 是否正在执行跳跃
        this.jumpProgress = 0; // 跳跃进度（0到1）
        this.jumpStartY = 0; // 跳跃起始Y坐标
        this.jumpHeight = 400; // 跳跃高度（确保远超过小屋高度216px）
        this.jumpSpeed = 0.035; // 跳跃速度（每帧增加的进度）- 提升流畅度
        this.jumpVisualOffsetX = 0; // 跳跃时的虚拟X偏移（用于轨迹显示）
        this.jumpDistance = 250; // 跳跃虚拟水平距离（与高度相同，形成半圆弧线）
        
        // 着陆缓冲动画
        this.landingSquash = 0; // 着陆压缩效果（0-1）
        this.landingSquashSpeed = 0.15; // 压缩恢复速度
        
        // 滑雪痕迹系统
        this.skiTrail = []; // 存储滑雪痕迹点
        this.maxTrailPoints = 30; // 最多保留30个痕迹点（更长的痕迹）
        this.trailInterval = 0; // 痕迹点生成间隔计数器
        this.trailSpawnRate = 1; // 每1帧生成一个痕迹点（更密集）
    }
    
    jump() {
        // 只在地面上才能跳跃
        if (this.isGrounded && !this.isJumping) {
            this.isJumping = true;
            this.jumpProgress = 0;
            this.jumpStartY = this.y;
            // 不再记录jumpStartX，因为X坐标不再变化
            this.isGrounded = false;
            this.maxJumpHeight = this.y;
            this.trajectoryPoints = []; // 清空轨迹点
        }
    }
    
    update(terrain, isFlipping, cameraOffsetX = 0) {
        // Check if riding animal expired
        if (this.ridingAnimal && Date.now() - this.animalTimer > CONFIG.animalDuration) {
            this.ridingAnimal = null;
        }
        
        // 更新摔倒状态
        if (this.isFalling) {
            this.fallTimer += 16; // 假设60fps，每帧约16ms
            const progress = this.fallTimer / this.fallDuration;
            
            if (progress < 1) {
                // 摔倒动画进行中
                // 旋转360度并减速
                this.fallRotation = Math.PI * 2 * progress;
                // 轻微弹跳效果
                const bounce = Math.sin(progress * Math.PI) * 10;
                this.y -= bounce * 0.1;
            } else {
                // 摔倒动画结束
                this.isFalling = false;
                this.fallTimer = 0;
                this.fallRotation = 0;
            }
        }
        
        // Sin函数抛物线跳跃系统（向上+向前）- 流畅优化版
        if (this.isJumping) {
            // 更新跳跃进度
            this.jumpProgress += this.jumpSpeed;
            
            if (this.jumpProgress >= 1) {
                // 跳跃完成，触发着陆缓冲
                this.jumpProgress = 1;
                this.isJumping = false;
                this.landingSquash = 1.0; // 触发着陆压缩效果
            }
            
            // 使用sin函数计算Y轴位置（标准抛物线，流畅自然）
            const sinValue = Math.sin(Math.PI * this.jumpProgress);
            // 使用轻微的缓动让起跳和落地更自然，但不造成停顿
            const easeValue = sinValue * (0.9 + 0.1 * Math.sin(Math.PI * this.jumpProgress));
            this.y = this.jumpStartY - (easeValue * this.jumpHeight);
            
            // 计算虚拟X偏移（用于轨迹显示，不改变实际X坐标）- 简化为线性
            this.jumpVisualOffsetX = this.jumpProgress * this.jumpDistance;
            
            // 更新最高点
            if (this.y < this.maxJumpHeight) {
                this.maxJumpHeight = this.y;
            }
            
            // 计算跳跃姿态 - 流畅的身体倾斜（简化版）
            // 起跳时向后仰，最高点伸展，落地时向前倾
            const cosValue = Math.cos(Math.PI * this.jumpProgress);
            // 使用平滑的余弦曲线，不分段
            this.jumpPose = -cosValue * 0.8;
            
            // 记录跳跃轨迹点（每2帧记录一次，让轨迹更平滑）
            if (Math.floor(this.jumpProgress * 100) % 2 === 0) {
                this.trajectoryPoints.push({
                    x: this.x + this.width / 2 + this.jumpVisualOffsetX, // 使用虚拟X偏移
                    y: this.y + this.height / 2,
                    alpha: 1.0 // 添加透明度
                });
            }
            
            // 限制轨迹点数量
            if (this.trajectoryPoints.length > this.maxTrajectoryPoints) {
                this.trajectoryPoints.shift();
            }
            
            // 轨迹点淡出效果
            this.trajectoryPoints.forEach((point, index) => {
                point.alpha = index / this.trajectoryPoints.length;
            });
        } else if (!this.isGrounded) {
            // 不在跳跃中但也不在地面上，应用重力
            this.velocityY += CONFIG.gravity;
            this.y += this.velocityY;
            this.jumpVisualOffsetX = 0; // 重置虚拟X偏移
        } else {
            // 着陆时清空轨迹和重置姿态
            if (this.trajectoryPoints.length > 0) {
                this.trajectoryPoints = [];
            }
            this.jumpPose = 0;
            this.jumpVisualOffsetX = 0; // 重置虚拟X偏移
        }
        
        // 更新着陆缓冲动画
        if (this.landingSquash > 0) {
            this.landingSquash -= this.landingSquashSpeed;
            if (this.landingSquash < 0) this.landingSquash = 0;
        }
        
        // Check ground collision - 使用多点采样确保高速下也能贴合地形
        // 如果在屋顶上，使用屋顶高度；否则使用地形高度
        let groundY;
        
        if (this.onHouseRoof && this.houseRoofY) {
            // 在屋顶上，使用屋顶高度
            groundY = this.houseRoofY;
        } else {
            // 在地形上，使用多点采样
            const samplePoints = 5;
            let maxGroundY = -Infinity;
            
            for (let i = 0; i < samplePoints; i++) {
                const sampleX = this.x + (this.width / (samplePoints - 1)) * i;
                const sampleGroundY = terrain.getHeightAt(sampleX);
                maxGroundY = Math.max(maxGroundY, sampleGroundY);
            }
            
            groundY = maxGroundY;
        }
        
        // 计算目标Y坐标
        const targetY = groundY - this.height;
        const yDiff = targetY - this.y;
        
        // 判断是否应该贴合地面（不在跳跃中）
        if (!this.isJumping && this.y + this.height >= groundY - 10) {
            // 完美贴合地面 - 直接设置Y坐标
            // 使用多点采样确保高速下也能紧贴地形
            this.y = targetY;
            
            this.velocityY = 0;
            this.isGrounded = true;
            this.jumpProgress = 0;
            
            // 获取当前位置的坡度角度，让滑板贴近坡面
            const slope = terrain.getSlopeAt(this.x + this.width / 2);
            const targetAngle = Math.atan(slope); // 将斜率转换为弧度
            
            // 快速平滑过渡到目标角度，确保在陡坡上快速适应
            if (!this.slopeAngle) this.slopeAngle = targetAngle;
            
            const angleDiff = targetAngle - this.slopeAngle;
            
            // 使用更快的平滑系数，确保在陡坡上快速适应
            if (Math.abs(angleDiff) < 0.01) {
                // 小差异直接赋值
                this.slopeAngle = targetAngle;
            } else {
                // 使用较快的平滑系数（0.3），确保快速适应坡度变化
                this.slopeAngle += angleDiff * 0.3;
            }
            
            // 不在摔倒中时，使用坡度角度（取消翻转效果）
            if (!this.isFalling) {
                this.rotation = this.slopeAngle;
            } else {
                // 摔倒时使用摔倒旋转
                this.rotation = this.slopeAngle + this.fallRotation;
            }
        } else {
            this.isGrounded = false;
        }
        
        // 更新拖尾特效
        this.updateMotionTrail(cameraOffsetX, terrain);
    }
    
    // 更新运动轨迹
    updateMotionTrail(cameraOffsetX = 0, terrain = null) {
        // 每帧都记录人物位置
        this.trailInterval++;
        
        // 每隔2帧记录一个轨迹点
        if (this.trailInterval >= 2) {
            this.trailInterval = 0;
            
            // 记录人物中心位置
            this.skiTrail.push({
                x: this.x + this.width / 2,
                y: this.y + this.height / 2,
                life: 1.0 // 生命值（1.0到0）
            });
            
            // 限制轨迹点数量
            if (this.skiTrail.length > this.maxTrailPoints) {
                this.skiTrail.shift();
            }
        }
        
        // 更新所有轨迹点的生命值
        this.skiTrail.forEach(point => {
            point.life -= 0.02; // 缓慢消失
        });
        
        // 移除生命值为0的轨迹点
        this.skiTrail = this.skiTrail.filter(point => point.life > 0);
    }
    
    // 绘制抛物线轨迹 - 白色带状效果
    drawTrajectory(ctx) {
        if (this.trajectoryPoints.length < 2) return;
        
        ctx.save();
        
        // 绘制白色带状抛物线
        // 使用路径绘制平滑的曲线
        ctx.beginPath();
        ctx.moveTo(this.trajectoryPoints[0].x, this.trajectoryPoints[0].y);
        
        // 使用二次贝塞尔曲线使轨迹更平滑
        for (let i = 1; i < this.trajectoryPoints.length - 1; i++) {
            const point = this.trajectoryPoints[i];
            const nextPoint = this.trajectoryPoints[i + 1];
            const midX = (point.x + nextPoint.x) / 2;
            const midY = (point.y + nextPoint.y) / 2;
            ctx.quadraticCurveTo(point.x, point.y, midX, midY);
        }
        
        // 最后一个点
        if (this.trajectoryPoints.length > 1) {
            const lastPoint = this.trajectoryPoints[this.trajectoryPoints.length - 1];
            ctx.lineTo(lastPoint.x, lastPoint.y);
        }
        
        // 绘制外层发光效果（较粗、较淡）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 15;
        ctx.stroke();
        
        // 绘制中层（中等粗细）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 8;
        ctx.shadowBlur = 10;
        ctx.stroke();
        
        // 绘制内层核心线（细、亮）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 4;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 5;
        ctx.stroke();
        
        // 绘制轨迹点（白色发光小圆点）
        ctx.shadowBlur = 0;
        for (let i = 0; i < this.trajectoryPoints.length; i += 3) {
            const point = this.trajectoryPoints[i];
            const alpha = point.alpha || (i / this.trajectoryPoints.length);
            const size = 2 + alpha * 2; // 点从小到大
            
            // 外圈发光
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, size + 3, 0, Math.PI * 2);
            ctx.fill();
            
            // 中圈
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, size + 1, 0, Math.PI * 2);
            ctx.fill();
            
            // 内圈实心（亮白色）
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    draw(ctx) {
        ctx.save();
        
        // 如果在地面上，使用坡度角度；如果在空中，使用跳跃姿态角度
        let drawRotation;
        if (this.isGrounded) {
            drawRotation = this.slopeAngle || 0;
        } else {
            // 空中时，根据jumpPose调整身体角度，呈现抛物线姿态
            // 上升时向后仰（负角度），下降时向前倾（正角度）
            const poseAngle = this.jumpPose * 0.4; // 最大倾斜约23度
            drawRotation = (this.slopeAngle || 0) + poseAngle;
        }
        
        // 旋转中心点设置在脚底（滑板位置），确保滑板紧贴坡面
        const rotationCenterX = this.x + this.width / 2;
        const rotationCenterY = this.y + this.height; // 脚底位置
        
        ctx.translate(rotationCenterX, rotationCenterY);
        ctx.rotate(drawRotation);
        
        // 着陆缓冲效果（压缩和拉伸）
        const squashAmount = this.landingSquash * 0.2; // 最大压缩20%
        const scaleX = 1 + squashAmount; // 横向拉伸
        const scaleY = 1 - squashAmount; // 纵向压缩
        ctx.scale(scaleX, scaleY);
        
        // 由于旋转中心在脚底，需要向上偏移绘制所有元素
        ctx.translate(0, -this.height);
        
        // 绘制骑乘的载具/动物（如果有）
        if (this.ridingPolarBear) {
            // 绘制白熊和骑在背上的人类（完整场景，不绘制其他）
            console.log('🎨 正在绘制骑白熊场景');
            this.drawRidingPolarBear(ctx);
        } else if (this.ridingSnowmobile) {
            // 绘制雪地摩托和坐在上面的人物
            this.drawRidingSnowmobile(ctx);
        } else if (this.ridingAnimal) {
            // 绘制3D滑雪板（在熊猫下方）
            this.drawSkis(ctx);
            // 绘制骑乘的动物
            this.drawRidingAnimal(ctx);
            // 绘制熊猫身体
            this.drawPandaBody(ctx, this.jumpPose);
            // 绘制熊猫头部 - 3D效果
            this.drawPandaHead(ctx);
            // 绘制滑雪装备
            this.drawSkiGear(ctx);
        } else {
            // 绘制3D滑雪板（在熊猫下方）
            this.drawSkis(ctx);
            // 正常绘制熊猫身体
            this.drawPandaBody(ctx, this.jumpPose);
            // 绘制熊猫头部 - 3D效果
            this.drawPandaHead(ctx);
            // 绘制滑雪装备
            this.drawSkiGear(ctx);
        }
        
        ctx.restore();
    }
    
    drawSkis(ctx) {
        // 超真实3D滑雪板 - 流线型设计
        ctx.save();
        
        const skiY = this.height - 2;
        
        // === 左滑雪板 ===
        // 深层阴影（立体感）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(-15, skiY + 5, 22, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 滑雪板底部（深色）
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.moveTo(-38, skiY + 6);
        ctx.quadraticCurveTo(-35, skiY + 3, -30, skiY + 2);
        ctx.lineTo(8, skiY + 2);
        ctx.quadraticCurveTo(10, skiY + 3, 10, skiY + 6);
        ctx.lineTo(-38, skiY + 6);
        ctx.closePath();
        ctx.fill();
        
        // 滑雪板主体 - 多层渐变
        const leftSkiGradient = ctx.createLinearGradient(-35, skiY - 2, -35, skiY + 6);
        leftSkiGradient.addColorStop(0, '#FF6B6B');
        leftSkiGradient.addColorStop(0.2, '#FF5252');
        leftSkiGradient.addColorStop(0.5, '#FF3838');
        leftSkiGradient.addColorStop(0.8, '#EE2222');
        leftSkiGradient.addColorStop(1, '#CC1111');
        ctx.fillStyle = leftSkiGradient;
        ctx.beginPath();
        ctx.moveTo(-38, skiY);
        ctx.quadraticCurveTo(-35, skiY - 3, -30, skiY - 4);
        ctx.lineTo(8, skiY - 4);
        ctx.quadraticCurveTo(10, skiY - 3, 10, skiY);
        ctx.lineTo(8, skiY + 2);
        ctx.lineTo(-30, skiY + 2);
        ctx.quadraticCurveTo(-35, skiY + 3, -38, skiY + 6);
        ctx.closePath();
        ctx.fill();
        
        // 滑雪板强烈高光
        const leftHighlightGradient = ctx.createLinearGradient(-35, skiY - 3, -35, skiY + 1);
        leftHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        leftHighlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        leftHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = leftHighlightGradient;
        ctx.fillRect(-35, skiY - 3, 42, 3);
        
        // 滑雪板装饰条纹（金色）
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-32, skiY - 1);
        ctx.lineTo(-12, skiY - 1);
        ctx.stroke();
        
        // 白色条纹
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-28, skiY + 1);
        ctx.lineTo(-16, skiY + 1);
        ctx.stroke();
        
        // 滑雪板边缘（黑色轮廓）
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-38, skiY);
        ctx.quadraticCurveTo(-35, skiY - 3, -30, skiY - 4);
        ctx.lineTo(8, skiY - 4);
        ctx.quadraticCurveTo(10, skiY - 3, 10, skiY);
        ctx.stroke();
        
        // 固定器（绑带）
        const bindingGradient = ctx.createLinearGradient(-8, skiY - 2, -8, skiY + 2);
        bindingGradient.addColorStop(0, '#2A2A2A');
        bindingGradient.addColorStop(0.5, '#1A1A1A');
        bindingGradient.addColorStop(1, '#0A0A0A');
        ctx.fillStyle = bindingGradient;
        ctx.fillRect(-10, skiY - 2, 8, 4);
        
        // 固定器高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(-10, skiY - 2, 8, 1);
        
        // 固定器边框
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(-10, skiY - 2, 8, 4);
        
        // === 右滑雪板 ===
        // 深层阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(35, skiY + 5, 22, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 滑雪板底部
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.moveTo(12, skiY + 6);
        ctx.quadraticCurveTo(15, skiY + 3, 20, skiY + 2);
        ctx.lineTo(58, skiY + 2);
        ctx.quadraticCurveTo(60, skiY + 3, 60, skiY + 6);
        ctx.lineTo(12, skiY + 6);
        ctx.closePath();
        ctx.fill();
        
        // 滑雪板主体
        const rightSkiGradient = ctx.createLinearGradient(15, skiY - 2, 15, skiY + 6);
        rightSkiGradient.addColorStop(0, '#FF6B6B');
        rightSkiGradient.addColorStop(0.2, '#FF5252');
        rightSkiGradient.addColorStop(0.5, '#FF3838');
        rightSkiGradient.addColorStop(0.8, '#EE2222');
        rightSkiGradient.addColorStop(1, '#CC1111');
        ctx.fillStyle = rightSkiGradient;
        ctx.beginPath();
        ctx.moveTo(12, skiY);
        ctx.quadraticCurveTo(15, skiY - 3, 20, skiY - 4);
        ctx.lineTo(58, skiY - 4);
        ctx.quadraticCurveTo(60, skiY - 3, 60, skiY);
        ctx.lineTo(58, skiY + 2);
        ctx.lineTo(20, skiY + 2);
        ctx.quadraticCurveTo(15, skiY + 3, 12, skiY + 6);
        ctx.closePath();
        ctx.fill();
        
        // 滑雪板强烈高光
        const rightHighlightGradient = ctx.createLinearGradient(15, skiY - 3, 15, skiY + 1);
        rightHighlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        rightHighlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
        rightHighlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = rightHighlightGradient;
        ctx.fillRect(15, skiY - 3, 42, 3);
        
        // 装饰条纹（金色）
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(22, skiY - 1);
        ctx.lineTo(42, skiY - 1);
        ctx.stroke();
        
        // 白色条纹
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(26, skiY + 1);
        ctx.lineTo(38, skiY + 1);
        ctx.stroke();
        
        // 滑雪板边缘
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(12, skiY);
        ctx.quadraticCurveTo(15, skiY - 3, 20, skiY - 4);
        ctx.lineTo(58, skiY - 4);
        ctx.quadraticCurveTo(60, skiY - 3, 60, skiY);
        ctx.stroke();
        
        // 固定器
        ctx.fillStyle = bindingGradient;
        ctx.fillRect(32, skiY - 2, 8, 4);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(32, skiY - 2, 8, 1);
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(32, skiY - 2, 8, 4);
        
        ctx.restore();
    }
    
    drawPandaBody(ctx, jumpPose = 0) {
        // 人类身体 - 侧面视角，朝向正前方（右侧）
        // jumpPose: -1(上升) 到 1(下降)，控制手臂和腿部姿态
        ctx.save();
        
        // 计算俯冲姿态（根据坡度）
        const slopeAngleDeg = (this.slopeAngle || 0) * 180 / Math.PI;
        const isSteepSlope = this.isGrounded && slopeAngleDeg > 15; // 坡度大于15度
        const diveAmount = isSteepSlope ? Math.min((slopeAngleDeg - 15) / 15, 1) : 0; // 0-1之间
        
        // 俯冲时身体前倾
        if (isSteepSlope) {
            ctx.translate(0, -diveAmount * 3); // 身体重心前移
            ctx.rotate(diveAmount * 0.15); // 身体额外前倾（约8.6度）
        }
        
        // 身体阴影 - 多层次立体阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(3, 8, 12, 20, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 深层阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(4, 9, 11, 19, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 背包阴影（立体感）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-7.5, 3.5, 5.2, 12.2, 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // 背包（增加真实感）
        const backpackGradient = ctx.createLinearGradient(-10, 0, -6, 10);
        backpackGradient.addColorStop(0, '#2C3E50');
        backpackGradient.addColorStop(0.3, '#34495E');
        backpackGradient.addColorStop(0.7, '#2C3E50');
        backpackGradient.addColorStop(1, '#1A252F');
        ctx.fillStyle = backpackGradient;
        ctx.beginPath();
        ctx.ellipse(-8, 3, 5, 12, 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // 背包高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.ellipse(-9, 0, 2.5, 6, 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        // 背包边缘立体线
        ctx.strokeStyle = '#1A252F';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(-8, 3, 5, 12, 0.15, 0, Math.PI * 2);
        ctx.stroke();
        
        // 背包带子阴影
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-4.8, -4.8);
        ctx.quadraticCurveTo(-2.8, 0.2, -1.8, 8.2);
        ctx.stroke();
        
        // 背包带子
        ctx.strokeStyle = '#34495E';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-5, -5);
        ctx.quadraticCurveTo(-3, 0, -2, 8);
        ctx.stroke();
        
        // 背包带子高光
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-5.3, -4.7);
        ctx.quadraticCurveTo(-3.3, 0.3, -2.3, 8.3);
        ctx.stroke();
        
        // 躯干深层阴影（立体感）
        ctx.fillStyle = 'rgba(46, 95, 143, 0.5)';
        ctx.beginPath();
        ctx.ellipse(-6, 5, 4, 16, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 躯干 - 红色滑雪服主体（侧面椭圆形）- 增强立体渐变
        const bodyGradient = ctx.createLinearGradient(-8, -10, 8, 25);
        bodyGradient.addColorStop(0, '#FF5555');
        bodyGradient.addColorStop(0.15, '#FF4444');
        bodyGradient.addColorStop(0.4, '#EE3333');
        bodyGradient.addColorStop(0.7, '#CC2222');
        bodyGradient.addColorStop(1, '#AA1111');
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.ellipse(0, 5, 10, 18, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 躯干边缘立体线
        ctx.strokeStyle = 'rgba(30, 63, 95, 0.8)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 5, 10, 18, 0.1, 0, Math.PI * 2);
        ctx.stroke();
        
        // 滑雪服拉链细节
        ctx.strokeStyle = '#1E3F5F';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(2, -8);
        ctx.lineTo(2, 15);
        ctx.stroke();
        
        // 拉链头
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(1, -8, 2, 3);
        
        // 滑雪服口袋
        ctx.strokeStyle = '#2E5F8F';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(4, 8, 3, 0.3, Math.PI - 0.3);
        ctx.stroke();
        
        // 滑雪服侧面高光 - 多层次
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(-3, -2, 6, 10, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 强烈高光点
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(-4, -5, 3, 5, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 次级高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.ellipse(-2, 3, 4, 6, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 腰带阴影（立体感）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-8, 18.5, 16, 2.5);
        
        // 腰带细节 - 立体渐变
        const beltGradient = ctx.createLinearGradient(0, 18, 0, 20.5);
        beltGradient.addColorStop(0, '#34495E');
        beltGradient.addColorStop(0.5, '#2C3E50');
        beltGradient.addColorStop(1, '#1A252F');
        ctx.fillStyle = beltGradient;
        ctx.fillRect(-8, 18, 16, 2.5);
        
        // 腰带高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(-7, 18, 14, 0.8);
        
        // 腰带边缘
        ctx.strokeStyle = '#1A252F';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-8, 18, 16, 2.5);
        
        // 腰带扣环
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(-1.5, 18.5, 3, 1.5);
        ctx.strokeStyle = '#808080';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-1.5, 18.5, 3, 1.5);
        
        // 腿部姿态调整：上升时收缩，下降时伸展，俯冲时更加弯曲
        const legOffset = jumpPose * 3 + diveAmount * 4; // 俯冲时额外前移
        const legAngleAdjust = jumpPose * 0.2 + diveAmount * 0.3; // 俯冲时额外角度
        const legBend = diveAmount * 5; // 俯冲时腿部弯曲程度
        
        // 前腿阴影（立体感）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-1.5 + legOffset, 25.5 - Math.abs(jumpPose) * 2, 4.7, 8.2, 0.15 + legAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 前腿（远离观众的腿）- 大腿部分 - 增强立体渐变
        const frontThighGradient = ctx.createLinearGradient(-4, 20, 0, 30);
        frontThighGradient.addColorStop(0, '#357ABD');
        frontThighGradient.addColorStop(0.3, '#2E5F8F');
        frontThighGradient.addColorStop(0.7, '#265078');
        frontThighGradient.addColorStop(1, '#1E3F5F');
        ctx.fillStyle = frontThighGradient;
        ctx.beginPath();
        ctx.ellipse(-2 + legOffset, 25 - Math.abs(jumpPose) * 2, 4.5, 8, 0.15 + legAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 前腿边缘线
        ctx.strokeStyle = 'rgba(30, 63, 95, 0.6)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(-2 + legOffset, 25 - Math.abs(jumpPose) * 2, 4.5, 8, 0.15 + legAngleAdjust, 0, Math.PI * 2);
        ctx.stroke();
        
        // 前腿 - 小腿部分
        const frontCalfGradient = ctx.createLinearGradient(-2, 30, -2, 38);
        frontCalfGradient.addColorStop(0, '#1E3F5F');
        frontCalfGradient.addColorStop(1, '#0F1F2F');
        ctx.fillStyle = frontCalfGradient;
        ctx.beginPath();
        ctx.ellipse(-2 + legOffset, 34 - Math.abs(jumpPose) * 2, 3.5, 7, 0.1 + legAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 前腿膝盖细节
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(-2 + legOffset, 30 - Math.abs(jumpPose) * 2, 2, 0, Math.PI);
        ctx.stroke();
        
        // 后腿阴影（立体感）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(3.5 - legOffset, 25.5 - Math.abs(jumpPose) * 2, 5.7, 9.2, -0.1 - legAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 后腿（靠近观众的腿）- 大腿部分 - 增强立体渐变
        const backThighGradient = ctx.createLinearGradient(0, 20, 6, 30);
        backThighGradient.addColorStop(0, '#5AA3E8');
        backThighGradient.addColorStop(0.2, '#4A90E2');
        backThighGradient.addColorStop(0.5, '#357ABD');
        backThighGradient.addColorStop(0.8, '#2E6BA0');
        backThighGradient.addColorStop(1, '#2E5F8F');
        ctx.fillStyle = backThighGradient;
        ctx.beginPath();
        ctx.ellipse(3 - legOffset, 25 - Math.abs(jumpPose) * 2, 5.5, 9, -0.1 - legAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 后腿边缘线
        ctx.strokeStyle = 'rgba(46, 95, 143, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(3 - legOffset, 25 - Math.abs(jumpPose) * 2, 5.5, 9, -0.1 - legAngleAdjust, 0, Math.PI * 2);
        ctx.stroke();
        
        // 后腿 - 小腿部分
        const backCalfGradient = ctx.createLinearGradient(3, 30, 3, 38);
        backCalfGradient.addColorStop(0, '#2E5F8F');
        backCalfGradient.addColorStop(1, '#1E3F5F');
        ctx.fillStyle = backCalfGradient;
        ctx.beginPath();
        ctx.ellipse(3 - legOffset, 34 - Math.abs(jumpPose) * 2, 4.5, 8, -0.05 - legAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 后腿膝盖高光 - 多层次
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(2 - legOffset, 29 - Math.abs(jumpPose) * 2, 3, 2, -0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 强烈膝盖高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.ellipse(1.5 - legOffset, 28.5 - Math.abs(jumpPose) * 2, 1.5, 1, -0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 滑雪靴 - 前脚
        const frontBootGradient = ctx.createLinearGradient(-2, 38, -2, 42);
        frontBootGradient.addColorStop(0, '#2C3E50');
        frontBootGradient.addColorStop(1, '#1A252F');
        ctx.fillStyle = frontBootGradient;
        ctx.fillRect(-5 + legOffset, 38 - Math.abs(jumpPose) * 2, 7, 5);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(-5 + legOffset, 38 - Math.abs(jumpPose) * 2, 7, 5);
        
        // 滑雪靴 - 后脚
        const backBootGradient = ctx.createLinearGradient(3, 38, 3, 42);
        backBootGradient.addColorStop(0, '#34495E');
        backBootGradient.addColorStop(1, '#2C3E50');
        ctx.fillStyle = backBootGradient;
        ctx.fillRect(0 - legOffset, 38 - Math.abs(jumpPose) * 2, 8, 5);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(0 - legOffset, 38 - Math.abs(jumpPose) * 2, 8, 5);
        
        // 滑雪靴扣环细节
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(1 - legOffset, 39 - Math.abs(jumpPose) * 2, 2, 1.5);
        ctx.fillRect(5 - legOffset, 39 - Math.abs(jumpPose) * 2, 2, 1.5);
        
        // 手臂姿态调整：上升时向后摆，下降时向前伸，俯冲时完全前伸
        const armSwing = jumpPose * 5 + diveAmount * 8; // 俯冲时手臂大幅前伸
        const armAngleAdjust = jumpPose * 0.3 + diveAmount * 0.5; // 俯冲时手臂角度更大
        const armExtend = diveAmount * 6; // 俯冲时手臂伸展距离
        
        // 后臂上臂（远离观众）
        const backUpperArmGradient = ctx.createLinearGradient(5, 0, 10, 8);
        backUpperArmGradient.addColorStop(0, '#2E5F8F');
        backUpperArmGradient.addColorStop(1, '#1E3F5F');
        ctx.fillStyle = backUpperArmGradient;
        ctx.beginPath();
        ctx.ellipse(6 + armSwing * 0.8, 4 - armSwing * 0.2, 3.5, 8, 0.5 + armAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 后臂前臂
        const backForearmGradient = ctx.createLinearGradient(10, 8, 15, 16);
        backForearmGradient.addColorStop(0, '#1E3F5F');
        backForearmGradient.addColorStop(1, '#0F1F2F');
        ctx.fillStyle = backForearmGradient;
        ctx.beginPath();
        ctx.ellipse(10 + armSwing * 1.2, 12 - armSwing * 0.4, 3, 7, 0.6 + armAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 后臂肘部细节
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(8 + armSwing, 10 - armSwing * 0.3, 1.5, 0, Math.PI);
        ctx.stroke();
        
        // 前臂上臂（靠近观众）
        const frontUpperArmGradient = ctx.createLinearGradient(-5, 0, -10, 8);
        frontUpperArmGradient.addColorStop(0, '#4A90E2');
        frontUpperArmGradient.addColorStop(1, '#357ABD');
        ctx.fillStyle = frontUpperArmGradient;
        ctx.beginPath();
        ctx.ellipse(-6 - armSwing * 0.8, 4 + armSwing * 0.2, 4, 9, -0.5 - armAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 前臂前臂
        const frontForearmGradient = ctx.createLinearGradient(-10, 8, -15, 16);
        frontForearmGradient.addColorStop(0, '#357ABD');
        frontForearmGradient.addColorStop(1, '#2E5F8F');
        ctx.fillStyle = frontForearmGradient;
        ctx.beginPath();
        ctx.ellipse(-10 - armSwing * 1.2, 12 + armSwing * 0.4, 3.5, 8, -0.6 - armAngleAdjust, 0, Math.PI * 2);
        ctx.fill();
        
        // 前臂肘部高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.ellipse(-8 - armSwing, 10 + armSwing * 0.3, 2, 3, -0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 手套阴影 - 后手
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(12.3 + armSwing * 1.5, 16.3 - armSwing * 0.5, 4.2, 3.7, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 手套 - 后手（更真实的手型）- 立体渐变
        const backGloveGradient = ctx.createLinearGradient(10 + armSwing * 1.5, 14, 14 + armSwing * 1.5, 18);
        backGloveGradient.addColorStop(0, '#FF6B6B');
        backGloveGradient.addColorStop(0.5, '#FF4757');
        backGloveGradient.addColorStop(1, '#E63946');
        ctx.fillStyle = backGloveGradient;
        ctx.beginPath();
        ctx.ellipse(12 + armSwing * 1.5, 16 - armSwing * 0.5, 4, 3.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 手套边缘 - 后手
        ctx.strokeStyle = '#C23616';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(12 + armSwing * 1.5, 16 - armSwing * 0.5, 4, 3.5, 0.3, 0, Math.PI * 2);
        ctx.stroke();
        
        // 手套手指细节 - 后手
        ctx.fillStyle = '#E63946';
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(11 + armSwing * 1.5 + i * 1.2, 17 - armSwing * 0.5, 1, 2);
        }
        
        // 手套高光 - 后手
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.ellipse(11 + armSwing * 1.5, 15 - armSwing * 0.5, 2, 1.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 手套阴影 - 前手
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(-11.7 - armSwing * 1.5, 16.3 + armSwing * 0.5, 4.7, 4.2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 手套 - 前手（更明显，更真实的手型）- 立体渐变
        const frontGloveGradient = ctx.createLinearGradient(-14 - armSwing * 1.5, 14, -10 - armSwing * 1.5, 18);
        frontGloveGradient.addColorStop(0, '#FF8787');
        frontGloveGradient.addColorStop(0.5, '#FF6B6B');
        frontGloveGradient.addColorStop(1, '#FF4757');
        ctx.fillStyle = frontGloveGradient;
        ctx.beginPath();
        ctx.ellipse(-12 - armSwing * 1.5, 16 + armSwing * 0.5, 4.5, 4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 手套边缘 - 前手
        ctx.strokeStyle = '#E63946';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(-12 - armSwing * 1.5, 16 + armSwing * 0.5, 4.5, 4, -0.3, 0, Math.PI * 2);
        ctx.stroke();
        
        // 手套手指细节 - 前手
        ctx.fillStyle = '#FF4757';
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(-14 - armSwing * 1.5 + i * 1.2, 17 + armSwing * 0.5, 1, 2.5);
        }
        
        // 手套拇指 - 前手
        ctx.beginPath();
        ctx.ellipse(-14 - armSwing * 1.5, 15 + armSwing * 0.5, 1.5, 2.5, -0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 手套高光 - 前手
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(-13 - armSwing * 1.5, 15 + armSwing * 0.5, 2.5, 1.8, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 手套腕部细节
        ctx.strokeStyle = '#C23616';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(-12 - armSwing * 1.5, 14 + armSwing * 0.5, 3, 0.5, Math.PI - 0.5);
        ctx.stroke();
        
        ctx.restore();
    }
    
    drawPandaHead(ctx) {
        // 精美现代滑雪者头部 - 侧面视角
        ctx.save();
        
        // === 头部深层阴影 ===
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(2, -16, 11, 14, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // === 后脑勺（头盔后部）===
        const backHelmetGradient = ctx.createRadialGradient(-6, -20, 2, -5, -18, 12);
        backHelmetGradient.addColorStop(0, '#E63946');
        backHelmetGradient.addColorStop(0.5, '#C23616');
        backHelmetGradient.addColorStop(1, '#8B0000');
        ctx.fillStyle = backHelmetGradient;
        ctx.beginPath();
        ctx.ellipse(-5, -18, 8, 13, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // === 头盔主体 - 流线型设计 ===
        const helmetGradient = ctx.createRadialGradient(1, -24, 3, 0, -18, 14);
        helmetGradient.addColorStop(0, '#FF6B6B');
        helmetGradient.addColorStop(0.3, '#FF4757');
        helmetGradient.addColorStop(0.7, '#E63946');
        helmetGradient.addColorStop(1, '#C23616');
        ctx.fillStyle = helmetGradient;
        ctx.beginPath();
        ctx.ellipse(0, -18, 10, 13, 0.05, 0, Math.PI * 2);
        ctx.fill();
        
        // 头盔强烈高光
        const helmetHighlight = ctx.createRadialGradient(2, -25, 1, 2, -24, 7);
        helmetHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        helmetHighlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        helmetHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = helmetHighlight;
        ctx.beginPath();
        ctx.ellipse(2, -24, 6, 7, 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // 头盔边缘装饰线
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, -18, 10, 13, 0.05, 0, Math.PI * 2);
        ctx.stroke();
        
        // 头盔通风口（现代设计）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.ellipse(4 + i * 2, -23 + i * 2, 1.5, 0.8, 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // === 脖子 ===
        const neckGradient = ctx.createLinearGradient(2, -8, 2, -2);
        neckGradient.addColorStop(0, '#FFD4A3');
        neckGradient.addColorStop(0.5, '#E6B88A');
        neckGradient.addColorStop(1, '#D4A678');
        ctx.fillStyle = neckGradient;
        ctx.fillRect(0, -8, 5, 7);
        
        // 脖子阴影
        ctx.fillStyle = 'rgba(214, 166, 120, 0.3)';
        ctx.fillRect(0, -8, 2, 7);
        
        // === 脸部 - 精致肤色 ===
        const faceGradient = ctx.createRadialGradient(6, -16, 2, 5, -14, 11);
        faceGradient.addColorStop(0, '#FFE4C4');
        faceGradient.addColorStop(0.4, '#FFD4A3');
        faceGradient.addColorStop(0.7, '#FFCB9A');
        faceGradient.addColorStop(1, '#E6B88A');
        ctx.fillStyle = faceGradient;
        ctx.beginPath();
        ctx.ellipse(5, -14, 8, 11, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // 脸部高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(7, -17, 4, 5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // === 耳朵 ===
        const earGradient = ctx.createRadialGradient(9, -17, 1, 9, -16, 4);
        earGradient.addColorStop(0, '#FFD4A3');
        earGradient.addColorStop(1, '#FFCB9A');
        ctx.fillStyle = earGradient;
        ctx.beginPath();
        ctx.ellipse(9, -16, 3.5, 5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 耳朵内部
        ctx.fillStyle = '#E6B88A';
        ctx.beginPath();
        ctx.ellipse(9, -16, 1.8, 2.5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 耳朵边缘
        ctx.strokeStyle = '#D4A678';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(9, -16, 3.5, 5, 0.3, 0, Math.PI * 2);
        ctx.stroke();
        
        // === 鼻子 - 立体 ===
        const noseGradient = ctx.createRadialGradient(11, -12, 0.5, 10.5, -12, 3);
        noseGradient.addColorStop(0, '#FFD4A3');
        noseGradient.addColorStop(0.6, '#E6B88A');
        noseGradient.addColorStop(1, '#D4A678');
        ctx.fillStyle = noseGradient;
        ctx.beginPath();
        ctx.ellipse(10.5, -12, 2.5, 3.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 鼻孔
        ctx.fillStyle = '#A67C52';
        ctx.beginPath();
        ctx.ellipse(11.5, -11, 1, 1.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 鼻子高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.ellipse(10, -13, 1, 1.5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // === 嘴巴 - 微笑 ===
        ctx.strokeStyle = '#C49A6A';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(9, -9);
        ctx.quadraticCurveTo(10, -7.5, 11, -8);
        ctx.stroke();
        
        // === 下巴 ===
        const chinGradient = ctx.createRadialGradient(6, -9, 1, 5, -8, 5);
        chinGradient.addColorStop(0, '#FFD4A3');
        chinGradient.addColorStop(0.7, '#E6B88A');
        chinGradient.addColorStop(1, '#D4A678');
        ctx.fillStyle = chinGradient;
        ctx.beginPath();
        ctx.ellipse(5, -8, 4.5, 5.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // 下巴阴影
        ctx.fillStyle = 'rgba(214, 166, 120, 0.4)';
        ctx.beginPath();
        ctx.ellipse(4, -7, 3, 3.5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // === 护目镜 - 现代运动风格 ===
        // 镜框阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(5.5, -14.5, 9, 6, 0.05, 0, Math.PI * 2);
        ctx.fill();
        
        // 镜框外圈
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(5, -15, 9, 6, 0.05, 0, Math.PI * 2);
        ctx.stroke();
        
        // 镜框内圈
        ctx.strokeStyle = '#2C2C2C';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 镜片 - 炫彩渐变
        const goggleGradient = ctx.createRadialGradient(6, -17, 2, 5, -15, 8);
        goggleGradient.addColorStop(0, 'rgba(255, 215, 0, 0.95)');
        goggleGradient.addColorStop(0.3, 'rgba(255, 193, 7, 0.9)');
        goggleGradient.addColorStop(0.6, 'rgba(255, 152, 0, 0.85)');
        goggleGradient.addColorStop(1, 'rgba(218, 165, 32, 0.8)');
        ctx.fillStyle = goggleGradient;
        ctx.beginPath();
        ctx.ellipse(5, -15, 8.5, 5.5, 0.05, 0, Math.PI * 2);
        ctx.fill();
        
        // 镜片强烈高光
        const goggleHighlight = ctx.createRadialGradient(7, -18, 1, 7, -17, 5);
        goggleHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        goggleHighlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        goggleHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = goggleHighlight;
        ctx.beginPath();
        ctx.ellipse(7, -17, 5, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 镜片次级高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(3, -13, 2, 1.5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 护目镜带子
        const strapGradient = ctx.createLinearGradient(-3, -15, -7, -16);
        strapGradient.addColorStop(0, '#3A3A3A');
        strapGradient.addColorStop(1, '#1A1A1A');
        ctx.strokeStyle = strapGradient;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-3, -15);
        ctx.lineTo(-7, -16);
        ctx.stroke();
        
        // 带子高光
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, -15.5);
        ctx.lineTo(-6.5, -16.5);
        ctx.stroke();
        
        // 鼻梁阴影
        ctx.fillStyle = 'rgba(214, 166, 120, 0.3)';
        ctx.beginPath();
        ctx.ellipse(9, -12, 2, 3, 0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 嘴巴侧面（微微张开）
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(8, -8);
        ctx.quadraticCurveTo(10, -7, 11, -8);
        ctx.stroke();
        
        // 耳朵
        ctx.fillStyle = '#FFCB9A';
        ctx.beginPath();
        ctx.ellipse(-3, -20, 3, 4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 耳朵内部
        ctx.fillStyle = '#E6B88A';
        ctx.beginPath();
        ctx.ellipse(-3, -20, 1.5, 2, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    drawSkiGear(ctx) {
        ctx.save();
        
        // 计算手臂摆动（根据跳跃姿态）
        const armSwing = this.jumpPose * 5;
        const poleAngle = this.jumpPose * 0.2;
        
        // 左侧滑雪杖（前手）
        ctx.save();
        ctx.translate(-12 - armSwing * 1.5, 16 + armSwing * 0.5);
        ctx.rotate(-0.6 - poleAngle);
        
        // 滑雪杖杆身 - 渐变金属质感
        const leftPoleGradient = ctx.createLinearGradient(-1, 0, 1, 0);
        leftPoleGradient.addColorStop(0, '#A0A0A0');
        leftPoleGradient.addColorStop(0.5, '#D0D0D0');
        leftPoleGradient.addColorStop(1, '#808080');
        ctx.strokeStyle = leftPoleGradient;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 35);
        ctx.stroke();
        
        // 滑雪杖握把
        ctx.fillStyle = '#2C2C2C';
        ctx.fillRect(-2, -3, 4, 8);
        ctx.strokeStyle = '#FF4757';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-2, -3, 4, 8);
        
        // 滑雪杖尖端
        ctx.fillStyle = '#404040';
        ctx.beginPath();
        ctx.moveTo(-1.5, 35);
        ctx.lineTo(0, 40);
        ctx.lineTo(1.5, 35);
        ctx.closePath();
        ctx.fill();
        
        // 滑雪杖雪圈（底部圆盘）
        ctx.fillStyle = 'rgba(255, 107, 107, 0.8)';
        ctx.beginPath();
        ctx.ellipse(0, 36, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#C23616';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
        
        // 右侧滑雪杖（后手）
        ctx.save();
        ctx.translate(12 + armSwing * 1.5, 16 - armSwing * 0.5);
        ctx.rotate(-0.5 + poleAngle);
        
        // 滑雪杖杆身
        const rightPoleGradient = ctx.createLinearGradient(-1, 0, 1, 0);
        rightPoleGradient.addColorStop(0, '#808080');
        rightPoleGradient.addColorStop(0.5, '#C0C0C0');
        rightPoleGradient.addColorStop(1, '#707070');
        ctx.strokeStyle = rightPoleGradient;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 35);
        ctx.stroke();
        
        // 滑雪杖握把
        ctx.fillStyle = '#2C2C2C';
        ctx.fillRect(-2, -3, 4, 8);
        ctx.strokeStyle = '#FF4757';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-2, -3, 4, 8);
        
        // 滑雪杖尖端
        ctx.fillStyle = '#404040';
        ctx.beginPath();
        ctx.moveTo(-1.5, 35);
        ctx.lineTo(0, 40);
        ctx.lineTo(1.5, 35);
        ctx.closePath();
        ctx.fill();
        
        // 滑雪杖雪圈
        ctx.fillStyle = 'rgba(255, 107, 107, 0.8)';
        ctx.beginPath();
        ctx.ellipse(0, 36, 5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#C23616';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
        
        // 围巾作为装饰 - 侧面视角
        // 围巾主体（飘扬效果）
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-12, -3);
        ctx.lineTo(-10, 2);
        ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
        
        // 围巾条纹
        ctx.fillStyle = '#FF8C00';
        ctx.fillRect(-11, -2, 4, 1.5);
        ctx.fillRect(-9, 0, 3, 1.5);
        
        ctx.restore();
    }
    
    drawRidingSnowmobile(ctx) {
        // 绘制超精美现代雪地摩托和坐在上面的人物
        ctx.save();
        
        const motoX = 0;
        const motoY = 50;
        
        // === 后履带（真实感）===
        const trackGradient = ctx.createLinearGradient(motoX - 50, motoY + 18, motoX - 50, motoY + 38);
        trackGradient.addColorStop(0, '#3A3A3A');
        trackGradient.addColorStop(0.5, '#2A2A2A');
        trackGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = trackGradient;
        ctx.fillRect(motoX - 50, motoY + 18, 55, 20);
        
        ctx.strokeStyle = '#4A4A4A';
        ctx.lineWidth = 2;
        ctx.strokeRect(motoX - 50, motoY + 18, 55, 20);
        
        ctx.strokeStyle = '#5A5A5A';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(motoX - 50 + i * 7, motoY + 18);
            ctx.lineTo(motoX - 50 + i * 7, motoY + 38);
            ctx.stroke();
        }
        
        const wheelGradient = ctx.createRadialGradient(motoX - 40, motoY + 28, 3, motoX - 40, motoY + 28, 10);
        wheelGradient.addColorStop(0, '#4A4A4A');
        wheelGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = wheelGradient;
        ctx.beginPath();
        ctx.arc(motoX - 40, motoY + 28, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5A5A5A';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(motoX - 10, motoY + 28, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#2A2A2A';
        ctx.fillRect(motoX - 45, motoY + 12, 90, 8);
        
        // === 主车身（现代流线型）===
        const rearBodyGradient = ctx.createLinearGradient(motoX - 45, motoY - 25, motoX - 45, motoY + 10);
        rearBodyGradient.addColorStop(0, '#FF1744');
        rearBodyGradient.addColorStop(0.5, '#D50000');
        rearBodyGradient.addColorStop(1, '#B71C1C');
        ctx.fillStyle = rearBodyGradient;
        ctx.beginPath();
        ctx.moveTo(motoX - 45, motoY + 10);
        ctx.lineTo(motoX - 45, motoY - 5);
        ctx.quadraticCurveTo(motoX - 45, motoY - 25, motoX - 25, motoY - 28);
        ctx.lineTo(motoX + 10, motoY - 28);
        ctx.lineTo(motoX + 10, motoY + 10);
        ctx.closePath();
        ctx.fill();
        
        const highlightGradient = ctx.createLinearGradient(motoX - 40, motoY - 25, motoX - 40, motoY - 15);
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlightGradient;
        ctx.fillRect(motoX - 40, motoY - 25, 45, 10);
        
        const frontBodyGradient = ctx.createLinearGradient(motoX + 10, motoY - 20, motoX + 10, motoY + 10);
        frontBodyGradient.addColorStop(0, '#1A1A1A');
        frontBodyGradient.addColorStop(0.5, '#2A2A2A');
        frontBodyGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = frontBodyGradient;
        ctx.beginPath();
        ctx.moveTo(motoX + 10, motoY + 10);
        ctx.lineTo(motoX + 10, motoY - 20);
        ctx.lineTo(motoX + 55, motoY - 18);
        ctx.lineTo(motoX + 60, motoY - 10);
        ctx.lineTo(motoX + 60, motoY + 10);
        ctx.closePath();
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(motoX + 15, motoY - 18, 35, 6);
        
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(motoX - 40, motoY - 10);
        ctx.lineTo(motoX + 55, motoY - 10);
        ctx.stroke();
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(motoX + 10, motoY - 28);
        ctx.lineTo(motoX + 10, motoY + 10);
        ctx.stroke();
        
        // === 座椅（运动型）===
        const seatGradient = ctx.createRadialGradient(motoX - 5, motoY - 30, 5, motoX - 5, motoY - 25, 30);
        seatGradient.addColorStop(0, '#4A4A4A');
        seatGradient.addColorStop(0.7, '#2A2A2A');
        seatGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = seatGradient;
        ctx.beginPath();
        ctx.ellipse(motoX - 5, motoY - 25, 32, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        ctx.strokeStyle = '#3A3A3A';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(motoX - 25 + i * 12, motoY - 30);
            ctx.lineTo(motoX - 25 + i * 12, motoY - 20);
            ctx.stroke();
        }
        
        // === 前挡风玻璃（运动型）===
        const windshieldGradient = ctx.createLinearGradient(motoX + 25, motoY - 35, motoX + 55, motoY - 15);
        windshieldGradient.addColorStop(0, 'rgba(0, 150, 255, 0.9)');
        windshieldGradient.addColorStop(0.5, 'rgba(0, 200, 255, 0.6)');
        windshieldGradient.addColorStop(1, 'rgba(100, 220, 255, 0.3)');
        ctx.fillStyle = windshieldGradient;
        ctx.beginPath();
        ctx.moveTo(motoX + 25, motoY - 20);
        ctx.lineTo(motoX + 55, motoY - 35);
        ctx.lineTo(motoX + 58, motoY - 12);
        ctx.lineTo(motoX + 30, motoY - 15);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(motoX + 30, motoY - 22);
        ctx.lineTo(motoX + 48, motoY - 32);
        ctx.lineTo(motoX + 50, motoY - 28);
        ctx.lineTo(motoX + 32, motoY - 18);
        ctx.closePath();
        ctx.fill();
        
        // === 前滑板（运动型）===
        const skiGradient = ctx.createLinearGradient(motoX + 35, motoY + 20, motoX + 35, motoY + 35);
        skiGradient.addColorStop(0, '#6A6A6A');
        skiGradient.addColorStop(0.5, '#4A4A4A');
        skiGradient.addColorStop(1, '#2A2A2A');
        ctx.fillStyle = skiGradient;
        ctx.beginPath();
        ctx.moveTo(motoX + 35, motoY + 20);
        ctx.lineTo(motoX + 70, motoY + 18);
        ctx.lineTo(motoX + 72, motoY + 22);
        ctx.lineTo(motoX + 72, motoY + 32);
        ctx.lineTo(motoX + 70, motoY + 35);
        ctx.lineTo(motoX + 35, motoY + 35);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.strokeStyle = '#8A8A8A';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(motoX + 40 + i * 10, motoY + 22);
            ctx.lineTo(motoX + 65 + i * 2, motoY + 20);
            ctx.stroke();
        }
        
        // === 超亮车灯（LED风格）===
        const lightGradient1 = ctx.createRadialGradient(motoX + 58, motoY - 15, 1, motoX + 58, motoY - 15, 10);
        lightGradient1.addColorStop(0, '#FFFFFF');
        lightGradient1.addColorStop(0.3, '#FFFF00');
        lightGradient1.addColorStop(0.7, '#FFD700');
        lightGradient1.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = lightGradient1;
        ctx.beginPath();
        ctx.arc(motoX + 58, motoY - 15, 7, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(motoX + 58, motoY - 5, 7, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(motoX + 58, motoY - 15, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(motoX + 58, motoY - 5, 7, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(motoX + 58, motoY - 15, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(motoX + 58, motoY - 5, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // === 排气管烟雾 ===
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = `rgba(150, 150, 150, ${0.5 - i * 0.15})`;
            ctx.beginPath();
            ctx.ellipse(motoX - 55 - i * 15, motoY + 10, 12, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // === 速度线 ===
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(motoX - 70 - i * 15, motoY - 10 + i * 6);
            ctx.lineTo(motoX - 95 - i * 15, motoY - 10 + i * 6);
            ctx.stroke();
        }
        
        // === LOGO ===
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TURBO', motoX + 35, motoY - 5);
        
        // === 人物坐在摩托上 ===
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(motoX - 5, motoY - 45, 22, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(motoX - 5, motoY - 43, 16, 21, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(motoX - 5, motoY - 68, 18, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(motoX - 3, motoY - 68, 11, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(motoX + 12, motoY - 45);
        ctx.lineTo(motoX + 35, motoY - 30);
        ctx.stroke();
        
        ctx.restore();
    }
    
    drawRidingAnimal(ctx) {
        ctx.save();
        ctx.translate(0, 25);
        
        if (this.ridingAnimal === 'penguin') {
            // 企鹅身体 - 3D效果
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // 企鹅肚子
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.ellipse(0, 2, 8, 12, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 北极熊 - 3D效果
            ctx.fillStyle = '#F0F0F0';
            ctx.beginPath();
            ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // 阴影
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.beginPath();
            ctx.ellipse(0, 8, 15, 4, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    drawRidingPolarBear(ctx) {
        // 绘制白熊和骑在背上的人类 - 超强3D立体效果
        ctx.save();
        
        const bearX = 0;
        const bearY = 20;
        const runCycle = Date.now() / 100; // 奔跑动画周期
        
        // === 动态地面阴影（随奔跑变化） ===
        const shadowScale = 1 + Math.sin(runCycle) * 0.1; // 阴影随奔跑缩放
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(bearX, bearY + 88, 55 * shadowScale, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 阴影模糊效果
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(bearX, bearY + 88, 65 * shadowScale, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 后腿（奔跑动画） ===
        const backLegCycle = Math.sin(runCycle) * 5;
        
        // 后左腿
        const backLeftGradient = ctx.createLinearGradient(bearX - 30, bearY + 50, bearX - 20, bearY + 80);
        backLeftGradient.addColorStop(0, '#FFFFFF');
        backLeftGradient.addColorStop(0.5, '#F5F5F5');
        backLeftGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = backLeftGradient;
        ctx.beginPath();
        ctx.ellipse(bearX - 25, bearY + 60 + backLegCycle, 12, 25, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 后右腿
        const backRightGradient = ctx.createLinearGradient(bearX + 20, bearY + 50, bearX + 30, bearY + 80);
        backRightGradient.addColorStop(0, '#FFFFFF');
        backRightGradient.addColorStop(0.5, '#F5F5F5');
        backRightGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = backRightGradient;
        ctx.beginPath();
        ctx.ellipse(bearX + 25, bearY + 60 - backLegCycle, 12, 25, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // === 身体（超强3D效果） ===
        // 底部深阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(bearX, bearY + 68, 42, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 主体渐变（多层次）
        const bodyGradient = ctx.createRadialGradient(
            bearX - 15, bearY + 30, 15,
            bearX, bearY + 50, 55
        );
        bodyGradient.addColorStop(0, '#FFFFFF');
        bodyGradient.addColorStop(0.3, '#FEFEFE');
        bodyGradient.addColorStop(0.5, '#F8F8F8');
        bodyGradient.addColorStop(0.7, '#F0F0F0');
        bodyGradient.addColorStop(0.85, '#E5E5E5');
        bodyGradient.addColorStop(1, '#D8D8D8');
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.ellipse(bearX, bearY + 50, 48, 37, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 顶部高光
        const highlightGradient = ctx.createRadialGradient(
            bearX - 12, bearY + 35, 5,
            bearX - 8, bearY + 40, 25
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlightGradient;
        ctx.beginPath();
        ctx.ellipse(bearX - 8, bearY + 40, 22, 15, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 轮廓线（3D感）
        ctx.strokeStyle = 'rgba(160, 160, 160, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(bearX, bearY + 50, 48, 37, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        // === 前肢（奔跑动画） ===
        const frontLegCycle = Math.sin(runCycle + Math.PI) * 6;
        
        // 前左肢
        const frontLeftGradient = ctx.createLinearGradient(bearX - 35, bearY + 40, bearX - 25, bearY + 75);
        frontLeftGradient.addColorStop(0, '#FFFFFF');
        frontLeftGradient.addColorStop(0.6, '#F5F5F5');
        frontLeftGradient.addColorStop(1, '#E5E5E5');
        ctx.fillStyle = frontLeftGradient;
        ctx.beginPath();
        ctx.ellipse(bearX - 30, bearY + 55 + frontLegCycle, 14, 28, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 前左爪
        ctx.fillStyle = '#1A1A1A';
        for (let i = 0; i < 5; i++) {
            const clawX = bearX - 30 + (i - 2) * 5;
            const clawY = bearY + 80 + frontLegCycle;
            ctx.beginPath();
            ctx.moveTo(clawX, clawY);
            ctx.lineTo(clawX - 1, clawY + 8);
            ctx.lineTo(clawX + 1, clawY + 8);
            ctx.closePath();
            ctx.fill();
        }
        
        // 前右肢
        const frontRightGradient = ctx.createLinearGradient(bearX + 25, bearY + 40, bearX + 35, bearY + 75);
        frontRightGradient.addColorStop(0, '#FFFFFF');
        frontRightGradient.addColorStop(0.6, '#F5F5F5');
        frontRightGradient.addColorStop(1, '#E5E5E5');
        ctx.fillStyle = frontRightGradient;
        ctx.beginPath();
        ctx.ellipse(bearX + 30, bearY + 55 - frontLegCycle, 14, 28, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 前右爪
        ctx.fillStyle = '#1A1A1A';
        for (let i = 0; i < 5; i++) {
            const clawX = bearX + 30 + (i - 2) * 5;
            const clawY = bearY + 80 - frontLegCycle;
            ctx.beginPath();
            ctx.moveTo(clawX, clawY);
            ctx.lineTo(clawX - 1, clawY + 8);
            ctx.lineTo(clawX + 1, clawY + 8);
            ctx.closePath();
            ctx.fill();
        }
        
        // === 颈部 ===
        const neckGradient = ctx.createLinearGradient(bearX - 5, bearY + 20, bearX + 5, bearY + 35);
        neckGradient.addColorStop(0, '#FFFFFF');
        neckGradient.addColorStop(0.5, '#F8F8F8');
        neckGradient.addColorStop(1, '#F0F0F0');
        ctx.fillStyle = neckGradient;
        ctx.beginPath();
        ctx.ellipse(bearX, bearY + 28, 10, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // === 头部 ===
        const headGradient = ctx.createRadialGradient(
            bearX - 5, bearY + 8, 5,
            bearX, bearY + 12, 18
        );
        headGradient.addColorStop(0, '#FFFFFF');
        headGradient.addColorStop(0.5, '#FAFAFA');
        headGradient.addColorStop(1, '#ECECEC');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.ellipse(bearX, bearY + 15, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(190, 190, 190, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // === 耳朵 ===
        // 左耳
        const leftEarGradient = ctx.createRadialGradient(bearX - 12, bearY + 5, 2, bearX - 12, bearY + 6, 5);
        leftEarGradient.addColorStop(0, '#FFFFFF');
        leftEarGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = leftEarGradient;
        ctx.beginPath();
        ctx.arc(bearX - 12, bearY + 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D0D0D0';
        ctx.beginPath();
        ctx.arc(bearX - 12, bearY + 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 右耳
        const rightEarGradient = ctx.createRadialGradient(bearX + 12, bearY + 5, 2, bearX + 12, bearY + 6, 5);
        rightEarGradient.addColorStop(0, '#FFFFFF');
        rightEarGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = rightEarGradient;
        ctx.beginPath();
        ctx.arc(bearX + 12, bearY + 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D0D0D0';
        ctx.beginPath();
        ctx.arc(bearX + 12, bearY + 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // === 鼻头 ===
        const noseGradient = ctx.createRadialGradient(bearX - 1, bearY + 22, 2, bearX, bearY + 24, 5);
        noseGradient.addColorStop(0, '#2A2A2A');
        noseGradient.addColorStop(0.6, '#1A1A1A');
        noseGradient.addColorStop(1, '#000000');
        ctx.fillStyle = noseGradient;
        ctx.beginPath();
        ctx.ellipse(bearX, bearY + 24, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 鼻头高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(bearX - 2, bearY + 22, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // === 眼睛 ===
        // 左眼
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(bearX - 8, bearY + 13, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(bearX - 7, bearY + 12, 1.8, 0, Math.PI * 2);
        ctx.fill();
        
        // 右眼
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(bearX + 8, bearY + 13, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(bearX + 9, bearY + 12, 1.8, 0, Math.PI * 2);
        ctx.fill();
        
        // === 人类骑在白熊背上（超强3D效果） ===
        const riderX = bearX - 5;
        const riderY = bearY + 25; // 坐在白熊背部
        const bobbing = Math.sin(runCycle) * 2.5; // 随白熊奔跑上下颠簸
        const sway = Math.sin(runCycle * 0.5) * 1.5; // 左右摇摆
        
        // 骑手阴影（投射在白熊背上）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(riderX + 2, bearY + 52, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 腿部（先绘制，在身体后面） ===
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        
        // 左腿（3D效果）
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.moveTo(riderX - 8 + sway, riderY + 10 + bobbing);
        ctx.quadraticCurveTo(riderX - 12 + sway, riderY + 22 + bobbing, riderX - 15 + sway, riderY + 35 + bobbing);
        ctx.stroke();
        ctx.restore();
        
        // 右腿（3D效果）
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.beginPath();
        ctx.moveTo(riderX + 8 + sway, riderY + 10 + bobbing);
        ctx.quadraticCurveTo(riderX + 12 + sway, riderY + 22 + bobbing, riderX + 15 + sway, riderY + 35 + bobbing);
        ctx.stroke();
        ctx.restore();
        
        // 滑雪靴（3D立体）
        const bootGradient = ctx.createLinearGradient(riderX - 18, riderY + 35, riderX - 18, riderY + 43);
        bootGradient.addColorStop(0, '#3A3A3A');
        bootGradient.addColorStop(0.5, '#2A2A2A');
        bootGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = bootGradient;
        ctx.fillRect(riderX - 20 + sway, riderY + 35 + bobbing, 10, 8);
        ctx.fillRect(riderX + 10 + sway, riderY + 35 + bobbing, 10, 8);
        
        // 靴子高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(riderX - 19 + sway, riderY + 36 + bobbing, 4, 2);
        ctx.fillRect(riderX + 11 + sway, riderY + 36 + bobbing, 4, 2);
        
        // === 人类身体（3D渐变） ===
        const bodyColor = '#FF6B6B';
        
        // 身体阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(riderX + 2 + sway, riderY + 2 + bobbing, 13, 19, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 身体主体（多层渐变）
        const bodyGrad = ctx.createRadialGradient(
            riderX - 6 + sway, riderY - 8 + bobbing, 5,
            riderX + sway, riderY + bobbing, 20
        );
        bodyGrad.addColorStop(0, '#FF9999');
        bodyGrad.addColorStop(0.4, '#FF7777');
        bodyGrad.addColorStop(0.7, bodyColor);
        bodyGrad.addColorStop(1, '#DD5555');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.ellipse(riderX + sway, riderY + bobbing, 13, 19, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 身体高光
        const bodyHighlight = ctx.createRadialGradient(
            riderX - 5 + sway, riderY - 10 + bobbing, 2,
            riderX - 3 + sway, riderY - 5 + bobbing, 10
        );
        bodyHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        bodyHighlight.addColorStop(0.6, 'rgba(255, 255, 255, 0.2)');
        bodyHighlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = bodyHighlight;
        ctx.beginPath();
        ctx.ellipse(riderX - 3 + sway, riderY - 5 + bobbing, 8, 12, -0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // 身体轮廓
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(riderX + sway, riderY + bobbing, 13, 19, 0, 0, Math.PI * 2);
        ctx.stroke();
        
        // === 人类头部（3D球体） ===
        // 头部阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.arc(riderX + 2 + sway, riderY - 16 + bobbing, 9, 0, Math.PI * 2);
        ctx.fill();
        
        // 头部主体
        const headGrad = ctx.createRadialGradient(
            riderX - 3 + sway, riderY - 21 + bobbing, 3,
            riderX + sway, riderY - 18 + bobbing, 10
        );
        headGrad.addColorStop(0, '#FFF0E0');
        headGrad.addColorStop(0.5, '#FFE0BD');
        headGrad.addColorStop(1, '#FFCCA0');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(riderX + sway, riderY - 18 + bobbing, 9, 0, Math.PI * 2);
        ctx.fill();
        
        // 头部高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(riderX - 3 + sway, riderY - 21 + bobbing, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 头部轮廓
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(riderX + sway, riderY - 18 + bobbing, 9, 0, Math.PI * 2);
        ctx.stroke();
        
        // === 头盔（3D效果） ===
        const helmetGrad = ctx.createLinearGradient(
            riderX - 10 + sway, riderY - 25 + bobbing,
            riderX + 10 + sway, riderY - 15 + bobbing
        );
        helmetGrad.addColorStop(0, '#6AB0FF');
        helmetGrad.addColorStop(0.5, '#4A90E2');
        helmetGrad.addColorStop(1, '#2A70C2');
        ctx.fillStyle = helmetGrad;
        ctx.beginPath();
        ctx.arc(riderX + sway, riderY - 18 + bobbing, 10, Math.PI, Math.PI * 2);
        ctx.fill();
        
        // 头盔高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(riderX - 4 + sway, riderY - 23 + bobbing, 4, Math.PI * 0.8, Math.PI * 1.5);
        ctx.fill();
        
        // 头盔轮廓
        ctx.strokeStyle = '#2A5A9A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(riderX + sway, riderY - 18 + bobbing, 10, Math.PI, Math.PI * 2);
        ctx.stroke();
        
        // === 护目镜（3D玻璃效果） ===
        // 镜框
        const goggleGrad = ctx.createLinearGradient(
            riderX - 8 + sway, riderY - 21 + bobbing,
            riderX + 8 + sway, riderY - 17 + bobbing
        );
        goggleGrad.addColorStop(0, '#3A3A3A');
        goggleGrad.addColorStop(0.5, '#2A2A2A');
        goggleGrad.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = goggleGrad;
        ctx.fillRect(riderX - 8 + sway, riderY - 21 + bobbing, 16, 5);
        
        // 镜片（深色玻璃）
        ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
        ctx.fillRect(riderX - 7 + sway, riderY - 20 + bobbing, 14, 4);
        
        // 镜片反光
        const reflectionGrad = ctx.createLinearGradient(
            riderX - 7 + sway, riderY - 20 + bobbing,
            riderX + 7 + sway, riderY - 16 + bobbing
        );
        reflectionGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        reflectionGrad.addColorStop(0.3, 'rgba(200, 230, 255, 0.3)');
        reflectionGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
        reflectionGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = reflectionGrad;
        ctx.fillRect(riderX - 7 + sway, riderY - 20 + bobbing, 7, 3);
        
        // === 手臂（3D圆柱体效果） ===
        ctx.lineCap = 'round';
        ctx.lineWidth = 5;
        
        // 左手臂（带阴影）
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
        
        // 左臂渐变
        const leftArmGrad = ctx.createLinearGradient(
            riderX - 10 + sway, riderY - 5 + bobbing,
            riderX - 20 + sway, riderY + 15 + bobbing
        );
        leftArmGrad.addColorStop(0, '#FF8888');
        leftArmGrad.addColorStop(0.5, bodyColor);
        leftArmGrad.addColorStop(1, '#DD5555');
        ctx.strokeStyle = leftArmGrad;
        ctx.beginPath();
        ctx.moveTo(riderX - 10 + sway, riderY - 5 + bobbing);
        ctx.quadraticCurveTo(riderX - 13 + sway, riderY + 3 + bobbing, riderX - 20 + sway, riderY + 15 + bobbing);
        ctx.stroke();
        ctx.restore();
        
        // 右手臂（带阴影）
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
        
        // 右臂渐变
        const rightArmGrad = ctx.createLinearGradient(
            riderX + 10 + sway, riderY - 5 + bobbing,
            riderX + 20 + sway, riderY + 15 + bobbing
        );
        rightArmGrad.addColorStop(0, '#FF8888');
        rightArmGrad.addColorStop(0.5, bodyColor);
        rightArmGrad.addColorStop(1, '#DD5555');
        ctx.strokeStyle = rightArmGrad;
        ctx.beginPath();
        ctx.moveTo(riderX + 10 + sway, riderY - 5 + bobbing);
        ctx.quadraticCurveTo(riderX + 13 + sway, riderY + 3 + bobbing, riderX + 20 + sway, riderY + 15 + bobbing);
        ctx.stroke();
        ctx.restore();
        
        // === 手套（3D球体） ===
        // 左手套阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(riderX - 19 + sway, riderY + 16 + bobbing, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // 左手套主体
        const leftGloveGrad = ctx.createRadialGradient(
            riderX - 21 + sway, riderY + 14 + bobbing, 2,
            riderX - 20 + sway, riderY + 15 + bobbing, 5
        );
        leftGloveGrad.addColorStop(0, '#4A4A4A');
        leftGloveGrad.addColorStop(0.6, '#2A2A2A');
        leftGloveGrad.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = leftGloveGrad;
        ctx.beginPath();
        ctx.arc(riderX - 20 + sway, riderY + 15 + bobbing, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // 左手套高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(riderX - 21 + sway, riderY + 14 + bobbing, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 右手套阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(riderX + 21 + sway, riderY + 16 + bobbing, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // 右手套主体
        const rightGloveGrad = ctx.createRadialGradient(
            riderX + 19 + sway, riderY + 14 + bobbing, 2,
            riderX + 20 + sway, riderY + 15 + bobbing, 5
        );
        rightGloveGrad.addColorStop(0, '#4A4A4A');
        rightGloveGrad.addColorStop(0.6, '#2A2A2A');
        rightGloveGrad.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = rightGloveGrad;
        ctx.beginPath();
        ctx.arc(riderX + 20 + sway, riderY + 15 + bobbing, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // 右手套高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(riderX + 19 + sway, riderY + 14 + bobbing, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

// Terrain Generation - Dynamic downhill slope with varying angles
class Terrain {
    constructor() {
        this.points = [];
        this.offset = 0;
        this.baseY = CONFIG.canvas.height * 0.5; // 基准高度（从屏幕中部开始）
        this.currentSlope = 0; // 当前坡度
        this.targetSlope = 0; // 目标坡度
        this.slopeChangeSpeed = 0.02; // 坡度变化速度
        this.snowParticles = [];
        this.skiTracks = [];
        this.generateInitialTerrain();
        this.generateSnowParticles();
    }
    
    generateInitialTerrain() {
        // 生成大幅度变化的地形：平台、陡坡、缓坡交替
        let currentY = this.baseY;
        let currentSegmentType = 'gentle'; // 'gentle', 'steep', 'platform'
        let segmentLength = 0;
        let targetSegmentLength = 2000 + Math.random() * 1500; // 每段2000-3500px，极大降低坡度变化频率
        
        // 从负坐标开始生成，确保左侧有足够的地形
        for (let i = -CONFIG.canvas.width; i <= CONFIG.canvas.width * 2; i += 10) {
            segmentLength += 10;
            
            // 每段结束后切换到新的地形类型
            if (segmentLength >= targetSegmentLength) {
                segmentLength = 0;
                targetSegmentLength = 2000 + Math.random() * 1500;
                
                // 随机选择新的地形类型（避免重复）
                const types = ['gentle', 'steep', 'platform'];
                const filtered = types.filter(t => t !== currentSegmentType);
                currentSegmentType = filtered[Math.floor(Math.random() * filtered.length)];
            }
            
            // 根据地形类型设置坡度（严格限制在1-30度范围）
            let slopeAngle;
            if (currentSegmentType === 'platform') {
                slopeAngle = 1 + Math.random() * 4; // 平台：1-5度（平缓）
            } else if (currentSegmentType === 'gentle') {
                slopeAngle = 8 + Math.random() * 10; // 缓坡：8-18度
            } else { // steep
                slopeAngle = 20 + Math.random() * 10; // 陡坡：20-30度（严格不超过30度）
            }
            
            const slopeRad = (slopeAngle * Math.PI) / 180;
            const slope = Math.tan(slopeRad);
            currentY += 10 * slope;
            
            this.points.push({ 
                x: i, 
                y: currentY, 
                slope: slope, 
                angle: slopeAngle,
                segmentType: currentSegmentType 
            });
        }
    }
    
    generateSnowParticles() {
        // 禁用地形雪粒子，避免雪地上出现气泡效果
        // 只使用天空飘落的雪花系统
    }
    
    update(speed) {
        this.offset += speed;
        
        // 移除屏幕外的点（左侧和右侧都保留更多）
        while (this.points.length > 0 && this.points[0].x < -CONFIG.canvas.width) {
            this.points.shift();
        }
        while (this.points.length > 0 && this.points[this.points.length - 1].x > CONFIG.canvas.width * 3) {
            this.points.pop();
        }
        
        // 向左添加新的地形点（如果需要）
        while (this.points.length > 0 && this.points[0].x > -CONFIG.canvas.width * 0.5) {
            const firstPoint = this.points[0];
            const newX = firstPoint.x - 10;
            
            // 使用与第一个点相似的坡度
            const slopeAngle = firstPoint.angle || 15;
            const slopeRad = (slopeAngle * Math.PI) / 180;
            const newSlope = Math.tan(slopeRad);
            const newY = firstPoint.y - 10 * newSlope;
            
            this.points.unshift({ 
                x: newX, 
                y: newY, 
                slope: newSlope, 
                angle: slopeAngle,
                segmentType: firstPoint.segmentType || 'gentle'
            });
        }
        
        // 向右添加新的地形点（大幅度变化：平台、陡坡、缓坡交替）
        while (this.points[this.points.length - 1].x < CONFIG.canvas.width * 1.5) {
            const lastPoint = this.points[this.points.length - 1];
            const newX = lastPoint.x + 10;
            
            // 检查是否需要切换地形段
            if (!this.currentSegmentLength) {
                this.currentSegmentLength = 0;
                this.targetSegmentLength = 2000 + Math.random() * 1500;
                this.currentSegmentType = lastPoint.segmentType || 'gentle';
            }
            
            this.currentSegmentLength += 10;
            
            // 切换到新的地形类型
            if (this.currentSegmentLength >= this.targetSegmentLength) {
                this.currentSegmentLength = 0;
                this.targetSegmentLength = 2000 + Math.random() * 1500;
                
                const types = ['gentle', 'steep', 'platform'];
                const filtered = types.filter(t => t !== this.currentSegmentType);
                this.currentSegmentType = filtered[Math.floor(Math.random() * filtered.length)];
            }
            
            // 根据地形类型设置目标坡度（严格限制在1-30度范围）
            let targetAngle;
            if (this.currentSegmentType === 'platform') {
                targetAngle = 1 + Math.random() * 4; // 平台：1-5度
            } else if (this.currentSegmentType === 'gentle') {
                targetAngle = 8 + Math.random() * 10; // 缓坡：8-18度
            } else { // steep
                targetAngle = 20 + Math.random() * 10; // 陡坡：20-30度（严格不超过30度）
            }
            
            // 平滑过渡到新坡度
            const currentAngle = lastPoint.angle || 15;
            let smoothAngle = currentAngle + (targetAngle - currentAngle) * 0.05;
            
            // 严格限制坡度不超过30度
            smoothAngle = Math.max(1, Math.min(30, smoothAngle));
            
            const slopeRad = (smoothAngle * Math.PI) / 180;
            const newSlope = Math.tan(slopeRad);
            const newY = lastPoint.y + 10 * newSlope;
            
            this.points.push({ 
                x: newX, 
                y: newY, 
                slope: newSlope, 
                angle: smoothAngle,
                segmentType: this.currentSegmentType
            });
        }
        
        // 更新所有点的位置
        this.points.forEach(point => {
            point.x -= speed;
        });
        
        // 更新雪地粒子
        this.snowParticles.forEach(particle => {
            particle.x -= speed * particle.speed;
            if (particle.x < -50) {
                particle.x = CONFIG.canvas.width + 50;
                particle.y = Math.random() * CONFIG.canvas.height;
            }
        });
        
        // 更新滑雪痕迹
        this.skiTracks = this.skiTracks.filter(track => {
            track.x -= speed;
            track.life -= 0.01;
            return track.x > -50 && track.life > 0;
        });
    }
    
    getHeightAt(x) {
        // 根据地形点使用贝塞尔曲线插值计算高度（与渲染一致）
        for (let i = 0; i < this.points.length - 1; i++) {
            if (x >= this.points[i].x && x <= this.points[i + 1].x) {
                const p1 = this.points[i];
                const p2 = this.points[i + 1];
                
                // 计算贝塞尔曲线控制点（与绘制时相同）
                const cp1x = p1.x + (p2.x - p1.x) / 3;
                const cp1y = p1.y + (p2.y - p1.y) / 3;
                const cp2x = p1.x + (p2.x - p1.x) * 2 / 3;
                const cp2y = p1.y + (p2.y - p1.y) * 2 / 3;
                
                // 使用贝塞尔曲线公式计算Y值
                const t = (x - p1.x) / (p2.x - p1.x);
                const oneMinusT = 1 - t;
                const y = oneMinusT * oneMinusT * oneMinusT * p1.y +
                         3 * oneMinusT * oneMinusT * t * cp1y +
                         3 * oneMinusT * t * t * cp2y +
                         t * t * t * p2.y;
                return y;
            }
        }
        return this.baseY;
    }
    
    getSlopeAt(x) {
        // 获取指定位置的坡度（使用贝塞尔曲线导数）
        for (let i = 0; i < this.points.length - 1; i++) {
            if (x >= this.points[i].x && x <= this.points[i + 1].x) {
                const p1 = this.points[i];
                const p2 = this.points[i + 1];
                
                // 计算贝塞尔曲线控制点
                const cp1x = p1.x + (p2.x - p1.x) / 3;
                const cp1y = p1.y + (p2.y - p1.y) / 3;
                const cp2x = p1.x + (p2.x - p1.x) * 2 / 3;
                const cp2y = p1.y + (p2.y - p1.y) * 2 / 3;
                
                // 计算t值
                const t = (x - p1.x) / (p2.x - p1.x);
                const oneMinusT = 1 - t;
                
                // 贝塞尔曲线的导数 dy/dx
                const dydt = 3 * oneMinusT * oneMinusT * (cp1y - p1.y) +
                            6 * oneMinusT * t * (cp2y - cp1y) +
                            3 * t * t * (p2.y - cp2y);
                const dxdt = 3 * oneMinusT * oneMinusT * (cp1x - p1.x) +
                            6 * oneMinusT * t * (cp2x - cp1x) +
                            3 * t * t * (p2.x - cp2x);
                
                return dxdt !== 0 ? dydt / dxdt : 0;
            }
        }
        return 0.2;
    }
    
    addSkiTrack(x, y) {
        this.skiTracks.push({ x, y, life: 1 });
    }
    
    draw(ctx) {
        ctx.save();
        
        // === 绘制纯白雪地（地形线以下） ===
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        
        // 使用纯白色填充雪地
        ctx.fillStyle = '#FFFFFF';
        
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        
        // 使用三次贝塞尔曲线绘制光滑的地形线
        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i];
            const p2 = this.points[i + 1];
            
            const cp1x = p1.x + (p2.x - p1.x) / 3;
            const cp1y = p1.y + (p2.y - p1.y) / 3;
            const cp2x = p1.x + (p2.x - p1.x) * 2 / 3;
            const cp2y = p1.y + (p2.y - p1.y) * 2 / 3;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
        
        // 封闭路径：从地形线向下填充到画布底部
        if (this.points.length > 0) {
            const lastPoint = this.points[this.points.length - 1];
            const firstPoint = this.points[0];
            
            // 从最后一个点垂直向下延伸到画布底部
            ctx.lineTo(lastPoint.x, CONFIG.canvas.height + 100);
            // 水平向左到第一个点的x坐标
            ctx.lineTo(firstPoint.x, CONFIG.canvas.height + 100);
            // 垂直向上回到第一个点
            ctx.lineTo(firstPoint.x, firstPoint.y);
        }
        ctx.closePath();
        ctx.fill();
        
        // === 绘制地形分界线（清晰的黑色线条）===
        ctx.save();
        ctx.strokeStyle = 'rgba(40, 40, 40, 0.9)'; // 深色线条，清晰可见
        ctx.lineWidth = 3; 
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 0; i < this.points.length - 1; i++) {
            const p1 = this.points[i];
            const p2 = this.points[i + 1];
            const cp1x = p1.x + (p2.x - p1.x) / 3;
            const cp1y = p1.y + (p2.y - p1.y) / 3;
            const cp2x = p1.x + (p2.x - p1.x) * 2 / 3;
            const cp2y = p1.y + (p2.y - p1.y) * 2 / 3;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
        ctx.stroke();
        ctx.restore();
        
        ctx.restore();
    }
}

// Obstacle Class
class Obstacle {
    constructor(x, y, type, terrain) {
        this.x = x;
        this.y = y; // 使用传入的y坐标
        this.type = type; // 'rock' or 'house'
        this.width = type === 'rock' ? 108 : 264; // 放大到120%
        this.height = type === 'rock' ? 90 : 216; // 放大到120%
        this.hit = false;
        this.rotation = 0; // 旋转角度
        this.terrain = terrain; // 保存地形引用
    }
    
    update(speed) {
        this.x -= speed;
        // 更新旋转角度以贴近坡面
        if (this.terrain) {
            const slope = this.terrain.getSlopeAt(this.x + this.width / 2);
            const targetRotation = Math.atan(slope);
            // 平滑过渡
            this.rotation += (targetRotation - this.rotation) * 0.1;
        }
    }
    
    draw(ctx) {
        ctx.save();
        // 应用旋转使障碍物贴近坡面
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);
        ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
        
        if (this.type === 'rock') {
            this.drawRock3D(ctx);
        } else {
            this.drawHouse3D(ctx);
        }
        
        ctx.restore();
    }
    
    drawRock3D(ctx) {
        ctx.save();
        
        // 圆滑石头阴影 - 椭圆形
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2 + 3, this.y + this.height + 5, this.width * 0.55, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 主体 - 使用椭圆形绘制圆滑的石头
        const mainGradient = ctx.createRadialGradient(
            this.x + this.width * 0.4, this.y + this.height * 0.35, this.width * 0.1,
            this.x + this.width / 2, this.y + this.height / 2, this.width * 0.6
        );
        mainGradient.addColorStop(0, '#B0B0B0');
        mainGradient.addColorStop(0.4, '#808080');
        mainGradient.addColorStop(0.7, '#606060');
        mainGradient.addColorStop(1, '#404040');
        
        ctx.fillStyle = mainGradient;
        ctx.beginPath();
        // 绘制圆滑的椭圆形石头
        ctx.ellipse(
            this.x + this.width / 2, 
            this.y + this.height * 0.55, 
            this.width * 0.48, 
            this.height * 0.52, 
            0, 0, Math.PI * 2
        );
        ctx.fill();
        
        // 添加一些圆滑的纹理细节
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width * 0.3, this.y + this.height * 0.4, this.width * 0.12, this.height * 0.1, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(this.x + this.width * 0.65, this.y + this.height * 0.6, this.width * 0.1, this.height * 0.08, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 高光效果 - 让石头看起来更圆滑
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width * 0.4, this.y + this.height * 0.35, this.width * 0.15, this.height * 0.12, -0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // 顶部白色积雪
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + 5);
        ctx.quadraticCurveTo(this.x + this.width * 0.6, this.y + 15, this.x + this.width * 0.7, this.y + 25);
        ctx.lineTo(this.x + this.width * 0.3, this.y + 25);
        ctx.quadraticCurveTo(this.x + this.width * 0.4, this.y + 15, this.x + this.width / 2, this.y + 5);
        ctx.closePath();
        ctx.fill();
        
        // 积雪阴影
        ctx.fillStyle = 'rgba(200, 220, 240, 0.8)';
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y + 5);
        ctx.quadraticCurveTo(this.x + this.width * 0.4, this.y + 15, this.x + this.width * 0.3, this.y + 25);
        ctx.lineTo(this.x + this.width * 0.35, this.y + 25);
        ctx.quadraticCurveTo(this.x + this.width * 0.42, this.y + 17, this.x + this.width / 2, this.y + 8);
        ctx.closePath();
        ctx.fill();
        
        // 积雪高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width * 0.55, this.y + 12, 8, 5, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 裂纹细节 - 增强质感
        ctx.strokeStyle = '#2A2A2A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width * 0.35, this.y + this.height * 0.3);
        ctx.lineTo(this.x + this.width * 0.45, this.y + this.height * 0.5);
        ctx.lineTo(this.x + this.width * 0.4, this.y + this.height * 0.65);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(this.x + this.width * 0.65, this.y + this.height * 0.4);
        ctx.lineTo(this.x + this.width * 0.6, this.y + this.height * 0.6);
        ctx.stroke();
        
        ctx.restore();
    }
    
    drawHouse3D(ctx) {
        ctx.save();
        
        // 强化小屋阴影 - 3D深度
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2 + 5, this.y + this.height + 10, this.width * 0.6, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 定义圆木参数（提前定义，供侧面纹理使用）
        const logHeight = 18;
        const numLogs = Math.floor((this.height - 30) / logHeight);
        
        // 小屋左侧面（增加深度）- 更暗
        const leftSideGradient = ctx.createLinearGradient(
            this.x, this.y + 30,
            this.x - 15, this.y + 30
        );
        leftSideGradient.addColorStop(0, '#4A2F1A');
        leftSideGradient.addColorStop(0.5, '#3A2515');
        leftSideGradient.addColorStop(1, '#2A1A10');
        ctx.fillStyle = leftSideGradient;
        
        ctx.beginPath();
        ctx.moveTo(this.x, this.y + 30);
        ctx.lineTo(this.x - 15, this.y + 35);
        ctx.lineTo(this.x - 15, this.y + this.height + 5);
        ctx.lineTo(this.x, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        
        // 左侧面轮廓
        ctx.strokeStyle = '#1A0A05';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 小屋右侧面（强化3D效果）- 稍亮
        const rightSideGradient = ctx.createLinearGradient(
            this.x + this.width, this.y + 30,
            this.x + this.width + 25, this.y + 30
        );
        rightSideGradient.addColorStop(0, '#5A3A1F');
        rightSideGradient.addColorStop(0.5, '#4A2F1A');
        rightSideGradient.addColorStop(1, '#3A2515');
        ctx.fillStyle = rightSideGradient;
        
        ctx.beginPath();
        ctx.moveTo(this.x + this.width, this.y + 30);
        ctx.lineTo(this.x + this.width + 25, this.y + 38);
        ctx.lineTo(this.x + this.width + 25, this.y + this.height + 8);
        ctx.lineTo(this.x + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();
        
        // 右侧面轮廓
        ctx.strokeStyle = '#2A1A10';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 右侧面圆木纹理（增加细节）
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < numLogs; i++) {
            const logY = this.y + 30 + i * 18;
            ctx.beginPath();
            ctx.moveTo(this.x + this.width, logY);
            ctx.lineTo(this.x + this.width + 25, logY + 8);
            ctx.stroke();
        }
        
        // 圆木墙体 - 横向堆叠的圆木
        for (let i = 0; i < numLogs; i++) {
            const logY = this.y + 30 + i * logHeight;
            
            // 圆木左侧面（3D效果）
            ctx.fillStyle = '#4A2F1A';
            ctx.beginPath();
            ctx.moveTo(this.x, logY);
            ctx.lineTo(this.x - 8, logY + 3);
            ctx.lineTo(this.x - 8, logY + logHeight - 2 + 3);
            ctx.lineTo(this.x, logY + logHeight - 2);
            ctx.closePath();
            ctx.fill();
            
            // 圆木右侧面（3D效果）
            ctx.fillStyle = '#3A2515';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width, logY);
            ctx.lineTo(this.x + this.width + 10, logY + 4);
            ctx.lineTo(this.x + this.width + 10, logY + logHeight - 2 + 4);
            ctx.lineTo(this.x + this.width, logY + logHeight - 2);
            ctx.closePath();
            ctx.fill();
            
            // 圆木主体渐变（正面）
            const logGradient = ctx.createLinearGradient(
                this.x, logY,
                this.x + this.width, logY
            );
            logGradient.addColorStop(0, '#6B4423');
            logGradient.addColorStop(0.2, '#8B5A3C');
            logGradient.addColorStop(0.5, '#9B6A4C');
            logGradient.addColorStop(0.8, '#7A4A2C');
            logGradient.addColorStop(1, '#5A3A1C');
            ctx.fillStyle = logGradient;
            
            // 绘制圆木正面（圆角矩形）
            ctx.beginPath();
            ctx.roundRect(this.x, logY, this.width, logHeight - 2, [8, 8, 8, 8]);
            ctx.fill();
            
            // 圆木顶部高光（增强立体感）
            const topHighlight = ctx.createLinearGradient(
                this.x, logY,
                this.x, logY + logHeight * 0.4
            );
            topHighlight.addColorStop(0, 'rgba(180, 140, 100, 0.7)');
            topHighlight.addColorStop(1, 'rgba(139, 90, 60, 0)');
            ctx.fillStyle = topHighlight;
            ctx.beginPath();
            ctx.roundRect(this.x, logY, this.width, logHeight * 0.4, [8, 8, 0, 0]);
            ctx.fill();
            
            // 圆木底部阴影（增强深度）
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(this.x, logY + logHeight - 4, this.width, 4);
            
            // 圆木两端的年轮（左右两侧）
            // 左侧年轮
            ctx.fillStyle = '#5A3A1C';
            ctx.beginPath();
            ctx.ellipse(this.x + 12, logY + logHeight / 2, 10, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#6B4423';
            ctx.beginPath();
            ctx.ellipse(this.x + 12, logY + logHeight / 2, 7, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#7A4A2C';
            ctx.beginPath();
            ctx.ellipse(this.x + 12, logY + logHeight / 2, 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // 右侧年轮
            ctx.fillStyle = '#5A3A1C';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width - 12, logY + logHeight / 2, 10, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#6B4423';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width - 12, logY + logHeight / 2, 7, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#7A4A2C';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width - 12, logY + logHeight / 2, 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 屋顶侧面 - 强化阴影
        const roofSideGradient = ctx.createLinearGradient(
            this.x + this.width, this.y + 15,
            this.x + this.width + 20, this.y + 35
        );
        roofSideGradient.addColorStop(0, '#6A3A1A');
        roofSideGradient.addColorStop(0.5, '#5A2F15');
        roofSideGradient.addColorStop(1, '#4A2510');
        ctx.fillStyle = roofSideGradient;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width + 15, this.y + 30);
        ctx.lineTo(this.x + this.width + 20, this.y + 38);
        ctx.lineTo(this.x + this.width / 2 + 12, this.y + 8);
        ctx.closePath();
        ctx.fill();
        
        // 屋顶侧面轮廓
        ctx.strokeStyle = '#3A1A0A';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 屋顶正面左侧（暗部）
        const roofLeftGradient = ctx.createLinearGradient(
            this.x, this.y + 30,
            this.x + this.width / 2, this.y
        );
        roofLeftGradient.addColorStop(0, '#7A4A2A');
        roofLeftGradient.addColorStop(0.5, '#8B4513');
        roofLeftGradient.addColorStop(1, '#9A5523');
        ctx.fillStyle = roofLeftGradient;
        
        ctx.beginPath();
        ctx.moveTo(this.x - 10, this.y + 30);
        ctx.lineTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width / 2, this.y + 30);
        ctx.closePath();
        ctx.fill();
        
        // 屋顶正面右侧（亮部）
        const roofRightGradient = ctx.createLinearGradient(
            this.x + this.width / 2, this.y,
            this.x + this.width + 15, this.y + 30
        );
        roofRightGradient.addColorStop(0, '#B0622D');
        roofRightGradient.addColorStop(0.5, '#A0522D');
        roofRightGradient.addColorStop(1, '#8B4513');
        ctx.fillStyle = roofRightGradient;
        
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width + 15, this.y + 30);
        ctx.lineTo(this.x + this.width / 2, this.y + 30);
        ctx.closePath();
        ctx.fill();
        
        // 屋顶轮廓
        ctx.strokeStyle = '#5A2F15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x - 10, this.y + 30);
        ctx.lineTo(this.x + this.width / 2, this.y);
        ctx.lineTo(this.x + this.width + 15, this.y + 30);
        ctx.stroke();
        
        // 屋顶瓦片纹理
        ctx.strokeStyle = 'rgba(101, 67, 33, 0.4)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(this.x - 5 + i * 15, this.y + 20 + i * 5);
            ctx.lineTo(this.x + this.width / 2, this.y + 10);
            ctx.stroke();
        }
        
        // 屋顶厚厚的积雪 - 3D效果
        const snowGradient = ctx.createLinearGradient(
            this.x + this.width / 2, this.y - 5,
            this.x + this.width / 2, this.y + 15
        );
        snowGradient.addColorStop(0, '#FFFFFF');
        snowGradient.addColorStop(0.5, '#F5F5F5');
        snowGradient.addColorStop(1, '#E0E0E0');
        ctx.fillStyle = snowGradient;
        
        // 厚厚的积雪层
        ctx.beginPath();
        ctx.moveTo(this.x - 12, this.y + 30);
        ctx.quadraticCurveTo(this.x, this.y + 25, this.x + 10, this.y + 20);
        ctx.quadraticCurveTo(this.x + this.width / 2 - 20, this.y + 5, this.x + this.width / 2, this.y - 5);
        ctx.quadraticCurveTo(this.x + this.width / 2 + 20, this.y + 5, this.x + this.width - 10, this.y + 20);
        ctx.quadraticCurveTo(this.x + this.width, this.y + 25, this.x + this.width + 12, this.y + 30);
        ctx.lineTo(this.x + this.width + 10, this.y + 33);
        ctx.lineTo(this.x - 10, this.y + 33);
        ctx.closePath();
        ctx.fill();
        
        // 积雪阴影（左侧）
        ctx.fillStyle = 'rgba(200, 220, 240, 0.7)';
        ctx.beginPath();
        ctx.moveTo(this.x - 12, this.y + 30);
        ctx.quadraticCurveTo(this.x, this.y + 25, this.x + 10, this.y + 20);
        ctx.quadraticCurveTo(this.x + this.width / 2 - 20, this.y + 5, this.x + this.width / 2, this.y - 5);
        ctx.lineTo(this.x + this.width / 2, this.y + 30);
        ctx.lineTo(this.x - 10, this.y + 33);
        ctx.closePath();
        ctx.fill();
        
        // 积雪高光（顶部）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.ellipse(this.x + this.width / 2, this.y, 30, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 积雪边缘滴落效果
        for (let i = 0; i < 5; i++) {
            const dropX = this.x + 20 + i * (this.width - 40) / 4;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.moveTo(dropX, this.y + 30);
            ctx.quadraticCurveTo(dropX - 3, this.y + 35, dropX, this.y + 38);
            ctx.quadraticCurveTo(dropX + 3, this.y + 35, dropX, this.y + 30);
            ctx.closePath();
            ctx.fill();
        }
        
        // 前门（左侧）- 完全打开状态，门高度比人类高
        const doorHeight = 45; // 更高的门，确保人物可以轻松通过
        const doorWidth = 38;
        const doorY = this.y + this.height - doorHeight;
        
        // 门框（深色边框，中间是空的）
        ctx.strokeStyle = '#2A1A10';
        ctx.lineWidth = 4;
        ctx.strokeRect(this.x + 16, doorY, doorWidth, doorHeight);
        
        // 门框内侧阴影（增加深度感）
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x + 18, doorY + 2, doorWidth - 4, doorHeight - 4);
        
        // 打开的门（向左侧完全打开）
        ctx.save();
        // 门的旋转中心在门框左侧
        ctx.translate(this.x + 16, doorY);
        
        // 门板（打开约90度，完全打开）
        const doorOpenAngle = -Math.PI * 0.5; // 90度，完全打开
        ctx.rotate(doorOpenAngle);
        
        // 门板渐变
        const frontDoorGradient = ctx.createLinearGradient(0, 0, 0, doorHeight);
        frontDoorGradient.addColorStop(0, '#6A4A2F');
        frontDoorGradient.addColorStop(0.5, '#5A3A1F');
        frontDoorGradient.addColorStop(1, '#4A2F1A');
        ctx.fillStyle = frontDoorGradient;
        ctx.fillRect(0, 0, doorWidth, doorHeight);
        
        // 门板边框
        ctx.strokeStyle = '#3A2515';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, doorWidth, doorHeight);
        
        // 门把手
        ctx.fillStyle = '#B8860B';
        ctx.beginPath();
        ctx.arc(doorWidth - 5, doorHeight / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 前门板木纹
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(2, 5 + i * 10);
            ctx.lineTo(doorWidth - 2, 5 + i * 10);
            ctx.stroke();
        }
        
        ctx.restore(); // 恢复前门旋转
        
        // 后门（右侧）- 完全打开状态，门高度比人类高
        const backDoorX = this.x + this.width - 16 - doorWidth;
        
        // 后门框（深色边框，中间是空的）
        ctx.strokeStyle = '#2A1A10';
        ctx.lineWidth = 4;
        ctx.strokeRect(backDoorX, doorY, doorWidth, doorHeight);
        
        // 后门框内侧阴影（增加深度感）
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.strokeRect(backDoorX + 2, doorY + 2, doorWidth - 4, doorHeight - 4);
        
        // 打开的门（向右侧完全打开）
        ctx.save();
        // 门的旋转中心在门框右侧
        ctx.translate(backDoorX + doorWidth, doorY);
        
        // 门板（打开约90度，完全打开，向右）
        const backDoorOpenAngle = Math.PI * 0.5; // 90度，完全打开
        ctx.rotate(backDoorOpenAngle);
        
        // 后门板渐变
        const backDoorGradient = ctx.createLinearGradient(0, 0, 0, doorHeight);
        backDoorGradient.addColorStop(0, '#6A4A2F');
        backDoorGradient.addColorStop(0.5, '#5A3A1F');
        backDoorGradient.addColorStop(1, '#4A2F1A');
        ctx.fillStyle = backDoorGradient;
        ctx.fillRect(-doorWidth, 0, doorWidth, doorHeight);
        
        // 后门板边框
        ctx.strokeStyle = '#3A2515';
        ctx.lineWidth = 2;
        ctx.strokeRect(-doorWidth, 0, doorWidth, doorHeight);
        
        // 后门把手
        ctx.fillStyle = '#B8860B';
        ctx.beginPath();
        ctx.arc(-doorWidth + 5, doorHeight / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 后门板木纹
        ctx.strokeStyle = 'rgba(80, 50, 30, 0.4)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-doorWidth + 2, 5 + i * 10);
            ctx.lineTo(-2, 5 + i * 10);
            ctx.stroke();
        }
        
        ctx.restore(); // 恢复后门旋转
        
        // 格子窗户 - 3x3格子（在两门中间）
        const windowX = this.x + this.width / 2 - 20;
        const windowY = this.y + 80;
        const windowWidth = 40;
        const windowHeight = 35;
        
        // 窗户外框
        ctx.fillStyle = '#4A2F1A';
        ctx.fillRect(windowX - 2, windowY - 2, windowWidth + 4, windowHeight + 4);
        
        // 窗户背景（深色）
        ctx.fillStyle = '#2A1A10';
        ctx.fillRect(windowX, windowY, windowWidth, windowHeight);
        
        // 窗户玻璃反光（整体）
        const windowGradient = ctx.createLinearGradient(
            windowX, windowY,
            windowX + windowWidth, windowY + windowHeight
        );
        windowGradient.addColorStop(0, 'rgba(100, 150, 200, 0.4)');
        windowGradient.addColorStop(0.5, 'rgba(80, 120, 180, 0.3)');
        windowGradient.addColorStop(1, 'rgba(60, 100, 160, 0.2)');
        ctx.fillStyle = windowGradient;
        ctx.fillRect(windowX, windowY, windowWidth, windowHeight);
        
        // 绘制3x3格子
        const gridSize = 3;
        const cellWidth = windowWidth / gridSize;
        const cellHeight = windowHeight / gridSize;
        
        ctx.strokeStyle = '#4A2F1A';
        ctx.lineWidth = 2;
        
        // 垂直线
        for (let i = 1; i < gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(windowX + i * cellWidth, windowY);
            ctx.lineTo(windowX + i * cellWidth, windowY + windowHeight);
            ctx.stroke();
        }
        
        // 水平线
        for (let i = 1; i < gridSize; i++) {
            ctx.beginPath();
            ctx.moveTo(windowX, windowY + i * cellHeight);
            ctx.lineTo(windowX + windowWidth, windowY + i * cellHeight);
            ctx.stroke();
        }
        
        // 窗户外框轮廓
        ctx.strokeStyle = '#3A2010';
        ctx.lineWidth = 3;
        ctx.strokeRect(windowX - 2, windowY - 2, windowWidth + 4, windowHeight + 4);
        
        // 窗户玻璃高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(windowX + windowWidth * 0.3, windowY + windowHeight * 0.3, 8, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}
class Animal {
    constructor(x, y, type, terrain) {
        this.x = x;
        this.type = type; // 'penguin', 'snowman', 'snowmobile' or 'polarbear'
        // 设置尺寸：企鹅较小，雪人较大，白熊大，雪地摩托最大
        if (type === 'penguin') {
            this.width = 90;
            this.height = 60;
        } else if (type === 'snowman') {
            this.width = 100;
            this.height = 70;
        } else if (type === 'polarbear') {
            this.width = 130;
            this.height = 90;
        } else if (type === 'snowmobile') {
            this.width = 120;
            this.height = 80;
        }
        this.terrain = terrain; // 保存地形引用
        this.y = y - this.height; // 底部对齐地面
        this.caught = false;
        this.slideWobble = 0; // 滑行摆动
        this.slideSpeed = 0.15; // 滑行摆动速度
        this.rotation = 0; // 旋转角度（贴合坡度）
        this.slideParticles = []; // 滑行粒子效果
        this.excitement = 0; // 兴奋度（影响表情）
    }
    
    update(speed) {
        // 动物滑行速度比人物慢（人物速度的60%）
        const animalSpeed = speed * 0.6;
        this.x -= animalSpeed;
        
        // 动态更新Y坐标，贴近地形
        if (this.terrain) {
            const groundY = this.terrain.getHeightAt(this.x + this.width / 2);
            this.y = groundY - this.height;
            
            // 获取坡度，让动物贴合坡面
            const slope = this.terrain.getSlopeAt(this.x + this.width / 2);
            this.rotation = Math.atan(slope);
            
            // 根据坡度更新兴奋度（下坡更兴奋）
            this.excitement = Math.max(0, slope * 2);
        }
        
        // 更新滑行摆动动画（左右轻微摆动）
        this.slideWobble += this.slideSpeed;
        if (this.slideWobble > Math.PI * 2) {
            this.slideWobble = 0;
        }
        
        // 生成滑行粒子（雪花飞溅）
        if (Math.random() < 0.3) {
            this.slideParticles.push({
                x: this.x - 10 + Math.random() * 20,
                y: this.y + this.height - 5,
                vx: Math.random() * 2 - 4,
                vy: Math.random() * -3 - 1,
                life: 1,
                size: Math.random() * 3 + 1
            });
        }
        
        // 更新粒子
        this.slideParticles = this.slideParticles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // 重力
            p.life -= 0.03;
            return p.life > 0;
        });
    }
    
    draw(ctx) {
        // 滑行时的轻微上下摆动（模拟肚皮滑行的颠簸）
        const wobbleY = Math.sin(this.slideWobble) * 2;
        
        // 先绘制滑行粒子（在动物下方）
        this.drawSlideParticles(ctx);
        
        ctx.save();
        
        // 应用旋转，让动物贴合坡面
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.rotation);
        ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
        
        if (this.type === 'penguin') {
            this.drawSlidingPenguin(ctx, wobbleY);
        } else if (this.type === 'snowman') {
            this.drawSlidingSnowman(ctx, wobbleY);
        } else if (this.type === 'snowmobile') {
            this.drawSnowmobile(ctx, wobbleY);
        } else {
            this.drawPolarBear3D(ctx, wobbleY);
        }
        
        ctx.restore();
    }
    
    drawSlideParticles(ctx) {
        // 绘制滑行产生的雪花飞溅效果
        ctx.save();
        this.slideParticles.forEach(p => {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            
            // 添加轻微发光
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.restore();
    }
    
    drawSlidingPenguin(ctx, wobbleY) {
        // 绘制可爱的肚皮滑行企鹅
        ctx.save();
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2 + wobbleY;
        
        // 企鹅阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(centerX + 2, this.y + this.height + 2, this.width * 0.42, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 身体部分 ===
        // 黑色背部（上层）
        const backGradient = ctx.createRadialGradient(
            centerX - 5, centerY - 8, 8,
            centerX, centerY - 3, 28
        );
        backGradient.addColorStop(0, '#3A3A3A');
        backGradient.addColorStop(0.5, '#2A2A2A');
        backGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = backGradient;
        ctx.beginPath();
        ctx.ellipse(centerX - 2, centerY - 3, 36, 24, 0, Math.PI, 0);
        ctx.fill();
        
        // 白色肚皮（下层）
        const bellyGradient = ctx.createRadialGradient(
            centerX + 5, centerY + 3, 5,
            centerX + 2, centerY + 5, 25
        );
        bellyGradient.addColorStop(0, '#FFFFFF');
        bellyGradient.addColorStop(0.7, '#F5F5F5');
        bellyGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = bellyGradient;
        ctx.beginPath();
        ctx.ellipse(centerX + 2, centerY + 5, 32, 20, 0, 0, Math.PI);
        ctx.fill();
        
        // === 翅膀 ===
        // 左翅膀（上方）
        const wingGradient1 = ctx.createLinearGradient(centerX - 25, centerY - 12, centerX - 10, centerY - 8);
        wingGradient1.addColorStop(0, '#2A2A2A');
        wingGradient1.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = wingGradient1;
        ctx.beginPath();
        ctx.ellipse(centerX - 15, centerY - 8, 18, 7, -0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // 右翅膀（下方）
        const wingGradient2 = ctx.createLinearGradient(centerX - 25, centerY + 8, centerX - 10, centerY + 12);
        wingGradient2.addColorStop(0, '#2A2A2A');
        wingGradient2.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = wingGradient2;
        ctx.beginPath();
        ctx.ellipse(centerX - 15, centerY + 8, 18, 7, 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // === 头部 ===
        // 黑色头部
        const headGradient = ctx.createRadialGradient(
            centerX + 28, centerY - 8, 5,
            centerX + 30, centerY - 5, 14
        );
        headGradient.addColorStop(0, '#3A3A3A');
        headGradient.addColorStop(0.6, '#2A2A2A');
        headGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.ellipse(centerX + 32, centerY - 4, 14, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 白色脸颊
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(centerX + 34, centerY - 2, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 可爱的粉色腮红
        ctx.fillStyle = 'rgba(255, 182, 193, 0.4)';
        ctx.beginPath();
        ctx.ellipse(centerX + 36, centerY + 1, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 可爱的大眼睛 ===
        const eyeSize = 3.5 + this.excitement * 0.8;
        // 眼白
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX + 33, centerY - 5, eyeSize + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 33, centerY + 1, eyeSize + 1, 0, Math.PI * 2);
        ctx.fill();
        
        // 黑色眼珠
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX + 34, centerY - 5, eyeSize * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 34, centerY + 1, eyeSize * 0.7, 0, Math.PI * 2);
        ctx.fill();
        
        // 眼睛高光（让眼睛更有神）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(centerX + 35, centerY - 6, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 35, centerY, 1.2, 0, Math.PI * 2);
        ctx.fill();
        
        // === 可爱的嘴巴 ===
        const mouthOpen = this.excitement > 0.5 ? 3 : 1;
        // 橙色嘴巴（更圆润）
        ctx.fillStyle = '#FF9500';
        ctx.beginPath();
        ctx.moveTo(centerX + 40, centerY - 1);
        ctx.quadraticCurveTo(centerX + 44, centerY - 2 - mouthOpen, centerX + 47, centerY - 1);
        ctx.quadraticCurveTo(centerX + 44, centerY + mouthOpen, centerX + 40, centerY - 1);
        ctx.closePath();
        ctx.fill();
        
        // 嘴巴高光
        ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
        ctx.beginPath();
        ctx.ellipse(centerX + 43, centerY - 1.5, 2, 1, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 橙色小脚 ===
        // 上脚
        const footGradient1 = ctx.createRadialGradient(centerX - 22, centerY - 6, 2, centerX - 20, centerY - 5, 8);
        footGradient1.addColorStop(0, '#FFA500');
        footGradient1.addColorStop(1, '#FF8C00');
        ctx.fillStyle = footGradient1;
        ctx.beginPath();
        ctx.ellipse(centerX - 20, centerY - 5, 10, 5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // 下脚
        const footGradient2 = ctx.createRadialGradient(centerX - 22, centerY + 4, 2, centerX - 20, centerY + 5, 8);
        footGradient2.addColorStop(0, '#FFA500');
        footGradient2.addColorStop(1, '#FF8C00');
        ctx.fillStyle = footGradient2;
        ctx.beginPath();
        ctx.ellipse(centerX - 20, centerY + 5, 10, 5, 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // 滑行轨迹线（白色痕迹）
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - 35, centerY);
        ctx.lineTo(centerX - 50, centerY);
        ctx.stroke();
        
        ctx.restore();
    }
    
    drawSlidingSnowman(ctx, wobbleY) {
        // 绘制可爱的肚皮滑行雪人
        ctx.save();
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2 + wobbleY;
        
        // 雪人阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(centerX + 2, this.y + this.height + 2, this.width * 0.45, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 底部雪球（最大）===
        const bottomGradient = ctx.createRadialGradient(
            centerX - 18, centerY + 3, 8,
            centerX - 12, centerY + 8, 30
        );
        bottomGradient.addColorStop(0, '#FFFFFF');
        bottomGradient.addColorStop(0.6, '#F8F8F8');
        bottomGradient.addColorStop(1, '#E0E0E0');
        ctx.fillStyle = bottomGradient;
        ctx.beginPath();
        ctx.ellipse(centerX - 12, centerY + 8, 30, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 底部雪球高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(centerX - 20, centerY + 2, 8, 6, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // === 中间雪球 ===
        const middleGradient = ctx.createRadialGradient(
            centerX + 3, centerY - 4, 6,
            centerX + 6, centerY, 24
        );
        middleGradient.addColorStop(0, '#FFFFFF');
        middleGradient.addColorStop(0.6, '#F8F8F8');
        middleGradient.addColorStop(1, '#E0E0E0');
        ctx.fillStyle = middleGradient;
        ctx.beginPath();
        ctx.ellipse(centerX + 6, centerY, 24, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 中间雪球高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY - 6, 7, 5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // === 头部雪球 ===
        const headGradient = ctx.createRadialGradient(
            centerX + 23, centerY - 10, 4,
            centerX + 26, centerY - 6, 16
        );
        headGradient.addColorStop(0, '#FFFFFF');
        headGradient.addColorStop(0.6, '#F8F8F8');
        headGradient.addColorStop(1, '#E0E0E0');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.ellipse(centerX + 28, centerY - 5, 15, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 头部高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.ellipse(centerX + 22, centerY - 10, 5, 4, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // === 可爱的胡萝卜鼻子 ===
        const noseGradient = ctx.createLinearGradient(centerX + 36, centerY - 6, centerX + 43, centerY - 4);
        noseGradient.addColorStop(0, '#FFA500');
        noseGradient.addColorStop(1, '#FF8C00');
        ctx.fillStyle = noseGradient;
        ctx.beginPath();
        ctx.moveTo(centerX + 36, centerY - 5);
        ctx.lineTo(centerX + 43, centerY - 4);
        ctx.lineTo(centerX + 36, centerY - 3);
        ctx.closePath();
        ctx.fill();
        
        // 鼻子纹理
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.5)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(centerX + 38, centerY - 4.5);
        ctx.lineTo(centerX + 41, centerY - 4);
        ctx.stroke();
        
        // === 可爱的大眼睛（煤球）===
        const eyeSize = 2.5 + this.excitement * 0.5;
        // 眼睛外圈（煤球质感）
        ctx.fillStyle = '#1A1A1A';
        ctx.beginPath();
        ctx.arc(centerX + 28, centerY - 10, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 28, centerY - 2, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        
        // 眼睛高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(centerX + 29, centerY - 11, 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 29, centerY - 3, 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // === 可爱的微笑（煤球）===
        const smilePoints = 5;
        ctx.fillStyle = '#1A1A1A';
        for (let i = 0; i < smilePoints; i++) {
            const angle = (Math.PI / 8) * (i - 2);
            const smileX = centerX + 30 + Math.sin(angle) * 7;
            const smileY = centerY + 3 + Math.cos(angle) * 2.5;
            ctx.beginPath();
            ctx.arc(smileX, smileY, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 围巾（飘扬效果）
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(centerX + 15, centerY - 2, 20, 4);
        // 围巾末端（向后飘）
        ctx.fillRect(centerX - 5, centerY - 2, 8, 3);
        ctx.fillRect(centerX - 10, centerY + 1, 6, 2);
        
        // 滑行轨迹线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX - 38, centerY + 8);
        ctx.lineTo(centerX - 55, centerY + 8);
        ctx.stroke();
        
        ctx.restore();
    }
    
    drawPenguin3D(ctx, bounceY) {
        ctx.save();
        const centerX = this.x + this.width / 2;
        const centerY = this.y + bounceY + 20;
        
        // 企鹅阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(centerX, this.y + 45, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 企鹅脚 - 奔跑动画
        ctx.fillStyle = '#FFA500';
        // 左脚
        const leftFootOffset = Math.sin(this.runCycle) * 3;
        ctx.beginPath();
        ctx.ellipse(centerX - 8, centerY + 18 + leftFootOffset, 5, 7, 0.3, 0, Math.PI * 2);
        ctx.fill();
        // 右脚
        const rightFootOffset = Math.sin(this.runCycle + Math.PI) * 3;
        ctx.beginPath();
        ctx.ellipse(centerX + 8, centerY + 18 + rightFootOffset, 5, 7, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        // 企鹅身体 - 3D渐变
        const bodyGradient = ctx.createRadialGradient(
            centerX - 5, centerY - 5, 5,
            centerX, centerY, 20
        );
        bodyGradient.addColorStop(0, '#1A1A1A');
        bodyGradient.addColorStop(1, '#000000');
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, 15, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 企鹅身体轮廓
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // 企鹅肚子 - 3D效果
        const bellyGradient = ctx.createRadialGradient(
            centerX - 3, centerY, 5,
            centerX, centerY + 2, 15
        );
        bellyGradient.addColorStop(0, '#FFFFFF');
        bellyGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = bellyGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY + 2, 10, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 翅膀 - 3D效果
        ctx.fillStyle = '#000000';
        // 左翅膀
        ctx.beginPath();
        ctx.ellipse(centerX - 14, centerY + 5, 5, 12, -0.5, 0, Math.PI * 2);
        ctx.fill();
        // 右翅膀
        ctx.beginPath();
        ctx.ellipse(centerX + 14, centerY + 5, 5, 12, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 翅膀高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.ellipse(centerX - 14, centerY + 2, 3, 6, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + 14, centerY + 2, 3, 6, 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 眼睛白色部分
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(centerX - 5, centerY - 8, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + 5, centerY - 8, 5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 眼珠
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX - 5, centerY - 7, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 5, centerY - 7, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 眼睛高光
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX - 4, centerY - 8, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 6, centerY - 8, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 嘴巴 - 3D效果
        const beakGradient = ctx.createLinearGradient(
            centerX, centerY - 2,
            centerX, centerY + 2
        );
        beakGradient.addColorStop(0, '#FFB84D');
        beakGradient.addColorStop(1, '#FF8C00');
        ctx.fillStyle = beakGradient;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 2);
        ctx.lineTo(centerX - 4, centerY + 2);
        ctx.lineTo(centerX + 4, centerY + 2);
        ctx.closePath();
        ctx.fill();
        
        // 嘴巴轮廓
        ctx.strokeStyle = '#CC7000';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
    }
    
    drawSnowman3D(ctx, bounceY) {
        // 绘制可爱的3D雪人
        ctx.save();
        const centerX = this.x + this.width / 2;
        const centerY = this.y + bounceY + 30;
        
        // 雪人阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(centerX, this.y + this.height + 5, this.width * 0.4, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 底部雪球（最大）
        const bottomGradient = ctx.createRadialGradient(
            centerX - 10, centerY + 25, 5,
            centerX, centerY + 30, 30
        );
        bottomGradient.addColorStop(0, '#FFFFFF');
        bottomGradient.addColorStop(0.7, '#F0F0F0');
        bottomGradient.addColorStop(1, '#D0D0D0');
        ctx.fillStyle = bottomGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY + 30, 30, 0, Math.PI * 2);
        ctx.fill();
        
        // 中间雪球
        const middleGradient = ctx.createRadialGradient(
            centerX - 8, centerY, 5,
            centerX, centerY + 5, 22
        );
        middleGradient.addColorStop(0, '#FFFFFF');
        middleGradient.addColorStop(0.7, '#F0F0F0');
        middleGradient.addColorStop(1, '#D0D0D0');
        ctx.fillStyle = middleGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY + 5, 22, 0, Math.PI * 2);
        ctx.fill();
        
        // 头部雪球（最小）
        const headGradient = ctx.createRadialGradient(
            centerX - 6, centerY - 20, 3,
            centerX, centerY - 18, 16
        );
        headGradient.addColorStop(0, '#FFFFFF');
        headGradient.addColorStop(0.7, '#F0F0F0');
        headGradient.addColorStop(1, '#D0D0D0');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY - 18, 16, 0, Math.PI * 2);
        ctx.fill();
        
        // 胡萝卜鼻子
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 18);
        ctx.lineTo(centerX + 12, centerY - 16);
        ctx.lineTo(centerX, centerY - 14);
        ctx.closePath();
        ctx.fill();
        
        // 眼睛（黑色煤球）
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX - 5, centerY - 22, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 5, centerY - 22, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 微笑（煤球）
        ctx.fillStyle = '#000000';
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI / 6) * (i - 2);
            const smileX = centerX + Math.sin(angle) * 8;
            const smileY = centerY - 12 + Math.cos(angle) * 3;
            ctx.beginPath();
            ctx.arc(smileX, smileY, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 纽扣（煤球）
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX, centerY + 2, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY + 10, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 围巾
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(centerX - 18, centerY - 8, 36, 6);
        // 围巾末端
        ctx.fillRect(centerX + 12, centerY - 8, 4, 15);
        ctx.fillRect(centerX + 16, centerY + 5, 3, 8);
        
        ctx.restore();
    }
    
    drawSnowmobile(ctx, wobbleY) {
        // 绘制超精美现代雪地摩托（静止状态）
        ctx.save();
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        
        // 大阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(centerX, this.y + this.height + 8, this.width * 0.7, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 后履带（真实感）===
        // 履带外壳 - 立体渐变
        const trackGradient = ctx.createLinearGradient(centerX - 50, centerY + 18, centerX - 50, centerY + 38);
        trackGradient.addColorStop(0, '#3A3A3A');
        trackGradient.addColorStop(0.5, '#2A2A2A');
        trackGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = trackGradient;
        ctx.fillRect(centerX - 50, centerY + 18, 55, 20);
        
        // 履带边框
        ctx.strokeStyle = '#4A4A4A';
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - 50, centerY + 18, 55, 20);
        
        // 履带纹理（更密集）
        ctx.strokeStyle = '#5A5A5A';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(centerX - 50 + i * 7, centerY + 18);
            ctx.lineTo(centerX - 50 + i * 7, centerY + 38);
            ctx.stroke();
        }
        
        // 履带轮（前后两个）
        const wheelGradient = ctx.createRadialGradient(centerX - 40, centerY + 28, 3, centerX - 40, centerY + 28, 10);
        wheelGradient.addColorStop(0, '#4A4A4A');
        wheelGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = wheelGradient;
        ctx.beginPath();
        ctx.arc(centerX - 40, centerY + 28, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#5A5A5A';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(centerX - 10, centerY + 28, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // === 车身底盘 ===
        ctx.fillStyle = '#2A2A2A';
        ctx.fillRect(centerX - 45, centerY + 12, 90, 8);
        
        // === 主车身（现代流线型）===
        // 后部车身
        const rearBodyGradient = ctx.createLinearGradient(centerX - 45, centerY - 25, centerX - 45, centerY + 10);
        rearBodyGradient.addColorStop(0, '#FF1744');
        rearBodyGradient.addColorStop(0.5, '#D50000');
        rearBodyGradient.addColorStop(1, '#B71C1C');
        ctx.fillStyle = rearBodyGradient;
        ctx.beginPath();
        ctx.moveTo(centerX - 45, centerY + 10);
        ctx.lineTo(centerX - 45, centerY - 5);
        ctx.quadraticCurveTo(centerX - 45, centerY - 25, centerX - 25, centerY - 28);
        ctx.lineTo(centerX + 10, centerY - 28);
        ctx.lineTo(centerX + 10, centerY + 10);
        ctx.closePath();
        ctx.fill();
        
        // 车身高光（强烈）
        const highlightGradient = ctx.createLinearGradient(centerX - 40, centerY - 25, centerX - 40, centerY - 15);
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlightGradient;
        ctx.fillRect(centerX - 40, centerY - 25, 45, 10);
        
        // 前部车身（引擎罩）
        const frontBodyGradient = ctx.createLinearGradient(centerX + 10, centerY - 20, centerX + 10, centerY + 10);
        frontBodyGradient.addColorStop(0, '#1A1A1A');
        frontBodyGradient.addColorStop(0.5, '#2A2A2A');
        frontBodyGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = frontBodyGradient;
        ctx.beginPath();
        ctx.moveTo(centerX + 10, centerY + 10);
        ctx.lineTo(centerX + 10, centerY - 20);
        ctx.lineTo(centerX + 55, centerY - 18);
        ctx.lineTo(centerX + 60, centerY - 10);
        ctx.lineTo(centerX + 60, centerY + 10);
        ctx.closePath();
        ctx.fill();
        
        // 引擎罩高光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(centerX + 15, centerY - 18, 35, 6);
        
        // 金色装饰条（更粗更明显）
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(centerX - 40, centerY - 10);
        ctx.lineTo(centerX + 55, centerY - 10);
        ctx.stroke();
        
        // 黑色分割线
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX + 10, centerY - 28);
        ctx.lineTo(centerX + 10, centerY + 10);
        ctx.stroke();
        
        // === 座椅（运动型）===
        const seatGradient = ctx.createRadialGradient(centerX - 5, centerY - 30, 5, centerX - 5, centerY - 25, 30);
        seatGradient.addColorStop(0, '#4A4A4A');
        seatGradient.addColorStop(0.7, '#2A2A2A');
        seatGradient.addColorStop(1, '#1A1A1A');
        ctx.fillStyle = seatGradient;
        ctx.beginPath();
        ctx.ellipse(centerX - 5, centerY - 25, 32, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 座椅边框
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // 座椅缝线（菱形图案）
        ctx.strokeStyle = '#3A3A3A';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(centerX - 25 + i * 12, centerY - 30);
            ctx.lineTo(centerX - 25 + i * 12, centerY - 20);
            ctx.stroke();
        }
        
        // === 前挡风玻璃（运动型）===
        const windshieldGradient = ctx.createLinearGradient(centerX + 25, centerY - 35, centerX + 55, centerY - 15);
        windshieldGradient.addColorStop(0, 'rgba(0, 150, 255, 0.9)');
        windshieldGradient.addColorStop(0.5, 'rgba(0, 200, 255, 0.6)');
        windshieldGradient.addColorStop(1, 'rgba(100, 220, 255, 0.3)');
        ctx.fillStyle = windshieldGradient;
        ctx.beginPath();
        ctx.moveTo(centerX + 25, centerY - 20);
        ctx.lineTo(centerX + 55, centerY - 35);
        ctx.lineTo(centerX + 58, centerY - 12);
        ctx.lineTo(centerX + 30, centerY - 15);
        ctx.closePath();
        ctx.fill();
        
        // 玻璃边框（黑色）
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        // 玻璃反光
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(centerX + 30, centerY - 22);
        ctx.lineTo(centerX + 48, centerY - 32);
        ctx.lineTo(centerX + 50, centerY - 28);
        ctx.lineTo(centerX + 32, centerY - 18);
        ctx.closePath();
        ctx.fill();
        
        // === 前滑板（运动型）===
        const skiGradient = ctx.createLinearGradient(centerX + 35, centerY + 20, centerX + 35, centerY + 35);
        skiGradient.addColorStop(0, '#6A6A6A');
        skiGradient.addColorStop(0.5, '#4A4A4A');
        skiGradient.addColorStop(1, '#2A2A2A');
        ctx.fillStyle = skiGradient;
        ctx.beginPath();
        ctx.moveTo(centerX + 35, centerY + 20);
        ctx.lineTo(centerX + 70, centerY + 18);
        ctx.lineTo(centerX + 72, centerY + 22);
        ctx.lineTo(centerX + 72, centerY + 32);
        ctx.lineTo(centerX + 70, centerY + 35);
        ctx.lineTo(centerX + 35, centerY + 35);
        ctx.closePath();
        ctx.fill();
        
        // 滑板边框
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 滑板纹理
        ctx.strokeStyle = '#8A8A8A';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(centerX + 40 + i * 10, centerY + 22);
            ctx.lineTo(centerX + 65 + i * 2, centerY + 20);
            ctx.stroke();
        }
        
        // === 超亮车灯（LED风格）===
        // 主车灯（上）
        const lightGradient1 = ctx.createRadialGradient(centerX + 58, centerY - 15, 1, centerX + 58, centerY - 15, 10);
        lightGradient1.addColorStop(0, '#FFFFFF');
        lightGradient1.addColorStop(0.3, '#FFFF00');
        lightGradient1.addColorStop(0.7, '#FFD700');
        lightGradient1.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = lightGradient1;
        ctx.beginPath();
        ctx.arc(centerX + 58, centerY - 15, 7, 0, Math.PI * 2);
        ctx.fill();
        
        // 主车灯（下）
        ctx.beginPath();
        ctx.arc(centerX + 58, centerY - 5, 7, 0, Math.PI * 2);
        ctx.fill();
        
        // 车灯外圈
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX + 58, centerY - 15, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX + 58, centerY - 5, 7, 0, Math.PI * 2);
        ctx.stroke();
        
        // 超强光晕
        ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(centerX + 58, centerY - 15, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 58, centerY - 5, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // === 排气管 ===
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(centerX - 48, centerY + 8, 8, 6);
        ctx.strokeStyle = '#3A3A3A';
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - 48, centerY + 8, 8, 6);
        
        // === 品牌LOGO ===
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TURBO', centerX + 35, centerY - 5)
        
        ctx.restore();
    }
    
    drawPolarBear3D(ctx, bounceY) {
        ctx.save();
        const centerX = this.x + this.width / 2;
        const baseY = this.y + bounceY;
        
        // === 地面阴影（椭圆形，更大更真实） ===
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(centerX, baseY + 85, 50, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 后腿（强壮有力，3D立体感） ===
        const backLegCycle = Math.sin(this.slideWobble) * 3;
        
        // 后左腿
        const backLeftGradient = ctx.createLinearGradient(centerX - 30, baseY + 50, centerX - 20, baseY + 80);
        backLeftGradient.addColorStop(0, '#FFFFFF');
        backLeftGradient.addColorStop(0.5, '#F5F5F5');
        backLeftGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = backLeftGradient;
        ctx.beginPath();
        ctx.ellipse(centerX - 25, baseY + 60 + backLegCycle, 12, 25, 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 后右腿
        const backRightGradient = ctx.createLinearGradient(centerX + 20, baseY + 50, centerX + 30, baseY + 80);
        backRightGradient.addColorStop(0, '#FFFFFF');
        backRightGradient.addColorStop(0.5, '#F5F5F5');
        backRightGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = backRightGradient;
        ctx.beginPath();
        ctx.ellipse(centerX + 25, baseY + 60 - backLegCycle, 12, 25, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // === 身体（宽大强壮，3D渐变） ===
        const bodyGradient = ctx.createRadialGradient(
            centerX - 10, baseY + 35, 10,
            centerX, baseY + 45, 50
        );
        bodyGradient.addColorStop(0, '#FFFFFF');
        bodyGradient.addColorStop(0.4, '#FAFAFA');
        bodyGradient.addColorStop(0.7, '#F0F0F0');
        bodyGradient.addColorStop(1, '#E0E0E0');
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, baseY + 50, 45, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 身体轮廓和阴影
        ctx.strokeStyle = 'rgba(180, 180, 180, 0.7)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        
        // 身体底部阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.beginPath();
        ctx.ellipse(centerX, baseY + 65, 40, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 前肢（宽大如桨，带锋利爪子） ===
        const frontLegCycle = Math.sin(this.slideWobble + Math.PI) * 4;
        
        // 前左肢
        const frontLeftGradient = ctx.createLinearGradient(centerX - 35, baseY + 40, centerX - 25, baseY + 75);
        frontLeftGradient.addColorStop(0, '#FFFFFF');
        frontLeftGradient.addColorStop(0.6, '#F5F5F5');
        frontLeftGradient.addColorStop(1, '#E5E5E5');
        ctx.fillStyle = frontLeftGradient;
        ctx.beginPath();
        ctx.ellipse(centerX - 30, baseY + 55 + frontLegCycle, 14, 28, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 前左爪（5个锋利爪子）
        ctx.fillStyle = '#1A1A1A';
        for (let i = 0; i < 5; i++) {
            const clawX = centerX - 30 + (i - 2) * 5;
            const clawY = baseY + 80 + frontLegCycle;
            ctx.beginPath();
            ctx.moveTo(clawX, clawY);
            ctx.lineTo(clawX - 1, clawY + 8);
            ctx.lineTo(clawX + 1, clawY + 8);
            ctx.closePath();
            ctx.fill();
        }
        
        // 前右肢
        const frontRightGradient = ctx.createLinearGradient(centerX + 25, baseY + 40, centerX + 35, baseY + 75);
        frontRightGradient.addColorStop(0, '#FFFFFF');
        frontRightGradient.addColorStop(0.6, '#F5F5F5');
        frontRightGradient.addColorStop(1, '#E5E5E5');
        ctx.fillStyle = frontRightGradient;
        ctx.beginPath();
        ctx.ellipse(centerX + 30, baseY + 55 - frontLegCycle, 14, 28, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 前右爪（5个锋利爪子）
        ctx.fillStyle = '#1A1A1A';
        for (let i = 0; i < 5; i++) {
            const clawX = centerX + 30 + (i - 2) * 5;
            const clawY = baseY + 80 - frontLegCycle;
            ctx.beginPath();
            ctx.moveTo(clawX, clawY);
            ctx.lineTo(clawX - 1, clawY + 8);
            ctx.lineTo(clawX + 1, clawY + 8);
            ctx.closePath();
            ctx.fill();
        }
        
        // === 颈部（细长优雅） ===
        const neckGradient = ctx.createLinearGradient(centerX - 5, baseY + 20, centerX + 5, baseY + 35);
        neckGradient.addColorStop(0, '#FFFFFF');
        neckGradient.addColorStop(0.5, '#F8F8F8');
        neckGradient.addColorStop(1, '#F0F0F0');
        ctx.fillStyle = neckGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, baseY + 28, 10, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // === 头部（较小，窄长，鹰钩鼻特征） ===
        const headGradient = ctx.createRadialGradient(
            centerX - 5, baseY + 8, 5,
            centerX, baseY + 12, 18
        );
        headGradient.addColorStop(0, '#FFFFFF');
        headGradient.addColorStop(0.5, '#FAFAFA');
        headGradient.addColorStop(1, '#ECECEC');
        ctx.fillStyle = headGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, baseY + 15, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(190, 190, 190, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 头部阴影（底部）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.beginPath();
        ctx.ellipse(centerX, baseY + 20, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // === 耳朵（小而圆） ===
        // 左耳
        const leftEarGradient = ctx.createRadialGradient(centerX - 12, baseY + 5, 2, centerX - 12, baseY + 6, 5);
        leftEarGradient.addColorStop(0, '#FFFFFF');
        leftEarGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = leftEarGradient;
        ctx.beginPath();
        ctx.arc(centerX - 12, baseY + 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // 左耳内部
        ctx.fillStyle = '#D0D0D0';
        ctx.beginPath();
        ctx.arc(centerX - 12, baseY + 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 右耳
        const rightEarGradient = ctx.createRadialGradient(centerX + 12, baseY + 5, 2, centerX + 12, baseY + 6, 5);
        rightEarGradient.addColorStop(0, '#FFFFFF');
        rightEarGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = rightEarGradient;
        ctx.beginPath();
        ctx.arc(centerX + 12, baseY + 6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // 右耳内部
        ctx.fillStyle = '#D0D0D0';
        ctx.beginPath();
        ctx.arc(centerX + 12, baseY + 7, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // === 吻部（鹰钩鼻，光滑曲线） ===
        const snoutGradient = ctx.createLinearGradient(centerX - 8, baseY + 15, centerX + 8, baseY + 25);
        snoutGradient.addColorStop(0, '#FAFAFA');
        snoutGradient.addColorStop(0.5, '#F5F5F5');
        snoutGradient.addColorStop(1, '#E8E8E8');
        ctx.fillStyle = snoutGradient;
        ctx.beginPath();
        // 鹰钩鼻曲线
        ctx.moveTo(centerX, baseY + 10);
        ctx.quadraticCurveTo(centerX - 8, baseY + 18, centerX, baseY + 24);
        ctx.quadraticCurveTo(centerX + 8, baseY + 18, centerX, baseY + 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(180, 180, 180, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // === 鼻头（黑色，灵敏，3D立体） ===
        const noseGradient = ctx.createRadialGradient(centerX - 1, baseY + 22, 2, centerX, baseY + 24, 5);
        noseGradient.addColorStop(0, '#2A2A2A');
        noseGradient.addColorStop(0.6, '#1A1A1A');
        noseGradient.addColorStop(1, '#000000');
        ctx.fillStyle = noseGradient;
        ctx.beginPath();
        ctx.ellipse(centerX, baseY + 24, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 鼻头高光（湿润感）
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(centerX - 2, baseY + 22, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 鼻孔
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX - 2, baseY + 25, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 2, baseY + 25, 1, 0, Math.PI * 2);
        ctx.fill();
        
        // === 眼睛（炯炯有神，敏锐坚毅） ===
        // 左眼眼窝
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.beginPath();
        ctx.ellipse(centerX - 8, baseY + 13, 5, 4, -0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // 左眼球
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX - 8, baseY + 13, 3.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 左眼高光（炯炯有神）
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX - 7, baseY + 12, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX - 9, baseY + 14, 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // 右眼眼窝
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.beginPath();
        ctx.ellipse(centerX + 8, baseY + 13, 5, 4, 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        // 右眼球
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX + 8, baseY + 13, 3.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 右眼高光（炯炯有神）
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(centerX + 9, baseY + 12, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 7, baseY + 14, 0.8, 0, Math.PI * 2);
        ctx.fill();
        
        // === 嘴部细节 ===
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX, baseY + 24);
        ctx.lineTo(centerX, baseY + 27);
        ctx.stroke();
        
        // 嘴角（威严）
        ctx.beginPath();
        ctx.arc(centerX - 4, baseY + 27, 3, 0, Math.PI * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(centerX + 4, baseY + 27, 3, Math.PI * 0.2, Math.PI);
        ctx.stroke();
        
        // === 毛发质感（细节纹理） ===
        ctx.strokeStyle = 'rgba(220, 220, 220, 0.3)';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 15; i++) {
            const angle = (Math.PI * 2 / 15) * i;
            const startX = centerX + Math.cos(angle) * 35;
            const startY = baseY + 50 + Math.sin(angle) * 25;
            const endX = centerX + Math.cos(angle) * 42;
            const endY = baseY + 50 + Math.sin(angle) * 30;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

// Particle System
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10 - 5;
        this.life = 1;
        this.color = color;
        this.size = Math.random() * 5 + 2;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.5;
        this.life -= 0.02;
    }
    
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Avalanche - 雪崩追赶效果
class Avalanche {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 800; // 巨大的雪墙
        this.height = CONFIG.canvas.height;
        this.speed = 25; // 快速追赶，比玩家速度快很多
        this.particles = [];
        this.waveOffset = 0;
        this.phase = 'approaching'; // approaching, engulfing, buried, death
        this.phaseTimer = 0;
        this.buriedDepth = 0; // 掩埋深度
        this.playerStruggles = []; // 挣扎动画
        this.oxygenLevel = 100; // 氧气水平
        this.temperature = 37; // 体温
        this.consciousness = 100; // 意识水平
        
        // 初始化大量雪崩粒子（白色海啸）
        for (let i = 0; i < 500; i++) {
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 25 + 5,
                speedX: Math.random() * 8 + 5,
                speedY: Math.random() * 6 - 3,
                opacity: Math.random() * 0.8 + 0.2,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: Math.random() * 0.2 - 0.1
            });
        }
        
        // 音效提示
        console.log('⚠️ 雪崩来袭！');
    }
    
    update(playerX, playerY) {
        this.phaseTimer++;
        
        if (this.phase === 'approaching') {
            // 阶段1：雪墙汹涌而来
            this.x += this.speed;
            this.waveOffset += 0.3;
            
            // 检查是否吞没玩家
            if (this.x + this.width / 2 >= playerX) {
                this.phase = 'engulfing';
                this.phaseTimer = 0;
                console.log('💥 雪崩吞没玩家！');
            }
        } else if (this.phase === 'engulfing') {
            // 阶段2：吞没玩家，剧烈旋转
            this.speed *= 0.95; // 逐渐减速
            this.waveOffset += 0.5;
            
            // 生成挣扎动画
            if (this.phaseTimer % 5 === 0) {
                this.playerStruggles.push({
                    x: Math.random() * 100 - 50,
                    y: Math.random() * 100 - 50,
                    life: 30
                });
            }
            
            // 3秒后进入掩埋阶段
            if (this.phaseTimer > 180) {
                this.phase = 'buried';
                this.phaseTimer = 0;
                console.log('❄️ 玩家被掩埋！');
            }
        } else if (this.phase === 'buried') {
            // 阶段3：被掩埋，窒息
            this.buriedDepth = Math.min(100, this.phaseTimer / 3);
            this.oxygenLevel = Math.max(0, 100 - this.phaseTimer / 5);
            this.temperature = Math.max(20, 37 - this.phaseTimer / 30);
            this.consciousness = Math.max(0, 100 - this.phaseTimer / 4);
            
            // 10秒后进入死亡阶段
            if (this.phaseTimer > 600) {
                this.phase = 'death';
                this.phaseTimer = 0;
                console.log('💀 玩家失去意识...');
            }
        } else if (this.phase === 'death') {
            // 阶段4：死亡
            // 保持静止，显示死亡画面
        }
        
        // 更新粒子
        this.particles.forEach(p => {
            p.x += p.speedX * (this.phase === 'approaching' ? 1 : 0.3);
            p.y += p.speedY;
            p.rotation += p.rotationSpeed;
            
            // 粒子循环
            if (p.x > this.width) p.x = 0;
            if (p.y < 0) p.y = this.height;
            if (p.y > this.height) p.y = 0;
        });
        
        // 更新挣扎动画
        this.playerStruggles = this.playerStruggles.filter(s => {
            s.life--;
            return s.life > 0;
        });
    }
    
    draw(ctx, playerX, playerY) {
        ctx.save();
        
        if (this.phase === 'approaching' || this.phase === 'engulfing') {
            // === 阶段1&2：巨大雪墙汹涌而来 ===
            
            // 背景震动效果
            const shake = this.phase === 'engulfing' ? Math.sin(this.phaseTimer * 0.5) * 5 : 0;
            ctx.translate(shake, shake);
            
            // 绘制巨大雪墙主体
            const gradient = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
            gradient.addColorStop(0.2, 'rgba(245, 250, 255, 0.95)');
            gradient.addColorStop(0.5, 'rgba(230, 240, 250, 0.85)');
            gradient.addColorStop(0.8, 'rgba(200, 220, 240, 0.6)');
            gradient.addColorStop(1, 'rgba(180, 200, 220, 0.3)');
            
            ctx.fillStyle = gradient;
            
            // 绘制汹涌的波浪形状
            ctx.beginPath();
            ctx.moveTo(this.x, this.height);
            
            for (let y = this.height; y >= 0; y -= 15) {
                const wave = Math.sin(y * 0.015 + this.waveOffset) * 60 + 
                            Math.sin(y * 0.03 + this.waveOffset * 2) * 30;
                ctx.lineTo(this.x + wave, y);
            }
            
            ctx.lineTo(this.x + this.width, 0);
            ctx.lineTo(this.x + this.width, this.height);
            ctx.closePath();
            ctx.fill();
            
            // 绘制大量飞舞的雪粒（白色海啸）
            this.particles.forEach(p => {
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.translate(this.x + p.x, p.y);
                ctx.rotate(p.rotation);
                
                // 雪块
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                
                // 高光
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(-p.size / 3, -p.size / 3, p.size / 2, p.size / 2);
                
                ctx.restore();
            });
            
            // 绘制雪墙前沿（强调冲击力）
            ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
            ctx.lineWidth = 8;
            ctx.shadowColor = 'rgba(200, 220, 255, 0.9)';
            ctx.shadowBlur = 25;
            
            ctx.beginPath();
            ctx.moveTo(this.x, this.height);
            for (let y = this.height; y >= 0; y -= 10) {
                const wave = Math.sin(y * 0.015 + this.waveOffset) * 60;
                ctx.lineTo(this.x + wave, y);
            }
            ctx.stroke();
            
            // 阶段2：绘制玩家挣扎
            if (this.phase === 'engulfing') {
                ctx.shadowBlur = 0;
                this.playerStruggles.forEach(s => {
                    const alpha = s.life / 30;
                    ctx.globalAlpha = alpha;
                    
                    // 挣扎的手臂
                    ctx.strokeStyle = '#FF6B6B';
                    ctx.lineWidth = 6;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(playerX + s.x, playerY + s.y);
                    ctx.lineTo(playerX + s.x - 20, playerY + s.y - 30);
                    ctx.stroke();
                    
                    // 手掌
                    ctx.fillStyle = '#FFE0BD';
                    ctx.beginPath();
                    ctx.arc(playerX + s.x - 20, playerY + s.y - 30, 8, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
            
            ctx.globalAlpha = 1;
            
        } else if (this.phase === 'buried') {
            // === 阶段3：被掩埋，窒息 ===
            
            // 全屏白色覆盖（被雪掩埋）
            const buriedAlpha = Math.min(0.95, this.buriedDepth / 100);
            ctx.fillStyle = `rgba(255, 255, 255, ${buriedAlpha})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            // 绘制雪层纹理
            for (let i = 0; i < 50; i++) {
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = '#E0E0E0';
                const x = Math.random() * ctx.canvas.width;
                const y = Math.random() * ctx.canvas.height;
                ctx.fillRect(x, y, Math.random() * 30 + 10, Math.random() * 30 + 10);
            }
            
            // 中心黑暗区域（狭小空间）
            const darkGradient = ctx.createRadialGradient(
                ctx.canvas.width / 2, ctx.canvas.height / 2, 100,
                ctx.canvas.width / 2, ctx.canvas.height / 2, 400
            );
            darkGradient.addColorStop(0, 'rgba(0, 0, 0, 0.8)');
            darkGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = darkGradient;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            // 显示生命体征
            this.drawVitalSigns(ctx);
            
            // 呼吸雾气效果
            if (this.oxygenLevel > 0) {
                const breathAlpha = Math.sin(this.phaseTimer * 0.1) * 0.3 + 0.3;
                ctx.globalAlpha = breathAlpha;
                ctx.fillStyle = 'rgba(200, 220, 240, 0.5)';
                ctx.beginPath();
                ctx.arc(ctx.canvas.width / 2, ctx.canvas.height / 2 + 50, 80, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // 警告文字
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#FF4444';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 10;
            ctx.fillText('被雪崩掩埋！', ctx.canvas.width / 2, 100);
            
            ctx.font = 'bold 32px Arial';
            ctx.fillStyle = '#FFAA00';
            ctx.fillText('氧气耗尽中...', ctx.canvas.width / 2, 150);
            
        } else if (this.phase === 'death') {
            // === 阶段4：死亡 ===
            
            // 全屏黑白效果
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            // 黑色渐变（死亡）
            const deathGradient = ctx.createRadialGradient(
                ctx.canvas.width / 2, ctx.canvas.height / 2, 0,
                ctx.canvas.width / 2, ctx.canvas.height / 2, 600
            );
            deathGradient.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
            deathGradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
            ctx.fillStyle = deathGradient;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            // 死亡文字
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 72px Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 20;
            ctx.fillText('永久埋葬', ctx.canvas.width / 2, ctx.canvas.height / 2 - 50);
            
            ctx.font = 'bold 36px Arial';
            ctx.fillStyle = '#AAAAAA';
            ctx.fillText('在冰雪坟墓之中...', ctx.canvas.width / 2, ctx.canvas.height / 2 + 20);
            
            // 显示最终数据
            ctx.font = '24px Arial';
            ctx.fillStyle = '#666666';
            ctx.fillText(`氧气: 0%  |  体温: ${this.temperature.toFixed(1)}°C  |  意识: 0%`, 
                        ctx.canvas.width / 2, ctx.canvas.height / 2 + 80);
        }
        
        ctx.restore();
    }
    
    drawVitalSigns(ctx) {
        // 绘制生命体征面板
        const panelX = 50;
        const panelY = ctx.canvas.height - 200;
        const panelWidth = 300;
        const panelHeight = 150;
        
        // 面板背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        ctx.strokeStyle = '#FF4444';
        ctx.lineWidth = 3;
        ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // 氧气水平
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('氧气:', panelX + 20, panelY + 35);
        
        const oxygenColor = this.oxygenLevel > 50 ? '#00FF00' : 
                           this.oxygenLevel > 20 ? '#FFAA00' : '#FF0000';
        ctx.fillStyle = oxygenColor;
        ctx.fillRect(panelX + 100, panelY + 20, this.oxygenLevel * 1.8, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${this.oxygenLevel.toFixed(0)}%`, panelX + 100, panelY + 35);
        
        // 体温
        ctx.fillText('体温:', panelX + 20, panelY + 75);
        const tempColor = this.temperature > 35 ? '#00FF00' : 
                         this.temperature > 30 ? '#FFAA00' : '#0088FF';
        ctx.fillStyle = tempColor;
        ctx.fillText(`${this.temperature.toFixed(1)}°C`, panelX + 100, panelY + 75);
        
        // 意识水平
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('意识:', panelX + 20, panelY + 115);
        const consColor = this.consciousness > 50 ? '#00FF00' : 
                         this.consciousness > 20 ? '#FFAA00' : '#FF0000';
        ctx.fillStyle = consColor;
        ctx.fillRect(panelX + 100, panelY + 100, this.consciousness * 1.8, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`${this.consciousness.toFixed(0)}%`, panelX + 100, panelY + 115);
    }
}

// Initialize game
const game = new Game();
