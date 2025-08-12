import { fetchSheetData } from './data.js';
import { initTheme, setupEventListeners, updateTable, calculateAndRenderMetrics, renderMarketCapPieChart } from './ui.js';
import './ai.js';

async function init() {
  initTheme();
  setupEventListeners();
  const { data } = await fetchSheetData();
  calculateAndRenderMetrics(data);
  renderMarketCapPieChart(data);
  updateTable();
}

document.addEventListener('DOMContentLoaded', init);
