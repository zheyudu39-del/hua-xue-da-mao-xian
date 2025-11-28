# Sin函数抛物线跳跃系统说明

## 功能概述
实现了基于sin函数的平滑抛物线跳跃系统，使熊猫的跳跃轨迹更加自然流畅，呈现完美的抛物线曲线。

## 数学原理

### 1. 垂直位置计算（Y轴）
使用sin函数生成抛物线轨迹：

```javascript
y = jumpStartY - sin(π × progress) × jumpHeight
```

- **progress**: 跳跃进度，从0到1
- **sin(π × progress)**: 
  - progress = 0 时，sin(0) = 0（起跳点）
  - progress = 0.5 时，sin(π/2) = 1（最高点）
  - progress = 1 时，sin(π) = 0（落地点）
- **jumpHeight**: 跳跃高度（120像素）

### 2. 身体姿态计算
使用cos函数（sin的导数）计算身体倾斜角度：

```javascript
jumpPose = -cos(π × progress) × 0.8
```

- **cos(π × progress)** 表示垂直速度的方向：
  - progress < 0.5: cos > 0，向上运动，身体向后仰
  - progress = 0.5: cos = 0，最高点，身体水平
  - progress > 0.5: cos < 0，向下运动，身体向前倾

## 实现细节

### 核心参数
```javascript
this.isJumping = false;      // 是否正在执行跳跃
this.jumpProgress = 0;       // 跳跃进度（0到1）
this.jumpStartY = 0;         // 跳跃起始Y坐标
this.jumpStartX = 0;         // 跳跃起始X坐标
this.jumpHeight = 120;       // 跳跃高度（像素）
this.jumpDistance = 200;     // 跳跃水平距离（预留参数）
this.jumpSpeed = 0.02;       // 跳跃速度（每帧增加的进度）
```

### 跳跃流程

#### 1. 起跳（jump方法）
```javascript
jump() {
    if (this.isGrounded && !this.isJumping) {
        this.isJumping = true;
        this.jumpProgress = 0;
        this.jumpStartY = this.y;
        this.jumpStartX = this.x;
        this.isGrounded = false;
        this.trajectoryPoints = [];
    }
}
```

#### 2. 跳跃更新（update方法）
```javascript
if (this.isJumping) {
    // 更新进度
    this.jumpProgress += this.jumpSpeed;
    
    // 计算Y位置（sin函数）
    const sinValue = Math.sin(Math.PI * this.jumpProgress);
    this.y = this.jumpStartY - (sinValue * this.jumpHeight);
    
    // 计算身体姿态（cos函数）
    const cosValue = Math.cos(Math.PI * this.jumpProgress);
    this.jumpPose = -cosValue * 0.8;
    
    // 记录轨迹点
    this.trajectoryPoints.push({
        x: this.x + this.width / 2,
        y: this.y + this.height / 2
    });
}
```

#### 3. 着陆检测
```javascript
if (this.y + this.height >= groundY) {
    this.y = groundY - this.height;
    this.velocityY = 0;
    this.isGrounded = true;
    this.isJumping = false;  // 结束跳跃
    this.jumpProgress = 0;
}
```

## 视觉效果

### 1. 抛物线轨迹
- 使用二次贝塞尔曲线绘制平滑轨迹
- 红色半透明线条，带发光效果
- 轨迹点用小圆点标记

### 2. 身体姿态动画
- **上升阶段**（0 < progress < 0.5）：
  - 身体向后仰
  - 角度逐渐增大
  
- **最高点**（progress ≈ 0.5）：
  - 身体接近水平
  - 姿态最优美
  
- **下降阶段**（0.5 < progress < 1）：
  - 身体向前倾
  - 准备着陆姿态

## 与传统重力系统的对比

### 传统重力系统
```javascript
// 简单的物理模拟
velocityY += gravity;
y += velocityY;
```
- 优点：物理真实
- 缺点：轨迹不够平滑，难以精确控制

### Sin函数系统
```javascript
// 数学函数控制
y = startY - sin(π × progress) × height;
```
- 优点：轨迹完美平滑，可精确控制
- 缺点：需要预设跳跃时长

## 参数调整指南

### 跳跃高度
```javascript
this.jumpHeight = 120;  // 增大数值 = 跳得更高
```

### 跳跃速度
```javascript
this.jumpSpeed = 0.02;  // 增大数值 = 跳得更快
```
- 0.01 = 100帧完成跳跃（约1.67秒）
- 0.02 = 50帧完成跳跃（约0.83秒）
- 0.03 = 33帧完成跳跃（约0.55秒）

### 姿态幅度
```javascript
this.jumpPose = -cosValue * 0.8;  // 0.8控制倾斜幅度
```
- 增大数值 = 身体倾斜更明显
- 减小数值 = 身体倾斜更轻微

## 轨迹可视化

跳跃轨迹呈现标准的sin曲线形状：

```
     最高点 (progress=0.5)
        ●
       ╱ ╲
      ╱   ╲
     ╱     ╲
    ╱       ╲
   ╱         ╲
  ●           ●
起点          终点
(progress=0)  (progress=1)
```

## 代码位置
- **跳跃系统**: `game.js` 第525-532行（参数定义）
- **跳跃方法**: `game.js` 第535-546行
- **更新逻辑**: `game.js` 第574-621行
- **轨迹绘制**: `game.js` 第643-690行

## 使用方法
玩家点击鼠标左键即可触发跳跃，熊猫将沿着平滑的sin曲线抛物线跳跃。
