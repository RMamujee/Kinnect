'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ZoomIn, ZoomOut, Maximize2, LayoutGrid, Download, Loader2 } from 'lucide-react';
import { useGenealogyStore } from '@/store/genealogyStore';
import { PersonNode } from './PersonNode';
import { buildTreeLayout } from './treeLayout';

const nodeTypes: NodeTypes = { personNode: PersonNode };

async function exportToPDF(
  containerEl: HTMLElement,
  fitViewFn: (opts?: { padding?: number; duration?: number }) => void,
  onDone: () => void,
) {
  fitViewFn({ padding: 0.12, duration: 300 });
  await new Promise(r => setTimeout(r, 450));

  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  const canvas = await html2canvas(containerEl, {
    scale: 1.5,
    useCORS: true,
    logging: false,
    backgroundColor: '#f1f5f9',
  });

  const imgW = canvas.width;
  const imgH = canvas.height;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [imgW / 1.5, imgH / 1.5] });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgW / 1.5, imgH / 1.5);
  pdf.save('kinnect-family-tree.pdf');
  onDone();
}

function FamilyTreeInner({ onSearchRecords }: { onSearchRecords: (personId: string) => void }) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [exporting, setExporting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    persons, families, rootPersonId, selectedPersonId, setSelectedPerson, deletePerson,
  } = useGenealogyStore(s => ({
    persons: s.persons,
    families: s.families,
    rootPersonId: s.rootPersonId,
    selectedPersonId: s.selectedPersonId,
    setSelectedPerson: s.setSelectedPerson,
    deletePerson: s.deletePerson,
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Intercept ReactFlow's built-in Delete-key removal so it goes through the store
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const nonRemove = changes.filter(c => {
      if (c.type === 'remove') {
        deletePerson(c.id);
        return false;
      }
      return true;
    });
    if (nonRemove.length > 0) onNodesChange(nonRemove);
  }, [onNodesChange, deletePerson]);

  // Track structural changes: person keys + image presence + family membership
  const structureKey = useMemo(() => {
    const pKeys = Object.keys(persons).sort().join(',');
    const pImages = Object.values(persons)
      .filter(p => p.profileImageUrl)
      .map(p => p.id)
      .sort()
      .join(',');
    const fData = Object.values(families)
      .map(f => `${f.id}:${f.spouse1Id ?? ''}:${f.spouse2Id ?? ''}:${f.childIds.join(':')}`)
      .sort()
      .join('|');
    return `${pKeys}|${pImages}|${fData}`;
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

  function handleExportPDF() {
    const el = containerRef.current;
    if (!el || exporting) return;
    setExporting(true);
    exportToPDF(el, fitView, () => setExporting(false)).catch(() => setExporting(false));
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
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
          pannable
          zoomable
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
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="tree-control-btn"
            title="Download tree as PDF"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </button>
        </Panel>
      </ReactFlow>
    </div>
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
