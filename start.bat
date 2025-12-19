@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo 🚀 Dubbo 拓扑图谱可视化工具 - Docker 快速启动
echo ================================================
echo.

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未检测到 Docker，请先安装 Docker Desktop
    echo    访问 https://www.docker.com/get-started 下载安装
    pause
    exit /b 1
)

REM 检查 Docker Compose 是否安装
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  警告: 未检测到 docker-compose
    echo    将使用 docker 命令替代
    set USE_COMPOSE=false
) else (
    set USE_COMPOSE=true
)

echo ✅ 环境检查通过
echo.

REM 停止并删除旧容器（如果存在）
echo 🧹 清理旧容器...
if "!USE_COMPOSE!"=="true" (
    docker-compose down >nul 2>&1
) else (
    docker stop dubbo-topology-viewer >nul 2>&1
    docker rm dubbo-topology-viewer >nul 2>&1
)

echo 📦 构建 Docker 镜像...
if "!USE_COMPOSE!"=="true" (
    docker-compose build
) else (
    docker build -t dubbo-topology .
)

if %errorlevel% neq 0 (
    echo ❌ 镜像构建失败
    pause
    exit /b 1
)

echo ✅ 镜像构建成功
echo.

echo 🎯 启动容器...
if "!USE_COMPOSE!"=="true" (
    docker-compose up -d
) else (
    docker run -d -p 3000:80 --name dubbo-topology-viewer --restart unless-stopped dubbo-topology
)

if %errorlevel% neq 0 (
    echo ❌ 容器启动失败
    pause
    exit /b 1
)

echo ✅ 容器启动成功
echo.

REM 等待服务就绪
echo ⏳ 等待服务启动...
timeout /t 3 /nobreak >nul

REM 检查容器状态
docker inspect -f "{{.State.Status}}" dubbo-topology-viewer >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo 🎉 启动成功！
    echo ================================================
    echo 📍 访问地址: http://localhost:3000
    echo 📋 查看日志: docker-compose logs -f  ^(或 docker logs -f dubbo-topology-viewer^)
    echo 🛑 停止服务: docker-compose down     ^(或 docker stop dubbo-topology-viewer^)
    echo ================================================
    echo.
    
    REM 打开浏览器
    start http://localhost:3000
) else (
    echo ❌ 容器启动异常，请检查日志
    if "!USE_COMPOSE!"=="true" (
        docker-compose logs
    ) else (
        docker logs dubbo-topology-viewer
    )
    pause
    exit /b 1
)

pause
