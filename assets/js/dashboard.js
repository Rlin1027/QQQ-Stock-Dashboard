        // --- 全域變數與狀態管理 ---
        let originalData = [];
        let watchlist = [];
        let currentView = 'all';
        let currentSort = { key: 'MarketCap', order: 'desc' };
        let currentPage = 1;
        const itemsPerPage = 20;
        let marketCapChartInstance = null;
        let symbolToAnalyze = null;
        let userApiKey = '';
        
        // --- 核心功能：數據獲取與處理 ---
        document.addEventListener('DOMContentLoaded', () => {
            watchlist = JSON.parse(localStorage.getItem('qqqWatchlist')) || [];
            userApiKey = localStorage.getItem('geminiApiKey') || '';
            fetchSheetData();
            setupEventListeners();
        });

        async function fetchSheetData() {
            const tableBody = document.getElementById('stockTableBody');
            const lastUpdatedElement = document.getElementById('lastUpdated');

            try {
                const cache = JSON.parse(localStorage.getItem('qqqDashboardCache'));
                const now = new Date().getTime();
                const fourHours = 4 * 60 * 60 * 1000;

                if (cache && (now - cache.timestamp < fourHours)) {
                    console.log("從快取載入數據");
                    originalData = cache.data;
                    lastUpdatedElement.textContent = `上次更新: ${new Date(cache.timestamp).toLocaleTimeString()}`;
                } else {
                    console.log("從 Google Sheet 獲取新數據");
                    const sheetId = '1dSCzQ0ZEHFdu58l2kSrKkz2xo6aVVM2lBoWLzZuwVmY';
                    const sheetGid = '0';
                    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetGid}`;

                    const response = await fetch(sheetUrl);
                    if (!response.ok) throw new Error('無法獲取 Google Sheet 數據，請檢查共用設定或連結。');

                    const csvText = await response.text();
                    originalData = parseCSV(csvText);

                    const newCache = { timestamp: now, data: originalData };
                    localStorage.setItem('qqqDashboardCache', JSON.stringify(newCache));
                    lastUpdatedElement.textContent = `上次更新: ${new Date(now).toLocaleTimeString()}`;
                }

                const activeData = originalData.filter(stock => stock.Status === 'Active');
                
                calculateAndRenderMetrics(activeData);
                renderMarketCapPieChart(activeData);
                updateTable();

            } catch (error) {
                console.error("獲取數據失敗:", error);
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-400">數據載入失敗：${error.message}</td></tr>`;
                lastUpdatedElement.textContent = '數據更新失敗';
            }
        }

        function parseCSV(csvText) {
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

        // --- 核心功能：UI 渲染與互動 ---

        function updateTable() {
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
                <span class="text-sm text-gray-400">
                    共 ${totalItems} 支股票
                </span>
                <div class="flex items-center">
                    ${buttonsHtml}
                </div>
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

        function setupEventListeners() {
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
            
            // 新增: AI 總結按鈕事件
            document.getElementById('marketSummaryBtn').addEventListener('click', generateMarketSummary);
            document.getElementById('watchlistSummaryBtn').addEventListener('click', generateWatchlistSummary);
        }

        // --- AI 研究助理功能 ---
        
        function showConfirmationModal(symbol) {
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

        function hideConfirmationModal() {
            const modal = document.getElementById('confirmationModal');
            const modalContent = document.getElementById('confirmationModalContent');
            modal.classList.remove('opacity-100');
            modalContent.classList.remove('scale-100');
            setTimeout(() => {
                modal.classList.add('hidden');
                symbolToAnalyze = null;
            }, 300);
        }

        function showAiSummary(title, loadingText) {
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
        
        function hideAiSummary() {
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
            
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${userApiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = new Error(`API 請求失敗，狀態碼: ${response.status}`);
                error.response = response;
                throw error;
            }
            
            const result = await response.json();
            if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
                return result.candidates[0].content.parts[0].text;
            }
            return "無法生成報告，請稍後再試。";
        }

        async function generateAiReport(symbol) {
            showAiSummary('AI 研究助理報告', symbol);
            const loader = document.getElementById('modalLoader');
            const reportDiv = document.getElementById('reportContent');
            const downloadBtn = document.getElementById('downloadReportBtn');

            try {
                const today = new Date();
                const todayString = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
                const prompt = `你是一位專業的金融分析師，以嚴謹和事實為基礎。今天是 ${todayString}。請基於**截至今天為止**的、可公開驗證的最新新聞與財報資料，用繁體中文為股票 ${symbol} 生成一份不超過 300 字的摘要報告。報告需要包含以下幾個部分，並使用 Markdown 格式化：
1.  ### 近期亮點 (Key Highlights)
2.  ### 正面因素 (Bullish Points)
3.  ### 潛在風險 (Bearish Points)
4.  ### 整體情緒 (Overall Sentiment)
5.  ### 資料來源 (Sources) - 請列出 2-3 個你參考的**真實、可點擊的**主要新聞 URL 連結。**請勿杜撰連結**。`;
                
                const reportText = await callGeminiAPI(prompt);
                if (!reportText) return; // API Key 未設定時，callGeminiAPI 會回傳 null

                reportDiv.dataset.rawMarkdown = reportText;
                reportDiv.dataset.symbol = symbol;

                let reportHtml = reportText
                    .replace(/### (.*?)\n/g, '<h3>$1</h3>')
                    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">$1</a>')
                    .replace(/\n/g, '<br>');

                reportDiv.innerHTML = reportHtml;
                downloadBtn.classList.remove('hidden');

            } catch (error) {
                console.error("AI 報告生成失敗:", error);
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

        async function generateMarketSummary() {
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

                const prompt = `你是一位專業的金融市場評論員。今天是 ${todayString}。根據以下 Nasdaq 100 指數的當日關鍵表現數據，請用繁體中文撰寫一段約 150 字的市場總結，分析當日的市場趨勢、情緒以及可能的驅動因素。
- **領漲股:** ${topGainers}
- **領跌股:** ${topLosers}`;

                const reportText = await callGeminiAPI(prompt);
                if (!reportText) return;
                
                reportDiv.innerHTML = reportText.replace(/\n/g, '<br>');

            } catch (error) {
                 console.error("AI 市場總結生成失敗:", error);
                 reportDiv.innerHTML = `<p class="text-red-400">抱歉，市場總結生成失敗。</p><p class="text-sm text-gray-500 mt-2">(${error.message})</p>`;
            } finally {
                loader.style.display = 'none';
                reportDiv.style.display = 'block';
            }
        }

        async function generateWatchlistSummary() {
            const watchlistData = originalData.filter(stock => watchlist.includes(stock.StockName));
            if (watchlistData.length === 0) {
                alert("您的收藏清單是空的，請先新增股票。");
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
                 console.error("AI 收藏總結生成失敗:", error);
                 reportDiv.innerHTML = `<p class="text-red-400">抱歉，收藏總結生成失敗。</p><p class="text-sm text-gray-500 mt-2">(${error.message})</p>`;
            } finally {
                loader.style.display = 'none';
                reportDiv.style.display = 'block';
            }
        }

        function downloadMarkdownFile() {
            const reportDiv = document.getElementById('reportContent');
            const markdownContent = reportDiv.dataset.rawMarkdown;
            const symbol = reportDiv.dataset.symbol;

            if (!markdownContent) return;
            
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const dateString = `${year}${month}${day}`;

            const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${symbol}_AI_Report_${dateString}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // --- API 金鑰管理 ---
        function showApiKeyModal() {
            const modal = document.getElementById('apiKeyModal');
            const modalContent = document.getElementById('apiKeyModalContent');
            document.getElementById('apiKeyInput').value = userApiKey;
            
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.add('opacity-100');
                modalContent.classList.add('scale-100');
            }, 10);
        }

        function hideApiKeyModal() {
            const modal = document.getElementById('apiKeyModal');
            const modalContent = document.getElementById('apiKeyModalContent');
            modal.classList.remove('opacity-100');
            modalContent.classList.remove('scale-100');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }

        function saveApiKey() {
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

        // --- 格式化輔助函數 ---
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

        // --- Phase 2: 指標與圖表渲染 ---
        function calculateAndRenderMetrics(data) {
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

        function renderMarketCapPieChart(data) {
            const ctx = document.getElementById('marketCapChart').getContext('2d');
            if (marketCapChartInstance) {
                marketCapChartInstance.destroy();
            }

            const sortedByMarketCap = [...data].sort((a, b) => b.MarketCap - a.MarketCap);
            const top10 = sortedByMarketCap.slice(0, 10);
            const othersMarketCap = sortedByMarketCap.slice(10).reduce((sum, stock) => sum + stock.MarketCap, 0);
            
            const labels = [...top10.map(s => s.StockName), '其他'];
            const chartData = [...top10.map(s => s.MarketCap), othersMarketCap];

            marketCapChartInstance = new Chart(ctx, {
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
                                font: {
                                    size: 14 
                                }
                            }
                        }
                    }
                }
            });
        }

