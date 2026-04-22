// =================================================================
//                 EduTech Platform - Frontend Logic
// =================================================================

const { createApp } = Vue;
// 🚨 指向你固定的 Ngrok 域名
const BACKEND_URL = 'https://juliette-unattempted-tammara.ngrok-free.dev';

createApp({
    data() {
        return {
            // --- 视图与UI开关 ---
            currentView: 'home', 
            isCartOpen: false,
            showCheckoutModal: false,
            showAdminModal: false, 
            showAdminCreateModal: false, 
            showPaymentModal: false, // 🚨 支付二维码弹窗开关

            // --- 表单与暂存数据 ---
            selectedPaymentMethod: null, // 🚨 记录用户选了哪个 Bank/eWallet
            adminFormType: 'Book',
            adminFormData: { title: '', price: '', img: '', extra: '', event_date: '', start_time: '', end_time: '' },
            loginForm: { email: '', password: '' },
            registerForm: { name: '', email: '', password: '' },
            checkoutForm: { address: '', country: '', shippingMethod: 'Ship' },
            newAdminForm: { name: '', email: '', password: '' },
            selectedNews: null,
            showItemModal: false,
            selectedItem: null,
            showEventModal: false,   // 🚨 控制事件弹窗的开关
            selectedEvent: null,     // 🚨 记录当前点击的是哪个事件
            
            // --- 全局状态 ---
            // 🚨 新增：用于控制日历的当前显示的月份和年份
            currentMonth: 4, // 0 = Jan, 4 = May, 11 = Dec
            currentYear: 2026,
            
            currentUser: null, 
            cart: [],          

            // --- 数据库拉取的数据 ---
            books: [],
            coursesData: [],
            resourcesData: [],
            newsData: [],
            eventsData: [], 
            orders: [] 
        }
    },
    mounted() {
        this.fetchAllData();
    },
    computed: {
        cartTotal() {
            return this.cart.reduce((total, item) => total + Number(item.price), 0).toFixed(2);
        },
        // 🚨 新增：动态生成日历的标题 (如 "June 2026")
        calendarHeaderTitle() {
            const date = new Date(this.currentYear, this.currentMonth);
            return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        },

        // 🚨 替换：全自动智能计算每个月的格子
        calendarDays() {
            const days = [];
            // 1. 获取这个月的第一天是星期几 (0是周日，1是周一)
            let firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
            // 把周日(0)换成7，方便以星期一为开头计算空格
            if (firstDay === 0) firstDay = 7; 
            const paddingCount = firstDay - 1; // 需要空几格

            // 2. 获取这个月一共有多少天
            const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

            // 3. 填充前面的空白格子
            for (let i = 0; i < paddingCount; i++) {
                days.push({ dayNum: '', empty: true, events: [] });
            }
            
            // 4. 填充真实的日期
            for(let i = 1; i <= daysInMonth; i++) {
                // 格式化为 YYYY-MM-DD，用来和数据库里的数据匹配
                const monthStr = String(this.currentMonth + 1).padStart(2, '0');
                const dayStr = String(i).padStart(2, '0');
                const dateStr = `${this.currentYear}-${monthStr}-${dayStr}`;
                
                // 筛选这一天的事件
                const dayEvents = this.eventsData.filter(e => {
                    return e.event_date && String(e.event_date).startsWith(dateStr);
                });
                
                days.push({ dayNum: i, empty: false, date: dateStr, events: dayEvents });
            }

            // 5. 填充后面的空白格子，让排版整齐 (保持7的倍数)
            const totalCells = days.length;
            const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
            for (let i = 0; i < remainingCells; i++) {
                days.push({ dayNum: '', empty: true, events: [] });
            }

            return days;
        },
        
        isAdmin() {
            return this.currentUser && this.currentUser.role === 'admin';
        }
    },
    methods: {
        // ================= 数据拉取 =================
        async fetchAllData() {
            const headers = { 'ngrok-skip-browser-warning': 'true' };
            try {
                const [booksRes, coursesRes, resourcesRes, newsRes, eventsRes] = await Promise.all([
                    fetch(`${BACKEND_URL}/api/books`, { headers }),
                    fetch(`${BACKEND_URL}/api/courses`, { headers }),
                    fetch(`${BACKEND_URL}/api/resources`, { headers }),
                    fetch(`${BACKEND_URL}/api/news`, { headers }),
                    fetch(`${BACKEND_URL}/api/events`, { headers })
                ]);
                this.books = await booksRes.json();
                this.coursesData = await coursesRes.json();
                this.resourcesData = await resourcesRes.json();
                this.newsData = await newsRes.json();
                this.eventsData = await eventsRes.json();
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        },
        async fetchOrders() {
            if (!this.isAdmin) return;
            try {
                const response = await fetch(`${BACKEND_URL}/api/orders`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                this.orders = await response.json();
            } catch (error) {
                console.error("Error fetching orders:", error);
            }
        },

        // ================= 视图与购物车逻辑 =================
        changeView(viewName) {
            this.currentView = viewName;
            this.isCartOpen = false; 
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
        },

        // 🚨 新增：日历翻页功能
        prevMonth() {
            if (this.currentMonth === 0) {
                this.currentMonth = 11;
                this.currentYear--;
            } else {
                this.currentMonth--;
            }
        },
        nextMonth() {
            if (this.currentMonth === 11) {
                this.currentMonth = 0;
                this.currentYear++;
            } else {
                this.currentMonth++;
            }
        },
        toggleCart() { this.isCartOpen = !this.isCartOpen; },
        
        addToCart(item, type) {
            const existingItem = this.cart.find(cartItem => cartItem.id === item.id && cartItem.type === type);
            if (existingItem) {
                alert(`${item.title} is already in your cart!`);
                return;
            }
            this.cart.push({ ...item, type: type });
            this.isCartOpen = true; 
        },
        removeFromCart(index) { this.cart.splice(index, 1); },
        readFullStory(newsItem) {
            this.selectedNews = newsItem;
            this.changeView('news-detail');
        },

        // 🚨 修复：补回点击 More Details 唤醒弹窗的方法！
        viewItemDetails(item) {
            this.selectedItem = item;    // 记录你点的是哪个课程
            this.showItemModal = true;   // 打开弹窗
        },

        viewEventDetails(evt) {
            this.selectedEvent = evt;      // 把点击的事件数据存起来
            this.showEventModal = true;    // 打开事件详情弹窗
        },

        // ================= 支付流程逻辑 (核心修改) =================
        
        // 1. 点击银行图标，记录支付方式并弹出二维码
        handlePayment(method) {
            this.selectedPaymentMethod = method;
            this.showCheckoutModal = false; // 隐藏地址填写框
            this.showPaymentModal = true;   // 显示二维码扫描框
        },

        // 2. 点击“I Have Paid”按钮，触发最终下单请求
        async confirmPayment() {
            alert(`Payment confirmation received for ${this.selectedPaymentMethod}. Finalizing order...`);
            await this.processCheckout(this.selectedPaymentMethod);
        },

        // 3. 最终的下单 API 调用 (已合并重复函数)
        async processCheckout(paymentMethodUsed) {
            if (!this.currentUser) {
                alert("Please log in to complete your purchase!");
                this.changeView('login');
                return;
            }
            try {
                const response = await fetch(`${BACKEND_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    },
                    body: JSON.stringify({
                        userId: this.currentUser.id,
                        cart: this.cart,
                        shippingDetails: this.checkoutForm,
                        paymentMethod: paymentMethodUsed // 🚨 关键：发送支付方式给后端记录
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                alert('Order placed successfully! Admin will verify your payment.');
                this.cart = []; // 清空购物车
                this.showPaymentModal = false; // 关闭二维码弹窗
                this.isCartOpen = false;
                this.fetchOrders(); // 如果是管理员，刷新订单列表
            } catch(error) {
                alert(`Order Failed: ${error.message}`);
            }
        },

        // ================= 认证流程 (Auth) =================
        async handleRegister() {
            if (!this.registerForm.email.trim().toLowerCase().endsWith('@gmail.com')) {
                alert('Registration Failed: Strictly only @gmail.com addresses are allowed.');
                return; 
            }
            try {
                const response = await fetch(`${BACKEND_URL}/api/register`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify(this.registerForm)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                alert(data.message);
                this.changeView('login');
                this.registerForm = { name: '', email: '', password: '' }; 
            } catch (error) {
                alert(`Registration Failed: ${error.message}`);
            }
        },
        async handleLogin() {
            try {
                const response = await fetch(`${BACKEND_URL}/api/login`, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify(this.loginForm)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                this.currentUser = data; 
                this.loginForm = { email: '', password: '' }; 

                if (this.isAdmin) {
                    alert('Welcome, Admin! Redirecting to dashboard.');
                    this.fetchOrders(); 
                    this.changeView('admin-dashboard');
                } else {
                    alert(`Welcome back, ${this.currentUser.name}!`);
                    this.changeView('home');
                }
            } catch (error) {
                alert(`Login Failed: ${error.message}`);
            }
        },
        logout() {
            this.currentUser = null;
            this.cart = []; 
            this.changeView('home');
        },

        // ================= 管理员 CRUD 操作 =================
        adminAdd(type) {
            if(type === 'courses') type = 'Course';
            if(type === 'resources') type = 'Resource';
            
            this.adminFormType = type;
            this.adminFormData = { title: '', price: '', img: '', extra: '', event_date: '', start_time: '', end_time: '' }; 
            this.showAdminModal = true;
        },
        async submitAdminForm() {
            if (!this.adminFormData.title) return alert("Title is required!");
            
            try {
                const response = await fetch(`${BACKEND_URL}/api/admin/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({
                        type: this.adminFormType,
                        ...this.adminFormData
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                alert(data.message); 
                this.showAdminModal = false;
                this.fetchAllData();
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        },
        async adminDelete(type, id) {
            if(type === 'Item') {
                type = this.currentView === 'courses' ? 'Course' : 'Resource';
            }
            if(confirm(`WARNING: Are you sure you want to permanently delete this ${type}?`)) {
                try {
                    const response = await fetch(`${BACKEND_URL}/api/admin/delete/${type}/${id}`, {
                        method: 'DELETE',
                        headers: { 'ngrok-skip-browser-warning': 'true' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message);
                    
                    alert(data.message);
                    this.fetchAllData();
                } catch (error) {
                    alert(`Error: ${error.message}`);
                }
            }
        },
        async createNewAdmin() {
            if (!this.newAdminForm.name || !this.newAdminForm.email || !this.newAdminForm.password) {
                return alert("Please fill all fields!");
            }
            try {
                const response = await fetch(`${BACKEND_URL}/api/admin/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify(this.newAdminForm)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                alert(data.message);
                this.showAdminCreateModal = false; 
                this.newAdminForm = { name: '', email: '', password: '' }; 
            } catch (error) {
                alert(`Failed: ${error.message}`);
            }
        },
        openEventModalForDate(dateStr) {
            this.adminFormType = 'Event';
            this.adminFormData = { 
                title: '', price: '', img: '', extra: '', 
                event_date: dateStr, start_time: '09:00', end_time: '11:00' 
            };
            this.showAdminModal = true;
        }
    }
}).mount('#app');