#!/bin/bash

# Dubbo Topology Viewer - 快速启动脚本

echo "🚀 Dubbo 拓扑图谱可视化工具 - Docker 快速启动"
echo "================================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未检测到 Docker，请先安装 Docker"
    echo "   访问 https://www.docker.com/get-started 下载安装"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  警告: 未检测到 docker-compose"
    echo "   将使用 docker 命令替代"
    USE_COMPOSE=false
else
    USE_COMPOSE=true
fi

echo "✅ 环境检查通过"
echo ""

# 停止并删除旧容器（如果存在）
echo "🧹 清理旧容器..."
if [ "$USE_COMPOSE" = true ]; then
    docker-compose down 2>/dev/null
else
    docker stop dubbo-topology-viewer 2>/dev/null
    docker rm dubbo-topology-viewer 2>/dev/null
fi

echo "📦 构建 Docker 镜像..."
if [ "$USE_COMPOSE" = true ]; then
    docker-compose build
else
    docker build -t dubbo-topology .
fi

if [ $? -ne 0 ]; then
    echo "❌ 镜像构建失败"
    exit 1
fi

echo "✅ 镜像构建成功"
echo ""

echo "🎯 启动容器..."
if [ "$USE_COMPOSE" = true ]; then
    docker-compose up -d
else
    docker run -d -p 3000:80 --name dubbo-topology-viewer --restart unless-stopped dubbo-topology
fi

if [ $? -ne 0 ]; then
    echo "❌ 容器启动失败"
    exit 1
fi

echo "✅ 容器启动成功"
echo ""

# 等待服务就绪
echo "⏳ 等待服务启动..."
sleep 3

# 检查容器状态
if [ "$USE_COMPOSE" = true ]; then
    CONTAINER_STATUS=$(docker-compose ps -q dubbo-topology | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null)
else
    CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' dubbo-topology-viewer 2>/dev/null)
fi

if [ "$CONTAINER_STATUS" = "running" ]; then
    echo ""
    echo "🎉 启动成功！"
    echo "================================================"
    echo "📍 访问地址: http://localhost:3000"
    echo "📋 查看日志: docker-compose logs -f  (或 docker logs -f dubbo-topology-viewer)"
    echo "🛑 停止服务: docker-compose down     (或 docker stop dubbo-topology-viewer)"
    echo "================================================"
    echo ""
    
    # 尝试打开浏览器
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:3000 2>/dev/null &
    elif command -v open &> /dev/null; then
        open http://localhost:3000 2>/dev/null &
    fi
else
    echo "❌ 容器启动异常，请检查日志"
    if [ "$USE_COMPOSE" = true ]; then
        docker-compose logs
    else
        docker logs dubbo-topology-viewer
    fi
    exit 1
fi
