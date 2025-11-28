    drawTrees(layer) {
        this.ctx.save();
        
        let drawnCount = 0;
        let totalCount = 0;
        let outOfViewCount = 0;
        
        this.trees.forEach(tree => {
            if (tree.layer !== layer) return;
            totalCount++;
            
            // 装饰树木：提高透明度，更明显
            this.ctx.globalAlpha = 0.85;
            
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
            
            // 树干
            const trunkGradient = this.ctx.createLinearGradient(x - size * 0.1, y, x + size * 0.1, y);
            trunkGradient.addColorStop(0, '#4A3728');
            trunkGradient.addColorStop(0.5, '#5C4A3A');
            trunkGradient.addColorStop(1, '#3A2818');
            this.ctx.fillStyle = trunkGradient;
            this.ctx.fillRect(x - size * 0.08, y, size * 0.16, size * 0.6);
            
            // 树冠（三层，形成雪松形状）- 深绿色雪松，被厚雪覆盖
            const treeColor = layer === 'far' ? 'rgba(20, 60, 50, 0.7)' : 'rgba(25, 70, 60, 0.9)'; // 深绿色
            const snowColor = 'rgba(255, 255, 255, 0.95)'; // 厚厚的积雪
            const snowShadow = 'rgba(230, 240, 250, 0.9)'; // 雪的阴影
            const shadowColor = layer === 'far' ? 'rgba(15, 45, 40, 0.6)' : 'rgba(18, 50, 45, 0.8)'; // 更深的绿色阴影
            
            // 底层树冠阴影（右侧）
            this.ctx.fillStyle = shadowColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y + size * 0.1);
            this.ctx.lineTo(x + size * 0.4, y + size * 0.45);
            this.ctx.lineTo(x + size * 0.1, y + size * 0.45);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 底层树冠主体
            this.ctx.fillStyle = treeColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y + size * 0.1);
            this.ctx.lineTo(x - size * 0.4, y + size * 0.45);
            this.ctx.lineTo(x + size * 0.4, y + size * 0.45);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 底层厚雪覆盖（左侧大面积）
            this.ctx.fillStyle = snowColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y + size * 0.1);
            this.ctx.lineTo(x - size * 0.4, y + size * 0.45);
            this.ctx.lineTo(x - size * 0.15, y + size * 0.45);
            this.ctx.lineTo(x, y + size * 0.18);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 底层雪的边缘高光
            this.ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
            this.ctx.beginPath();
            this.ctx.ellipse(x - size * 0.28, y + size * 0.45, size * 0.08, size * 0.03, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 中层树冠阴影（右侧）
            this.ctx.fillStyle = shadowColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - size * 0.05);
            this.ctx.lineTo(x + size * 0.32, y + size * 0.25);
            this.ctx.lineTo(x + size * 0.08, y + size * 0.25);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 中层树冠主体
            this.ctx.fillStyle = treeColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - size * 0.05);
            this.ctx.lineTo(x - size * 0.32, y + size * 0.25);
            this.ctx.lineTo(x + size * 0.32, y + size * 0.25);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 中层厚雪覆盖（左侧大面积）
            this.ctx.fillStyle = snowColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - size * 0.05);
            this.ctx.lineTo(x - size * 0.32, y + size * 0.25);
            this.ctx.lineTo(x - size * 0.12, y + size * 0.25);
            this.ctx.lineTo(x, y + 0.02);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 中层雪的边缘高光
            this.ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
            this.ctx.beginPath();
            this.ctx.ellipse(x - size * 0.22, y + size * 0.25, size * 0.06, size * 0.025, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 顶层树冠阴影（右侧）
            this.ctx.fillStyle = shadowColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - size * 0.25);
            this.ctx.lineTo(x + size * 0.22, y + size * 0.05);
            this.ctx.lineTo(x + size * 0.06, y + size * 0.05);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 顶层树冠主体
            this.ctx.fillStyle = treeColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - size * 0.25);
            this.ctx.lineTo(x - size * 0.22, y + size * 0.05);
            this.ctx.lineTo(x + size * 0.22, y + size * 0.05);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 顶层厚雪覆盖（左侧大面积）
            this.ctx.fillStyle = snowColor;
            this.ctx.beginPath();
            this.ctx.moveTo(x, y - size * 0.25);
            this.ctx.lineTo(x - size * 0.22, y + size * 0.05);
            this.ctx.lineTo(x - size * 0.08, y + size * 0.05);
            this.ctx.lineTo(x, y - size * 0.16);
            this.ctx.closePath();
            this.ctx.fill();
            
            // 顶层雪的边缘高光
            this.ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
            this.ctx.beginPath();
            this.ctx.ellipse(x - size * 0.15, y + size * 0.05, size * 0.05, size * 0.02, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 树顶积雪（最顶端的雪堆）
            this.ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
            this.ctx.beginPath();
            this.ctx.ellipse(x, y - size * 0.25, size * 0.06, size * 0.04, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 树顶积雪高光
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            this.ctx.beginPath();
            this.ctx.ellipse(x - size * 0.02, y - size * 0.27, size * 0.03, size * 0.02, 0, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 树枝上的雪花点缀（随机分布）
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            for (let i = 0; i < 8; i++) {
                const snowX = x + (Math.random() - 0.5) * size * 0.6;
                const snowY = y + (Math.random() - 0.3) * size * 0.5;
                this.ctx.beginPath();
                this.ctx.arc(snowX, snowY, size * 0.015, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
        
        // 每60帧输出一次统计
        if (!this.treeDrawCounter) this.treeDrawCounter = 0;
        this.treeDrawCounter++;
        if (this.treeDrawCounter % 60 === 0) {
            console.log(`绘制树木 - 总数:${this.trees.length}, layer=${layer}匹配:${totalCount}, 视野外:${outOfViewCount}, 绘制:${drawnCount}`);
            if (this.trees.length > 0 && drawnCount === 0) {
                const firstTree = this.trees[0];
                const screenX = firstTree.x - this.cameraOffsetX;
                console.log(`第一棵树: worldX=${firstTree.x.toFixed(0)}, cameraX=${this.cameraOffsetX.toFixed(0)}, screenX=${screenX.toFixed(0)}, y=${firstTree.y.toFixed(0)}, 屏幕宽度=${this.canvas.width}`);
            }
        }
        
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }
