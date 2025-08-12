export let originalData = [];

export async function fetchSheetData() {
  const tableBody = document.getElementById('stockTableBody');
  const lastUpdatedElement = document.getElementById('lastUpdated');
  try {
    const cache = JSON.parse(localStorage.getItem('qqqDashboardCache'));
    const now = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;
    let timestamp;
    if (cache && now - cache.timestamp < fourHours) {
      console.log('從快取載入數據');
      originalData = cache.data;
      timestamp = cache.timestamp;
    } else {
      console.log('從 Google Sheet 獲取新數據');
      const sheetId = '1dSCzQ0ZEHFdu58l2kSrKkz2xo6aVVM2lBoWLzZuwVmY';
      const sheetGid = '0';
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetGid}`;
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error('無法獲取 Google Sheet 數據，請檢查共用設定或連結。');
      const csvText = await response.text();
      originalData = parseCSV(csvText);
      const newCache = { timestamp: now, data: originalData };
      localStorage.setItem('qqqDashboardCache', JSON.stringify(newCache));
      timestamp = now;
    }
    if (lastUpdatedElement) {
      lastUpdatedElement.textContent = `上次更新: ${new Date(timestamp).toLocaleTimeString()}`;
    }
    const activeData = originalData.filter(stock => stock.Status === 'Active');
    return { data: activeData, timestamp };
  } catch (error) {
    console.error('獲取數據失敗:', error);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-400">數據載入失敗：${error.message}</td></tr>`;
    }
    if (lastUpdatedElement) lastUpdatedElement.textContent = '數據更新失敗';
    return { data: [], timestamp: null };
  }
}

export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    let obj = {};
    headers.forEach((header, i) => {
      const key = header.trim();
      const value = values[i] ? values[i].trim() : '';
      if (key === 'StockPrice' || key === 'ChangePercent' || key === 'MarketCap') {
        obj[key] = parseFloat(value) || 0;
      } else {
        obj[key] = value;
      }
    });
    return obj;
  });
}
