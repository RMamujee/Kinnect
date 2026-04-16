/**
 * Converts persons/families from the store into React Flow nodes + edges
 * with a simple generational layout.
 */

import type { Node, Edge } from 'reactflow';
import type { Person, Family } from '@/lib/types';
import type { PersonNodeData } from './PersonNode';

const NODE_WIDTH = 176;  // w-44
const NODE_HEIGHT = 110;
const H_GAP = 32;
const V_GAP = 80;

export function buildTreeLayout(
  rootPersonId: string,
  persons: Record<string, Person>,
  families: Record<string, Family>,
  selectedPersonId: string | null,
  onSelect: (id: string) => void,
  onSearchRecords: (id: string) => void,
): { nodes: Node<PersonNodeData>[]; edges: Edge[] } {
  const nodes: Node<PersonNodeData>[] = [];
  const edges: Edge[] = [];
  const placed = new Set<string>();

  // BFS upward (ancestors) then downward (descendants)
  const generationMap = new Map<string, number>(); // personId -> generation (0=root, +1=parent gen)
  generationMap.set(rootPersonId, 0);

  const queue: string[] = [rootPersonId];
  while (queue.length > 0) {
    const personId = queue.shift()!;
    const gen = generationMap.get(personId)!;

    // Find parents
    const parentFamily = Object.values(families).find(f => f.childIds.includes(personId));
    if (parentFamily) {
      [parentFamily.spouse1Id, parentFamily.spouse2Id].forEach(pid => {
        if (pid && !generationMap.has(pid)) {
          generationMap.set(pid, gen + 1);
          queue.push(pid);
        }
      });
    }

    // Find children
    const spouseFamily = Object.values(families).find(
      f => (f.spouse1Id === personId || f.spouse2Id === personId) &&
            f.childIds.length > 0
    );
    if (spouseFamily) {
      spouseFamily.childIds.forEach(cid => {
        if (!generationMap.has(cid)) {
          generationMap.set(cid, gen - 1);
          queue.push(cid);
        }
      });
      // Also place spouse at same level
      const spouseId = spouseFamily.spouse1Id === personId ? spouseFamily.spouse2Id : spouseFamily.spouse1Id;
      if (spouseId && !generationMap.has(spouseId)) {
        generationMap.set(spouseId, gen);
        queue.push(spouseId);
      }
    }
  }

  // Group by generation
  const genGroups = new Map<number, string[]>();
  generationMap.forEach((gen, pid) => {
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(pid);
  });

  const maxGen = Math.max(...genGroups.keys());
  const minGen = Math.min(...genGroups.keys());

  // Assign x/y positions
  const personPositions = new Map<string, { x: number; y: number }>();

  genGroups.forEach((personIds, gen) => {
    const y = (maxGen - gen) * (NODE_HEIGHT + V_GAP);
    const totalWidth = personIds.length * (NODE_WIDTH + H_GAP) - H_GAP;
    const startX = -totalWidth / 2;
    personIds.forEach((pid, i) => {
      personPositions.set(pid, {
        x: startX + i * (NODE_WIDTH + H_GAP),
        y,
      });
    });
  });

  // Build nodes for connected persons
  generationMap.forEach((gen, personId) => {
    const person = persons[personId];
    if (!person) return;
    const pos = personPositions.get(personId) ?? { x: 0, y: 0 };

    nodes.push({
      id: personId,
      type: 'personNode',
      position: pos,
      data: {
        person,
        isRoot: personId === rootPersonId,
        isSelected: personId === selectedPersonId,
        onSelect,
        onSearchRecords,
      },
    });
  });

  // Place any persons not reachable from root via family links in a floating row below the tree
  const disconnectedIds = Object.keys(persons).filter(id => !generationMap.has(id));
  if (disconnectedIds.length > 0) {
    let maxY = 0;
    personPositions.forEach(pos => { maxY = Math.max(maxY, pos.y); });
    const floatY = maxY + NODE_HEIGHT + V_GAP * 3;
    const totalW = disconnectedIds.length * (NODE_WIDTH + H_GAP) - H_GAP;
    const startX = -totalW / 2;

    disconnectedIds.forEach((pid, i) => {
      const person = persons[pid];
      if (!person) return;
      const pos = { x: startX + i * (NODE_WIDTH + H_GAP), y: floatY };
      personPositions.set(pid, pos);
      nodes.push({
        id: pid,
        type: 'personNode',
        position: pos,
        data: {
          person,
          isRoot: false,
          isSelected: pid === selectedPersonId,
          onSelect,
          onSearchRecords,
        },
      });
    });
  }

  // Build edges from families
  Object.values(families).forEach(family => {
    const { spouse1Id, spouse2Id, childIds } = family;

    // Parent-child edges
    childIds.forEach(childId => {
      if (!generationMap.has(childId)) return;
      [spouse1Id, spouse2Id].forEach(parentId => {
        if (!parentId || !generationMap.has(parentId)) return;
        edges.push({
          id: `${parentId}->${childId}`,
          source: parentId,
          target: childId,
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 1.5 },
          animated: false,
        });
      });
    });

    // Spouse edge (horizontal dashed)
    if (spouse1Id && spouse2Id && generationMap.has(spouse1Id) && generationMap.has(spouse2Id)) {
      edges.push({
        id: `${spouse1Id}--${spouse2Id}`,
        source: spouse1Id,
        target: spouse2Id,
        type: 'straight',
        style: { stroke: '#e879f9', strokeWidth: 1.5, strokeDasharray: '4 3' },
      });
    }
  });

  return { nodes, edges };
}
