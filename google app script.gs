const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');// See https://developers.google.com/apps-script/guides/properties
const WORKING_FOLDER_NAME='AI工作流';
const PROGRESS_KEY = 'user_task_progress';// 存储进度的键名，可以使用用户session id或任务id来确保唯一性

function doGet() {
  var htmlOutput = HtmlService.createHtmlOutputFromFile('index');
  htmlOutput.setTitle('工作流');
  return htmlOutput;
}

function executeWorkflow(data,targetnodes) {
  setProgress(0);
  const workflowData = JSON.parse(data);
  if (!workflowData || typeof workflowData.nodes !== 'object') { throw new Error('无效 JSON 格式'); }
  
  //build DAG
  const graph = new Map();
  for (const nodeId in workflowData.nodes) {
      graph.set(nodeId, workflowData.nodes[nodeId].outputs.slice());
  }
  const order = topologicalSort(graph);

  targetnodes = new Set(targetnodes);
  let finished_nodes_cnt = 0;
  const total_nodes_cnt = (targetnodes.size > 0) ? targetnodes.size : workflowData.nodeIdCounter;

  //process
  order.forEach(function (nodeid) {
    ++finished_nodes_cnt;
    const cur = workflowData.nodes[nodeid];
    if (cur.type == '常数')
      return;
    if (targetnodes.size > 0 && !targetnodes.has(nodeid))
      return;

    var contents = [];
    //set input parameter
    for (const inputid of cur.inputs) {
      contents.push(
        {
          role: 'user',
          parts: [
            { text: 'reference：' + workflowData.nodes[inputid].name + '\ncontent：\n' + workflowData.nodes[inputid].content },
          ],
        });
    }
    //set history
    if (cur.usehistory == true)
      contents.push(
        {
          role: 'user',
          parts: [
            { text: 'history：' + cur.content },
          ],
        });
    else
      cur.content = 'null';
    //set current task
    contents.push({
      role: 'user',
      parts: [
        { text: cur.description },
      ],
    });
    //run AI
    var response;
    if (cur.type == '快速')
      response = Call_gemini_2_0_flash(contents);
    else if (cur.type == '标准')
      response = Call_gemini_2_5_flash(contents);
    else if (cur.type == '难题')
      response = Call_gemini_2_5_pro(contents);

    var result = JSON.parse(response);
    if (result && result.candidates && result.candidates.length > 0) {
      const str = result.candidates[0].content.parts[0].text;
      if (str) {
        if (cur.usehistory == true)
          cur.content = cur.content + '\n' + str;
        else
          cur.content = str;
      }
    }else
      throw new Error(response);
    
    setProgress(Math.round(finished_nodes_cnt*100 / total_nodes_cnt));
  });

  setProgress(100);
  return workflowData;
}




const testworkflowstr = `{
  "nodes": {
    "node-1": {
      "id": "node-1",
      "x": 732.9453125,
      "y": 173.828125,
      "name": "A",
      "description": "返回任意数字",
      "content": "",
      "type": "快速",
      "inputs": [],
      "outputs": [
        "node-2"
      ]
    },
    "node-2": {
      "id": "node-2",
      "x": 869.171875,
      "y": 296.6796875,
      "name": "B",
      "description": "返回两倍输入数字",
      "content": "",
      "type": "难题",
      "inputs": [
        "node-1"
      ],
      "outputs": []
    }
  },
  "nodeIdCounter": 3,
  "defaultNameCounter": 3
}`;

const testairesult=`{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "123"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "avgLogprobs": -0.52464914321899414
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 6,
    "candidatesTokenCount": 2,
    "totalTokenCount": 8,
    "promptTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 6
      }
    ],
    "candidatesTokensDetails": [
      {
        "modality": "TEXT",
        "tokenCount": 2
      }
    ]
  },
  "modelVersion": "gemini-2.0-flash"
}`;

function findFilesInFolder(fileName) {
  // 1. 获取文件夹对象
  var folders = DriveApp.getFoldersByName(WORKING_FOLDER_NAME);
  var folder = null;
  if (folders.hasNext()) {
    folder = folders.next();
  } else
    return null;

  //console.log(folder.getName());
  // 2. 使用文件夹对象的 searchFiles() 方法
  var searchResult = folder.searchFiles('title = "' + fileName + '"');
  var file = null;
  if (searchResult.hasNext()) {
    file = searchResult.next();
  }
  return file;
}

function test() {
  const r=executeWorkflow(testworkflowstr);
  return;
  var file=findFilesInFolder('丽塔-失落迷迭-三视图.png');
  console.log(file.getUrl())
}

function Call_gemini_2_0_flash(contents) {
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: 'text/plain',
  };

  const data = {
    generationConfig,
    contents,
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(data)
  };

  const response = UrlFetchApp.fetch(url, options);
  return response;
}

function Call_gemini_2_5_flash(contents) {
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 65536,
    responseMimeType: 'text/plain',
  };

  const data = {
    generationConfig,
    contents,
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(data)
  };

  const response = UrlFetchApp.fetch(url, options);
  return response;
}

function Call_gemini_2_5_pro(contents) {
  const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 65536,
    responseMimeType: 'text/plain',
  };

  const data = {
    generationConfig,
    contents,
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-05-06:generateContent?key=${apiKey}`;
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(data)
  };

  const response = UrlFetchApp.fetch(url, options);
  return response;
}

/**
 * 设置任务进度
 */
function setProgress(val) {
  const cache = CacheService.getUserCache();
  cache.put(PROGRESS_KEY, val, 3600);
}

/**
 * 获取当前任务进度
 * @returns {number} 当前进度 (0-100)
 */
function getProgress() {
  const cache = CacheService.getUserCache();
  const progress = cache.get(PROGRESS_KEY);

  return progress ? progress + '%' : '空闲';
}

/**
 * 删除进度缓存 (可选，在任务完成后或开始新任务前调用)
 */
function clearProgress() {
  const cache = CacheService.getUserCache();
  cache.remove(PROGRESS_KEY);
}

/**
 * 执行拓扑排序。
 *
 * @param {Map<any, any[]>} graph - 表示图的邻接列表。
 * 键是节点，值是该节点指向的相邻节点数组。
 * 例如：new Map([['A', ['B', 'C']], ['B', ['D']], ['C', ['D']], ['D', []]])
 * @returns {any[] | null} - 如果存在拓扑排序，则返回节点的排序数组；
 * 如果图包含循环，则返回 null。
 */
function topologicalSort(graph) {
  // 1. 计算每个节点的入度 (In-degree)
  //    入度是指向该节点的边的数量。
  const inDegree = new Map();
  graph.forEach((neighbors, node) => {
    // 初始化所有节点的入度为 0
    if (!inDegree.has(node)) {
      inDegree.set(node, 0);
    }
    // 增加相邻节点的入度
    neighbors.forEach(neighbor => {
      if (!inDegree.has(neighbor)) {
        inDegree.set(neighbor, 0);
      }
      inDegree.set(neighbor, inDegree.get(neighbor) + 1);
    });
  });

  // 2. 初始化一个队列，加入所有入度为 0 的节点
  const queue = [];
  inDegree.forEach((degree, node) => {
    if (degree === 0) {
      queue.push(node);
    }
  });

  // 3. 执行拓扑排序
  const result = [];
  while (queue.length > 0) {
    const currentNode = queue.shift(); // 取出队列中的第一个节点
    result.push(currentNode); // 将当前节点加入结果列表

    // 遍历当前节点的所有相邻节点
    const neighbors = graph.get(currentNode) || [];
    neighbors.forEach(neighbor => {
      // 减少相邻节点的入度
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      // 如果相邻节点的入度变为 0，将其加入队列
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }

  // 4. 检查是否存在循环
  //    如果结果列表中的节点数量不等于图中的节点总数，说明存在循环。
  if (result.length !== graph.size) {
    // 图包含循环，无法进行拓扑排序
    return null;
  }

  // 返回拓扑排序结果
  return result;
}
