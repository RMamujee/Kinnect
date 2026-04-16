'use client';

import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
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

  const { nodes, edges } = useMemo(() => {
    if (!rootPersonId) return { nodes: [], edges: [] };
    return buildTreeLayout(
      rootPersonId,
      persons,
      families,
      selectedPersonId,
      setSelectedPerson,
      onSearchRecords,
    );
  }, [rootPersonId, persons, families, selectedPersonId, setSelectedPerson, onSearchRecords]);

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
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
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
        <button onClick={() => zoomIn()} className="tree-control-btn" title="Zoom in"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => zoomOut()} className="tree-control-btn" title="Zoom out"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={() => fitView({ padding: 0.2 })} className="tree-control-btn" title="Fit view"><Maximize2 className="w-4 h-4" /></button>
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
