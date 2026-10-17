// Single source of truth for priority colors (used by the chart AND the export).
export const PRIORITY = {
  critical: {
    value: 'critical',
    label: 'Critical',
    bar: '#ef4444',
    fill: '#991b1b',
    dot: '#ef4444',
    badge: 'bg-red-100 text-red-700',
  },
  normal: {
    value: 'normal',
    label: 'Normal',
    bar: '#3b82f6',
    fill: '#1e40af',
    dot: '#3b82f6',
    badge: 'bg-blue-100 text-blue-700',
  },
};

export function priorityOf(priority) {
  return PRIORITY[priority] || PRIORITY.normal;
}
