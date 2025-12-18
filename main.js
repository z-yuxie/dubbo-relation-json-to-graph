import { Graph } from '@antv/g6';

// 全局状态
let graph = null;
let originalData = null; // 原始完整数据
let currentVisibleData = { nodes: [], edges: [] }; // 当前可见数据（用于统计）
let currentLayout = 'dagre';  // 默认使用 dagre 布局
let layoutConfig = {};

// 颜色配置
const categoryColors = {
    0: '#5B8FF9', // consumer - 蓝色
    1: '#5AD8A6', // provider - 绿色
    2: '#F6BD16', // consumer and provider - 黄色
};

// 创建节点数据的辅助函数
function createNodeData(node) {
    const nodeData = {
        id: `node-${node.index}`,
        label: node.name || `Node ${node.index}`,
        type: 'circle',
        size: 40,
        category: node.category,
        index: node.index,
        style: {
            fill: categoryColors[node.category] || '#5B8FF9',
            stroke: '#fff',
            lineWidth: 2,
        },
    };
    console.log('Created node:', nodeData);
    return nodeData;
}

// 创建边数据的辅助函数
function createEdgeData(link, idx) {
    const edgeData = {
        id: `edge-${idx}`,
        source: `node-${link.source}`,
        target: `node-${link.target}`,
        type: 'line',
    };
    console.log('Created edge:', edgeData);
    return edgeData;
}

// 设置图谱事件监听
function setupGraphEvents() {
    if (!graph) return;
    
    // 监听布局完成事件
    graph.on('afterlayout', () => {
        console.log('Layout completed');
        // 布局完成后停止布局计算
        if (typeof graph.stopLayout === 'function') {
            graph.stopLayout();
        }
    });
    
    // 监听节点悬停
    graph.on('node:mouseenter', (evt) => {
        const { item } = evt;
        if (!item) return;
        
        console.log('Node mouseenter:', item);
        
        try {
            const model = item.getModel();
            showTooltip(evt, model);
            
            // 设置悬停状态
            graph.setItemState(item, 'hover', true);
        } catch (e) {
            console.warn('Node hover error:', e);
        }
    });

    graph.on('node:mouseleave', (evt) => {
        const { item } = evt;
        if (!item) return;
        
        console.log('Node mouseleave:', item);
        
        try {
            hideTooltip();
            
            // 清除悬停状态
            graph.setItemState(item, 'hover', false);
        } catch (e) {
            console.warn('Node leave error:', e);
        }
    });
    
    // 监听节点点击
    graph.on('node:click', (evt) => {
        console.log('Node clicked:', evt);
    });
    
    // 监听节点拖拽
    graph.on('node:dragstart', (evt) => {
        console.log('Node drag start:', evt);
    });
    
    graph.on('node:drag', (evt) => {
        console.log('Node dragging:', evt);
    });
    
    graph.on('node:dragend', (evt) => {
        console.log('Node drag end:', evt);
    });

    // 窗口大小调整
    window.addEventListener('resize', () => {
        if (graph) {
            graph.setSize(document.getElementById('container').offsetWidth, 
                         document.getElementById('container').offsetHeight);
        }
    });
}

// 初始化图谱
function initGraph() {
    const container = document.getElementById('container');
    
    graph = new Graph({
        container,
        width: container.offsetWidth,
        height: container.offsetHeight,
        fitView: true,
        fitViewPadding: [20, 20, 20, 20],
        data: { nodes: [], edges: [] },  // 初始化空数据
        modes: {
            default: [
                {
                    type: 'drag-canvas',
                    enableOptimize: true,
                },
                {
                    type: 'zoom-canvas',
                    enableOptimize: true,
                },
                {
                    type: 'drag-element',
                    enableOptimize: true,
                },
                'click-select',
            ],
        },
        layout: {
            type: 'dagre',
            rankdir: 'LR',
            nodesep: 80,
            ranksep: 150,
            controlPoints: true,
        },
        defaultNode: {
            type: 'circle',
            size: 40,
            style: {
                fill: '#5B8FF9',
                stroke: '#fff',
                lineWidth: 2,
            },
            labelCfg: {
                position: 'bottom',
                offset: 5,
                style: {
                    fontSize: 12,
                    fill: '#333',
                    background: {
                        fill: '#fff',
                        padding: [4, 8],
                        radius: 4,
                        opacity: 0.9,
                    },
                },
            },
        },
        defaultEdge: {
            type: 'line',
            style: {
                stroke: '#99ADD1',
                lineWidth: 2,
                endArrow: true,
            },
        },
        nodeStateStyles: {
            hover: {
                lineWidth: 4,
                shadowBlur: 20,
            },
        },
    });
    
    console.log('Graph initialized successfully');
    
    // 设置事件
    setupGraphEvents();
}

// 显示 Tooltip
function showTooltip(evt, model) {
    const tooltip = document.getElementById('tooltip');
    const categoryName = originalData?.categories[model.category]?.name || 'Unknown';
    
    tooltip.innerHTML = `
        <div><strong>${model.label || model.id}</strong></div>
        <div style="margin-top: 4px; font-size: 12px; opacity: 0.9;">
            类型: ${categoryName}
        </div>
    `;
    
    tooltip.style.left = evt.canvasX + 15 + 'px';
    tooltip.style.top = evt.canvasY + 15 + 'px';
    tooltip.classList.add('show');
}

// 隐藏 Tooltip
function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    tooltip.classList.remove('show');
}

// 验证和清洗数据
function validateAndCleanData(data) {
    if (!data || !data.nodes || !data.links) {
        throw new Error('数据格式错误：缺少 nodes 或 links 字段');
    }

    // 创建节点索引集合
    const nodeIndices = new Set(data.nodes.map(node => node.index));
    
    // 过滤掉引用不存在节点的边
    const validLinks = data.links.filter(link => {
        const isValid = nodeIndices.has(link.source) && nodeIndices.has(link.target);
        if (!isValid) {
            console.warn(`忽略无效的边: source=${link.source}, target=${link.target}`);
        }
        return isValid;
    });

    const invalidCount = data.links.length - validLinks.length;
    if (invalidCount > 0) {
        console.warn(`已过滤 ${invalidCount} 条无效边`);
    }

    return {
        ...data,
        links: validLinks,
    };
}

// 加载数据文件
document.getElementById('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('fileName').textContent = file.name;

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        console.log('Loaded data:', data);
        
        // 验证和清洗数据
        const cleanedData = validateAndCleanData(data);
        
        originalData = cleanedData;
        loadGraphData(cleanedData);
        updateStats();
        
        const invalidEdges = data.links.length - cleanedData.links.length;
        const message = invalidEdges > 0 
            ? `成功加载 ${cleanedData.nodes.length} 个节点和 ${cleanedData.links.length} 条关系（过滤了 ${invalidEdges} 条无效关系）`
            : `成功加载 ${cleanedData.nodes.length} 个节点和 ${cleanedData.links.length} 条关系`;
        
        alert(message);
        
    } catch (error) {
        console.error('File parsing error:', error);
        alert('文件解析失败: ' + error.message);
    }
});

// 重新加载图谱数据（通用方法）
function reloadGraphWithData(nodes, edges) {
    // 保存当前可见数据用于统计
    currentVisibleData = { nodes, edges };
    
    if (graph) {
        graph.destroy();
    }
    
    const container = document.getElementById('container');
    
    graph = new Graph({
        container,
        width: container.offsetWidth,
        height: container.offsetHeight,
        fitView: true,
        fitViewPadding: [20, 20, 20, 20],
        data: { nodes, edges },
        // G6 5.x 的交互方式
        modes: {
            default: [
                {
                    type: 'drag-canvas',
                    enableOptimize: true,
                },
                {
                    type: 'zoom-canvas',
                    enableOptimize: true,
                },
                {
                    type: 'drag-element',  // G6 5.x 使用 drag-element 而不是 drag-node
                    enableOptimize: true,
                },
                'click-select',
            ],
        },
        // 使用更稳定的布局 - dagre 层次布局，避免颤动和重叠
        layout: {
            type: 'dagre',
            rankdir: 'LR',  // 从左到右
            nodesep: 80,    // 节点间距
            ranksep: 150,   // 层级间距
            controlPoints: true,
        },
        defaultNode: {
            type: 'circle',
            size: 40,
            style: {
                fill: '#5B8FF9',
                stroke: '#fff',
                lineWidth: 2,
            },
            labelCfg: {
                position: 'bottom',
                offset: 5,
                style: {
                    fontSize: 12,
                    fill: '#333',
                    background: {
                        fill: '#fff',
                        padding: [4, 8],
                        radius: 4,
                        opacity: 0.9,
                    },
                },
            },
        },
        defaultEdge: {
            type: 'line',
            style: {
                stroke: '#99ADD1',
                lineWidth: 2,
                endArrow: true,
            },
        },
        nodeStateStyles: {
            hover: {
                lineWidth: 4,
                shadowBlur: 20,
            },
        },
    });
    
    setupGraphEvents();
    
    // 尝试显式渲染
    console.log('Graph instance created:', graph);
    console.log('Graph data:', { nodes, edges });
    
    // 输出 graph 的所有方法
    try {
        const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(graph));
        console.log('Graph available methods:', methods);
    } catch (e) {
        console.warn('Cannot get graph methods:', e);
    }
    
    // 检查是否有 render 方法
    if (typeof graph.render === 'function') {
        console.log('Calling graph.render()');
        try {
            graph.render().then(() => {
                console.log('Graph rendered successfully');
                // 渲染完成后等待一下布局
                setTimeout(() => {
                    console.log('Layout should be complete now');
                    // 尝试自适应视图
                    if (typeof graph.fitView === 'function') {
                        graph.fitView();
                    }
                }, 1000);
            }).catch(e => {
                console.error('Render error:', e);
            });
        } catch (e) {
            console.error('Render error:', e);
        }
    }
    
    // 不要调用 layout()，因为布局已经在配置中设置了
    // layout 会自动执行
    
    console.log('Graph setup completed');
}

// 加载图谱数据
function loadGraphData(data) {
    try {
        // 转换数据格式 - G6 5.x
        const nodes = data.nodes.map(node => createNodeData(node));
        const edges = data.links.map((link, idx) => createEdgeData(link, idx));

        console.log('Setting graph data:', { nodes, edges });
        
        reloadGraphWithData(nodes, edges);
        
        console.log('Graph data loaded and rendered');
    } catch (error) {
        console.error('Load graph data error:', error);
        throw error;
    }
}

// 更新统计信息
function updateStats() {
    if (!originalData) return;

    const totalNodes = originalData.nodes.length;
    const totalEdges = originalData.links.length;
    
    // 直接使用保存的可见数据统计
    const visibleNodes = currentVisibleData.nodes.length;
    const visibleEdges = currentVisibleData.edges.length;

    document.getElementById('totalNodes').textContent = totalNodes;
    document.getElementById('totalEdges').textContent = totalEdges;
    document.getElementById('visibleNodes').textContent = visibleNodes;
    document.getElementById('visibleEdges').textContent = visibleEdges;
}

// 布局配置参数映射
const layoutParams = {
    force: [
        { key: 'linkDistance', label: '连线距离', type: 'number', default: 150, min: 50, max: 500 },
        { key: 'nodeStrength', label: '节点作用力', type: 'number', default: -300, min: -1000, max: 0 },
        { key: 'edgeStrength', label: '边作用力', type: 'number', default: 0.6, min: 0, max: 1, step: 0.1 },
    ],
    dagre: [
        { key: 'rankdir', label: '方向', type: 'select', default: 'TB', options: ['TB', 'BT', 'LR', 'RL'] },
        { key: 'nodesep', label: '节点间距', type: 'number', default: 50, min: 10, max: 200 },
        { key: 'ranksep', label: '层级间距', type: 'number', default: 50, min: 10, max: 200 },
    ],
    circular: [
        { key: 'radius', label: '半径', type: 'number', default: 200, min: 100, max: 500 },
        { key: 'startAngle', label: '起始角度', type: 'number', default: 0, min: 0, max: 360 },
        { key: 'endAngle', label: '结束角度', type: 'number', default: 360, min: 0, max: 360 },
    ],
    grid: [
        { key: 'rows', label: '行数', type: 'number', default: 0, min: 0, max: 20 },
        { key: 'cols', label: '列数', type: 'number', default: 0, min: 0, max: 20 },
        { key: 'nodeSep', label: '节点间距', type: 'number', default: 50, min: 10, max: 200 },
    ],
    concentric: [
        { key: 'minNodeSpacing', label: '最小节点间距', type: 'number', default: 50, min: 10, max: 200 },
        { key: 'equidistant', label: '等距分布', type: 'checkbox', default: false },
    ],
};

// 布局类型改变
document.getElementById('layoutType').addEventListener('change', (e) => {
    currentLayout = e.target.value;
    renderLayoutParams();
});

// 渲染布局参数
function renderLayoutParams() {
    const container = document.getElementById('layoutParams');
    const params = layoutParams[currentLayout] || [];
    
    container.innerHTML = '';
    
    params.forEach(param => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.textContent = param.label;
        formGroup.appendChild(label);
        
        if (param.type === 'select') {
            const select = document.createElement('select');
            select.id = `param-${param.key}`;
            param.options.forEach(opt => {
                const option = document.createElement('option');
                option.value = opt;
                option.textContent = opt;
                if (opt === param.default) option.selected = true;
                select.appendChild(option);
            });
            formGroup.appendChild(select);
        } else if (param.type === 'checkbox') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `param-${param.key}`;
            checkbox.checked = param.default;
            formGroup.appendChild(checkbox);
        } else {
            const input = document.createElement('input');
            input.type = 'number';
            input.id = `param-${param.key}`;
            input.value = param.default;
            if (param.min !== undefined) input.min = param.min;
            if (param.max !== undefined) input.max = param.max;
            if (param.step !== undefined) input.step = param.step;
            formGroup.appendChild(input);
        }
        
        container.appendChild(formGroup);
    });
}

// 应用布局
document.getElementById('applyLayout').addEventListener('click', () => {
    if (!graph) {
        alert('请先加载数据文件');
        return;
    }

    const params = layoutParams[currentLayout] || [];
    const config = { type: currentLayout };
    
    params.forEach(param => {
        const element = document.getElementById(`param-${param.key}`);
        if (element) {
            if (param.type === 'checkbox') {
                config[param.key] = element.checked;
            } else if (param.type === 'number') {
                config[param.key] = parseFloat(element.value) || param.default;
            } else {
                config[param.key] = element.value;
            }
        }
    });
    
    // 特殊处理 force 布局
    if (currentLayout === 'force') {
        config.preventOverlap = true;
        config.nodeSize = 40;
    }
    
    try {
        layoutConfig = config;
        graph.updateLayout(config);
    } catch (error) {
        console.error('Layout error:', error);
        alert('布局应用失败: ' + error.message);
    }
});

// 清空关系
document.getElementById('clearEdges').addEventListener('click', () => {
    if (!graph || !originalData) return;

    const nodes = originalData.nodes.map(node => createNodeData(node));
    reloadGraphWithData(nodes, []);
    updateStats();
});

// 清空画布
document.getElementById('clearCanvas').addEventListener('click', () => {
    if (!graph) return;
    reloadGraphWithData([], []);
    updateStats();
});

// 隐藏节点类型
document.querySelectorAll('.hide-category').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        if (!graph || !originalData) return;

        const hiddenCategories = Array.from(document.querySelectorAll('.hide-category:checked'))
            .map(cb => parseInt(cb.value));

        const nodes = originalData.nodes
            .filter(node => !hiddenCategories.includes(node.category))
            .map(node => createNodeData(node));

        const visibleNodeIndices = new Set(nodes.map(n => n.index));
        const edges = originalData.links
            .filter(link => visibleNodeIndices.has(link.source) && visibleNodeIndices.has(link.target))
            .map((link, idx) => createEdgeData(link, idx));

        reloadGraphWithData(nodes, edges);
        updateStats();
    });
});

// 搜索模式切换
document.querySelectorAll('input[name="searchMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        document.getElementById('nodeSearch').style.display = mode === 'node' ? 'block' : 'none';
        document.getElementById('pathSearch').style.display = mode === 'path' ? 'block' : 'none';
    });
});

// 节点检索
document.getElementById('searchNodes').addEventListener('click', () => {
    if (!originalData) {
        alert('请先加载数据文件');
        return;
    }

    const keywords = document.getElementById('nodeKeywords').value.trim();
    if (!keywords) {
        alert('请输入搜索关键词');
        return;
    }

    const clearBefore = document.getElementById('clearBeforeSearch').checked;
    const keywordList = keywords.toLowerCase().split(/\s+/);

    // 过滤节点
    const matchedNodes = originalData.nodes.filter(node => {
        const nodeName = node.name.toLowerCase();
        return keywordList.every(kw => nodeName.includes(kw));
    });

    if (matchedNodes.length === 0) {
        alert('未找到匹配的节点');
        return;
    }

    let nodes, edges;

    if (clearBefore) {
        // 清空后只显示匹配节点
        nodes = matchedNodes.map(node => createNodeData(node));

        const matchedIndices = new Set(matchedNodes.map(n => n.index));
        edges = originalData.links
            .filter(link => matchedIndices.has(link.source) && matchedIndices.has(link.target))
            .map((link, idx) => createEdgeData(link, idx));
    } else {
        // 追加到现有画布
        const currentNodes = graph.getNodes().map(node => node.getModel());
        const currentEdges = graph.getEdges().map(edge => edge.getModel());
        const existingNodeIds = new Set(currentNodes.map(n => n.id));
        const existingEdgeKeys = new Set(currentEdges.map(e => `${e.source}-${e.target}`));

        const newNodes = matchedNodes
            .filter(node => !existingNodeIds.has(`node-${node.index}`))
            .map(node => createNodeData(node));

        const allNodeIndices = new Set([
            ...currentNodes.map(n => n.index),
            ...matchedNodes.map(n => n.index),
        ]);

        const newEdges = originalData.links
            .filter(link => allNodeIndices.has(link.source) && allNodeIndices.has(link.target))
            .filter(link => !existingEdgeKeys.has(`node-${link.source}-node-${link.target}`))
            .map((link, idx) => createEdgeData(link, `new-${idx}`));

        nodes = [...currentNodes, ...newNodes];
        edges = [...currentEdges, ...newEdges];
    }

    if (!graph) initGraph();
    reloadGraphWithData(nodes, edges);
    updateStats();
});

// 路径检索
document.getElementById('searchPaths').addEventListener('click', () => {
    if (!originalData) {
        alert('请先加载数据文件');
        return;
    }

    const startKeyword = document.getElementById('pathStart').value.trim().toLowerCase();
    const endKeyword = document.getElementById('pathEnd').value.trim().toLowerCase();
    const direction = document.getElementById('pathDirection').value;
    const maxHops = parseInt(document.getElementById('maxHops').value) || Infinity;
    const clearBefore = document.getElementById('clearBeforeSearch').checked;

    if (!startKeyword || !endKeyword) {
        alert('请输入起始和目标节点关键词');
        return;
    }

    // 查找匹配的起始和目标节点
    const startNodes = originalData.nodes.filter(n => n.name.toLowerCase().includes(startKeyword));
    const endNodes = originalData.nodes.filter(n => n.name.toLowerCase().includes(endKeyword));

    if (startNodes.length === 0 || endNodes.length === 0) {
        alert('未找到匹配的起始或目标节点');
        return;
    }

    // 构建邻接表
    const adjList = {};
    const reverseAdjList = {};

    originalData.nodes.forEach(node => {
        adjList[node.index] = [];
        reverseAdjList[node.index] = [];
    });

    originalData.links.forEach(link => {
        adjList[link.source].push(link.target);
        reverseAdjList[link.target].push(link.source);
    });

    // BFS 查找路径
    const pathNodes = new Set();
    const pathEdges = [];

    startNodes.forEach(startNode => {
        endNodes.forEach(endNode => {
            const paths = findPaths(startNode.index, endNode.index, adjList, reverseAdjList, direction, maxHops);
            paths.forEach(path => {
                path.forEach((nodeIdx, i) => {
                    pathNodes.add(nodeIdx);
                    if (i < path.length - 1) {
                        pathEdges.push({ source: nodeIdx, target: path[i + 1] });
                    }
                });
            });
        });
    });

    if (pathNodes.size === 0) {
        alert('未找到符合条件的路径');
        return;
    }

    let nodes, edges;

    if (clearBefore) {
        nodes = originalData.nodes
            .filter(node => pathNodes.has(node.index))
            .map(node => createNodeData(node));

        edges = pathEdges.map((edge, idx) => createEdgeData(edge, idx));
    } else {
        const currentData = graph.getData();
        const currentNodes = currentData.nodes || [];
        const currentEdges = currentData.edges || [];
        const existingNodeIds = new Set(currentNodes.map(n => n.id));
        const existingEdgeKeys = new Set(currentEdges.map(e => `${e.source}-${e.target}`));

        const newNodes = originalData.nodes
            .filter(node => pathNodes.has(node.index) && !existingNodeIds.has(`node-${node.index}`))
            .map(node => createNodeData(node));

        const newEdges = pathEdges
            .filter(edge => !existingEdgeKeys.has(`node-${edge.source}-node-${edge.target}`))
            .map((edge, idx) => createEdgeData(edge, `new-${idx}`));

        nodes = [...currentNodes, ...newNodes];
        edges = [...currentEdges, ...newEdges];
    }

    if (!graph) initGraph();
    reloadGraphWithData(nodes, edges);
    updateStats();
});

// BFS 查找路径
function findPaths(start, end, adjList, reverseAdjList, direction, maxHops) {
    const paths = [];
    
    const searchDirection = (fromNode, toNode, adjacency) => {
        const queue = [[fromNode]];
        const visited = new Set();
        
        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            if (path.length > maxHops + 1) continue;
            
            if (current === toNode) {
                paths.push([...path]);
                continue;
            }
            
            const key = path.join('-');
            if (visited.has(key)) continue;
            visited.add(key);
            
            const neighbors = adjacency[current] || [];
            neighbors.forEach(neighbor => {
                if (!path.includes(neighbor)) {
                    queue.push([...path, neighbor]);
                }
            });
        }
    };
    
    if (direction === 'directed') {
        searchDirection(start, end, adjList);
    } else if (direction === 'reverse') {
        searchDirection(start, end, reverseAdjList);
    } else if (direction === 'both') {
        const undirectedAdj = {};
        Object.keys(adjList).forEach(key => {
            const k = parseInt(key);
            undirectedAdj[k] = [...(adjList[k] || []), ...(reverseAdjList[k] || [])];
        });
        searchDirection(start, end, undirectedAdj);
    }
    
    return paths;
}

// 初始化布局参数
renderLayoutParams();

// 页面加载完成提示
console.log('Dubbo 拓扑图谱可视化工具已就绪');
