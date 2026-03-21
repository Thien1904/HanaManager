// src/utils/styles.ts
// CSS class constants dùng chung cho toàn project
// Import vào bất kỳ component nào cần dùng lại

// Input / select / textarea
export const cls = {
  input:    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400',
  select:   'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400',
  textarea: 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none',
  label:    'block text-sm font-medium text-gray-700 mb-1',

  // Buttons
  btnPrimary:   'px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition disabled:opacity-50',
  btnSecondary: 'px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition',
  btnDanger:    'px-4 py-2 text-sm bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition',
  btnBlue:      'px-4 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition',
  btnGreen:     'px-4 py-2 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition',

  // Badges trạng thái
  badgeGreen:  'px-2 py-1 text-xs bg-green-100 text-green-600 rounded-md',
  badgeRed:    'px-2 py-1 text-xs bg-red-100 text-red-600 rounded-md',
  badgeOrange: 'px-2 py-1 text-xs bg-orange-100 text-orange-600 rounded-md',
  badgeGray:   'px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded-md',
  badgeBlue:   'px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-md',
  badgePurple: 'px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-md',

  // Table
  table:    'w-full text-sm',
  thead:    'bg-gray-50 border-b border-gray-200',
  th:       'text-left px-4 py-3 font-medium text-gray-600',
  td:       'px-4 py-3',
  tr:       'hover:bg-gray-50 transition border-b border-gray-100',
  tableWrap: 'bg-white rounded-xl border border-gray-200 overflow-hidden',

  // Filter bar input (search)
  searchInput: 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400',

  // Filter tab button — dùng với filterTab() function bên dưới
  filterTabActive:   'px-3 py-1.5 rounded-lg text-sm transition bg-orange-500 text-white',
  filterTabInactive: 'px-3 py-1.5 rounded-lg text-sm transition bg-gray-100 text-gray-600 hover:bg-gray-200',
}

/**
 * filterTab — trả về class cho filter tab button tùy active hay không
 * Dùng: className={filterTab(filter === 'all')}
 */
export function filterTab(active: boolean) {
  return active ? cls.filterTabActive : cls.filterTabInactive
}