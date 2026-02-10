import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import DonutChart from './components/DonutChart'
import CurrencyConverter from './pages/CurrencyConverter'
import './App.css'


const API_URL = ''

// Helper to format currency with commas
const formatCurrency = (num) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Navigation Component
function Navigation() {
    const location = useLocation()

    return (
        <nav className="main-nav">
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
                💰 Budget
            </Link>
            <Link to="/converter" className={location.pathname === '/converter' ? 'active' : ''}>
                💱 Converter
            </Link>
        </nav>
    )
}

// Auth Page Component with Tabs
function AuthPage({ onLogin }) {
    const [activeTab, setActiveTab] = useState('login')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch(`${API_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username, password })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || 'Login failed')
            }

            localStorage.setItem('token', data.access_token)
            onLogin(data.access_token)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleRegister = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (password.length < 4) {
            setError('Password must be at least 4 characters')
            return
        }

        setLoading(true)

        try {
            const res = await fetch(`${API_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || 'Registration failed')
            }

            setSuccess('Account created successfully! Please login.')
            setActiveTab('login')
            setPassword('')
            setConfirmPassword('')
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1 className="auth-title">Budget Dashboard</h1>

                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('login'); setError(''); setSuccess(''); }}
                    >
                        Login
                    </button>
                    <button
                        className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('register'); setError(''); setSuccess(''); }}
                    >
                        Register
                    </button>
                </div>

                {error && <p className="error-message">{error}</p>}
                {success && <p className="success-message">{success}</p>}

                {activeTab === 'login' ? (
                    <form onSubmit={handleLogin} className="auth-form">
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button type="submit" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="auth-form">
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        <button type="submit" disabled={loading}>
                            {loading ? 'Creating account...' : 'Register'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

// Expense Chart Colors (matching app's cyan-purple gradient theme)
const EXPENSE_COLORS = [
    '#00d9ff', // Cyan - Primary
    '#7c3aed', // Purple - Secondary
    '#f472b6', // Pink - Accent
    '#22d3ee', // Light Cyan
    '#a855f7', // Light Purple
    '#fb7185', // Rose
    '#38bdf8', // Sky Blue
    '#c084fc', // Violet
]

// Expense Chart Component with SVG Donut
function ExpenseChart({ transactions }) {

    const expenseData = useMemo(() => {
        // Group expenses by description (as category)
        const expensesByCategory = transactions
            .filter(t => t.type === 'expense')
            .reduce((acc, t) => {
                const category = t.description
                acc[category] = (acc[category] || 0) + t.amount
                return acc
            }, {})

        // Convert to chart data format
        const entries = Object.entries(expensesByCategory)
            .sort((a, b) => b[1] - a[1]) // Sort by amount descending
            .map(([name, value], index) => ({
                name,
                value,
                color: EXPENSE_COLORS[index % EXPENSE_COLORS.length]
            }))

        return entries
    }, [transactions])

    const totalExpenses = useMemo(() => {
        return expenseData.reduce((sum, item) => sum + item.value, 0)
    }, [expenseData])

    if (expenseData.length === 0) {
        return (
            <div className="expense-chart-container">
                <h2>Expense Breakdown</h2>
                <div className="chart-empty-state">
                    <p>No expenses to display</p>
                </div>
            </div>
        )
    }

    return (
        <div className="expense-chart-container">
            <h2>Expense Breakdown</h2>
            <div className="chart-wrapper">
                <div className="donut-chart">
                    <DonutChart
                        data={expenseData}
                        size={200}
                        innerRadius={0.6}
                        outerRadius={0.9}
                    />
                    <div className="chart-center-label">
                        <span className="chart-total">{formatCurrency(totalExpenses).split('.')[0]}</span>
                        <span className="chart-currency">zł</span>
                    </div>
                </div>
            </div>

        </div>

    )
}

// Dashboard Component
function Dashboard({ token, onLogout }) {
    const [transactions, setTransactions] = useState([])
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [type, setType] = useState('income')
    const [error, setError] = useState('')
    const [user, setUser] = useState(null)

    // User management state
    const [showEditModal, setShowEditModal] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [editUsername, setEditUsername] = useState('')
    const [editPassword, setEditPassword] = useState('')
    const [editError, setEditError] = useState('')
    const [editSuccess, setEditSuccess] = useState('')

    const balance = transactions.reduce((acc, t) => {
        return t.type === 'income' ? acc + t.amount : acc - t.amount
    }, 0)

    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0)

    const expenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => acc + t.amount, 0)

    useEffect(() => {
        fetchTransactions()
        fetchUser()
    }, [])

    const fetchUser = async () => {
        try {
            const res = await fetch(`${API_URL}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setUser(data)
            }
        } catch (err) {
            console.error('Failed to fetch user:', err)
        }
    }

    const fetchTransactions = async () => {
        try {
            const res = await fetch(`${API_URL}/api/transactions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setTransactions(data)
            } else if (res.status === 401) {
                onLogout()
            }
        } catch (err) {
            console.error('Failed to fetch transactions:', err)
        }
    }

    const validateForm = () => {
        if (!description.trim()) {
            setError('Please enter a description')
            return false
        }

        if (!amount) {
            setError('Please enter an amount')
            return false
        }

        const numAmount = parseFloat(amount)

        if (numAmount === 0) {
            setError('Amount cannot be zero')
            return false
        }

        if (numAmount < 0) {
            setError('Amount cannot be negative')
            return false
        }

        setError('')
        return true
    }

    const handleAmountChange = (e) => {
        // Remove any existing commas
        let val = e.target.value.replace(/,/g, '')

        // Allow only numbers and one decimal point
        if (!/^\d*\.?\d*$/.test(val)) return

        // Format with commas if it's a valid number
        if (val) {
            const parts = val.split('.')
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            setAmount(parts.join('.'))
        } else {
            setAmount('')
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!validateForm()) return

        // Remove commas before parsing
        const cleanAmount = amount.toString().replace(/,/g, '')

        await fetch(`${API_URL}/api/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                description: description.trim(),
                amount: parseFloat(cleanAmount),
                type
            })
        })
        setDescription('')
        setAmount('')
        setError('')
        fetchTransactions()
    }

    const handleDelete = async (id) => {
        await fetch(`${API_URL}/api/transactions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        fetchTransactions()
    }

    const handleLogout = () => {
        localStorage.removeItem('token')
        onLogout()
    }

    const openEditModal = () => {
        setEditUsername(user?.username || '')
        setEditPassword('')
        setEditError('')
        setEditSuccess('')
        setShowEditModal(true)
    }

    const handleUpdateProfile = async (e) => {
        e.preventDefault()
        setEditError('')
        setEditSuccess('')

        try {
            const res = await fetch(`${API_URL}/api/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    username: editUsername || null,
                    password: editPassword || null
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.detail || 'Update failed')
            }

            setEditSuccess('Profile updated successfully!')
            setUser(data)
            setEditPassword('')
        } catch (err) {
            setEditError(err.message)
        }
    }

    const handleDeleteAccount = async () => {
        try {
            const res = await fetch(`${API_URL}/api/me`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })

            if (res.ok) {
                localStorage.removeItem('token')
                onLogout()
            }
        } catch (err) {
            console.error('Failed to delete account:', err)
        }
    }

    return (
        <div className="container">
            <header className="header">
                <h1>Budget Dashboard</h1>
                <div className="user-info">
                    {user && <span>Welcome, {user.username}</span>}
                    <button className="edit-btn" onClick={openEditModal}>Profile</button>
                    <button className="logout-btn" onClick={handleLogout}>Logout</button>
                </div>
            </header>

            {/* Edit Profile Modal */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Edit Profile</h2>
                        {editError && <p className="error-message">{editError}</p>}
                        {editSuccess && <p className="success-message">{editSuccess}</p>}
                        <form onSubmit={handleUpdateProfile}>
                            <input
                                type="text"
                                placeholder="Username"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="New Password (leave blank to keep current)"
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                            />
                            <div className="modal-buttons">
                                <button type="submit">Save Changes</button>
                                <button type="button" className="cancel-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
                            </div>
                        </form>
                        <div className="danger-zone">
                            <button className="delete-account-btn" onClick={() => { setShowEditModal(false); setShowDeleteConfirm(true); }}>Delete Account</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Account Confirmation */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Delete Account?</h2>
                        <p>This action cannot be undone. All your data will be permanently deleted.</p>
                        <div className="modal-buttons">
                            <button className="delete-confirm-btn" onClick={handleDeleteAccount}>Yes, Delete My Account</button>
                            <button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="balance-cards">
                <div className="card balance">
                    <h3>Balance</h3>
                    <p className={balance >= 0 ? 'positive' : 'negative'}>
                        {formatCurrency(balance)} zł
                    </p>
                </div>
                <div className="card income">
                    <h3>Income</h3>
                    <p className="positive">+{formatCurrency(income)} zł</p>
                </div>
                <div className="card expenses">
                    <h3>Expenses</h3>
                    <p className="negative">-{formatCurrency(expenses)} zł</p>
                </div>
            </div>

            <ExpenseChart transactions={transactions} />

            <div className="add-transaction">
                <h2>Add Transaction</h2>
                {error && <p className="error-message">{error}</p>}
                <form onSubmit={handleSubmit} className="transaction-form">
                    <div className="form-left">
                        <input
                            type="text"
                            placeholder="Description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Amount"
                            value={amount}
                            onChange={handleAmountChange}
                        />
                    </div>
                    <div className="form-right">
                        <div className="type-toggle">
                            <button
                                type="button"
                                className={`toggle-btn income ${type === 'income' ? 'active' : ''}`}
                                onClick={() => setType('income')}
                            >
                                <span className="toggle-icon">↑</span>
                                Income
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn expense ${type === 'expense' ? 'active' : ''}`}
                                onClick={() => setType('expense')}
                            >
                                <span className="toggle-icon">↓</span>
                                Expense
                            </button>
                        </div>
                        <button type="submit">Add</button>
                    </div>
                </form>
            </div>

            <div className="transaction-history">
                <h2>Transaction History</h2>
                {transactions.length === 0 ? (
                    <p className="empty-state">No transactions yet</p>
                ) : (
                    <ul>
                        {transactions.map((t) => (
                            <li key={t.id} className={t.type}>
                                <span>{t.description}</span>
                                <span className={t.type === 'income' ? 'positive' : 'negative'}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)} zł
                                </span>
                                <button onClick={() => handleDelete(t.id)}>×</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}

// Main App Component
function App() {
    const [token, setToken] = useState(localStorage.getItem('token'))

    const handleLogin = (newToken) => {
        setToken(newToken)
    }

    const handleLogout = () => {
        setToken(null)
    }

    // Currency Converter is public, Budget Dashboard requires login
    return (
        <div className="app-wrapper">
            <Navigation />
            <Routes>
                <Route path="/converter" element={<CurrencyConverter />} />
                <Route path="/" element={
                    token ? (
                        <Dashboard token={token} onLogout={handleLogout} />
                    ) : (
                        <AuthPage onLogin={handleLogin} />
                    )
                } />
            </Routes>
        </div>
    )
}

export default App
