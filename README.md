# Dubbo 集群网络拓扑图谱可视化工具

基于 AntV G6 5.0.50 开发的 Dubbo 集群网络拓扑关系可视化工具。

## 功能特性

### 📊 数据导入
- 支持上传 JSON 格式的 Dubbo 拓扑数据文件
- 自动解析并渲染网络拓扑图谱

### 🎨 布局配置
- **力导向布局 (Force)**: 适合展示复杂网络关系
- **层次布局 (Dagre)**: 清晰展示层级结构
- **环形布局 (Circular)**: 节点均匀分布在圆周上
- **网格布局 (Grid)**: 规则的网格排列
- **同心圆布局 (Concentric)**: 同心圆分层展示

每种布局都支持参数自定义调整。

### 🎯 画布控制
- **清空关系**: 仅保留节点，移除所有连线
- **清空画布**: 清除所有节点和连线
- **隐藏节点类型**: 选择性隐藏 Consumer/Provider/Consumer&Provider 类型的节点

### 🔍 智能检索

#### 节点检索
- 支持多关键词搜索（空格分隔）
- 忽略大小写匹配
- 可选择清空画布或追加显示

#### 路径检索
- 支持起始/目标节点关键词匹配
- 三种查找方向：
  - 正向：从起点到终点
  - 反向：从终点到起点
  - 双向：不考虑方向
- 可设置最大跳数限制
- 自动高亮所有符合条件的路径

### 📈 统计信息
- 实时显示节点和关系的总数
- 显示当前画布中的可见节点和关系数量

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

浏览器将自动打开 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 数据格式

JSON 数据格式示例：

```json
{
  "categories": [
    {
      "index": 0,
      "name": "consumer",
      "base": "consumer"
    },
    {
      "index": 1,
      "name": "provider",
      "base": "provider"
    },
    {
      "index": 2,
      "name": "consumer and provider",
      "base": "consumer and provider"
    }
  ],
  "links": [
    {
      "source": 1,
      "target": 3
    }
  ],
  "nodes": [
    {
      "index": 0,
      "name": "service-a",
      "category": 0
    }
  ]
}
```

## 技术栈

- **前端框架**: 原生 JavaScript (ES6+)
- **图可视化**: AntV G6 v5.0.50
- **构建工具**: Vite v5.0.0
- **样式**: 原生 CSS3

## 交互说明

1. **拖拽画布**: 鼠标左键拖动
2. **缩放**: 鼠标滚轮
3. **拖拽节点**: 拖动节点可调整位置
4. **悬停查看**: 鼠标悬停在节点上查看详细信息

## 项目结构

```
dubbo-relation-json-to-graph/
├── index.html          # 主页面
├── style.css           # 样式文件
├── main.js             # 核心逻辑
├── demo.json           # 示例数据
├── package.json        # 项目配置
├── vite.config.js      # Vite 配置
└── .gitignore          # Git 忽略文件
```

## License

MIT
