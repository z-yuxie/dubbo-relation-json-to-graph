import { Graph } from '@antv/g6';

// 全局 Promise 错误处理 - 捕获 G6 内部的非关键错误
window.addEventListener('unhandledrejection', (event) => {
    // 检查是否是 G6 矩阵计算相关的错误
    if (event.reason && 
        (event.reason.message?.includes('Cannot read properties of null') ||
         event.reason.stack?.includes('mat4.js') ||
         event.reason.stack?.includes('viewport.js'))) {
        // 这是 G6 内部的已知问题，不影响功能，静默处理
        event.preventDefault();
        console.debug('G6 内部渲染警告（已忽略）:', event.reason.message);
    }
});

// 全局状态
let graph = null;
let originalData = null; // 原始完整数据
let currentVisibleData = { nodes: [], edges: [] }; // 当前可见数据（用于统计）
let currentLayout = 'force';  // 默认使用力导向布局
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
        data: {
            label: node.name || `Node ${node.index}`,
            category: node.category,
            index: node.index,
            color: categoryColors[node.category] || '#5B8FF9',
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
    };
    console.log('Created edge:', edgeData);
    return edgeData;
}

// 设置图谱事件监听
function setupGraphEvents() {
    if (!graph) return;
    
    // 监听节点悬停
    graph.on('node:pointerenter', (evt) => {
        const { target } = evt;
        if (!target || !target.id) return;
        
        console.log('Node pointerenter:', target.id);
        
        try {
            const model = graph.getNodeData(target.id);
            showTooltip(evt, model);
            
            // 设置悬停状态
            graph.setElementState(target.id, 'hover', true);
        } catch (e) {
            console.warn('Node hover error:', e);
        }
    });

    graph.on('node:pointerleave', (evt) => {
        const { target } = evt;
        if (!target || !target.id) return;
        
        console.log('Node pointerleave:', target.id);
        
        try {
            hideTooltip();
            
            // 清除悬停状态
            graph.setElementState(target.id, 'hover', false);
        } catch (e) {
            console.warn('Node leave error:', e);
        }
    });
    
    // 监听节点点击
    graph.on('node:click', (evt) => {
        console.log('Node clicked:', evt);
    });
    
    // 监听节点右键
    graph.on('node:contextmenu', (evt) => {
        evt.preventDefault();
        showNodeContextMenu(evt);
    });
    
    // 监听边右键
    graph.on('edge:contextmenu', (evt) => {
        evt.preventDefault();
        showEdgeContextMenu(evt);
    });
    
    // 监听画布点击，隐藏右键菜单
    graph.on('canvas:click', () => {
        hideContextMenus();
    });

    // 窗口大小调整
    window.addEventListener('resize', () => {
        if (graph) {
            const container = document.getElementById('container');
            graph.setSize([container.offsetWidth, container.offsetHeight]);
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
        autoFit: 'view',
        padding: [20, 20, 20, 20],
        data: { nodes: [], edges: [] },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        layout: {
            type: 'dagre',
            rankdir: 'LR',
            nodesep: 80,
            ranksep: 150,
        },
        node: {
            style: {
                size: 40,
                fill: '#5B8FF9',
                stroke: '#fff',
                lineWidth: 2,
                labelText: (d) => d.data?.label || d.id,
                labelPlacement: 'bottom',
                labelOffsetY: 10,
                labelFontSize: 12,
                labelFill: '#333',
                labelBackground: true,
                labelBackgroundFill: '#fff',
                labelBackgroundOpacity: 0.9,
                labelBackgroundRadius: 4,
                labelPadding: [4, 8],
            },
        },
        edge: {
            style: {
                stroke: '#99ADD1',
                lineWidth: 2,
                endArrow: true,
            },
        },
    });
    
    console.log('Graph initialized successfully');
    
    // 设置事件
    setupGraphEvents();
    
    // 调用render
    graph.render();
}

// 显示 Tooltip
function showTooltip(evt, model) {
    const tooltip = document.getElementById('tooltip');
    const category = model.data?.category;
    const categoryName = originalData?.categories[category]?.name || 'Unknown';
    
    tooltip.innerHTML = `
        <div><strong>${model.data?.label || model.id}</strong></div>
        <div style="margin-top: 4px; font-size: 12px; opacity: 0.9;">
            类型: ${categoryName}
        </div>
    `;
    
    tooltip.style.left = evt.client.x + 15 + 'px';
    tooltip.style.top = evt.client.y + 15 + 'px';
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
        
        // 启用重新加载按钮
        document.getElementById('reloadData').disabled = false;
        
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

// 重新加载数据
document.getElementById('reloadData').addEventListener('click', () => {
    if (!originalData) {
        alert('请先加载数据文件');
        return;
    }
    
    // 重新加载全部原始数据
    loadGraphData(originalData);
    updateStats();
    
    // 清除所有隐藏选项
    document.querySelectorAll('.hide-category').forEach(cb => cb.checked = false);
    
    alert('数据已重新加载！');
});

// 重新加载图谱数据（通用方法）
function reloadGraphWithData(nodes, edges) {
    // 保存当前可见数据用于统计
    currentVisibleData = { nodes, edges };
    
    if (graph) {
        graph.destroy();
    }
    
    const container = document.getElementById('container');
    
    // 构建布局配置
    const layoutCfg = {
        type: currentLayout || 'dagre',
        ...layoutConfig,
    };
    
    // 为不同布局类型设置默认参数
    if (layoutCfg.type === 'dagre') {
        if (!layoutCfg.rankdir) layoutCfg.rankdir = 'LR';
        if (!layoutCfg.nodesep) layoutCfg.nodesep = 80;
        if (!layoutCfg.ranksep) layoutCfg.ranksep = 150;
    } else if (layoutCfg.type === 'force') {
        layoutCfg.preventOverlap = true;
        layoutCfg.nodeSize = 40;
        if (!layoutCfg.linkDistance) layoutCfg.linkDistance = 250;
        if (!layoutCfg.nodeStrength) layoutCfg.nodeStrength = 1000;
        if (!layoutCfg.edgeStrength) layoutCfg.edgeStrength = 200;
        if (layoutCfg.collideStrength === undefined) layoutCfg.collideStrength = 1;
    } else if (layoutCfg.type === 'concentric') {
        if (!layoutCfg.nodeSize) layoutCfg.nodeSize = 40;
        if (!layoutCfg.nodeSpacing) layoutCfg.nodeSpacing = 50;
        if (layoutCfg.preventOverlap === undefined) layoutCfg.preventOverlap = true;
        if (layoutCfg.equidistant === undefined) layoutCfg.equidistant = false;
    }
    
    graph = new Graph({
        container,
        width: container.offsetWidth,
        height: container.offsetHeight,
        autoFit: 'view',
        padding: [20, 20, 20, 20],
        data: { nodes, edges },
        behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        layout: layoutCfg,
        node: {
            style: {
                size: 40,
                fill: (d) => {
                    // 如果节点被标记为高亮，使用高亮颜色
                    if (d.data?.highlighted === true) {
                        return '#FF6B6B'; // 高亮红色
                    }
                    // 如果被标记为非高亮，使用半透明颜色
                    if (d.data?.highlighted === false) {
                        const baseColor = d.data?.color || categoryColors[d.data?.category] || '#5B8FF9';
                        return baseColor + '66'; // 添加40%透明度
                    }
                    // 默认情况
                    return d.data?.color || categoryColors[d.data?.category] || '#5B8FF9';
                },
                stroke: (d) => {
                    if (d.data?.highlighted === true) {
                        return '#FF0000'; // 高亮边框
                    }
                    return '#fff';
                },
                lineWidth: (d) => {
                    if (d.data?.highlighted === true) {
                        return 3; // 高亮节点边框更粗
                    }
                    return 2;
                },
                labelText: (d) => d.data?.label || d.id,
                labelPlacement: 'bottom',
                labelOffsetY: 10,
                labelFontSize: 12,
                labelFill: (d) => {
                    if (d.data?.highlighted === false) {
                        return '#999'; // 非高亮节点的标签颜色变淡
                    }
                    return '#333';
                },
                labelBackground: true,
                labelBackgroundFill: '#fff',
                labelBackgroundOpacity: 0.9,
                labelBackgroundRadius: 4,
                labelPadding: [4, 8],
            },
        },
        edge: {
            style: {
                stroke: (d) => {
                    // 如果边被标记为高亮，使用高亮颜色
                    if (d.data?.highlighted === true) {
                        return '#FF6B6B'; // 高亮红色
                    }
                    // 如果被标记为非高亮，使用半透明颜色
                    if (d.data?.highlighted === false) {
                        return '#99ADD166'; // 添加40%透明度
                    }
                    // 默认情况
                    return '#99ADD1';
                },
                lineWidth: (d) => {
                    if (d.data?.highlighted === true) {
                        return 3; // 高亮边更粗
                    }
                    if (d.data?.highlighted === false) {
                        return 1; // 非高亮边更细
                    }
                    return 2;
                },
                endArrow: true,
            },
        },
    });
    
    setupGraphEvents();
    
    console.log('Graph instance created with data:', { nodes: nodes.length, edges: edges.length });
    
    // 调用 render 方法
    graph.render();
    
    console.log('Graph rendered');
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
        { key: 'linkDistance', label: '连线距离', type: 'number', default: 250, min: 50, max: 500 },
        { key: 'nodeStrength', label: '节点斥力强度', type: 'number', default: 1000, min: 100, max: 5000 },
        { key: 'edgeStrength', label: '边引力强度', type: 'number', default: 200, min: 50, max: 1000 },
        { key: 'collideStrength', label: '碰撞强度', type: 'number', default: 1, min: 0, max: 1, step: 0.1 },
    ],
    dagre: [
        { key: 'rankdir', label: '方向', type: 'select', default: 'TB', options: ['TB', 'BT', 'LR', 'RL'] },
        { key: 'nodesep', label: '节点间距', type: 'number', default: 50, min: 10, max: 200 },
        { key: 'ranksep', label: '层级间距', type: 'number', default: 50, min: 10, max: 200 },
    ],
    circular: [
        { key: 'radius', label: '半径', type: 'number', default: 500, min: 100, max: 1000 },
        { key: 'startAngle', label: '起始角度', type: 'number', default: 0, min: 0, max: 360 },
        { key: 'endAngle', label: '结束角度', type: 'number', default: 360, min: 0, max: 360 },
    ],
    grid: [
        { key: 'rows', label: '行数', type: 'number', default: 0, min: 0, max: 20 },
        { key: 'cols', label: '列数', type: 'number', default: 0, min: 0, max: 20 },
        { key: 'nodeSep', label: '节点间距', type: 'number', default: 50, min: 10, max: 200 },
    ],
    concentric: [
        { key: 'nodeSize', label: '节点大小', type: 'number', default: 40, min: 10, max: 100 },
        { key: 'nodeSpacing', label: '节点间距', type: 'number', default: 50, min: 10, max: 200 },
        { key: 'equidistant', label: '等距分布', type: 'checkbox', default: false },
        { key: 'preventOverlap', label: '防止重叠', type: 'checkbox', default: true },
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
        // 如果没有设置参数，使用默认值
        if (!config.linkDistance) config.linkDistance = 250;
        if (!config.nodeStrength) config.nodeStrength = 1000;
        if (!config.edgeStrength) config.edgeStrength = 200;
        if (config.collideStrength === undefined) config.collideStrength = 1;
    }
    
    try {
        layoutConfig = config;
        graph.setLayout(config);
        graph.layout();
    } catch (error) {
        console.error('Layout error:', error);
        alert('布局应用失败: ' + error.message);
    }
});

// 清空关系
document.getElementById('clearEdges').addEventListener('click', () => {
    if (!graph || !originalData) return;

    const canvasControlScope = document.getElementById('canvasControlScope').checked;
    
    if (canvasControlScope) {
        // 仅清空当前画布的关系，保留节点
        const currentData = graph.getData();
        const currentNodes = currentData.nodes || [];
        reloadGraphWithData(currentNodes, []);
    } else {
        // 清空所有关系，加载所有节点
        const nodes = originalData.nodes.map(node => createNodeData(node));
        reloadGraphWithData(nodes, []);
    }
    
    updateStats();
});

// 清空画布
document.getElementById('clearCanvas').addEventListener('click', () => {
    if (!graph) return;
    reloadGraphWithData([], []);
    updateStats();
});

// 隐藏节点类型
let canvasControlBaseData = null; // 用于"仅对当前画布"模式的基准数据

document.querySelectorAll('.hide-category').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        if (!graph || !originalData) return;

        const hiddenCategories = Array.from(document.querySelectorAll('.hide-category:checked'))
            .map(cb => parseInt(cb.value));
        
        const canvasControlScope = document.getElementById('canvasControlScope').checked;
        
        // 确定基准数据
        let baseNodes, baseLinks;
        
        if (canvasControlScope) {
            // 仅对当前画布：使用基准数据或当前画布数据
            if (!canvasControlBaseData) {
                // 第一次操作时，保存当前画布数据作为基准
                const currentData = graph.getData();
                const currentNodes = currentData.nodes || [];
                const currentEdges = currentData.edges || [];
                
                // 将当前画布数据转换回原始数据格式
                canvasControlBaseData = {
                    nodes: currentNodes.map(n => ({
                        index: n.data.index,
                        name: n.data.label,
                        category: n.data.category
                    })),
                    links: currentEdges.map(e => ({
                        source: originalData.nodes.find(node => `node-${node.index}` === e.source)?.index,
                        target: originalData.nodes.find(node => `node-${node.index}` === e.target)?.index
                    })).filter(link => link.source !== undefined && link.target !== undefined)
                };
            }
            
            baseNodes = canvasControlBaseData.nodes;
            baseLinks = canvasControlBaseData.links;
        } else {
            // 对全部数据：使用原始数据
            baseNodes = originalData.nodes;
            baseLinks = originalData.links;
            // 清空基准数据
            canvasControlBaseData = null;
        }
        
        // 从基准数据中过滤掉被隐藏的类型
        const nodes = baseNodes
            .filter(node => !hiddenCategories.includes(node.category))
            .map(node => createNodeData(node));
        
        // 获取可见节点的索引集合
        const visibleNodeIndices = new Set(nodes.map(n => n.data.index));
        
        // 只保留两个端点都可见的边
        const edges = baseLinks
            .filter(link => visibleNodeIndices.has(link.source) && visibleNodeIndices.has(link.target))
            .map((link, idx) => createEdgeData(link, idx));

        reloadGraphWithData(nodes, edges);
        updateStats();
    });
});

// 当"仅对当前画布"选项改变时，清空基准数据
document.getElementById('canvasControlScope').addEventListener('change', () => {
    canvasControlBaseData = null;
    // 如果有隐藏选项被勾选，重新触发隐藏逻辑
    const hasChecked = document.querySelectorAll('.hide-category:checked').length > 0;
    if (hasChecked) {
        // 触发第一个勾选的checkbox的change事件
        const firstChecked = document.querySelector('.hide-category:checked');
        if (firstChecked) {
            firstChecked.dispatchEvent(new Event('change'));
        }
    }
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
    const searchScope = document.getElementById('searchScope').checked; // 仅对当前画布
    const keywordList = keywords.toLowerCase().split(/\s+/);

    // 根据选项决定搜索范围
    let sourceNodes;
    if (searchScope && graph) {
        // 仅搜索当前画布中的节点
        const currentData = graph.getData();
        const currentNodes = currentData.nodes || [];
        sourceNodes = currentNodes
            .map(n => {
                // 找到对应的原始节点数据
                return originalData.nodes.find(node => node.index === n.data?.index);
            })
            .filter(node => node !== undefined);
    } else {
        // 搜索全部数据
        sourceNodes = originalData.nodes;
    }

    // 过滤节点
    const matchedNodes = sourceNodes.filter(node => {
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
        // 追加到现有画布，并高亮匹配的节点
        const currentData = graph.getData();
        const currentNodes = currentData.nodes || [];
        const currentEdges = currentData.edges || [];
        const existingNodeIds = new Set(currentNodes.map(n => n.id));
        const existingEdgeKeys = new Set(currentEdges.map(e => `${e.source}-${e.target}`));
        
        const matchedNodeIds = new Set(matchedNodes.map(n => `node-${n.index}`));

        const newNodes = matchedNodes
            .filter(node => !existingNodeIds.has(`node-${node.index}`))
            .map(node => createNodeData(node));

        const allNodeIndices = new Set([
            ...currentNodes.map(n => n.data?.index),
            ...matchedNodes.map(n => n.index),
        ]);

        const newEdges = originalData.links
            .filter(link => allNodeIndices.has(link.source) && allNodeIndices.has(link.target))
            .filter(link => !existingEdgeKeys.has(`node-${link.source}-node-${link.target}`))
            .map((link, idx) => createEdgeData(link, `new-${idx}`));

        // 合并节点，为匹配节点添加高亮样式
        nodes = currentNodes.map(node => {
            if (matchedNodeIds.has(node.id)) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        highlighted: true,
                    }
                };
            } else {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        highlighted: false,
                    }
                };
            }
        });
        
        // 添加新节点，标记为高亮
        nodes = [...nodes, ...newNodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                highlighted: true,
            }
        }))];
        
        edges = [...currentEdges, ...newEdges];
    }

    if (!graph) initGraph();
    reloadGraphWithData(nodes, edges);
    updateStats();
});

// 路径检索
document.getElementById('searchPaths').addEventListener('click', async () => {
    if (!originalData) {
        alert('请先加载数据文件');
        return;
    }

    const startKeyword = document.getElementById('pathStart').value.trim().toLowerCase();
    const endKeyword = document.getElementById('pathEnd').value.trim().toLowerCase();
    const direction = document.getElementById('pathDirection').value;
    const maxHops = parseInt(document.getElementById('maxHops').value) || 5; // 默认最大5跳，防止无限循环
    const clearBefore = document.getElementById('clearBeforeSearch').checked;
    const searchScope = document.getElementById('searchScope').checked; // 仅对当前画布

    if (!startKeyword || !endKeyword) {
        alert('请输入起始和目标节点关键词');
        return;
    }

    // 根据选项决定搜索范围
    let sourceNodes, sourceLinks;
    if (searchScope && graph) {
        // 仅搜索当前画布中的节点和边
        const currentData = graph.getData();
        const currentNodes = currentData.nodes || [];
        const currentEdges = currentData.edges || [];
        
        const currentNodeIndices = new Set(currentNodes.map(n => n.data?.index));
        
        sourceNodes = originalData.nodes.filter(node => currentNodeIndices.has(node.index));
        sourceLinks = originalData.links.filter(link => 
            currentNodeIndices.has(link.source) && currentNodeIndices.has(link.target)
        );
    } else {
        // 搜索全部数据
        sourceNodes = originalData.nodes;
        sourceLinks = originalData.links;
    }

    // 查找匹配的起始和目标节点
    const startNodes = sourceNodes.filter(n => n.name.toLowerCase().includes(startKeyword));
    const endNodes = sourceNodes.filter(n => n.name.toLowerCase().includes(endKeyword));

    if (startNodes.length === 0 || endNodes.length === 0) {
        alert('未找到匹配的起始或目标节点');
        return;
    }

    // 显示加载提示
    const searchButton = document.getElementById('searchPaths');
    const originalText = searchButton.textContent;
    searchButton.textContent = '搜索中...';
    searchButton.disabled = true;

    // 使用 setTimeout 让浏览器渲染 UI
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        // 构建邻接表（仅使用搜索范围内的边）
        const adjList = {};
        const reverseAdjList = {};

        sourceNodes.forEach(node => {
            adjList[node.index] = [];
            reverseAdjList[node.index] = [];
        });

        sourceLinks.forEach(link => {
            adjList[link.source].push(link.target);
            reverseAdjList[link.target].push(link.source);
        });

        // BFS 查找路径
        const pathNodes = new Set();
        const pathEdgesSet = new Set(); // 使用 Set 去重

        let pathCount = 0;
        const MAX_PATHS = 100; // 限制最大路径数量，防止卡顿

        for (const startNode of startNodes) {
            for (const endNode of endNodes) {
                if (pathCount >= MAX_PATHS) break;
                
                const paths = findPaths(startNode.index, endNode.index, adjList, reverseAdjList, direction, maxHops);
                
                for (const path of paths) {
                    if (pathCount >= MAX_PATHS) break;
                    pathCount++;
                    
                    for (let i = 0; i < path.length; i++) {
                        pathNodes.add(path[i]);
                        if (i < path.length - 1) {
                            pathEdgesSet.add(`${path[i]}-${path[i + 1]}`);
                        }
                    }
                }
            }
            if (pathCount >= MAX_PATHS) break;
        }

        if (pathNodes.size === 0) {
            alert('未找到符合条件的路径');
            return;
        }

        // 将 Set 转换为数组
        const pathEdges = Array.from(pathEdgesSet).map(edge => {
            const [source, target] = edge.split('-').map(Number);
            return { source, target };
        });

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
            
            // 创建匹配节点和边的ID集合
            const matchedNodeIds = new Set(
                Array.from(pathNodes).map(index => `node-${index}`)
            );
            const matchedEdgeKeys = new Set(
                pathEdges.map(edge => `node-${edge.source}-node-${edge.target}`)
            );

            const newNodes = originalData.nodes
                .filter(node => pathNodes.has(node.index) && !existingNodeIds.has(`node-${node.index}`))
                .map(node => createNodeData(node));

            const newEdges = pathEdges
                .filter(edge => !existingEdgeKeys.has(`node-${edge.source}-node-${edge.target}`))
                .map((edge, idx) => createEdgeData(edge, `new-${idx}`));

            // 合并节点，为匹配的节点添加高亮样式
            nodes = currentNodes.map(node => {
                if (matchedNodeIds.has(node.id)) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            highlighted: true,
                        }
                    };
                } else {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            highlighted: false,
                        }
                    };
                }
            });
            
            // 添加新节点，标记为高亮
            nodes = [...nodes, ...newNodes.map(node => ({
                ...node,
                data: {
                    ...node.data,
                    highlighted: true,
                }
            }))];
            
            // 合并边，为匹配的边添加高亮样式
            edges = currentEdges.map(edge => {
                const edgeKey = `${edge.source}-${edge.target}`;
                if (matchedEdgeKeys.has(edgeKey)) {
                    return {
                        ...edge,
                        data: {
                            ...edge.data,
                            highlighted: true,
                        }
                    };
                } else {
                    return {
                        ...edge,
                        data: {
                            ...edge.data,
                            highlighted: false,
                        }
                    };
                }
            });
            
            // 添加新边，标记为高亮
            edges = [...edges, ...newEdges.map(edge => ({
                ...edge,
                data: {
                    ...edge.data,
                    highlighted: true,
                }
            }))];
        }

        if (!graph) initGraph();
        reloadGraphWithData(nodes, edges);
        updateStats();
        
        if (pathCount >= MAX_PATHS) {
            alert(`找到超过 ${MAX_PATHS} 条路径，已显示前 ${MAX_PATHS} 条。请缩小搜索范围或减少最大跳数。`);
        }
    } catch (error) {
        console.error('Path search error:', error);
        alert('路径搜索失败: ' + error.message);
    } finally {
        // 恢复按钮状态
        searchButton.textContent = originalText;
        searchButton.disabled = false;
    }
});

// BFS 查找路径（优化版本）
function findPaths(start, end, adjList, reverseAdjList, direction, maxHops) {
    const paths = [];
    const MAX_PATHS_PER_PAIR = 20; // 每对起始-终点最多找20条路径
    
    const searchDirection = (fromNode, toNode, adjacency) => {
        const queue = [[fromNode]];
        const visited = new Map(); // 使用 Map 进行更高效的查找
        let foundCount = 0;
        
        while (queue.length > 0 && foundCount < MAX_PATHS_PER_PAIR) {
            const path = queue.shift();
            const current = path[path.length - 1];
            
            // 检查是否超过最大跳数
            if (path.length > maxHops + 1) continue;
            
            // 找到目标节点
            if (current === toNode) {
                paths.push([...path]);
                foundCount++;
                continue;
            }
            
            // 检查是否访问过该状态
            const stateKey = `${current}-${path.length}`;
            if (visited.has(stateKey)) continue;
            visited.set(stateKey, true);
            
            // 扩展邻居节点
            const neighbors = adjacency[current] || [];
            for (const neighbor of neighbors) {
                // 防止循环
                if (!path.includes(neighbor)) {
                    queue.push([...path, neighbor]);
                }
            }
            
            // 限制队列大小，防止内存溢出
            if (queue.length > 10000) {
                console.warn('路径搜索队列过大，停止搜索');
                break;
            }
        }
    };
    
    if (direction === 'directed') {
        searchDirection(start, end, adjList);
    } else if (direction === 'reverse') {
        searchDirection(start, end, reverseAdjList);
    } else if (direction === 'both') {
        // 构建无向图邻接表
        const undirectedAdj = {};
        Object.keys(adjList).forEach(key => {
            const k = parseInt(key);
            const uniqueNeighbors = new Set([...(adjList[k] || []), ...(reverseAdjList[k] || [])]);
            undirectedAdj[k] = Array.from(uniqueNeighbors);
        });
        searchDirection(start, end, undirectedAdj);
    }
    
    return paths;
}

// 初始化布局参数
renderLayoutParams();

// ===== 右键菜单功能 =====

// 全局变量：当前右键点击的元素
let contextMenuTarget = null;

// 隐藏所有右键菜单
function hideContextMenus() {
    document.getElementById('nodeContextMenu').style.display = 'none';
    document.getElementById('edgeContextMenu').style.display = 'none';
    contextMenuTarget = null;
}

// 显示节点右键菜单
function showNodeContextMenu(evt) {
    hideContextMenus();
    
    const menu = document.getElementById('nodeContextMenu');
    contextMenuTarget = evt.target;
    
    // 设置菜单位置
    menu.style.left = evt.client.x + 'px';
    menu.style.top = evt.client.y + 'px';
    menu.style.display = 'block';
}

// 显示边右键菜单
function showEdgeContextMenu(evt) {
    hideContextMenus();
    
    const menu = document.getElementById('edgeContextMenu');
    contextMenuTarget = evt.target;
    
    // 设置菜单位置
    menu.style.left = evt.client.x + 'px';
    menu.style.top = evt.client.y + 'px';
    menu.style.display = 'block';
}

// 隐藏边（关系）
document.getElementById('hideEdge').addEventListener('click', () => {
    if (!contextMenuTarget || !graph) return;
    
    try {
        const edgeId = contextMenuTarget.id;
        const currentData = graph.getData();
        const currentNodes = currentData.nodes || [];
        const currentEdges = currentData.edges || [];
        
        // 过滤掉被选中的边
        const filteredEdges = currentEdges.filter(edge => edge.id !== edgeId);
        
        reloadGraphWithData(currentNodes, filteredEdges);
        updateStats();
        hideContextMenus();
    } catch (e) {
        console.error('Hide edge error:', e);
        alert('隐藏关系失败: ' + e.message);
    }
});

// 隐藏节点及关联关系
document.getElementById('hideNode').addEventListener('click', () => {
    if (!contextMenuTarget || !graph) return;
    
    try {
        const nodeId = contextMenuTarget.id;
        const currentData = graph.getData();
        const currentNodes = currentData.nodes || [];
        const currentEdges = currentData.edges || [];
        
        // 过滤掉被选中的节点
        const filteredNodes = currentNodes.filter(node => node.id !== nodeId);
        
        // 过滤掉与该节点相关的边
        const filteredEdges = currentEdges.filter(edge => 
            edge.source !== nodeId && edge.target !== nodeId
        );
        
        reloadGraphWithData(filteredNodes, filteredEdges);
        updateStats();
        hideContextMenus();
    } catch (e) {
        console.error('Hide node error:', e);
        alert('隐藏节点失败: ' + e.message);
    }
});

// 从节点过滤路径
document.getElementById('filterFromNode').addEventListener('click', () => {
    if (!contextMenuTarget || !graph) return;
    
    try {
        const nodeId = contextMenuTarget.id;
        const nodeData = graph.getNodeData(nodeId);
        
        // 设置弹窗中的起始节点
        document.getElementById('filterStartNode').value = nodeData.data.label;
        document.getElementById('filterStartNode').dataset.nodeId = nodeId;
        document.getElementById('filterStartNode').dataset.nodeIndex = nodeData.data.index;
        
        // 显示弹窗
        document.getElementById('pathFilterModal').style.display = 'flex';
        hideContextMenus();
    } catch (e) {
        console.error('Filter from node error:', e);
        alert('打开过滤弹窗失败: ' + e.message);
    }
});

// 关闭路径过滤弹窗
function closePathFilterModal() {
    document.getElementById('pathFilterModal').style.display = 'none';
}

document.getElementById('closePathFilterModal').addEventListener('click', closePathFilterModal);
document.getElementById('cancelPathFilter').addEventListener('click', closePathFilterModal);

// 应用路径过滤
document.getElementById('applyPathFilter').addEventListener('click', async () => {
    const startNodeIndex = parseInt(document.getElementById('filterStartNode').dataset.nodeIndex);
    const direction = document.getElementById('filterDirection').value;
    const maxHops = parseInt(document.getElementById('filterMaxHops').value);
    const displayMode = document.querySelector('input[name="filterDisplayMode"]:checked').value;
    
    if (isNaN(startNodeIndex)) {
        alert('无效的起始节点');
        return;
    }
    
    try {
        // 获取当前画布数据
        const currentData = graph.getData();
        let currentNodes = currentData.nodes || [];
        let currentEdges = currentData.edges || [];
        
        // 清除所有节点和边的高亮状态（移除 highlighted 属性）
        currentNodes = currentNodes.map(node => {
            const { highlighted, ...restData } = node.data || {};
            return {
                ...node,
                data: restData
            };
        });
        
        currentEdges = currentEdges.map(edge => {
            const { highlighted, ...restData } = edge.data || {};
            return {
                ...edge,
                data: restData
            };
        });
        
        const currentNodeIndices = new Set(currentNodes.map(n => n.data?.index));
        
        // 从原始数据中获取当前画布的节点和边
        const sourceNodes = originalData.nodes.filter(node => currentNodeIndices.has(node.index));
        const sourceLinks = originalData.links.filter(link => 
            currentNodeIndices.has(link.source) && currentNodeIndices.has(link.target)
        );
        
        // 构建邻接表
        const adjList = {};
        const reverseAdjList = {};
        
        sourceNodes.forEach(node => {
            adjList[node.index] = [];
            reverseAdjList[node.index] = [];
        });
        
        sourceLinks.forEach(link => {
            adjList[link.source].push(link.target);
            reverseAdjList[link.target].push(link.source);
        });
        
        // 根据方向选择邻接表
        let selectedAdjList;
        if (direction === 'outgoing') {
            selectedAdjList = adjList;
        } else if (direction === 'incoming') {
            selectedAdjList = reverseAdjList;
        } else { // both
            // 构建无向图邻接表
            selectedAdjList = {};
            Object.keys(adjList).forEach(key => {
                const k = parseInt(key);
                const uniqueNeighbors = new Set([...(adjList[k] || []), ...(reverseAdjList[k] || [])]);
                selectedAdjList[k] = Array.from(uniqueNeighbors);
            });
        }
        
        // BFS 查找指定跳数内可达的节点
        const reachableNodes = new Set([startNodeIndex]);
        const queue = [{ nodeIndex: startNodeIndex, hops: 0 }];
        const visited = new Set([startNodeIndex]);
        
        while (queue.length > 0) {
            const { nodeIndex, hops } = queue.shift();
            
            if (hops >= maxHops) continue;
            
            const neighbors = selectedAdjList[nodeIndex] || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    reachableNodes.add(neighbor);
                    queue.push({ nodeIndex: neighbor, hops: hops + 1 });
                }
            }
        }
        
        // 根据显示模式处理
        if (displayMode === 'highlight') {
            // 高亮模式：保留所有节点，高亮匹配的
            const nodes = currentNodes.map(node => {
                const isReachable = reachableNodes.has(node.data.index);
                return {
                    ...node,
                    data: {
                        ...node.data,
                        highlighted: isReachable,
                    }
                };
            });
            
            const edges = currentEdges.map(edge => {
                const sourceIndex = sourceNodes.find(n => `node-${n.index}` === edge.source)?.index;
                const targetIndex = sourceNodes.find(n => `node-${n.index}` === edge.target)?.index;
                const isReachable = reachableNodes.has(sourceIndex) && reachableNodes.has(targetIndex);
                return {
                    ...edge,
                    data: {
                        ...edge.data,
                        highlighted: isReachable,
                    }
                };
            });
            
            reloadGraphWithData(nodes, edges);
        } else {
            // 隐藏其他模式：只显示匹配的节点和边
            const nodes = currentNodes.filter(node => reachableNodes.has(node.data.index));
            const nodeIdSet = new Set(nodes.map(n => n.id));
            const edges = currentEdges.filter(edge => 
                nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
            );
            
            reloadGraphWithData(nodes, edges);
        }
        
        updateStats();
        closePathFilterModal();
        
        const resultMsg = displayMode === 'highlight' 
            ? `已高亮 ${reachableNodes.size} 个可达节点`
            : `已过滤出 ${reachableNodes.size} 个可达节点`;
        console.log(resultMsg);
        
    } catch (e) {
        console.error('Apply path filter error:', e);
        alert('应用过滤失败: ' + e.message);
    }
});

// 点击弹窗背景关闭
document.getElementById('pathFilterModal').addEventListener('click', (e) => {
    if (e.target.id === 'pathFilterModal') {
        closePathFilterModal();
    }
});

// 页面点击隐藏右键菜单
document.addEventListener('click', () => {
    hideContextMenus();
});

// 页面加载完成提示
console.log('Dubbo 拓扑图谱可视化工具已就绪（包含右键菜单功能）');
