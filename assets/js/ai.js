import { originalData } from './data.js';
import { watchlist } from './ui.js';

export let userApiKey = localStorage.getItem('geminiApiKey') || '';
export let symbolToAnalyze = null;

export function showConfirmationModal(symbol) {
  symbolToAnalyze = symbol;
  const modal = document.getElementById('confirmationModal');
  const modalContent = document.getElementById('confirmationModalContent');
  document.getElementById('confirmSymbol').textContent = symbol;
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.add('opacity-100');
    modalContent.classList.add('scale-100');
  }, 10);
}

export function hideConfirmationModal() {
  const modal = document.getElementById('confirmationModal');
  const modalContent = document.getElementById('confirmationModalContent');
  modal.classList.remove('opacity-100');
  modalContent.classList.remove('scale-100');
  setTimeout(() => {
    modal.classList.add('hidden');
    symbolToAnalyze = null;
  }, 300);
}

export function showAiSummary(title, loadingText) {
  const modal = document.getElementById('aiModal');
  const modalContent = document.getElementById('aiModalContent');
  const loader = document.getElementById('modalLoader');
  const reportDiv = document.getElementById('reportContent');
  const downloadBtn = document.getElementById('downloadReportBtn');
  document.getElementById('aiModalTitle').textContent = title;
  document.getElementById('loadingSymbol').textContent = loadingText;
  loader.style.display = 'block';
  reportDiv.style.display = 'none';
  reportDiv.innerHTML = '';
  downloadBtn.classList.add('hidden');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.add('opacity-100');
    modalContent.classList.add('scale-100');
  }, 10);
}

export function hideAiSummary() {
  const modal = document.getElementById('aiModal');
  const modalContent = document.getElementById('aiModalContent');
  modal.classList.remove('opacity-100');
  modalContent.classList.remove('scale-100');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function callGeminiAPI(prompt) {
  if (!userApiKey) {
    alert('請先點擊右上角的設定按鈕，輸入您的 API 金鑰。');
    showApiKeyModal();
    return null;
  }
  const payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`API 請求失敗，狀態碼: ${response.status}`);
  const result = await response.json();
  if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
    return result.candidates[0].content.parts[0].text;
  }
  return '無法生成報告，請稍後再試。';
}

export async function generateAiReport(symbol) {
  showAiSummary('AI 研究助理報告', symbol);
  const loader = document.getElementById('modalLoader');
  const reportDiv = document.getElementById('reportContent');
  const downloadBtn = document.getElementById('downloadReportBtn');
  try {
    const today = new Date();
    const todayString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    const prompt = `你是一位專業的金融分析師，以嚴謹和事實為基礎。今天是 ${todayString}。請基於**截至今天為止**的、可公開驗證的最新新聞與財報資料，用繁體中文為股票 ${symbol} 生成一份不超過 300 字的摘要報告。報告需要包含以下幾個部分，並使用 Markdown 格式化：\n1. ### 近期亮點 (Key Highlights)\n2. ### 正面因素 (Bullish Points)\n3. ### 潛在風險 (Bearish Points)\n4. ### 整體情緒 (Overall Sentiment)\n5. ### 資料來源 (Sources) - 請列出 2-3 個你參考的**真實、可點擊的**主要新聞 URL 連結。**請勿杜撰連結**。`;
    const reportText = await callGeminiAPI(prompt);
    if (!reportText) return;
    reportDiv.dataset.rawMarkdown = reportText;
    reportDiv.dataset.symbol = symbol;
    let reportHtml = reportText
      .replace(/### (.*?)\n/g, '<h3>$1</h3>')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">$1</a>')
      .replace(/\n/g, '<br>');
    reportDiv.innerHTML = reportHtml;
    downloadBtn.classList.remove('hidden');
  } catch (error) {
    console.error('AI 報告生成失敗:', error);
    let errorMessage = `<p class="text-red-400">抱歉，AI 報告生成失敗。</p>`;
    if (error.response && error.response.status === 403) {
      errorMessage = `<p class="text-red-400"><strong>API 金鑰錯誤</strong></p><p class="text-gray-400 mt-2">您提供的 API 金鑰無效或權限不足。請點擊右上角的設定按鈕 ⚙️，檢查並重新輸入您的 Google AI Gemini API 金鑰。</p>`;
    } else {
      errorMessage += `<p class="text-sm text-gray-500 mt-2">請檢查您的網路連線，或稍後再試。(${error.message})</p>`;
    }
    reportDiv.innerHTML = errorMessage;
  } finally {
    loader.style.display = 'none';
    reportDiv.style.display = 'block';
  }
}

export async function generateMarketSummary() {
  showAiSummary('AI 市場總結', 'Nasdaq 100 指數');
  const loader = document.getElementById('modalLoader');
  const reportDiv = document.getElementById('reportContent');
  try {
    const activeData = originalData.filter(stock => stock.Status === 'Active');
    const sortedByChange = [...activeData].sort((a, b) => a.ChangePercent - b.ChangePercent);
    const topGainers = sortedByChange.slice(-5).reverse().map(s => `${s.StockName} (+${formatPercent(s.ChangePercent)}%)`).join(', ');
    const topLosers = sortedByChange.slice(0, 5).map(s => `${s.StockName} (${formatPercent(s.ChangePercent)}%)`).join(', ');
    const today = new Date();
    const todayString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    const prompt = `你是一位專業的金融市場評論員。今天是 ${todayString}。根據以下 Nasdaq 100 指數的當日關鍵表現數據，請用繁體中文撰寫一段約 150 字的市場總結，分析當日的市場趨勢、情緒以及可能的驅動因素。\n- **領漲股:** ${topGainers}\n- **領跌股:** ${topLosers}`;
    const reportText = await callGeminiAPI(prompt);
    if (!reportText) return;
    reportDiv.innerHTML = reportText.replace(/\n/g, '<br>');
  } catch (error) {
    console.error('AI 市場總結生成失敗:', error);
    reportDiv.innerHTML = `<p class="text-red-400">抱歉，市場總結生成失敗。</p><p class="text-sm text-gray-500 mt-2">(${error.message})</p>`;
  } finally {
    loader.style.display = 'none';
    reportDiv.style.display = 'block';
  }
}

export async function generateWatchlistSummary() {
  const watchlistData = originalData.filter(stock => watchlist.includes(stock.StockName));
  if (watchlistData.length === 0) {
    alert('您的收藏清單是空的，請先新增股票。');
    return;
  }
  showAiSummary('AI 收藏總結', '您的收藏清單');
  const loader = document.getElementById('modalLoader');
  const reportDiv = document.getElementById('reportContent');
  try {
    const performanceList = watchlistData.map(s => `${s.StockName} (${s.ChangePercent > 0 ? '+' : ''}${formatPercent(s.ChangePercent)}%)`).join(', ');
    const prompt = `你是一位專業的投資組合分析師。這是我個人收藏清單中的股票今日表現：${performanceList}。請用繁體中文為我提供一段簡短的總結，點評我收藏的股票整體表現如何，並特別指出其中表現最好和最差的股票，以及是否有任何值得注意的共同趨勢。`;
    const reportText = await callGeminiAPI(prompt);
    if (!reportText) return;
    reportDiv.innerHTML = reportText.replace(/\n/g, '<br>');
  } catch (error) {
    console.error('AI 收藏總結生成失敗:', error);
    reportDiv.innerHTML = `<p class="text-red-400">抱歉，收藏總結生成失敗。</p><p class="text-sm text-gray-500 mt-2">(${error.message})</p>`;
  } finally {
    loader.style.display = 'none';
    reportDiv.style.display = 'block';
  }
}

export function downloadMarkdownFile() {
  const reportDiv = document.getElementById('reportContent');
  const symbol = reportDiv.dataset.symbol || 'report';
  const content = reportDiv.dataset.rawMarkdown || '';
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date();
  const dateString = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  a.href = url;
  a.download = `${symbol}_AI_Report_${dateString}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function showApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  const modalContent = document.getElementById('apiKeyModalContent');
  document.getElementById('apiKeyInput').value = userApiKey;
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.add('opacity-100');
    modalContent.classList.add('scale-100');
  }, 10);
}

export function hideApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  const modalContent = document.getElementById('apiKeyModalContent');
  modal.classList.remove('opacity-100');
  modalContent.classList.remove('scale-100');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

export function saveApiKey() {
  const apiKeyInput = document.getElementById('apiKeyInput');
  userApiKey = apiKeyInput.value.trim();
  if (userApiKey) {
    localStorage.setItem('geminiApiKey', userApiKey);
    alert('API 金鑰已成功儲存！');
    hideApiKeyModal();
  } else {
    alert('API 金鑰不能為空。');
  }
}

function formatPercent(percent) {
  return isNaN(percent) ? 'N/A' : percent.toFixed(2);
}
