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
            showSearchModal: false,
            searchQuery: '',
            searchResults: [],
            isSearching: false,
            noResultsFound: false,
            searchFilter: 'All', // 🚨 新增：记住当前搜索结果的过滤器
            courseFilter: 'All',
            resourceFilter: 'All',
            bookCategoryFilter: 'All',
            myLearningItems: [],
            quizSubmissions: [],
            quizScoreForm: {}, // { itemId: '', score: '' }

            // --- 表单与暂存数据 ---
            selectedPaymentMethod: null, 
            adminFormType: 'Book',
            currentAdminTab: 'Basic', // 🚨 新增：记录当前打开的是哪个 Tab页
            adminFormData: { title: '', price: '', img: '', category: '', duration: '', extra: '', description: '', event_date: '', start_time: '', end_time: '', previewImg: null },
            adminAdd(type) {
            if(type === 'courses') type = 'Course';
            if(type === 'resources') type = 'Resource';
            
            this.adminFormType = type;
            // 🚨 清空表单时，也把 description 清空
            this.adminFormData = { title: '', price: '', img: '', category: '', duration: '', extra: '', description: '', event_date: '', start_time: '', end_time: '', previewImg: null }; 
            this.showAdminModal = true;
        },
            loginForm: { email: '', password: '' },
            registerForm: { name: '', email: '', password: '' },
            checkoutForm: { address: '', country: '', shippingMethod: 'Ship' },
            newAdminForm: { name: '', email: '', password: '' },
            selectedNews: null,
            showItemModal: false,
            selectedItem: null,
            showEventModal: false,   // 🚨 控制事件弹窗的开关
            selectedEvent: null,     // 🚨 记录当前点击的是哪个事件
            isUploading: false,
            
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
            messages:[],
            newForumMessage: '',
            pollingTimer: null, // 🚨 用来存定时器的变量
            orders: [] 
        }
    },

    watch: {
        // 🚨 智能监听：进论坛就开始 3秒刷一次，离开就停止！
        currentView(newVal) {
            if (newVal === 'forum') {
                this.fetchMessages();
                this.pollingTimer = setInterval(this.fetchMessages, 3000); // 每3秒向后端拉取一次最新消息
            } else {
                if (this.pollingTimer) {
                    clearInterval(this.pollingTimer);
                    this.pollingTimer = null;
                }
            }
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
        // --- 过滤后的动态列表 ---
        uniqueBookCategories() {
            // 自动从 books 数据中提取所有不重复的 category
            const categories = new Set(this.books.map(book => book.category));
            return ['All Categories', ...categories]; // 返回一个数组，开头加上 'All'
        },
        filteredCourses() {
            if (this.courseFilter === 'All') return this.coursesData;
            if (this.courseFilter === 'Free') return this.coursesData.filter(c => c.price === 0);
            if (this.courseFilter === 'Paid') return this.coursesData.filter(c => c.price > 0);
        },
        filteredResources() {
            if (this.resourceFilter === 'All') return this.resourcesData;
            if (this.resourceFilter === 'Free') return this.resourcesData.filter(r => r.price === 0);
            if (this.resourceFilter === 'Paid') return this.resourcesData.filter(r => r.price > 0);
        },
        filteredBooks() {
            if (this.bookCategoryFilter === 'All Categories') return this.books;
            return this.books.filter(b => b.category === this.bookCategoryFilter);
        },

        filteredSearchResults() {
            if (this.searchFilter === 'All') {
                return this.searchResults;
            }
            return this.searchResults.filter(item => item.type === this.searchFilter);
        },
        
        isAdmin() {
            return this.currentUser && this.currentUser.role === 'admin';
        }
    },
    methods: {

        async updateOrderStatus(orderId, status) {
            try {
                const res = await fetch(`${BACKEND_URL}/api/admin/order-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({ orderId, newStatus: status })
                });
                const data = await res.json();
                alert(data.message);
                this.fetchOrders(); // 刷新订单列表
            } catch (e) { console.error(e); }
        },
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
                
                const books = await booksRes.json();
                const courses = await coursesRes.json();
                const resources = await resourcesRes.json();
                const news = await newsRes.json();
                this.eventsData = await eventsRes.json();

                // 🚨 神奇的魔法：批量将 Ngrok 图片转换为本地 Blob 缓存，彻底绕过拦截！
                this.books = await this.convertImages(books, 'cover_image_url');
                this.coursesData = await this.convertImages(courses, 'img');
                this.resourcesData = await this.convertImages(resources, 'img');
                this.newsData = await this.convertImages(news, 'img');

            } catch (error) {
                console.error("Error fetching data:", error);
            }
        },

        // ================= LMS (学习管理系统) 方法 =================
        async fetchMyLearning() {
            if (!this.currentUser) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/my-learning?userId=${this.currentUser.id}`, { 
                    headers: { 'ngrok-skip-browser-warning': 'true' } 
                });
                this.myLearningItems = await res.json();
            } catch (error) {
                console.error("Failed to fetch my learning items:", error);
            }
        },

        async submitQuizScore(item) {
            const score = this.quizScoreForm[item.id];
            if (!score || !score.trim()) {
                return alert("Please enter your score!");
            }
            try {
                const response = await fetch(`${BACKEND_URL}/api/quiz/submit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({
                        userId: this.currentUser.id,
                        userName: this.currentUser.name,
                        itemId: item.id,
                        itemTitle: item.title,
                        itemType: item.type,
                        score: score
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                alert('Your score has been submitted!');
                this.quizScoreForm[item.id] = ''; // 清空输入框
                this.fetchQuizSubmissions(); // Admin 实时刷新
            } catch (error) {
                alert(`Submission failed: ${error.message}`);
            }
        },

        async fetchQuizSubmissions() {
            if (!this.isAdmin) return;
            try {
                const res = await fetch(`${BACKEND_URL}/api/quiz/submissions`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                this.quizSubmissions = await res.json();
            } catch (error) {
                console.error("Failed to fetch submissions:", error);
            }
        },

        // ================= 搜索逻辑 =================
        async handleSearch() {
            if (!this.searchQuery.trim()) return;

            this.isSearching = true;
            this.noResultsFound = false;
            this.searchResults = [];
            this.searchFilter = 'All'; // 🚨 关键：每次新搜索都重置过滤器

            try {
                const response = await fetch(`${BACKEND_URL}/api/search?q=${this.searchQuery}`, {
                    headers: { 'ngrok-skip-browser-warning': 'true' }
                });
                const data = await response.json();
                this.searchResults = data;
                
                if (data.length === 0) {
                    this.noResultsFound = true;
                }
            } catch (error) {
                console.error("Search failed:", error);
                this.noResultsFound = true;
            } finally {
                this.isSearching = false;
            }
        },

        setSearchFilter(filter) {
            this.searchFilter = filter;
        },

        // 点击搜索结果后，跳转到对应的页面
        goToResult(item) {
            this.showSearchModal = false; // 关闭搜索框
            if (item.type === 'Book') {
                this.changeView('bookstore');
            } else if (item.type === 'Course') {
                this.changeView('courses');
            } else if (item.type === 'Resource') {
                this.changeView('resources');
            }
        },

        // 🚨 新增：处理图片的辅助函数 (瞒天过海)
        async convertImages(arr, imgKey) {
            return await Promise.all(arr.map(async item => {
                const url = item[imgKey];
                // 只有当图片是我们的 ngrok 链接时，才使用通行证去下载
                if (url && url.includes('ngrok-free.dev')) {
                    try {
                        const res = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                        if (res.ok) {
                            const blob = await res.blob();
                            item[imgKey] = URL.createObjectURL(blob); // 替换成不会被拦截的本地 Blob 链接
                        }
                    } catch(e) { console.error("Image load error", e); }
                }
                return item;
            }));
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

        setCourseFilter(filter) {
            this.courseFilter = filter;
        },
        setResourceFilter(filter) {
            this.resourceFilter = filter;
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

        // ================= 论坛逻辑 =================
        async fetchMessages() {
            try {
                const res = await fetch(`${BACKEND_URL}/api/messages`, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                this.messages = await res.json();
                this.scrollToBottom();
            } catch (e) { console.error(e); }
        },
        async sendForumMessage() {
            if (!this.currentUser) {
                alert("Please log in to chat!");
                this.changeView('login');
                return;
            }
            if (!this.newForumMessage.trim()) return;

            try {
                await fetch(`${BACKEND_URL}/api/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                    body: JSON.stringify({ userName: this.currentUser.name, message: this.newForumMessage.trim() })
                });
                this.newForumMessage = ''; // 清空输入框
                this.fetchMessages(); // 发送完立刻自己拉取一次，瞬间上墙
            } catch (e) { console.error(e); }
        },
        scrollToBottom() {
            setTimeout(() => {
                const box = document.getElementById('chat-box');
                if(box) box.scrollTop = box.scrollHeight;
            }, 100);
        },

        // 🚨 修复：补回点击 More Details 唤醒弹窗的方法！
        async viewItemDetails(item) {
            // 🚨 魔法：如果图片是相对路径或者是 ngrok 的，先转换成安全的 Blob
            if (item.img && (item.img.includes('uploads') || item.img.includes('ngrok-free.dev'))) {
                const url = item.img.startsWith('http') ? item.img : BACKEND_URL + item.img;
                try {
                    const res = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } });
                    const blob = await res.blob();
                    item.img = URL.createObjectURL(blob); // 转换成浏览器直接能看的本地缓存
                    } catch (e) { console.error("Image conversion failed", e); }
                }
                this.selectedItem = item;
                this.showItemModal = true;
            },

        viewEventDetails(evt) {
            this.selectedEvent = evt;      // 把点击的事件数据存起来
            this.showEventModal = true;    // 打开事件详情弹窗
        },

        // ================= 支付流程逻辑 (核心修改) =================

        // 升级版：通用文件上传 (图片/视频/PDF)
        async handleFileUpload(event, fieldToUpdate) {
            const file = event.target.files[0];
            if (!file) return;

            // 🚨 魔法 1：如果是封面图(img)，立刻生成一个本地临时预览，不需要等上传
            if (fieldToUpdate === 'img') {
                this.adminFormData.previewImg = URL.createObjectURL(file);
            }

            this.isUploading = true;
            const formData = new FormData();
            formData.append('media', file);

            try {
                const response = await fetch(`${BACKEND_URL}/api/upload`, {
                    method: 'POST',
                    headers: { 'ngrok-skip-browser-warning': 'true' },
                    body: formData
                });
                
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                // 🚨 魔法 2：保存后端返回的相对路径
                this.adminFormData[fieldToUpdate] = data.path; 
                
                // 如果不是图片（比如PDF），给个提示
                if (fieldToUpdate !== 'img') {
                    alert(`${fieldToUpdate} uploaded successfully!`);
                }
            } catch (error) {
                alert(`Upload error: ${error.message}`);
            } finally {
                this.isUploading = false;
            }
        },
        
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
            this.currentAdminTab = 'Basic'; // 🚨 新增：每次打开弹窗，都默认回到第一个 Tab
            this.adminFormData = { title: '', price: '', img: '', category: '', duration: '', extra: '', description: '', event_date: '', start_time: '', end_time: '', previewImg: null }; 
            this.showAdminModal = true;
        },
        async submitAdminForm() {
            if (!this.adminFormData.title) return alert("Title is required!");
            
            try {
                const response = await fetch(`${BACKEND_URL}/api/admin/add`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true' // 🚨 关键：跳过Ngrok警告
                    },
                    body: JSON.stringify({
                        type: this.adminFormType,
                        ...this.adminFormData
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                
                alert(data.message); 
                this.showAdminModal = false; // 关弹窗
                
                // 🚨 实时核心：立刻重新从数据库拉取最新数据，页面会瞬间刷出新内容！
                await this.fetchAllData(); 
                
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

            // 🚨🚨🚨 新增防线：严格限制管理员邮箱必须是 @edutech.com
            const adminEmail = this.newAdminForm.email.trim().toLowerCase();
            if (!adminEmail.endsWith('@edutech.com')) {
                return alert("Security Alert: Administrator emails MUST end with @edutech.com!");
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