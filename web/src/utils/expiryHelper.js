export const COLOR_PRESETS = [
  { name: 'Đỏ', textColor: '#e11d48', bgColor: '#ffe4e6', borderColor: '#fecdd3' },
  { name: 'Cam đỏ', textColor: '#ea580c', bgColor: '#ffedd5', borderColor: '#fed7aa' },
  { name: 'Cam vàng', textColor: '#d97706', bgColor: '#fef3c7', borderColor: '#fde68a' },
  { name: 'Vàng', textColor: '#ca8a04', bgColor: '#fef9c3', borderColor: '#fef08a' },
  { name: 'Xanh lam', textColor: '#0284c7', bgColor: '#e0f2fe', borderColor: '#bae6fd' },
  { name: 'Chàm', textColor: '#4f46e5', bgColor: '#e0e7ff', borderColor: '#c7d2fe' },
  { name: 'Tím', textColor: '#7c3aed', bgColor: '#ede9fe', borderColor: '#ddd6fe' },
  { name: 'Hồng', textColor: '#C5299B', bgColor: '#fdf2fa', borderColor: '#f5c6e8' },
  { name: 'Xanh lá', textColor: '#059669', bgColor: '#ecfdf5', borderColor: '#a7f3d0' },
  { name: 'Xám', textColor: '#475569', bgColor: '#f1f5f9', borderColor: '#cbd5e1' },
];

export const DEFAULT_EXPIRY_MILESTONES = [
  {
    id: 'expired',
    days: 0,
    label: 'Đã quá hạn',
    textColor: '#e11d48',
    bgColor: '#ffe4e6',
    borderColor: '#fecdd3',
    isExpired: true,
  },
  {
    id: 'm1',
    days: 3,
    label: 'Khẩn cấp (<= 3 ngày)',
    textColor: '#ea580c',
    bgColor: '#ffedd5',
    borderColor: '#fed7aa',
  },
  {
    id: 'm2',
    days: 7,
    label: 'Sắp hết hạn (<= 7 ngày)',
    textColor: '#d97706',
    bgColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  {
    id: 'm3',
    days: 15,
    label: 'Cần lưu ý (<= 15 ngày)',
    textColor: '#ca8a04',
    bgColor: '#fef9c3',
    borderColor: '#fef08a',
  },
  {
    id: 'm4',
    days: 30,
    label: 'Cảnh báo sớm (<= 30 ngày)',
    textColor: '#0284c7',
    bgColor: '#e0f2fe',
    borderColor: '#bae6fd',
  },
  {
    id: 'safe',
    days: 99999,
    label: 'Còn hạn an toàn (> 30 ngày)',
    textColor: '#059669',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    isSafe: true,
  },
];

export function parseExpiryMilestones(raw) {
  if (!raw) return DEFAULT_EXPIRY_MILESTONES;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.error('Error parsing expiry milestones:', e);
  }
  return DEFAULT_EXPIRY_MILESTONES;
}

export function getExpiryBadgeInfo(daysRemaining, milestonesConfig) {
  const milestones = parseExpiryMilestones(milestonesConfig);
  const days = Number(daysRemaining);

  // 1. Quá hạn
  if (days < 0) {
    const expiredM = milestones.find((m) => m.isExpired) || milestones[0];
    return {
      text: `Quá hạn ${Math.abs(days)} ngày`,
      label: expiredM.label || 'Đã quá hạn',
      textColor: expiredM.textColor || '#e11d48',
      bgColor: expiredM.bgColor || '#ffe4e6',
      borderColor: expiredM.borderColor || '#fecdd3',
      icon: 'alert',
      isExpired: true,
    };
  }

  // 2. Warning milestones sorted ascending by days
  const warningList = milestones
    .filter((m) => !m.isExpired && !m.isSafe && Number(m.days) >= 0)
    .sort((a, b) => Number(a.days) - Number(b.days));

  for (const m of warningList) {
    if (days <= Number(m.days)) {
      return {
        text: `Còn ${days} ngày`,
        label: m.label || `Còn <= ${m.days} ngày`,
        textColor: m.textColor || '#d97706',
        bgColor: m.bgColor || '#fef3c7',
        borderColor: m.borderColor || '#fde68a',
        icon: Number(m.days) <= 3 ? 'alert' : 'clock',
        isWarning: true,
      };
    }
  }

  // 3. Còn hạn an toàn
  const safeM = milestones.find((m) => m.isSafe) || milestones[milestones.length - 1];
  return {
    text: `Còn ${days} ngày`,
    label: safeM.label || 'Còn hạn an toàn',
    textColor: safeM.textColor || '#059669',
    bgColor: safeM.bgColor || '#ecfdf5',
    borderColor: safeM.borderColor || '#a7f3d0',
    icon: 'check',
    isSafe: true,
  };
}
