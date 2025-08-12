import { originalData } from './data.js';
import { showConfirmationModal, hideAiSummary, downloadMarkdownFile, hideConfirmationModal, showApiKeyModal, hideApiKeyModal, saveApiKey, generateMarketSummary, generateWatchlistSummary, userApiKey, showAiSummary, symbolToAnalyze } from './ai.js';

export let watchlist = JSON.parse(localStorage.getItem('qqqWatchlist')) || [];
let currentView = 'all';
export let currentSort = { key: 'MarketCap', order: 'desc' };
let currentPage = 1;
const itemsPerPage = 20;

export function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function toggleTheme() {
  const htmlEl = document.documentElement;
  htmlEl.classList.toggle('dark');
  const theme = htmlEl.classList.contains('dark') ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
}

export function updateSortIcons() {
  document.querySelectorAll('th[data-sort]').forEach(header => {
    const icon = header.querySelector('.sort-icon');
    if (!icon) return;
    icon.classList.remove('asc', 'desc');
    if (header.dataset.sort === currentSort.key) {
      icon.classList.add(currentSort.order);
    }
  });
}

export function updateTable() {
  updateSortIcons();
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const activeData = originalData.filter(stock => stock.Status === 'Active');
  let dataToProcess = activeData;
  const watchlistSummaryBtn = document.getElementById('watchlistSummaryBtn');
  if (currentView === 'watchlist') {
    dataToProcess = activeData.filter(stock => watchlist.includes(stock.StockName));
    watchlistSummaryBtn.classList.remove('hidden');
  } else {
    watchlistSummaryBtn.classList.add('hidden');
  }
  const filteredData = dataToProcess.filter(stock => stock.StockName.toLowerCase().includes(searchTerm));
  const sortedData = [...filteredData].sort((a, b) => {
    const key = currentSort.key;
    const order = currentSort.order;
    let valA = a[key];
    let valB = b[key];
    if (key === 'StockName' || key === 'LatestDay') {
      return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    } else {
      return order === 'asc' ? valA - valB : valB - valA;
    }
  });
  renderTablePage(sortedData);
  renderPagination(sortedData.length);
}

function renderTablePage(fullData) {
  const tableBody = document.getElementById('stockTableBody');
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageData = fullData.slice(startIndex, endIndex);
  if (pageData.length === 0) {
    const message = currentView === 'watchlist' ? '您的收藏清單是空的。點擊 ☆ 來新增股票。' : '沒有符合條件的股票。';
    tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-gray-400">${message}</td></tr>`;
    return;
  }
  tableBody.innerHTML = pageData.map(stock => {
    const isWatchlisted = watchlist.includes(stock.StockName);
    const changePercent = stock.ChangePercent;
    const colorClass = changePercent > 0 ? 'text-green-400' : changePercent < 0 ? 'text-red-400' : 'text-gray-300';
    const sign = changePercent > 0 ? '+' : '';
    const starIcon = isWatchlisted ? '★' : '☆';
    const starClass = isWatchlisted ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-500';
    return `
      <tr class="hover:bg-gray-700/50 transition-colors duration-200">
        <td class="px-4 py-4 text-center">
          <button class="watchlist-toggle text-xl ${starClass}" data-symbol="${stock.StockName}">${starIcon}</button>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <a href="#" class="font-medium text-blue-400 hover:text-blue-300 transition-colors" data-symbol="${stock.StockName}">${stock.StockName}</a>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right font-mono-nums">${formatPrice(stock.StockPrice)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right font-mono-nums ${colorClass}">${sign}${formatPercent(changePercent)}%</td>
        <td class="px-6 py-4 whitespace-nowrap text-right font-mono-nums">${formatMarketCap(stock.MarketCap)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400 font-mono-nums">${stock.LatestDay}</td>
      </tr>
    `;
  }).join('');
  tableBody.addEventListener('click', handleTableClick);
}

function handleTableClick(e) {
  const target = e.target;
  if (target.matches('a[data-symbol]')) {
    e.preventDefault();
    if (!userApiKey) {
      alert('請先點擊右上角的設定按鈕，輸入您的 API 金鑰。');
      showApiKeyModal();
    } else {
      showConfirmationModal(target.dataset.symbol);
    }
  } else if (target.matches('.watchlist-toggle')) {
    e.preventDefault();
    toggleWatchlist(target.dataset.symbol);
  }
}

function toggleWatchlist(symbol) {
  const index = watchlist.indexOf(symbol);
  if (index > -1) {
    watchlist.splice(index, 1);
  } else {
    watchlist.push(symbol);
  }
  localStorage.setItem('qqqWatchlist', JSON.stringify(watchlist));
  updateTable();
}

function renderPagination(totalItems) {
  const paginationControls = document.getElementById('paginationControls');
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) {
    paginationControls.innerHTML = '';
    return;
  }
  let buttonsHtml = '';
  buttonsHtml += `<button class="pagination-btn" id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>&lt;</button>`;
  buttonsHtml += '<div class="flex items-center space-x-2 mx-4">';
  for (let i = 1; i <= totalPages; i++) {
    buttonsHtml += `<button class="pagination-btn page-number ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  buttonsHtml += '</div>';
  buttonsHtml += `<button class="pagination-btn" id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>&gt;</button>`;
  paginationControls.innerHTML = `
    <span class="text-sm text-gray-400">共 ${totalItems} 支股票</span>
    <div class="flex items-center">${buttonsHtml}</div>
  `;
  document.querySelectorAll('.page-number').forEach(button => {
    button.addEventListener('click', () => {
      currentPage = Number(button.dataset.page);
      updateTable();
    });
  });
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; updateTable(); }
  });
  document.getElementById('nextPage').addEventListener('click', () => {
    if (currentPage < totalPages) { currentPage++; updateTable(); }
  });
}

export function setupEventListeners() {
  document.getElementById('searchInput').addEventListener('keyup', () => {
    currentPage = 1;
    updateTable();
  });
  document.querySelectorAll('th[data-sort]').forEach(header => {
    header.addEventListener('click', () => {
      const sortKey = header.dataset.sort;
      if (currentSort.key === sortKey) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.key = sortKey;
        currentSort.order = 'desc';
      }
      currentPage = 1;
      updateTable();
    });
  });
  document.getElementById('closeModal').addEventListener('click', hideAiSummary);
  document.getElementById('aiModal').addEventListener('click', (e) => {
    if (e.target.id === 'aiModal') hideAiSummary();
  });
  const viewAllBtn = document.getElementById('viewAllBtn');
  const viewWatchlistBtn = document.getElementById('viewWatchlistBtn');
  viewAllBtn.addEventListener('click', () => {
    currentView = 'all';
    currentPage = 1;
    viewAllBtn.classList.add('active');
    viewWatchlistBtn.classList.remove('active');
    updateTable();
  });
  viewWatchlistBtn.addEventListener('click', () => {
    currentView = 'watchlist';
    currentPage = 1;
    viewWatchlistBtn.classList.add('active');
    viewAllBtn.classList.remove('active');
    updateTable();
  });
  document.getElementById('downloadReportBtn').addEventListener('click', downloadMarkdownFile);
  document.getElementById('cancelConfirmBtn').addEventListener('click', hideConfirmationModal);
  document.getElementById('proceedConfirmBtn').addEventListener('click', () => {
    hideConfirmationModal();
    if (symbolToAnalyze) {
      showAiSummary(symbolToAnalyze);
    }
  });
  document.getElementById('confirmationModal').addEventListener('click', (e) => {
    if (e.target.id === 'confirmationModal') hideConfirmationModal();
  });
  document.getElementById('settingsBtn').addEventListener('click', showApiKeyModal);
  document.getElementById('closeApiKeyModal').addEventListener('click', hideApiKeyModal);
  document.getElementById('cancelApiKeyBtn').addEventListener('click', hideApiKeyModal);
  document.getElementById('saveApiKeyBtn').addEventListener('click', saveApiKey);
  document.getElementById('apiKeyModal').addEventListener('click', (e) => {
    if (e.target.id === 'apiKeyModal') hideApiKeyModal();
  });
  document.getElementById('marketSummaryBtn').addEventListener('click', generateMarketSummary);
  document.getElementById('watchlistSummaryBtn').addEventListener('click', generateWatchlistSummary);
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
}

export function calculateAndRenderMetrics(data) {
  if (data.length === 0) return;
  const sortedByChange = [...data].sort((a, b) => a.ChangePercent - b.ChangePercent);
  const topGainer = sortedByChange[sortedByChange.length - 1];
  const topLoser = sortedByChange[0];
  const totalMarketCap = data.reduce((sum, stock) => sum + stock.MarketCap, 0);
  const upCount = data.filter(s => s.ChangePercent > 0).length;
  const downCount = data.filter(s => s.ChangePercent < 0).length;
  document.getElementById('topGainer').innerHTML = `${topGainer.StockName} <span class="text-lg">+${formatPercent(topGainer.ChangePercent)}%</span>`;
  document.getElementById('topLoser').innerHTML = `${topLoser.StockName} <span class="text-lg">${formatPercent(topLoser.ChangePercent)}%</span>`;
  document.getElementById('totalMarketCap').textContent = formatMarketCap(totalMarketCap);
  document.getElementById('marketBreadth').innerHTML = `<span class="text-green-400">${upCount}</span> / <span class="text-red-400">${downCount}</span>`;
}

export function renderMarketCapPieChart(data) {
  const ctx = document.getElementById('marketCapChart').getContext('2d');
  if (window.marketCapChartInstance) {
    window.marketCapChartInstance.destroy();
  }
  const sortedByMarketCap = [...data].sort((a, b) => b.MarketCap - a.MarketCap);
  const top10 = sortedByMarketCap.slice(0, 10);
  const othersMarketCap = sortedByMarketCap.slice(10).reduce((sum, stock) => sum + stock.MarketCap, 0);
  const labels = [...top10.map(s => s.StockName), '其他'];
  const chartData = [...top10.map(s => s.MarketCap), othersMarketCap];
  window.marketCapChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        label: '市值 (百萬 USD)',
        data: chartData,
        backgroundColor: [
          '#3B82F6', '#10B981', '#F97316', '#EC4899', '#8B5CF6',
          '#F59E0B', '#6366F1', '#14B8A6', '#EF4444', '#6B7280', '#4B5563'
        ],
        borderColor: '#1f2937',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#D1D5DB',
            boxWidth: 12,
            padding: 15,
            font: { size: 14 }
          }
        }
      }
    }
  });
}

function formatPrice(price) {
  return isNaN(price) ? 'N/A' : price.toFixed(2);
}

function formatPercent(percent) {
  return isNaN(percent) ? 'N/A' : percent.toFixed(2);
}

function formatMarketCap(marketCap) {
  if (isNaN(marketCap)) return 'N/A';
  const trillionValue = marketCap / 1000000;
  return `${trillionValue.toFixed(2)} 兆 USD`;
}
