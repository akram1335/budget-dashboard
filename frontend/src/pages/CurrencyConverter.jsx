import { useState, useEffect, useCallback } from 'react';
import './CurrencyConverter.css';

const API_URL = '';

const currencies = [
    { code: 'DZD', name: 'Algerian Dinar', flag: '🇩🇿' },
    { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
    { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
    { code: 'PLN', name: 'Polish Zloty', flag: '🇵🇱' }
];

function formatNumber(num) {
    if (isNaN(num) || num === null) return '0.00';
    if (num === 0) return '0.00';

    // For very small numbers, show detailed decimals
    if (Math.abs(num) < 0.01) {
        return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    }

    // Use standard locale formatting (adds commas) with 2 decimals
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function evaluateInput(str) {
    try {
        const sanitized = str.replace(/[^0-9+\-*/.()]/g, '');
        if (!sanitized) return 0;
        return Function('"use strict"; return (' + sanitized + ')')();
    } catch {
        return parseFloat(str) || 0;
    }
}

function Sparkline({ data, isUp }) {
    if (!data || data.length === 0) {
        data = [{ buy: 100 }];
    }

    const values = data.map(d => d.buy);
    const min = Math.min(...values) * 0.98;
    const max = Math.max(...values) * 1.02;
    const range = max - min || 1;

    const width = 100;
    const height = 35;
    const points = values.map((v, i) => {
        const x = (i / Math.max(values.length - 1, 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    const color = isUp ? 'var(--chart-up)' : 'var(--chart-down)';
    const gradId = isUp ? 'grad-up' : 'grad-down';

    return (
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
                <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
                    <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
                </linearGradient>
            </defs>
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <polygon
                points={`0,${height} ${points} ${width},${height}`}
                fill={`url(#${gradId})`}
            />
        </svg>
    );
}

function CurrencyCard({ currency, isSelected, displayValue, rateText, relativeHistory, onClick }) {
    const isUp = relativeHistory.length >= 2
        ? relativeHistory[relativeHistory.length - 1].buy >= relativeHistory[0].buy
        : true;

    return (
        <div
            className={`currency-card ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
        >
            <div className="card-header">
                <span className="currency-flag">{currency.flag}</span>
                <div>
                    <div className="currency-code">{currency.code}</div>
                    <div className="currency-name">{currency.name}</div>
                </div>
            </div>
            <div className="currency-value">{formatNumber(displayValue)}</div>
            <div className="currency-rate">{rateText}</div>
            <div className="mini-chart">
                <Sparkline data={relativeHistory} isUp={isUp} />
            </div>
        </div>
    );
}

function Keypad({ onAppend, onClear, onDelete, onEvaluate }) {
    const keys = [
        { label: '7', value: '7' },
        { label: '8', value: '8' },
        { label: '9', value: '9' },
        { label: '+', value: '+', className: 'operator' },
        { label: '4', value: '4' },
        { label: '5', value: '5' },
        { label: '6', value: '6' },
        { label: '−', value: '-', className: 'operator' },
        { label: '1', value: '1' },
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: '×', value: '*', className: 'operator' },
        { label: '.', value: '.' },
        { label: '0', value: '0' },
        { label: 'C', action: 'clear', className: 'clear' },
        { label: '⌫', action: 'delete', className: 'delete' },
        { label: '÷', value: '/', className: 'operator' },
        { label: '(', value: '(' },
        { label: ')', value: ')' },
        { label: '=', action: 'evaluate', className: 'equals' },
    ];

    const handleClick = (key) => {
        if (key.action === 'clear') onClear();
        else if (key.action === 'delete') onDelete();
        else if (key.action === 'evaluate') onEvaluate();
        else onAppend(key.value);
    };

    return (
        <div className="keypad">
            {keys.map((key, i) => (
                <button
                    key={i}
                    className={`key ${key.className || ''}`}
                    onClick={() => handleClick(key)}
                >
                    {key.label}
                </button>
            ))}
        </div>
    );
}

export default function CurrencyConverter() {
    const [ratesData, setRatesData] = useState({});
    const [historyData, setHistoryData] = useState({});
    const [selectedCurrency, setSelectedCurrency] = useState('DZD');
    const [amount, setAmount] = useState('1000');
    const [lastUpdate, setLastUpdate] = useState('--');

    useEffect(() => {
        async function loadRates() {
            try {
                const [ratesRes, historyRes] = await Promise.all([
                    fetch(`${API_URL}/api/rates`),
                    fetch(`${API_URL}/api/rates/history`).catch(() => ({ ok: false }))
                ]);

                const rates = await ratesRes.json();
                setRatesData(rates);

                if (historyRes.ok) {
                    const history = await historyRes.json();
                    setHistoryData(history);
                }

                if (rates.last_update) {
                    setLastUpdate(rates.last_update);
                }
            } catch (err) {
                console.error("Could not load rates", err);
            }
        }
        loadRates();
    }, []);

    const getRelativeHistory = useCallback((currCode) => {
        if (selectedCurrency === currCode) {
            return [{ buy: 1 }, { buy: 1 }];
        }

        const selHist = selectedCurrency === 'DZD' ? [{ date: 'all', buy: 1 }] : (historyData[selectedCurrency] || []);
        const currHist = currCode === 'DZD' ? [{ date: 'all', buy: 1 }] : (historyData[currCode] || []);

        if (selHist.length === 0 || currHist.length === 0) return [];

        const selMap = Object.fromEntries(selHist.map(h => [h.date, h.buy]));
        const currMap = Object.fromEntries(currHist.map(h => [h.date, h.buy]));
        const allDates = [...new Set([...Object.keys(selMap), ...Object.keys(currMap)])].sort();

        const relativeHistory = [];
        allDates.forEach(date => {
            const selVal = selectedCurrency === 'DZD' ? 1 : selMap[date];
            const currVal = currCode === 'DZD' ? 1 : currMap[date];
            if (selVal && currVal) {
                relativeHistory.push({ buy: selVal / currVal });
            }
        });

        return relativeHistory;
    }, [selectedCurrency, historyData]);

    const getDisplayValue = useCallback((currCode) => {
        const amountNum = evaluateInput(amount);
        const fromRate = selectedCurrency === 'DZD' ? 1 : parseFloat(ratesData[selectedCurrency]?.buy || 0);
        const toRate = currCode === 'DZD' ? 1 : parseFloat(ratesData[currCode]?.buy || 0);

        if (fromRate > 0 && toRate > 0) {
            return (amountNum * fromRate) / toRate;
        }
        return 0;
    }, [amount, selectedCurrency, ratesData]);

    const getRateText = (currCode) => {
        if (currCode !== 'DZD' && ratesData[currCode]) {
            return `1 ${currCode} = ${ratesData[currCode].buy} DA`;
        } else if (currCode === 'DZD') {
            return 'Base Currency (DA)';
        }
        return '';
    };

    // Keyboard support
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement.tagName === 'INPUT') return;

            if (e.key >= '0' && e.key <= '9') {
                setAmount(prev => prev + e.key);
            } else if (e.key === '.') {
                setAmount(prev => prev + '.');
            } else if (['+', '-', '*', '/'].includes(e.key)) {
                setAmount(prev => prev + e.key);
            } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
                setAmount('');
            } else if (e.key === 'Backspace') {
                setAmount(prev => prev.slice(0, -1));
            } else if (e.key === 'Enter') {
                setAmount(evaluateInput(amount).toString());
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [amount]);

    const handleAmountChange = (e) => {
        let val = e.target.value

        // If it looks like a math expression, don't format
        if (/[+\-*/()]/.test(val)) {
            setAmount(val)
            return
        }

        // Otherwise format as number
        val = val.replace(/,/g, '')
        if (!/^\d*\.?\d*$/.test(val)) return

        if (val) {
            const parts = val.split('.')
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            setAmount(parts.join('.'))
        } else {
            setAmount('')
        }
    }

    return (
        <div className="converter-container">
            <h1>💱 Currency Converter</h1>
            <p className="subtitle">Square Market Rates with Charts</p>

            <div className="cards-grid">
                {currencies.map(curr => (
                    <CurrencyCard
                        key={curr.code}
                        currency={curr}
                        isSelected={curr.code === selectedCurrency}
                        displayValue={getDisplayValue(curr.code)}
                        rateText={getRateText(curr.code)}
                        relativeHistory={getRelativeHistory(curr.code)}
                        onClick={() => setSelectedCurrency(curr.code)}
                    />
                ))}
            </div>

            <div className="input-section">
                <label className="input-label">Enter amount (editable - paste allowed)</label>
                <input
                    type="text"
                    inputmode="decimal"
                    className="amount-input"
                    placeholder="0.00"
                    value={amount}
                    onChange={handleAmountChange}
                    onFocus={(e) => {
                        e.target.closest('.input-section').scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }}
                />
            </div>

            <Keypad
                onAppend={(char) => setAmount(prev => prev + char)}
                onClear={() => setAmount('')}
                onDelete={() => setAmount(prev => prev.slice(0, -1))}
                onEvaluate={() => setAmount(evaluateInput(amount).toString())}
            />

            <div className="footer">
                Updated: <span>{lastUpdate}</span>
            </div>
        </div>
    );
}
