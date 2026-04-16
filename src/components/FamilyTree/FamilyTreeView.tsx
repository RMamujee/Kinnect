'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  MiniMap,
  Panel,
  useReactFlow,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  type NodeTypes,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ZoomIn, ZoomOut, Maximize2, LayoutGrid } from 'lucide-react';
import { useGenealogyStore } from '@/store/genealogyStore';
import { PersonNode } from './PersonNode';
import { buildTreeLayout } from './treeLayout';

const nodeTypes: NodeTypes = { personNode: PersonNode };

function FamilyTreeInner({ onSearchRecords }: { onSearchRecords: (personId: string) => void }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const {
    persons, families, rootPersonId, selectedPersonId, setSelectedPerson,
  } = useGenealogyStore(s => ({
    persons: s.persons,
    families: s.families,
    rootPersonId: s.rootPersonId,
    selectedPersonId: s.selectedPersonId,
    setSelectedPerson: s.setSelectedPerson,
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Track which node IDs exist so we know when structure changes (added/removed persons)
  const structureKey = useMemo(() => {
    const pKeys = Object.keys(persons).sort().join(',');
    const fKeys = Object.keys(families).sort().join(',');
    return `${pKeys}|${fKeys}`;
  }, [persons, families]);

  // Rebuild layout when tree structure changes; preserve drag positions for existing nodes
  useEffect(() => {
    if (!rootPersonId || Object.keys(persons).length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const { nodes: newNodes, edges: newEdges } = buildTreeLayout(
      rootPersonId, persons, families,
      selectedPersonId, setSelectedPerson, onSearchRecords,
    );

    // Preserve any positions the user has set by dragging
    setNodes(prev => {
      const prevPos = Object.fromEntries(prev.map(n => [n.id, n.position]));
      return newNodes.map(n => ({
        ...n,
        position: prevPos[n.id] ?? n.position,
      }));
    });

    setEdges(newEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPersonId, structureKey]);   // intentionally omit selectedPersonId – see next effect

  // Update the isSelected flag without touching positions
  useEffect(() => {
    setNodes(prev =>
      prev.map(n => ({
        ...n,
        data: { ...n.data, isSelected: n.id === selectedPersonId },
      }))
    );
  }, [selectedPersonId, setNodes]);

  // Auto-organise: recompute layout from scratch and reset all positions
  const handleAutoOrganize = useCallback(() => {
    if (!rootPersonId) return;
    const { nodes: n, edges: e } = buildTreeLayout(
      rootPersonId, persons, families,
      selectedPersonId, setSelectedPerson, onSearchRecords,
    );
    setNodes(n);
    setEdges(e);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [rootPersonId, persons, families, selectedPersonId, setSelectedPerson, onSearchRecords, setNodes, setEdges, fitView]);

  if (!rootPersonId || Object.keys(persons).length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>No tree data yet. Complete onboarding to get started.</p>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      nodesDraggable
      attributionPosition="bottom-right"
    >
      <Background color="#e2e8f0" gap={20} size={1} />
      <MiniMap
        nodeColor={node => {
          const gender = (node.data as { person: { gender: string } })?.person?.gender;
          return gender === 'male' ? '#bfdbfe' : gender === 'female' ? '#fbcfe8' : '#e2e8f0';
        }}
        maskColor="rgba(255,255,255,0.7)"
        className="!rounded-xl !border !border-gray-200"
      />
      <Panel position="bottom-left" className="flex flex-col gap-1 mb-4 ml-2">
        <button onClick={() => zoomIn()} className="tree-control-btn" title="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button onClick={() => zoomOut()} className="tree-control-btn" title="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button onClick={() => fitView({ padding: 0.2 })} className="tree-control-btn" title="Fit view">
          <Maximize2 className="w-4 h-4" />
        </button>
        <button onClick={handleAutoOrganize} className="tree-control-btn" title="Auto-organize layout">
          <LayoutGrid className="w-4 h-4" />
        </button>
      </Panel>
    </ReactFlow>
  );
}

export function FamilyTreeView({ onSearchRecords }: { onSearchRecords: (personId: string) => void }) {
  return (
    <ReactFlowProvider>
      <div className="flex-1 h-full">
        <FamilyTreeInner onSearchRecords={onSearchRecords} />
      </div>
    </ReactFlowProvider>
  );
}
