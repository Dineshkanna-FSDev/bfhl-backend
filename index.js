const express = require("express");
const cors = require("cors");
const PORT = process.env.PORT || 5000;
const app = express();
app.use(cors());
app.use(express.json());

/**
 * Validate edge format: A->B
 */
function isValidEdge(edge) {
  if (typeof edge !== "string") return false;
  const trimmed = edge.trim();

  const regex = /^[A-Z]->[A-Z]$/;
  if (!regex.test(trimmed)) return false;

  const [p, c] = trimmed.split("->");
  if (p === c) return false;

  return true;
}

/**
 * Build tree recursively
 */
function buildTree(node, graph, visited) {
  if (visited.has(node)) return {};

  visited.add(node);
  let obj = {};

  for (let child of (graph[node] || [])) {
    obj[child] = buildTree(child, graph, visited);
  }

  return obj;
}

/**
 * Get depth of tree
 */
function getDepth(node, graph) {
  if (!graph[node] || graph[node].length === 0) return 1;

  let max = 0;
  for (let child of graph[node]) {
    max = Math.max(max, getDepth(child, graph));
  }
  return max + 1;
}

/**
 * Detect cycle using DFS
 */
function hasCycle(node, graph, visited, recStack) {
  if (!visited.has(node)) {
    visited.add(node);
    recStack.add(node);

    for (let child of (graph[node] || [])) {
      if (!visited.has(child) && hasCycle(child, graph, visited, recStack)) {
        return true;
      } else if (recStack.has(child)) {
        return true;
      }
    }
  }

  recStack.delete(node);
  return false;
}

app.post("/bfhl", (req, res) => {
  const { data } = req.body;

  let validEdges = [];
  let invalidEntries = [];
  let duplicateEdges = [];
  let seen = new Set();

  // Step 1: Validate + duplicate handling
  data.forEach((item) => {
    const edge = item.trim();

    if (!isValidEdge(edge)) {
      invalidEntries.push(item);
    } else {
      if (seen.has(edge)) {
        if (!duplicateEdges.includes(edge)) duplicateEdges.push(edge);
      } else {
        seen.add(edge);
        validEdges.push(edge);
      }
    }
  });

  // Step 2: Build graph
  const graph = {};
  const childSet = new Set();
  const parentMap = {};

  validEdges.forEach((edge) => {
    const [p, c] = edge.split("->");

    // Multi-parent handling: ignore later parents
    if (parentMap[c]) return;
    parentMap[c] = p;

    if (!graph[p]) graph[p] = [];
    graph[p].push(c);

    childSet.add(c);
  });

  // Collect all nodes
  let nodes = new Set();
  validEdges.forEach(e => {
    const [p, c] = e.split("->");
    nodes.add(p);
    nodes.add(c);
  });

  let hierarchies = [];
  let totalTrees = 0;
  let totalCycles = 0;
  let maxDepth = 0;
  let largestRoot = null;

  let visitedGlobal = new Set();

  // Step 3: Process each connected component
  nodes.forEach((node) => {
    if (visitedGlobal.has(node)) return;

    let componentNodes = new Set();

    // DFS to get component
    function dfs(n) {
      if (componentNodes.has(n)) return;
      componentNodes.add(n);

      for (let child of (graph[n] || [])) {
        dfs(child);
      }

      // also check reverse edges (important)
      for (let parent in graph) {
        if ((graph[parent] || []).includes(n)) {
          dfs(parent);
        }
      }
    }

    dfs(node);

    componentNodes.forEach(n => visitedGlobal.add(n));

    // Find root
    let rootCandidates = [...componentNodes].filter(n => !childSet.has(n));
    let root = rootCandidates.length
      ? rootCandidates.sort()[0]
      : [...componentNodes].sort()[0];

    let visited = new Set();
    let recStack = new Set();

    let cycle = hasCycle(root, graph, visited, recStack);

    if (cycle) {
      hierarchies.push({
        root,
        tree: {},
        has_cycle: true
      });
      totalCycles++;
    } else {
      let tree = {};
      tree[root] = buildTree(root, graph, new Set());

      let depth = getDepth(root, graph);

      if (
        depth > maxDepth ||
        (depth === maxDepth && root < largestRoot)
      ) {
        maxDepth = depth;
        largestRoot = root;
      }

      hierarchies.push({
        root,
        tree,
        depth
      });

      totalTrees++;
    }
  });

  res.json({
    user_id: "dineshkanna_10062006",
    email_id: "dk3139@srmist.edu.in",
    college_roll_number: "RA2311008050010",
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestRoot
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});